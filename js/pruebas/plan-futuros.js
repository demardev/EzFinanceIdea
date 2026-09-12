/* Pruebas de los movimientos futuros dentro del plan — escritas antes que la
   implementación. Un movimiento con fecha adelante es un pendiente: no está
   en el saldo, así que el plan tiene que proyectarlo o desaparece. */

import { describir, igual } from './marco.js';
import { eventosDeMovimientos, construirLineaTiempo } from '../calc/plan/linea-tiempo.js';

const mov = (tipo, monto, fecha, extra = {}) =>
  ({ id: 'm1', tipo, monto, fecha, descripcion: 'Matrícula', cuenta_id: 'banco', ...extra });

describir('plan — movimientos con fecha futura', (caso) => {
  caso('un egreso futuro es una obligación en su día', () => {
    const [e] = eventosDeMovimientos([mov('egreso', 300, '2026-09-20')],
                                     '2026-09-11', '2026-09-30');
    igual(`${e.clase} ${e.nombre} ${e.fecha} ${e.monto}`,
          'obligacion Matrícula 2026-09-20 300');
    igual(e.cuentaId, 'banco');
    igual(e.origen, 'movimiento');
  });

  caso('un ingreso futuro entra como ingreso', () => {
    igual(eventosDeMovimientos([mov('ingreso', 900, '2026-09-20')],
                               '2026-09-11', '2026-09-30')[0].clase, 'ingreso');
  });

  caso('lo que ya pasó no se proyecta: ya está en el saldo', () => {
    igual(eventosDeMovimientos([mov('egreso', 300, '2026-09-01')],
                               '2026-09-11', '2026-09-30'), []);
  });

  caso('lo de después del horizonte tampoco', () => {
    igual(eventosDeMovimientos([mov('egreso', 300, '2026-12-01')],
                               '2026-09-11', '2026-09-30'), []);
  });

  /* Lo que toca una tarjeta lo proyecta la tarjeta, en su fecha de pago: si
     se contara aquí, el dinero saldría dos veces. */
  caso('los cargos y cuotas de tarjeta no se proyectan aquí', () => {
    const movs = [
      mov('egreso', 9.97, '2026-09-20', { cuenta_id: null, tarjeta_id: 't1', compra_id: 'c1' }),
      mov('egreso', 50, '2026-09-20', { cuenta_id: null, tarjeta_id: 't1' }),
      mov('transferencia', 80, '2026-09-20', { tarjeta_destino_id: 't1' }),
    ];
    igual(eventosDeMovimientos(movs, '2026-09-11', '2026-09-30'), []);
  });

  caso('una transferencia entre cuentas propias no cambia el total', () => {
    const entre = mov('transferencia', 100, '2026-09-20', { cuenta_destino_id: 'efectivo' });
    igual(eventosDeMovimientos([entre], '2026-09-11', '2026-09-30'), []);
  });

  caso('la línea de tiempo los incluye junto a todo lo demás', () => {
    const linea = construirLineaTiempo(
      { planItems: [], tarjetas: [], movimientos: [mov('egreso', 300, '2026-09-20')], compras: [] },
      { hoy: '2026-09-11', hasta: '2026-09-30', escenario: 'min' });
    igual(linea.map((e) => `${e.nombre} ${e.fecha}`), ['Matrícula 2026-09-20']);
  });
});

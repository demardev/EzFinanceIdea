/* Pruebas de calc/prestamos.js: lo que ya se había pagado ANTES de anotar
   el préstamo en la app (`abonado_antes`). No es un movimiento — ese dinero
   se movió antes — pero cuenta para lo que falta y para los atrasos. */

import { describir, igual } from './marco.js';
import { estadoPrestamo, validarPrestamo, cuentasDelFormulario, cuentasDeEleccion }
  from '../calc/prestamos.js';

const HOY = '2026-11-04';
/* Le debes a tu mamá 24 pagos de $30.00 desde el 10 de agosto, y antes de
   usar la app ya le habías dado tres. */
const telefono = {
  id: 't', direccion: 'debo', persona: 'Mamá', concepto: 'Teléfono',
  monto_total: 720, pago: 30, num_pagos: 24, primer_pago: '2026-08-10', abonado_antes: 90,
};
const abono = (monto, fecha) => ({ monto, fecha });

describir('préstamos — lo ya pagado antes', (caso) => {
  caso('cuenta como abonado y resta de lo que falta', () => {
    const e = estadoPrestamo(telefono, [], HOY);
    igual([e.abonado, e.restante], [90, 630]);
  });

  caso('se suma a los abonos de la app', () => {
    const e = estadoPrestamo(telefono, [abono(30, '2026-11-01')], HOY);
    igual([e.abonado, e.restante], [120, 600]);
  });

  caso('los pagos ya hechos cuentan en el progreso', () => {
    igual(estadoPrestamo(telefono, [abono(30, '2026-11-01')], HOY).progreso, '4/24');
  });

  caso('con lo de antes va al corriente: no sale atrasado', () => {
    const e = estadoPrestamo(telefono, [], HOY);
    igual([e.atraso, e.proximo.fecha], [0, '2026-11-10']);
  });

  caso('sin el campo, es cero (los préstamos de antes)', () => {
    const { abonado_antes, ...viejo } = telefono;
    igual(estadoPrestamo(viejo, [], HOY).abonado, 0);
  });

  caso('no puede ser todo el total: eso ya está saldado', () => {
    igual(validarPrestamo({ ...telefono, abonado_antes: 720 }),
          'Lo que ya se pagó tiene que ser menos que el total.');
  });

  caso('menos que el total, se puede guardar', () => {
    igual(validarPrestamo({ ...telefono, abonado_antes: 90 }), null);
  });
});

describir('préstamos — lo que enseña el formulario', (caso) => {
  caso('el total calculado y lo que falta tras lo ya pagado', () => {
    igual(cuentasDelFormulario({ monto_total: 0, pago: 30, num_pagos: 24, abonado_antes: 90 }),
          { total: 720, falta: 630 });
  });

  caso('también resta los movimientos elegidos para ligar', () => {
    igual(cuentasDelFormulario({ monto_total: 720, abonado_antes: 90, ligado: 60 }),
          { total: 720, falta: 570 });
  });

  caso('sin nada escrito, todo en cero', () => {
    igual(cuentasDelFormulario({}), { total: 0, falta: 0 });
  });

  caso('lo que falta nunca es negativo', () => {
    igual(cuentasDelFormulario({ monto_total: 100, abonado_antes: 150 }), { total: 100, falta: 0 });
  });
});

describir('préstamos — ligar movimientos que ya hiciste', (caso) => {
  const movs = [{ id: 'a', monto: 30 }, { id: 'b', monto: 45.5 }, { id: 'c', monto: 100 }];

  caso('suma solo los elegidos', () => {
    igual(cuentasDeEleccion(movs, ['a', 'b'], 200), { cuantos: 2, total: 75.5, sobra: 0 });
  });

  caso('si pasan de lo que falta, dice por cuánto', () => {
    igual(cuentasDeEleccion(movs, ['b', 'c'], 120), { cuantos: 2, total: 145.5, sobra: 25.5 });
  });

  caso('sin elegir nada, todo en cero', () => {
    igual(cuentasDeEleccion(movs, [], 120), { cuantos: 0, total: 0, sobra: 0 });
  });
});

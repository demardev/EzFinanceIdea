/* Pruebas de reembolsos a la tarjeta — escritas antes que la implementación.
   Un reembolso es un ingreso que entra a una tarjeta: baja la deuda sin salir
   de ninguna cuenta. Primero cancela cargos de su mismo corte (como en el
   estado de cuenta); lo que sobre se aplica como un pago, lo más viejo primero.
   Ciclo: corte 15, hoy 20/sep/2026 · corte anterior 15/ago · último 15/sep. */

import { describir, igual, cierto } from './marco.js';
import { calcularDeuda, esReembolso } from '../calc/deuda-tarjeta.js';
import { desgloseDeDeuda } from '../calc/desglose-tarjeta.js';
import { saldoAl } from '../calc/conciliacion.js';
import { deltaEnCuenta, totalesDelMes } from '../calc/saldos.js';
import { TIPOS } from '../movimientos/tipos.js';

const CICLO = { fechaCorteAnterior: '2026-08-15', fechaUltimoCorte: '2026-09-15',
                hoy: '2026-09-20', fechaLimiteDelCorte: '2026-10-05' };

const cargo = (monto, fecha) => ({ tipo: 'egreso', monto, fecha, tarjeta_id: 't1' });
const pago = (monto, fecha) => ({ tipo: 'transferencia', monto, fecha,
                                   cuenta_id: 'k', tarjeta_destino_id: 't1' });
const reembolso = (monto, fecha) => ({ tipo: 'ingreso', monto, fecha, tarjeta_id: 't1' });

describir('reembolsos a la tarjeta: deuda', (caso) => {
  caso('quién es reembolso', () => {
    cierto(esReembolso(reembolso(1, '2026-09-18')));
    cierto(!esReembolso({ tipo: 'ingreso', monto: 1, cuenta_id: 'k' }));
    cierto(!esReembolso(cargo(1, '2026-09-18')));
  });

  caso('cancela cargos de su mismo corte y no toca el corte cerrado', () => {
    const d = calcularDeuda([cargo(500, '2026-09-01'), cargo(20.88, '2026-09-17'),
                             reembolso(19.99, '2026-09-18')], CICLO);
    igual(d.saldoAlCorte, 500);
    igual(d.nuevoCiclo, 0.89);
    igual(d.deudaTotal, 500.89);
  });

  caso('lo que sobra de su corte se aplica como pago, lo más viejo primero', () => {
    const d = calcularDeuda([cargo(500, '2026-09-01'), cargo(10, '2026-09-17'),
                             reembolso(30, '2026-09-18')], CICLO);
    igual(d.nuevoCiclo, 0);
    igual(d.saldoAlCorte, 480);
  });

  caso('si no hay deuda, queda a favor', () => {
    const d = calcularDeuda([reembolso(25, '2026-09-18')], CICLO);
    igual(d.deudaTotal, 0);
    igual(d.saldoAFavor, 25);
  });

  caso('un reembolso con fecha futura todavía no cuenta', () => {
    igual(calcularDeuda([cargo(50, '2026-09-17'), reembolso(50, '2026-09-25')], CICLO)
      .deudaTotal, 50);
  });

  caso('se suma con los pagos', () => {
    const d = calcularDeuda([cargo(100, '2026-09-01'), cargo(40, '2026-09-17'),
                             reembolso(40, '2026-09-18'), pago(60, '2026-09-19')], CICLO);
    igual(d.saldoAlCorte, 40);
    igual(d.nuevoCiclo, 0);
  });
});

describir('reembolsos a la tarjeta: desglose y conciliación', (caso) => {
  const movs = [cargo(100, '2026-09-01'), pago(30, '2026-09-10'), reembolso(20, '2026-09-18')];

  caso('el desglose los muestra aparte y la cuenta cuadra', () => {
    const d = desgloseDeDeuda(movs, CICLO);
    igual(d.cargos, 100);
    igual(d.pagos, 30);
    igual(d.reembolsos, 20);
    igual(d.deudaTotal, 50);
  });

  caso('el saldo a una fecha los resta como a los pagos', () => {
    igual(saldoAl(movs, '2026-09-15'), 70);
    igual(saldoAl(movs, '2026-09-20'), 50);
  });
});

describir('reembolsos a la tarjeta: cuentas y totales', (caso) => {
  caso('no mueve ninguna cuenta', () => {
    igual(deltaEnCuenta(reembolso(20, '2026-09-18'), 'k'), 0);
  });

  caso('cuenta como entrada del mes, igual que un reembolso a una cuenta', () => {
    igual(totalesDelMes([reembolso(20, '2026-09-18')]).entro, 20);
  });
});

describir('reembolsos a la tarjeta: formulario de ingreso', (caso) => {
  const base = { monto: 19.99, fecha: '2026-11-12', descripcion: 'Reembolso Apple',
                 categoria_id: 'kr' };

  caso('entra a una tarjeta', () => {
    const fila = TIPOS.ingreso.aFila({ ...base, destino: 'tarjeta:t1' });
    igual([fila.cuenta_id, fila.tarjeta_id], [null, 't1']);
  });

  caso('entra a una cuenta, como siempre', () => {
    const fila = TIPOS.ingreso.aFila({ ...base, destino: 'cuenta:k' });
    igual([fila.cuenta_id, fila.tarjeta_id], ['k', null]);
  });

  caso('al editar vuelve a mostrar a dónde entró', () => {
    igual(TIPOS.ingreso.aFormulario({ tarjeta_id: 't1' }).destino, 'tarjeta:t1');
    igual(TIPOS.ingreso.aFormulario({ cuenta_id: 'k' }).destino, 'cuenta:k');
  });

  caso('sin destino no pasa', () => {
    cierto(TIPOS.ingreso.validar({ ...base, destino: '' }));
    igual(TIPOS.ingreso.validar({ ...base, destino: 'tarjeta:t1' }), null);
  });
});

/* Pruebas de calc/deuda-tarjeta.js — escritas antes que la implementación.
   Ciclo de referencia: corte 15, límite 5, hoy 20/sep/2026.
     corte anterior = 15/ago · último corte = 15/sep · límite = 05/oct */

import { describir, igual } from './marco.js';
import { calcularDeuda, comprometidoEnCuotas,
         deudaTotalDeTarjetas, movimientosDeTarjeta } from '../calc/deuda-tarjeta.js';

const CICLO = { fechaCorteAnterior: '2026-08-15', fechaUltimoCorte: '2026-09-15',
                hoy: '2026-09-20' };

const cargo = (monto, fecha) => ({ tipo: 'egreso', monto, fecha, tarjeta_id: 't1' });
const pago  = (monto, fecha) => ({ tipo: 'transferencia', monto, fecha, tarjeta_destino_id: 't1' });

describir('deuda de tarjeta', (caso) => {
  caso('reparte los cargos en las tres cubetas por fecha', () => {
    const d = calcularDeuda([
      cargo(1000, '2026-08-10'),   // antes del corte anterior -> vieja
      cargo(500,  '2026-09-01'),   // dentro del ciclo cerrado -> saldo al corte
      cargo(300,  '2026-09-18'),   // después del último corte -> nuevo ciclo
    ], CICLO);
    igual(d.deudaVieja, 1000);
    igual(d.saldoAlCorte, 500);
    igual(d.nuevoCiclo, 300);
    igual(d.deudaTotal, 1800);
    igual(d.saldoAFavor, 0);
  });

  caso('el cargo del día del corte pertenece al ciclo cerrado, no al nuevo', () => {
    const d = calcularDeuda([cargo(200, '2026-09-15')], CICLO);
    igual(d.saldoAlCorte, 200);
    igual(d.nuevoCiclo, 0);
  });

  caso('pago parcial: salda lo más viejo primero', () => {
    const d = calcularDeuda([
      cargo(1000, '2026-08-10'), cargo(500, '2026-09-01'), cargo(300, '2026-09-18'),
      pago(600, '2026-09-19'),
    ], CICLO);
    igual(d.deudaVieja, 400);      // 1000 − 600
    igual(d.saldoAlCorte, 500);    // intacto
    igual(d.nuevoCiclo, 300);
    igual(d.deudaTotal, 1200);
  });

  caso('el pago desborda a la siguiente cubeta', () => {
    const d = calcularDeuda([
      cargo(1000, '2026-08-10'), cargo(500, '2026-09-01'), cargo(300, '2026-09-18'),
      pago(1200, '2026-09-19'),
    ], CICLO);
    igual(d.deudaVieja, 0);
    igual(d.saldoAlCorte, 300);    // 500 − 200 sobrantes
    igual(d.nuevoCiclo, 300);
    igual(d.deudaTotal, 600);
  });

  caso('pago exacto de todo: no queda deuda ni saldo a favor', () => {
    const d = calcularDeuda([
      cargo(1000, '2026-08-10'), cargo(500, '2026-09-01'), cargo(300, '2026-09-18'),
      pago(1800, '2026-09-19'),
    ], CICLO);
    igual(d.deudaTotal, 0);
    igual(d.saldoAFavor, 0);
  });

  caso('sobrepago: lo que sobra queda como saldo a favor', () => {
    const d = calcularDeuda([
      cargo(1000, '2026-08-10'), cargo(500, '2026-09-01'),
      pago(1700, '2026-09-19'),
    ], CICLO);
    igual(d.deudaTotal, 0);
    igual(d.saldoAFavor, 200);
  });

  caso('varios pagos se acumulan y siguen la misma cascada', () => {
    const d = calcularDeuda([
      cargo(1000, '2026-08-10'), cargo(500, '2026-09-01'),
      pago(400, '2026-09-16'), pago(400, '2026-09-19'),
    ], CICLO);
    igual(d.deudaVieja, 200);
    igual(d.saldoAlCorte, 500);
    igual(d.deudaTotal, 700);
  });

  caso('lo que hay que pagar ahora es la deuda vieja más el saldo al corte', () => {
    const d = calcularDeuda([
      cargo(1000, '2026-08-10'), cargo(500, '2026-09-01'), cargo(300, '2026-09-18'),
    ], CICLO);
    igual(d.aPagarAhora, 1500);
  });

  caso('sin movimientos, todo en cero', () => {
    const d = calcularDeuda([], CICLO);
    igual(d, { deudaVieja: 0, saldoAlCorte: 0, nuevoCiclo: 0,
               deudaTotal: 0, saldoAFavor: 0, aPagarAhora: 0, comprometido: 0 });
  });

  caso('los centavos no se pierden en la cascada', () => {
    const d = calcularDeuda([
      cargo(333.33, '2026-08-10'), cargo(333.33, '2026-09-01'), cargo(333.34, '2026-09-18'),
      pago(500.5, '2026-09-19'),
    ], CICLO);
    igual(d.deudaVieja, 0);
    igual(d.saldoAlCorte, 166.16);   // 333.33 − 167.17 restantes
    igual(d.deudaTotal, 499.5);
  });

  caso('una cuota futura no es deuda de hoy, es comprometido', () => {
    const futura = {
      tipo: 'egreso', monto: 1500, fecha: '2026-11-20', tarjeta_id: 't1',
      compra_id: 'c9', cuota_num: 3, cuota_total: 6,
    };
    const d = calcularDeuda([cargo(500, '2026-09-18'), futura], CICLO);
    igual(d.nuevoCiclo, 500);
    igual(d.deudaTotal, 500);
    igual(comprometidoEnCuotas([cargo(500, '2026-09-18'), futura], CICLO.hoy), 1500);
  });

  caso('comprometido en cuotas: solo las que aún no se cobran', () => {
    const cuota = (monto, fecha, k) => ({
      tipo: 'egreso', monto, fecha, tarjeta_id: 't1',
      compra_id: 'compra1', cuota_num: k, cuota_total: 3,
    });
    const movs = [
      cuota(400, '2026-08-20', 1),   // ya se cobró
      cuota(400, '2026-09-20', 2),   // ya se cobró (hoy es 20/sep)
      cuota(400, '2026-10-20', 3),   // futura -> comprometida
      cargo(900, '2026-09-01'),      // no es cuota
    ];
    igual(comprometidoEnCuotas(movs, '2026-09-20'), 400);
  });

  caso('sin cuotas futuras, no hay comprometido', () => {
    igual(comprometidoEnCuotas([cargo(500, '2026-09-01')], '2026-09-20'), 0);
  });

  caso('el uso del límite se reporta como porcentaje', () => {
    const d = calcularDeuda([cargo(12500, '2026-09-01')], CICLO, 50000);
    igual(d.usoDelLimite, 25);
    igual(d.disponible, 37500);
  });

  /* El banco congela el monto COMPLETO de una compra a meses en cuanto la
     haces, y lo va soltando conforme le pagas. Si el disponible solo restara
     la cuota ya cobrada, diría que tienes miles de más. */
  caso('una compra a meses congela el total, no solo la cuota cobrada', () => {
    const cuota = (k, fecha) => ({
      tipo: 'egreso', monto: 1000, fecha, tarjeta_id: 't1',
      compra_id: 'msi', cuota_num: k, cuota_total: 12,
    });
    const movs = [cuota(1, '2026-09-18'),
      ...Array.from({ length: 11 }, (_, i) => cuota(i + 2, `2026-${10 + i}-18`))];

    const d = calcularDeuda(movs, CICLO, 50000);
    igual(d.deudaTotal, 1000);        // cobrado hasta hoy
    igual(d.disponible, 38000);       // 50000 − 12000 de la compra entera
    igual(d.usoDelLimite, 24);
  });

  caso('el disponible se libera al PAGAR la tarjeta, no al vencer la cuota', () => {
    const cuota = (k, fecha) => ({
      tipo: 'egreso', monto: 1000, fecha, tarjeta_id: 't1',
      compra_id: 'msi', cuota_num: k, cuota_total: 3,
    });
    const dos = [cuota(1, '2026-08-18'), cuota(2, '2026-09-18'), cuota(3, '2026-10-18')];

    /* Dos cuotas ya cobradas y ninguna pagada: sigue congelado el total. */
    igual(calcularDeuda(dos, CICLO, 50000).disponible, 47000);

    /* Al pagar 1000 al banco, se libera exactamente eso. */
    igual(calcularDeuda([...dos, pago(1000, '2026-09-19')], CICLO, 50000).disponible, 48000);
  });
});

describir('deuda sumada de varias tarjetas', (caso) => {
  const tarjetas = [
    { id: 't1', dia_corte: 15, dia_limite_pago: 5 },
    { id: 't2', dia_corte: 28, dia_limite_pago: 20 },
  ];
  const movs = [
    { tipo: 'egreso', monto: 1000, fecha: '2026-09-01', tarjeta_id: 't1' },
    { tipo: 'egreso', monto: 700, fecha: '2026-09-01', tarjeta_id: 't2' },
    { tipo: 'transferencia', monto: 200, fecha: '2026-09-02', cuenta_id: 'banco',
      tarjeta_destino_id: 't1' },
    { tipo: 'egreso', monto: 500, fecha: '2026-09-01', cuenta_id: 'banco' },  // no es de tarjeta
  ];

  caso('suma lo de todas las tarjetas y deja fuera lo que no lo es', () => {
    igual(deudaTotalDeTarjetas(tarjetas, movs, [], '2026-09-20'), 1500);
  });

  caso('los movimientos de una tarjeta incluyen cargos y pagos', () => {
    igual(movimientosDeTarjeta(movs, 't1').length, 2);
  });

  caso('sin tarjetas, cero', () => {
    igual(deudaTotalDeTarjetas([], movs, [], '2026-09-20'), 0);
  });
});

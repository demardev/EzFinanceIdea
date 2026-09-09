/* Pruebas de calc/vencimientos.js — escritas antes que la implementación. */

import { describir, igual, cierto } from './marco.js';
import { proximosVencimientos } from '../calc/vencimientos.js';

const TARJETA = { id: 'bbva', nombre: 'BBVA', dia_corte: 15, dia_limite_pago: 5,
                  limite_credito: 50000, archivada: false };
const cargo = (monto, fecha) => ({ tipo: 'egreso', monto, fecha, tarjeta_id: 'bbva' });

const GASTO = { id: 'g1', nombre: 'Renta', clase: 'gasto', variabilidad: 'fijo',
                monto: 12000, dia_mes: 20, cuenta_id: 'banco', activo: true };

const vacio = { tarjetas: [], movimientos: [], compras: [], planItems: [] };

describir('próximos vencimientos', (caso) => {
  caso('sin nada que deber, no hay vencimientos', () => {
    igual(proximosVencimientos(vacio, { hoy: '2026-09-16', dias: 14 }), []);
  });

  caso('la fecha límite de pago aparece con lo que hay que pagar', () => {
    // Hoy 16/sep: último corte 15/sep, vence 05/oct.
    const lista = proximosVencimientos(
      { ...vacio, tarjetas: [TARJETA], movimientos: [cargo(3000, '2026-09-10')] },
      { hoy: '2026-09-16', dias: 30 });
    const pago = lista.find((v) => v.clase === 'pago');
    igual(pago.nombre, 'BBVA');
    igual(pago.monto, 3000);
    igual(pago.fecha, '2026-10-05');
    igual(pago.dias, 19);
  });

  caso('el corte aparece con lo que se va a cobrar', () => {
    const lista = proximosVencimientos(
      { ...vacio, tarjetas: [TARJETA], movimientos: [cargo(800, '2026-09-16')] },
      { hoy: '2026-09-16', dias: 30 });
    const corte = lista.find((v) => v.clase === 'corte');
    igual(corte.fecha, '2026-10-15');
    igual(corte.monto, 800);
  });

  caso('los gastos fijos entran con su próxima fecha', () => {
    const lista = proximosVencimientos({ ...vacio, planItems: [GASTO] },
                                       { hoy: '2026-09-16', dias: 14 });
    igual(lista.length, 1);
    igual(lista[0], { clase: 'gasto', nombre: 'Renta', fecha: '2026-09-20',
                      monto: 12000, dias: 4, estado: 'urgente' });
  });

  caso('lo que cae fuera del horizonte no aparece', () => {
    igual(proximosVencimientos({ ...vacio, planItems: [GASTO] },
                               { hoy: '2026-09-16', dias: 2 }), []);
  });

  caso('ámbar a 5 días o menos, normal más allá', () => {
    const a5 = proximosVencimientos({ ...vacio, planItems: [{ ...GASTO, dia_mes: 21 }] },
                                    { hoy: '2026-09-16', dias: 14 });
    igual(a5[0].estado, 'urgente');
    const a6 = proximosVencimientos({ ...vacio, planItems: [{ ...GASTO, dia_mes: 22 }] },
                                    { hoy: '2026-09-16', dias: 14 });
    igual(a6[0].estado, 'normal');
  });

  caso('un pago ya vencido sale marcado y con días negativos', () => {
    // Corte 15/ago, vence 05/sep. Hoy 10/sep: venció hace 5 días.
    const lista = proximosVencimientos(
      { ...vacio, tarjetas: [TARJETA], movimientos: [cargo(3000, '2026-08-10')] },
      { hoy: '2026-09-10', dias: 14 });
    const pago = lista.find((v) => v.clase === 'pago');
    igual(pago.estado, 'vencido');
    igual(pago.dias, -5);
    igual(pago.fecha, '2026-09-05');
  });

  caso('sale ordenado por fecha, lo más próximo primero', () => {
    const lista = proximosVencimientos({
      ...vacio,
      tarjetas: [TARJETA],
      movimientos: [cargo(3000, '2026-09-10'), cargo(500, '2026-09-16')],
      planItems: [GASTO],
    }, { hoy: '2026-09-16', dias: 40 });
    const fechas = lista.map((v) => v.fecha);
    cierto(fechas.every((f, i) => i === 0 || fechas[i - 1] <= f), 'no está ordenado');
    igual(fechas[0], '2026-09-20');
  });

  caso('las tarjetas archivadas y los items pausados no cuentan', () => {
    const lista = proximosVencimientos({
      ...vacio,
      tarjetas: [{ ...TARJETA, archivada: true }],
      movimientos: [cargo(3000, '2026-09-10')],
      planItems: [{ ...GASTO, activo: false }],
    }, { hoy: '2026-09-16', dias: 40 });
    igual(lista, []);
  });

  caso('las cuotas ya pagadas no inflan el pago', () => {
    const compra = { id: 'c1', tarjeta_id: 'bbva', num_cuotas: 6, cuotas_pagadas: 2 };
    const cuota = (k, fecha) => ({ tipo: 'egreso', monto: 100, fecha, tarjeta_id: 'bbva',
                                   compra_id: 'c1', cuota_num: k, cuota_total: 6 });
    const lista = proximosVencimientos({
      ...vacio, tarjetas: [TARJETA], compras: [compra],
      movimientos: [cuota(1, '2026-08-05'), cuota(2, '2026-09-05'), cuota(3, '2026-09-14')],
    }, { hoy: '2026-09-16', dias: 30 });
    igual(lista.find((v) => v.clase === 'pago').monto, 100);   // solo la cuota 3
  });
});

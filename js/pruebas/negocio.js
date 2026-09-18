/* Pruebas de negocio/pago-recibo.js — escritas antes que la implementación.
   Las de agrupar viven en pruebas/agrupar.js. */

import { describir, igual } from './marco.js';
import { movimientosDePago, estaPendiente, totalPorCobrar,
         totalesDeNegocio } from '../negocio/pago-recibo.js';

const CATS = { pago: 'cat-pago', cobro: 'cat-cobro', comision: 'cat-comision' };

const PENDIENTE = {
  id: 'p1', monto_recibo: 50, comision: 1, descripcion: 'Doña Rosa',
  fecha_pago: '2026-09-01', cuenta_pago_id: 'banco',
  fecha_cobro: null, cuenta_cobro_id: null,
};

const COBRADO = {
  ...PENDIENTE, id: 'p2',
  fecha_cobro: '2026-09-08', cuenta_cobro_id: 'efectivo',
};

describir('pago de recibo — movimientos generados', (caso) => {
  caso('pendiente: solo sale el egreso', () => {
    const movs = movimientosDePago(PENDIENTE, CATS);
    igual(movs.length, 1);
    igual(movs[0].tipo, 'egreso');
    igual(movs[0].monto, 50);
    igual(movs[0].fecha, '2026-09-01');
    igual(movs[0].cuenta_id, 'banco');
  });

  caso('todo movimiento del negocio queda marcado y atado a su operación', () => {
    movimientosDePago(COBRADO, CATS).forEach((m) => {
      igual(m.ambito, 'negocio');
      igual(m.pago_id, 'p2');
    });
  });

  caso('cobrado: egreso más los dos ingresos, con la fecha del COBRO', () => {
    const movs = movimientosDePago(COBRADO, CATS);
    igual(movs.length, 3);
    igual(movs.map((m) => `${m.tipo} ${m.monto} ${m.fecha}`), [
      'egreso 50 2026-09-01',
      'ingreso 50 2026-09-08',
      'ingreso 1 2026-09-08',
    ]);
    igual(movs[1].cuenta_id, 'efectivo');
    igual(movs[2].cuenta_id, 'efectivo');
  });

  caso('sin comisión no se inventa un movimiento de cero', () => {
    igual(movimientosDePago({ ...COBRADO, comision: 0 }, CATS).length, 2);
  });

  caso('cada movimiento lleva su categoría', () => {
    const movs = movimientosDePago(COBRADO, CATS);
    igual(movs.map((m) => m.categoria_id), ['cat-pago', 'cat-cobro', 'cat-comision']);
  });

  caso('la descripción encabeza los tres movimientos: por ahí se busca', () => {
    const movs = movimientosDePago(COBRADO, CATS);
    igual(movs.map((m) => m.descripcion), [
      'Doña Rosa — pago de recibo',
      'Doña Rosa — cobro de recibo',
      'Doña Rosa — comisión',
    ]);
  });

  caso('sin descripción queda el texto genérico', () => {
    const movs = movimientosDePago({ ...COBRADO, descripcion: '  ' }, CATS);
    igual(movs.map((m) => m.descripcion),
          ['Pago de recibo', 'Cobro de recibo', 'Comisión']);
  });

  caso('las columnas de ruteo que no se usan quedan en nulo', () => {
    const [egreso] = movimientosDePago(PENDIENTE, CATS);
    igual(egreso.tarjeta_id, null);
    igual(egreso.cuenta_destino_id, null);
    igual(egreso.tarjeta_destino_id, null);
  });

  caso('abono parcial: sale solo el cobro de lo abonado, la comisión espera', () => {
    const parcial = { ...PENDIENTE, abonos: [
      { fecha: '2026-09-01', cuenta_id: 'efectivo', monto: 35 }] };
    igual(movimientosDePago(parcial, CATS).map((m) => `${m.tipo} ${m.monto} ${m.cuenta_id}`),
          ['egreso 50 banco', 'ingreso 35 efectivo']);
  });

  caso('cada abono entra en su día y en su cuenta', () => {
    const saldado = { ...PENDIENTE, abonos: [
      { fecha: '2026-09-01', cuenta_id: 'efectivo', monto: 35 },
      { fecha: '2026-09-05', cuenta_id: 'banco', monto: 16 }] };
    igual(movimientosDePago(saldado, CATS).map((m) => `${m.tipo} ${m.monto} ${m.fecha} ${m.cuenta_id}`), [
      'egreso 50 2026-09-01 banco',
      'ingreso 35 2026-09-01 efectivo',
      'ingreso 15 2026-09-05 banco',
      'ingreso 1 2026-09-05 banco',
    ]);
  });

  caso('el neto de una operación cobrada es la comisión', () => {
    const movs = movimientosDePago(COBRADO, CATS);
    const neto = movs.reduce((n, m) => n + (m.tipo === 'ingreso' ? m.monto : -m.monto), 0);
    igual(Math.round(neto * 100) / 100, 1);
  });
});

describir('pago de recibo — por cobrar', (caso) => {
  caso('pendiente es no tener fecha de cobro', () => {
    igual(estaPendiente(PENDIENTE), true);
    igual(estaPendiente(COBRADO), false);
  });

  caso('te deben el recibo más la comisión', () => {
    igual(totalPorCobrar([PENDIENTE]), 51);
  });

  caso('con un abono parcial sigue pendiente y te deben solo el resto', () => {
    const parcial = { ...PENDIENTE, abonos: [
      { fecha: '2026-09-01', cuenta_id: 'efectivo', monto: 35 }] };
    igual(estaPendiente(parcial), true);
    igual(totalPorCobrar([parcial]), 16);
  });

  caso('lo ya cobrado no cuenta', () => {
    igual(totalPorCobrar([PENDIENTE, COBRADO, { ...PENDIENTE, id: 'p3' }]), 102);
    igual(totalPorCobrar([COBRADO]), 0);
    igual(totalPorCobrar([]), 0);
  });
});

describir('pago de recibo — totales del mes', (caso) => {
  const delMes = [
    { ...PENDIENTE, id: 'a', monto_recibo: 50, comision: 1,
      fecha_pago: '2026-09-01', fecha_cobro: '2026-09-01' },
    { ...PENDIENTE, id: 'b', monto_recibo: 30, comision: 1,
      fecha_pago: '2026-09-05', fecha_cobro: null },              // pagado, no cobrado
    { ...PENDIENTE, id: 'c', monto_recibo: 20, comision: 1,
      fecha_pago: '2026-08-28', fecha_cobro: '2026-09-03' },      // cobrado este mes
  ];

  caso('movido es lo que pagaste este mes', () => {
    igual(totalesDeNegocio(delMes, '2026-09').movido, 80);        // 50 + 30
  });

  caso('ganado son las comisiones COBRADAS este mes', () => {
    // la de 'b' no se ha cobrado; la de 'c' se pagó en agosto pero se cobró ahora
    igual(totalesDeNegocio(delMes, '2026-09').ganado, 2);
  });

  caso('la comisión se gana el día del abono que la cubre', () => {
    const enPartes = { ...PENDIENTE, fecha_pago: '2026-08-30', abonos: [
      { fecha: '2026-08-30', cuenta_id: 'efectivo', monto: 35 },
      { fecha: '2026-09-02', cuenta_id: 'banco', monto: 16 }] };
    igual(totalesDeNegocio([enPartes], '2026-08').ganado, 0);
    igual(totalesDeNegocio([enPartes], '2026-09').ganado, 1);
  });

  caso('operaciones cuenta las del mes', () => {
    igual(totalesDeNegocio(delMes, '2026-09').operaciones, 2);
  });

  caso('un mes sin nada da ceros', () => {
    igual(totalesDeNegocio(delMes, '2026-12'), { movido: 0, ganado: 0, operaciones: 0 });
  });
});

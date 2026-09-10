/* Pruebas de negocio/pago-recibo.js y negocio/agrupar.js — escritas antes
   que la implementación. */

import { describir, igual, cierto } from './marco.js';
import { movimientosDePago, estaPendiente, totalPorCobrar,
         totalesDeNegocio } from '../negocio/pago-recibo.js';
import { agruparOperaciones } from '../negocio/agrupar.js';

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

  caso('operaciones cuenta las del mes', () => {
    igual(totalesDeNegocio(delMes, '2026-09').operaciones, 2);
  });

  caso('un mes sin nada da ceros', () => {
    igual(totalesDeNegocio(delMes, '2026-12'), { movido: 0, ganado: 0, operaciones: 0 });
  });
});

describir('agrupar operaciones en la lista', (caso) => {
  const m = (id, pago_id, tipo, monto, fecha) =>
    ({ id, pago_id, tipo, monto, fecha, ambito: pago_id ? 'negocio' : 'personal' });

  caso('los movimientos sueltos pasan tal cual', () => {
    const sueltos = [m('x', null, 'egreso', 10, '2026-09-08')];
    const filas = agruparOperaciones(sueltos);
    igual(filas.length, 1);
    igual(filas[0].grupo, false);
    igual(filas[0].movimiento.id, 'x');
  });

  caso('una operación del mismo día se colapsa en una fila', () => {
    const filas = agruparOperaciones([
      m('1', 'p1', 'egreso', 50, '2026-09-08'),
      m('2', 'p1', 'ingreso', 50, '2026-09-08'),
      m('3', 'p1', 'ingreso', 1, '2026-09-08'),
    ]);
    igual(filas.length, 1);
    igual(filas[0].grupo, true);
    igual(filas[0].neto, 1);
    igual(filas[0].pagoId, 'p1');
    igual(filas[0].incluyeEgreso, true);
  });

  caso('si el cobro es otro día, son dos filas', () => {
    const filas = agruparOperaciones([
      m('1', 'p1', 'egreso', 50, '2026-09-01'),
      m('2', 'p1', 'ingreso', 50, '2026-09-08'),
      m('3', 'p1', 'ingreso', 1, '2026-09-08'),
    ]);
    igual(filas.length, 2);
    igual(filas.map((f) => `${f.fecha} ${f.neto}`), ['2026-09-01 -50', '2026-09-08 51']);
    igual(filas[0].incluyeEgreso, true);
    igual(filas[1].incluyeEgreso, false);
  });

  caso('conserva el orden en que venían', () => {
    const filas = agruparOperaciones([
      m('a', null, 'egreso', 5, '2026-09-09'),
      m('1', 'p1', 'egreso', 50, '2026-09-08'),
      m('2', 'p1', 'ingreso', 50, '2026-09-08'),
      m('b', null, 'ingreso', 7, '2026-09-07'),
    ]);
    igual(filas.map((f) => f.fecha), ['2026-09-09', '2026-09-08', '2026-09-07']);
  });

  caso('dos operaciones distintas el mismo día no se mezclan', () => {
    const filas = agruparOperaciones([
      m('1', 'p1', 'egreso', 50, '2026-09-08'),
      m('2', 'p2', 'egreso', 30, '2026-09-08'),
    ]);
    igual(filas.length, 2);
    cierto(filas.every((f) => f.grupo));
  });
});

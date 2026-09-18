/* Pruebas de negocio/agrupar.js: los movimientos de una operación se ven
   como una sola fila por día en la lista. */

import { describir, igual, cierto } from './marco.js';
import { agruparOperaciones } from '../negocio/agrupar.js';

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

/* Pruebas de movimientos/orden.js */

import { describir, igual } from './marco.js';
import { ordenarPorFecha, direccionOpuesta } from '../movimientos/orden.js';

const m = (id, fecha, created_at) => ({ id, fecha, created_at });

const LISTA = [
  m('a', '2026-09-05', '2026-09-05T10:00:00Z'),
  m('b', '2026-09-08', '2026-09-08T08:00:00Z'),
  m('c', '2026-09-08', '2026-09-08T19:00:00Z'),   // mismo día, más tarde
  m('d', '2026-09-01', '2026-09-01T12:00:00Z'),
];

describir('orden de movimientos', (caso) => {
  caso('descendente: lo más reciente primero', () => {
    igual(ordenarPorFecha(LISTA, 'desc').map((x) => x.id), ['c', 'b', 'a', 'd']);
  });

  caso('ascendente: lo más antiguo primero', () => {
    igual(ordenarPorFecha(LISTA, 'asc').map((x) => x.id), ['d', 'a', 'b', 'c']);
  });

  caso('dentro del mismo día desempata por hora de registro', () => {
    const mismoDia = [m('temprano', '2026-09-08', '2026-09-08T08:00:00Z'),
                      m('tarde', '2026-09-08', '2026-09-08T19:00:00Z')];
    igual(ordenarPorFecha(mismoDia, 'desc').map((x) => x.id), ['tarde', 'temprano']);
    igual(ordenarPorFecha(mismoDia, 'asc').map((x) => x.id), ['temprano', 'tarde']);
  });

  caso('sin created_at no revienta ni pierde filas', () => {
    const sinHora = [m('x', '2026-09-08'), m('y', '2026-09-01')];
    igual(ordenarPorFecha(sinHora, 'desc').map((i) => i.id), ['x', 'y']);
    igual(ordenarPorFecha(sinHora).length, 2);
  });

  caso('no muta el arreglo original', () => {
    const copia = [...LISTA];
    ordenarPorFecha(LISTA, 'asc');
    igual(LISTA.map((x) => x.id), copia.map((x) => x.id));
  });

  caso('por defecto es descendente', () => {
    igual(ordenarPorFecha(LISTA).map((x) => x.id), ['c', 'b', 'a', 'd']);
  });

  caso('la dirección opuesta alterna', () => {
    igual(direccionOpuesta('desc'), 'asc');
    igual(direccionOpuesta('asc'), 'desc');
  });
});

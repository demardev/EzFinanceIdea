/* Pruebas de negocio/ultimas.js — escritas antes que la implementación.
   Las últimas operaciones del negocio, con cuánto fueron y si ya se cobraron. */

import { describir, igual } from './marco.js';
import { ultimasOperaciones } from '../negocio/ultimas.js';

const pago = (id, fecha_pago, created_at, abonos = []) => ({
  id, fecha_pago, created_at, monto_recibo: 50, comision: 1, abonos,
  fecha_cobro: null, cuenta_cobro_id: null,
});

describir('negocio — últimas operaciones', (caso) => {
  caso('de la más reciente a la más vieja, por el día del pago', () => {
    const r = ultimasOperaciones([
      pago('a', '2026-10-01', '2026-10-01T10:00'),
      pago('b', '2026-10-20', '2026-10-20T10:00'),
      pago('c', '2026-10-05', '2026-10-28T10:00'),       // registrada tarde: cuenta su día
    ]);
    igual(r.map((p) => p.id), ['b', 'c', 'a']);
  });

  caso('el mismo día, primero la que registraste después', () => {
    const r = ultimasOperaciones([
      pago('a', '2026-10-28', '2026-10-28T20:04'),
      pago('b', '2026-10-28', '2026-10-28T20:10'),
    ]);
    igual(r.map((p) => p.id), ['b', 'a']);
  });

  caso('cinco por defecto, o las que se pidan', () => {
    const muchas = Array.from({ length: 8 }, (_, i) =>
      pago(`p${i}`, `2026-10-0${i + 1}`, `2026-10-0${i + 1}T10:00`));
    igual(ultimasOperaciones(muchas).length, 5);
    igual(ultimasOperaciones(muchas, 3).map((p) => p.id), ['p7', 'p6', 'p5']);
  });

  caso('cada una con su total, lo que falta y si ya se cobró', () => {
    const r = ultimasOperaciones([
      pago('a', '2026-10-02', 'x', [{ fecha: '2026-10-02', cuenta_id: 'b', monto: 51 }]),
      pago('b', '2026-10-01', 'x', [{ fecha: '2026-10-02', cuenta_id: 'b', monto: 30 }]),
    ]);
    igual(r.map((p) => [p.id, p.total, p.saldo, p.cobrada]),
          [['a', 51, 0, true], ['b', 51, 21, false]]);
  });

  caso('no toca la lista original', () => {
    const lista = [pago('a', '2026-10-01', 'x'), pago('b', '2026-10-02', 'x')];
    ultimasOperaciones(lista);
    igual(lista.map((p) => p.id), ['a', 'b']);
  });
});

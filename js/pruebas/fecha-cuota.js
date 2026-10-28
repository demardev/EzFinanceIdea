/* Pruebas de calc/fecha-cuota.js — escritas antes que la implementación.
   Cada banco carga la cuota en un día distinto: el mismo día del mes que la
   compra, o un día antes de cada corte. */

import { describir, igual } from './marco.js';
import { fechaDeCuota } from '../calc/fecha-cuota.js';
import { generarCuotas } from '../calc/cuotas.js';

const compra = (fecha_compra, extra = {}) => ({
  id: 'c1', tarjeta_id: 't1', descripcion: 'Tele', monto_total: 1200,
  num_cuotas: 12, fecha_compra, ...extra,
});
const ANTES = { dia_corte: 15, cargo_cuotas: 'antes_corte' };

describir('fecha de cada cuota', (caso) => {
  caso('sin tarjeta o con la regla de siempre, cae el día de la compra', () => {
    igual(fechaDeCuota(compra('2026-10-03'), 1), '2026-10-03');
    igual(fechaDeCuota(compra('2026-10-03'), 3, { dia_corte: 15, cargo_cuotas: 'compra' }),
          '2026-12-03');
  });

  caso('antes del corte: la primera cae un día antes del corte que incluye la compra', () => {
    igual(fechaDeCuota(compra('2026-10-03'), 1, ANTES), '2026-10-14');
    igual(fechaDeCuota(compra('2026-10-03'), 2, ANTES), '2026-11-14');
  });

  caso('una compra después del corte se va al corte siguiente', () => {
    igual(fechaDeCuota(compra('2026-10-20'), 1, ANTES), '2026-11-14');
    igual(fechaDeCuota(compra('2026-12-20'), 2, ANTES), '2027-02-14');
  });

  caso('una compra el día antes del corte se cobra ese mismo día', () => {
    igual(fechaDeCuota(compra('2026-10-14'), 1, ANTES), '2026-10-14');
  });

  caso('una compra el día del corte va a ese corte, sin cuota antes de la compra', () => {
    igual(fechaDeCuota(compra('2026-10-15'), 1, ANTES), '2026-10-15');
    igual(fechaDeCuota(compra('2026-10-15'), 2, ANTES), '2026-11-14');
  });

  caso('con corte 31, en los meses cortos cuenta el último día', () => {
    const fin = { dia_corte: 31, cargo_cuotas: 'antes_corte' };
    igual(fechaDeCuota(compra('2027-01-10'), 1, fin), '2027-01-30');
    igual(fechaDeCuota(compra('2027-01-10'), 2, fin), '2027-02-27');
    igual(fechaDeCuota(compra('2027-01-10'), 3, fin), '2027-03-30');
  });

  caso('generarCuotas usa la regla de la tarjeta', () => {
    const cuotas = generarCuotas(compra('2026-10-20', { num_cuotas: 3 }), ANTES);
    igual(cuotas.map((c) => c.fecha), ['2026-11-14', '2026-12-14', '2027-01-14']);
  });
});

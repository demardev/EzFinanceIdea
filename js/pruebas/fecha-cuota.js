/* Pruebas de calc/fecha-cuota.js — escritas antes que la implementación.
   Cada banco carga la cuota en un día distinto: el mismo día del mes que la
   compra, o un día antes de cada corte. */

import { describir, igual } from './marco.js';
import { fechaDeCuota } from '../calc/fecha-cuota.js';
import { generarCuotas, planRegeneracion } from '../calc/cuotas.js';

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

/* BAC: los Airpods del 29/oct/2025 se cobran el 28 de cada mes desde el
   28/nov, que no sale de ninguna regla de la tarjeta. La compra guarda su
   primera cuota y eso manda, también al editarla. */
describir('primera cuota escrita en la compra', (caso) => {
  const AIRPODS = compra('2025-10-29', { num_cuotas: 36, monto_total: 359,
                                         fecha_primera_cuota: '2025-11-28' });
  const BAC = { dia_corte: 9, cargo_cuotas: 'antes_corte' };

  caso('manda sobre la regla de la tarjeta', () => {
    igual(fechaDeCuota(AIRPODS, 1, BAC), '2025-11-28');
    igual(fechaDeCuota(AIRPODS, 13, BAC), '2026-11-28');
    igual(fechaDeCuota(AIRPODS, 36, BAC), '2028-10-28');
  });

  caso('al editar, las cobradas no se mueven y las nuevas siguen el mismo día', () => {
    const existentes = generarCuotas(AIRPODS, BAC).map((c, i) => ({ ...c, id: `q${i + 1}` }));
    const plan = planRegeneracion({ ...AIRPODS, descripcion: 'AirPods Pro' }, existentes,
                                  '2026-11-17', BAC);
    igual(plan.aMover, []);
    igual(plan.aCrear[0].fecha, '2026-11-28');
    igual(plan.aCrear[0].cuota_num, 13);
  });

  caso('sin primera cuota escrita, sigue la regla de la tarjeta', () => {
    const { fecha_primera_cuota, ...sinFecha } = AIRPODS;
    igual(fechaDeCuota(sinFecha, 1, BAC), '2025-11-08');
  });
});

/* Pruebas de negocio/tiempos.js — escritas antes que la implementación.
   Cuánto tarda en volver tu dinero y qué lleva demasiado en la calle. */

import { describir, igual } from './marco.js';
import { tiemposDeCobro, pendientesViejos } from '../negocio/tiempos.js';

const HOY = '2026-10-28';
const pago = (id, fecha_pago, abonos = [], extra = {}) => ({
  id, fecha_pago, monto_recibo: 50, comision: 1, abonos,
  fecha_cobro: null, cuenta_cobro_id: null, ...extra,
});
const todo = (fecha) => [{ fecha, cuenta_id: 'b', monto: 51 }];

describir('negocio — cuánto tardas en cobrar', (caso) => {
  caso('promedio de días entre que pagas y te terminan de pagar', () => {
    const r = tiemposDeCobro([
      pago('a', '2026-10-01', todo('2026-10-01')),           // 0 días
      pago('b', '2026-10-02', todo('2026-10-05')),           // 3 días
      pago('c', '2026-10-10', todo('2026-10-16')),           // 6 días
    ], HOY);
    igual(r, { promedio: 3, maximo: 6, cobradas: 3 });
  });

  caso('con abonos cuenta el día del que saldó', () => {
    const enPartes = pago('a', '2026-10-01', [
      { fecha: '2026-10-02', cuenta_id: 'b', monto: 30 },
      { fecha: '2026-10-09', cuenta_id: 'b', monto: 21 }]);
    igual(tiemposDeCobro([enPartes], HOY).promedio, 8);
  });

  caso('las pendientes no cuentan', () => {
    const r = tiemposDeCobro([pago('a', '2026-10-01'), pago('b', '2026-10-02', todo('2026-10-04'))], HOY);
    igual(r, { promedio: 2, maximo: 2, cobradas: 1 });
  });

  caso('solo las cobradas en los últimos 90 días', () => {
    const r = tiemposDeCobro([
      pago('a', '2026-06-01', todo('2026-06-30')),            // vieja: fuera
      pago('b', '2026-10-01', todo('2026-10-03')),
    ], HOY);
    igual(r.cobradas, 1);
    igual(r.promedio, 2);
  });

  caso('el promedio va con un decimal', () => {
    const r = tiemposDeCobro([
      pago('a', '2026-10-01', todo('2026-10-02')),
      pago('b', '2026-10-01', todo('2026-10-02')),
      pago('c', '2026-10-01', todo('2026-10-03')),
    ], HOY);
    igual(r.promedio, 1.3);
  });

  caso('sin cobradas no hay promedio', () => {
    igual(tiemposDeCobro([pago('a', '2026-10-01')], HOY), { promedio: null, maximo: null, cobradas: 0 });
  });
});

describir('negocio — pendientes viejos', (caso) => {
  caso('las que llevan 7 días o más, de la más vieja a la más nueva', () => {
    const r = pendientesViejos([
      pago('a', '2026-10-21'),                                // 7 días: entra
      pago('b', '2026-10-22'),                                // 6 días: no
      pago('c', '2026-10-01'),                                // 27 días
    ], HOY);
    igual(r.map((p) => `${p.id} ${p.dias}`), ['c 27', 'a 7']);
  });

  caso('cada una con lo que falta por cobrar', () => {
    const parcial = pago('a', '2026-10-01', [{ fecha: '2026-10-02', cuenta_id: 'b', monto: 30 }]);
    igual(pendientesViejos([parcial], HOY)[0].saldo, 21);
  });

  caso('lo ya cobrado no es pendiente, por viejo que sea', () => {
    igual(pendientesViejos([pago('a', '2026-09-01', todo('2026-09-02'))], HOY), []);
  });

  caso('el límite se puede cambiar', () => {
    igual(pendientesViejos([pago('b', '2026-10-25')], HOY, 3).length, 1);
  });
});

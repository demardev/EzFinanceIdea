/* Pruebas de negocio/por-mes.js — escritas antes que la implementación.
   La serie de los últimos meses del negocio: cuánto ganaste, cuánto moviste
   y cuántas operaciones hubo en cada uno. */

import { describir, igual } from './marco.js';
import { porMes } from '../negocio/por-mes.js';

const pago = (id, fecha_pago, monto_recibo, comision, abonos = []) => ({
  id, fecha_pago, monto_recibo, comision, abonos, fecha_cobro: null, cuenta_cobro_id: null,
});
const cobrado = (fecha) => [{ fecha, cuenta_id: 'banco', monto: 1000 }];

describir('negocio — por mes', (caso) => {
  caso('da tantos meses como se pidan, del más viejo al actual', () => {
    igual(porMes([], '2026-10', 3).map((m) => m.mes), ['2026-08', '2026-09', '2026-10']);
  });

  caso('cruza el cambio de año', () => {
    igual(porMes([], '2026-02', 4).map((m) => m.mes),
          ['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  caso('un mes sin nada sale en cero, no se salta', () => {
    igual(porMes([], '2026-10', 1),
          [{ mes: '2026-10', movido: 0, ganado: 0, operaciones: 0 }]);
  });

  caso('cada mes cuenta lo suyo con las mismas reglas del resumen del mes', () => {
    const pagos = [
      { ...pago('a', '2026-09-03', 50, 1), abonos: [{ fecha: '2026-09-03', cuenta_id: 'b', monto: 51 }] },
      pago('b', '2026-09-20', 30, 1),                                  // pendiente
      { ...pago('c', '2026-09-28', 20, 2), abonos: cobrado('2026-10-02').map((a) => ({ ...a, monto: 22 })) },
    ];
    igual(porMes(pagos, '2026-10', 2), [
      { mes: '2026-09', movido: 100, ganado: 1, operaciones: 3 },
      { mes: '2026-10', movido: 0, ganado: 2, operaciones: 0 },
    ]);
  });

  caso('por defecto son seis meses', () => {
    igual(porMes([], '2026-10').length, 6);
  });
});

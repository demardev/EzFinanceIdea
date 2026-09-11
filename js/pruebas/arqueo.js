/* Pruebas de calc/arqueo.js — escritas antes que la implementación.
   Arqueo de caja: contar el efectivo por denominación y compararlo con lo
   que la app cree que hay. */

import { describir, igual } from './marco.js';
import { DENOMINACIONES, totalContado, arqueo } from '../calc/arqueo.js';

describir('arqueo — contar', (caso) => {
  caso('las denominaciones van de mayor a menor', () => {
    igual(DENOMINACIONES, [100, 50, 20, 10, 5, 1, 0.25, 0.1, 0.05, 0.01]);
  });

  caso('suma billetes y monedas', () => {
    igual(totalContado({ 100: 2, 20: 3, 5: 1, 1: 7, 0.25: 4 }), 273);
  });

  caso('no pierde centavos', () => {
    igual(totalContado({ 0.01: 7, 0.05: 3, 0.1: 1 }), 0.32);
  });

  caso('lo vacío, lo nulo y lo que no es número cuentan como cero', () => {
    igual(totalContado({ 100: '', 50: null, 20: 'x', 10: 1 }), 10);
  });

  caso('una caja vacía da cero', () => {
    igual(totalContado({}), 0);
  });
});

describir('arqueo — diferencia y ajuste', (caso) => {
  caso('si falta efectivo, el ajuste es un egreso por lo que falta', () => {
    const r = arqueo({ 100: 2, 20: 3, 5: 1, 1: 7, 0.25: 4 }, 285.3);
    igual(r.contado, 273);
    igual(r.esperado, 285.3);
    igual(r.diferencia, -12.3);
    igual(r.ajuste, { tipo: 'egreso', monto: 12.3 });
  });

  caso('si sobra, es un ingreso', () => {
    igual(arqueo({ 100: 3 }, 285.3).ajuste, { tipo: 'ingreso', monto: 14.7 });
  });

  caso('si cuadra exacto, no hay nada que ajustar', () => {
    const r = arqueo({ 100: 2, 50: 1 }, 250);
    igual(r.diferencia, 0);
    igual(r.ajuste, null);
  });

  caso('los centavos no inventan diferencias', () => {
    igual(arqueo({ 0.01: 3 }, 0.03).ajuste, null);
  });
});

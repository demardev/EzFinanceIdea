/* Pruebas de calc/ciclo-tarjeta.js — escritas antes que la implementación. */

import { describir, igual } from './marco.js';
import { calcularCiclo, corteSiguiente, limiteDePago } from '../calc/ciclo-tarjeta.js';

describir('ciclo de tarjeta', (caso) => {
  caso('corte 15, límite 5: el límite cae el mes siguiente al corte', () => {
    // Hoy 20/sep: el último corte fue el 15/sep y se paga el 05/oct.
    const c = calcularCiclo(15, 5, '2026-09-20');
    igual(c.fechaUltimoCorte, '2026-09-15');
    igual(c.fechaProximoCorte, '2026-10-15');
    igual(c.fechaLimiteDelCorte, '2026-10-05');
  });

  caso('antes del corte del mes, el último corte es el del mes pasado', () => {
    const c = calcularCiclo(15, 5, '2026-09-10');
    igual(c.fechaUltimoCorte, '2026-08-15');
    igual(c.fechaProximoCorte, '2026-09-15');
    igual(c.fechaLimiteDelCorte, '2026-09-05');
  });

  caso('el día del corte cuenta como corte de hoy', () => {
    const c = calcularCiclo(15, 5, '2026-09-15');
    igual(c.fechaUltimoCorte, '2026-09-15');
    igual(c.fechaProximoCorte, '2026-10-15');
  });

  caso('límite MAYOR que el corte: cae en el mismo mes del corte', () => {
    // Corte el 5, pago el 25: el corte del 05/sep se paga el 25/sep.
    const c = calcularCiclo(5, 25, '2026-09-10');
    igual(c.fechaUltimoCorte, '2026-09-05');
    igual(c.fechaLimiteDelCorte, '2026-09-25');
  });

  caso('corte 31 en febrero se ajusta al último día del mes', () => {
    const c = calcularCiclo(31, 20, '2026-02-28');
    igual(c.fechaUltimoCorte, '2026-02-28');
    igual(c.fechaProximoCorte, '2026-03-31');
    igual(c.fechaLimiteDelCorte, '2026-03-20');
  });

  caso('corte 31 en un febrero bisiesto', () => {
    const c = calcularCiclo(31, 20, '2024-02-29');
    igual(c.fechaUltimoCorte, '2024-02-29');
    igual(c.fechaProximoCorte, '2024-03-31');
  });

  caso('corte 31 a mitad de febrero: el último corte fue el 31/ene', () => {
    const c = calcularCiclo(31, 20, '2026-02-10');
    igual(c.fechaUltimoCorte, '2026-01-31');
    igual(c.fechaProximoCorte, '2026-02-28');
    igual(c.fechaLimiteDelCorte, '2026-02-20');
  });

  caso('el corte anterior al último acota la cubeta de deuda vieja', () => {
    const c = calcularCiclo(15, 5, '2026-09-20');
    igual(c.fechaCorteAnterior, '2026-08-15');
  });

  caso('cruce de año', () => {
    const c = calcularCiclo(15, 5, '2026-12-20');
    igual(c.fechaUltimoCorte, '2026-12-15');
    igual(c.fechaProximoCorte, '2027-01-15');
    igual(c.fechaLimiteDelCorte, '2027-01-05');
  });

  caso('días que faltan para pagar y para el próximo corte', () => {
    const c = calcularCiclo(15, 5, '2026-09-20');
    igual(c.diasParaLimite, 15);   // del 20/sep al 05/oct
    igual(c.diasParaProximoCorte, 25);
    igual(c.vencido, false);
  });

  caso('marca vencido cuando la fecha límite ya pasó', () => {
    // Corte 15/ago, límite 05/sep, hoy 10/sep: ya venció.
    const c = calcularCiclo(15, 5, '2026-09-10');
    igual(c.fechaLimiteDelCorte, '2026-09-05');
    igual(c.vencido, true);
    igual(c.diasParaLimite, -5);
  });
  caso('corteSiguiente avanza un mes ajustando el día', () => {
    igual(corteSiguiente('2026-01-31', 31), '2026-02-28');
    igual(corteSiguiente('2026-09-15', 15), '2026-10-15');
    igual(corteSiguiente('2026-12-15', 15), '2027-01-15');
  });

  caso('limiteDePago de un corte concreto', () => {
    igual(limiteDePago('2026-09-15', 5), '2026-10-05');    // día menor -> mes siguiente
    igual(limiteDePago('2026-09-05', 25), '2026-09-25');   // día mayor -> mismo mes
    igual(limiteDePago('2026-09-15', 15), '2026-10-15');   // mismo día -> mes siguiente
  });
});

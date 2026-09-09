/* Fechas del ciclo de una tarjeta. Función PURA: sin red, sin DOM.

   Si el día no existe en el mes (corte 31 en febrero) se ajusta al último día.
   La fecha límite es el primer `diaLimitePago` DESPUÉS del último corte: si el
   día de pago es menor o igual al de corte, cae el mes siguiente. */

import { partes, aISO, clampDia, sumarMeses, diasEntre, hoyISO } from './fechas.js';

/** El día `dia` del mes de `iso`, ajustado si ese día no existe. */
function diaDelMesDe(iso, dia) {
  const { anio, mes } = partes(iso);
  return aISO(anio, mes, clampDia(anio, mes, dia));
}

/** El corte que sigue a uno dado. */
export function corteSiguiente(fechaCorte, diaCorte) {
  return diaDelMesDe(sumarMeses(fechaCorte, 1), diaCorte);
}

/**
 * Fecha límite de pago de un corte concreto: el primer `diaLimitePago`
 * DESPUÉS de ese corte. Si el día de pago es menor o igual al de corte,
 * cae el mes siguiente.
 */
export function limiteDePago(fechaCorte, diaLimitePago) {
  const enElMesDelCorte = diaDelMesDe(fechaCorte, diaLimitePago);
  return enElMesDelCorte > fechaCorte
    ? enElMesDelCorte
    : diaDelMesDe(sumarMeses(fechaCorte, 1), diaLimitePago);
}

/**
 * @param diaCorte       1..31
 * @param diaLimitePago  1..31
 * @param hoy            'YYYY-MM-DD'
 */
export function calcularCiclo(diaCorte, diaLimitePago, hoy = hoyISO()) {
  const corteDeEsteMes = diaDelMesDe(hoy, diaCorte);

  /* El corte más reciente que ya ocurrió (hoy mismo cuenta). */
  const fechaUltimoCorte = corteDeEsteMes <= hoy
    ? corteDeEsteMes
    : diaDelMesDe(sumarMeses(hoy, -1), diaCorte);

  const fechaProximoCorte = corteSiguiente(fechaUltimoCorte, diaCorte);
  const fechaCorteAnterior = diaDelMesDe(sumarMeses(fechaUltimoCorte, -1), diaCorte);
  const fechaLimiteDelCorte = limiteDePago(fechaUltimoCorte, diaLimitePago);

  const diasParaLimite = diasEntre(hoy, fechaLimiteDelCorte);

  return {
    hoy,
    fechaCorteAnterior,
    fechaUltimoCorte,
    fechaProximoCorte,
    fechaLimiteDelCorte,
    diasParaLimite,
    diasParaProximoCorte: diasEntre(hoy, fechaProximoCorte),
    vencido: diasParaLimite < 0,
  };
}

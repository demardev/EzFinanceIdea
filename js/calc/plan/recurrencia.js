/* Repetición mensual y el monto según el escenario. Lo comparten los eventos
   del plan y la proyección de cada tarjeta, así que vive aparte para que no
   haya un import circular entre los dos. Función PURA. */

import { partes, aISO, clampDia, sumarMeses } from '../fechas.js';

/** Todas las veces que cae ese día del mes dentro del rango. */
export function ocurrenciasMensuales(diaMes, desde, hasta) {
  const fechas = [];
  const { anio, mes } = partes(desde);
  let cursor = aISO(anio, mes, clampDia(anio, mes, diaMes));
  while (cursor <= hasta) {
    if (cursor >= desde) fechas.push(cursor);
    const p = partes(sumarMeses(cursor, 1));
    cursor = aISO(p.anio, p.mes, clampDia(p.anio, p.mes, diaMes));
  }
  return fechas;
}

export function montoDe(item, escenario) {
  if (item.variabilidad === 'fijo') return Number(item.monto) || 0;
  return Number(escenario === 'max' ? item.monto_max : item.monto_min) || 0;
}

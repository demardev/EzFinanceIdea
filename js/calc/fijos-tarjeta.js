/* Gastos fijos del plan que se cargan a una tarjeta y aún no registras.
   Función PURA: sin red, sin DOM.

   El banco no los cobra el día exacto del plan: el seguro "del 23" llega el
   27, la línea "del 20" el 28. Por eso un cargo de hasta DERIVA días antes o
   después cuenta como el de esa fecha, y el pendiente no se va con el paso de
   los días: se va cuando lo registras. Solo se mira el ciclo abierto: el
   corte que ya cerró está en el estado de cuenta y se cuadra contra él. */

import { diasEntre, sumarDias } from './fechas.js';
import { ocurrenciasMensuales } from './plan/recurrencia.js';

const DERIVA = 10;

const normal = (texto) => String(texto || '').trim().toLowerCase();

export const esFijoActivo = (i) => i.activo && i.clase === 'gasto' && i.variabilidad === 'fijo';

/* No hay liga entre el movimiento y el item del plan, así que se reconoce
   por el nombre o, si se lo cambiaste, por categoría y monto. */
export function coincide(item, m) {
  return m.tipo === 'egreso'
    && (normal(m.descripcion) === normal(item.nombre)
        || Boolean(item.categoria_id && m.categoria_id === item.categoria_id
                   && Number(m.monto) === Number(item.monto)));
}

function registradoEnTarjeta(item, fecha, movimientos) {
  const desde = sumarDias(fecha, -DERIVA);
  const hasta = sumarDias(fecha, DERIVA);
  return movimientos.some((m) => m.tarjeta_id === item.tarjeta_id && !m.compra_id
    && m.fecha >= desde && m.fecha <= hasta && coincide(item, m));
}

/**
 * @param movimientos los de la tarjeta (los de otras se ignoran solos)
 * @param ciclo       { hoy, fechaUltimoCorte, fechaProximoCorte } de calcularCiclo()
 * @returns [{ item, fecha, monto, dias }] ordenados por fecha
 */
export function fijosPorCargar(tarjeta, planItems, movimientos, ciclo) {
  const desde = sumarDias(ciclo.fechaUltimoCorte, 1);
  return planItems
    .filter((i) => esFijoActivo(i) && i.tarjeta_id === tarjeta.id && i.dia_mes)
    .flatMap((item) => ocurrenciasMensuales(item.dia_mes, desde, ciclo.fechaProximoCorte)
      .filter((fecha) => !registradoEnTarjeta(item, fecha, movimientos))
      .map((fecha) => ({ item, fecha, monto: Number(item.monto) || 0,
                         dias: diasEntre(ciclo.hoy, fecha) })))
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
}

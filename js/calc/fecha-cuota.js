/* En qué día se carga cada cuota de una compra a meses. Función PURA.

   Si la compra trae `fecha_primera_cuota`, esa manda y las demás van cada mes
   ese día: hay bancos que no siguen ninguna regla (BAC cobra los Airpods el 28
   y las minicuotas el día del corte). Si no, lo dice la tarjeta (`cargo_cuotas`):
   - 'compra':      el mismo día del mes que la compra (lo de siempre).
   - 'antes_corte': un día antes de cada corte. La primera es la del corte que
     incluye la compra; el día del corte todavía es de ese corte, y entonces
     la cuota cae ese mismo día, porque no puede cobrarse antes de comprar.

   Las dos reglas dejan cada cuota en el mismo estado de cuenta: lo que
   cambia es el día en que aparece y empieza a restar del disponible. */

import { sumarMeses, sumarDias } from './fechas.js';
import { corteQueIncluye } from './ciclo-tarjeta.js';

/**
 * @param compra   { fecha_compra, fecha_primera_cuota? }
 * @param numero   1..num_cuotas
 * @param tarjeta  { dia_corte, cargo_cuotas } — sin ella, la regla de siempre
 */
export function fechaDeCuota(compra, numero, tarjeta = null) {
  if (compra.fecha_primera_cuota) return sumarMeses(compra.fecha_primera_cuota, numero - 1);
  if (tarjeta?.cargo_cuotas !== 'antes_corte') {
    return sumarMeses(compra.fecha_compra, numero - 1);
  }
  const primerCorte = corteQueIncluye(compra.fecha_compra, tarjeta.dia_corte);
  /* sumarMeses ajusta un 31 a 28 en febrero; corteQueIncluye lo devuelve al
     día de corte del mes siguiente (28 → 31 en marzo). */
  const corte = corteQueIncluye(sumarMeses(primerCorte, numero - 1), tarjeta.dia_corte);
  const diaAntes = sumarDias(corte, -1);
  return diaAntes < compra.fecha_compra ? compra.fecha_compra : diaAntes;
}

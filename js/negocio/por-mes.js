/* La historia del negocio mes por mes. Función PURA: sin red, sin DOM.

   Cada mes se cuenta con las mismas reglas que "Negocio este mes"
   (totalesDeNegocio): lo MOVIDO por el día en que pagaste y lo GANADO por
   el día en que te pagaron la comisión. Así la gráfica y la cifra del mes
   nunca dicen cosas distintas. */

import { mesDe, sumarMeses } from '../calc/fechas.js';
import { totalesDeNegocio } from './pago-recibo.js';

/**
 * @param mesFinal 'AAAA-MM', el último mes de la serie (normalmente el actual)
 * @returns [{ mes, ganado, movido, operaciones }] del más viejo al más nuevo;
 *          un mes sin nada sale en cero.
 */
export function porMes(pagos, mesFinal, cuantos = 6) {
  const meses = [];
  for (let i = cuantos - 1; i >= 0; i--) meses.push(mesDe(sumarMeses(`${mesFinal}-01`, -i)));
  return meses.map((mes) => ({ mes, ...totalesDeNegocio(pagos, mes) }));
}

/* Cuánto tarda en volver tu dinero. Función PURA: sin red, sin DOM.

   Una operación tarda lo que va del día en que pagaste el recibo al día del
   abono que la saldó (liquidacion() de negocio/abonos.js), no al primero:
   mientras falte algo, sigue habiendo dinero tuyo en la calle. */

import { diasEntre, sumarDias } from '../calc/fechas.js';
import { liquidacion, saldoDe } from './abonos.js';
import { estaPendiente } from './pago-recibo.js';

/** Lo que se toma en cuenta para el promedio: lo reciente dice cómo vas hoy. */
const VENTANA_DIAS = 90;

/**
 * @returns { promedio, maximo, cobradas } en días, de las operaciones saldadas
 *          en los últimos 90 días. Sin ninguna, promedio y maximo en null.
 */
export function tiemposDeCobro(pagos, hoy) {
  const desde = sumarDias(hoy, -VENTANA_DIAS);
  const dias = pagos
    .map((p) => ({ fecha_pago: p.fecha_pago, cobro: liquidacion(p).fecha_cobro }))
    .filter((p) => p.cobro && p.cobro >= desde && p.cobro <= hoy)
    .map((p) => diasEntre(p.fecha_pago, p.cobro));
  if (!dias.length) return { promedio: null, maximo: null, cobradas: 0 };
  const promedio = dias.reduce((a, b) => a + b, 0) / dias.length;
  return { promedio: Math.round(promedio * 10) / 10, maximo: Math.max(...dias), cobradas: dias.length };
}

/**
 * Las pendientes que llevan `limite` días o más, de la más vieja a la más
 * nueva. Por cobrar las marca en amarillo con el mismo límite.
 * @returns [{ ...pago, dias, saldo }]
 */
export function pendientesViejos(pagos, hoy, limite = 7) {
  return pagos
    .filter(estaPendiente)
    .map((p) => ({ ...p, dias: diasEntre(p.fecha_pago, hoy), saldo: saldoDe(p) }))
    .filter((p) => p.dias >= limite)
    .sort((a, b) => b.dias - a.dias);
}

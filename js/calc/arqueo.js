/* Arqueo de caja: contar el efectivo que tienes en la mano, por denominación,
   y compararlo con lo que la app cree que hay. Función PURA: sin red, sin DOM.

   Son las denominaciones que circulan en dólares. No hay billete de $2 ni
   moneda de ¢50 a propósito: no se usan aquí. */

import { sumar, redondear } from './dinero.js';

export const DENOMINACIONES = [100, 50, 20, 10, 5, 1, 0.25, 0.1, 0.05, 0.01];

/**
 * @param conteo { denominación: unidades }. Lo vacío o lo que no sea número
 *               vale cero: un campo en blanco es "no tengo de esos".
 */
export function totalContado(conteo) {
  return sumar(...Object.entries(conteo).map(([denominacion, unidades]) => {
    const piezas = Number(unidades);
    return Number.isFinite(piezas) ? redondear(Number(denominacion) * piezas) : 0;
  }));
}

/**
 * Compara lo contado con lo esperado. Si sobra efectivo el ajuste es un
 * ingreso; si falta, un egreso. Si cuadra, no hay nada que ajustar.
 */
export function arqueo(conteo, esperado) {
  const contado = totalContado(conteo);
  const enCaja = redondear(esperado);
  const diferencia = redondear(contado - enCaja);
  return {
    contado,
    esperado: enCaja,
    diferencia,
    ajuste: diferencia === 0 ? null : {
      tipo: diferencia > 0 ? 'ingreso' : 'egreso',
      monto: Math.abs(diferencia),
    },
  };
}

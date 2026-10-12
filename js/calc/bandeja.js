/* Lo que llega solo a la bandeja (hoy, compras con Apple Pay) y cómo se
   vuelve un movimiento. Función PURA: sin red, sin DOM. */

import { aISO } from './fechas.js';

const POR_ORIGEN = { applepay: 'Compra con Apple Pay', sms: 'Compra (SMS)', correo: 'Compra (correo)' };

/**
 * El día LOCAL de un instante. `created_at` es un instante con zona, no una
 * fecha suelta, así que aquí sí se puede pasar por Date: lo que no se hace
 * es leer el día en UTC, que adelantaría las compras de la noche.
 */
export function fechaLocalDe(instante) {
  const d = new Date(instante);
  return aISO(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/**
 * Lo que el formulario de movimiento trae puesto al confirmar una compra.
 * @param origenes { 'nombre en Wallet': 'tarjeta:<id>' | 'cuenta:<id>' }
 */
export function borradorDeBandeja(item, origenes) {
  return {
    tipo: 'egreso',
    monto: Number(item.monto) || 0,
    fecha: fechaLocalDe(item.created_at),
    descripcion: item.comercio || POR_ORIGEN[item.origen] || 'Compra',
    origen: (item.tarjeta && origenes[item.tarjeta]) || '',
  };
}

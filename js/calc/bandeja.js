/* Lo que llega solo a la bandeja (hoy, compras con Apple Pay) y cómo se
   vuelve un movimiento. Función PURA: sin red, sin DOM. */

import { aISO } from './fechas.js';
import { sumar } from './dinero.js';

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

/** "  Starbucks   Paseo " y "STARBUCKS PASEO" son el mismo comercio. */
export function claveDeComercio(texto) {
  return String(texto ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/* Lo que confirmaste para ese comercio manda; si nunca lo confirmaste, lo
   último que le pusiste en tu historial. */
function categoriaDe(item, { aprendidas = {}, historial = {} }) {
  const clave = claveDeComercio(item.comercio);
  if (!clave) return '';
  return aprendidas[clave] || historial[clave] || '';
}

/**
 * Lo que el formulario de movimiento trae puesto al confirmar una compra.
 * @param origenes   { 'nombre en Wallet': 'tarjeta:<id>' | 'cuenta:<id>' }
 * @param categorias { aprendidas, historial }: { claveDeComercio: categoria_id }
 */
export function borradorDeBandeja(item, origenes, categorias = {}) {
  return {
    tipo: 'egreso',
    monto: Number(item.monto) || 0,
    fecha: fechaLocalDe(item.created_at),
    descripcion: item.comercio || POR_ORIGEN[item.origen] || 'Compra',
    categoria_id: categoriaDe(item, categorias),
    origen: (item.tarjeta && origenes[item.tarjeta]) || '',
  };
}

/**
 * Las que se pueden registrar sin abrir el formulario: traen una tarjeta y
 * una categoría que siguen activas. Las demás se quedan para revisarlas.
 *
 * @param sugerencias { origenes, categorias } como para borradorDeBandeja()
 * @param vigentes    { origenes: Set('tarjeta:<id>'), categorias: Set(id) }
 * @returns { listas: [{ item, borrador }], total, faltan }
 */
export function listasParaRegistrar(items, sugerencias, vigentes) {
  const listas = items
    .map((item) => ({
      item, borrador: borradorDeBandeja(item, sugerencias.origenes, sugerencias.categorias),
    }))
    .filter(({ borrador }) => borrador.monto > 0
      && vigentes.origenes.has(borrador.origen)
      && vigentes.categorias.has(borrador.categoria_id));
  return {
    listas,
    total: sumar(...listas.map((l) => l.borrador.monto)),
    faltan: items.length - listas.length,
  };
}

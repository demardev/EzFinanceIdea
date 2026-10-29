/* Lo que llega solo a la bandeja —compras con Apple Pay y avisos del banco
   por SMS— y cómo se vuelve un movimiento. Función PURA: sin red, sin DOM. */

import { aISO } from './fechas.js';
import { sumar } from './dinero.js';
import { leerAviso } from './avisos/leer.js';
import { tipoDeAviso, rutaDeAviso } from './avisos/cuentas.js';

const POR_ORIGEN = { applepay: 'Compra con Apple Pay', sms: 'Aviso del banco', correo: 'Aviso del banco' };
const BANCOS = { cuscatlan: 'Cuscatlán', niu: 'Niu', bac: 'BAC', promerica: 'Promerica' };

export const nombreDeBanco = (clave) => BANCOS[clave] ?? clave ?? null;

/**
 * Un aviso llega a la base como texto crudo: aquí se lee, y el item queda con
 * monto y comercio como los de Apple Pay, más `aviso` con todo lo leído.
 * @param propias plantillas que enseñó el usuario
 */
export function conAviso(item, propias = []) {
  if (!item.texto) return item;
  const aviso = leerAviso(item.texto, propias);
  return { ...item, aviso, monto: aviso.monto, comercio: aviso.contraparte?.nombre ?? null };
}

/** Cómo se llama en la lista y en el formulario: el comercio o quien te
    pagó; si no, de qué banco o de dónde vino. */
export function descripcionDe(item) {
  if (item.comercio) return item.comercio;
  const banco = nombreDeBanco(item.aviso?.banco);
  return banco ? `Aviso de ${banco}` : (POR_ORIGEN[item.origen] || 'Compra');
}

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
 * @param origenes   lo aprendido: { 'nombre en Wallet' o clave de aviso:
 *                   'tarjeta:<id>' | 'cuenta:<id>' } (ver avisos/cuentas.js)
 * @param categorias { aprendidas, historial }: { claveDeComercio: categoria_id }
 */
export function borradorDeBandeja(item, origenes, categorias = {}) {
  const reconocido = item.aviso?.reconocido;
  const tipo = reconocido ? tipoDeAviso(item.aviso, origenes) : 'egreso';
  return {
    tipo,
    monto: Number(item.monto) || 0,
    fecha: item.aviso?.fecha || fechaLocalDe(item.created_at),
    descripcion: descripcionDe(item),
    categoria_id: tipo === 'egreso' ? categoriaDe(item, categorias) : '',
    origen: (item.tarjeta && origenes[item.tarjeta]) || '',
    ...(reconocido ? rutaDeAviso(item.aviso, tipo, origenes) : {}),
  };
}

/**
 * Las que se pueden registrar sin abrir el formulario: traen una tarjeta y
 * una categoría que siguen activas. Las demás se quedan para revisarlas, y
 * los avisos del banco también: todavía no se sabe de qué cuenta son.
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
    .filter(({ item, borrador }) => !item.texto && borrador.monto > 0
      && vigentes.origenes.has(borrador.origen)
      && vigentes.categorias.has(borrador.categoria_id));
  return {
    listas,
    total: sumar(...listas.map((l) => l.borrador.monto)),
    faltan: items.length - listas.length,
  };
}

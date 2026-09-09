/* Helper para pintar iconos. Único lugar que sabe cómo se arma el <svg>. */

import { TRAZOS, ICONOS_CATEGORIA } from './svg.js';

const ATRIBUTOS =
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

/** Devuelve el markup del icono. Si el nombre no existe, cae en 'tag'. */
export function icono(nombre, tam = 20) {
  const trazos = TRAZOS[nombre] || TRAZOS.tag;
  return `<svg width="${tam}" height="${tam}" ${ATRIBUTOS}>${trazos}</svg>`;
}

/** Igual que icono() pero devuelve un nodo, para cuando no se arma HTML por string. */
export function nodoIcono(nombre, tam = 20) {
  const caja = document.createElement('span');
  caja.innerHTML = icono(nombre, tam);
  return caja.firstElementChild;
}

/** ¿Existe ese icono? Lo usa el selector de iconos de categorías. */
export function hayIcono(nombre) {
  return Object.hasOwn(TRAZOS, nombre);
}

export function nombresDeIconos() {
  return Object.keys(TRAZOS);
}

/** Los que se ofrecen al elegir icono de una categoría. */
export function iconosDeCategoria() {
  return [...ICONOS_CATEGORIA];
}

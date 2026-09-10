/* Ocultar montos para revisar la app en público. Vive en localStorage
   para que siga oculto al volver a abrir. */

import { formatear } from '../calc/dinero.js';

const CLAVE = 'finanzas.ocultar';
const oyentes = new Set();

let oculto = localStorage.getItem(CLAVE) === '1';

export function estaOculto() {
  return oculto;
}

export function alternarOculto() {
  oculto = !oculto;
  localStorage.setItem(CLAVE, oculto ? '1' : '0');
  oyentes.forEach((fn) => fn(oculto));
  return oculto;
}

export function alCambiarPrivacidad(fn) {
  oyentes.add(fn);
}

/** Lo que usan las vistas para pintar dinero. formatear() sigue siendo puro. */
export function textoMonto(n, opciones) {
  if (!oculto) return formatear(n, opciones);
  /* Tres puntos y no seis: la fila se sigue leyendo como un monto en vez de
     convertirse en una hilera de puntos. */
  return `${opciones?.moneda ?? '$'}•••`;
}

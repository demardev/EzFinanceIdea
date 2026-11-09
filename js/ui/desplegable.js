/* Una tarjeta que se abre y se cierra tocando su encabezado. Usa <details>
   nativo: funciona sin JS y el lector de pantalla ya sabe qué es.

   Si la pantalla repinta con innerHTML, se pierde cuál estaba abierto:
   para eso están recordarAbiertos() y reabrir(), que van por data-id. */

import { icono } from '../iconos/render.js';

/** `titulo` y `sub` son texto de la app, no del usuario: no se escapan. */
export function desplegable({ id, titulo, sub = '', iconoNombre, cuerpo }) {
  return `
    <details class="card desplegable" data-id="${id}">
      <summary class="fila">
        ${iconoNombre ? icono(iconoNombre, 20) : ''}
        <span class="crece">
          <span class="desplegable-titulo">${titulo}</span>
          ${sub ? `<span class="desplegable-sub">${sub}</span>` : ''}
        </span>
        <span class="desplegable-flecha">${icono('abajo', 18)}</span>
      </summary>
      <div class="desplegable-cuerpo pila-sm">${cuerpo}</div>
    </details>`;
}

export function recordarAbiertos(contenedor) {
  return [...contenedor.querySelectorAll('details.desplegable[open]')]
    .map((d) => d.dataset.id);
}

export function reabrir(contenedor, ids) {
  for (const id of ids) {
    contenedor.querySelector(`details.desplegable[data-id="${CSS.escape(id)}"]`)
      ?.setAttribute('open', '');
  }
}

/* Cuáles dejaste abiertos, en ESTE navegador: es una comodidad, no un dato.
   Si el almacenamiento falla (ventana privada), todo empieza cerrado. */
function leerAbiertos(clave) {
  try { return JSON.parse(localStorage.getItem(clave) || '[]'); } catch { return []; }
}

/**
 * Reabre lo que dejaste abierto y guarda cada cambio. Se puede llamar en
 * cada repintado: el listener se engancha una sola vez por contenedor.
 */
export function recordarEnNavegador(contenedor, clave) {
  reabrir(contenedor, leerAbiertos(clave));
  if (contenedor.dataset.recuerdaAbiertos) return;
  contenedor.dataset.recuerdaAbiertos = '1';
  /* `toggle` no burbujea: se escucha en la captura. */
  contenedor.addEventListener('toggle', (evento) => {
    if (!evento.target.matches?.('details.desplegable')) return;
    try { localStorage.setItem(clave, JSON.stringify(recordarAbiertos(contenedor))); } catch { /* sin guardar */ }
  }, true);
}

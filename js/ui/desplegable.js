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

/* Pinta la tab bar leyendo el mapa de rutas. Agregar una pestaña = agregar
   una entrada en router.js, no tocar este archivo. */

import { icono } from '../iconos/render.js';

export function pintarTabBar(nav, rutas) {
  nav.innerHTML = Object.entries(rutas)
    .filter(([, r]) => r.enTabBar)
    .map(([ruta, r]) => `
      <a class="tab" href="#/${ruta}" data-ruta="${ruta}">
        ${icono(r.icono, 21)}<span>${r.titulo}</span>
      </a>`)
    .join('');
}

/** Marca cuál está activa. Se llama en cada cambio de ruta. */
export function marcarActiva(nav, ruta) {
  nav.querySelectorAll('.tab').forEach((tab) => {
    const activa = tab.dataset.ruta === ruta;
    tab.setAttribute('aria-current', activa ? 'page' : 'false');
  });
}

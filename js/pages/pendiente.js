/* Marcador de posición para las pantallas que aún no toca construir.
   Se borra cuando cada paso las implemente. */

import { icono } from '../iconos/render.js';

export function montarPendiente(contenedor, _contexto, ruta) {
  contenedor.innerHTML = `
    <div class="vacio">
      <span class="icono-caja">${icono(ruta?.icono || 'reloj', 22)}</span>
      <p><strong>${ruta?.titulo || 'Pantalla'}</strong> todavía no está construida.</p>
      <p class="tenue-2">Llega en un paso siguiente.</p>
    </div>`;
}

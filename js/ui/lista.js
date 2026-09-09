/* Filas de lista reutilizables. Pintan, no deciden nada. */

import { icono } from '../iconos/render.js';
import { escapar } from './texto.js';

function acciones(id, modoOrden) {
  if (!modoOrden) return `<span class="tenue-2">${icono('derecha', 16)}</span>`;
  return `
    <span class="fila-acciones">
      <button class="icono-btn" type="button" data-mover="arriba" data-id="${id}"
              aria-label="Subir">${icono('arriba', 18)}</button>
      <button class="icono-btn" type="button" data-mover="abajo" data-id="${id}"
              aria-label="Bajar">${icono('abajo', 18)}</button>
    </span>`;
}

/** El botón que se descubre al deslizar la fila hacia la izquierda. */
function accionBorrar(id) {
  return `
    <button class="borrar-deslizado" type="button" data-borrar="${id}">
      ${icono('basura', 18)} Eliminar
    </button>`;
}

/**
 * Fila con icono, nombre, subtítulo y algo a la derecha. En modo orden
 * cambia el chevron por las flechas de subir/bajar; con `deslizable` se
 * puede arrastrar a la izquierda para descubrir el botón de eliminar.
 */
export function filaEditable({ id, nombre, sub = '', derecha = '', iconoNombre = 'tag',
                               modoOrden = false, deslizable = false }) {
  const cuerpo = `
    <span class="icono-caja">${icono(iconoNombre, 18)}</span>
    <span class="crece truncar">
      <span class="titulo">${escapar(nombre)}</span>
      ${sub ? `<br><span class="sub">${escapar(sub)}</span>` : ''}
    </span>
    ${derecha ? `<span class="monto tenue">${derecha}</span>` : ''}`;

  const interior = modoOrden
    ? `<span class="fila-cuerpo">${cuerpo}</span>`
    : `<button type="button" class="fila-cuerpo" data-editar="${id}">${cuerpo}</button>`;

  const fila = `<div class="lista-fila" ${deslizable && !modoOrden ? 'data-desliza' : ''}>`
             + `${interior}${acciones(id, modoOrden)}</div>`;

  /* En modo orden el deslizar estorba: las flechas ya ocupan ese lado. */
  if (!deslizable || modoOrden) return fila;
  return `<div class="fila-deslizable">${accionBorrar(id)}${fila}</div>`;
}

export function envolverLista(filas) {
  return `<div class="lista">${filas.join('')}</div>`;
}

export function estadoVacio({ iconoNombre = 'tag', titulo, sub = '' }) {
  return `
    <div class="vacio">
      <span class="icono-caja">${icono(iconoNombre, 22)}</span>
      <p>${escapar(titulo)}</p>
      ${sub ? `<p class="tenue-2">${escapar(sub)}</p>` : ''}
    </div>`;
}

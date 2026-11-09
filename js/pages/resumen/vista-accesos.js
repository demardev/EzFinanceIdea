/* La fila de accesos del Resumen: Por confirmar, Por cobrar, Préstamos,
   Negocio y Vencimientos, uno al lado del otro. Solo sale el que aplica.

   Hay dos clases de cuadrito:
   - los que abren algo aparte (Por confirmar y Por cobrar abren su hoja;
     Préstamos sin préstamos activos lleva a su pantalla), y
   - los BLOQUES (Negocio, Préstamos con préstamos, Vencimientos), que
     despliegan su panel debajo de la fila, a todo el ancho. Uno a la vez:
     tocar otro lo cambia, tocar el mismo lo cierra.

   Hasta tres cuadritos se reparten el ancho; con más, la fila se desliza de
   lado. El panel abierto se recuerda en ESTE navegador. */

import { icono } from '../../iconos/render.js';
import { textoMonto } from '../../ui/privacidad.js';

const GUARDADO = 'resumen-panel';
const MAX_SIN_DESLIZAR = 3;

/* `acento` pinta el número y el texto de abajo; `subAcento`, solo el texto. */
function contenido({ iconoNombre, titulo, cuantos, sub = '', acento = '', subAcento = acento }) {
  return `
    <span class="fila-entre" style="width:100%;min-height:22px">
      ${icono(iconoNombre, 18)}
      ${cuantos ? `<span class="badge badge-${acento || 'warn'}">${cuantos}</span>` : ''}
    </span>
    <span class="acceso-titulo">${titulo}</span>
    ${sub ? `<span class="acceso-sub ${subAcento}">${sub}</span>` : ''}`;
}

/* Los que abren algo aparte: no despliegan nada. */
function directos({ porConfirmar, porCobrar, prestamos }) {
  const lista = [];
  if (porConfirmar > 0) {
    lista.push(`<button class="btn acceso" id="btn-por-confirmar" type="button">
      ${contenido({ iconoNombre: 'card', titulo: 'Por confirmar', cuantos: porConfirmar })}</button>`);
  }
  if (porCobrar?.cuantos > 0) {
    lista.push(`<button class="btn acceso" id="btn-por-cobrar" type="button">
      ${contenido({ iconoNombre: 'reloj', titulo: 'Por cobrar', cuantos: porCobrar.cuantos,
                    sub: textoMonto(porCobrar.total) })}</button>`);
  }
  if (prestamos && !prestamos.activos.length) {
    lista.push(`<a class="btn acceso" href="#/prestamos">
      ${contenido({ iconoNombre: 'persona', titulo: 'Préstamos' })}</a>`);
  }
  return lista;
}

function cuadritoDe(b) {
  return `<button class="btn acceso" type="button" data-panel="${b.id}"
            aria-expanded="false" aria-controls="panel-${b.id}">${contenido(b)}</button>`;
}

function panelDe(b) {
  return `
    <div class="card panel-acceso pila-sm" id="panel-${b.id}" data-panel-de="${b.id}" hidden>
      <p class="seccion-titulo" style="margin:0">${b.tituloPanel}</p>
      ${b.cuerpo}
    </div>`;
}

/**
 * @param porConfirmar cuántos hay en la bandeja (0 o nada: no sale)
 * @param porCobrar    { total, cuantos } del negocio, o nada
 * @param prestamos    el resultado de resumenPrestamos(), o nada
 * @param bloques      los que despliegan panel: { id, titulo, tituloPanel,
 *                     iconoNombre, cuantos, acento, sub, cuerpo } (o null)
 */
export function filaAccesos({ porConfirmar, porCobrar, prestamos, bloques = [] }) {
  const conPanel = bloques.filter(Boolean);
  const cuadritos = [...directos({ porConfirmar, porCobrar, prestamos }), ...conPanel.map(cuadritoDe)];
  if (!cuadritos.length) return '';
  const desliza = cuadritos.length > MAX_SIN_DESLIZAR ? 'accesos-desliza' : '';
  return `
    <div class="pila-sm" data-accesos>
      <div class="accesos ${desliza}">${cuadritos.join('')}</div>
      ${conPanel.map(panelDe).join('')}
    </div>`;
}

function guardar(id) {
  try { localStorage.setItem(GUARDADO, id || ''); } catch { /* sin guardar */ }
}

/* Abre `id` y cierra los demás. Sin id (o el que ya estaba), todo cerrado. */
function mostrar(caja, id) {
  caja.querySelectorAll('[data-panel]').forEach((b) =>
    b.setAttribute('aria-expanded', String(b.dataset.panel === id)));
  caja.querySelectorAll('[data-panel-de]').forEach((p) => { p.hidden = p.dataset.panelDe !== id; });
}

/**
 * Engancha la fila (una vez por contenedor) y reabre el panel que dejaste
 * abierto. Se llama después de cada repintado.
 */
export function conectarAccesos(contenedor) {
  const caja = contenedor.querySelector('[data-accesos]');
  let guardado = '';
  try { guardado = localStorage.getItem(GUARDADO) || ''; } catch { /* nada */ }
  const abierto = caja?.querySelector(`[data-panel="${CSS.escape(guardado)}"]`);
  if (abierto) {
    mostrar(caja, guardado);
    /* Si la fila se desliza y el abierto quedó fuera, se corre lo justo. */
    abierto.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  if (contenedor.dataset.accesosConectados) return;
  contenedor.dataset.accesosConectados = '1';
  contenedor.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-panel]');
    if (!boton) return;
    const fila = boton.closest('[data-accesos]');
    const id = boton.getAttribute('aria-expanded') === 'true' ? '' : boton.dataset.panel;
    mostrar(fila, id);
    guardar(id);
  });
}

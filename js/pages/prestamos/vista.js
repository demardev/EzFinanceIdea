/* Pinta la pantalla de Préstamos. Recibe todo calculado: aquí no se suma nada. */

import { icono } from '../../iconos/render.js';
import { escapar } from '../../ui/texto.js';
import { textoMonto } from '../../ui/privacidad.js';
import { DIRECCIONES, nombreDe, subtituloDe, textoAviso } from './textos.js';

function fila(item, hoy) {
  const { prestamo, estado } = item;
  const aviso = estado.terminado ? '' : textoAviso(item, hoy);
  return `
    <div class="lista-fila">
      <button type="button" class="fila-cuerpo" data-prestamo="${prestamo.id}">
        <span class="icono-caja">${icono(prestamo.direccion === 'debo' ? 'sale' : 'entra', 18)}</span>
        <span class="crece truncar">
          <span class="titulo">${escapar(nombreDe(prestamo))}</span><br>
          <span class="sub">${escapar(subtituloDe(item))}</span>
          ${aviso ? `<br><span class="sub" ${estado.atraso > 0 ? 'style="color:var(--warn)"' : ''}>${escapar(aviso)}</span>` : ''}
        </span>
        <span class="monto ${estado.terminado ? 'tenue' : ''}">${textoMonto(estado.restante)}</span>
      </button>
    </div>`;
}

function seccion(titulo, items, hoy) {
  if (!items.length) return '';
  return `
    <div>
      <p class="seccion-titulo">${escapar(titulo)}</p>
      <div class="lista">${items.map((i) => fila(i, hoy)).join('')}</div>
    </div>`;
}

function vacio() {
  return `
    <div class="vacio">
      <span class="icono-caja">${icono('persona', 22)}</span>
      <p>Aún no hay préstamos.</p>
      <p class="tenue-2">Lo que le debes a alguien, o lo que alguien te paga a plazos.</p>
    </div>`;
}

/** @param r el resultado de resumenPrestamos() */
export function pintarPrestamos(contenedor, r, hoy) {
  const de = (direccion) => r.activos.filter((x) => x.prestamo.direccion === direccion);
  const hay = r.activos.length || r.terminados.length;
  contenedor.innerHTML = `
    <div class="pila">
      <div class="card fila-entre">
        <span><span class="cifra-etiqueta">Debes</span><br>
          <span class="monto neg">${textoMonto(r.debes)}</span></span>
        <span><span class="cifra-etiqueta">Te deben</span><br>
          <span class="monto pos">${textoMonto(r.teDeben)}</span></span>
      </div>
      <button class="btn btn-bloque" id="btn-nuevo-prestamo" type="button">
        ${icono('plus', 16)} Nuevo préstamo</button>
      ${hay ? '' : vacio()}
      ${seccion(DIRECCIONES.debo.titulo, de('debo'), hoy)}
      ${seccion(DIRECCIONES.me_deben.titulo, de('me_deben'), hoy)}
      ${seccion('Saldados', r.terminados, hoy)}
    </div>`;
}

/* Préstamos en el Resumen: un cuadrito de la fila de accesos (cuánto debes
   o te deben, y cuántos van atrasados) y su panel con lo que urge y el
   enlace a #/prestamos. Sin préstamos activos no hay panel: el cuadrito
   lleva directo a la pantalla (vista-accesos.js). */

import { icono } from '../../iconos/render.js';
import { escapar } from '../../ui/texto.js';
import { textoMonto } from '../../ui/privacidad.js';
import { hoyISO } from '../../calc/fechas.js';
import { textoAviso } from '../prestamos/textos.js';

const MAX_AVISOS = 3;

function lineaAviso(item, hoy) {
  const clase = item.estado.atraso > 0 ? 'warn' : 'tenue';
  return `<p class="${clase}" style="font-size:12.5px">${escapar(textoAviso(item, hoy))}</p>`;
}

/* Lo que más pesa, en corto: lo que debes (en rojo); si no debes nada, lo
   que te deben (en verde). Con la palabra no cabe en el cuadrito. */
function sub(r) {
  return r.debes > 0 ? { sub: textoMonto(r.debes), subAcento: 'neg' }
                     : { sub: textoMonto(r.teDeben), subAcento: 'pos' };
}

function cuerpo(r, hoy) {
  return `
    <div class="fila-entre">
      <span><span class="cifra-etiqueta">Debes</span><br>
        <span class="monto neg">${textoMonto(r.debes)}</span></span>
      <span><span class="cifra-etiqueta">Te deben</span><br>
        <span class="monto pos">${textoMonto(r.teDeben)}</span></span>
    </div>
    ${r.avisos.slice(0, MAX_AVISOS).map((i) => lineaAviso(i, hoy)).join('')}
    <a class="enlace-accion fila" href="#/prestamos" style="gap:4px; text-decoration:none">
      Ver préstamos ${icono('derecha', 15)}</a>`;
}

/** @param r el resultado de resumenPrestamos(). null sin préstamos activos. */
export function bloquePrestamos(r) {
  if (!r?.activos.length) return null;
  const atrasados = r.avisos.filter((i) => i.estado.atraso > 0).length;
  return {
    id: 'prestamos', titulo: 'Préstamos', tituloPanel: 'Préstamos', iconoNombre: 'persona',
    cuantos: atrasados, acento: atrasados ? 'warn' : '', ...sub(r), cuerpo: cuerpo(r, hoyISO()),
  };
}

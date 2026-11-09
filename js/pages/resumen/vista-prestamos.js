/* Préstamos en el Resumen, plegado como Negocio y Vencimientos: el
   encabezado dice cuánto debes y cuánto te deben (en amarillo si alguien va
   atrasado); adentro, lo que urge y el enlace a #/prestamos.
   Sin préstamos activos no hay desplegable: el acceso va en la fila de
   accesos (vista-accesos.js). */

import { icono } from '../../iconos/render.js';
import { escapar } from '../../ui/texto.js';
import { textoMonto } from '../../ui/privacidad.js';
import { hoyISO } from '../../calc/fechas.js';
import { desplegable } from '../../ui/desplegable.js';
import { textoAviso } from '../prestamos/textos.js';

const MAX_AVISOS = 3;

function lineaAviso(item, hoy) {
  const clase = item.estado.atraso > 0 ? 'warn' : 'tenue';
  return `<p class="${clase}" style="font-size:12.5px">${escapar(textoAviso(item, hoy))}</p>`;
}

/* Solo lo que hay: sin deudas tuyas no se dice "Debes $0.00". */
function subtitulo(r) {
  const partes = [];
  if (r.debes > 0) partes.push(`Debes ${textoMonto(r.debes)}`);
  if (r.teDeben > 0) partes.push(`Te deben ${textoMonto(r.teDeben)}`);
  const atrasado = r.avisos.some((i) => i.estado.atraso > 0);
  return `<span class="${atrasado ? 'warn' : ''}">${partes.join(' · ')}</span>`;
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

/** @param r el resultado de resumenPrestamos() */
export function tarjetaPrestamos(r) {
  if (!r.activos.length) return '';      // el acceso va en la fila de arriba
  return desplegable({
    id: 'prestamos', titulo: 'Préstamos', iconoNombre: 'persona',
    sub: subtitulo(r), cuerpo: cuerpo(r, hoyISO()),
  });
}

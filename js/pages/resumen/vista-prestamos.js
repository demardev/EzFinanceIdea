/* La tarjeta de Préstamos en el Resumen: cuánto debes, cuánto te deben y lo
   que urge (atrasos y pagos de esta semana). Tocarla lleva a #/prestamos.
   Sin préstamos activos no hay tarjeta: el acceso va en la fila de accesos
   (vista-accesos.js). */

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

/** @param r el resultado de resumenPrestamos() */
export function tarjetaPrestamos(r) {
  const hoy = hoyISO();
  if (!r.activos.length) return '';      // el acceso va en la fila de arriba
  return `
    <a class="card" href="#/prestamos" style="display:block; color:inherit; text-decoration:none">
      <div class="fila-entre">
        <span class="cifra-etiqueta">Préstamos</span>
        <span class="tenue-2">${icono('derecha', 16)}</span>
      </div>
      <div class="fila-entre" style="margin-top:4px">
        <span><span class="cifra-etiqueta">Debes</span><br>
          <span class="monto neg">${textoMonto(r.debes)}</span></span>
        <span><span class="cifra-etiqueta">Te deben</span><br>
          <span class="monto pos">${textoMonto(r.teDeben)}</span></span>
      </div>
      ${r.avisos.slice(0, MAX_AVISOS).map((i) => lineaAviso(i, hoy)).join('')}
    </a>`;
}

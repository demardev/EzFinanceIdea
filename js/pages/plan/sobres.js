/* Los sobres del plan: uno por lo que tienes hoy y uno por cada ingreso.

   Con un horizonte de meses los sobres se repiten casi idénticos y alargan la
   pantalla, así que solo el primero arranca abierto; los demás enseñan su
   cabecera y lo que les queda libre, y se abren al tocarlos. */

import { icono } from '../../iconos/render.js';
import { escapar, plural } from '../../ui/texto.js';
import { textoMonto } from '../../ui/privacidad.js';
import { formatearFecha } from '../../calc/fechas.js';

/* Lo que se abrió o cerró a mano. Sin entrada manda el valor por omisión.
   La clave es fecha + nombre porque los sobres se recalculan en cada
   repintado y no tienen id. */
const elegidos = new Map();
const claveDe = (s) => `${s.fecha}|${s.nombre}`;

export function alternarSobre(clave, abiertoAhora) {
  elegidos.set(clave, !abiertoAhora);
}

function lineaSobre(a) {
  return `
    <div class="sobre-linea">
      <span class="crece truncar">${escapar(a.nombre)}
        <span class="tenue-2">· vence ${formatearFecha(a.fecha)}</span></span>
      <span class="monto neg">${textoMonto(a.monto)}</span>
    </div>`;
}

function contenido(s) {
  return `
    ${s.asignaciones.map(lineaSobre).join('')}
    ${s.colchon > 0 ? `
      <div class="sobre-linea">
        <span class="crece truncar">Colchón de gastos variables</span>
        <span class="monto tenue">${textoMonto(s.colchon)}</span>
      </div>` : ''}`;
}

function sobre(s, abierto) {
  const pagos = s.asignaciones.length;
  return `
    <div class="sobre">
      <button type="button" class="sobre-cabeza sobre-plegable"
              data-sobre="${escapar(claveDe(s))}" data-abierto="${abierto ? 1 : 0}">
        <span class="crece truncar">
          <span class="titulo">${escapar(s.nombre)}</span>
          <span class="tenue-2">· ${formatearFecha(s.fecha)}${
            !abierto && pagos ? ` · ${plural(pagos, 'pago', 'pagos')}` : ''}</span>
        </span>
        <span class="monto pos">${textoMonto(s.monto)}</span>
        <span class="tenue-2">${icono(abierto ? 'arriba' : 'abajo', 13)}</span>
      </button>
      ${abierto ? contenido(s) : ''}
      <div class="sobre-pie">
        <span>Libre</span>
        <span class="monto ${s.libre < 0 ? 'neg' : 'pos'}">${textoMonto(s.libre)}</span>
      </div>
    </div>`;
}

export function bloqueSobres(sobres) {
  if (!sobres.length) {
    return '<p class="tenue">No hay ingresos ni obligaciones en este horizonte.</p>';
  }
  const filas = sobres.map((s, i) => sobre(s, elegidos.get(claveDe(s)) ?? i === 0));
  return `
    <div>
      <p class="seccion-titulo">Sobres por ingreso</p>
      <div class="pila-sm">${filas.join('')}</div>
    </div>`;
}

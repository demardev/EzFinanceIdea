/* Los sobres del plan: uno por lo que tienes hoy y uno por cada ingreso.

   Con un horizonte de meses los sobres se repiten casi idénticos y alargan la
   pantalla, así que solo el primero arranca abierto; los demás enseñan su
   cabecera y lo que les queda libre, y se abren al tocarlos. */

import { icono } from '../../iconos/render.js';
import { escapar, plural, enLista } from '../../ui/texto.js';
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

/* Lo que un sobre le pasó a otro, o recibió de uno anterior: sin esta línea
   el Libre de los dos no cuadraría con lo que se ve. */
function lineaTraspaso(t) {
  const recibe = t.monto > 0;
  return `
    <div class="sobre-linea">
      <span class="crece truncar">${recibe ? 'Cubierto con lo que sobró de' : 'Cubre a'}
        ${escapar(t.nombre)} <span class="tenue-2">· ${formatearFecha(t.fecha)}</span></span>
      <span class="monto ${recibe ? 'pos' : 'tenue'}">
        ${recibe ? '+' : '−'}${textoMonto(Math.abs(t.monto))}</span>
    </div>`;
}

/* "Colchón de gastos variables" no decía qué era: la línea nombra lo que se
   aparta y hasta qué día, que es cuando el siguiente ingreso lo releva. */
function lineaColchon(s, nombresColchon) {
  const que = nombresColchon.length ? enLista(nombresColchon) : 'Gastos variables';
  return `
    <div class="sobre-linea">
      <span class="crece truncar">${escapar(que)}
        <span class="tenue-2">· hasta ${formatearFecha(s.colchonHasta)}</span></span>
      <span class="monto tenue">${textoMonto(s.colchon)}</span>
    </div>`;
}

function contenido(s, nombresColchon) {
  return `
    ${s.asignaciones.map(lineaSobre).join('')}
    ${(s.traspasos ?? []).map(lineaTraspaso).join('')}
    ${s.colchon > 0 ? lineaColchon(s, nombresColchon) : ''}`;
}

function sobre(s, abierto, nombresColchon) {
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
      ${abierto ? contenido(s, nombresColchon) : ''}
      <div class="sobre-pie">
        <span>Libre</span>
        <span class="monto ${s.libre < 0 ? 'neg' : 'pos'}">${textoMonto(s.libre)}</span>
      </div>
    </div>`;
}

/** @param nombresColchon los gastos variables en efectivo que forman el colchón */
export function bloqueSobres(sobres, { nombresColchon = [] } = {}) {
  if (!sobres.length) {
    return '<p class="tenue">No hay ingresos ni obligaciones en este horizonte.</p>';
  }
  const filas = sobres.map((s, i) =>
    sobre(s, elegidos.get(claveDe(s)) ?? i === 0, nombresColchon));
  return `
    <div>
      <p class="seccion-titulo">Sobres por ingreso</p>
      <div class="pila-sm">${filas.join('')}</div>
    </div>`;
}

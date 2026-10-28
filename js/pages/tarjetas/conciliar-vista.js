/* Lo que se ve al conciliar: cuánto no cuadra y qué lo explicaría.
   Recibe el resultado de calc/conciliacion.js: aquí no se suma nada. */

import { icono } from '../../iconos/render.js';
import { escapar } from '../../ui/texto.js';
import { textoMonto } from '../../ui/privacidad.js';
import { formatearFecha } from '../../calc/fechas.js';

const QUE_ES = {
  fijo: 'Gasto fijo sin registrar',
  cuota: 'Cuota que el banco quizá aún no carga',
  'cargo-corte': 'Pegada al corte: el banco pudo pasarla al ciclo siguiente',
  'pago-corte': 'Pegado al corte: el banco pudo aplicarlo después',
};

function boton(p, ref) {
  if (p.clase === 'fijo') {
    return `<button class="btn btn-sm" type="button" data-registrar="${ref}">Registrar</button>`;
  }
  return p.mov && p.clase !== 'cuota'
    ? `<button class="btn btn-sm" type="button" data-editar-mov="${escapar(p.mov.id)}">Editar</button>`
    : '';
}

function fila(p, ref) {
  return `
    <div class="lista-fila">
      <span class="fila-cuerpo" style="cursor:default">
        <span class="crece" style="min-width:0">
          <span class="titulo truncar" style="display:block">${escapar(p.nombre)}</span>
          <span class="sub">${formatearFecha(p.fecha)} · ${QUE_ES[p.clase]}</span>
        </span>
        <span class="monto">${textoMonto(p.efecto, { signo: true })}</span>
        ${boton(p, ref)}
      </span>
    </div>`;
}

function veredicto(d) {
  if (d === 0) return `<p class="pos">${icono('check', 14)} Cuadra al centavo.</p>`;
  const cuanto = textoMonto(Math.abs(d));
  return d < 0 ? `<p class="warn">A tu app le faltan ${cuanto}.</p>`
               : `<p class="warn">Tu app tiene ${cuanto} de más.</p>`;
}

const lista = (pistas, clave, desde = 0) => `<div class="lista">${pistas
  .map((p, i) => fila(p, `${clave}:${desde + i}`)).join('')}</div>`;

const nota = (texto) => `<p class="tenue-2" style="font-size:12.5px">${texto}</p>`;

/* Las que dan la diferencia exacta van primero y separadas: casi siempre son la respuesta. */
function explicacion(c, clave) {
  if (c.diferencia === 0) return '';
  const exactas = c.explican ?? [];
  const resto = c.pistas.slice(exactas.length);
  return `
    ${exactas.length
      ? `${nota('Esto da la diferencia exacta:')}${lista(c.pistas.slice(0, exactas.length), clave)}`
      : nota(`Ninguna combinación de lo que reviso da ${textoMonto(Math.abs(c.diferencia))}.
              Busca en el banco un cargo o pago que no esté en la app, o al revés.`)}
    ${resto.length ? `${nota(exactas.length ? 'Otras pistas:' : 'Pistas:')}
                      ${lista(resto, clave, exactas.length)}` : ''}`;
}

function seccion(titulo, c, clave) {
  if (!c) return '';
  return `
    <div class="pila-sm">
      <p class="seccion-titulo" style="margin:0">${escapar(titulo)}</p>
      <div class="fila-entre" style="font-size:13.5px">
        <span class="tenue">Tu app ${textoMonto(c.app)} · Banco ${textoMonto(c.banco)}</span>
      </div>
      ${veredicto(c.diferencia)}
      ${explicacion(c, clave)}
    </div>`;
}

function cancelaciones(lista) {
  if (!lista.length) return '';
  const filas = lista.map(({ cargo, pago }) => `
    <div class="lista-fila">
      <span class="fila-cuerpo" style="cursor:default">
        <span class="crece">
          <span class="titulo">${escapar(cargo.descripcion)} · ${textoMonto(cargo.monto)}</span><br>
          <span class="sub">Compra ${formatearFecha(cargo.fecha)} y pago ${formatearFecha(pago.fecha)}</span>
        </span>
        <button class="btn btn-sm" type="button" data-editar-mov="${escapar(cargo.id)}">Compra</button>
        <button class="btn btn-sm" type="button" data-editar-mov="${escapar(pago.id)}">Pago</button>
      </span>
    </div>`).join('');
  return `
    <div class="pila-sm">
      <p class="seccion-titulo" style="margin:0">¿Pedidos cancelados?</p>
      ${nota(`Una compra y un pago del mismo monto. Si el banco nunca lo cobró, borra
              los dos: no cambia el saldo, pero infla tus cargos y pagos.`)}
      <div class="lista">${filas}</div>
    </div>`;
}

/** @param r el resultado de conciliar(); `fechaCorte` para el título de la sección. */
export function pintarResultado(r, fechaCorte) {
  if (!r.hoy && !r.corte) {
    return nota('Escribe el saldo que te muestra el banco para compararlo.');
  }
  return `
    ${seccion('Hoy', r.hoy, 'hoy')}
    ${seccion(`Al corte del ${formatearFecha(fechaCorte)}`, r.corte, 'corte')}
    ${cancelaciones(r.cancelaciones)}`;
}

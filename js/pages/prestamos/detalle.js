/* El sheet de un préstamo: cuánto va, sus abonos, y los botones para
   registrar el siguiente pago o editarlo. Los abonos son movimientos
   normales: se registran con el mismo formulario de siempre, ligados al
   préstamo por prestamo_id. */

import { abrirSheet } from '../../ui/sheet.js';
import { escapar } from '../../ui/texto.js';
import { textoMonto } from '../../ui/privacidad.js';
import { formatearFecha, hoyISO } from '../../calc/fechas.js';
import { icono } from '../../iconos/render.js';
import { DIRECCIONES, nombreDe, textoAviso } from './textos.js';

function cifras({ prestamo, estado }) {
  return `
    <div class="card">
      <div class="fila-entre">
        <span><span class="cifra-etiqueta">Falta</span><br>
          <span class="monto">${textoMonto(estado.restante)}</span></span>
        <span><span class="cifra-etiqueta">Abonado</span><br>
          <span class="monto">${textoMonto(estado.abonado)}</span></span>
        <span><span class="cifra-etiqueta">Total</span><br>
          <span class="monto">${textoMonto(prestamo.monto_total)}</span></span>
      </div>
      <div class="barra"><span class="barra-relleno" style="width:${estado.avance}%"></span></div>
      ${estado.progreso ? `<p class="tenue" style="font-size:12.5px">${estado.progreso} pagos</p>` : ''}
    </div>`;
}

function listaAbonos(abonos) {
  if (!abonos.length) return '<p class="tenue-2">Todavía no hay abonos.</p>';
  return `<div class="lista">${abonos.map((a) => `
    <div class="lista-fila"><span class="fila-cuerpo" style="cursor:default">
      <span class="crece truncar">${formatearFecha(a.fecha)}</span>
      <span class="monto">${textoMonto(a.monto)}</span>
    </span></div>`).join('')}</div>`;
}

function cuerpo(item, abonos) {
  const { prestamo, estado } = item;
  const aviso = textoAviso(item, hoyISO());
  return `
    <div class="pila">
      ${cifras(item)}
      ${aviso ? `<p class="${estado.atraso > 0 ? 'warn' : 'tenue'}">${escapar(aviso)}</p>` : ''}
      ${estado.terminado ? '' : `<button class="btn btn-primario btn-bloque" type="button"
          data-abonar>${icono('plus', 16)} ${DIRECCIONES[prestamo.direccion].accion}</button>`}
      <div><p class="seccion-titulo">Abonos</p>${listaAbonos(abonos)}</div>
      ${prestamo.nota ? `<p class="tenue">${escapar(prestamo.nota)}</p>` : ''}
      <button class="btn btn-bloque" type="button" data-editar-prestamo>
        ${icono('lapiz', 16)} Editar préstamo</button>
    </div>`;
}

/**
 * @param item     { prestamo, estado } de resumenPrestamos()
 * @param abonos   sus movimientos
 * @param acciones { alAbonar(), alEditar() } — cada una abre su propio sheet
 */
export function abrirDetalle(item, abonos, { alAbonar, alEditar }) {
  const { hoja, cerrar } = abrirSheet({ titulo: escapar(nombreDe(item.prestamo)),
                                        cuerpo: cuerpo(item, abonos) });
  hoja.querySelector('[data-abonar]')?.addEventListener('click', () => { cerrar(); alAbonar(); });
  hoja.querySelector('[data-editar-prestamo]').addEventListener('click', () => { cerrar(); alEditar(); });
}

/** Lo que trae puesto el formulario de movimiento al abonar. */
export function borradorDeAbono({ prestamo, estado }) {
  const { tipo } = DIRECCIONES[prestamo.direccion];
  const desc = prestamo.direccion === 'debo' ? `Pago a ${prestamo.persona}` : `Cobro de ${prestamo.persona}`;
  return {
    tipo,
    monto: estado.proximo?.monto || estado.restante,
    fecha: hoyISO(),
    descripcion: prestamo.concepto ? `${desc} · ${prestamo.concepto}` : desc,
  };
}

/* Cómo se ve lo que la IA leyó de un estado de cuenta. Solo pinta: el
   veredicto viene de calc/estado-cuenta.js. */

import { escapar } from '../../ui/texto.js';
import { textoMonto } from '../../ui/privacidad.js';
import { formatearFecha } from '../../calc/fechas.js';
import { icono } from '../../iconos/render.js';
import { renglon } from './detalle-desglose.js';

function veredicto(revision, lectura) {
  if (revision.cuadra) {
    return `<p class="pos" style="font-size:13px">${icono('check', 13)}
      Lo leído cuadra con el saldo al corte del banco.</p>`;
  }
  const sobra = revision.diferencia > 0;
  return `<p class="warn" style="font-size:13px">${icono('alerta', 13)}
    No cuadra: lo leído da ${textoMonto(revision.calculado)} y el banco dice
    ${textoMonto(lectura.saldo_al_corte)} (${sobra ? 'sobran' : 'faltan'}
    ${textoMonto(Math.abs(revision.diferencia))}). Puede que la IA leyera mal una línea:
    revisa la lista o vuelve a intentarlo.</p>`;
}

function resumen(lectura, revision) {
  return `
    <div class="card card-plana pila-sm">
      <p style="font-weight:550">${escapar(lectura.banco ?? 'Estado de cuenta')}${
        lectura.fecha_corte ? ` · corte del ${formatearFecha(lectura.fecha_corte)}` : ''}</p>
      ${renglon('Saldo anterior', lectura.saldo_anterior)}
      ${renglon('Cargos', revision.cargos, '+')}
      ${renglon('Pagos y créditos', revision.creditos, '−', 'pos')}
      ${revision.intereses > 0 ? renglon('Intereses fuera de la lista', revision.intereses, '+') : ''}
      ${renglon('<strong>Saldo al corte del banco</strong>', lectura.saldo_al_corte)}
      ${lectura.pago_contado !== null ? renglon('Pago de contado', lectura.pago_contado) : ''}
      ${lectura.fecha_limite_pago ? `<p class="tenue-2" style="font-size:12.5px">
        Fecha límite: ${formatearFecha(lectura.fecha_limite_pago)}</p>` : ''}
      ${veredicto(revision, lectura)}
    </div>`;
}

function filaMovimiento(m) {
  const credito = m.sentido === 'credito';
  return `
    <div class="lista-fila"><span class="fila-cuerpo" style="cursor:default">
      <span class="crece truncar">
        <span class="titulo">${escapar(m.concepto)}</span><br>
        <span class="sub">${m.fecha ? formatearFecha(m.fecha) : 'Sin fecha'}</span>
      </span>
      <span class="monto ${credito ? 'pos' : 'neg'}">${credito ? '+' : '−'}${textoMonto(m.monto)}</span>
    </span></div>`;
}

/** @param revision de revisarLectura() */
export function pintarLectura(lectura, revision, quedan) {
  return `
    ${resumen(lectura, revision)}
    <p class="tenue" style="font-size:12.5px;margin:14px 0 6px">
      ${lectura.movimientos.length} líneas leídas</p>
    <div class="lista">${lectura.movimientos.map(filaMovimiento).join('')}</div>
    <p class="tenue-2" style="font-size:12px;margin-top:12px">
      Te quedan ${quedan} lecturas este mes. El archivo no se guarda.</p>`;
}

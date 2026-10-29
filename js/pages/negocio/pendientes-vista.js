/* Cómo se pinta Por cobrar: los totales arriba y un grupo por cliente, cada
   uno con lo que debe de recibos, de comisiones y en total. Pinta, no
   calcula: los números vienen de negocio/por-cliente.js. */

import { textoMonto } from '../../ui/privacidad.js';
import { escapar } from '../../ui/texto.js';
import { formatearFecha, hoyISO, diasEntre } from '../../calc/fechas.js';
import { cobradoDe, saldoDe, totalDe } from '../../negocio/abonos.js';

/* Sin abonos se lee "recibo + comisión"; con alguno, lo que falta de cuánto. */
function cifra(pago) {
  if (cobradoDe(pago) > 0) {
    return `${textoMonto(saldoDe(pago))}
            <span class="tenue-2">faltan de ${textoMonto(totalDe(pago))}</span>`;
  }
  return `${textoMonto(pago.monto_recibo)}
          <span class="tenue-2">+ ${textoMonto(pago.comision)}</span>`;
}

function fila(pago) {
  const dias = diasEntre(pago.fecha_pago, hoyISO());
  return `
    <div class="lista-fila">
      <button type="button" class="fila-cuerpo" data-cobrar="${pago.id}">
        <span class="crece" style="min-width:0">
          <span class="titulo truncar" style="display:block">${cifra(pago)}</span>
          <span class="sub ${dias >= 7 ? 'warn' : ''}">
            ${pago.descripcion ? `${escapar(pago.descripcion)} · ` : ''}pagado ${formatearFecha(pago.fecha_pago)} · hace ${dias} ${dias === 1 ? 'día' : 'días'}
            ${pago.nota ? `· ${escapar(pago.nota)}` : ''}
          </span>
        </span>
        <span class="badge">cobrar</span>
      </button>
    </div>`;
}

function cifraTotal(etiqueta, monto) {
  return `<span><span class="cifra-etiqueta">${etiqueta}</span>
          <span class="monto">${textoMonto(monto)}</span></span>`;
}

function totales({ recibos, comisiones, total }) {
  return `
    <div class="card cifras-tres">
      ${cifraTotal('Recibos', recibos)}
      ${cifraTotal('Comisiones', comisiones)}
      ${cifraTotal('Total', total)}
    </div>`;
}

/* Si nada tiene cliente, el encabezado "Sin cliente" no dice nada. */
function grupo(g, conEncabezado) {
  const encabezado = `
    <div class="fila-entre">
      <span class="seccion-titulo truncar">${g.nombre === null ? 'Sin cliente' : escapar(g.nombre)}</span>
      <span class="monto">${textoMonto(g.total)}</span>
    </div>
    <p class="tenue-2 grupo-cliente-detalle">
      Recibos ${textoMonto(g.recibos)} · Comisiones ${textoMonto(g.comisiones)}
    </p>`;
  return `
    <div class="grupo-cliente">
      ${conEncabezado ? encabezado : ''}
      <div class="lista">${g.pagos.map(fila).join('')}</div>
    </div>`;
}

/** @param resumen lo que devuelve porCobrarPorCliente() */
export function cuerpoPendientes(resumen) {
  if (!resumen.grupos.length) return '<p class="tenue">No te deben nada. Todo cobrado.</p>';
  const soloSinCliente = resumen.grupos.length === 1 && resumen.grupos[0].nombre === null;
  return `
    <div class="pila">
      ${totales(resumen)}
      <div>${resumen.grupos.map((g) => grupo(g, !soloSinCliente)).join('')}</div>
    </div>`;
}

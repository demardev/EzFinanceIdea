/* Cómo se pinta Por cobrar: los totales de todos arriba y un bloque por
   cliente con lo que debe de recibos, de comisiones y en total, sus
   operaciones y el botón de cobrarle todo. Pinta, no calcula: los números
   vienen de negocio/por-cliente.js. */

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

function cifras({ recibos, comisiones, total }) {
  return `
    <div class="cifras-tres">
      ${cifraTotal('Recibos', recibos)}
      ${cifraTotal('Comisiones', comisiones)}
      ${cifraTotal('Total', total)}
    </div>`;
}

/* "Cobrar todo" solo con un cliente: los de "sin cliente" son de gente
   distinta y no te pagan juntos. */
function botonCobrarTodo(g) {
  if (g.cliente_id === null) return '';
  return `
    <button class="btn btn-bloque" type="button" data-cobrar-todos="${g.cliente_id}">
      Cobrar todo · ${textoMonto(g.total)}
    </button>`;
}

function bloqueCliente(g) {
  const cuantas = g.pagos.length === 1 ? '1 operación' : `${g.pagos.length} operaciones`;
  return `
    <section class="card grupo-cliente">
      <div class="fila-entre">
        <span class="titulo truncar">${g.nombre === null ? 'Sin cliente' : escapar(g.nombre)}</span>
        <span class="tenue-2">${cuantas}</span>
      </div>
      ${cifras(g)}
      <div class="lista">${g.pagos.map(fila).join('')}</div>
      ${botonCobrarTodo(g)}
    </section>`;
}

/** @param resumen lo que devuelve porCobrarPorCliente() */
export function cuerpoPendientes(resumen) {
  if (!resumen.grupos.length) return '<p class="tenue">No te deben nada. Todo cobrado.</p>';
  /* Si nada tiene cliente, un bloque "Sin cliente" no dice nada: la lista sola. */
  if (resumen.grupos.length === 1 && resumen.grupos[0].nombre === null) {
    return `
      <div class="pila">
        <div class="card">${cifras(resumen)}</div>
        <div class="lista">${resumen.grupos[0].pagos.map(fila).join('')}</div>
      </div>`;
  }
  return `
    <div class="pila">
      <div class="card"><p class="cifra-etiqueta">Entre todos</p>${cifras(resumen)}</div>
      ${resumen.grupos.map(bloqueCliente).join('')}
    </div>`;
}

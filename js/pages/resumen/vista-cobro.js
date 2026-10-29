/* La parte de cobro de la pantalla Negocio: cuánto tardas en que te
   paguen y qué lleva demasiado tiempo en la calle. Recibe todo calculado. */

import { textoMonto } from '../../ui/privacidad.js';
import { escapar } from '../../ui/texto.js';
import { formatearFecha } from '../../calc/fechas.js';

const enDias = (n) => (n === 1 ? '1 día' : `${n} días`);

function tarjetaTiempos(t) {
  if (!t.cobradas) {
    return '<div class="card"><p class="tenue-2">Todavía no hay cobros en los últimos 90 días.</p></div>';
  }
  return `
    <div class="card">
      <p class="cifra-etiqueta">Tardas en cobrar</p>
      <p><span class="monto" style="font-size:20px;font-weight:620">${enDias(t.promedio)}</span>
         <span class="tenue">en promedio · la más lenta ${enDias(t.maximo)}</span></p>
      <p class="tenue-2" style="font-size:12.5px">
        De ${t.cobradas === 1 ? '1 operación cobrada' : `${t.cobradas} operaciones cobradas`}
        en los últimos 90 días.</p>
    </div>`;
}

function filaVieja(p) {
  const nombre = p.cliente ?? p.descripcion ?? 'Sin descripción';
  return `
    <div class="lista-fila">
      <span class="fila-cuerpo" style="cursor:default">
        <span class="crece" style="min-width:0">
          <span class="titulo truncar" style="display:block">${escapar(nombre)}</span>
          <span class="sub"><span class="warn">pagado ${formatearFecha(p.fecha_pago)}
            · hace ${enDias(p.dias)}</span></span>
        </span>
        <span class="monto">${textoMonto(p.saldo)}</span>
      </span>
    </div>`;
}

/** @param tiempos de tiemposDeCobro() · @param viejos de pendientesViejos() */
export function seccionCobro(tiempos, viejos) {
  return `
    <div class="pila-sm">
      <p class="seccion-titulo" style="margin:0">Cobro</p>
      ${tarjetaTiempos(tiempos)}
      ${viejos.length ? `
        <p class="tenue" style="font-size:13px">Llevan 7 días o más sin cobrar:</p>
        <div class="lista">${viejos.map(filaVieja).join('')}</div>`
        : '<p class="tenue-2" style="font-size:13px">Nada lleva 7 días o más sin cobrar.</p>'}
    </div>`;
}

/* De dónde sale la deuda: saldo inicial + cargos − pagos, y si con lo pagado
   ya queda cubierto el corte. Recibe las cifras hechas: aquí no se suma. */

import { icono } from '../../iconos/render.js';
import { textoMonto } from '../../ui/privacidad.js';
import { formatearFecha } from '../../calc/fechas.js';

function renglon(etiqueta, monto, signo = '', acento = '') {
  return `
    <div class="fila-entre" style="font-size:13.5px">
      <span class="tenue">${etiqueta}</span>
      <span class="monto ${acento}">${signo}${textoMonto(monto)}</span>
    </div>`;
}

/* La pregunta que importa: ¿con lo que pagaste ya está el corte? */
function veredicto(d) {
  const corte = formatearFecha(d.corte);
  if (d.faltaDelCorte > 0) {
    return `<p class="warn" style="font-size:12.5px">
      Para cubrir el corte del ${corte} faltan ${textoMonto(d.faltaDelCorte)}
      · vence ${formatearFecha(d.vence)}</p>`;
  }
  const resto = d.deudaTotal > 0
    ? ` Lo que debes (${textoMonto(d.deudaTotal)}) es del ciclo abierto.`
    : d.saldoAFavor > 0 ? ` Tienes ${textoMonto(d.saldoAFavor)} a favor.` : '';
  return `<p class="pos" style="font-size:12.5px">
    ${icono('check', 13)} Con tus pagos, el corte del ${corte} ya está cubierto.${resto}</p>`;
}

export function bloqueDesglose(d) {
  return `
    <div class="pila-sm" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line)">
      ${d.saldoInicial > 0 ? renglon('Saldo pendiente al empezar', d.saldoInicial) : ''}
      ${renglon('Cargos', d.cargos, '+')}
      ${renglon('Pagos', d.pagos, '−', 'pos')}
      ${renglon('<strong>Deuda total</strong>', d.deudaTotal)}
      ${veredicto(d)}
    </div>`;
}

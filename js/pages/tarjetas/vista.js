/* Pinta la card de cada tarjeta. Recibe los cálculos ya hechos: aquí no se
   suma ni se resta nada. */

import { icono } from '../../iconos/render.js';
import { escapar } from '../../ui/texto.js';
import { textoMonto } from '../../ui/privacidad.js';
import { formatearFecha } from '../../calc/fechas.js';

/** Ámbar si faltan 5 días o menos; rojo si ya venció. */
function acentoPorDias(dias, vencido) {
  if (vencido) return 'neg';
  return dias <= 5 ? 'warn' : 'tenue';
}

function cuentaAtras(dias, vencido) {
  if (vencido) return `venció hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'}`;
  if (dias === 0) return 'vence hoy';
  return `quedan ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

function barraLimite(uso) {
  const ancho = Math.min(100, Math.max(0, uso));
  const acento = uso >= 80 ? 'neg' : uso >= 50 ? 'warn' : '';
  return `
    <div class="barra" role="img" aria-label="${uso.toFixed(0)}% del límite usado">
      <span class="barra-relleno ${acento}" style="width:${ancho}%"></span>
    </div>`;
}

function bloque({ etiqueta, monto, pie, acento = 'tenue' }) {
  return `
    <div class="bloque-ciclo">
      <p class="cifra-etiqueta">${escapar(etiqueta)}</p>
      <p class="monto" style="font-size:19px;font-weight:600">${textoMonto(monto)}</p>
      <p class="${acento}" style="font-size:12px">${escapar(pie)}</p>
    </div>`;
}

function encabezado(t) {
  return `
    <div class="fila-entre">
      <span class="crece truncar">
        <span style="font-weight:600">${escapar(t.nombre)}</span>
        ${t.banco ? `<br><span class="sub tenue">${escapar(t.banco)}</span>` : ''}
      </span>
      ${t.ultimos_4 ? `<span class="tenue-2 monto">•••• ${escapar(t.ultimos_4)}</span>` : ''}
    </div>`;
}

function deudaConBarra(t, d) {
  return `
    <div>
      <p class="cifra-etiqueta">Deuda total</p>
      <p class="cifra monto">${textoMonto(d.deudaTotal)}</p>
      ${t.limite_credito > 0 ? `
        ${barraLimite(d.usoDelLimite ?? 0)}
        <p class="tenue-2" style="font-size:12px">
          ${(d.usoDelLimite ?? 0).toFixed(0)}% de ${textoMonto(t.limite_credito)} ·
          disponible ${textoMonto(d.disponible ?? 0)}
        </p>` : ''}
    </div>`;
}

function botones(t) {
  return `
    <div class="fila" style="gap:8px">
      <button class="btn btn-primario crece" type="button" data-pagar="${t.id}">Pagar</button>
      <button class="btn crece" type="button" data-cuotas="${t.id}">Compra a cuotas</button>
    </div>
    <button class="enlace-accion" type="button" data-detalle="${t.id}">
      Ver detalle ${icono('derecha', 13)}
    </button>`;
}

export function cardTarjeta(t, d, c) {
  const acentoPago = acentoPorDias(c.diasParaLimite, c.vencido);
  return `
    <div class="card pila-sm" data-tarjeta="${t.id}">
      ${encabezado(t)}
      ${deudaConBarra(t, d)}
      ${d.saldoAFavor > 0
        ? `<span class="badge badge-pos">${icono('check', 13)} Saldo a favor ${textoMonto(d.saldoAFavor)}</span>`
        : ''}

      <div class="rejilla-ciclo">
        ${bloque({
          etiqueta: 'Saldo al corte', monto: d.aPagarAhora, acento: acentoPago,
          pie: `vence ${formatearFecha(c.fechaLimiteDelCorte)} · ${cuentaAtras(c.diasParaLimite, c.vencido)}`,
        })}
        ${bloque({
          etiqueta: 'Nuevo ciclo', monto: d.nuevoCiclo,
          pie: `corta ${formatearFecha(c.fechaProximoCorte)} · faltan ${c.diasParaProximoCorte} días`,
        })}
      </div>

      ${d.comprometido > 0 ? `
        <p class="tenue" style="font-size:12.5px">
          ${icono('reloj', 13)} Comprometido en cuotas: ${textoMonto(d.comprometido)}
        </p>` : ''}

      ${botones(t)}
    </div>`;
}

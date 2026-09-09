/* Detalle de una tarjeta: sus movimientos en tres bloques según el ciclo.
   La lista de compras a cuotas se agrega en el paso de cuotas. */

import { icono } from '../../iconos/render.js';
import { escapar } from '../../ui/texto.js';
import { textoMonto } from '../../ui/privacidad.js';
import { formatearFecha, hoyISO } from '../../calc/fechas.js';
import { progresoDeCompra, esCuotaYaPagada } from '../../calc/cuotas.js';

function fila(mov, nombres, iconos, compras = []) {
  const esPago = mov.tipo === 'transferencia';
  /* Se atenúa lo que no pesa en la deuda de hoy: lo que aún no se cobra, y
     las cuotas que ya venían pagadas al registrar la compra. */
  const futuro = mov.fecha > hoyISO();
  const yaPagada = esCuotaYaPagada(mov, compras);
  const nota = futuro ? ' · aún no se cobra' : yaPagada ? ' · ya pagada' : '';
  return `
    <div class="lista-fila" ${futuro || yaPagada ? 'style="opacity:.55"' : ''}>
      <span class="fila-cuerpo" style="cursor:default">
        <span class="icono-caja">${icono(iconos[mov.categoria_id] || (esPago ? 'arrows' : 'card'), 18)}</span>
        <span class="crece truncar">
          <span class="titulo">${escapar(mov.descripcion)}</span><br>
          <span class="sub">${formatearFecha(mov.fecha)}${nota}</span>
        </span>
        <span class="monto ${esPago ? 'pos' : 'neg'}">
          ${esPago ? '+' : '−'}${textoMonto(mov.monto)}
        </span>
      </span>
    </div>`;
}

function bloque(titulo, pie, movs, nombres, iconos, compras) {
  return `
    <div>
      <p class="seccion-titulo">${escapar(titulo)}</p>
      ${pie ? `<p class="tenue-2" style="font-size:12px;margin:-4px 0 8px">${escapar(pie)}</p>` : ''}
      ${movs.length
        ? `<div class="lista">${movs.map((m) => fila(m, nombres, iconos, compras)).join('')}</div>`
        : `<p class="tenue-2" style="padding:2px">Nada en este bloque.</p>`}
    </div>`;
}

/** Reparte los movimientos de la tarjeta en los tres tramos del ciclo. */
export function repartirPorCiclo(movimientos, ciclo) {
  return {
    anteriores: movimientos.filter((m) => m.fecha <= ciclo.fechaCorteAnterior),
    alCorte: movimientos.filter((m) => m.fecha > ciclo.fechaCorteAnterior
                                    && m.fecha <= ciclo.fechaUltimoCorte),
    abierto: movimientos.filter((m) => m.fecha > ciclo.fechaUltimoCorte),
  };
}

/** Una fila por compra a cuotas, con su progreso 3/12 y una barra. */
function filaCompra(compra, cuotas) {
  const p = progresoDeCompra(compra, cuotas, hoyISO());
  const avance = p.total ? (p.cobradas / p.total) * 100 : 0;
  return `
    <div class="lista-fila">
      <button type="button" class="fila-cuerpo" data-compra="${compra.id}">
        <span class="crece" style="min-width:0">
          <span class="fila-entre">
            <span class="titulo truncar">${escapar(compra.descripcion)}</span>
            <span class="monto tenue">${p.texto}</span>
          </span>
          <span class="barra"><span class="barra-relleno" style="width:${avance}%"></span></span>
          <span class="sub">
            ${textoMonto(p.montoCuota)} al mes · faltan ${textoMonto(p.restante)}${
              compra.cuotas_pagadas ? ` · ${compra.cuotas_pagadas} ya pagadas antes` : ''}
          </span>
        </span>
      </button>
    </div>`;
}

function bloqueCompras(compras, cuotas) {
  if (!compras.length) return '';
  return `
    <div>
      <p class="seccion-titulo">Compras a cuotas</p>
      <div class="lista">${compras.map((c) => filaCompra(c, cuotas)).join('')}</div>
    </div>`;
}

export function pintarDetalle(contenedor, {
  tarjeta, ciclo, deuda, movimientos, compras, todasLasCompras = compras, nombres, iconos,
}) {
  const tramos = repartirPorCiclo(movimientos, ciclo);
  contenedor.innerHTML = `
    <div class="pila">
      <div class="card">
        <p class="cifra-etiqueta">Deuda total</p>
        <p class="cifra monto">${textoMonto(deuda.deudaTotal)}</p>
        <p class="tenue" style="font-size:12.5px">
          ${escapar(tarjeta.banco || '')}${tarjeta.ultimos_4 ? ` · •••• ${escapar(tarjeta.ultimos_4)}` : ''}
          · corte día ${tarjeta.dia_corte} · pago día ${tarjeta.dia_limite_pago}
        </p>
      </div>
      ${bloqueCompras(compras, movimientos)}
      ${bloque('Anterior al corte', `hasta ${formatearFecha(ciclo.fechaCorteAnterior)}`,
               tramos.anteriores, nombres, iconos, todasLasCompras)}
      ${bloque('Corte actual',
               `${formatearFecha(ciclo.fechaCorteAnterior)} — ${formatearFecha(ciclo.fechaUltimoCorte)}`,
               tramos.alCorte, nombres, iconos, todasLasCompras)}
      ${bloque('Ciclo abierto', `desde ${formatearFecha(ciclo.fechaUltimoCorte)}`,
               tramos.abierto, nombres, iconos, todasLasCompras)}
      <button class="btn btn-bloque" type="button" data-cuotas="${tarjeta.id}">
        ${icono('card', 16)} Nueva compra a cuotas
      </button>
      <button class="btn btn-bloque" type="button" id="btn-editar-tarjeta">
        ${icono('lapiz', 16)} Editar tarjeta
      </button>
    </div>`;
}

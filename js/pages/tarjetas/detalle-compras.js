/* El bloque de compras a cuotas del detalle: cada compra con su progreso y,
   al tocar el contador, las cuotas que le faltan por cobrar.

   Esas cuotas futuras NO se listan entre los movimientos del ciclo: son
   decenas de filas que ahogan lo que de verdad pasó este mes. Viven dentro de
   su compra, que es donde se entienden. */

import { icono } from '../../iconos/render.js';
import { escapar } from '../../ui/texto.js';
import { textoMonto } from '../../ui/privacidad.js';
import { formatearFecha, hoyISO } from '../../calc/fechas.js';
import { progresoDeCompra } from '../../calc/cuotas.js';

/** Las que aún no se cobran, en el orden que pida la pantalla. */
export function cuotasFuturas(compraId, movimientos, hoy = hoyISO()) {
  return movimientos.filter((m) => m.compra_id === compraId && m.fecha > hoy);
}

function filaFutura(mov) {
  return `
    <div class="cuota-futura">
      <span class="crece truncar">${escapar(mov.descripcion)}</span>
      <span class="tenue-2">${formatearFecha(mov.fecha)}</span>
      <span class="monto neg">−${textoMonto(mov.monto)}</span>
    </div>`;
}

function filaCompra(compra, cuotas, abierta) {
  const p = progresoDeCompra(compra, cuotas, hoyISO());
  const avance = p.total ? (p.cobradas / p.total) * 100 : 0;
  return `
    <div class="lista-fila">
      <button type="button" class="fila-cuerpo" data-compra="${compra.id}">
        <span class="crece" style="min-width:0">
          <span class="titulo truncar" style="display:block">${escapar(compra.descripcion)}</span>
          <span class="barra"><span class="barra-relleno" style="width:${avance}%"></span></span>
          <span class="sub">
            ${textoMonto(p.montoCuota)} al mes · faltan ${textoMonto(p.restante)}${
              compra.cuotas_pagadas ? ` · ${compra.cuotas_pagadas} ya pagadas antes` : ''}
          </span>
        </span>
      </button>
      <button type="button" class="contador-cuotas ${abierta ? 'activo' : ''}"
              data-cuotas-de="${compra.id}"
              aria-label="Ver las cuotas que faltan de ${escapar(compra.descripcion)}">
        ${p.texto} ${icono(abierta ? 'arriba' : 'abajo', 13)}
      </button>
    </div>`;
}

/**
 * @param abierta id de la compra cuyas cuotas futuras se están mostrando
 * @param ordenar (movs) => movs, el mismo orden que el resto de la pantalla
 */
export function bloqueCompras(compras, cuotas, { abierta, ordenar }) {
  if (!compras.length) return '';
  const filas = compras.map((c) => {
    if (c.id !== abierta) return filaCompra(c, cuotas, false);
    const futuras = ordenar(cuotasFuturas(c.id, cuotas));
    return filaCompra(c, cuotas, true)
      + (futuras.length
        ? `<div class="cuotas-futuras">${futuras.map(filaFutura).join('')}</div>`
        : '<div class="cuotas-futuras"><div class="cuota-futura">'
          + '<span class="crece tenue-2">Ya se cobraron todas.</span></div></div>');
  });
  return `
    <div>
      <p class="seccion-titulo">Compras a cuotas</p>
      <div class="lista">${filas.join('')}</div>
    </div>`;
}

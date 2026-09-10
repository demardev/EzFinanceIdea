/* Detalle de una tarjeta: sus movimientos en tres bloques según el ciclo.

   El estado de la vista —orden, si el bloque viejo está desplegado, y qué
   compra muestra sus cuotas— vive aquí y no en la pantalla: la pantalla se
   repinta entera con cada cambio de datos y se perdería. */

import { icono } from '../../iconos/render.js';
import { escapar } from '../../ui/texto.js';
import { textoMonto } from '../../ui/privacidad.js';
import { formatearFecha, hoyISO } from '../../calc/fechas.js';
import { esCuotaYaPagada } from '../../calc/cuotas.js';
import { ordenarPorFecha, direccionOpuesta, DIRECCIONES } from '../../movimientos/orden.js';
import { bloqueCompras } from './detalle-compras.js';

const CLAVE_ORDEN = 'finanzas.orden-tarjeta';
const CLAVE_BLOQUES = 'finanzas.bloques-tarjeta';

/* Lo viejo arranca plegado —es historia— y lo de ahora abierto. */
const POR_OMISION = { anteriores: false, alCorte: true, abierto: true };

function leerBloques() {
  try {
    return { ...POR_OMISION, ...JSON.parse(localStorage.getItem(CLAVE_BLOQUES) || '{}') };
  } catch { return { ...POR_OMISION }; }
}

let orden = localStorage.getItem(CLAVE_ORDEN) === 'asc' ? 'asc' : 'desc';
let abiertos = leerBloques();
let compraAbierta = null;

export function alternarOrden() {
  orden = direccionOpuesta(orden);
  localStorage.setItem(CLAVE_ORDEN, orden);
}

export function alternarBloque(clave) {
  abiertos = { ...abiertos, [clave]: !abiertos[clave] };
  localStorage.setItem(CLAVE_BLOQUES, JSON.stringify(abiertos));
}

/** Tocar el contador de una compra abre sus cuotas; tocarlo de nuevo las cierra. */
export function alternarCuotasDe(compraId) {
  compraAbierta = compraAbierta === compraId ? null : compraId;
}

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

function lista(movs, nombres, iconos, compras) {
  return movs.length
    ? `<div class="lista">${movs.map((m) => fila(m, nombres, iconos, compras)).join('')}</div>`
    : '<p class="tenue-2" style="padding:2px">Nada en este bloque.</p>';
}

/* Los tres bloques se pliegan igual: el número de al lado dice cuántos
   movimientos hay guardados ahí dentro, para no tener que abrirlo. */
function bloque(clave, titulo, pie, movs, nombres, iconos, compras) {
  const abierto = abiertos[clave];
  return `
    <div>
      <button type="button" class="seccion-titulo titulo-plegable" data-bloque="${clave}">
        ${escapar(titulo)} ${icono(abierto ? 'arriba' : 'abajo', 13)}
        <span class="crece"></span>
        <span class="tenue-2" style="text-transform:none">${movs.length}</span>
      </button>
      ${abierto ? `
        <p class="tenue-2" style="font-size:12px;margin:-4px 0 8px">${escapar(pie)}</p>
        ${lista(movs, nombres, iconos, compras)}` : ''}
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

function barraOrden() {
  const d = DIRECCIONES[orden];
  return `
    <div class="seccion-barra">
      <span class="seccion-titulo" style="margin:0">Movimientos</span>
      <button class="icono-btn" id="btn-orden-tarjeta" type="button"
              aria-label="${d.etiqueta}" title="${d.etiqueta}">${icono(d.icono, 18)}</button>
    </div>`;
}

function cabecera(tarjeta, deuda) {
  return `
    <div class="card">
      <p class="cifra-etiqueta">Deuda total</p>
      <p class="cifra monto">${textoMonto(deuda.deudaTotal)}</p>
      <p class="tenue" style="font-size:12.5px">
        ${escapar(tarjeta.banco || '')}${tarjeta.ultimos_4 ? ` · •••• ${escapar(tarjeta.ultimos_4)}` : ''}
        · corte día ${tarjeta.dia_corte} · pago día ${tarjeta.dia_limite_pago}
      </p>
    </div>`;
}

export function pintarDetalle(contenedor, {
  tarjeta, ciclo, deuda, movimientos, compras, todasLasCompras = compras, nombres, iconos,
}) {
  const ordenar = (movs) => ordenarPorFecha(movs, orden);
  /* Las cuotas por cobrar salen de los bloques del ciclo: se ven dentro de su
     compra, al tocar el contador. */
  const delCiclo = movimientos.filter((m) => !(m.compra_id && m.fecha > hoyISO()));
  const tramos = repartirPorCiclo(delCiclo, ciclo);
  const pintarBloque = (clave, titulo, pie, movs) =>
    bloque(clave, titulo, pie, ordenar(movs), nombres, iconos, todasLasCompras);

  contenedor.innerHTML = `
    <div class="pila">
      ${cabecera(tarjeta, deuda)}
      ${bloqueCompras(compras, movimientos, { abierta: compraAbierta, ordenar })}
      ${barraOrden()}
      ${pintarBloque('anteriores', 'Anterior al corte',
                     `hasta ${formatearFecha(ciclo.fechaCorteAnterior)}`, tramos.anteriores)}
      ${pintarBloque('alCorte', 'Corte actual',
                     `${formatearFecha(ciclo.fechaCorteAnterior)} — ${formatearFecha(ciclo.fechaUltimoCorte)}`,
                     tramos.alCorte)}
      ${pintarBloque('abierto', 'Ciclo abierto',
                     `desde ${formatearFecha(ciclo.fechaUltimoCorte)}`, tramos.abierto)}
      <button class="btn btn-bloque" type="button" data-cuotas="${tarjeta.id}">
        ${icono('card', 16)} Nueva compra a cuotas
      </button>
      <button class="btn btn-bloque" type="button" id="btn-editar-tarjeta">
        ${icono('lapiz', 16)} Editar tarjeta
      </button>
    </div>`;
}

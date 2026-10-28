/* Detalle de una tarjeta: sus movimientos de un tramo del ciclo a la vez,
   elegido con una barra (anterior, al corte, abierto).

   El estado de la vista —orden, qué tramo se ve, y qué compra muestra sus
   cuotas— vive aquí y no en la pantalla: la pantalla se repinta entera con
   cada cambio de datos y se perdería. */

import { icono } from '../../iconos/render.js';
import { escapar } from '../../ui/texto.js';
import { pastillas } from '../../ui/pastillas.js';
import { textoMonto } from '../../ui/privacidad.js';
import { formatearFecha, hoyISO, sumarDias } from '../../calc/fechas.js';
import { esCuotaYaPagada } from '../../calc/cuotas.js';
import { esGastoFijo } from '../../calc/vencimientos.js';
import { ordenarPorFecha, direccionOpuesta, DIRECCIONES } from '../../movimientos/orden.js';
import { bloqueCompras } from './detalle-compras.js';
import { bloqueDesglose } from './detalle-desglose.js';
import { bloqueFijos } from './detalle-fijos.js';

const CLAVE_ORDEN = 'finanzas.orden-tarjeta';
const CLAVE_TRAMO = 'finanzas.tramo-tarjeta';
const TRAMOS = ['anteriores', 'alCorte', 'abierto'];

/* Se abre en el último tramo que viste; la primera vez, en lo que está corriendo. */
function leerTramo() {
  try {
    const guardado = localStorage.getItem(CLAVE_TRAMO);
    return TRAMOS.includes(guardado) ? guardado : 'abierto';
  } catch { return 'abierto'; }
}

let orden = localStorage.getItem(CLAVE_ORDEN) === 'asc' ? 'asc' : 'desc';
let tramo = leerTramo();
let compraAbierta = null;

export function alternarOrden() {
  orden = direccionOpuesta(orden);
  localStorage.setItem(CLAVE_ORDEN, orden);
}

export function elegirTramo(valor) {
  if (!TRAMOS.includes(valor)) return;
  tramo = valor;
  try { localStorage.setItem(CLAVE_TRAMO, valor); } catch { /* solo se pierde el recuerdo */ }
}

/** Tocar el contador de una compra abre sus cuotas; tocarlo de nuevo las cierra. */
export function alternarCuotasDe(compraId) {
  compraAbierta = compraAbierta === compraId ? null : compraId;
}

/* Las cuotas y los gastos fijos son cargos que se repiten: una insignia los
   separa a simple vista de las compras sueltas. */
function insignia(mov, fijos) {
  const marca = (nombre, texto) =>
    `<span class="badge badge-sm" style="gap:3px">${icono(nombre, 10)}${texto}</span>`;
  if (mov.compra_id) return marca('card', 'a cuotas');
  return esGastoFijo(mov, fijos) ? marca('repeat', 'fijo') : '';
}

function fila(mov, { iconos, compras, fijos }) {
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
          <span class="sub">${formatearFecha(mov.fecha)}${nota}${insignia(mov, fijos)}</span>
        </span>
        <span class="monto ${esPago ? 'pos' : 'neg'}">
          ${esPago ? '+' : '−'}${textoMonto(mov.monto)}
        </span>
      </span>
    </div>`;
}

function lista(movs, ctx) {
  return movs.length
    ? `<div class="lista">${movs.map((m) => fila(m, ctx)).join('')}</div>`
    : '<p class="tenue-2" style="padding:2px">Nada en este bloque.</p>';
}

/* Una barra en vez de tres bloques plegables: con muchos movimientos, los
   bloques hacían una lista larguísima. El número dice cuántos hay en cada uno. */
function seccionMovimientos(tramos, ciclo, ctx) {
  const despues = (fecha) => formatearFecha(sumarDias(fecha, 1));
  const opciones = [['anteriores', 'Anterior'], ['alCorte', 'Al corte'], ['abierto', 'Abierto']]
    .map(([valor, texto]) => [valor, `${texto} · ${tramos[valor].length}`]);
  const pie = {
    anteriores: `Anterior al corte · hasta ${formatearFecha(ciclo.fechaCorteAnterior)}`,
    alCorte: `Corte actual · ${despues(ciclo.fechaCorteAnterior)} — ${formatearFecha(ciclo.fechaUltimoCorte)}`,
    abierto: `Ciclo abierto · desde ${despues(ciclo.fechaUltimoCorte)}`,
  };
  return `
    <div>
      ${barraOrden()}
      ${pastillas({ opciones, valor: tramo, compactas: true })}
      <p class="tenue-2" style="font-size:12px;margin:0 0 8px">${escapar(pie[tramo])}</p>
      ${lista(ordenarPorFecha(tramos[tramo], orden), ctx)}
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

function cabecera(tarjeta, deuda, desglose) {
  return `
    <div class="card">
      <div class="fila-entre">
        <p class="cifra-etiqueta">Deuda total</p>
        <button class="icono-btn" type="button" data-acciones="${tarjeta.id}"
                aria-label="Acciones de la tarjeta" title="Acciones">${icono('mas', 20)}</button>
      </div>
      <p class="cifra monto">${textoMonto(deuda.deudaTotal)}</p>
      <p class="tenue" style="font-size:12.5px">
        ${escapar(tarjeta.banco || '')}${tarjeta.ultimos_4 ? ` · •••• ${escapar(tarjeta.ultimos_4)}` : ''}
        · corte día ${tarjeta.dia_corte} · pago día ${tarjeta.dia_limite_pago}
      </p>
      ${bloqueDesglose(desglose)}
    </div>`;
}

export function pintarDetalle(contenedor, {
  tarjeta, ciclo, deuda, desglose, movimientos, compras, todasLasCompras = compras,
  iconos, fijos = [], porRegistrar = [],
}) {
  const ordenar = (movs) => ordenarPorFecha(movs, orden);
  /* Las cuotas por cobrar salen de los tramos del ciclo: se ven dentro de su
     compra, al tocar el contador. */
  const delCiclo = movimientos.filter((m) => !(m.compra_id && m.fecha > hoyISO()));
  const tramos = repartirPorCiclo(delCiclo, ciclo);

  contenedor.innerHTML = `
    <div class="pila">
      ${cabecera(tarjeta, deuda, desglose)}
      ${bloqueFijos(porRegistrar)}
      ${bloqueCompras(compras, movimientos, { abierta: compraAbierta, ordenar })}
      ${seccionMovimientos(tramos, ciclo, { iconos, compras: todasLasCompras, fijos })}
    </div>`;
}

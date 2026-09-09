/* Pinta la lista agrupada por día. No hace red, no calcula dinero, no
   decide filtros: recibe las filas ya listas. */

import { icono } from '../../iconos/render.js';
import { escapar } from '../../ui/texto.js';
import { textoMonto } from '../../ui/privacidad.js';
import { etiquetaDia, nombreDelMes } from '../../calc/fechas.js';
import { TIPOS, tipoDe } from '../../movimientos/tipos.js';
import { DIRECCIONES } from '../../movimientos/orden.js';
import { agruparOperaciones } from '../../negocio/agrupar.js';

const SIGNO = { ingreso: '+', egreso: '−', transferencia: '' };

/** "Banco → Ahorros" · "Amex" · "Efectivo" */
function origenDestino(mov, nombres) {
  const de = nombres[mov.cuenta_id] || nombres[mov.tarjeta_id] || '';
  const a = nombres[mov.cuenta_destino_id] || nombres[mov.tarjeta_destino_id] || '';
  return a ? `${de} → ${a}` : de;
}

function fila(mov, nombres, iconos) {
  const tipo = tipoDe(mov);
  const categoria = nombres[mov.categoria_id] || 'Sin categoría';
  return `
    <div class="fila-deslizable">
      <button class="borrar-deslizado" type="button" data-borrar="${mov.id}">
        ${icono('basura', 18)} Eliminar
      </button>
      <div class="lista-fila" data-desliza>
      <button type="button" class="fila-cuerpo" data-editar="${mov.id}">
        <span class="icono-caja">${icono(iconos[mov.categoria_id] || tipo.icono, 18)}</span>
        <span class="crece truncar">
          <span class="titulo">${escapar(mov.descripcion)}</span><br>
          <span class="sub">${escapar(categoria)} · ${escapar(origenDestino(mov, nombres))}</span>
        </span>
        <span class="monto ${tipo.acento}">${SIGNO[mov.tipo]}${textoMonto(mov.monto)}</span>
      </button>
      </div>
    </div>`;
}

/* Una operación del negocio se muestra como una sola fila: el egreso, el
   cobro y la comisión son un mismo hecho. Se agrupa por operación Y día,
   así que un cobro diferido sale en su propio día, como debe. */
function filaOperacion(f, nombres) {
  const cuentas = [...new Set(f.movimientos.map((m) => nombres[m.cuenta_id]).filter(Boolean))];
  const recibo = f.movimientos.find((m) => m.tipo === 'egreso');
  return `
    <div class="lista-fila">
      <button type="button" class="fila-cuerpo" data-operacion="${f.pagoId}">
        <span class="icono-caja">${icono('banknote', 18)}</span>
        <span class="crece" style="min-width:0">
          <span class="titulo truncar" style="display:block">
            ${f.incluyeEgreso ? 'Pago de recibo' : 'Cobro de recibo'}
            ${recibo ? `<span class="tenue-2">· ${textoMonto(recibo.monto)}</span>` : ''}
          </span>
          <span class="sub">${escapar(cuentas.join(' → '))}
            <span class="badge badge-sm">negocio</span></span>
        </span>
        <span class="monto ${f.neto >= 0 ? 'pos' : 'neg'}">
          ${f.neto >= 0 ? '+' : '−'}${textoMonto(Math.abs(f.neto))}
        </span>
      </button>
    </div>`;
}

function grupoDia(fecha, movs, nombres, iconos) {
  const filas = agruparOperaciones(movs)
    .map((f) => (f.grupo ? filaOperacion(f, nombres) : fila(f.movimiento, nombres, iconos)));
  return `
    <div>
      <p class="seccion-titulo">${etiquetaDia(fecha)}</p>
      <div class="lista">${filas.join('')}</div>
    </div>`;
}

/** Agrupa manteniendo el orden descendente que ya trae la lista. */
function porDia(movimientos) {
  const grupos = new Map();
  movimientos.forEach((m) => {
    if (!grupos.has(m.fecha)) grupos.set(m.fecha, []);
    grupos.get(m.fecha).push(m);
  });
  return [...grupos.entries()];
}

function resumenMes(totales) {
  return `
    <div class="card fila-entre">
      <span><span class="cifra-etiqueta">Entró</span><br>
        <span class="monto pos">${textoMonto(totales.entro)}</span></span>
      <span><span class="cifra-etiqueta">Salió</span><br>
        <span class="monto neg">${textoMonto(totales.salio)}</span></span>
      <span><span class="cifra-etiqueta">Neto</span><br>
        <span class="monto">${textoMonto(totales.neto)}</span></span>
    </div>`;
}

function barra({ mes, activos, orden }) {
  const d = DIRECCIONES[orden];
  return `
    <div class="seccion-barra">
      <button class="enlace-accion activo crece truncar" id="btn-mes" type="button"
              style="text-align:left">
        ${nombreDelMes(mes)} ${icono('abajo', 14)}
      </button>
      <button class="icono-btn" id="btn-orden" type="button"
              aria-label="${d.etiqueta}" title="${d.etiqueta}">
        ${icono(d.icono, 18)}
      </button>
      <button class="enlace-accion ${activos ? 'activo' : ''}" id="btn-filtros" type="button">
        ${icono('filtro', 15)} Filtros${activos ? ` (${activos})` : ''}
      </button>
    </div>`;
}

export function pintarMovimientos(contenedor, estado) {
  const { visibles, totales, nombres, iconos, mes, activos, orden, hayMas, total } = estado;
  contenedor.innerHTML = `
    <div class="pila">
      ${barra({ mes, activos, orden })}
      ${resumenMes(totales)}
      ${visibles.length
        ? porDia(visibles).map(([f, ms]) => grupoDia(f, ms, nombres, iconos)).join('')
        : `<div class="vacio"><span class="icono-caja">${icono('movimientos', 22)}</span>
             <p>Sin movimientos con estos filtros.</p></div>`}
      ${hayMas ? `<button class="btn btn-bloque" id="btn-mas" type="button">
                    Cargar más (${total - visibles.length} restantes)</button>` : ''}
    </div>`;
}

export { TIPOS };

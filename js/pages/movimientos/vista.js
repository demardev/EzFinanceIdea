/* Pinta la lista agrupada por día. No hace red, no calcula dinero, no
   decide filtros: recibe las filas ya listas. */

import { icono } from '../../iconos/render.js';
import { escapar } from '../../ui/texto.js';
import { textoMonto } from '../../ui/privacidad.js';
import { etiquetaDia, nombreDelMes } from '../../calc/fechas.js';
import { TIPOS, tipoDe } from '../../movimientos/tipos.js';

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

function grupoDia(fecha, movs, nombres, iconos) {
  return `
    <div>
      <p class="seccion-titulo">${etiquetaDia(fecha)}</p>
      <div class="lista">${movs.map((m) => fila(m, nombres, iconos)).join('')}</div>
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

function barra({ mes, activos }) {
  return `
    <div class="seccion-barra">
      <button class="enlace-accion activo" id="btn-mes" type="button">
        ${nombreDelMes(mes)} ${icono('abajo', 14)}
      </button>
      <button class="enlace-accion ${activos ? 'activo' : ''}" id="btn-filtros" type="button">
        ${icono('filtro', 15)} Filtros${activos ? ` (${activos})` : ''}
      </button>
    </div>`;
}

export function pintarMovimientos(contenedor, estado) {
  const { visibles, totales, nombres, iconos, mes, activos, hayMas, total } = estado;
  contenedor.innerHTML = `
    <div class="pila">
      ${barra({ mes, activos })}
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

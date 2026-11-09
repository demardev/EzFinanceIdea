/* Los próximos vencimientos del Resumen, plegados: el encabezado dice
   cuántos hay y cuál sigue, y se abre para ver la lista. Tocar uno que se
   puede registrar lo abre (acciones.js escucha en el contenedor). */

import { icono } from '../../iconos/render.js';
import { escapar } from '../../ui/texto.js';
import { textoMonto } from '../../ui/privacidad.js';
import { formatearFecha } from '../../calc/fechas.js';
import { desplegable } from '../../ui/desplegable.js';

const ICONO_VENCIMIENTO = { pago: 'card', corte: 'reloj', gasto: 'sale', ingreso: 'entra' };
const QUE_ES = { pago: 'pagar', corte: 'corta', gasto: 'se cobra', ingreso: 'llega' };
const ACENTO = { vencido: 'neg', urgente: 'warn', normal: 'tenue' };

/* Un ingreso atrasado no "venció": se atrasó. */
function cuandoTexto(dias, clase) {
  if (dias < 0) {
    const n = Math.abs(dias);
    const verbo = clase === 'ingreso' ? 'se atrasó' : 'venció hace';
    return `${verbo} ${n} ${n === 1 ? 'día' : 'días'}`;
  }
  return dias === 0 ? 'hoy' : `en ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

/* Si su cargo ya está en Por confirmar, no urge: solo falta confirmarlo. */
function cuandoVencimiento(v) {
  if (v.porConfirmar) return `<span class="tenue">llegó · por confirmar</span>`;
  return `<span class="${ACENTO[v.estado]}">
            ${QUE_ES[v.clase]} ${formatearFecha(v.fecha)} · ${cuandoTexto(v.dias, v.clase)}
          </span>`;
}

/* Los gastos fijos y los ingresos se tocan para registrarlos; los avisos de
   tarjeta no hacen nada, porque su pago se hace desde Tarjetas. */
function filaVencimiento(v, indice) {
  const cuerpo = `
        <span class="icono-caja">${icono(ICONO_VENCIMIENTO[v.clase], 18)}</span>
        <span class="crece" style="min-width:0">
          <span class="titulo truncar" style="display:block">${escapar(v.nombre)}</span>
          <span class="sub">${cuandoVencimiento(v)}</span>
        </span>
        <span class="monto ${v.clase === 'ingreso' ? 'pos' : ''}">${textoMonto(v.monto)}</span>`;
  const interior = v.item
    ? `<button type="button" class="fila-cuerpo" data-vencimiento="${indice}">${cuerpo}</button>`
    : `<span class="fila-cuerpo" style="cursor:default">${cuerpo}</span>`;
  return `<div class="lista-fila">${interior}</div>`;
}

/* Con gastos fijos a la vista, se explica cómo se cruzan con Por confirmar.
   Va adentro y no junto al título: un botón en el encabezado lo abriría. */
function ayudaFijos(vencimientos) {
  if (!vencimientos.some((v) => v.clase === 'gasto' && v.item)) return '';
  return `
    <button class="enlace-accion fila" id="btn-ayuda-fijos" type="button" style="gap:4px">
      ${icono('ayuda', 15)} ¿Cómo se confirman los gastos fijos?</button>`;
}

/* Lo más urgente manda el color del encabezado. */
function acentoDe(vencimientos) {
  if (vencimientos.some((v) => !v.porConfirmar && v.estado === 'vencido')) return 'neg';
  if (vencimientos.some((v) => !v.porConfirmar && v.estado === 'urgente')) return 'warn';
  return '';
}

/* "2 · NIU CREDITO corta en 2 días": cuántos y el que sigue. */
function subtitulo(vencimientos) {
  const [primero] = vencimientos;
  const cuando = primero.porConfirmar ? 'llegó · por confirmar'
    : `${QUE_ES[primero.clase]} ${cuandoTexto(primero.dias, primero.clase)}`;
  return `<span class="${acentoDe(vencimientos)}">${vencimientos.length} · `
    + `${escapar(primero.nombre)} ${cuando}</span>`;
}

/** Sin vencimientos no hay nada que plegar. */
export function plegableVencimientos(vencimientos) {
  if (!vencimientos.length) return '';
  return desplegable({
    id: 'vencimientos', titulo: 'Próximos vencimientos', iconoNombre: 'reloj',
    sub: subtitulo(vencimientos),
    cuerpo: `
      <div class="lista">${vencimientos.map(filaVencimiento).join('')}</div>
      ${ayudaFijos(vencimientos)}`,
  });
}

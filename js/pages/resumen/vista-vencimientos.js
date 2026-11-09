/* Los próximos vencimientos del Resumen: un cuadrito de la fila de accesos
   (cuántos hay y cuándo es el siguiente) y su panel con la lista. Tocar uno
   que se puede registrar lo abre (acciones.js escucha en el contenedor). */

import { icono } from '../../iconos/render.js';
import { escapar } from '../../ui/texto.js';
import { textoMonto } from '../../ui/privacidad.js';
import { formatearFecha } from '../../calc/fechas.js';

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
   Va al final del panel. */
function ayudaFijos(vencimientos) {
  if (!vencimientos.some((v) => v.clase === 'gasto' && v.item)) return '';
  return `
    <button class="enlace-accion fila" id="btn-ayuda-fijos" type="button" style="gap:4px">
      ${icono('ayuda', 15)} ¿Cómo se confirman los gastos fijos?</button>`;
}

/* Lo más urgente manda el color del cuadrito. */
function acentoDe(vencimientos) {
  if (vencimientos.some((v) => !v.porConfirmar && v.estado === 'vencido')) return 'neg';
  if (vencimientos.some((v) => !v.porConfirmar && v.estado === 'urgente')) return 'warn';
  return '';
}

/* El siguiente, en corto: "en 2 días", "hoy", "por confirmar". */
function siguiente([primero]) {
  return primero.porConfirmar ? 'por confirmar' : cuandoTexto(primero.dias, primero.clase);
}

/** El bloque para la fila de accesos, o null si no hay vencimientos. */
export function bloqueVencimientos(vencimientos) {
  if (!vencimientos.length) return null;
  return {
    id: 'vencimientos', titulo: 'Vencimientos', tituloPanel: 'Próximos vencimientos',
    iconoNombre: 'reloj', cuantos: vencimientos.length, acento: acentoDe(vencimientos) || 'tenue',
    sub: siguiente(vencimientos),
    cuerpo: `
      <div class="lista">${vencimientos.map(filaVencimiento).join('')}</div>
      ${ayudaFijos(vencimientos)}`,
  };
}

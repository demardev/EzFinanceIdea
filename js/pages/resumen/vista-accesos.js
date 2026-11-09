/* La fila de accesos del Resumen: Por confirmar, Por cobrar y Préstamos,
   uno al lado del otro. Solo sale el que aplica: sin bandeja, sin negocio o
   sin préstamos, ese acceso no está y los demás ocupan el ancho. Sin
   ninguno, no hay fila.

   Préstamos solo es acceso cuando no hay préstamos activos: con préstamos,
   la tarjeta de abajo (con lo que debes y te deben) ya lleva ahí. */

import { icono } from '../../iconos/render.js';
import { textoMonto } from '../../ui/privacidad.js';

function contenido(iconoNombre, titulo, cuantos, sub = '') {
  return `
    <span class="fila-entre" style="width:100%;min-height:22px">
      ${icono(iconoNombre, 18)}
      ${cuantos ? `<span class="badge badge-warn">${cuantos}</span>` : ''}
    </span>
    <span class="acceso-titulo">${titulo}</span>
    ${sub ? `<span class="acceso-sub monto">${sub}</span>` : ''}`;
}

/**
 * @param porConfirmar cuántos hay en la bandeja (0 o nada: no sale)
 * @param porCobrar    { total, cuantos } del negocio, o nada
 * @param prestamos    el resultado de resumenPrestamos(), o nada
 */
export function filaAccesos({ porConfirmar, porCobrar, prestamos }) {
  const accesos = [];
  if (porConfirmar > 0) {
    accesos.push(`<button class="btn acceso" id="btn-por-confirmar" type="button">
      ${contenido('card', 'Por confirmar', porConfirmar)}</button>`);
  }
  if (porCobrar?.cuantos > 0) {
    accesos.push(`<button class="btn acceso" id="btn-por-cobrar" type="button">
      ${contenido('reloj', 'Por cobrar', porCobrar.cuantos, textoMonto(porCobrar.total))}</button>`);
  }
  if (prestamos && !prestamos.activos.length) {
    accesos.push(`<a class="btn acceso" href="#/prestamos">
      ${contenido('persona', 'Préstamos')}</a>`);
  }
  return accesos.length ? `<div class="accesos">${accesos.join('')}</div>` : '';
}

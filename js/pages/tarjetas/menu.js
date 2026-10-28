/* El menú ⋯ de una tarjeta: las acciones que no se usan a diario, en una
   hoja desde abajo como el resto de la app, en vez de botones al final de
   una lista que puede ser muy larga. */

import { abrirSheet } from '../../ui/sheet.js';
import { escapar } from '../../ui/texto.js';
import { icono } from '../../iconos/render.js';

const ACCIONES = [
  ['pagar', 'card', 'Pagar'],
  ['conciliar', 'check', 'Conciliar con el banco'],
  ['cuotas', 'repeat', 'Nueva compra a cuotas'],
  ['editar', 'lapiz', 'Editar tarjeta'],
];

/** @param alElegir (accion) => void, con la hoja ya cerrada */
export function abrirMenuTarjeta(tarjeta, alElegir) {
  const filas = ACCIONES.map(([accion, nombre, texto]) => `
    <div class="lista-fila">
      <button type="button" class="fila-cuerpo" data-accion="${accion}">
        <span class="icono-caja">${icono(nombre, 18)}</span>
        <span class="crece titulo">${texto}</span>
      </button>
    </div>`).join('');
  const { hoja, cerrar } = abrirSheet({
    titulo: escapar(tarjeta.nombre),
    cuerpo: `<div class="lista">${filas}</div>`,
  });
  hoja.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-accion]');
    if (!boton) return;
    cerrar();
    alElegir(boton.dataset.accion);
  });
}

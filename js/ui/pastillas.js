/* Pastillas: un segmentado de opciones excluyentes, el mismo que usa el
   formulario de movimientos para elegir el tipo.

   Se pinta con pastillas() y se engancha UNA sola vez con conectarPastillas():
   el listener va en el contenedor, no en los botones, así que sobrevive a los
   repintados de la pantalla. */

import { escapar } from './texto.js';

/**
 * @param opciones  [[valor, texto], ...]
 * @param compactas fila delgada, para cuando no es el control principal
 */
export function pastillas({ opciones, valor, compactas = false }) {
  const botones = opciones.map(([v, t]) => `
    <button type="button" class="pastilla ${v === valor ? 'activa' : ''}"
            data-pastilla="${escapar(v)}">${escapar(t)}</button>`).join('');
  return `<div class="pastillas ${compactas ? 'pastillas-sm' : ''}">${botones}</div>`;
}

/** @param alElegir (valor) => void */
export function conectarPastillas(contenedor, alElegir) {
  contenedor.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-pastilla]');
    /* El valor puede ser "" (la opción "Todo"), así que se pregunta por el
       atributo y no por si dataset trae algo. */
    if (boton) alElegir(boton.dataset.pastilla);
  });
}

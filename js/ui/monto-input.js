/* Pega los campos de monto con el DOM. El formato vive en calc/dinero.js.

   Entrada estilo calculadora: los dígitos entran por la derecha, así que el
   cursor va siempre al final. No hace falta contar posiciones ni teclear el
   punto: borrar un dígito recorre el decimal solo. */

import { formatearEntrada, montoAEntrada } from '../calc/dinero.js';

function alFinal(input) {
  const fin = input.value.length;
  input.setSelectionRange(fin, fin);
}

function conectarUno(input) {
  input.addEventListener('input', () => {
    input.value = formatearEntrada(input.value);
    alFinal(input);
  });

  /* Al enfocar, el cursor al final: escribir siempre agrega por la derecha. */
  input.addEventListener('focus', () => { requestAnimationFrame(() => alFinal(input)); });
}

/** Engancha todos los campos de monto que haya dentro de `raiz`. */
export function conectarMontos(raiz) {
  raiz.querySelectorAll('input[data-monto]').forEach(conectarUno);
}

export { montoAEntrada };

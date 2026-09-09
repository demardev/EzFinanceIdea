/* Bottom sheet: sube desde abajo, no es un modal centrado. Solo presenta;
   quien lo llena decide qué va dentro. */

import { conectarMontos } from './monto-input.js';

const ABIERTOS = [];

function quitar(pieza) {
  pieza.fondo.remove();
  pieza.hoja.remove();
  const i = ABIERTOS.indexOf(pieza);
  if (i >= 0) ABIERTOS.splice(i, 1);
}

function alTecla(evento) {
  if (evento.key !== 'Escape' || !ABIERTOS.length) return;
  const ultimo = ABIERTOS[ABIERTOS.length - 1];
  ultimo.cerrar();
}

/**
 * @param titulo   encabezado del sheet
 * @param cuerpo   HTML del contenido
 * @param alCerrar callback opcional
 * @returns { hoja, cerrar } — `hoja` es el nodo para enganchar eventos
 */
export function abrirSheet({ titulo, cuerpo, alCerrar }) {
  const fondo = document.createElement('div');
  fondo.className = 'sheet-fondo';

  const hoja = document.createElement('div');
  hoja.className = 'sheet';
  hoja.setAttribute('role', 'dialog');
  hoja.setAttribute('aria-modal', 'true');
  hoja.innerHTML = `<div class="sheet-agarre"></div><h2>${titulo}</h2>${cuerpo}`;

  const pieza = { fondo, hoja, cerrar: null };
  pieza.cerrar = () => {
    quitar(pieza);
    if (!ABIERTOS.length) document.removeEventListener('keydown', alTecla);
    alCerrar?.();
  };

  fondo.addEventListener('click', pieza.cerrar);
  document.body.append(fondo, hoja);
  if (ABIERTOS.length === 0) document.addEventListener('keydown', alTecla);
  ABIERTOS.push(pieza);

  conectarMontos(hoja);
  hoja.querySelector('input, select, textarea, button')?.focus({ preventScroll: true });
  return { hoja, cerrar: pieza.cerrar };
}

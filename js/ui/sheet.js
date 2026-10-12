/* Bottom sheet: sube desde abajo, no es un modal centrado. Solo presenta;
   quien lo llena decide qué va dentro. */

import { conectarMontos } from './monto-input.js';

const ABIERTOS = [];

/* La X cierra igual que tocar fuera o Escape: sin guardar ni confirmar nada. */
const BOTON_CERRAR = `
  <button class="sheet-cerrar" type="button" data-cerrar-sheet aria-label="Cerrar">
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4"
            stroke-linecap="round" fill="none"/>
    </svg>
  </button>`;

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
  hoja.innerHTML = `<div class="sheet-agarre"></div>
    <div class="sheet-cabeza"><h2>${titulo}</h2>${BOTON_CERRAR}</div>${cuerpo}`;

  const pieza = { fondo, hoja, cerrar: null };
  pieza.cerrar = () => {
    quitar(pieza);
    if (!ABIERTOS.length) document.removeEventListener('keydown', alTecla);
    alCerrar?.();
  };

  fondo.addEventListener('click', pieza.cerrar);
  hoja.querySelector('[data-cerrar-sheet]').addEventListener('click', pieza.cerrar);
  document.body.append(fondo, hoja);
  if (ABIERTOS.length === 0) document.addEventListener('keydown', alTecla);
  ABIERTOS.push(pieza);

  conectarMontos(hoja);
  hoja.querySelector('input, select, textarea, button:not([data-cerrar-sheet])')?.focus({ preventScroll: true });
  return { hoja, cerrar: pieza.cerrar };
}

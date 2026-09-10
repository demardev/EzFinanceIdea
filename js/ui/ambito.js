/* El ámbito que se está viendo (Todo / Personal / Negocio) es una preferencia
   de vista, no un filtro más: vive fuera del sheet de filtros, lo comparten
   Resumen y Movimientos, y se recuerda entre sesiones igual que el orden.

   Solo se pinta si el perfil tiene el negocio activado: sin negocio no hay
   nada que separar y la pantalla no crece. */

import { pastillas } from './pastillas.js';

export const AMBITOS = [['', 'Todo'], ['personal', 'Personal'], ['negocio', 'Negocio']];
const CLAVE = 'finanzas.ambito';

export function ambitoGuardado() {
  const guardado = localStorage.getItem(CLAVE) || '';
  return AMBITOS.some(([valor]) => valor === guardado) ? guardado : '';
}

export function guardarAmbito(valor) {
  localStorage.setItem(CLAVE, valor);
}

export function pastillasAmbito(valor) {
  return pastillas({ opciones: AMBITOS, valor, compactas: true });
}

/** Los movimientos viejos no tienen la columna: son personales. */
export function esDelAmbito(mov, ambito) {
  return !ambito || (mov.ambito ?? 'personal') === ambito;
}

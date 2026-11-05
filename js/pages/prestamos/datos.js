/* Carga los préstamos y sus abonos y los resume. Lo usan la pantalla de
   Préstamos y el Resumen. Sin la función en el plan no pide nada. */

import { resumenPrestamos } from '../../calc/prestamos.js';

export function tienePrestamos(contexto) {
  return contexto.funciones?.includes('prestamos') ?? false;
}

/** @returns { resumen, prestamos, abonos } o null si el plan no los incluye */
export async function cargarPrestamos(contexto, hoy) {
  if (!tienePrestamos(contexto)) return null;
  const [prestamos, abonos] = await Promise.all([
    contexto.prestamos.listar(), contexto.prestamos.abonos(),
  ]);
  return { resumen: resumenPrestamos(prestamos, abonos, hoy), prestamos, abonos };
}

/* Piezas de un aviso del banco: limpiar el texto y leer montos y fechas.
   Función PURA: sin red, sin DOM.

   Cada banco escribe montos y fechas a su manera ("USD23.98", "$ 150.00",
   "26/08/2026 03:21:28 P.M.", "07/10/26 a las 14:02:43"), y a veces corta
   los segundos ("03:14:0 P.M."). Todo eso se resuelve aquí, una sola vez. */

import { aISO, ultimoDiaDelMes } from '../fechas.js';
import { redondear } from '../dinero.js';

/** Sin acentos y con un solo espacio entre palabras: así se compara. */
export function limpiar(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim();
}

/* Primero con separador de miles, para que "1,234.50" no se lea como "1". */
export const PATRON_MONTO = '\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?';

/* Fecha con hora opcional. Los segundos pueden venir cortados o no venir. */
export const PATRON_FECHA = '\\d{2,4}[-/]\\d{1,2}[-/]\\d{2,4}'
  + '(?:\\s+(?:a\\s+las\\s+)?\\d{1,2}:\\d{2}(?::\\d{0,2})?(?:\\s*[ap]\\.?\\s?m\\.?)?)?';

/** '1,234.50' → 1234.5. Cero o algo que no es número → null. */
export function aMonto(texto) {
  const n = Number(String(texto ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? redondear(n) : null;
}

/* 12 P.M. es mediodía y 12 A.M. medianoche. */
function hora24(hora, minutos, meridiano) {
  let h = hora;
  if (meridiano === 'p' && h < 12) h += 12;
  if (meridiano === 'a' && h === 12) h = 0;
  return h > 23 ? null : `${String(h).padStart(2, '0')}:${minutos}`;
}

/* El orden de las partes lo dice el largo de la primera: 2026-08-27 o 27/08/26. */
function ordenar(a, b, c) {
  if (a.length === 4) return { anio: Number(a), mes: Number(b), dia: Number(c) };
  const anio = c.length === 2 ? 2000 + Number(c) : Number(c);
  return { anio, mes: Number(b), dia: Number(a) };
}

/** Cualquier fecha de aviso → { fecha: 'YYYY-MM-DD', hora: 'HH:MM' | null }, o null. */
export function leerFecha(texto) {
  const m = new RegExp('(\\d{2,4})[-/](\\d{1,2})[-/](\\d{2,4})'
    + '(?:\\s+(?:a\\s+las\\s+)?(\\d{1,2}):(\\d{2})(?::\\d{0,2})?(?:\\s*([ap])\\.?\\s?m)?)?', 'i')
    .exec(String(texto ?? ''));
  if (!m) return null;
  const { anio, mes, dia } = ordenar(m[1], m[2], m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > ultimoDiaDelMes(anio, mes)) return null;
  const hora = m[4] === undefined ? null : hora24(Number(m[4]), m[5], m[6]?.toLowerCase());
  return { fecha: aISO(anio, mes, dia), hora };
}

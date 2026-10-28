/* Leer un aviso del banco (SMS, correo…): qué dice, sin decidir todavía qué
   movimiento es. Función PURA: sin red, sin DOM.

   Primero las plantillas del usuario —pueden corregir una de fábrica que el
   banco cambió—, luego las de fábrica. Si ninguna sirve, se adivina lo que se
   pueda para que el aviso llegue con algo puesto y no se pierda. */

import { limpiar, aMonto, leerFecha, PATRON_MONTO, PATRON_FECHA } from './partes.js';
import { leerConPlantilla } from './plantilla.js';
import { DE_FABRICA } from './fabrica.js';

/* Un aviso es corto; esto solo evita trabajar de más con texto basura. */
const MAX_TEXTO = 1000;

const MONTO_SUELTO = new RegExp(`(?:USD|\\$)\\s*(${PATRON_MONTO})`, 'i');
const FECHA_SUELTA = new RegExp(PATRON_FECHA, 'i');
const ULTIMOS_SUELTOS = /(?:tarjeta|cuenta|visa|mastercard)\D{0,25}?X*(\d{4})(?!\d)/i;

/** Lo que se puede sacar de un aviso que ninguna plantilla reconoce. */
function adivinar(limpio) {
  const cuando = leerFecha(FECHA_SUELTA.exec(limpio)?.[0]);
  return {
    reconocido: false,
    monto: aMonto(MONTO_SUELTO.exec(limpio)?.[1]),
    fecha: cuando?.fecha ?? null,
    hora: cuando?.hora ?? null,
    ultimos: ULTIMOS_SUELTOS.exec(limpio)?.[1] ?? null,
  };
}

/**
 * @param texto   el aviso tal como llegó
 * @param propias plantillas que enseñó el usuario
 * @returns { reconocido: true, plantilla, banco, sentido, monto, fecha, hora,
 *            origen, destino, contraparte, referencia }
 *       o  { reconocido: false, monto, fecha, hora, ultimos }
 */
export function leerAviso(texto, propias = []) {
  const limpio = limpiar(texto).slice(0, MAX_TEXTO);
  for (const plantilla of [...propias, ...DE_FABRICA]) {
    const leido = leerConPlantilla(limpio, plantilla);
    if (leido) return leido;
  }
  return adivinar(limpio);
}

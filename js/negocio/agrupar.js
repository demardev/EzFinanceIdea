/* Colapsa los movimientos de una operación en una sola fila. Función PURA.

   Se agrupa por operación Y FECHA, no solo por operación: si pagaste el día 1
   y te cobraron el día 8, son dos cosas que pasaron en dos días distintos y en
   una lista ordenada por día tienen que salir separadas. */

import { redondear } from '../calc/dinero.js';

function filaSuelta(movimiento) {
  return { grupo: false, movimiento, fecha: movimiento.fecha, neto: 0 };
}

function filaGrupo(pagoId, fecha, movs) {
  const neto = movs.reduce(
    (n, m) => n + (m.tipo === 'ingreso' ? Number(m.monto) : -Number(m.monto)), 0);
  return {
    grupo: true,
    pagoId,
    fecha,
    movimientos: movs,
    neto: redondear(neto),
    incluyeEgreso: movs.some((m) => m.tipo === 'egreso'),
  };
}

/**
 * @returns filas en el mismo orden en que venían los movimientos; cada una es
 *          un movimiento suelto o el resumen de una operación en un día.
 */
export function agruparOperaciones(movimientos) {
  const filas = [];
  const grupos = new Map();

  movimientos.forEach((m) => {
    if (!m.pago_id) {
      filas.push(filaSuelta(m));
      return;
    }
    const clave = `${m.pago_id}|${m.fecha}`;
    if (!grupos.has(clave)) {
      const lista = [];
      grupos.set(clave, lista);
      filas.push({ marcador: clave, pagoId: m.pago_id, fecha: m.fecha, lista });
    }
    grupos.get(clave).push(m);
  });

  return filas.map((f) => (f.marcador ? filaGrupo(f.pagoId, f.fecha, f.lista) : f));
}

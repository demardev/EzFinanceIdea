/* Repositorio de préstamos: lo que debes y lo que te deben. Mismo contrato
   que los demás. La base solo los deja ver si tu plan tiene la función
   (tiene_funcion('prestamos')): sin ella esto devuelve listas vacías. */

import { crearRepo } from './base.js';

export function repoPrestamos(cliente) {
  const base = crearRepo(cliente, 'prestamos', { orden: 'created_at.asc' });

  /** Los abonos de todos los préstamos: movimientos normales con prestamo_id.
      Solo lo que hace falta para sumar; son pocas filas. */
  function abonos() {
    return cliente.seleccionar('movimientos', {
      select: 'id,prestamo_id,monto,fecha,tipo,descripcion',
      prestamo_id: 'not.is.null', order: 'fecha.desc',
    });
  }

  return { ...base, abonos };
}

/* Repositorio de préstamos: lo que debes y lo que te deben. Mismo contrato
   que los demás. La base solo los deja ver si tu plan tiene la función
   (tiene_funcion('prestamos')): sin ella esto devuelve listas vacías. */

import { crearRepo } from './base.js';

const MAX_CANDIDATOS = 200;

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

  /** Movimientos ya hechos que se pueden ligar: del tipo que toca, sueltos
      (sin préstamo) y que no sean del negocio, que esos no se tocan uno a uno. */
  function candidatos(tipo, desde) {
    return cliente.seleccionar('movimientos', {
      select: 'id,monto,fecha,descripcion', tipo: `eq.${tipo}`, fecha: `gte.${desde}`,
      prestamo_id: 'is.null', pago_id: 'is.null', ambito: 'eq.personal',
      order: 'fecha.desc,created_at.desc', limit: String(MAX_CANDIDATOS),
    });
  }

  /** Liga varios de un viaje. */
  function ligar(ids, prestamoId) {
    return cliente.actualizar('movimientos', { id: `in.(${ids.join(',')})` },
                              { prestamo_id: prestamoId });
  }

  /** El movimiento se queda: solo deja de contar para el préstamo. */
  function desligar(id) {
    return cliente.actualizar('movimientos', { id: `eq.${id}` }, { prestamo_id: null });
  }

  return { ...base, abonos, candidatos, ligar, desligar };
}

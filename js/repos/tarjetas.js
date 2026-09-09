/* Repositorio de tarjetas. Mismo contrato que los demás.
   La pantalla de Tarjetas llega en el paso siguiente; aquí se usa para que
   el formulario de movimientos pueda ofrecerlas como origen o destino. */

import { crearRepo } from './base.js';

export function repoTarjetas(cliente) {
  const base = crearRepo(cliente, 'tarjetas', { orden: 'orden.asc' });

  function listarActivas() {
    return base.listar({ archivada: 'eq.false' });
  }

  return { ...base, listarActivas };
}

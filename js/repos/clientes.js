/* Repositorio de clientes del negocio. Mismo contrato que los demás.
   La base solo deja verlos con la bandera del negocio encendida. */

import { crearRepo } from './base.js';

export function repoClientes(cliente) {
  const base = crearRepo(cliente, 'clientes', { orden: 'nombre.asc', cachear: true });

  /** Los que se ofrecen al registrar: sin archivar. */
  function listarActivos() {
    return base.listar({ archivado: 'eq.false' });
  }

  return { ...base, listarActivos };
}

/* Repositorio de categorías. Mismo contrato que los demás.
   Una categoría pertenece a UN tipo de movimiento; de ahí listarPorTipo. */

import { crearRepo } from './base.js';

export function repoCategorias(cliente) {
  const base = crearRepo(cliente, 'categorias', { orden: 'orden.asc' });

  function listarActivas() {
    return base.listar({ archivada: 'eq.false' });
  }

  function listarPorTipo(tipo) {
    return base.listar({ tipo: `eq.${tipo}`, archivada: 'eq.false' });
  }

  return { ...base, listarActivas, listarPorTipo };
}

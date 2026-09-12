/* Repositorio de items del plan: ingresos y gastos, fijos y variables.
   Es lo que alimenta el planificador. Mismo contrato que los demás. */

import { crearRepo } from './base.js';

export function repoPlanItems(cliente) {
  const base = crearRepo(cliente, 'plan_items', { orden: 'orden.asc', cachear: true });

  /** Solo los activos: los pausados no entran al plan. */
  function listarActivos() {
    return base.listar({ activo: 'eq.true' });
  }

  return { ...base, listarActivos };
}

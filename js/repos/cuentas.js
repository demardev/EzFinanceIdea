/* Repositorio de cuentas. Mismo contrato que los demás, más lo propio de
   esta entidad. La vista nunca llama a client.js: llama aquí. */

import { crearRepo } from './base.js';

export function repoCuentas(cliente) {
  const base = crearRepo(cliente, 'cuentas', { orden: 'orden.asc', cachear: true });

  /** Las que se muestran en la app: sin archivar. */
  function listarActivas() {
    return base.listar({ archivada: 'eq.false' });
  }

  /** Siembra cuentas y categorías por defecto la primera vez. Idempotente. */
  function sembrarIniciales() {
    return cliente.rpc('sembrar_datos_iniciales');
  }

  return { ...base, listarActivas, sembrarIniciales };
}

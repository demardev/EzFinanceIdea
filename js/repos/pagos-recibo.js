/* Repositorio de pagos de recibo. Mismo contrato que los demás.

   Crear la operación NO crea sus movimientos: eso lo coordina
   pages/negocio/acciones.js, igual que pasa con las compras a cuotas. */

import { crearRepo } from './base.js';

export function repoPagosRecibo(cliente) {
  const base = crearRepo(cliente, 'pagos_recibo', { orden: 'fecha_pago.desc' });

  /** Lo que pagaste y todavía no te devuelven. */
  function listarPendientes() {
    return base.listar({ fecha_cobro: 'is.null' });
  }

  return { ...base, listarPendientes };
}

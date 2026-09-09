/* Repositorio de compras a cuotas. Mismo contrato que los demás.

   Ojo: crear una compra NO crea sus cuotas. Las cuotas son movimientos y los
   genera calc/cuotas.js; quien orquesta las dos cosas es la página. */

import { crearRepo } from './base.js';

export function repoCompras(cliente) {
  const base = crearRepo(cliente, 'compras_cuotas', { orden: 'fecha_compra.desc' });

  function listarDeTarjeta(tarjetaId) {
    return base.listar({ tarjeta_id: `eq.${tarjetaId}` });
  }

  return { ...base, listarDeTarjeta };
}

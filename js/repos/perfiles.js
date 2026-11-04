/* Perfil del usuario: las banderas (negocio, admin, premium) y las
   preferencias del negocio.

   Las banderas son de solo lectura desde la app — la base tiene permisos por
   columna que solo dejan actualizar las preferencias. Se cambian desde el
   panel de admin (repos/admin.js) o desde el SQL Editor. */

import { crearRepo } from './base.js';

const SIN_NEGOCIO = { negocio: false, admin: false, premium_hasta: null, cuenta_pago_id: null,
                      cuenta_cobro_id: null, comision_default: 0 };

export function repoPerfiles(cliente) {
  const base = crearRepo(cliente, 'perfiles', { orden: 'created_at.asc' });

  /** Si no hay fila, el usuario simplemente no tiene el negocio activado. */
  async function mio() {
    const filas = await base.listar({ limit: '1' });
    return filas?.[0] ?? { ...SIN_NEGOCIO };
  }

  /** Solo preferencias: mandar `negocio` aquí lo rechazaría Postgres. */
  function guardarPreferencias(userId, cambios) {
    return cliente.actualizar('perfiles', { user_id: `eq.${userId}` }, cambios);
  }

  return { ...base, mio, guardarPreferencias };
}

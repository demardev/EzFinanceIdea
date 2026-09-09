/* Perfil del usuario: la bandera del negocio y sus preferencias.

   `negocio` es de solo lectura desde la app — la base tiene permisos por
   columna que solo dejan actualizar las preferencias. Se enciende con un
   update desde el SQL Editor. */

import { crearRepo } from './base.js';

const SIN_NEGOCIO = { negocio: false, cuenta_pago_id: null,
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

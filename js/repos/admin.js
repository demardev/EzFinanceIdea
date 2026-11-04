/* El panel de admin. No es una tabla sino cuatro funciones de la base
   (sql/07_admin.sql) y una Edge Function (supabase/functions/administrar),
   y todas revisan que quien llama sea admin: aunque alguien llame esto a
   mano, se rechaza. */

export function repoAdmin(cliente) {
  return {
    /** Todos los usuarios con su plan, negocio y bloqueo. */
    usuarios: () => cliente.rpc('admin_usuarios'),

    /** `hasta` null le quita el premium. */
    ponerPremium: (id, hasta) =>
      cliente.rpc('admin_poner_premium', { p_usuario: id, p_hasta: hasta }),

    ponerNegocio: (id, activo) =>
      cliente.rpc('admin_poner_negocio', { p_usuario: id, p_activo: activo }),

    bloquear: (id, bloquear) =>
      cliente.rpc('admin_bloquear', { p_usuario: id, p_bloquear: bloquear }),

    /** Para siempre: la cuenta en Auth (todo se va en cascada) y sus fotos. */
    eliminar: (id) => cliente.funcion('administrar', { accion: 'eliminar', user_id: id }),
  };
}

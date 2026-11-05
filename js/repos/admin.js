/* El panel de admin. No es una tabla sino funciones de la base
   (sql/07_admin.sql, sql/11_planes_prestamos.sql) y una Edge Function
   (supabase/functions/administrar), y todas revisan que quien llama sea admin
   y haya puesto su PIN hace menos de 30 minutos: aunque alguien llame esto a
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

    /** 'ok' | 'incorrecto' | 'bloqueado' | 'sin_pin' | 'no_admin' */
    entrar: (pin) => cliente.rpc('admin_entrar', { p_pin: pin }),

    /** Crear el PIN (actual null) o cambiarlo. Mismas respuestas que entrar. */
    ponerPin: (actual, nuevo) => cliente.rpc('admin_poner_pin', { p_actual: actual, p_nuevo: nuevo }),

    salir: () => cliente.rpc('admin_salir'),

    /** [{ clave, nombre, funciones: ['prestamos'] }] */
    planes: () => cliente.rpc('admin_planes'),

    /** [{ clave, nombre, descripcion }] */
    funciones: () => cliente.rpc('admin_funciones'),

    ponerFuncion: (plan, funcion, activa) =>
      cliente.rpc('admin_poner_funcion', { p_plan: plan, p_funcion: funcion, p_activa: activa }),

    /** Para siempre: la cuenta en Auth (todo se va en cascada) y sus fotos. */
    eliminar: (id) => cliente.funcion('administrar', { accion: 'eliminar', user_id: id }),
  };
}

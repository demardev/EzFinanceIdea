/* Suscripciones push en la base (sql/08_push.sql) y la Edge Function que
   manda los avisos (supabase/functions/avisar). */

export function repoPush(cliente) {
  return {
    /** Si el endpoint ya era de otra cuenta en este teléfono, pasa a la tuya. */
    guardar: ({ endpoint, p256dh, auth }, dispositivo) =>
      cliente.rpc('guardar_suscripcion_push', {
        p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth, p_dispositivo: dispositivo,
      }),

    quitar: (endpoint) => cliente.eliminar('suscripciones_push', { endpoint: `eq.${endpoint}` }),

    /** @returns { entregadas, dispositivos } */
    probar: () => cliente.funcion('avisar', { accion: 'prueba' }),
  };
}

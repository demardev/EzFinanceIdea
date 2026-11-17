/* Asistente de tarjetas (premium, sql/15_asistente_tarjetas.sql): la Edge
   Function que lee estados de cuenta con IA (supabase/functions/leer-estado). */

export function repoAsistente(cliente) {
  return {
    /**
     * @param archivo el documento en base64, sin el prefijo "data:…;base64,"
     * @param tipo    'application/pdf', 'image/png', 'image/jpeg', 'image/webp' o 'text/plain'
     * @returns { lectura, quedan: { hoy, mes } } — lectura ya limpia (calc/estado-cuenta.js)
     */
    leerEstado: (archivo, tipo) => cliente.funcion('leer-estado', { archivo, tipo }),
  };
}

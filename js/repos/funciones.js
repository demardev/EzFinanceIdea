/* Qué funciones trae el plan del usuario (sql/11_planes_prestamos.sql).
   Solo decide qué se MUESTRA: quien protege los datos es la base. */

export function repoFunciones(cliente) {
  return {
    /** ['prestamos', …]. Si falla (sin el SQL, sin red) no hay ninguna. */
    async mias() {
      try {
        const filas = await cliente.rpc('mis_funciones');
        return (filas ?? []).map((f) => (typeof f === 'string' ? f : Object.values(f)[0]));
      } catch { return []; }
    },
  };
}

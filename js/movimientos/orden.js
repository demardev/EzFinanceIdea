/* Orden de la lista de movimientos. Función PURA: sin red, sin DOM, sin imports.

   El desempate importa: `fecha` es solo la fecha, sin hora, así que dos
   movimientos del mismo día quedarían en orden arbitrario. Se desempata por
   `created_at`, que sí lleva hora, para que lo último que registraste salga
   primero. */

export const DIRECCIONES = {
  desc: { etiqueta: 'Más reciente primero', icono: 'orden-desc' },
  asc:  { etiqueta: 'Más antiguo primero',  icono: 'orden-asc' },
};

function comparar(a, b) {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
  const ca = a.created_at ?? '';
  const cb = b.created_at ?? '';
  if (ca !== cb) return ca < cb ? -1 : 1;
  return 0;
}

/** @param direccion 'desc' (lo último primero) | 'asc' */
export function ordenarPorFecha(movimientos, direccion = 'desc') {
  const signo = direccion === 'asc' ? 1 : -1;
  return [...movimientos].sort((a, b) => comparar(a, b) * signo);
}

export function direccionOpuesta(direccion) {
  return direccion === 'asc' ? 'desc' : 'asc';
}

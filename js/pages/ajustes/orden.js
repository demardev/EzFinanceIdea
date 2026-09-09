/* Reordenar: intercambia dos vecinos y persiste el nuevo `orden`.
   Sirve para cuentas y categorías porque ambas tablas tienen la columna.

   Calcula el plan completo ANTES de escribir: si se leyera `orden` de los
   objetos mientras se actualizan, el segundo vecino leería el valor ya
   modificado y los dos acabarían con el mismo número. */

/**
 * @param repo      cualquier repo con actualizar()
 * @param lista     el arreglo tal como se está mostrando (ya ordenado)
 * @param id        el elemento que se mueve
 * @param direccion 'arriba' | 'abajo'
 * @returns true si hubo movimiento
 */
export async function mover(repo, lista, id, direccion) {
  const desde = lista.findIndex((x) => x.id === id);
  const hasta = direccion === 'arriba' ? desde - 1 : desde + 1;
  if (desde < 0 || hasta < 0 || hasta >= lista.length) return false;

  const reordenada = [...lista];
  [reordenada[desde], reordenada[hasta]] = [reordenada[hasta], reordenada[desde]];

  /* Renumerar por posición (1..n) también repara listas con `orden`
     duplicado o en cero, que es como llegan si se sembraron a mano. */
  const cambios = reordenada
    .map((x, i) => ({ id: x.id, orden: i + 1, actual: x.orden }))
    .filter((c) => c.actual !== c.orden);

  await Promise.all(cambios.map((c) => repo.actualizar(c.id, { orden: c.orden })));
  return true;
}

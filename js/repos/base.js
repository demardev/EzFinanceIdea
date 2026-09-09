/* El contrato que comparten TODOS los repositorios: listar / obtener / crear /
   actualizar / eliminar. Uno es intercambiable por otro (y por uno en memoria
   en las pruebas) porque todos tienen exactamente esta forma.

   El cliente se PASA, no se importa: el repo no sabe que existe Supabase. */

/**
 * @param cliente   el objeto de api/client.js (o un doble en pruebas)
 * @param tabla     nombre de la tabla en Postgres
 * @param opciones  { orden: 'orden.asc' } criterio por defecto al listar
 */
export function crearRepo(cliente, tabla, { orden = 'created_at.desc' } = {}) {
  async function listar(filtros = {}) {
    return cliente.seleccionar(tabla, { order: orden, ...filtros });
  }

  async function obtener(id) {
    const filas = await cliente.seleccionar(tabla, { id: `eq.${id}`, limit: '1' });
    return filas?.[0] ?? null;
  }

  async function crear(datos) {
    const filas = await cliente.insertar(tabla, [datos]);
    return filas?.[0] ?? null;
  }

  async function actualizar(id, cambios) {
    const filas = await cliente.actualizar(tabla, { id: `eq.${id}` }, cambios);
    return filas?.[0] ?? null;
  }

  async function eliminar(id) {
    await cliente.eliminar(tabla, { id: `eq.${id}` });
    return true;
  }

  return { listar, obtener, crear, actualizar, eliminar };
}

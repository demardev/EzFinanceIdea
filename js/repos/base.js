/* El contrato que comparten TODOS los repositorios: listar / obtener / crear /
   actualizar / eliminar. Uno es intercambiable por otro (y por uno en memoria
   en las pruebas) porque todos tienen exactamente esta forma.

   El cliente se PASA, no se importa: el repo no sabe que existe Supabase. */

/**
 * @param cliente   el objeto de api/client.js (o un doble en pruebas)
 * @param tabla     nombre de la tabla en Postgres
 * @param opciones  { orden: 'orden.asc' } criterio por defecto al listar
 */
export function crearRepo(cliente, tabla, { orden = 'created_at.desc', cachear = false } = {}) {
  /* Los catálogos —cuentas, categorías, tarjetas, fijos— se piden en CADA
     navegación y casi nunca cambian, así que se guardan mientras dure la
     sesión y se tiran al primer cambio propio. Los movimientos no se cachean:
     ahí un dato viejo es un saldo equivocado. */
  const memoria = new Map();

  /** Tira lo guardado. Lo usa también quien escribe sin pasar por aquí. */
  function olvidar() {
    memoria.clear();
  }

  async function listar(filtros = {}) {
    const consulta = { order: orden, ...filtros };
    if (!cachear) return cliente.seleccionar(tabla, consulta);

    const clave = JSON.stringify(consulta);
    if (!memoria.has(clave)) {
      /* Se guarda la promesa y no el resultado: dos pantallas que pidan a la
         vez comparten una sola petición. Si falla, no se queda guardada. */
      memoria.set(clave, cliente.seleccionar(tabla, consulta)
        .catch((error) => { memoria.delete(clave); throw error; }));
    }
    /* Copia: quien ordene o recorte la lista no toca lo guardado. */
    return [...(await memoria.get(clave))];
  }

  async function obtener(id) {
    const filas = await cliente.seleccionar(tabla, { id: `eq.${id}`, limit: '1' });
    return filas?.[0] ?? null;
  }

  async function crear(datos) {
    try {
      const filas = await cliente.insertar(tabla, [datos]);
      return filas?.[0] ?? null;
    } finally { olvidar(); }          // también si falló a medias
  }

  async function actualizar(id, cambios) {
    try {
      const filas = await cliente.actualizar(tabla, { id: `eq.${id}` }, cambios);
      return filas?.[0] ?? null;
    } finally { olvidar(); }
  }

  async function eliminar(id) {
    try {
      await cliente.eliminar(tabla, { id: `eq.${id}` });
      return true;
    } finally { olvidar(); }
  }

  return { listar, obtener, crear, actualizar, eliminar, olvidar };
}

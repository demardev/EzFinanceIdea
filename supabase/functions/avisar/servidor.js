/* La base desde la función, con la llave de servicio: se salta las políticas.
   Por eso lo que leen los repos pasa por clienteDeUsuario(), que amarra CADA
   consulta a un usuario (user_id=eq.<id>) y no deja escribir nada. */

const URL_BASE = Deno.env.get('SUPABASE_URL');
const SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

/* Igual que js/api/client.js: un arreglo repite la columna (fecha=gte…&fecha=lte…). */
function consulta(filtros) {
  const pares = [];
  for (const [clave, valor] of Object.entries(filtros)) {
    for (const uno of Array.isArray(valor) ? valor : [valor]) pares.push([clave, uno]);
  }
  return `?${new URLSearchParams(pares)}`;
}

async function rest(ruta, opciones = {}) {
  const respuesta = await fetch(`${URL_BASE}/rest/v1/${ruta}`, {
    ...opciones,
    headers: { apikey: SERVICIO, Authorization: `Bearer ${SERVICIO}`,
               'Content-Type': 'application/json', ...opciones.headers },
  });
  if (!respuesta.ok) {
    const error = new Error(`${opciones.method ?? 'GET'} ${ruta.split('?')[0]} → ${respuesta.status}`);
    error.estado = respuesta.status;
    throw error;
  }
  return respuesta.status === 204 ? null : respuesta.json();
}

/** El `cliente` que esperan los repos de la app, de solo lectura y de un solo usuario. */
export function clienteDeUsuario(userId) {
  const soloLectura = () => { throw new Error('La función de avisos solo lee.'); };
  return {
    seleccionar: (tabla, filtros = {}) =>
      rest(`${tabla}${consulta({ select: '*', ...filtros, user_id: `eq.${userId}` })}`),
    insertar: soloLectura, actualizar: soloLectura, eliminar: soloLectura, rpc: soloLectura,
  };
}

/** Todas las suscripciones, o las de un usuario. */
export function suscripciones(userId) {
  const filtro = userId ? { user_id: `eq.${userId}` } : {};
  return rest(`suscripciones_push${consulta({ select: 'id,user_id,endpoint,p256dh,auth', ...filtro })}`);
}

export function borrarSuscripcion(id) {
  return rest(`suscripciones_push?id=eq.${id}`, { method: 'DELETE' });
}

/* Las llamadas internas (el cron de las 8 pm y el disparador de la bandeja)
   traen un secreto que vive en `config_privada`, una tabla sin políticas:
   solo la leen la base misma y esta llave de servicio. */
export async function secretoValido(recibido) {
  if (!recibido) return false;
  const [fila] = await rest('config_privada?clave=eq.avisos_secreto&select=valor');
  return Boolean(fila) && fila.valor === recibido;
}

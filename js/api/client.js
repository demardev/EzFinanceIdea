/* ÚNICO archivo que sabe que existe Supabase y el ÚNICO que hace fetch.
   Si algún día cambio de backend, se toca este archivo y nada más.
   - datos     -> PostgREST  /rest/v1
   - auth      -> GoTrue     /auth/v1
   - funciones -> RPC        /rest/v1/rpc */

import { urlBase, ANON_KEY } from '../config.js';
import { traducirError, errorApi } from './errores.js';

const REST = `${urlBase()}/rest/v1`;
const AUTH = `${urlBase()}/auth/v1`;

function cabeceras(token, extra) {
  return {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${token || ANON_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

/** Hace la petición y normaliza la respuesta. Todo lo demás pasa por aquí. */
async function enviar(url, opciones) {
  let respuesta;
  try {
    respuesta = await fetch(url, opciones);
  } catch {
    throw errorApi(traducirError(0, null), 0);
  }
  if (respuesta.status === 204) return null;

  const texto = await respuesta.text();
  let cuerpo = null;
  try { cuerpo = texto ? JSON.parse(texto) : null; } catch { cuerpo = { message: texto }; }

  if (!respuesta.ok) {
    // El detalle crudo queda en consola; en pantalla va el mensaje en español.
    console.error(`[api] ${opciones.method} ${url} → ${respuesta.status}`, cuerpo);
    throw errorApi(traducirError(respuesta.status, cuerpo), respuesta.status);
  }
  return cuerpo;
}

/** Endpoints de GoTrue. Los usa api/sesion.js; nadie más debería llamarlo. */
export function peticionAuth(ruta, { cuerpo, token } = {}) {
  return enviar(`${AUTH}${ruta}`, {
    method: 'POST',
    headers: cabeceras(token),
    body: JSON.stringify(cuerpo ?? {}),
  });
}

/* Un valor puede ser un arreglo para repetir la misma columna:
   { fecha: ['gte.2026-09-01', 'lte.2026-09-30'] } -> ?fecha=gte...&fecha=lte... */
function consulta(filtros) {
  const pares = [];
  for (const [clave, valor] of Object.entries(filtros)) {
    for (const uno of Array.isArray(valor) ? valor : [valor]) pares.push([clave, uno]);
  }
  const texto = new URLSearchParams(pares).toString();
  return texto ? `?${texto}` : '';
}

/**
 * Cliente de datos. Recibe cómo conseguir el token (no lo importa) para no
 * amarrarse a api/sesion.js. Es lo que se le pasa a cada repositorio.
 */
export function crearClienteDatos(obtenerToken) {
  async function llamar(ruta, method, cuerpo, prefer) {
    const token = await obtenerToken();
    const opciones = { method, headers: cabeceras(token, prefer ? { Prefer: prefer } : undefined) };
    if (cuerpo !== undefined) opciones.body = JSON.stringify(cuerpo);
    return enviar(`${REST}${ruta}`, opciones);
  }

  return {
    /** filtros al estilo PostgREST: { select:'*', archivada:'eq.false', order:'orden.asc' } */
    seleccionar(tabla, filtros = {}) {
      return llamar(`/${tabla}${consulta({ select: '*', ...filtros })}`, 'GET');
    },
    /* `fusionar` hace upsert por llave primaria: reimportar un respaldo no
       duplica nada. */
    insertar(tabla, filas, { fusionar = false } = {}) {
      const prefer = fusionar
        ? 'return=representation,resolution=merge-duplicates'
        : 'return=representation';
      return llamar(`/${tabla}`, 'POST', filas, prefer);
    },
    actualizar(tabla, filtros, cambios) {
      return llamar(`/${tabla}${consulta(filtros)}`, 'PATCH', cambios, 'return=representation');
    },
    eliminar(tabla, filtros) {
      return llamar(`/${tabla}${consulta(filtros)}`, 'DELETE', undefined, 'return=minimal');
    },
    rpc(funcion, args = {}) {
      return llamar(`/rpc/${funcion}`, 'POST', args);
    },
  };
}

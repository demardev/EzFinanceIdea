/* ÚNICO archivo que sabe que existe Supabase y el ÚNICO que hace fetch.
   Si algún día cambio de backend, se toca este archivo y nada más.
   - datos     -> PostgREST  /rest/v1
   - auth      -> GoTrue     /auth/v1
   - funciones -> RPC        /rest/v1/rpc */

import { urlBase, ANON_KEY } from '../config.js';
import { traducirError, errorApi } from './errores.js';

const REST = `${urlBase()}/rest/v1`;
const AUTH = `${urlBase()}/auth/v1`;
const ALMACEN = `${urlBase()}/storage/v1`;

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

/* ------------------------------------------------------------- archivos --- */

/** Como enviar(), pero para bytes: no intenta interpretar la respuesta. */
async function enviarArchivo(url, opciones) {
  let respuesta;
  try {
    respuesta = await fetch(url, opciones);
  } catch {
    throw errorApi(traducirError(0, null), 0);
  }
  if (respuesta.ok) return respuesta;

  /* El error sí viene en JSON; el contenido bueno es el que es binario. */
  let cuerpo = null;
  try { cuerpo = await respuesta.json(); } catch { /* da igual */ }
  console.error(`[almacén] ${opciones.method} ${url} → ${respuesta.status}`, cuerpo);
  throw errorApi(traducirError(respuesta.status, cuerpo), respuesta.status);
}

/**
 * Archivos en Supabase Storage. Recibe cómo conseguir el token, igual que el
 * cliente de datos, y por eso tampoco se amarra a api/sesion.js.
 *
 * Las rutas son "<uuid del usuario>/<archivo>": así lo exige la política del
 * bucket, que corta por esa primera carpeta.
 */
export function crearClienteAlmacen(obtenerToken) {
  async function cabecerasArchivo(extra) {
    const token = await obtenerToken();
    return { apikey: ANON_KEY, Authorization: `Bearer ${token || ANON_KEY}`, ...extra };
  }

  return {
    /** @returns la ruta con la que quedó guardado */
    async subir(bucket, ruta, blob) {
      await enviarArchivo(`${ALMACEN}/object/${bucket}/${ruta}`, {
        method: 'POST',
        headers: await cabecerasArchivo({ 'Content-Type': blob.type, 'x-upsert': 'true' }),
        body: blob,
      });
      return ruta;
    },

    /** @returns un Blob; el bucket es privado, así que va con el token.
        Sin cache: cambiar la foto la sube a la MISMA ruta, y el navegador
        seguiría mostrando la vieja durante la hora que Storage le permite. */
    async descargar(bucket, ruta) {
      const respuesta = await enviarArchivo(
        `${ALMACEN}/object/authenticated/${bucket}/${ruta}`,
        { method: 'GET', headers: await cabecerasArchivo(), cache: 'no-store' });
      return respuesta.blob();
    },

    async borrar(bucket, ruta) {
      await enviarArchivo(`${ALMACEN}/object/${bucket}/${ruta}`,
        { method: 'DELETE', headers: await cabecerasArchivo() });
      return true;
    },
  };
}

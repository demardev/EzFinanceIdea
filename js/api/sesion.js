/* Login, logout, refresh y persistencia del token. No hace fetch: se apoya
   en peticionAuth() de client.js. Guarda en localStorage para no volver a
   loguearse cada día. */

import { peticionAuth } from './client.js';

const CLAVE = 'finanzas.sesion';
const MARGEN_SEG = 60;          // refresca un minuto antes de que expire

let sesion = leerDelDisco();
let refrescando = null;         // evita dos refreshes simultáneos
let alInvalidarse = () => {};

function leerDelDisco() {
  try { return JSON.parse(localStorage.getItem(CLAVE)) || null; }
  catch { return null; }
}

function guardar(datos) {
  sesion = {
    access_token: datos.access_token,
    refresh_token: datos.refresh_token,
    expira_en: datos.expires_at ?? Math.floor(Date.now() / 1000) + (datos.expires_in ?? 3600),
    email: datos.user?.email ?? sesion?.email ?? '',
  };
  localStorage.setItem(CLAVE, JSON.stringify(sesion));
  return sesion;
}

function borrar() {
  sesion = null;
  localStorage.removeItem(CLAVE);
}

/** Se avisa cuando el refresh falla, para que main.js vuelva al login. */
export function enSesionInvalida(callback) {
  alInvalidarse = callback;
}

export function haySesion() {
  return Boolean(sesion?.refresh_token);
}

export function emailSesion() {
  return sesion?.email ?? '';
}

function expirado() {
  return !sesion || sesion.expira_en - MARGEN_SEG <= Math.floor(Date.now() / 1000);
}

async function refrescar() {
  try {
    const datos = await peticionAuth('/token?grant_type=refresh_token', {
      cuerpo: { refresh_token: sesion.refresh_token },
    });
    return guardar(datos).access_token;
  } catch (e) {
    borrar();
    alInvalidarse();
    throw e;
  } finally {
    refrescando = null;
  }
}

/** Lo que se le pasa a crearClienteDatos(): siempre devuelve un token usable. */
export async function tokenVigente() {
  if (!sesion) return null;
  if (!expirado()) return sesion.access_token;
  refrescando ??= refrescar();
  return refrescando;
}

export async function iniciarSesion(email, password) {
  const datos = await peticionAuth('/token?grant_type=password', {
    cuerpo: { email: email.trim(), password },
  });
  return guardar(datos);
}

export async function cerrarSesion() {
  const token = sesion?.access_token;
  borrar();
  /* Que no quede data del usuario en el cache del dispositivo. */
  navigator.serviceWorker?.controller?.postMessage('borrar-datos');
  if (!token) return;
  try { await peticionAuth('/logout', { token }); } catch { /* da igual: local ya está limpio */ }
}

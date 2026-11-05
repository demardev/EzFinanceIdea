/* Las notificaciones de ESTE dispositivo: el permiso del navegador y la
   suscripción al servicio de push. Solo APIs del navegador; guardarla en la
   base es cosa de repos/push.js. */

import { VAPID_PUBLICA } from '../config.js';

function deBase64Url(cadena) {
  const b64 = cadena.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
}

const esIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const instalada = () => matchMedia('(display-mode: standalone)').matches
                     || navigator.standalone === true;

/**
 * 'ok' | 'instalar' (iPhone desde Safari: solo funciona instalada) |
 * 'bloqueado' (el usuario dijo que no) | 'sin-soporte'
 */
export function estadoSoporte() {
  const hay = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!hay) return esIOS() && !instalada() ? 'instalar' : 'sin-soporte';
  if (Notification.permission === 'denied') return 'bloqueado';
  return 'ok';
}

export async function suscripcionActual() {
  const registro = await navigator.serviceWorker.ready;
  return registro.pushManager.getSubscription();
}

export function datosDe(suscripcion) {
  const { endpoint, keys } = suscripcion.toJSON();
  return { endpoint, p256dh: keys.p256dh, auth: keys.auth };
}

/* El permiso se pide antes de cualquier otra espera: iOS solo lo muestra si
   la llamada sale directo del toque del usuario. */
export async function suscribir() {
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') {
    throw new Error(permiso === 'denied' ? 'Bloqueaste los avisos para esta app.'
                                         : 'No diste permiso para los avisos.');
  }
  const registro = await navigator.serviceWorker.ready;
  const suscripcion = await registro.pushManager.subscribe({
    userVisibleOnly: true, applicationServerKey: deBase64Url(VAPID_PUBLICA),
  });
  return datosDe(suscripcion);
}

/** @returns el endpoint que se dio de baja, o null si no había */
export async function desuscribir() {
  const suscripcion = await suscripcionActual();
  if (!suscripcion) return null;
  await suscripcion.unsubscribe();
  return suscripcion.endpoint;
}

/** Al cerrar sesión: la suscripción de este teléfono, si la hay, sin esperar
    a `serviceWorker.ready`, que nunca resuelve si el SW no se registró. */
export async function suscripcionAlSalir() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const registro = await navigator.serviceWorker.getRegistration();
  return registro?.pushManager.getSubscription() ?? null;
}

/* Si al salir se dieron de baja, al volver a entrar se sugiere activarlos.
   Se escribe DESPUÉS de limpiar el dispositivo, que borra todo `finanzas.*`. */
const CLAVE_SOLTADOS = 'finanzas.avisos-soltados';

export function recordarAvisosSoltados() {
  try { localStorage.setItem(CLAVE_SOLTADOS, '1'); } catch { /* solo no se sugiere */ }
}

/** Se lee una sola vez: la sugerencia sale en la primera entrada y ya. */
export function tomarAvisosSoltados() {
  try {
    const habia = localStorage.getItem(CLAVE_SOLTADOS) === '1';
    localStorage.removeItem(CLAVE_SOLTADOS);
    return habia;
  } catch { return false; }
}

/** Para reconocerlo en la lista: "iPhone", "Mac", "Android"… */
export function nombreDispositivo() {
  const ua = navigator.userAgent;
  const sistemas = [['iPhone', /iPhone/], ['iPad', /iPad/], ['Android', /Android/],
                    ['Mac', /Macintosh/], ['Windows', /Windows/]];
  return sistemas.find(([, patron]) => patron.test(ua))?.[0] ?? 'Navegador';
}

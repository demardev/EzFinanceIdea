/* Lo que la app deja guardado en este dispositivo y hay que tirar cuando
   cambia quien la usa: los datos que el service worker guardó para abrir sin
   internet y las preferencias de vista (ámbito, pares separados, orden...).

   Se borra desde la página y se espera: un mensaje al service worker puede
   llegar tarde o perderse si el navegador lo duerme antes. */

const PREFIJO_PREFERENCIAS = 'finanzas.';
const PREFIJO_DATOS = 'finanzas-datos-';

/** Solo los datos cacheados de Supabase; el shell de la app se queda. */
export async function borrarDatosCacheados() {
  if (!('caches' in self)) return;
  try {
    const nombres = await caches.keys();
    await Promise.all(nombres
      .filter((n) => n.startsWith(PREFIJO_DATOS))
      .map((n) => caches.delete(n)));
  } catch { /* sin acceso al cache no hay nada que borrar */ }
}

function borrarPreferencias() {
  try {
    Object.keys(localStorage)
      .filter((clave) => clave.startsWith(PREFIJO_PREFERENCIAS))
      .forEach((clave) => localStorage.removeItem(clave));
  } catch { /* almacenamiento bloqueado: no quedó nada */ }
}

/** Todo lo del usuario que se va. */
export async function limpiarDispositivo() {
  borrarPreferencias();
  await borrarDatosCacheados();
}

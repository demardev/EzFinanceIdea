/* Service worker: hace que la app abra al instante y funcione sin internet.

   - Estáticos (HTML, CSS, JS, iconos): se sirven del cache al momento y se
     revalidan en segundo plano. Así el arranque es instantáneo y un `git push`
     se ve en la siguiente apertura, sin reinstalar nada.
   - Datos (GET a Supabase): red primero, cache como respaldo. Abrir sin
     internet muestra la última data conocida.
   - Escrituras y auth: siempre red. Nunca se cachean.

   Al cambiar el shell hay que subir VERSION: al activarse borra los caches
   viejos. */

const VERSION = 'v29';
const CACHE_SHELL = `finanzas-shell-${VERSION}`;
const CACHE_DATOS = `finanzas-datos-${VERSION}`;

/* La lista del shell vive en su propio archivo: aquí solo cabía la lógica. */
importScripts('sw-shell.js');
const SHELL = self.SHELL;

self.addEventListener('install', (evento) => {
  evento.waitUntil((async () => {
    const cache = await caches.open(CACHE_SHELL);
    /* Uno por uno: si un archivo falla, no tumba la instalación entera. */
    await Promise.allSettled(SHELL.map((ruta) => cache.add(ruta)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(nombres
      .filter((n) => n !== CACHE_SHELL && n !== CACHE_DATOS)
      .map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

/* Safari se niega a abrir la app si el service worker contesta una NAVEGACIÓN
   con una respuesta que arrastra un redirect ("the response served by the
   service worker has redirections"). Pasa cuando lo guardado en el cache vino
   de un 301. Reconstruirla la limpia: mismo cuerpo, sin la marca. */
async function sinRedirecciones(respuesta) {
  if (!respuesta?.redirected) return respuesta;
  return new Response(await respuesta.blob(), {
    status: respuesta.status, statusText: respuesta.statusText, headers: respuesta.headers,
  });
}

/** Del cache al instante; la red actualiza el cache para la próxima vez. */
async function delCacheYRevalidar(peticion) {
  const cache = await caches.open(CACHE_SHELL);
  const guardada = await cache.match(peticion);
  const enRed = fetch(peticion)
    .then(async (respuesta) => {
      /* Se limpia ANTES de guardar: así el cache nunca queda envenenado. */
      if (respuesta.ok) await cache.put(peticion, await sinRedirecciones(respuesta.clone()));
      return respuesta;
    })
    .catch(() => guardada);
  return guardada || enRed;
}

/** Red primero; si no hay internet, lo último que se guardó. */
async function redOCache(peticion) {
  const cache = await caches.open(CACHE_DATOS);
  try {
    const respuesta = await fetch(peticion);
    if (respuesta.ok) cache.put(peticion, respuesta.clone());
    return respuesta;
  } catch (error) {
    const guardada = await cache.match(peticion);
    if (guardada) return guardada;
    throw error;
  }
}

self.addEventListener('fetch', (evento) => {
  const { request } = evento;
  if (request.method !== 'GET') return;              // escrituras: siempre red

  const url = new URL(request.url);
  const mismoOrigen = url.origin === self.location.origin;

  if (mismoOrigen) {
    /* La navegación siempre cae en index.html: el router vive en el hash. */
    if (request.mode === 'navigate') {
      evento.respondWith(delCacheYRevalidar(new Request('./'))
        .then(sinRedirecciones));
      return;
    }
    evento.respondWith(delCacheYRevalidar(request));
    return;
  }

  /* Datos y fotos: red primero, cache como respaldo. Una foto ya bajada se
     vuelve a ver sin internet y sin gastar ancho de banda otra vez. */
  if (url.pathname.startsWith('/rest/v1/') || url.pathname.startsWith('/storage/v1/object/')) {
    evento.respondWith(redOCache(request));
  }
});

/* Al cerrar sesión, la app pide borrar los datos cacheados. */
self.addEventListener('message', (evento) => {
  if (evento.data === 'borrar-datos') caches.delete(CACHE_DATOS);
});

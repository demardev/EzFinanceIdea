/* Service worker: hace que la app abra al instante y funcione sin internet.

   - Estáticos (HTML, CSS, JS, iconos): se sirven del cache al momento y se
     revalidan en segundo plano. Así el arranque es instantáneo y un `git push`
     se ve en la siguiente apertura, sin reinstalar nada.
   - Datos (GET a Supabase): red primero, cache como respaldo. Abrir sin
     internet muestra la última data conocida.
   - Escrituras y auth: siempre red. Nunca se cachean.

   Al cambiar el shell hay que subir VERSION: al activarse borra los caches
   viejos. */

const VERSION = 'v6';
const CACHE_SHELL = `finanzas-shell-${VERSION}`;
const CACHE_DATOS = `finanzas-datos-${VERSION}`;

const SHELL = [
  './',
  'index.html',
  'manifest.json',
  'icons/icono-180.png',
  'icons/icono-192.png',
  'icons/icono-512.png',
  'css/base.css',
  'css/componentes.css',
  'css/listas.css',
  'css/overlays.css',
  'css/plan.css',
  'css/tokens.css',
  'js/api/client.js',
  'js/api/errores.js',
  'js/api/jwt.js',
  'js/api/sesion.js',
  'js/calc/ciclo-tarjeta.js',
  'js/calc/cuotas.js',
  'js/calc/deuda-tarjeta.js',
  'js/calc/dinero.js',
  'js/calc/fechas.js',
  'js/calc/plan/asignar.js',
  'js/calc/plan/linea-tiempo.js',
  'js/calc/plan/veredicto.js',
  'js/calc/saldos.js',
  'js/calc/vencimientos.js',
  'js/config.js',
  'js/iconos/render.js',
  'js/iconos/svg.js',
  'js/main.js',
  'js/movimientos/campos.js',
  'js/movimientos/formulario.js',
  'js/movimientos/orden.js',
  'js/movimientos/registrar.js',
  'js/movimientos/tipos.js',
  'js/negocio/agrupar.js',
  'js/negocio/pago-recibo.js',
  'js/pages/ajustes/categorias-form.js',
  'js/pages/ajustes/categorias.js',
  'js/pages/ajustes/cuentas-form.js',
  'js/pages/ajustes/cuentas.js',
  'js/pages/ajustes/datos.js',
  'js/pages/ajustes/fijos-variables.js',
  'js/pages/ajustes/index.js',
  'js/pages/ajustes/negocio.js',
  'js/pages/ajustes/orden.js',
  'js/pages/ajustes/plan-form.js',
  'js/pages/ajustes/respaldo.js',
  'js/pages/login.js',
  'js/pages/movimientos/filtros.js',
  'js/pages/movimientos/index.js',
  'js/pages/movimientos/vista.js',
  'js/pages/negocio/acciones.js',
  'js/pages/negocio/form.js',
  'js/pages/negocio/pendientes.js',
  'js/pages/negocio/registrar.js',
  'js/pages/pendiente.js',
  'js/pages/plan/index.js',
  'js/pages/plan/vista.js',
  'js/pages/resumen/index.js',
  'js/pages/resumen/vista.js',
  'js/pages/tarjetas/compras.js',
  'js/pages/tarjetas/cuotas-form.js',
  'js/pages/tarjetas/detalle.js',
  'js/pages/tarjetas/form.js',
  'js/pages/tarjetas/index.js',
  'js/pages/tarjetas/pagar.js',
  'js/pages/tarjetas/vista.js',
  'js/repos/base.js',
  'js/repos/categorias.js',
  'js/repos/compras.js',
  'js/repos/cuentas.js',
  'js/repos/movimientos.js',
  'js/repos/pagos-recibo.js',
  'js/repos/perfiles.js',
  'js/repos/plan-items.js',
  'js/repos/tarjetas.js',
  'js/router.js',
  'js/ui/campos.js',
  'js/ui/confirmar.js',
  'js/ui/deslizar.js',
  'js/ui/foto.js',
  'js/ui/grafica.js',
  'js/ui/lista.js',
  'js/ui/monto-input.js',
  'js/ui/privacidad.js',
  'js/ui/sheet-formulario.js',
  'js/ui/sheet.js',
  'js/ui/tabbar.js',
  'js/ui/texto.js',
  'js/ui/toast.js',
];

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

/** Del cache al instante; la red actualiza el cache para la próxima vez. */
async function delCacheYRevalidar(peticion) {
  const cache = await caches.open(CACHE_SHELL);
  const guardada = await cache.match(peticion);
  const enRed = fetch(peticion)
    .then((respuesta) => {
      if (respuesta.ok) cache.put(peticion, respuesta.clone());
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
      evento.respondWith(delCacheYRevalidar(new Request('index.html')));
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

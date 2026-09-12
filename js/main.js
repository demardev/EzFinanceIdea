/* Arranque: arma el cliente, los repos y el contexto; decide login o app.
   Este es el único lugar donde se conectan las piezas entre sí. */

import { crearClienteDatos, crearClienteAlmacen } from './api/client.js';
import { hayConfig } from './config.js';
import { tokenVigente, haySesion, enSesionInvalida, idUsuario } from './api/sesion.js';
import { repoCuentas } from './repos/cuentas.js';
import { repoCategorias } from './repos/categorias.js';
import { repoMovimientos } from './repos/movimientos.js';
import { repoTarjetas } from './repos/tarjetas.js';
import { repoCompras } from './repos/compras.js';
import { repoPlanItems } from './repos/plan-items.js';
import { repoPerfiles } from './repos/perfiles.js';
import { repoPagosRecibo } from './repos/pagos-recibo.js';
import { abrirNuevoDesdeFab } from './movimientos/registrar.js';
import { abrirPagoRecibo } from './pages/negocio/registrar.js';
import { montarLogin } from './pages/login.js';
import { iniciarRouter } from './router.js';
import { icono } from './iconos/render.js';
import { estaOculto, alternarOculto } from './ui/privacidad.js';
import { aviso, avisoError } from './ui/toast.js';

const pantallaLogin = document.getElementById('login');
const app = document.getElementById('app');

/* La inyección de dependencias, sin ceremonia: el cliente se construye una
   vez y se le pasa a cada repo. Los repos se le pasan a las páginas. */
const cliente = crearClienteDatos(tokenVigente);
const contexto = {
  cliente,                      // solo lo usa el respaldo, que toca todas las tablas
  almacen: crearClienteAlmacen(tokenVigente),
  cuentas: repoCuentas(cliente),
  categorias: repoCategorias(cliente),
  movimientos: repoMovimientos(cliente),
  tarjetas: repoTarjetas(cliente),
  compras: repoCompras(cliente),
  planItems: repoPlanItems(cliente),
  perfiles: repoPerfiles(cliente),
  pagos: repoPagosRecibo(cliente),
  /* Se llenan al entrar; hasta entonces la app se comporta como si no
     hubiera negocio, que es lo correcto para casi todos. */
  perfil: { negocio: false },
  userId: null,
  alSalir: mostrarLogin,
};

/* El RPC es idempotente (no duplica si ya hay datos), pero no hace falta
   pagarle un viaje en cada arranque: basta la primera vez en este equipo. */
const CLAVE_SIEMBRA = 'finanzas.sembrado';

/* La bandera del negocio decide si aparecen los pagos de recibo. Si falla la
   lectura no se rompe nada: se queda apagada. */
async function cargarPerfil() {
  contexto.userId = idUsuario();
  try {
    contexto.perfil = await contexto.perfiles.mio();
  } catch {
    contexto.perfil = { negocio: false };
  }
}

async function sembrarSiHaceFalta() {
  /* La marca es POR USUARIO: si en este teléfono entra una cuenta nueva,
     también necesita sus cuentas y categorías, y con una marca compartida se
     quedaría vacía. */
  const clave = `${CLAVE_SIEMBRA}.${idUsuario() ?? 'anon'}`;
  if (localStorage.getItem(clave) === '1') return;
  try {
    await contexto.cuentas.sembrarIniciales();
    localStorage.setItem(clave, '1');
  } catch (e) {
    avisoError(e);
  }
}

function mostrarLogin() {
  app.hidden = true;
  pantallaLogin.hidden = false;
  montarLogin(pantallaLogin, mostrarApp);
}

async function mostrarApp() {
  pantallaLogin.hidden = true;
  pantallaLogin.innerHTML = '';
  app.hidden = false;
  await sembrarSiHaceFalta();
  await cargarPerfil();
  iniciarRouter(contexto);
}

/** Vuelve a montar la ruta actual: la forma barata de refrescar tras un cambio. */
function repintarVista() {
  dispatchEvent(new HashChangeEvent('hashchange'));
}

function pintarBotonOcultar() {
  const boton = document.getElementById('btn-ocultar');
  boton.innerHTML = icono(estaOculto() ? 'ojo-off' : 'ojo', 20);
  boton.setAttribute('aria-label', estaOculto() ? 'Mostrar montos' : 'Ocultar montos');
}

function conectarCabecera() {
  pintarBotonOcultar();
  document.getElementById('btn-ocultar').addEventListener('click', () => {
    alternarOculto();
    pintarBotonOcultar();
    repintarVista();
  });
  const fab = document.getElementById('fab');
  fab.innerHTML = icono('plus', 24);
  /* Registrar desde cualquier pantalla; al guardar se repinta la vista actual. */
  fab.addEventListener('click', async () => {
    try {
      await abrirNuevoDesdeFab(contexto, repintarVista, async () => {
        const [cuentas, categorias] = await Promise.all([
          contexto.cuentas.listarActivas(), contexto.categorias.listarActivas(),
        ]);
        await abrirPagoRecibo(contexto, {}, { cuentas, categorias }, repintarVista);
      });
    } catch (e) { avisoError(e); }
  });
  document.getElementById('btn-atras').innerHTML = icono('atras', 20);
}

/* Si el refresh del token falla, se vuelve al login sin dejar la app a medias. */
enSesionInvalida(() => {
  aviso('Tu sesión expiró.');
  mostrarLogin();
});

/* El service worker precachea el shell: la app abre sin internet y arranca
   al instante. `updateViaCache: none` obliga a revisar si hay versión nueva. */
function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .catch(() => { /* sin SW la app sigue funcionando, solo pierde el offline */ });
  });
}

registrarServiceWorker();
conectarCabecera();
if (haySesion() && hayConfig()) mostrarApp(); else mostrarLogin();

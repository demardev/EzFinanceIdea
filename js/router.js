/* Hash routing con un nivel de subruta (#/ajustes/cuentas). El mapa RUTAS es
   la única fuente de verdad: de ahí salen la tab bar, el título y qué se monta. */

import { montarResumen } from './pages/resumen/index.js';
import { montarMovimientos } from './pages/movimientos/index.js';
import { montarTarjetas } from './pages/tarjetas/index.js';
import { montarPlan } from './pages/plan/index.js';
import { montarPendiente } from './pages/pendiente.js';
import { montarAjustes } from './pages/ajustes/index.js';
import { pintarTabBar, marcarActiva } from './ui/tabbar.js';

export const RUTAS = {
  resumen:     { titulo: 'Resumen',     icono: 'resumen',     enTabBar: true, montar: montarResumen },
  movimientos: { titulo: 'Movimientos', icono: 'movimientos', enTabBar: true, montar: montarMovimientos },
  tarjetas:    { titulo: 'Tarjetas',    icono: 'card',        enTabBar: true, montar: montarTarjetas },
  plan:        { titulo: 'Plan',        icono: 'plan',        enTabBar: true, montar: montarPlan },
  ajustes:     { titulo: 'Ajustes',     icono: 'ajustes',     enTabBar: true, montar: montarAjustes },
};

const INICIAL = 'resumen';

function rutaActual() {
  const partes = location.hash.replace(/^#\/?/, '').split('/');
  const ruta = Object.hasOwn(RUTAS, partes[0]) ? partes[0] : INICIAL;
  return { ruta, sub: partes[1] ?? '' };
}

/** Arranca el router y pinta la primera vista. `contexto` lleva los repos. */
export function iniciarRouter(contexto) {
  const vista = document.getElementById('vista');
  const titulo = document.getElementById('titulo');
  const atras = document.getElementById('btn-atras');
  const nav = document.getElementById('tabbar');

  pintarTabBar(nav, RUTAS);
  atras.addEventListener('click', () => { location.hash = atras.dataset.destino || '#/resumen'; });

  /** Las subpantallas la usan para poner su propio título y el botón volver. */
  function ponerCabecera(texto, volverA = '') {
    titulo.textContent = texto;
    atras.hidden = !volverA;
    atras.dataset.destino = volverA;
  }

  async function navegar() {
    const { ruta, sub } = rutaActual();
    const destino = RUTAS[ruta];
    ponerCabecera(destino.titulo);
    marcarActiva(nav, ruta);

    /* Cada vista estrena su propio contenedor. Así los listeners que cuelgue
       se van con el nodo al navegar, en vez de acumularse en #vista. */
    const lienzo = document.createElement('div');
    vista.replaceChildren(lienzo);
    scrollTo(0, 0);
    await destino.montar(lienzo, contexto, { ...destino, sub, ponerCabecera });
  }

  addEventListener('hashchange', navegar);
  if (!location.hash) {
    location.hash = `#/${INICIAL}`;   // el hashchange se encarga de montar
    return;
  }
  return navegar();
}

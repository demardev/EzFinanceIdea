/* Orquesta la pantalla de Movimientos: carga datos, mantiene el estado de
   filtros y paginado, y conecta eventos. No pinta (vista.js) ni calcula
   dinero (calc/). */

import { pintarMovimientos } from './vista.js';
import { filtrosVacios, cuantosActivos, aplicar, abrirSheetFiltros } from './filtros.js';
import { abrirRegistro, eliminarMovimiento } from '../../movimientos/registrar.js';
import { conectarDeslizar, cerrarDeslizada } from '../../ui/deslizar.js';
import { totalesDelMes } from '../../calc/saldos.js';
import { avisoError } from '../../ui/toast.js';

const POR_PAGINA = 50;

/** { id: nombre } de cuentas, tarjetas y categorías, para pintar las filas. */
function indiceDeNombres({ cuentas, tarjetas, categorias }) {
  const mapa = {};
  [...cuentas, ...tarjetas, ...categorias].forEach((x) => { mapa[x.id] = x.nombre; });
  return mapa;
}

/** { idDeCategoria: icono } — la fila muestra el icono de su categoría. */
function indiceDeIconos({ categorias }) {
  const mapa = {};
  categorias.forEach((c) => { mapa[c.id] = c.icono; });
  return mapa;
}

export async function montarMovimientos(contenedor, contexto) {
  const { movimientos, cuentas, tarjetas, categorias } = contexto;
  let filtros = filtrosVacios();
  let datos = { cuentas: [], tarjetas: [], categorias: [] };
  let delMes = [];
  let pagina = 1;

  async function cargarCatalogos() {
    const [c, t, k] = await Promise.all([
      cuentas.listarActivas(), tarjetas.listarActivas(), categorias.listarActivas(),
    ]);
    datos = { cuentas: c, tarjetas: t, categorias: k };
  }

  function pintar() {
    const filtrados = aplicar(delMes, filtros);
    const visibles = filtrados.slice(0, pagina * POR_PAGINA);
    pintarMovimientos(contenedor, {
      visibles,
      total: filtrados.length,
      hayMas: filtrados.length > visibles.length,
      totales: totalesDelMes(filtrados),
      nombres: indiceDeNombres(datos),
      iconos: indiceDeIconos(datos),
      mes: filtros.mes,
      activos: cuantosActivos(filtros),
    });
    conectarDeslizar(contenedor);
  }

  async function recargar() {
    delMes = await movimientos.listarDelMes(filtros.mes);
    pagina = 1;
    pintar();
  }

  contenedor.addEventListener('click', async (evento) => {
    const objetivo = evento.target.closest('[data-editar], [data-borrar], #btn-filtros, #btn-mes, #btn-mas');
    if (!objetivo) return;
    try {
      if (objetivo.id === 'btn-mas') { pagina += 1; pintar(); return; }
      if (objetivo.dataset.borrar) {
        cerrarDeslizada();
        const mov = delMes.find((m) => m.id === objetivo.dataset.borrar);
        await eliminarMovimiento(contexto, mov, recargar);
        return;
      }
      if (objetivo.id === 'btn-filtros' || objetivo.id === 'btn-mes') {
        abrirSheetFiltros(filtros, datos, async (nuevos) => {
          const cambioMes = nuevos.mes !== filtros.mes;
          filtros = nuevos;
          if (cambioMes) await recargar(); else { pagina = 1; pintar(); }
        });
        return;
      }
      const mov = delMes.find((m) => m.id === objetivo.dataset.editar);
      await abrirRegistro(contexto, mov, recargar, datos);
    } catch (e) { avisoError(e); }
  });

  contenedor.innerHTML = '<p class="tenue">Cargando…</p>';
  await cargarCatalogos();
  await recargar();
}

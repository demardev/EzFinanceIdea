/* Orquesta la pantalla de Movimientos: carga datos, mantiene el estado de
   filtros y paginado, y conecta eventos. No pinta (vista.js) ni calcula
   dinero (calc/). */

import { pintarMovimientos } from './vista.js';
import { filtrosVacios, cuantosActivos, aplicar, abrirSheetFiltros } from './filtros.js';
import { abrirRegistro, eliminarMovimiento } from '../../movimientos/registrar.js';
import { conectarDeslizar, cerrarDeslizada } from '../../ui/deslizar.js';
import { ordenarPorFecha, direccionOpuesta } from '../../movimientos/orden.js';
import { abrirPagoRecibo } from '../negocio/registrar.js';
import { totalesDelMes } from '../../calc/saldos.js';
import { hoyISO } from '../../calc/fechas.js';
import { ambitoGuardado, guardarAmbito } from '../../ui/ambito.js';
import { avisoError } from '../../ui/toast.js';

const POR_PAGINA = 50;
const CLAVE_ORDEN = 'finanzas.orden-movimientos';
const CLAVE_PROGRAMADOS = 'finanzas.ver-programados';

/* Fuera de montarMovimientos para que sobreviva a los repintados. */
let verProgramados = localStorage.getItem(CLAVE_PROGRAMADOS) === '1';

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
  let filtros = { ...filtrosVacios(), ambito: ambitoGuardado() };
  let orden = localStorage.getItem(CLAVE_ORDEN) === 'asc' ? 'asc' : 'desc';
  let datos = { cuentas: [], tarjetas: [], categorias: [] };
  let delMes = [];
  let programados = [];
  let pagina = 1;

  async function cargarCatalogos() {
    const [c, t, k] = await Promise.all([
      cuentas.listarActivas(), tarjetas.listarActivas(), categorias.listarActivas(),
    ]);
    datos = { cuentas: c, tarjetas: t, categorias: k };
  }

  function pintar() {
    const filtrados = ordenarPorFecha(aplicar(delMes, filtros), orden);
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
      ambito: filtros.ambito,
      /* Los pendientes van del más cercano al más lejano, sin importar el
         orden que tenga la lista del mes: lo que sigue va primero. */
      programados: ordenarPorFecha(aplicar(programados, filtros), 'asc'),
      verProgramados,
      negocio: Boolean(contexto.perfil?.negocio),
      orden,
    });
    conectarDeslizar(contenedor);
  }

  /* Solo lo que YA pasó. Una cuota del 29 con fecha futura no es un
     movimiento del mes todavía: encabezaría la lista sin haber ocurrido y
     además inflaría el "salió" con dinero que sigue en la cuenta. Lo que falta
     por venir se ve en el Plan y dentro de su compra. */
  async function recargar() {
    const [todos, futuros] = await Promise.all([
      movimientos.listarDelMes(filtros.mes),
      movimientos.listarFuturos(hoyISO()),
    ]);
    delMes = todos.filter((m) => m.fecha <= hoyISO());
    /* Las cuotas de una compra a meses se ven dentro de su compra: aquí serían
       decenas de filas tapando lo que de verdad viene. */
    programados = futuros.filter((m) => !m.compra_id);
    pagina = 1;
    pintar();
  }

  /** Una fila puede ser del mes o de los pendientes. */
  const buscar = (id) => delMes.find((m) => m.id === id) ?? programados.find((m) => m.id === id);

  function abrirFiltros() {
    abrirSheetFiltros(filtros, datos, async (nuevos) => {
      const cambioMes = nuevos.mes !== filtros.mes;
      filtros = nuevos;
      if (cambioMes) await recargar();
      else { pagina = 1; pintar(); }
    });
  }

  contenedor.addEventListener('click', async (evento) => {
    const objetivo = evento.target.closest(
      '[data-editar], [data-borrar], [data-operacion], [data-pastilla], [data-programados],'
      + ' #btn-filtros, #btn-mes, #btn-mas, #btn-orden');
    if (!objetivo) return;
    try {
      if (objetivo.hasAttribute('data-programados')) {
        verProgramados = !verProgramados;
        localStorage.setItem(CLAVE_PROGRAMADOS, verProgramados ? '1' : '0');
        pintar();
        return;
      }
      /* La pastilla "Todo" vale "", así que se pregunta por el atributo. */
      if (objetivo.hasAttribute('data-pastilla')) {
        filtros.ambito = objetivo.dataset.pastilla;
        guardarAmbito(filtros.ambito);
        pagina = 1;
        pintar();
        return;
      }
      if (objetivo.id === 'btn-mas') { pagina += 1; pintar(); return; }
      if (objetivo.id === 'btn-orden') {
        orden = direccionOpuesta(orden);
        localStorage.setItem(CLAVE_ORDEN, orden);
        pintar();
        return;
      }
      if (objetivo.dataset.borrar) {
        cerrarDeslizada();
        const mov = buscar(objetivo.dataset.borrar);
        await eliminarMovimiento(contexto, mov, recargar);
        return;
      }
      if (objetivo.id === 'btn-filtros' || objetivo.id === 'btn-mes') {
        abrirFiltros();
        return;
      }
      if (objetivo.dataset.operacion) {
        const pago = await contexto.pagos.obtener(objetivo.dataset.operacion);
        if (pago) await abrirPagoRecibo(contexto, pago, datos, recargar);
        return;
      }
      const mov = buscar(objetivo.dataset.editar);
      await abrirRegistro(contexto, mov, recargar, datos);
    } catch (e) { avisoError(e); }
  });

  contenedor.innerHTML = '<p class="tenue">Cargando…</p>';
  await cargarCatalogos();
  await recargar();
}

/* Orquesta el Resumen: carga, calcula y le pasa todo a la vista. */

import { pintarResumen } from './vista.js';
import { saldosPorCuenta, patrimonioLiquido, totalesDelMes } from '../../calc/saldos.js';
import { deudaTotalDeTarjetas } from '../../calc/deuda-tarjeta.js';
import { proximosVencimientos } from '../../calc/vencimientos.js';
import { totalesDeNegocio, totalPorCobrar, estaPendiente } from '../../negocio/pago-recibo.js';
import { mesDe, hoyISO } from '../../calc/fechas.js';
import { ambitoGuardado, guardarAmbito, esDelAmbito } from '../../ui/ambito.js';
import { conectarPastillas } from '../../ui/pastillas.js';
import { animarRodillos, hayRodillo } from '../../ui/rodillo.js';
import { avisoError } from '../../ui/toast.js';

/* El flujo personal excluye el negocio: si no, un mes de recibos inflaría el
   entró/salió con dinero que solo pasó de largo. El patrimonio sí los suma
   todos, porque ese dinero está de verdad en la cuenta. */
function soloPersonales(movimientos) {
  return movimientos.filter((m) => (m.ambito ?? 'personal') === 'personal');
}

/* El ámbito elegido manda SOLO sobre esta lista: el entró/salió de arriba
   sigue siendo personal y el patrimonio sigue sumándolo todo. */
function ultimosDe(todos, ambito) {
  return todos.filter((m) => esDelAmbito(m, ambito)).slice(0, 5);
}

function estadoDeResumen({ hoy, lista, todos, delMes, tjs, cmps, items, negocio }) {
  return {
    cuentas: lista,
    saldos: saldosPorCuenta(lista, todos),
    patrimonio: patrimonioLiquido(lista, todos),
    totales: totalesDelMes(soloPersonales(delMes)),
    deuda: deudaTotalDeTarjetas(tjs, todos, cmps),
    vencimientos: proximosVencimientos(
      { tarjetas: tjs, movimientos: todos, compras: cmps, planItems: items },
      { hoy, dias: 14 }),
    negocio,
  };
}

async function datosDeNegocio(contexto, mes) {
  if (!contexto.perfil?.negocio) return { negocio: null, pendientes: [] };
  const pagos = await contexto.pagos.listar();
  const pendientes = pagos.filter(estaPendiente);
  return {
    negocio: {
      ...totalesDeNegocio(pagos, mes),
      porCobrar: { total: totalPorCobrar(pagos), cuantos: pendientes.length },
    },
    pendientes,
  };
}

function conectarPorCobrar(contenedor, contexto, pendientes) {
  contenedor.querySelector('#btn-por-cobrar')?.addEventListener('click', async () => {
    try {
      const [cuentas, categorias] = await Promise.all([
        contexto.cuentas.listarActivas(), contexto.categorias.listarActivas(),
      ]);
      const { abrirPendientes } = await import('../negocio/pendientes.js');
      abrirPendientes(contexto, pendientes, { cuentas, categorias },
                      () => dispatchEvent(new HashChangeEvent('hashchange')));
    } catch (e) { avisoError(e); }
  });
}

export async function montarResumen(contenedor, contexto) {
  const { cuentas, movimientos, tarjetas, compras, planItems } = contexto;
  contenedor.innerHTML = hayRodillo('patrimonio') ? '' : '<p class="tenue">Cargando…</p>';
  try {
    const hoy = hoyISO();
    const [lista, todos, delMes, tjs, cmps, items] = await Promise.all([
      cuentas.listarActivas(),
      movimientos.listar(),               // el saldo real necesita todo el historial
      movimientos.listarDelMes(mesDe(hoy)),
      tarjetas.listarActivas(),
      compras.listar(),
      planItems.listarActivos(),
    ]);
    const { negocio, pendientes } = await datosDeNegocio(contexto, mesDe(hoy));
    const estado = estadoDeResumen({ hoy, lista, todos, delMes, tjs, cmps, items, negocio });
    let ambito = ambitoGuardado();

    const pintar = () => {
      pintarResumen(contenedor, { ...estado, ambito, ultimos: ultimosDe(todos, ambito) });
      conectarPorCobrar(contenedor, contexto, pendientes);
      animarRodillos(contenedor);
    };
    pintar();
    /* El contenedor es nuevo en cada navegación (ver router.js), así que este
       listener se engancha una sola vez y sobrevive a los repintados. */
    conectarPastillas(contenedor, (valor) => {
      ambito = valor;
      guardarAmbito(valor);
      pintar();
    });
  } catch (e) {
    contenedor.innerHTML = '<p class="campo-error">No se pudo cargar.</p>';
    avisoError(e);
  }
}

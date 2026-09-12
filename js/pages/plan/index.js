/* Orquesta el planificador: carga datos, corre el cálculo en dos escenarios
   y le pasa el resultado a la vista. Aquí no se hace aritmética. */

import { pintarPlan } from './vista.js';
import { alternarSobre } from './sobres.js';
import { construirLineaTiempo, colchonDelPeriodo, hayGastosVariables,
         ingresosSinFecha, variablesEnEfectivo } from '../../calc/plan/linea-tiempo.js';
import { asignar } from '../../calc/plan/asignar.js';
import { evaluar } from '../../calc/plan/veredicto.js';
import { saldosPorCuenta } from '../../calc/saldos.js';
import { hoyISO, mesDe, rangoDelMes, sumarMeses, sumarDias } from '../../calc/fechas.js';
import { avisoError } from '../../ui/toast.js';

/* Abierto/cerrado por tabla: agregar un horizonte es agregar una entrada. */
const HORIZONTES = {
  mes:  { etiqueta: 'Este mes',        hasta: (hoy) => rangoDelMes(mesDe(hoy)).hasta },
  d30:  { etiqueta: 'Próximos 30 días', hasta: (hoy) => sumarDias(hoy, 30) },
  d60:  { etiqueta: 'Próximos 60 días', hasta: (hoy) => sumarDias(hoy, 60) },
  m3:   { etiqueta: '3 meses',          hasta: (hoy) => sumarMeses(hoy, 3) },
};

const CLAVE_HORIZONTE = 'finanzas.horizonte';

/**
 * Corre el plan completo. Los INGRESOS variables siempre van al mínimo —
 * escenario conservador, como pide el spec — y lo que cambia entre corridas
 * es el colchón de GASTOS variables.
 */
function correr(datos, saldos, hoy, hasta, escenarioGastos) {
  const eventos = construirLineaTiempo(datos, { hoy, hasta, escenario: 'min', escenarioGastos });
  const colchon = colchonDelPeriodo(datos.planItems, escenarioGastos, hoy, hasta);
  return asignar({ eventos, saldos, colchon, desde: hoy, hasta });
}

function indiceDeNombres({ cuentas, tarjetas }) {
  const mapa = {};
  [...cuentas, ...tarjetas].forEach((x) => { mapa[x.id] = x.nombre; });
  return mapa;
}

async function cargarDatos({ planItems, cuentas, tarjetas, movimientos, compras }) {
  const hoy = hoyISO();
  const [items, cts, tjs, totales, deTarjetas, futuros, cmps] = await Promise.all([
    planItems.listarActivos(), cuentas.listarActivas(), tarjetas.listarActivas(),
    movimientos.totalesPorCuenta(hoy),   // el saldo de hoy, ya sumado
    movimientos.listarDeTarjetas(),      // lo que proyecta cada tarjeta
    movimientos.listarFuturos(hoy),      // los pendientes sueltos
    compras.listar(),
  ]);
  /* Una cuota futura está en las dos listas: si no se deduplica, el plan la
     cobraría dos veces. */
  const porId = new Map([...deTarjetas, ...futuros].map((m) => [m.id, m]));
  return {
    datos: {
      planItems: items, tarjetas: tjs, compras: cmps, cuentas: cts,
      movimientos: [...porId.values()],
    },
    saldos: saldosPorCuenta(cts, totales, hoy),
  };
}

function pintarConDatos(contenedor, { datos, saldos, horizonte }) {
  const hoy = hoyISO();
  const hasta = HORIZONTES[horizonte].hasta(hoy);
  /* Dos corridas: la base con los variables al mínimo y la pesimista al
     máximo. La diferencia es la frase del rango. */
  const base = correr(datos, saldos, hoy, hasta, 'min');
  const pesimista = correr(datos, saldos, hoy, hasta, 'max');

  pintarPlan(contenedor, {
    v: evaluar({ base, pesimista }),
    base,
    nombres: indiceDeNombres(datos),
    horizonte,
    hasta,
    sinVariables: !hayGastosVariables(datos.planItems),
    sinFecha: ingresosSinFecha(datos.planItems),
    nombresColchon: variablesEnEfectivo(datos.planItems),
    horizontes: Object.entries(HORIZONTES).map(([k, h]) => [k, h.etiqueta]),
  });
}

/* Se engancha una sola vez: el contenedor es nuevo en cada navegación y los
   listeners delegados sobreviven a los repintados. */
function conectar(contenedor, estado, repintar) {
  contenedor.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-sobre]');
    if (!boton) return;
    alternarSobre(boton.dataset.sobre, boton.dataset.abierto === '1');
    repintar();
  });

  contenedor.addEventListener('change', (evento) => {
    if (evento.target.id !== 'sel-horizonte') return;
    estado.horizonte = evento.target.value;
    localStorage.setItem(CLAVE_HORIZONTE, estado.horizonte);
    repintar();
  });
}

export async function montarPlan(contenedor, contexto) {
  const estado = { horizonte: localStorage.getItem(CLAVE_HORIZONTE) || 'mes', datos: null, saldos: {} };
  const repintar = () => pintarConDatos(contenedor, estado);
  conectar(contenedor, estado, repintar);

  contenedor.innerHTML = '<p class="tenue">Calculando…</p>';
  try {
    Object.assign(estado, await cargarDatos(contexto));
    repintar();
  } catch (e) {
    contenedor.innerHTML = '<p class="campo-error">No se pudo calcular el plan.</p>';
    avisoError(e);
  }
}

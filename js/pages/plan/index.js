/* Orquesta el planificador: carga datos, corre el cálculo en dos escenarios
   y le pasa el resultado a la vista. Aquí no se hace aritmética. */

import { pintarPlan } from './vista.js';
import { construirLineaTiempo, colchonDelPeriodo } from '../../calc/plan/linea-tiempo.js';
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
  const eventos = construirLineaTiempo(datos, { hoy, hasta, escenario: 'min' });
  const colchon = colchonDelPeriodo(datos.planItems, escenarioGastos, hoy, hasta);
  return asignar({ eventos, saldos, colchon, desde: hoy, hasta });
}

function indiceDeNombres({ cuentas, tarjetas }) {
  const mapa = {};
  [...cuentas, ...tarjetas].forEach((x) => { mapa[x.id] = x.nombre; });
  return mapa;
}

export async function montarPlan(contenedor, contexto) {
  const { planItems, cuentas, tarjetas, movimientos, compras } = contexto;
  let horizonte = localStorage.getItem(CLAVE_HORIZONTE) || 'mes';
  let datos = null;
  let saldos = {};

  async function cargar() {
    const [items, cts, tjs, movs, cmps] = await Promise.all([
      planItems.listarActivos(), cuentas.listarActivas(),
      tarjetas.listarActivas(), movimientos.listar(), compras.listar(),
    ]);
    datos = { planItems: items, tarjetas: tjs, movimientos: movs, compras: cmps, cuentas: cts };
    saldos = saldosPorCuenta(cts, movs);
  }

  function pintar() {
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
      horizontes: Object.entries(HORIZONTES).map(([k, h]) => [k, h.etiqueta]),
    });
  }

  contenedor.addEventListener('change', (evento) => {
    if (evento.target.id !== 'sel-horizonte') return;
    horizonte = evento.target.value;
    localStorage.setItem(CLAVE_HORIZONTE, horizonte);
    pintar();
  });

  contenedor.innerHTML = '<p class="tenue">Calculando…</p>';
  try {
    await cargar();
    pintar();
  } catch (e) {
    contenedor.innerHTML = '<p class="campo-error">No se pudo calcular el plan.</p>';
    avisoError(e);
  }
}

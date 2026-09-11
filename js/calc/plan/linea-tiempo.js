/* Arma los eventos del plan ordenados por fecha. Función PURA: sin red, sin DOM.

   Dos decisiones que vale la pena tener claras:
   - Un gasto fijo cargado a TARJETA no es salida de efectivo el día que se
     cobra: el dinero sale cuando se paga la tarjeta. Por eso no entra como
     obligación suya, sino que se proyecta al corte que le toca.
   - Los gastos variables no se agendan a una fecha: se reservan como colchón
     (ver colchonDelPeriodo) y se restan del disponible. */

import { sumar, redondear } from '../dinero.js';
import { partes, aISO, clampDia, sumarMeses, diasEntre } from '../fechas.js';
import { calcularCiclo, corteSiguiente, limiteDePago } from '../ciclo-tarjeta.js';
import { calcularDeuda } from '../deuda-tarjeta.js';
import { sinCuotasYaPagadas } from '../cuotas.js';

/** Todas las veces que cae ese día del mes dentro del rango. */
export function ocurrenciasMensuales(diaMes, desde, hasta) {
  const fechas = [];
  const { anio, mes } = partes(desde);
  let cursor = aISO(anio, mes, clampDia(anio, mes, diaMes));
  while (cursor <= hasta) {
    if (cursor >= desde) fechas.push(cursor);
    const p = partes(sumarMeses(cursor, 1));
    cursor = aISO(p.anio, p.mes, clampDia(p.anio, p.mes, diaMes));
  }
  return fechas;
}

function montoDe(item, escenario) {
  if (item.variabilidad === 'fijo') return Number(item.monto) || 0;
  return Number(escenario === 'max' ? item.monto_max : item.monto_min) || 0;
}

function evento(item, fecha, clase, escenario) {
  return {
    clase,
    fecha,
    nombre: item.nombre,
    monto: montoDe(item, escenario),
    cuentaId: item.cuenta_id ?? null,
    tarjetaId: item.tarjeta_id ?? null,
    origen: 'plan',
  };
}

/** Ingresos (fijos y variables) y gastos fijos pagados desde una cuenta. */
export function eventosDePlan(planItems, desde, hasta, escenario) {
  const activos = planItems.filter((i) => i.activo);
  const eventos = [];

  /* Un ingreso sin día fijo no se agenda: es incierto, y cuando llega y lo
     registras ya está en el saldo de hoy. Ver ingresosSinFecha(). */
  activos.filter((i) => i.clase === 'ingreso' && i.dia_mes).forEach((item) => {
    ocurrenciasMensuales(item.dia_mes, desde, hasta)
      .forEach((f) => eventos.push(evento(item, f, 'ingreso', escenario)));
  });

  activos
    .filter((i) => i.clase === 'gasto' && i.variabilidad === 'fijo' && !i.tarjeta_id)
    .forEach((item) => {
      ocurrenciasMensuales(item.dia_mes, desde, hasta)
        .forEach((f) => eventos.push(evento(item, f, 'obligacion', escenario)));
    });

  return eventos;
}

/** Los ingresos que el plan deja fuera por no tener fecha, para decirlo. */
export function ingresosSinFecha(planItems) {
  return planItems.filter((i) => i.activo && i.clase === 'ingreso' && !i.dia_mes)
    .map((i) => i.nombre);
}

/**
 * Colchón de gastos variables para el horizonte. Se prorratea por días sobre
 * un mes de 30: si el horizonte son 15 días, se reserva la mitad del mes.
 */
const esGastoVariable = (i) => i.activo && i.clase === 'gasto' && i.variabilidad === 'variable';

/** ¿Hay con qué armar el colchón? Sin gastos variables el veredicto asume
    que no gastas en comida ni en transporte, y hay que decirlo. */
export function hayGastosVariables(planItems) {
  return planItems.some(esGastoVariable);
}

/* Un variable con tarjeta no es efectivo que se reserva: se paga con la
   tarjeta en su fecha límite. Ver cortesFuturos(). */
const esVariableEnEfectivo = (i) => esGastoVariable(i) && !i.tarjeta_id;

export function colchonDelPeriodo(planItems, escenario, desde, hasta) {
  const variables = planItems.filter(esVariableEnEfectivo);
  const mensual = sumar(...variables.map((i) => montoDe(i, escenario)));
  const dias = diasEntre(desde, hasta) + 1;
  return redondear((mensual * dias) / 30);
}

/**
 * Pagos de una tarjeta dentro del horizonte: lo que ya se debe al último
 * corte, más los cortes siguientes proyectando el ciclo abierto, las cuotas
 * futuras y los gastos fijos que se le cargan.
 */
export function eventosDeTarjeta(tarjeta, movimientos, gastosFijosDeTarjeta, hoy, hasta,
                                 { variables = [], escenarioGastos = 'min' } = {}) {
  const ciclo = calcularCiclo(tarjeta.dia_corte, tarjeta.dia_limite_pago, hoy);
  const deuda = calcularDeuda(movimientos, ciclo, tarjeta.limite_credito);
  const eventos = [];

  const comoPago = (monto, fecha, nota) => ({
    clase: 'obligacion',
    fecha,
    nombre: `Pago ${tarjeta.nombre}`,
    nota,
    monto,
    cuentaId: tarjeta.cuenta_pago_id ?? null,
    tarjetaId: tarjeta.id,
    origen: 'tarjeta',
  });

  if (deuda.aPagarAhora > 0 && ciclo.fechaLimiteDelCorte <= hasta) {
    eventos.push(comoPago(deuda.aPagarAhora, ciclo.fechaLimiteDelCorte, 'saldo al corte'));
  }

  const previstos = { movimientos, gastosFijos: gastosFijosDeTarjeta, variables, escenarioGastos };
  eventos.push(...cortesFuturos(tarjeta, previstos, ciclo, hasta, comoPago));
  return eventos;
}

/* Lo que se gastará con variables en un tramo del ciclo, prorrateado sobre 30
   días como el colchón. Del ciclo abierto solo cuentan los días que faltan:
   lo ya gastado de verdad está en los cargos. */
function variablesDelTramo(variables, escenario, desde, hasta) {
  const dias = diasEntre(desde, hasta);
  return variables.map((v) => redondear((montoDe(v, escenario) * dias) / 30));
}

/** Lo que cobrará cada corte siguiente que venza dentro del horizonte. */
function cortesFuturos(tarjeta, previstos, ciclo, hasta, comoPago) {
  const { movimientos, gastosFijos, variables, escenarioGastos } = previstos;
  const eventos = [];
  let corte = ciclo.fechaUltimoCorte;
  let siguiente = ciclo.fechaProximoCorte;
  let vence = limiteDePago(siguiente, tarjeta.dia_limite_pago);

  while (vence <= hasta) {
    const cargos = movimientos.filter(
      (m) => m.tipo === 'egreso' && m.tarjeta_id === tarjeta.id
          && m.fecha > corte && m.fecha <= siguiente);
    const recurrentes = gastosFijos.flatMap((item) =>
      ocurrenciasMensuales(item.dia_mes, corte, siguiente)
        .filter((f) => f > corte)
        .map(() => Number(item.monto) || 0));

    const estimados = variablesDelTramo(variables, escenarioGastos,
                                        corte > ciclo.hoy ? corte : ciclo.hoy, siguiente);
    const monto = sumar(...cargos.map((m) => m.monto), ...recurrentes, ...estimados);
    if (monto > 0) eventos.push(comoPago(monto, vence, `corte del ${siguiente}`));

    corte = siguiente;
    siguiente = corteSiguiente(corte, tarjeta.dia_corte);
    vence = limiteDePago(siguiente, tarjeta.dia_limite_pago);
  }
  return eventos;
}

/* En empate de fecha el pago va PRIMERO. Conservador: no se cuenta con que
   el depósito llegue antes que el cargo del banco el mismo día, así que un
   pago que vence el día de cobro se paga con lo que ya tienes. */
const PESO = { obligacion: 0, ingreso: 1 };

export function construirLineaTiempo({ planItems, tarjetas, movimientos, compras },
                                     { hoy, hasta, escenario = 'min', escenarioGastos = 'min' }) {
  const eventos = eventosDePlan(planItems, hoy, hasta, escenario);

  tarjetas.filter((t) => !t.archivada).forEach((tarjeta) => {
    const suyos = movimientos.filter(
      (m) => m.tarjeta_id === tarjeta.id || m.tarjeta_destino_id === tarjeta.id);
    const gastos = planItems.filter(
      (i) => i.activo && i.clase === 'gasto' && i.variabilidad === 'fijo'
          && i.tarjeta_id === tarjeta.id);
    const variables = planItems.filter((i) => esGastoVariable(i) && i.tarjeta_id === tarjeta.id);
    eventos.push(...eventosDeTarjeta(
      tarjeta, sinCuotasYaPagadas(suyos, compras), gastos, hoy, hasta,
      { variables, escenarioGastos }));
  });

  return eventos.sort((a, b) =>
    (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : PESO[a.clase] - PESO[b.clase]));
}

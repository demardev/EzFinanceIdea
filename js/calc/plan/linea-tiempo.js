/* Arma los eventos del plan ordenados por fecha. Función PURA: sin red, sin DOM.

   Dos decisiones que vale la pena tener claras:
   - Un gasto fijo cargado a TARJETA no es salida de efectivo el día que se
     cobra: el dinero sale cuando se paga la tarjeta. Por eso no entra como
     obligación suya, sino que se proyecta al corte que le toca.
   - Los gastos variables no se agendan a una fecha: se reservan como colchón
     (ver colchonDelPeriodo) y se restan del disponible. */

import { sumar, redondear } from '../dinero.js';
import { diasEntre } from '../fechas.js';
import { sinCuotasYaPagadas } from '../cuotas.js';
import { ocurrenciasMensuales, montoDe } from './recurrencia.js';
import { eventosDeTarjeta } from './proyeccion-tarjeta.js';

export { ocurrenciasMensuales } from './recurrencia.js';
export { eventosDeTarjeta } from './proyeccion-tarjeta.js';

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

/** Lo que forma el colchón, para que la línea diga qué es y no solo cuánto. */
export function variablesEnEfectivo(planItems) {
  return planItems.filter(esVariableEnEfectivo).map((i) => i.nombre);
}

export function colchonDelPeriodo(planItems, escenario, desde, hasta) {
  const variables = planItems.filter(esVariableEnEfectivo);
  const mensual = sumar(...variables.map((i) => montoDe(i, escenario)));
  const dias = diasEntre(desde, hasta) + 1;
  return redondear((mensual * dias) / 30);
}

/* Un movimiento con fecha futura es un pendiente: no está en el saldo, así que
   el plan lo proyecta en su día. Lo que toca una TARJETA se queda fuera —eso
   lo proyecta la tarjeta en su fecha de pago, y contarlo aquí sacaría el
   dinero dos veces— y una transferencia entre cuentas propias no cambia el
   total, así que tampoco entra. */
const CLASE_DE_MOVIMIENTO = { ingreso: 'ingreso', egreso: 'obligacion' };

export function eventosDeMovimientos(movimientos, desde, hasta) {
  return movimientos
    .filter((m) => m.fecha > desde && m.fecha <= hasta
                && !m.tarjeta_id && !m.tarjeta_destino_id
                && CLASE_DE_MOVIMIENTO[m.tipo])
    .map((m) => ({
      clase: CLASE_DE_MOVIMIENTO[m.tipo],
      fecha: m.fecha,
      nombre: m.descripcion,
      monto: redondear(m.monto),
      cuentaId: m.cuenta_id ?? null,
      tarjetaId: null,
      origen: 'movimiento',
    }));
}

/* En empate de fecha el pago va PRIMERO. Conservador: no se cuenta con que
   el depósito llegue antes que el cargo del banco el mismo día, así que un
   pago que vence el día de cobro se paga con lo que ya tienes. */
const PESO = { obligacion: 0, ingreso: 1 };

export function construirLineaTiempo({ planItems, tarjetas, movimientos, compras },
                                     { hoy, hasta, escenario = 'min', escenarioGastos = 'min' }) {
  const eventos = eventosDePlan(planItems, hoy, hasta, escenario);
  eventos.push(...eventosDeMovimientos(movimientos, hoy, hasta));

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

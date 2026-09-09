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

  activos.filter((i) => i.clase === 'ingreso').forEach((item) => {
    const fechas = item.dia_mes
      ? ocurrenciasMensuales(item.dia_mes, desde, hasta)
      : [desde];   /* un ingreso variable sin día se asume disponible ya */
    fechas.forEach((f) => eventos.push(evento(item, f, 'ingreso', escenario)));
  });

  activos
    .filter((i) => i.clase === 'gasto' && i.variabilidad === 'fijo' && !i.tarjeta_id)
    .forEach((item) => {
      ocurrenciasMensuales(item.dia_mes, desde, hasta)
        .forEach((f) => eventos.push(evento(item, f, 'obligacion', escenario)));
    });

  return eventos;
}

/**
 * Colchón de gastos variables para el horizonte. Se prorratea por días sobre
 * un mes de 30: si el horizonte son 15 días, se reserva la mitad del mes.
 */
export function colchonDelPeriodo(planItems, escenario, desde, hasta) {
  const variables = planItems.filter(
    (i) => i.activo && i.clase === 'gasto' && i.variabilidad === 'variable');
  const mensual = sumar(...variables.map((i) => montoDe(i, escenario)));
  const dias = diasEntre(desde, hasta) + 1;
  return redondear((mensual * dias) / 30);
}

/**
 * Pagos de una tarjeta dentro del horizonte: lo que ya se debe al último
 * corte, más los cortes siguientes proyectando el ciclo abierto, las cuotas
 * futuras y los gastos fijos que se le cargan.
 */
export function eventosDeTarjeta(tarjeta, movimientos, gastosFijosDeTarjeta, hoy, hasta) {
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

  eventos.push(...cortesFuturos(tarjeta, movimientos, gastosFijosDeTarjeta, ciclo, hasta, comoPago));
  return eventos;
}

/** Lo que cobrará cada corte siguiente que venza dentro del horizonte. */
function cortesFuturos(tarjeta, movimientos, gastosFijos, ciclo, hasta, comoPago) {
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

    const monto = sumar(...cargos.map((m) => m.monto), ...recurrentes);
    if (monto > 0) eventos.push(comoPago(monto, vence, `corte del ${siguiente}`));

    corte = siguiente;
    siguiente = corteSiguiente(corte, tarjeta.dia_corte);
    vence = limiteDePago(siguiente, tarjeta.dia_limite_pago);
  }
  return eventos;
}

/* A igual fecha, primero entra el dinero y después se paga. */
const PESO = { ingreso: 0, obligacion: 1 };

export function construirLineaTiempo({ planItems, tarjetas, movimientos, compras },
                                     { hoy, hasta, escenario = 'min' }) {
  const eventos = eventosDePlan(planItems, hoy, hasta, escenario);

  tarjetas.filter((t) => !t.archivada).forEach((tarjeta) => {
    const suyos = movimientos.filter(
      (m) => m.tarjeta_id === tarjeta.id || m.tarjeta_destino_id === tarjeta.id);
    const gastos = planItems.filter(
      (i) => i.activo && i.clase === 'gasto' && i.variabilidad === 'fijo'
          && i.tarjeta_id === tarjeta.id);
    eventos.push(...eventosDeTarjeta(
      tarjeta, sinCuotasYaPagadas(suyos, compras), gastos, hoy, hasta));
  });

  return eventos.sort((a, b) =>
    (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : PESO[a.clase] - PESO[b.clase]));
}

/* Lo que viene pronto: fechas límite de tarjeta, cortes, gastos fijos e
   ingresos con día.
   Función PURA: sin red, sin DOM.

   Es lo que alimenta el bloque de avisos del Resumen. A diferencia del plan,
   aquí no se reparte dinero: solo se listan fechas con su monto y su urgencia. */

import { diasEntre, sumarDias } from './fechas.js';
import { calcularCiclo } from './ciclo-tarjeta.js';
import { calcularDeuda } from './deuda-tarjeta.js';
import { cargosDeTarjeta } from './saldo-inicial-tarjeta.js';
import { ocurrenciasMensuales, montoDe } from './plan/recurrencia.js';
import { coincide, yaRegistrado, GRACIA } from './plan/registrado.js';
import { esFijoActivo, fijosPorCargar } from './fijos-tarjeta.js';

/** Rojo si ya venció, ámbar si faltan 5 días o menos. */
function estadoPorDias(dias) {
  if (dias < 0) return 'vencido';
  return dias <= 5 ? 'urgente' : 'normal';
}

function aviso(clase, nombre, fecha, monto, hoy) {
  const dias = diasEntre(hoy, fecha);
  return { clase, nombre, fecha, monto, dias, estado: estadoPorDias(dias) };
}

function deTarjetas(tarjetas, movimientos, compras, hoy, hasta) {
  const avisos = [];
  tarjetas.filter((t) => !t.archivada).forEach((tarjeta) => {
    const ciclo = calcularCiclo(tarjeta.dia_corte, tarjeta.dia_limite_pago, hoy);
    const deuda = calcularDeuda(cargosDeTarjeta(tarjeta, movimientos, compras), ciclo,
                                tarjeta.limite_credito);

    /* El pago se muestra aunque ya haya vencido: es justo lo que hay que ver. */
    if (deuda.aPagarAhora > 0 && ciclo.fechaLimiteDelCorte <= hasta) {
      avisos.push(aviso('pago', tarjeta.nombre, ciclo.fechaLimiteDelCorte, deuda.aPagarAhora, hoy));
    }
    if (deuda.nuevoCiclo > 0 && ciclo.fechaProximoCorte <= hasta) {
      avisos.push(aviso('corte', tarjeta.nombre, ciclo.fechaProximoCorte, deuda.nuevoCiclo, hoy));
    }
  });
  return avisos;
}

/** ¿Este movimiento es el pago de un gasto fijo del plan? Las cuotas nunca lo son. */
export function esGastoFijo(movimiento, planItems) {
  if (movimiento.compra_id) return false;
  return planItems.some((i) => esFijoActivo(i) && coincide(i, movimiento));
}

/* Un gasto fijo o un ingreso sigue a la vista unos días después de su
   fecha: es cuando más falta hace el recordatorio. Al registrarlo deja de
   aparecer. Un ingreso variable se anuncia con su mínimo, como en el plan. */
function dePlan(items, clase, registrados, hoy, hasta) {
  const desde = sumarDias(hoy, -GRACIA);
  return items
    .flatMap((item) => ocurrenciasMensuales(item.dia_mes, desde, hasta)
      .filter((fecha) => !yaRegistrado(item, fecha, registrados))
      .map((fecha) => ({ ...aviso(clase, item.nombre, fecha, montoDe(item, 'min'), hoy),
                         item })));
}

/* Los gastos de una tarjeta activa tienen su propia regla (fijos-tarjeta.js). */
function deGastosFijos(planItems, registrados, hoy, hasta, deTarjeta) {
  const gastos = planItems.filter((i) => esFijoActivo(i) && i.dia_mes
                                      && !deTarjeta.has(i.tarjeta_id));
  return dePlan(gastos, 'gasto', registrados, hoy, hasta);
}

function deIngresos(planItems, registrados, hoy, hasta) {
  const ingresos = planItems.filter((i) => i.activo && i.clase === 'ingreso' && i.dia_mes);
  return dePlan(ingresos, 'ingreso', registrados, hoy, hasta);
}

/* Un fijo de tarjeta no se va a los 3 días: sigue hasta que lo registras,
   porque el banco lo cobra cuando quiere y olvidarlo descuadra la deuda. */
function deFijosDeTarjetas(tarjetas, movimientos, planItems, hoy, hasta) {
  return tarjetas.flatMap((tarjeta) =>
    fijosPorCargar(tarjeta, planItems, movimientos,
                   calcularCiclo(tarjeta.dia_corte, tarjeta.dia_limite_pago, hoy))
      .filter((p) => p.fecha <= hasta)
      .map((p) => ({ ...aviso('gasto', p.item.nombre, p.fecha, p.monto, hoy), item: p.item })));
}

/**
 * @param registrados movimientos cercanos, para no avisar de lo ya registrado
 * @param dias cuántos días hacia adelante mirar (el Resumen usa 14)
 * @returns avisos ordenados por fecha, lo más próximo primero
 */
export function proximosVencimientos({ tarjetas, movimientos, compras, planItems,
                                       registrados = [] },
                                     { hoy, dias = 14 }) {
  const hasta = sumarDias(hoy, dias);
  const activas = tarjetas.filter((t) => !t.archivada);
  const deTarjeta = new Set(activas.map((t) => t.id));
  return [
    ...deTarjetas(tarjetas, movimientos, compras, hoy, hasta),
    ...deGastosFijos(planItems, registrados, hoy, hasta, deTarjeta),
    ...deIngresos(planItems, registrados, hoy, hasta),
    ...deFijosDeTarjetas(activas, movimientos, planItems, hoy, hasta),
  ].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
}

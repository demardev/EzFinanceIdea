/* Deuda de una tarjeta: tres cubetas por fecha y cascada de pagos.
   Función PURA: sin red, sin DOM.

   Los cargos se reparten según cuándo ocurrieron:
     deudaVieja    <= corte anterior al último  (ya debió pagarse)
     saldoAlCorte  dentro del último ciclo cerrado  (es lo que toca pagar)
     nuevoCiclo    después del último corte  (se cobrará en el próximo corte)

   Un reembolso (un ingreso que entra a la tarjeta) cancela primero cargos de
   su misma cubeta, como en el estado de cuenta; lo que sobre se suma a los
   pagos. Los pagos se aplican en cascada, lo más viejo primero. Lo que sobre
   después de saldar las tres cubetas es saldo a favor. */

import { redondear, sumar } from './dinero.js';
import { hoyISO } from './fechas.js';
import { calcularCiclo } from './ciclo-tarjeta.js';
import { cargosDeTarjeta } from './saldo-inicial-tarjeta.js';

export const esCargo     = (m) => m.tipo === 'egreso' && Boolean(m.tarjeta_id);
export const esPago      = (m) => m.tipo === 'transferencia' && Boolean(m.tarjeta_destino_id);
export const esReembolso = (m) => m.tipo === 'ingreso' && Boolean(m.tarjeta_id);

/** Resta `disponible` de `saldo` y devuelve lo que queda de cada uno. */
function aplicar(saldo, disponible) {
  const usado = Math.min(saldo, disponible);
  return { saldo: redondear(saldo - usado), resto: redondear(disponible - usado) };
}

/**
 * Las tres cubetas ya con sus reembolsos, y lo que hay para la cascada: los
 * pagos más lo que sobró de los reembolsos. Solo lo que ya ocurrió: la cuota
 * de noviembre no es deuda de hoy (esas van en comprometidoEnCuotas()).
 */
function cubetas(movimientos, { fechaCorteAnterior, fechaUltimoCorte, hoy }) {
  const ocurridos = movimientos.filter((m) => m.fecha <= hoy);
  const total = (tipo, prueba) => sumar(...ocurridos
    .filter((m) => tipo(m) && prueba(m.fecha)).map((m) => m.monto));
  const netas = [
    (f) => f <= fechaCorteAnterior,
    (f) => f > fechaCorteAnterior && f <= fechaUltimoCorte,
    (f) => f > fechaUltimoCorte,
  ].map((prueba) => aplicar(total(esCargo, prueba), total(esReembolso, prueba)));
  return {
    saldos: netas.map((n) => n.saldo),
    disponible: sumar(total(esPago, () => true), ...netas.map((n) => n.resto)),
  };
}

/**
 * @param movimientos  los de ESTA tarjeta (cargos, pagos y reembolsos)
 * @param ciclo        { fechaCorteAnterior, fechaUltimoCorte }
 * @param limite       límite de crédito, para el porcentaje de uso
 */
export function calcularDeuda(movimientos, ciclo, limite = 0) {
  const hoy = ciclo.hoy ?? hoyISO();
  let { saldos: [vieja, corte, nuevo], disponible } = cubetas(movimientos, { ...ciclo, hoy });

  ({ saldo: vieja, resto: disponible } = aplicar(vieja, disponible));
  ({ saldo: corte, resto: disponible } = aplicar(corte, disponible));
  ({ saldo: nuevo, resto: disponible } = aplicar(nuevo, disponible));

  const deudaTotal = sumar(vieja, corte, nuevo);

  /* El banco congela el monto COMPLETO de una compra a meses desde el día que
     la haces y lo suelta conforme le pagas, así que el disponible tiene que
     descontar también las cuotas que todavía no cobra. La DEUDA no las
     incluye —esas aún no se cobran— y por eso son dos números distintos. */
  const comprometido = comprometidoEnCuotas(movimientos, hoy);
  const usado = sumar(deudaTotal, comprometido);

  return {
    deudaVieja: vieja,
    saldoAlCorte: corte,
    nuevoCiclo: nuevo,
    deudaTotal,
    saldoAFavor: disponible,
    /* Lo que hay que pagar antes de la fecha límite. */
    aPagarAhora: sumar(vieja, corte),
    comprometido,
    ...(limite > 0 ? {
      usoDelLimite: redondear((usado / limite) * 100),
      disponible: redondear(limite - usado),
    } : {}),
  };
}

/**
 * Cuotas futuras aún no cobradas: cuentan como comprometido, no como deuda
 * actual, hasta que llegue su fecha.
 */
export function comprometidoEnCuotas(movimientos, hoy) {
  const futuras = movimientos.filter((m) => esCargo(m) && m.compra_id && m.fecha > hoy);
  return sumar(...futuras.map((m) => m.monto));
}

/** Los movimientos que tocan una tarjeta: sus cargos, pagos y reembolsos. */
export function movimientosDeTarjeta(movimientos, tarjetaId) {
  return movimientos.filter(
    (m) => m.tarjeta_id === tarjetaId || m.tarjeta_destino_id === tarjetaId);
}

/** Lo que se debe hoy sumando todas las tarjetas. Lo usa el Resumen. */
export function deudaTotalDeTarjetas(tarjetas, movimientos, compras, hoy = hoyISO()) {
  return sumar(...tarjetas.map((t) => {
    const ciclo = calcularCiclo(t.dia_corte, t.dia_limite_pago, hoy);
    return calcularDeuda(cargosDeTarjeta(t, movimientos, compras), ciclo).deudaTotal;
  }));
}

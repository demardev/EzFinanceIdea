/* Deuda de una tarjeta: tres cubetas por fecha y cascada de pagos.
   Función PURA: sin red, sin DOM.

   Los cargos se reparten según cuándo ocurrieron:
     deudaVieja    <= corte anterior al último  (ya debió pagarse)
     saldoAlCorte  dentro del último ciclo cerrado  (es lo que toca pagar)
     nuevoCiclo    después del último corte  (se cobrará en el próximo corte)

   Los pagos se aplican en cascada, lo más viejo primero. Lo que sobre después
   de saldar las tres cubetas es saldo a favor. */

import { redondear, sumar } from './dinero.js';
import { hoyISO } from './fechas.js';
import { calcularCiclo } from './ciclo-tarjeta.js';
import { sinCuotasYaPagadas } from './cuotas.js';

const esCargo = (m) => m.tipo === 'egreso' && m.tarjeta_id;
const esPago  = (m) => m.tipo === 'transferencia' && m.tarjeta_destino_id;

/** Resta `disponible` de `saldo` y devuelve lo que queda de cada uno. */
function aplicar(saldo, disponible) {
  const usado = Math.min(saldo, disponible);
  return { saldo: redondear(saldo - usado), resto: redondear(disponible - usado) };
}

/**
 * @param movimientos  los de ESTA tarjeta (cargos y pagos)
 * @param ciclo        { fechaCorteAnterior, fechaUltimoCorte }
 * @param limite       límite de crédito, para el porcentaje de uso
 */
export function calcularDeuda(movimientos, ciclo, limite = 0) {
  const { fechaCorteAnterior, fechaUltimoCorte, hoy = hoyISO() } = ciclo;

  /* Un cargo con fecha futura todavía no se hizo: la cuota de noviembre no es
     deuda de hoy. Esas van aparte, en comprometidoEnCuotas(). */
  const cargos = movimientos.filter((m) => esCargo(m) && m.fecha <= hoy);

  const enCubeta = (prueba) => sumar(...cargos.filter(prueba).map((m) => m.monto));

  let vieja  = enCubeta((m) => m.fecha <= fechaCorteAnterior);
  let corte  = enCubeta((m) => m.fecha > fechaCorteAnterior && m.fecha <= fechaUltimoCorte);
  let nuevo  = enCubeta((m) => m.fecha > fechaUltimoCorte);

  let disponible = sumar(...movimientos.filter((m) => esPago(m) && m.fecha <= hoy)
    .map((m) => m.monto));

  ({ saldo: vieja, resto: disponible } = aplicar(vieja, disponible));
  ({ saldo: corte, resto: disponible } = aplicar(corte, disponible));
  ({ saldo: nuevo, resto: disponible } = aplicar(nuevo, disponible));

  const deudaTotal = sumar(vieja, corte, nuevo);

  return {
    deudaVieja: vieja,
    saldoAlCorte: corte,
    nuevoCiclo: nuevo,
    deudaTotal,
    saldoAFavor: disponible,
    /* Lo que hay que pagar antes de la fecha límite. */
    aPagarAhora: sumar(vieja, corte),
    ...(limite > 0 ? {
      usoDelLimite: redondear((deudaTotal / limite) * 100),
      disponible: redondear(limite - deudaTotal),
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

/** Los movimientos que tocan una tarjeta: sus cargos y sus pagos. */
export function movimientosDeTarjeta(movimientos, tarjetaId) {
  return movimientos.filter(
    (m) => m.tarjeta_id === tarjetaId || m.tarjeta_destino_id === tarjetaId);
}

/** Lo que se debe hoy sumando todas las tarjetas. Lo usa el Resumen. */
export function deudaTotalDeTarjetas(tarjetas, movimientos, compras, hoy = hoyISO()) {
  return sumar(...tarjetas.map((t) => {
    const suyos = sinCuotasYaPagadas(movimientosDeTarjeta(movimientos, t.id), compras);
    const ciclo = calcularCiclo(t.dia_corte, t.dia_limite_pago, hoy);
    return calcularDeuda(suyos, ciclo).deudaTotal;
  }));
}

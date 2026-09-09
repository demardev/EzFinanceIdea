/* Saldos a partir de movimientos. Función PURA: sin red, sin DOM, sin imports.

   El saldo de una cuenta NO se guarda en la base: se calcula cada vez como
   saldo_inicial + ingresos − egresos − transferencias salientes
   + transferencias entrantes. */

import { redondear, sumar } from './dinero.js';

/**
 * Cuánto mueve este movimiento en esa cuenta. Firmado.
 * Un egreso cargado a tarjeta no toca ninguna cuenta: la deuda sube, el
 * dinero sale después, cuando se paga la tarjeta.
 */
export function deltaEnCuenta(mov, cuentaId) {
  const monto = Number(mov.monto) || 0;
  if (mov.tipo === 'ingreso') {
    return mov.cuenta_id === cuentaId ? monto : 0;
  }
  if (mov.tipo === 'egreso') {
    return mov.cuenta_id === cuentaId ? -monto : 0;
  }
  if (mov.tipo === 'transferencia') {
    if (mov.cuenta_id === cuentaId) return -monto;
    if (mov.cuenta_destino_id === cuentaId) return monto;
  }
  return 0;
}

export function saldoDeCuenta(cuenta, movimientos) {
  const deltas = movimientos.map((m) => deltaEnCuenta(m, cuenta.id));
  return sumar(Number(cuenta.saldo_inicial) || 0, ...deltas);
}

/** { idDeCuenta: saldo } — lo que consumen las listas. */
export function saldosPorCuenta(cuentas, movimientos) {
  const mapa = {};
  cuentas.forEach((c) => { mapa[c.id] = saldoDeCuenta(c, movimientos); });
  return mapa;
}

export function patrimonioLiquido(cuentas, movimientos) {
  return sumar(...cuentas.map((c) => saldoDeCuenta(c, movimientos)));
}

/**
 * Entró / salió / neto de la lista que se le pase (ya filtrada por mes).
 * Las transferencias no cuentan: mover dinero entre cosas propias no es
 * ni entrada ni salida, y pagar la tarjeta ya se contó al comprar.
 */
export function totalesDelMes(movimientos) {
  const entro = sumar(...movimientos.filter((m) => m.tipo === 'ingreso').map((m) => m.monto));
  const salio = sumar(...movimientos.filter((m) => m.tipo === 'egreso').map((m) => m.monto));
  return { entro, salio, neto: redondear(entro - salio) };
}

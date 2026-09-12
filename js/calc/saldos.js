/* Saldos a partir de movimientos. Función PURA: sin red, sin DOM.

   El saldo de una cuenta NO se guarda en la base: se calcula cada vez como
   saldo_inicial + ingresos − egresos − transferencias salientes
   + transferencias entrantes. */

import { redondear, sumar } from './dinero.js';
import { hoyISO } from './fechas.js';

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

/* Un movimiento con fecha futura es un PENDIENTE: no es dinero que ya tengas,
   así que no entra al saldo hasta que llega su día. Ese día entra solo, sin
   confirmar nada. La deuda de tarjetas ya hacía este mismo corte. */
function yaOcurrieron(movimientos, hoy) {
  /* Sin fecha no debería llegar ninguno —la base la exige— pero si llega, se
     cuenta: perder dinero en silencio es peor que contarlo antes de tiempo. */
  return movimientos.filter((m) => !m.fecha || m.fecha <= hoy);
}

export function saldoDeCuenta(cuenta, movimientos, hoy = hoyISO()) {
  const deltas = yaOcurrieron(movimientos, hoy).map((m) => deltaEnCuenta(m, cuenta.id));
  return sumar(Number(cuenta.saldo_inicial) || 0, ...deltas);
}

/** { idDeCuenta: saldo } — lo que consumen las listas. */
export function saldosPorCuenta(cuentas, movimientos, hoy = hoyISO()) {
  const ocurridos = yaOcurrieron(movimientos, hoy);
  const mapa = {};
  cuentas.forEach((c) => { mapa[c.id] = saldoDeCuenta(c, ocurridos, hoy); });
  return mapa;
}

export function patrimonioLiquido(cuentas, movimientos, hoy = hoyISO()) {
  return sumar(...cuentas.map((c) => saldoDeCuenta(c, movimientos, hoy)));
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

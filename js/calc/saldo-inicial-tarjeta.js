/* Lo que ya se debía en una tarjeta antes de empezar a registrarla aquí.
   Función PURA: sin red, sin DOM.

   Sin esto, el primer pago que haces en la app salda deudas que la app no
   conoce, y lo que sobra se come los cargos del corte actual: la tarjeta
   dice que debes menos de lo que dice el banco. Entra como un cargo más,
   con su fecha, para que caiga en su corte y la cascada de pagos lo vea. */

import { sinCuotasYaPagadas } from './cuotas.js';

/** El cargo que representa el saldo inicial, o null si no hay. */
export function cargoDeSaldoInicial(tarjeta) {
  const monto = Number(tarjeta.saldo_inicial) || 0;
  if (monto <= 0 || !tarjeta.fecha_saldo_inicial) return null;
  return {
    id: `saldo-inicial-${tarjeta.id}`,
    tipo: 'egreso',
    monto,
    fecha: tarjeta.fecha_saldo_inicial,
    descripcion: 'Saldo pendiente al empezar',
    tarjeta_id: tarjeta.id,
    saldoInicial: true,
  };
}

export function conSaldoInicial(movimientos, tarjeta) {
  const inicial = cargoDeSaldoInicial(tarjeta);
  return inicial ? [...movimientos, inicial] : movimientos;
}

/**
 * Lo que pesa en la deuda de UNA tarjeta: sus cargos y pagos, sin las cuotas
 * que ya venían pagadas y con el saldo inicial. Todas las cuentas de deuda
 * parten de aquí, para que ninguna pantalla se salte una de las dos reglas.
 */
export function cargosDeTarjeta(tarjeta, movimientos, compras) {
  const suyos = movimientos.filter(
    (m) => m.tarjeta_id === tarjeta.id || m.tarjeta_destino_id === tarjeta.id);
  return conSaldoInicial(sinCuotasYaPagadas(suyos, compras), tarjeta);
}

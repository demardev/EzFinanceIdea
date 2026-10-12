/* De dónde sale la deuda de una tarjeta, en cifras que se puedan sumar a
   mano contra el estado de cuenta. Función PURA: sin red, sin DOM. */

import { sumar } from './dinero.js';
import { calcularCiclo, corteQueIncluye } from './ciclo-tarjeta.js';
import { calcularDeuda } from './deuda-tarjeta.js';
import { cargosDeTarjeta } from './saldo-inicial-tarjeta.js';

const esCargo = (m) => m.tipo === 'egreso' && m.tarjeta_id;
const esPago  = (m) => m.tipo === 'transferencia' && m.tarjeta_destino_id;

/**
 * saldo inicial + cargos − pagos = deuda total − saldo a favor.
 * Solo lo que ya ocurrió: la cuota de noviembre todavía no es deuda.
 *
 * @param movimientos los de la tarjeta, ya con el saldo inicial (cargosDeTarjeta)
 */
export function desgloseDeDeuda(movimientos, ciclo) {
  const yaOcurridos = movimientos.filter((m) => m.fecha <= ciclo.hoy);
  const total = (prueba) => sumar(...yaOcurridos.filter(prueba).map((m) => m.monto));
  const deuda = calcularDeuda(movimientos, ciclo);

  return {
    saldoInicial: total((m) => m.saldoInicial),
    cargos: total((m) => esCargo(m) && !m.saldoInicial),
    pagos: total(esPago),
    deudaTotal: deuda.deudaTotal,
    saldoAFavor: deuda.saldoAFavor,
    /* Lo que falta para dejar pagado el último corte. */
    faltaDelCorte: deuda.aPagarAhora,
    corte: ciclo.fechaUltimoCorte,
    vence: ciclo.fechaLimiteDelCorte,
  };
}

/**
 * Lo que cambia al poner un saldo inicial, para avisarlo en el formulario
 * mientras se escribe. "antes" es la deuda sin NINGÚN saldo inicial, así al
 * editarlo se ve el efecto completo y no la diferencia contra el guardado.
 *
 * @param tarjeta con el día de corte que está en el formulario
 */
export function efectoDeSaldoInicial({ tarjeta, movimientos, compras }, { monto, fecha }, hoy) {
  const ciclo = calcularCiclo(tarjeta.dia_corte, tarjeta.dia_limite_pago, hoy);
  const deudaCon = (saldo) => calcularDeuda(
    cargosDeTarjeta({ ...tarjeta, saldo_inicial: saldo, fecha_saldo_inicial: fecha },
                    movimientos, compras), ciclo).deudaTotal;

  return {
    corte: corteQueIncluye(fecha, tarjeta.dia_corte),
    antes: deudaCon(0),
    despues: deudaCon(monto),
  };
}

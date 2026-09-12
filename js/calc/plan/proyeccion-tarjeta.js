/* Lo que cobrará cada tarjeta dentro del horizonte del plan. Función PURA.

   Lo que se gasta con tarjeta no sale de la cuenta el día de la compra: sale
   el día que se PAGA la tarjeta. Aquí se juntan lo ya cobrado, las cuotas, los
   gastos fijos que se le cargan y los variables que se pagan con ella. */

import { sumar, redondear } from '../dinero.js';
import { diasEntre } from '../fechas.js';
import { calcularCiclo, corteSiguiente, limiteDePago } from '../ciclo-tarjeta.js';
import { calcularDeuda } from '../deuda-tarjeta.js';
import { ocurrenciasMensuales, montoDe } from './recurrencia.js';

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

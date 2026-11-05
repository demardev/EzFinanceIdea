/* Minicuotas: pasar compras ya hechas de la tarjeta a cuotas. Función PURA.

   Un traslado es una compra a cuotas más (compras_cuotas, tipo 'minicuotas').
   Las compras originales se quedan en el historial con su categoría —ese gasto
   sí ocurrió— pero llevan `traslado_id` y dejan de ser deuda: la deuda ahora
   son las cuotas. Al revés, las cuotas son deuda pero no gasto nuevo.

   El interés es el monto que da el banco para ese plazo, nunca una tasa. Cada
   banco lo cobra distinto: como comisión aparte (cuota 0) o metido en las
   cuotas. La tarjeta solo pone los valores que vienen escritos; cada traslado
   guarda sus fechas. */

import { sumar } from './dinero.js';
import { sumarDias } from './fechas.js';
import { corteQueIncluye, corteSiguiente } from './ciclo-tarjeta.js';
import { generarCuotas } from './cuotas.js';

/** Una compra original que ya se pasó a minicuotas. */
export const esCompraTrasladada = (m) => Boolean(m.traslado_id && !m.compra_id);

/** Una cuota de un traslado (no la comisión): deuda, pero no gasto nuevo. */
export const esCuotaDeTraslado = (m) => Boolean(m.traslado_id && m.compra_id && m.cuota_num > 0);

/**
 * Lo que el banco deja trasladar: cargos del corte abierto que ya ocurrieron,
 * que no son cuotas ni se trasladaron antes. Lo más reciente primero.
 */
export function comprasTrasladables(movimientos, tarjeta, ciclo) {
  return movimientos
    .filter((m) => m.tipo === 'egreso' && m.tarjeta_id === tarjeta.id
      && !m.compra_id && !m.traslado_id && !m.saldoInicial
      && m.fecha > ciclo.fechaUltimoCorte && m.fecha <= ciclo.hoy)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}

/** Las fechas que vienen escritas en el formulario, según la tarjeta. */
export function fechasPorDefecto(tarjeta, hoy) {
  const corte = corteQueIncluye(hoy, tarjeta.dia_corte);
  const primera = {
    corte_abierto: corte,
    corte_siguiente: corteSiguiente(corte, tarjeta.dia_corte),
  }[tarjeta.minicuotas_primera] ?? sumarDias(hoy, 30);
  return { fecha_primera_cuota: primera, fecha_comision: sumarDias(hoy, 1) };
}

/** La comisión única del traslado, como un cargo más (cuota 0). */
function comision(traslado) {
  return {
    tipo: 'egreso',
    monto: Number(traslado.interes),
    fecha: traslado.fecha_comision,
    descripcion: `${traslado.descripcion} — comisión`,
    categoria_id: traslado.categoria_id ?? null,
    cuenta_id: null,
    cuenta_destino_id: null,
    tarjeta_id: traslado.tarjeta_id,
    tarjeta_destino_id: null,
    compra_id: traslado.id,
    cuota_num: 0,
    cuota_total: traslado.num_cuotas,
    comercio: null,
    traslado_id: traslado.id,
  };
}

/** Los movimientos de un traslado ya guardado: sus cuotas y, si va aparte, la comisión. */
export function generarTraslado(traslado) {
  const interes = Number(traslado.interes) || 0;
  const enCuotas = Boolean(traslado.interes_en_cuotas);
  const total = sumar(traslado.monto_total, enCuotas ? interes : 0);
  const cuotas = generarCuotas({ ...traslado, monto_total: total })
    .map((c) => ({ ...c, traslado_id: traslado.id }));
  return !enCuotas && interes > 0 ? [comision(traslado), ...cuotas] : cuotas;
}

/**
 * Cómo quedaría el traslado con las compras elegidas, para el formulario.
 * @param condiciones { num_cuotas, interes, interes_en_cuotas, fecha_primera_cuota, fecha_comision }
 */
export function previaTraslado(elegidas, condiciones) {
  const monto = sumar(...elegidas.map((m) => m.monto));
  const movs = generarTraslado({ ...condiciones, id: null, tarjeta_id: null,
                                 descripcion: 'Minicuotas', monto_total: monto });
  return {
    monto,
    cuotas: movs.filter((m) => m.cuota_num > 0),
    comision: movs.find((m) => m.cuota_num === 0) ?? null,
    totalAPagar: sumar(...movs.map((m) => m.monto)),
  };
}

/* Minicuotas: pasar compras ya hechas de la tarjeta a cuotas. Función PURA.

   Un traslado es una compra a cuotas más (compras_cuotas, tipo 'minicuotas').
   Las compras originales se quedan en el historial con su categoría —ese gasto
   sí ocurrió— pero llevan `traslado_id` y dejan de ser deuda: la deuda ahora
   son las cuotas. Al revés, las cuotas son deuda pero no gasto nuevo.

   Lo que cobra el banco son dos cosas que no se mezclan, y nunca una tasa:
   - `interes`: la comisión que cobra aparte, una sola vez (cuota 0).
   - `cuota_mensual`: la cuota que da para el plazo elegido. Si trae interés,
     es la diferencia entre lo que suman las cuotas y lo trasladado. Sin ella,
     lo trasladado se reparte entre los meses sin interés.
   Se pueden trasladar compras del corte abierto y del que acaba de cerrar. La
   tarjeta solo pone las fechas que vienen escritas; cada traslado guarda las suyas. */

import { sumar, redondear, repartir } from './dinero.js';
import { sumarDias } from './fechas.js';
import { corteQueIncluye, corteSiguiente } from './ciclo-tarjeta.js';
import { generarCuotas } from './cuotas.js';

/** Una compra original que ya se pasó a minicuotas. */
export const esCompraTrasladada = (m) => Boolean(m.traslado_id && !m.compra_id);

/** Una cuota de un traslado (no la comisión): deuda, pero no gasto nuevo. */
export const esCuotaDeTraslado = (m) => Boolean(m.traslado_id && m.compra_id && m.cuota_num > 0);

/**
 * Lo que el banco deja trasladar: cargos del corte abierto o del que acaba de
 * cerrar que ya ocurrieron, que no son cuotas ni se trasladaron antes. Lo más
 * reciente primero.
 */
export function comprasTrasladables(movimientos, tarjeta, ciclo) {
  return movimientos
    .filter((m) => m.tipo === 'egreso' && m.tarjeta_id === tarjeta.id
      && !m.compra_id && !m.traslado_id && !m.saldoInicial
      && m.fecha > ciclo.fechaCorteAnterior && m.fecha <= ciclo.hoy)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}

/** Las trasladables por corte, el abierto primero; un corte sin compras no sale. */
export function agruparPorCorte(trasladables, ciclo) {
  const abierto = (m) => m.fecha > ciclo.fechaUltimoCorte;
  return [
    { abierto: true, fechaCorte: ciclo.fechaProximoCorte, compras: trasladables.filter(abierto) },
    { abierto: false, fechaCorte: ciclo.fechaUltimoCorte,
      compras: trasladables.filter((m) => !abierto(m)) },
  ].filter((g) => g.compras.length);
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

/** Lo que suman las cuotas: la cuota del banco por el plazo, o lo trasladado si no hay. */
function totalDeCuotas(traslado) {
  const cuota = Number(traslado.cuota_mensual) || 0;
  return cuota > 0 ? redondear(cuota * traslado.num_cuotas) : Number(traslado.monto_total);
}

/** Los movimientos de un traslado ya guardado: sus cuotas y, si cobra, la comisión. */
export function generarTraslado(traslado) {
  const cuotas = generarCuotas({ ...traslado, monto_total: totalDeCuotas(traslado) })
    .map((c) => ({ ...c, traslado_id: traslado.id }));
  return Number(traslado.interes) > 0 ? [comision(traslado), ...cuotas] : cuotas;
}

/**
 * Cómo quedaría el traslado con las compras elegidas, para el formulario.
 * `interesEnCuotas` negativo quiere decir que la cuota no cubre lo trasladado.
 * @param condiciones { num_cuotas, interes, cuota_mensual, fecha_primera_cuota, fecha_comision }
 */
export function previaTraslado(elegidas, condiciones) {
  const monto = sumar(...elegidas.map((m) => m.monto));
  const traslado = { ...condiciones, id: null, tarjeta_id: null,
                     descripcion: 'Minicuotas', monto_total: monto };
  const movs = generarTraslado(traslado);
  return {
    monto,
    cuotaSinInteres: repartir(monto, condiciones.num_cuotas)[0] ?? 0,
    interesEnCuotas: sumar(totalDeCuotas(traslado), -monto),
    cuotas: movs.filter((m) => m.cuota_num > 0),
    comision: movs.find((m) => m.cuota_num === 0) ?? null,
    totalAPagar: sumar(...movs.map((m) => m.monto)),
  };
}

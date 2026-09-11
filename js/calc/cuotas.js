/* Compras a meses SIN INTERESES. Función PURA: sin red, sin DOM.

   Tasa cero: la suma de las cuotas es exactamente el monto de la compra.
   No hay campo de tasa y no debe haberlo. El residuo de la división lo
   absorbe la última cuota, así no se pierden centavos. */

import { repartir, sumar, redondear } from './dinero.js';
import { sumarMeses, hoyISO } from './fechas.js';

/** Una cuota es un egreso cargado a la tarjeta, atado a su compra. */
function cuota(compra, numero, monto) {
  return {
    tipo: 'egreso',
    monto,
    fecha: sumarMeses(compra.fecha_compra, numero - 1),
    descripcion: `${compra.descripcion} — cuota ${numero}/${compra.num_cuotas}`,
    categoria_id: compra.categoria_id ?? null,
    cuenta_id: null,
    cuenta_destino_id: null,
    tarjeta_id: compra.tarjeta_id,
    tarjeta_destino_id: null,
    compra_id: compra.id,
    cuota_num: numero,
    cuota_total: compra.num_cuotas,
    comercio: compra.comercio ?? null,
  };
}

/** Las N cuotas de una compra nueva, desde la primera. */
export function generarCuotas(compra) {
  const montos = repartir(compra.monto_total, compra.num_cuotas);
  return montos.map((monto, i) => cuota(compra, i + 1, monto));
}

/**
 * Editar una compra = borrar y regenerar sus cuotas NO cobradas. Las que ya
 * pasaron por un corte se quedan como están (ya salieron en un estado de
 * cuenta), y el monto que falta se reparte entre las que quedan.
 *
 * @returns { yaCobradas, aBorrar: [id], aCrear: [fila], aviso }
 */
export function planRegeneracion(compra, cuotasExistentes, hoy = hoyISO()) {
  const ordenadas = [...cuotasExistentes].sort((a, b) => a.cuota_num - b.cuota_num);
  const cobradas = ordenadas.filter((c) => c.fecha <= hoy);
  const pendientes = ordenadas.filter((c) => c.fecha > hoy);

  const restantes = compra.num_cuotas - cobradas.length;
  const aBorrar = pendientes.map((c) => c.id);

  if (restantes <= 0) {
    return {
      yaCobradas: cobradas.length,
      aBorrar: [],
      aCrear: [],
      aMover: [],
      aviso: `Ya se cobraron ${cobradas.length} cuotas: no se puede acortar el plazo por debajo de eso.`,
    };
  }

  /* Una compra a meses no cambia de fecha en la vida real: si cambió es que se
     registró mal, y las fechas viejas nunca fueron ciertas. Las cobradas se
     mueven a su fecha correcta; su MONTO no se toca. */
  const aMover = cobradas
    .map((c) => ({ id: c.id, fecha: sumarMeses(compra.fecha_compra, c.cuota_num - 1) }))
    .filter((m, i) => m.fecha !== cobradas[i].fecha);

  const yaPagado = sumar(...cobradas.map((c) => c.monto));
  const porRepartir = redondear(compra.monto_total - yaPagado);
  const montos = repartir(porRepartir, restantes);
  const aCrear = montos.map((monto, i) => cuota(compra, cobradas.length + i + 1, monto));

  return { yaCobradas: cobradas.length, aBorrar, aCrear, aMover, aviso: '' };
}

/** Para la lista del detalle: "3/12" y lo que falta por cobrar. */
export function progresoDeCompra(compra, cuotas, hoy = hoyISO()) {
  const propias = cuotas.filter((c) => c.compra_id === compra.id);
  const cobradas = propias.filter((c) => c.fecha <= hoy);
  const restante = sumar(...propias.filter((c) => c.fecha > hoy).map((c) => c.monto));

  /* El monto representativo es el de la cuota 1, no el del arreglo tal como
     llegue: las filas vienen ordenadas por fecha descendente, así que la
     primera sería la última cuota, justo la que absorbió el residuo. */
  const primera = propias.reduce(
    (menor, c) => (menor === null || c.cuota_num < menor.cuota_num ? c : menor), null);

  return {
    cobradas: cobradas.length,
    total: compra.num_cuotas,
    texto: `${cobradas.length}/${compra.num_cuotas}`,
    montoCuota: primera?.monto ?? 0,
    restante,
  };
}

/**
 * Quita las cuotas que ya estaban pagadas al banco cuando se registró la
 * compra. Siguen en el historial y cuentan para el progreso, pero no son
 * deuda: se pagaron antes de que la app existiera.
 */
export function sinCuotasYaPagadas(movimientos, compras) {
  const pagadas = new Map(compras.map((c) => [c.id, c.cuotas_pagadas ?? 0]));
  return movimientos.filter(
    (m) => !m.compra_id || m.cuota_num > (pagadas.get(m.compra_id) ?? 0));
}

/** ¿Esta cuota es de las que ya venían pagadas? La usa la vista para marcarla. */
export function esCuotaYaPagada(movimiento, compras) {
  if (!movimiento.compra_id) return false;
  const compra = compras.find((c) => c.id === movimiento.compra_id);
  return Boolean(compra) && movimiento.cuota_num <= (compra.cuotas_pagadas ?? 0);
}

/* Los abonos de un pago de recibo. Función PURA: sin red, sin DOM.

   Te pueden pagar en partes: una hoy en efectivo y el resto otro día en otra
   cuenta. Cada abono es { fecha, cuenta_id, monto }. La comisión es UNA por
   operación y se cubre al final: lo primero que te devuelven es tu dinero, y
   así lo ganado nunca cuenta pesos que todavía te deben. */

import { formatear, redondear, sumar } from '../calc/dinero.js';

/** Lo que te deben en total: el recibo más su comisión. */
export function totalDe(pago) {
  return sumar(pago.monto_recibo, pago.comision);
}

/* Lo cobrado antes de que existieran los abonos era un solo pago por todo.
   La base ya lo convierte, pero así una fila vieja nunca pasa por pendiente. */
export function abonosDe(pago) {
  const lista = Array.isArray(pago.abonos) ? pago.abonos : [];
  if (!lista.length && pago.fecha_cobro) {
    return [{ fecha: pago.fecha_cobro, cuenta_id: pago.cuenta_cobro_id ?? null,
              monto: totalDe(pago) }];
  }
  return [...lista].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
}

export function cobradoDe(pago) {
  return sumar(...abonosDe(pago).map((a) => a.monto));
}

/** Lo que falta por cobrar. Negativo solo si te abonaron de más. */
export function saldoDe(pago) {
  return redondear(totalDe(pago) - cobradoDe(pago));
}

/** Cada abono con cuánto fue de recibo y cuánto de comisión. */
export function repartirAbonos(pago) {
  let faltaRecibo = redondear(pago.monto_recibo);
  let faltaComision = redondear(pago.comision);
  return abonosDe(pago).map((abono) => {
    const recibo = Math.min(redondear(abono.monto), faltaRecibo);
    const comision = Math.min(redondear(abono.monto - recibo), faltaComision);
    faltaRecibo = redondear(faltaRecibo - recibo);
    faltaComision = redondear(faltaComision - comision);
    return { ...abono, recibo, comision };
  });
}

/**
 * Las columnas que dicen si la operación quedó saldada: la fecha y la cuenta
 * del abono que la completó, o null mientras falte algo.
 */
export function liquidacion(pago) {
  const abonos = abonosDe(pago);
  const ultimo = abonos[abonos.length - 1];
  if (!ultimo || saldoDe(pago) > 0) return { fecha_cobro: null, cuenta_cobro_id: null };
  return { fecha_cobro: ultimo.fecha, cuenta_cobro_id: ultimo.cuenta_id ?? null };
}

/** La operación con esta lista de abonos, y saldada o no según ella. */
export function conAbonos(pago, abonos) {
  /* Sin la liquidación vieja: si no, abonosDe() leería una operación de
     antes de los abonos como cobrada aunque ya no le quede ninguno. */
  const conLista = { ...pago, abonos, fecha_cobro: null, cuenta_cobro_id: null };
  return { ...conLista, ...liquidacion(conLista) };
}

/** `monto` en null quiere decir "todo lo que falta". */
export function agregarAbono(pago, abono) {
  const monto = abono.monto ?? saldoDe(pago);
  return conAbonos(pago, [...abonosDe(pago), { ...abono, monto }]);
}

/** @returns el mensaje para el usuario, o null si se puede guardar. */
export function problemaDeAbonos(pago) {
  const abonos = abonosDe(pago);
  if (abonos.some((a) => !(Number(a.monto) > 0))) return 'Pon cuánto te pagaron.';
  if (abonos.some((a) => !a.cuenta_id)) return 'Elige en qué cuenta te pagaron.';
  if (abonos.some((a) => a.fecha < pago.fecha_pago)) {
    return 'No te pueden haber pagado antes de que pagaras el recibo.';
  }
  const saldo = saldoDe(pago);
  if (saldo < 0) {
    return `Eso es ${formatear(-saldo)} más de lo que te deben `
         + `(${formatear(totalDe(pago))} con la comisión).`;
  }
  return null;
}

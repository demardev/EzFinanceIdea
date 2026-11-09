/* Préstamos entre personas: lo que debes y lo que te deben.
   Función PURA: sin red, sin DOM.

   Un préstamo es un total y, si lo pactaron, un pago al mes desde una fecha.
   Los abonos son movimientos normales con `prestamo_id`: el dinero sí se mueve
   en tus cuentas. Aquí solo se suma lo abonado contra lo pactado.

   `abonado_antes` es lo que se pagó antes de anotarlo en la app: no es
   movimiento, pero cuenta como abonado (también para el atraso).

   El atraso es ACUMULADO: si un mes te dio de más, eso cuenta para el
   siguiente. Así 70 + 50 + 50 va al corriente aunque el mínimo sea 50. */

import { sumarMeses, diasEntre } from './fechas.js';
import { redondear, sumar } from './dinero.js';

/** Días hacia adelante en que un pago ya avisa. */
const AVISAR_DIAS = 7;

/** El pago k (desde 1). Siempre desde el primero, para que el 31 no se corra. */
export function fechaDePago(prestamo, k) {
  return sumarMeses(prestamo.primer_pago, k - 1);
}

const tieneCalendario = (p) => Number(p.pago) > 0 && Boolean(p.primer_pago);

/** Lo que debía llevar abonado tras k pagos: nunca más que el total. */
function esperadoTras(prestamo, k) {
  return redondear(Math.min(Number(prestamo.monto_total), Number(prestamo.pago) * k));
}

/** Cuántos pagos ya vencieron ANTES de hoy (el de hoy aún no está atrasado). */
function vencidosAntesDe(prestamo, hoy) {
  let k = 0;
  while (fechaDePago(prestamo, k + 1) < hoy && esperadoTras(prestamo, k) < prestamo.monto_total) {
    k += 1;
  }
  return k;
}

/* El primer pago que todavía no está cubierto por lo abonado. */
function proximoPago(prestamo, abonado, hoy) {
  const k = Math.floor(redondear(abonado / Number(prestamo.pago)) + 1e-9) + 1;
  const fecha = fechaDePago(prestamo, k);
  return { fecha, monto: redondear(esperadoTras(prestamo, k) - abonado), atrasado: fecha < hoy };
}

/* Lo pagado antes de anotarlo no trae fechas: en pagos, cuántos completos
   alcanza con el pago pactado. Sin pago pactado no se cuentan. */
function pagosAntes(prestamo, antes) {
  return Number(prestamo.pago) > 0 ? Math.floor(redondear(antes / Number(prestamo.pago)) + 1e-9) : 0;
}

/**
 * @param abonos movimientos del préstamo: [{ monto, fecha }]
 * @returns { abonado, restante, avance (0–100), pagos, terminado, progreso, proximo, atraso }
 */
export function estadoPrestamo(prestamo, abonos, hoy) {
  const antes = Number(prestamo.abonado_antes) || 0;
  const abonado = sumar(antes, ...abonos.map((a) => a.monto));
  const restante = Math.max(0, redondear(Number(prestamo.monto_total) - abonado));
  const terminado = restante === 0;
  const avance = Math.min(100, Math.round((abonado / Number(prestamo.monto_total)) * 100));
  const pagos = abonos.length + pagosAntes(prestamo, antes);
  const progreso = prestamo.num_pagos ? `${Math.min(pagos, prestamo.num_pagos)}/${prestamo.num_pagos}` : '';
  const base = { abonado, restante, avance, pagos, terminado, progreso };

  if (terminado || !tieneCalendario(prestamo)) return { ...base, proximo: null, atraso: 0 };
  const esperado = esperadoTras(prestamo, vencidosAntesDe(prestamo, hoy));
  return {
    ...base,
    proximo: proximoPago(prestamo, abonado, hoy),
    atraso: Math.max(0, redondear(esperado - abonado)),
  };
}

function debeAvisar(estado, hoy) {
  if (!estado.proximo) return false;
  return estado.proximo.atrasado || diasEntre(hoy, estado.proximo.fecha) <= AVISAR_DIAS;
}

/**
 * @param movimientos los que traen prestamo_id (de cualquier préstamo)
 * @returns { debes, teDeben, activos, terminados, avisos } — cada uno { prestamo, estado }
 */
export function resumenPrestamos(prestamos, movimientos, hoy) {
  const todos = prestamos.map((prestamo) => ({
    prestamo,
    estado: estadoPrestamo(prestamo, movimientos.filter((m) => m.prestamo_id === prestamo.id), hoy),
  }));
  const activos = todos.filter((x) => !x.estado.terminado);
  const totalDe_ = (direccion) => sumar(...activos
    .filter((x) => x.prestamo.direccion === direccion).map((x) => x.estado.restante));
  return {
    debes: totalDe_('debo'),
    teDeben: totalDe_('me_deben'),
    activos,
    terminados: todos.filter((x) => x.estado.terminado),
    avisos: activos.filter((x) => debeAvisar(x.estado, hoy))
      .sort((a, b) => (a.estado.proximo.fecha < b.estado.proximo.fecha ? -1 : 1)),
  };
}

/** Sin total escrito, el total es el pago por el número de pagos. */
export function totalDe({ monto_total, pago, num_pagos }) {
  if (Number(monto_total) > 0) return redondear(monto_total);
  return redondear(Number(pago || 0) * Number(num_pagos || 0));
}

/** Lo que el formulario enseña mientras se llena: el total y lo que falta. */
export function cuentasDelFormulario(datos) {
  const total = totalDe(datos);
  return { total, falta: Math.max(0, redondear(total - Number(datos.abonado_antes || 0))) };
}

/** Al elegir movimientos para ligar: cuánto suman y si pasan de lo que falta. */
export function cuentasDeEleccion(movimientos, ids, restante) {
  const elegidos = movimientos.filter((m) => ids.includes(m.id));
  const total = sumar(...elegidos.map((m) => m.monto));
  return { cuantos: elegidos.length, total, sobra: Math.max(0, redondear(total - restante)) };
}

/** @returns el mensaje del problema, o null si se puede guardar */
export function validarPrestamo(datos) {
  if (!String(datos.persona || '').trim()) return 'Pon con quién es el préstamo.';
  const total = totalDe(datos);
  if (!(total > 0)) return 'Pon el total, o el pago y el número de pagos.';
  if (Number(datos.abonado_antes) >= total) return 'Lo que ya se pagó tiene que ser menos que el total.';
  if (Number(datos.pago) > 0) {
    if (!datos.primer_pago) return 'Pon la fecha del primer pago.';
    if (Number(datos.pago) > total) return 'El pago no puede ser mayor que el total.';
  }
  return null;
}

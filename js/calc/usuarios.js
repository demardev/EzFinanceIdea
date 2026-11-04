/* El panel de admin: vencimiento del premium y filtros de la lista.
   Función PURA: sin red, sin DOM. Las fechas son cadenas 'YYYY-MM-DD', que
   se comparan bien como texto. */

import { sumarMeses, formatearFecha } from './fechas.js';

/* "Sin vencimiento" es una fecha que nunca llega: así `es_premium()` en la
   base sigue siendo una sola comparación. */
export const SIN_VENCIMIENTO = '9999-12-31';

const MESES_POR_PLAZO = { mes: 1, anio: 12 };

export function esPremium(usuario, hoy) {
  return Boolean(usuario.premium_hasta) && usuario.premium_hasta >= hoy;
}

/**
 * Hasta cuándo queda el premium al darle un plazo más.
 * Si sigue vigente se suma desde su vencimiento: renovar antes no hace perder días.
 * @param plazo 'mes' | 'anio' | 'siempre'
 */
export function nuevoVencimiento(actual, plazo, hoy) {
  if (plazo === 'siempre' || actual === SIN_VENCIMIENTO) return SIN_VENCIMIENTO;
  const desde = actual && actual >= hoy ? actual : hoy;
  return sumarMeses(desde, MESES_POR_PLAZO[plazo]);
}

export function textoPremium(usuario, hoy) {
  const hasta = usuario.premium_hasta;
  if (!hasta) return 'Normal';
  if (hasta === SIN_VENCIMIENTO) return 'Premium sin vencimiento';
  if (hasta >= hoy) return `Premium hasta ${formatearFecha(hasta)}`;
  return `Normal · el premium venció el ${formatearFecha(hasta)}`;
}

const PLANES = {
  normal: (u, hoy) => !esPremium(u, hoy),
  premium: (u, hoy) => esPremium(u, hoy),
};

const ESTADOS = {
  negocio: (u) => u.negocio,
  bloqueado: (u) => u.bloqueado,
};

/**
 * @param filtros { plan: ''|'normal'|'premium', estado: ''|'negocio'|'bloqueado', texto }
 */
export function filtrarUsuarios(lista, { plan = '', estado = '', texto = '' }, hoy) {
  const aguja = texto.trim().toLowerCase();
  return lista.filter((u) =>
    (!plan || PLANES[plan](u, hoy)) &&
    (!estado || ESTADOS[estado](u)) &&
    (!aguja || String(u.email ?? '').toLowerCase().includes(aguja)));
}

export function contarUsuarios(lista, hoy) {
  const cuantos = (fn) => lista.filter((u) => fn(u, hoy)).length;
  return {
    todos: lista.length,
    normal: cuantos(PLANES.normal),
    premium: cuantos(PLANES.premium),
    negocio: cuantos(ESTADOS.negocio),
    bloqueado: cuantos(ESTADOS.bloqueado),
  };
}

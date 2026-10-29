/* Por cobrar agrupado por cliente. Función PURA: sin red, sin DOM.

   De cada operación pendiente cuenta solo lo que falta, separado en recibo y
   comisión. Como cada abono cubre primero el recibo (negocio/abonos.js), lo
   que falta de comisión es lo último que te van a pagar. */

import { redondear, sumar } from '../calc/dinero.js';
import { agregarAbono, problemaDeAbonos, repartirAbonos } from './abonos.js';
import { estaPendiente } from './pago-recibo.js';

/** Lo que falta de una operación: { recibo, comision }. */
function faltaDe(pago) {
  const partes = repartirAbonos(pago);
  return {
    recibo: redondear(pago.monto_recibo - sumar(...partes.map((a) => a.recibo))),
    comision: redondear(pago.comision - sumar(...partes.map((a) => a.comision))),
  };
}

function totales(faltas) {
  const recibos = sumar(...faltas.map((f) => f.recibo));
  const comisiones = sumar(...faltas.map((f) => f.comision));
  return { recibos, comisiones, total: sumar(recibos, comisiones) };
}

/* Por nombre; "sin cliente" (nombre null) siempre al final. */
function porNombre(a, b) {
  if (a.nombre === null) return 1;
  if (b.nombre === null) return -1;
  return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
}

/**
 * @param pagos    operaciones; las saldadas se ignoran
 * @param clientes todos, también los archivados: dan el nombre de cada grupo
 * @returns { grupos: [{ cliente_id, nombre, pagos, recibos, comisiones, total }],
 *            recibos, comisiones, total }
 *          `cliente_id` y `nombre` en null son las operaciones sin cliente.
 */
export function porCobrarPorCliente(pagos, clientes) {
  const nombres = new Map(clientes.map((c) => [c.id, c.nombre]));
  const grupos = new Map();

  pagos.filter(estaPendiente).forEach((pago) => {
    const id = nombres.has(pago.cliente_id) ? pago.cliente_id : null;
    if (!grupos.has(id)) grupos.set(id, { pagos: [], faltas: [] });
    grupos.get(id).pagos.push(pago);
    grupos.get(id).faltas.push(faltaDe(pago));
  });

  const lista = [...grupos].map(([id, g]) => ({
    cliente_id: id, nombre: id === null ? null : nombres.get(id),
    pagos: g.pagos, ...totales(g.faltas),
  }));
  return { grupos: lista.sort(porNombre), ...totales([...grupos.values()].flatMap((g) => g.faltas)) };
}

/**
 * "Cobrar todo" a un cliente: cada operación recibe un abono por lo que le
 * falta, todos el mismo día y en la misma cuenta. O se pueden todas o
 * ninguna, para no dejar a medias un cobro que fue uno solo.
 * @returns { pagos: las operaciones saldadas, problema: texto o null }
 */
export function saldarTodos(pagos, { fecha, cuenta_id }) {
  const nuevos = pagos.map((p) => agregarAbono(p, { fecha, cuenta_id: cuenta_id || null, monto: null }));
  const problema = nuevos.map(problemaDeAbonos).find(Boolean) ?? null;
  return problema ? { pagos: [], problema } : { pagos: nuevos, problema: null };
}

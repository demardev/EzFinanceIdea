/* Las últimas operaciones del negocio. Función PURA: sin red, sin DOM.

   Van por el día en que pagaste el recibo, que es cuando pasó; si una se
   registró días después sigue saliendo en su día. El mismo día, primero la
   que registraste después. */

import { saldoDe, totalDe } from './abonos.js';

const masReciente = (a, b) =>
  (a.fecha_pago === b.fecha_pago
    ? String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
    : b.fecha_pago.localeCompare(a.fecha_pago));

/** @returns [{ ...pago, total, saldo, cobrada }], las `cuantas` más recientes */
export function ultimasOperaciones(pagos, cuantas = 5) {
  return [...pagos].sort(masReciente).slice(0, cuantas).map((p) => {
    const saldo = saldoDe(p);
    return { ...p, total: totalDe(p), saldo, cobrada: saldo <= 0 };
  });
}

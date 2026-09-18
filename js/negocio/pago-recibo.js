/* Un pago de recibo y los movimientos que genera. Función PURA: sin red,
   sin DOM.

   Al PAGAR sale el dinero de tu cuenta. Después te lo devuelven en uno o
   varios abonos, cada uno con su fecha y su cuenta; cómo se reparte cada
   abono entre recibo y comisión lo decide negocio/abonos.js. Mientras falte
   algo, esos pesos están en la calle. */

import { redondear, sumar } from '../calc/dinero.js';
import { mesDe } from '../calc/fechas.js';
import { repartirAbonos, saldoDe } from './abonos.js';

/* Las columnas de ruteo que cada movimiento no usa van en nulo, igual que en
   movimientos/tipos.js: si no, un PATCH dejaría restos del tipo anterior. */
const SIN_RUTEO = {
  cuenta_id: null, cuenta_destino_id: null, tarjeta_id: null, tarjeta_destino_id: null,
};

function movimiento(pago, extra) {
  return {
    ...SIN_RUTEO,
    ambito: 'negocio',
    pago_id: pago.id,
    nota: pago.nota || null,
    ...extra,
  };
}

/* La descripción la escribes tú —casi siempre el nombre del cliente— y es por
   donde vas a buscar después, así que encabeza los tres movimientos. Si no la
   pusiste, queda solo el texto genérico. */
function textoDe(pago, generico) {
  const suyo = String(pago.descripcion || '').trim();
  return suyo ? `${suyo} — ${generico.toLowerCase()}` : generico;
}

export function estaPendiente(pago) {
  return saldoDe(pago) > 0;
}

/**
 * @param categorias { pago, cobro, comision } — ids de las categorías del negocio
 */
export function movimientosDePago(pago, categorias = {}) {
  const movs = [movimiento(pago, {
    tipo: 'egreso',
    monto: redondear(pago.monto_recibo),
    fecha: pago.fecha_pago,
    descripcion: textoDe(pago, 'Pago de recibo'),
    categoria_id: categorias.pago ?? null,
    cuenta_id: pago.cuenta_pago_id ?? null,
  })];

  const ingreso = (abono, monto, generico, categoria) => movimiento(pago, {
    tipo: 'ingreso',
    monto,
    fecha: abono.fecha,
    descripcion: textoDe(pago, generico),
    categoria_id: categoria ?? null,
    cuenta_id: abono.cuenta_id ?? null,
  });

  /* Un abono puede traer recibo, comisión o las dos; una parte en cero no
     se vuelve un movimiento. */
  repartirAbonos(pago).forEach((abono) => {
    if (abono.recibo > 0) movs.push(ingreso(abono, abono.recibo, 'Cobro de recibo', categorias.cobro));
    if (abono.comision > 0) movs.push(ingreso(abono, abono.comision, 'Comisión', categorias.comision));
  });
  return movs;
}

/** Lo que te deben: de cada operación sin saldar, lo que le falta. */
export function totalPorCobrar(pagos) {
  return sumar(...pagos.filter(estaPendiente).map(saldoDe));
}

/**
 * Del negocio importan dos números distintos, y "entró/salió" miente en los
 * dos: MOVIDO es lo que pasó por tus manos, GANADO son las comisiones que ya
 * cobraste. Se cuentan por fechas distintas a propósito.
 */
export function totalesDeNegocio(pagos, mes) {
  const pagados = pagos.filter((p) => mesDe(p.fecha_pago) === mes);
  const comisiones = pagos.flatMap(repartirAbonos)
    .filter((a) => mesDe(a.fecha) === mes).map((a) => a.comision);
  return {
    movido: sumar(...pagados.map((p) => p.monto_recibo)),
    ganado: sumar(...comisiones),
    operaciones: pagados.length,
  };
}

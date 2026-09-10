/* Un pago de recibo y los movimientos que genera. Función PURA: sin red,
   sin DOM.

   La operación tiene dos momentos. Al PAGAR sale el dinero de tu cuenta; al
   COBRAR entra el monto más la comisión, con la fecha real del cobro. Mientras
   no te paguen, solo existe el egreso y esos pesos están en la calle. */

import { redondear, sumar } from '../calc/dinero.js';
import { mesDe } from '../calc/fechas.js';

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
  return !pago.fecha_cobro;
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

  if (estaPendiente(pago)) return movs;

  movs.push(movimiento(pago, {
    tipo: 'ingreso',
    monto: redondear(pago.monto_recibo),
    fecha: pago.fecha_cobro,
    descripcion: textoDe(pago, 'Cobro de recibo'),
    categoria_id: categorias.cobro ?? null,
    cuenta_id: pago.cuenta_cobro_id ?? null,
  }));

  if (Number(pago.comision) > 0) {
    movs.push(movimiento(pago, {
      tipo: 'ingreso',
      monto: redondear(pago.comision),
      fecha: pago.fecha_cobro,
      descripcion: textoDe(pago, 'Comisión'),
      categoria_id: categorias.comision ?? null,
      cuenta_id: pago.cuenta_cobro_id ?? null,
    }));
  }
  return movs;
}

/** Lo que te deben: el recibo más su comisión, de todo lo no cobrado. */
export function totalPorCobrar(pagos) {
  return sumar(...pagos.filter(estaPendiente)
    .map((p) => sumar(p.monto_recibo, p.comision)));
}

/**
 * Del negocio importan dos números distintos, y "entró/salió" miente en los
 * dos: MOVIDO es lo que pasó por tus manos, GANADO son las comisiones que ya
 * cobraste. Se cuentan por fechas distintas a propósito.
 */
export function totalesDeNegocio(pagos, mes) {
  const pagados = pagos.filter((p) => mesDe(p.fecha_pago) === mes);
  const cobrados = pagos.filter((p) => p.fecha_cobro && mesDe(p.fecha_cobro) === mes);
  return {
    movido: sumar(...pagados.map((p) => p.monto_recibo)),
    ganado: sumar(...cobrados.map((p) => p.comision)),
    operaciones: pagados.length,
  };
}

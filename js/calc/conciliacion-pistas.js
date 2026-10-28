/* Las pistas de una conciliación: lo que suele explicar que la app y el banco
   no digan lo mismo. Función PURA: sin red, sin DOM.

   Cada pista lleva su `efecto`: cuánto cambiaría el saldo de la app si la
   pista resulta cierta y la corriges. Con eso se busca la combinación que da
   la diferencia al centavo, que es casi siempre la respuesta. */

import { redondear } from './dinero.js';
import { sumarDias } from './fechas.js';
import { fijosPorCargar } from './fijos-tarjeta.js';

/* Compras de estos días antes del corte pueden caer en el siguiente: el
   banco las aplica uno o dos días después de hechas. */
const DIAS_ANTES_DEL_CORTE = 2;
/* Un pago de lo mismo pocos días después de una compra suele ser un pedido
   cancelado que se registró como pago. */
const DIAS_CANCELACION = 7;
/* 2^16 combinaciones todavía es instantáneo; más pistas que eso no ayudan. */
const MAX_PISTAS = 16;

const esCargo = (m) => m.tipo === 'egreso' && !m.saldoInicial;
const esPago = (m) => m.tipo === 'transferencia';

function deFijos(entrada, ciclo, hastaFecha) {
  return fijosPorCargar(entrada.tarjeta, entrada.planItems, entrada.deudores, ciclo)
    .filter((p) => p.fecha <= hastaFecha)
    .map((p) => ({ clase: 'fijo', nombre: p.item.nombre, fecha: p.fecha,
                   monto: p.monto, efecto: p.monto, item: p.item }));
}

const deMovimiento = (clase, m, efecto) =>
  ({ clase, nombre: m.descripcion, fecha: m.fecha, monto: m.monto, efecto, mov: m });

/** Hoy: fijos que faltan y cuotas que el banco quizá todavía no carga. */
export function pistasDeHoy(entrada) {
  const { ciclo, deudores } = entrada;
  const cuotas = deudores.filter((m) => esCargo(m) && m.compra_id
    && m.fecha > ciclo.fechaUltimoCorte && m.fecha <= ciclo.hoy);
  return [
    ...deFijos(entrada, ciclo, ciclo.hoy),
    ...cuotas.map((m) => deMovimiento('cuota', m, -m.monto)),
  ];
}

/** Al corte: lo pegado al corte que el banco pudo aplicar después, y fijos del ciclo cerrado. */
export function pistasDelCorte(entrada) {
  const { ciclo, deudores } = entrada;
  const corte = ciclo.fechaUltimoCorte;
  const desde = sumarDias(corte, -DIAS_ANTES_DEL_CORTE);
  const pegados = deudores.filter((m) => !m.compra_id && m.fecha >= desde && m.fecha <= corte);
  const cerrado = { hoy: ciclo.hoy, fechaUltimoCorte: ciclo.fechaCorteAnterior,
                    fechaProximoCorte: corte };
  return [
    ...pegados.filter(esCargo).map((m) => deMovimiento('cargo-corte', m, -m.monto)),
    ...pegados.filter(esPago).map((m) => deMovimiento('pago-corte', m, m.monto)),
    ...deFijos(entrada, cerrado, corte),
  ];
}

/** Compra y pago del mismo monto, el pago pocos días después. Cada pago se usa una vez. */
export function posiblesCancelaciones({ deudores, ciclo }) {
  const recientes = deudores.filter((m) => m.fecha > ciclo.fechaCorteAnterior);
  const usados = new Set();
  return recientes.filter((m) => esCargo(m) && !m.compra_id).flatMap((cargo) => {
    const limite = sumarDias(cargo.fecha, DIAS_CANCELACION);
    const pago = recientes.find((p) => esPago(p) && !usados.has(p)
      && redondear(p.monto) === redondear(cargo.monto)
      && p.fecha >= cargo.fecha && p.fecha <= limite);
    if (!pago) return [];
    usados.add(pago);
    return [{ cargo, pago }];
  });
}

/**
 * Índices de la combinación de efectos que suma justo `objetivo`, la de menos
 * elementos. [] si el objetivo es cero; null si ninguna lo da.
 */
export function combinacionExacta(efectos, objetivo) {
  const meta = Math.round(redondear(objetivo) * 100);
  if (meta === 0) return [];
  const centavos = efectos.slice(0, MAX_PISTAS).map((e) => Math.round(redondear(e) * 100));
  let mejor = null;
  for (let mascara = 1; mascara < 2 ** centavos.length; mascara++) {
    const indices = centavos.map((_, i) => i).filter((i) => mascara & (1 << i));
    if (mejor && indices.length >= mejor.length) continue;
    const suma = indices.reduce((t, i) => t + centavos[i], 0);
    if (suma === meta) mejor = indices;
  }
  return mejor;
}

/* Lo que la IA leyó de un estado de cuenta. Función PURA: sin red, sin DOM.

   La IA lee (cualquier banco, cualquier formato); el código decide si lo leído
   es creíble. Un estado de cuenta se comprueba solo:
     saldo anterior + cargos − créditos + intereses fuera de la lista
       = saldo al corte que dice el mismo estado de cuenta.
   Si no da, la IA leyó mal algo y no se usa. Así un monto inventado o mal
   leído no llega nunca a tus datos.

   La usan la Edge Function `leer-estado` (para limpiar la respuesta) y la
   pantalla (para el veredicto). */

import { redondear, sumar } from './dinero.js';
import { partes, ultimoDiaDelMes } from './fechas.js';

const SENTIDOS = ['cargo', 'credito'];

function fechaValida(valor, campo) {
  if (valor === null || valor === undefined || valor === '') return null;
  const texto = String(valor);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) throw new Error(`Fecha inválida en ${campo}: ${texto}`);
  const { anio, mes, dia } = partes(texto);
  if (mes < 1 || mes > 12 || dia < 1 || dia > ultimoDiaDelMes(anio, mes)) {
    throw new Error(`Fecha inválida en ${campo}: ${texto}`);
  }
  return texto;
}

function numero(valor, campo) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new Error(`Monto inválido en ${campo}.`);
  }
  return redondear(valor);
}

function movimiento(m, i) {
  if (!m || typeof m !== 'object') throw new Error(`Movimiento ${i + 1} inválido.`);
  const monto = numero(m.monto, `el movimiento ${i + 1}`);
  if (monto < 0) throw new Error(`El movimiento ${i + 1} tiene monto negativo.`);
  if (!SENTIDOS.includes(m.sentido)) throw new Error(`El movimiento ${i + 1} no dice si es cargo o crédito.`);
  return {
    fecha: fechaValida(m.fecha, `el movimiento ${i + 1}`),
    concepto: String(m.concepto ?? '').trim(),
    monto,
    sentido: m.sentido,
  };
}

/**
 * Deja la respuesta de la IA en una forma fija, o lanza un Error si no sirve.
 * Las líneas en cero (puntos, cashback) se quitan: no mueven el saldo.
 */
export function normalizarLectura(crudo) {
  if (!crudo || typeof crudo !== 'object') throw new Error('La lectura vino vacía.');
  /* La forma es obligatoria, así que la IA contesta aunque el documento sea
     otra cosa: todo en cero "cuadraría". Por eso dice si lo es, y sin fecha de
     corte tampoco se acepta. */
  if (crudo.es_estado_de_cuenta === false) {
    throw new Error('Ese documento no parece un estado de cuenta de tarjeta.');
  }
  if (!Array.isArray(crudo.movimientos)) throw new Error('La lectura no trae movimientos.');
  const fechaCorte = fechaValida(crudo.fecha_corte, 'la fecha de corte');
  if (!fechaCorte) throw new Error('No se encontró la fecha de corte en el documento.');
  return {
    banco: crudo.banco ? String(crudo.banco).trim() : null,
    moneda: crudo.moneda ? String(crudo.moneda).trim() : null,
    fecha_corte: fechaCorte,
    fecha_limite_pago: fechaValida(crudo.fecha_limite_pago, 'la fecha límite'),
    saldo_anterior: numero(crudo.saldo_anterior, 'el saldo anterior'),
    saldo_al_corte: numero(crudo.saldo_al_corte, 'el saldo al corte'),
    intereses_fuera_de_lista: numero(crudo.intereses_fuera_de_lista ?? 0, 'los intereses'),
    pago_contado: crudo.pago_contado === null || crudo.pago_contado === undefined
      ? null : numero(crudo.pago_contado, 'el pago de contado'),
    movimientos: crudo.movimientos.map(movimiento).filter((m) => m.monto > 0),
  };
}

/** ¿Lo leído da el saldo al corte del banco? `diferencia` = calculado − banco. */
export function revisarLectura(lectura) {
  const total = (sentido) => sumar(...lectura.movimientos
    .filter((m) => m.sentido === sentido).map((m) => m.monto));
  const cargos = total('cargo');
  const creditos = total('credito');
  const intereses = lectura.intereses_fuera_de_lista;
  const calculado = redondear(lectura.saldo_anterior + cargos - creditos + intereses);
  const diferencia = redondear(calculado - lectura.saldo_al_corte);
  return { cargos, creditos, intereses, calculado, diferencia, cuadra: diferencia === 0 };
}

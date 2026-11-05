/* Lo que la bandeja y el Resumen arman igual a partir de lo recibido: las
   entradas (lo juntado ya junto), su borrador y cuáles son un gasto fijo del
   plan. El Resumen lo usa para que el vencimiento sepa que su cargo ya llegó;
   la bandeja, para llenarlo con el nombre del plan. */

import { conAviso } from '../../calc/bandeja.js';
import { juntarPendientes, borradorDeEntrada } from '../../calc/avisos/juntar.js';
import { emparejarFijos, conFijo, marcarPorConfirmar } from '../../calc/fijos-bandeja.js';
import { leerSeparados } from './bandeja-filas.js';

/**
 * @param recibidos  los de bandeja.pendientes()
 * @param origenes   lo aprendido de Wallet y de los avisos
 * @param categorias { aprendidas, historial }; el Resumen no los necesita
 * @param plan       { planItems, registrados }
 */
export function prepararEntradas(recibidos, origenes, categorias = {},
                                 { planItems = [], registrados = [] } = {}) {
  const items = recibidos.map((item) => conAviso(item));
  const entradas = juntarPendientes(items, origenes, leerSeparados());
  const base = new Map(entradas.map((e) => [e.id, borradorDeEntrada(e, origenes, categorias)]));
  const pares = emparejarFijos(entradas, base, planItems, registrados);
  const borradores = new Map(entradas.map((e) => [e.id, conFijo(base.get(e.id), pares.get(e.id))]));
  return { items, entradas, borradores, pares };
}

/**
 * Los vencimientos con `porConfirmar` en el gasto fijo cuyo cargo ya está en
 * la bandeja. Si algo falla se quedan como venían: es un extra, no debe
 * tumbar el Resumen.
 */
export async function marcarLlegados(contexto, vencimientos, recibidos, plan) {
  if (!recibidos.length) return vencimientos;
  try {
    const origenes = await contexto.bandeja.origenes();
    return marcarPorConfirmar(vencimientos, prepararEntradas(recibidos, origenes, {}, plan).pares);
  } catch {
    return vencimientos;
  }
}

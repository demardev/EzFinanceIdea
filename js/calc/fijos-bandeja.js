/* ¿Lo que llegó a Por confirmar es un gasto fijo del plan? Función PURA:
   sin red, sin DOM.

   Un cargo es un fijo si es egreso, trae su monto exacto, cae a lo más
   DERIVA días de su fecha y no viene de otra cuenta. El nombre del banco
   ("ANTHROPIC* CLAUDE SUB") casi nunca es el del plan ("Claude"), así que
   se compara sin espacios ni signos. Con el nombre es seguro; sin él, solo
   si ningún otro fijo tiene ese monto, y entonces no se registra solo.

   Así el cargo se registra con el nombre del plan y su aviso deja de salir
   en Próximos vencimientos (plan/registrado.js lo reconoce por el nombre). */

import { sumarDias, diasEntre } from './fechas.js';
import { ocurrenciasMensuales } from './plan/recurrencia.js';
import { coincide } from './plan/registrado.js';
import { esFijoActivo } from './fijos-tarjeta.js';
import { limpiar } from './avisos/partes.js';

const DERIVA = 10;

const centavos = (monto) => Math.round(Number(monto) * 100);
const compacto = (texto) => limpiar(texto).toLowerCase().replace(/[^a-z0-9]/g, '');

/** 'tarjeta:<id>' o 'cuenta:<id>' del item, como el origen del formulario. */
export const origenDeItem = (item) => (item.tarjeta_id ? `tarjeta:${item.tarjeta_id}`
  : item.cuenta_id ? `cuenta:${item.cuenta_id}` : '');

/** ¿El texto del banco trae el nombre del plan, o una palabra de 4 letras o más? */
export function nombreParecido(texto, nombre) {
  const donde = compacto(texto);
  const entero = compacto(nombre);
  if (!donde || !entero) return false;
  if (donde.includes(entero)) return true;
  return limpiar(nombre).split(' ').map(compacto)
    .some((palabra) => palabra.length >= 4 && donde.includes(palabra));
}

/* La fecha del plan más cercana al cargo, o null si ninguna cae cerca. */
function fechaDelPlan(item, fecha) {
  const cerca = ocurrenciasMensuales(item.dia_mes, sumarDias(fecha, -DERIVA),
                                     sumarDias(fecha, DERIVA));
  const lejania = (f) => Math.abs(diasEntre(fecha, f));
  return cerca.sort((a, b) => lejania(a) - lejania(b))[0] ?? null;
}

function cuadra(item, borrador) {
  const origen = origenDeItem(item);
  return esFijoActivo(item) && item.dia_mes && centavos(item.monto) === centavos(borrador.monto)
    && (!borrador.origen || !origen || borrador.origen === origen);
}

/* El candidato de una entrada: el único seguro, o el único a secas. */
function candidatoDe(entrada, borrador, planItems) {
  if (borrador?.tipo !== 'egreso' || !(borrador.monto > 0)) return null;
  const todos = planItems.filter((item) => cuadra(item, borrador))
    .map((item) => ({ item, fecha: fechaDelPlan(item, borrador.fecha),
                      seguro: nombreParecido(entrada.comercio, item.nombre) }))
    .filter((c) => c.fecha);
  const seguros = todos.filter((c) => c.seguro);
  if (seguros.length) return seguros.length === 1 ? seguros[0] : null;
  return todos.length === 1 ? todos[0] : null;
}

function registradoCerca(item, fecha, registrados) {
  const desde = sumarDias(fecha, -DERIVA);
  const hasta = sumarDias(fecha, DERIVA);
  return registrados.some((m) => m.fecha >= desde && m.fecha <= hasta && coincide(item, m));
}

/**
 * @param entradas    las de la bandeja (juntarPendientes)
 * @param borradores  Map id → borradorDeEntrada(), antes de conFijo()
 * @param registrados movimientos cercanos, para saber si ya lo registraste
 * @returns Map id → { item, fecha, seguro, registrado, origenConocido }.
 *          Cada fecha de un fijo se la lleva una sola entrada: la segura.
 */
export function emparejarFijos(entradas, borradores, planItems, registrados = []) {
  const candidatos = entradas
    .map((e) => ({ id: e.id, borrador: borradores.get(e.id),
                   par: candidatoDe(e, borradores.get(e.id), planItems) }))
    .filter((c) => c.par)
    .sort((a, b) => Number(b.par.seguro) - Number(a.par.seguro));
  const usados = new Set();
  const pares = new Map();
  for (const { id, borrador, par } of candidatos) {
    const clave = `${par.item.id}|${par.fecha}`;
    if (usados.has(clave)) continue;
    usados.add(clave);
    pares.set(id, { ...par, registrado: registradoCerca(par.item, par.fecha, registrados),
                    origenConocido: Boolean(borrador.origen) });
  }
  return pares;
}

/** El borrador con el nombre y la categoría del plan; la cuenta del aviso manda. */
export function conFijo(borrador, par) {
  if (!par) return borrador;
  return { ...borrador, descripcion: par.item.nombre,
           categoria_id: par.item.categoria_id || borrador.categoria_id,
           origen: borrador.origen || origenDeItem(par.item) };
}

/** Cada gasto de Próximos vencimientos con su cargo pendiente en la bandeja. */
export function marcarPorConfirmar(vencimientos, pares) {
  const pendientes = [...pares].filter(([, par]) => !par.registrado);
  return vencimientos.map((v) => {
    if (v.clase !== 'gasto' || !v.item) return v;
    const hallado = pendientes.find(([, p]) => p.item.id === v.item.id && p.fecha === v.fecha);
    return hallado ? { ...v, porConfirmar: hallado[0] } : v;
  });
}

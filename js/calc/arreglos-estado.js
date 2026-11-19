/* De las diferencias con el estado de cuenta (calc/emparejar-estado.js) a
   arreglos concretos. Función PURA: sin red, sin DOM. Los aplica
   pages/tarjetas/arreglos.js, solo con la confirmación del usuario.

   Montos y fechas salen siempre de lo leído del banco. Lo que pide algo que
   el banco no dice (de qué cuenta salió un pago) o que es generado (una cuota)
   no se toca: queda como "manual" con la razón. Lo que sobra nunca se borra
   solo: puede ser del corte siguiente. */

import { sumarMeses } from './fechas.js';
import { fechaDeCuota } from './fecha-cuota.js';
import { emparejarEstado } from './emparejar-estado.js';

const NOTA = 'Agregado por el asistente desde el estado de cuenta';
const SIN_RUTEO = { cuenta_id: null, cuenta_destino_id: null, tarjeta_destino_id: null };

function categoria(categorias, tipo, ...patrones) {
  for (const patron of patrones) {
    const encontrada = categorias.find((c) => c.tipo === tipo && patron.test(c.nombre));
    if (encontrada) return encontrada.id;
  }
  return null;
}

/** Lo que falta en la app: un cargo o un reembolso nuevo, o manual con su razón. */
function arregloDeFalta({ linea }, { lectura, tarjeta, categorias }) {
  if (linea.cuota) return { manual: 'Es una cuota que la app no tiene: revisa esa compra a cuotas.' };
  if (linea.sentido === 'credito' && /minicuota/i.test(linea.concepto)) {
    return { manual: 'Es un crédito de minicuotas: pasa esas compras a minicuotas desde la tarjeta.' };
  }
  /* "BONIFICACION PAGO SALDO" dice "pago" y es una bonificación, no un pago. */
  const devolucion = /bonific|devoluc|reembols|reverso|cashback/i.test(linea.concepto);
  if (linea.sentido === 'credito' && !devolucion && /\bpago\b/i.test(linea.concepto)) {
    return { manual: 'Es un pago: regístralo con "Pagar" para elegir de qué cuenta salió.' };
  }
  const cargo = linea.sentido === 'cargo';
  const fila = {
    tipo: cargo ? 'egreso' : 'ingreso', monto: linea.monto, ...SIN_RUTEO, tarjeta_id: tarjeta.id,
    fecha: linea.fecha ?? lectura.fecha_corte, nota: NOTA,
    descripcion: linea.esInteres ? 'Intereses' : linea.concepto,
    categoria_id: cargo
      ? (linea.esInteres ? categoria(categorias, 'egreso', /inter[eé]s/i, /otro gasto/i) : null)
      : categoria(categorias, 'ingreso', /reembolso/i),
  };
  return { tipo: cargo ? 'agregar_cargo' : 'agregar_reembolso', nombre: fila.descripcion, fila, linea };
}

/**
 * La primera cuota que pone la cuota n en la fecha del banco, y cuántas "ya
 * pagadas" hacen que hoy cuenten las mismas cuotas cobradas que antes: el
 * banco ya cobró las que cobró, mover fechas no cambia eso.
 */
function fijarPrimeraCuota(compra, linea, { movimientos, hoy }) {
  const nueva = { ...compra, fecha_primera_cuota: sumarMeses(linea.fecha, -(linea.cuota.num - 1)) };
  const suyas = movimientos.filter((m) => m.compra_id === compra.id && m.cuota_num > 0);
  const cobradas = (pagadas, fechaDe) => suyas
    .filter((m) => m.cuota_num > pagadas && fechaDe(m) <= hoy).length;
  const antes = cobradas(compra.cuotas_pagadas, (m) => m.fecha);
  const pagadas = Array.from({ length: compra.num_cuotas + 1 }, (_, p) => p)
    .sort((a, b) => Math.abs(a - compra.cuotas_pagadas) - Math.abs(b - compra.cuotas_pagadas))
    .find((p) => cobradas(p, (m) => fechaDeCuota(nueva, m.cuota_num)) === antes)
    ?? compra.cuotas_pagadas;
  return {
    tipo: 'fijar_primera_cuota', compraId: compra.id, nombre: compra.descripcion, linea,
    cambios: { fecha_primera_cuota: nueva.fecha_primera_cuota, cuotas_pagadas: pagadas },
    antes: { fecha_primera_cuota: compra.fecha_primera_cuota ?? null, cuotas_pagadas: compra.cuotas_pagadas },
  };
}

/** Lo que está distinto: corregir monto o fecha, o mover las cuotas de su compra. */
function arregloDeDistinto({ linea, movimiento, motivo }, entrada) {
  if (motivo === 'cuota') {
    const compra = entrada.compras.find((c) => c.id === movimiento.compra_id);
    if (!compra || !linea.fecha) return { manual: 'No se sabe en qué fecha la cobra el banco.' };
    return fijarPrimeraCuota(compra, linea, entrada);
  }
  if (movimiento.compra_id) return { manual: 'Es una cuota generada: corrige la compra a cuotas.' };
  if (motivo === 'monto') {
    return { tipo: 'corregir_monto', movimientoId: movimiento.id, nombre: movimiento.descripcion, linea,
             cambios: { monto: linea.monto }, antes: { monto: movimiento.monto } };
  }
  if (!linea.fecha) return { manual: 'El banco no dice la fecha.' };
  return { tipo: 'mover_fecha', movimientoId: movimiento.id, nombre: movimiento.descripcion, linea,
           cambios: { fecha: linea.fecha }, antes: { fecha: movimiento.fecha } };
}

/**
 * @param resultado de emparejarEstado()
 * @param entrada   { lectura, tarjeta, movimientos, compras, categorias, hoy }
 * @returns { arreglos: [...], manuales: [{ item, motivo }] }
 */
export function proponerArreglos(resultado, entrada) {
  const arreglos = [];
  const manuales = [];
  const anotar = (item, arreglo) => {
    if (arreglo.manual) manuales.push({ item, motivo: arreglo.manual });
    else if (!(arreglo.compraId && arreglos.some((a) => a.compraId === arreglo.compraId))) {
      arreglos.push({ ...arreglo, id: `a${arreglos.length + 1}` });
    }
  };
  resultado.faltan.forEach((f) => anotar(f, arregloDeFalta(f, entrada)));
  resultado.distintos.forEach((d) => anotar(d, arregloDeDistinto(d, entrada)));
  return { arreglos, manuales };
}

/** Los datos como quedarían con esos arreglos, sin tocar los originales. */
export function aplicarEnMemoria(arreglos, { movimientos, compras }) {
  let movs = [...movimientos];
  let comps = [...compras];
  for (const a of arreglos) {
    if (a.fila) movs.push({ ...a.fila, id: `nuevo-${a.id}` });
    if (a.movimientoId) movs = movs.map((m) => (m.id === a.movimientoId ? { ...m, ...a.cambios } : m));
    if (a.compraId) {
      comps = comps.map((c) => (c.id === a.compraId ? { ...c, ...a.cambios } : c));
      const compra = comps.find((c) => c.id === a.compraId);
      movs = movs.map((m) => (m.compra_id === a.compraId && m.cuota_num > 0
        ? { ...m, fecha: fechaDeCuota(compra, m.cuota_num) } : m));
    }
  }
  return { movimientos: movs, compras: comps };
}

/** Cómo quedaría la comparación con los arreglos elegidos. */
export function comprobarArreglos(arreglos, entrada) {
  return emparejarEstado({ ...entrada, ...aplicarEnMemoria(arreglos, entrada) });
}

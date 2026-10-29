/* ¿Ya registraste el movimiento de un item del plan? Función PURA.

   No hay liga entre el movimiento y el item, así que se reconoce por el
   nombre o, si se lo cambiaste, por categoría y monto. Lo usan el plan —para
   no contar dos veces un sueldo que ya está en el saldo— y los avisos del
   Resumen, para que dejen de aparecer. */

import { sumarDias } from '../fechas.js';

/* El sueldo llega antes, la renta se paga antes: unos días antes cuentan
   como el de esa fecha. Y unos días después también, por si se atrasó. */
export const ADELANTO = 10;
export const GRACIA = 3;

const normal = (texto) => String(texto || '').trim().toLowerCase();
const TIPO_DE_CLASE = { ingreso: 'ingreso', gasto: 'egreso' };

function montoCuadra(item, monto) {
  if (item.variabilidad !== 'variable') return monto === Number(item.monto);
  return monto >= Number(item.monto_min) && monto <= Number(item.monto_max);
}

export function coincide(item, m) {
  return m.tipo === TIPO_DE_CLASE[item.clase]
    && (normal(m.descripcion) === normal(item.nombre)
        || Boolean(item.categoria_id && m.categoria_id === item.categoria_id
                   && montoCuadra(item, Number(m.monto))));
}

/** ¿Hay un movimiento de este item cerca de esa fecha? */
export function yaRegistrado(item, fecha, registrados) {
  const desde = sumarDias(fecha, -ADELANTO);
  const hasta = sumarDias(fecha, GRACIA);
  return registrados.some((m) => m.fecha >= desde && m.fecha <= hasta && coincide(item, m));
}

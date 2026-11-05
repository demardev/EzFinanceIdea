/* Lo de minicuotas en el formulario de la tarjeta: si las permite y lo que
   suele hacer su banco. Son solo los valores que vienen escritos al trasladar;
   cada traslado puede cambiarlos (ver calc/minicuotas.js). */

import { campoSelect, campoInterruptor } from '../../ui/campos.js';

const PRIMERA = [
  ['dias_30', '30 días después del traslado'],
  ['corte_abierto', 'En el corte abierto'],
  ['corte_siguiente', 'En el corte siguiente'],
];
const INTERES = [
  ['comision', 'Una comisión aparte, una sola vez'],
  ['en_cuotas', 'Metido en las cuotas'],
];

export function camposMinicuotas(t) {
  return `
    ${campoInterruptor({
      nombre: 'minicuotas', etiqueta: 'Permite minicuotas', activo: Boolean(t.minicuotas),
      ayuda: 'Pasar compras ya hechas a cuotas desde el menú de la tarjeta.',
    })}
    ${campoSelect({ nombre: 'minicuotas_primera', etiqueta: 'Primera minicuota',
                    valor: t.minicuotas_primera ?? 'dias_30', opciones: PRIMERA })}
    ${campoSelect({ nombre: 'minicuotas_interes', etiqueta: 'El interés de minicuotas va',
                    valor: t.minicuotas_interes ?? 'comision', opciones: INTERES })}`;
}

const valido = (opciones, valor) => (opciones.some(([v]) => v === valor) ? valor : opciones[0][0]);

export function minicuotasDe(datos) {
  return {
    minicuotas: Boolean(datos.minicuotas),
    minicuotas_primera: valido(PRIMERA, datos.minicuotas_primera),
    minicuotas_interes: valido(INTERES, datos.minicuotas_interes),
  };
}

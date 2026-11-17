/* Lo de minicuotas en el formulario de la tarjeta: si las permite y cuándo
   suele caer la primera cuota. Es solo el valor que viene escrito al trasladar;
   cada traslado puede cambiarlos (ver calc/minicuotas.js). */

import { campoSelect, campoInterruptor } from '../../ui/campos.js';

const PRIMERA = [
  ['dias_30', '30 días después del traslado'],
  ['corte_abierto', 'En el corte abierto'],
  ['corte_siguiente', 'En el corte siguiente'],
];

export function camposMinicuotas(t) {
  return `
    ${campoInterruptor({
      nombre: 'minicuotas', etiqueta: 'Permite minicuotas', activo: Boolean(t.minicuotas),
      ayuda: 'Pasar compras ya hechas a cuotas desde el menú de la tarjeta.',
    })}
    ${campoSelect({ nombre: 'minicuotas_primera', etiqueta: 'Primera minicuota',
                    valor: t.minicuotas_primera ?? 'dias_30', opciones: PRIMERA })}`;
}

const valido = (opciones, valor) => (opciones.some(([v]) => v === valor) ? valor : opciones[0][0]);

export function minicuotasDe(datos) {
  return {
    minicuotas: Boolean(datos.minicuotas),
    minicuotas_primera: valido(PRIMERA, datos.minicuotas_primera),
  };
}

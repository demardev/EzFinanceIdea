/* Cómo se ven los arreglos que propone el asistente y qué pasaría con los
   marcados. Solo pinta: los arreglos y la comprobación vienen hechos
   (calc/arreglos-estado.js). */

import { escapar, plural } from '../../ui/texto.js';
import { textoMonto } from '../../ui/privacidad.js';
import { formatearFecha } from '../../calc/fechas.js';
import { campoInterruptor } from '../../ui/campos.js';
import { icono } from '../../iconos/render.js';

const f = (iso) => formatearFecha(iso);
const n = (a) => `«${escapar(a.nombre)}»`;

const TEXTO = {
  agregar_cargo: (a) => [`Agregar el cargo ${n(a)}`, `${textoMonto(a.fila.monto)} el ${f(a.fila.fecha)}`],
  agregar_reembolso: (a) => [`Agregar el crédito ${n(a)}`,
    `${textoMonto(a.fila.monto)} el ${f(a.fila.fecha)}, como reembolso a la tarjeta`],
  corregir_monto: (a) => [`Corregir el monto de ${n(a)}`,
    `${textoMonto(a.antes.monto)} → ${textoMonto(a.cambios.monto)}`],
  mover_fecha: (a) => [`Cambiar la fecha de ${n(a)}`, `${f(a.antes.fecha)} → ${f(a.cambios.fecha)}`],
  fijar_primera_cuota: (a) => [`Mover las cuotas de ${n(a)}`,
    `Primera cuota el ${f(a.cambios.fecha_primera_cuota)}, como el banco${
      a.cambios.cuotas_pagadas === a.antes.cuotas_pagadas ? ''
        : ` · ya pagadas: ${a.antes.cuotas_pagadas} → ${a.cambios.cuotas_pagadas}`}`],
};

function casilla(a) {
  const [etiqueta, ayuda] = TEXTO[a.tipo](a);
  return campoInterruptor({ nombre: `arreglo_${a.id}`, etiqueta, ayuda, activo: true });
}

function manual({ item, motivo }) {
  const p = item.linea ?? item.movimiento;
  return `<li>${escapar(p.concepto ?? p.descripcion)} (${textoMonto(p.monto)}): ${escapar(motivo)}</li>`;
}

/** "Con los marcados la app cuadra" o lo que todavía quedaría. */
export function pintarComprobacion(despues, marcados) {
  if (!marcados) return '<p class="tenue-2" style="font-size:12.5px">Marca al menos un arreglo.</p>';
  const pendientes = despues.faltan.length + despues.distintos.length + despues.sobran.length;
  if (despues.diferencia === 0 && !pendientes) {
    return `<p class="pos" style="font-size:13px">${icono('check', 13)} Con estos arreglos la app
      queda igual que el banco al corte.</p>`;
  }
  if (!pendientes && despues.sinExplicar === 0) {
    const arrastre = despues.arrastre !== 0 ? `<p class="warn" style="font-size:12.5px">
      ${icono('alerta', 13)} Además, la app ya no cuadraba en el corte anterior
      (${textoMonto(despues.arrastre, { signo: true })}): compara también ese estado de cuenta.</p>` : '';
    const siguiente = despues.delSiguiente.length
      ? ` Solo quedan ${plural(despues.delSiguiente.length, 'compra', 'compras')} que el banco aplicó
        después del corte (${textoMonto(despues.totalDelSiguiente, { signo: true })}): están bien.` : '';
    return `<p class="pos" style="font-size:13px">${icono('check', 13)} Con estos arreglos tu app
      queda bien.${siguiente}</p>${arrastre}`;
  }
  return `<p class="warn" style="font-size:13px">${icono('alerta', 13)} Con estos arreglos todavía
    ${pendientes ? `quedan ${plural(pendientes, 'diferencia', 'diferencias')} por revisar a mano`
      : `quedan ${textoMonto(despues.sinExplicar)} sin explicar`}.</p>`;
}

/** @param propuesta de proponerArreglos() */
export function pintarArreglos({ arreglos, manuales }) {
  if (!arreglos.length && !manuales.length) return '';
  return `
    <div class="card card-plana pila-sm" data-arreglos>
      <p style="font-weight:550">Arreglos que propongo</p>
      ${arreglos.length ? `<form data-arreglos-form class="pila-sm">${arreglos.map(casilla).join('')}</form>
        <div data-comprobacion></div>
        <button type="button" class="btn btn-primario btn-bloque" data-aplicar>Aplicar los marcados</button>`
        : '<p class="tenue" style="font-size:13px">No hay nada que pueda arreglar solo.</p>'}
      ${manuales.length ? `<p class="tenue" style="font-size:12.5px;margin-top:6px">Estos los tienes que
        hacer tú:</p><ul class="tenue" style="font-size:12.5px;padding-left:16px;list-style:disc">
        ${manuales.map(manual).join('')}</ul>` : ''}
    </div>`;
}

export function pintarAplicado({ aplicados, error }) {
  return `
    <div class="card card-plana pila-sm">
      <p class="${error ? 'warn' : 'pos'}" style="font-size:13px">${icono(error ? 'alerta' : 'check', 13)}
        ${error ? `Se aplicaron ${aplicados} y luego falló: ${escapar(error.message)}`
          : `Listo: ${plural(aplicados, 'arreglo aplicado', 'arreglos aplicados')}.`}</p>
      <button type="button" class="btn btn-bloque" data-deshacer>Deshacer</button>
    </div>`;
}

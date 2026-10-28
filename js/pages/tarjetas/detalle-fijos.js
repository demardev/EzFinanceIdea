/* Los gastos fijos del plan que van a esta tarjeta y aún no registras.
   Recibe la lista ya calculada (calc/fijos-tarjeta.js): aquí solo se pinta.
   Tocar uno abre el formulario con todo puesto, igual que en el Resumen. */

import { icono } from '../../iconos/render.js';
import { escapar } from '../../ui/texto.js';
import { textoMonto } from '../../ui/privacidad.js';
import { formatearFecha } from '../../calc/fechas.js';

function cuando(dias) {
  if (dias === 0) return 'hoy';
  if (dias < 0) return dias === -1 ? 'hace 1 día' : `hace ${-dias} días`;
  return dias === 1 ? 'mañana' : `en ${dias} días`;
}

function fila(p, indice) {
  return `
    <div class="lista-fila">
      <button type="button" class="fila-cuerpo" data-fijo="${indice}">
        <span class="icono-caja">${icono('repeat', 18)}</span>
        <span class="crece truncar">
          <span class="titulo">${escapar(p.item.nombre)}</span><br>
          <span class="sub ${p.dias < 0 ? 'warn' : ''}">
            ${formatearFecha(p.fecha)} · ${cuando(p.dias)}
          </span>
        </span>
        <span class="monto neg">−${textoMonto(p.monto)}</span>
      </button>
    </div>`;
}

/** Nada si no falta nada: el bloque solo aparece cuando hay algo que hacer. */
export function bloqueFijos(pendientes) {
  if (!pendientes.length) return '';
  return `
    <div>
      <p class="seccion-titulo">Por registrar</p>
      <p class="tenue-2" style="font-size:12px;margin:-4px 0 8px">
        Gastos fijos del plan con esta tarjeta que faltan en el ciclo abierto.
        Toca uno para registrarlo.</p>
      <div class="lista">${pendientes.map((p, i) => fila(p, i)).join('')}</div>
    </div>`;
}

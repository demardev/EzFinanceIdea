/* Bottom sheet de compra a meses SIN INTERESES. Muestra en vivo cómo va a
   quedar el reparto; el cálculo es de calc/cuotas.js, aquí solo se pinta. */

import { abrirSheetFormulario } from '../../ui/sheet-formulario.js';
import { campoTexto, campoMonto, campoSelect, datosDe } from '../../ui/campos.js';
import { textoMonto } from '../../ui/privacidad.js';
import { generarCuotas } from '../../calc/cuotas.js';
import { formatearFecha, hoyISO } from '../../calc/fechas.js';

const PLAZOS = [3, 6, 9, 12, 18, 24, 36, 48].map((n) => [String(n), `${n} meses`]);

function campos(compra, categorias) {
  const deEgreso = categorias.filter((c) => c.tipo === 'egreso');
  return `
    ${campoTexto({ nombre: 'descripcion', etiqueta: 'Qué compraste',
                   valor: compra.descripcion ?? '' })}
    ${campoMonto({ nombre: 'monto_total', etiqueta: 'Monto total',
                   valor: compra.monto_total ?? '' })}
    ${campoSelect({ nombre: 'num_cuotas', etiqueta: 'Plazo',
                    valor: String(compra.num_cuotas ?? 12), opciones: PLAZOS })}
    ${campoTexto({ nombre: 'fecha_compra', etiqueta: 'Fecha de compra',
                   valor: compra.fecha_compra ?? hoyISO(), tipo: 'date' })}
    ${campoSelect({ nombre: 'categoria_id', etiqueta: 'Categoría',
                    valor: compra.categoria_id ?? '',
                    opciones: [['', 'Sin categoría'], ...deEgreso.map((c) => [c.id, c.nombre])] })}
    ${campoTexto({ nombre: 'comercio', etiqueta: 'Comercio',
                   valor: compra.comercio ?? '', requerido: false })}
    ${campoTexto({ nombre: 'cuotas_pagadas', etiqueta: '¿Cuántas cuotas ya pagaste?',
                   valor: compra.cuotas_pagadas ?? 0, tipo: 'number', requerido: false,
                   ayuda: 'Solo si la compra es anterior a que empezaras a usar la app. '
                        + 'Esas cuotas se ven en el historial pero no cuentan como deuda.' })}
    <div class="card card-plana" id="vista-previa" style="margin-top:14px"></div>`;
}

/** "12 cuotas de $100.00 · de 08/sep/2026 a 08/ago/2027" */
function vistaPrevia(datos) {
  if (!(datos.monto_total > 0) || !datos.fecha_compra) {
    return '<p class="tenue-2" style="font-size:12.5px">Pon el monto para ver el reparto.</p>';
  }
  const cuotas = generarCuotas({ ...datos, descripcion: datos.descripcion || 'Compra' });
  const ultima = cuotas.at(-1);
  const iguales = cuotas.every((c) => c.monto === cuotas[0].monto);
  const yaPagadas = Number(datos.cuotas_pagadas) || 0;
  return `
    <p style="font-weight:550">${cuotas.length} cuotas de ${textoMonto(cuotas[0].monto)}${
      iguales ? '' : `, la última de ${textoMonto(ultima.monto)}`}</p>
    <p class="tenue" style="font-size:12.5px">
      De ${formatearFecha(cuotas[0].fecha)} a ${formatearFecha(ultima.fecha)} ·
      sin intereses, suman ${textoMonto(datos.monto_total)}
    </p>
    ${yaPagadas > 0 ? `<p class="tenue-2" style="font-size:12.5px">
      Las primeras ${yaPagadas} no cuentan como deuda: ya las pagaste.</p>` : ''}`;
}

/** Repinta la vista previa cada vez que se toca el formulario. */
function conectarPrevia(hoja, form) {
  const previa = hoja.querySelector('#vista-previa');
  const refrescar = () => {
    const d = datosDe(form);
    previa.innerHTML = vistaPrevia({ ...d, num_cuotas: Number(d.num_cuotas) });
  };
  form.addEventListener('input', refrescar);
  form.addEventListener('change', refrescar);
  refrescar();
}

export function abrirFormCompra(compra, datos, { alGuardar, alEliminar }) {
  abrirSheetFormulario({
    titulo: compra.id ? 'Editar compra a cuotas' : 'Compra a meses sin intereses',
    id: 'form-compra',
    cuerpo: campos(compra, datos.categorias),
    textoGuardar: compra.id ? 'Guardar cambios' : 'Registrar compra',
    textoBorrar: compra.id ? 'Eliminar compra' : '',
    alEliminar: compra.id ? alEliminar : null,
    alPintar: conectarPrevia,
    alGuardar: (d) => {
      if (!d.descripcion.trim()) throw new Error('Di qué compraste.');
      if (!(d.monto_total > 0)) throw new Error('El monto tiene que ser mayor que cero.');
      const yaPagadas = Number(d.cuotas_pagadas) || 0;
      if (yaPagadas < 0 || yaPagadas > Number(d.num_cuotas)) {
        throw new Error(`Las cuotas ya pagadas deben estar entre 0 y ${d.num_cuotas}.`);
      }
      return alGuardar({
        descripcion: d.descripcion.trim(),
        monto_total: d.monto_total,
        num_cuotas: Number(d.num_cuotas),
        fecha_compra: d.fecha_compra,
        categoria_id: d.categoria_id || null,
        comercio: d.comercio.trim() || null,
        cuotas_pagadas: yaPagadas,
      });
    },
  });
}

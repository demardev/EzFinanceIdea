/* Bottom sheet para pasar compras del corte abierto a minicuotas. Se eligen
   las compras, el plazo y lo que cobra el banco; el cálculo es de
   calc/minicuotas.js, aquí solo se pinta. */

import { abrirSheetFormulario } from '../../ui/sheet-formulario.js';
import { campoTexto, campoMonto, campoSelect, campoInterruptor, datosDe } from '../../ui/campos.js';
import { textoMonto } from '../../ui/privacidad.js';
import { formatearFecha } from '../../calc/fechas.js';
import { previaTraslado } from '../../calc/minicuotas.js';

const PLAZOS = [3, 6, 9, 12, 18, 24, 36, 48].map((n) => [String(n), `${n} meses`]);
const INTERES = [['comision', 'Comisión aparte, una sola vez'], ['en_cuotas', 'Metido en las cuotas']];

function casillas(trasladables) {
  return trasladables.map((m) => campoInterruptor({
    nombre: `sel_${m.id}`, etiqueta: m.descripcion,
    ayuda: `${formatearFecha(m.fecha)} · ${textoMonto(m.monto)}`,
  })).join('');
}

function campos(tarjeta, trasladables, categorias, fechas) {
  const deEgreso = categorias.filter((c) => c.tipo === 'egreso');
  return `
    <p class="tenue" style="font-size:12.5px;margin:0 0 8px">Compras del corte abierto</p>
    ${casillas(trasladables)}
    ${campoSelect({ nombre: 'num_cuotas', etiqueta: 'Plazo', valor: '6', opciones: PLAZOS })}
    ${campoSelect({ nombre: 'modo_interes', etiqueta: 'El interés va',
                    valor: tarjeta.minicuotas_interes ?? 'comision', opciones: INTERES })}
    ${campoMonto({ nombre: 'interes', etiqueta: 'Interés o comisión', valor: 0,
                   ayuda: 'El monto que te da el banco para ese plazo.' })}
    <div data-solo-comision>
      ${campoTexto({ nombre: 'fecha_comision', etiqueta: 'Día en que se cobra la comisión',
                     valor: fechas.fecha_comision, tipo: 'date', requerido: false })}
    </div>
    ${campoTexto({ nombre: 'fecha_primera_cuota', etiqueta: 'Día de la primera cuota',
                   valor: fechas.fecha_primera_cuota, tipo: 'date' })}
    ${campoSelect({ nombre: 'categoria_id', etiqueta: 'Categoría de la comisión', valor: '',
                    opciones: [['', 'Sin categoría'], ...deEgreso.map((c) => [c.id, c.nombre])] })}
    ${campoTexto({ nombre: 'descripcion', etiqueta: 'Nombre', valor: 'Minicuotas' })}
    <div class="card card-plana" id="vista-previa" style="margin-top:14px"></div>`;
}

/** Del formulario a lo que entiende calc/minicuotas.js. */
function leer(d, trasladables) {
  return {
    elegidas: trasladables.filter((m) => d[`sel_${m.id}`]),
    condiciones: {
      num_cuotas: Number(d.num_cuotas),
      interes: d.interes || 0,
      interes_en_cuotas: d.modo_interes === 'en_cuotas',
      fecha_primera_cuota: d.fecha_primera_cuota,
      fecha_comision: d.modo_interes === 'en_cuotas' ? null : d.fecha_comision || null,
    },
  };
}

/** "6 cuotas de $50.00 · comisión $12.50 el 05/nov/2026 · pagas $312.50" */
function vistaPrevia({ elegidas, condiciones }) {
  if (!elegidas.length || !condiciones.fecha_primera_cuota) {
    return '<p class="tenue-2" style="font-size:12.5px">Elige las compras para ver el reparto.</p>';
  }
  const p = previaTraslado(elegidas, condiciones);
  const [primera] = p.cuotas;
  const ultima = p.cuotas.at(-1);
  return `
    <p style="font-weight:550">${p.cuotas.length} cuotas de ${textoMonto(primera.monto)}${
      ultima.monto === primera.monto ? '' : `, la última de ${textoMonto(ultima.monto)}`}</p>
    <p class="tenue" style="font-size:12.5px">
      Trasladas ${textoMonto(p.monto)} · de ${formatearFecha(primera.fecha)}
      a ${formatearFecha(ultima.fecha)}${p.comision
        ? ` · comisión ${textoMonto(p.comision.monto)} el ${formatearFecha(p.comision.fecha)}` : ''}
      · pagas ${textoMonto(p.totalAPagar)} en total
    </p>`;
}

function conectarPrevia(hoja, form, trasladables) {
  const previa = hoja.querySelector('#vista-previa');
  const soloComision = hoja.querySelector('[data-solo-comision]');
  const refrescar = () => {
    const d = datosDe(form);
    soloComision.hidden = d.modo_interes === 'en_cuotas';
    previa.innerHTML = vistaPrevia(leer(d, trasladables));
  };
  form.addEventListener('input', refrescar);
  form.addEventListener('change', refrescar);
  refrescar();
}

function validar({ elegidas, condiciones }, d) {
  if (!elegidas.length) throw new Error('Elige al menos una compra.');
  if (!d.descripcion.trim()) throw new Error('Ponle un nombre al traslado.');
  if (!condiciones.fecha_primera_cuota) throw new Error('Pon el día de la primera cuota.');
  if (!condiciones.interes_en_cuotas && condiciones.interes > 0 && !condiciones.fecha_comision) {
    throw new Error('Pon el día en que se cobra la comisión.');
  }
}

/**
 * @param trasladables de comprasTrasladables()
 * @param fechas       de fechasPorDefecto()
 * @param alGuardar    (fila, idsElegidas) => Promise
 */
export function abrirFormMinicuotas({ tarjeta, trasladables, categorias, fechas, hoy }, alGuardar) {
  abrirSheetFormulario({
    titulo: 'Pasar compras a minicuotas',
    id: 'form-minicuotas',
    cuerpo: campos(tarjeta, trasladables, categorias, fechas),
    textoGuardar: 'Trasladar',
    alPintar: (hoja, form) => conectarPrevia(hoja, form, trasladables),
    alGuardar: (d) => {
      const lectura = leer(d, trasladables);
      validar(lectura, d);
      const { monto } = previaTraslado(lectura.elegidas, lectura.condiciones);
      return alGuardar({
        tipo: 'minicuotas', descripcion: d.descripcion.trim(), monto_total: monto,
        fecha_compra: hoy, categoria_id: d.categoria_id || null, comercio: null,
        cuotas_pagadas: 0, ...lectura.condiciones,
      }, lectura.elegidas.map((m) => m.id));
    },
  });
}

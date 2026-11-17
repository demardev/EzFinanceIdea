/* Bottom sheet para pasar compras del corte abierto o del recién cerrado a
   minicuotas. Se eligen las compras, el plazo, la cuota que da el banco y su
   comisión aparte; el cálculo es de calc/minicuotas.js, aquí solo se pinta. */

import { abrirSheetFormulario } from '../../ui/sheet-formulario.js';
import { campoTexto, campoMonto, campoSelect, campoInterruptor, datosDe } from '../../ui/campos.js';
import { textoMonto } from '../../ui/privacidad.js';
import { formatearFecha } from '../../calc/fechas.js';
import { previaTraslado } from '../../calc/minicuotas.js';

const PLAZOS = [3, 6, 9, 12, 18, 24, 36, 48].map((n) => [String(n), `${n} meses`]);
const titulo = (g) => (g.abierto
  ? `Corte abierto · cierra el ${formatearFecha(g.fechaCorte)}`
  : `Corte que cerró el ${formatearFecha(g.fechaCorte)}`);

function casillas(grupos) {
  return grupos.map((g) => `
    <p class="tenue" style="font-size:12.5px;margin:8px 0">${titulo(g)}</p>
    ${g.compras.map((m) => campoInterruptor({
      nombre: `sel_${m.id}`, etiqueta: m.descripcion,
      ayuda: `${formatearFecha(m.fecha)} · ${textoMonto(m.monto)}`,
    })).join('')}`).join('');
}

function campos(grupos, categorias, fechas) {
  const deEgreso = categorias.filter((c) => c.tipo === 'egreso');
  return `
    ${casillas(grupos)}
    ${campoSelect({ nombre: 'num_cuotas', etiqueta: 'Plazo', valor: '6', opciones: PLAZOS })}
    ${campoMonto({ nombre: 'cuota_mensual', etiqueta: 'Cuota mensual', valor: 0,
                   ayuda: 'La que te da el banco para ese plazo. En $0.00, sin interés.' })}
    ${campoTexto({ nombre: 'fecha_primera_cuota', etiqueta: 'Día de la primera cuota',
                   valor: fechas.fecha_primera_cuota, tipo: 'date' })}
    ${campoMonto({ nombre: 'interes', etiqueta: 'Comisión aparte', valor: 0,
                   ayuda: 'Lo que cobra una sola vez, fuera de las cuotas.' })}
    <div data-solo-comision>
      ${campoTexto({ nombre: 'fecha_comision', etiqueta: 'Día en que se cobra la comisión',
                     valor: fechas.fecha_comision, tipo: 'date', requerido: false })}
      ${campoSelect({ nombre: 'categoria_id', etiqueta: 'Categoría de la comisión', valor: '',
                      opciones: [['', 'Sin categoría'], ...deEgreso.map((c) => [c.id, c.nombre])] })}
    </div>
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
      cuota_mensual: d.cuota_mensual || null,
      fecha_primera_cuota: d.fecha_primera_cuota,
      fecha_comision: d.interes > 0 ? d.fecha_comision || null : null,
    },
  };
}

const nota = (texto) => `<p class="tenue-2" style="font-size:12.5px">${texto}</p>`;

/** "Interés en las cuotas $12.48" o "sin interés (la cuota sin interés sería $50.00)". */
function lineaInteres(p, conCuota) {
  if (!conCuota || p.interesEnCuotas === 0) return 'Cuotas sin interés';
  return `Interés en las cuotas ${textoMonto(p.interesEnCuotas)}
    (sin interés serían de ${textoMonto(p.cuotaSinInteres)})`;
}

/** Cuotas, interés de las cuotas, comisión aparte y el total, cada uno por su lado. */
function vistaPrevia({ elegidas, condiciones }) {
  if (!elegidas.length || !condiciones.fecha_primera_cuota) {
    return nota('Elige las compras para ver el reparto.');
  }
  const p = previaTraslado(elegidas, condiciones);
  if (p.interesEnCuotas < 0) {
    return nota(`Con esa cuota no se cubre lo trasladado: sin interés sería de ${
      textoMonto(p.cuotaSinInteres)}.`);
  }
  const [primera] = p.cuotas;
  const ultima = p.cuotas.at(-1);
  return `
    <p style="font-weight:550">${p.cuotas.length} cuotas de ${textoMonto(primera.monto)}${
      ultima.monto === primera.monto ? '' : `, la última de ${textoMonto(ultima.monto)}`}</p>
    <p class="tenue" style="font-size:12.5px">
      Trasladas ${textoMonto(p.monto)} · de ${formatearFecha(primera.fecha)}
      a ${formatearFecha(ultima.fecha)}<br>
      ${lineaInteres(p, condiciones.cuota_mensual)}${p.comision
        ? ` · comisión aparte ${textoMonto(p.comision.monto)} el ${formatearFecha(p.comision.fecha)}`
        : ''}<br>
      Pagas ${textoMonto(p.totalAPagar)} en total
    </p>`;
}

function conectarPrevia(hoja, form, trasladables) {
  const previa = hoja.querySelector('#vista-previa');
  const soloComision = hoja.querySelector('[data-solo-comision]');
  const refrescar = () => {
    const d = datosDe(form);
    soloComision.hidden = !(d.interes > 0);
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
  if (condiciones.interes > 0 && !condiciones.fecha_comision) {
    throw new Error('Pon el día en que se cobra la comisión.');
  }
  if (previaTraslado(elegidas, condiciones).interesEnCuotas < 0) {
    throw new Error('La cuota mensual no cubre lo trasladado.');
  }
}

/**
 * @param grupos    de agruparPorCorte()
 * @param fechas    de fechasPorDefecto()
 * @param alGuardar (fila, idsElegidas) => Promise
 */
export function abrirFormMinicuotas({ grupos, categorias, fechas, hoy }, alGuardar) {
  const trasladables = grupos.flatMap((g) => g.compras);
  abrirSheetFormulario({
    titulo: 'Pasar compras a minicuotas',
    id: 'form-minicuotas',
    cuerpo: campos(grupos, categorias, fechas),
    textoGuardar: 'Trasladar',
    alPintar: (hoja, form) => conectarPrevia(hoja, form, trasladables),
    alGuardar: (d) => {
      const lectura = leer(d, trasladables);
      validar(lectura, d);
      const { monto } = previaTraslado(lectura.elegidas, lectura.condiciones);
      return alGuardar({
        tipo: 'minicuotas', descripcion: d.descripcion.trim(), monto_total: monto,
        fecha_compra: hoy, categoria_id: d.interes > 0 ? d.categoria_id || null : null, comercio: null,
        cuotas_pagadas: 0, ...lectura.condiciones,
      }, lectura.elegidas.map((m) => m.id));
    },
  });
}

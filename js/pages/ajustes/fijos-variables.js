/* Los cuatro grupos que alimentan el planificador: ingresos y gastos, fijos
   y variables. La vista pide al repo y pinta; el formulario vive aparte. */

import { filaEditable, envolverLista } from '../../ui/lista.js';
import { textoMonto } from '../../ui/privacidad.js';
import { confirmar } from '../../ui/confirmar.js';
import { aviso, avisoError } from '../../ui/toast.js';
import { icono } from '../../iconos/render.js';
import { sumar } from '../../calc/dinero.js';
import { abrirFormPlanItem } from './plan-form.js';
import { conectarDeslizar, cerrarDeslizada } from '../../ui/deslizar.js';

/* Abierto/cerrado por tabla: los cuatro grupos son una lista, no cuatro ifs. */
const GRUPOS = [
  { clase: 'ingreso', variabilidad: 'fijo',     titulo: 'Ingresos fijos',
    ayuda: 'El sueldo el día 30, una renta que cobras.' },
  { clase: 'ingreso', variabilidad: 'variable', titulo: 'Ingresos variables',
    ayuda: 'Freelance: entre un mínimo y un máximo al mes.' },
  { clase: 'gasto',   variabilidad: 'fijo',     titulo: 'Gastos fijos',
    ayuda: 'La renta el día 1, Netflix el 5 en la tarjeta.' },
  { clase: 'gasto',   variabilidad: 'variable', titulo: 'Gastos variables',
    ayuda: 'Comida: entre un mínimo y un máximo al mes.' },
];

const ICONO = { ingreso: 'entra', gasto: 'sale' };

/** "$24,000.00" para los fijos, "$3,000.00 – $5,000.00" para los variables. */
function montoDe(item) {
  if (item.variabilidad === 'fijo') return textoMonto(item.monto);
  return `${textoMonto(item.monto_min)} – ${textoMonto(item.monto_max)}`;
}

function subtituloDe(item, nombres) {
  const partes = [];
  if (item.variabilidad === 'fijo' && item.dia_mes) partes.push(`día ${item.dia_mes}`);
  const donde = nombres[item.cuenta_id] || nombres[item.tarjeta_id];
  if (donde) partes.push(donde);
  if (!item.activo) partes.push('pausado');
  return partes.join(' · ');
}

async function borrar(item, planItems) {
  const ok = await confirmar({
    titulo: `¿Eliminar "${item.nombre}"?`,
    mensaje: 'Deja de contar en el plan. Si solo quieres pausarlo, edítalo y desactívalo.',
  });
  if (!ok) return false;
  await planItems.eliminar(item.id);
  aviso('Eliminado del plan.');
  return true;
}

/** Total del grupo al mes. Los variables se resumen por su mínimo. */
function totalDe(items) {
  const activos = items.filter((i) => i.activo);
  return sumar(...activos.map((i) => (i.variabilidad === 'fijo' ? i.monto : i.monto_min)));
}

function grupo(g, items, nombres, iconos) {
  const filas = items.map((i) => filaEditable({
    id: i.id,
    nombre: i.nombre,
    sub: subtituloDe(i, nombres),
    derecha: montoDe(i),
    iconoNombre: iconos[i.categoria_id] || ICONO[i.clase],
    deslizable: true,
  }));
  return `
    <div>
      <div class="seccion-barra">
        <span class="seccion-titulo" style="margin:0">${g.titulo}</span>
        ${items.length ? `<span class="tenue-2 monto" style="font-size:12.5px">
          ${textoMonto(totalDe(items))}${g.variabilidad === 'variable' ? ' mín.' : ''}</span>` : ''}
      </div>
      ${items.length
        ? envolverLista(filas)
        : `<p class="tenue-2" style="font-size:12.5px;padding:2px 2px 8px">${g.ayuda}</p>`}
      <button class="btn btn-sm" type="button"
              data-nuevo="${g.clase}:${g.variabilidad}" style="margin-top:8px">
        ${icono('plus', 15)} Agregar
      </button>
    </div>`;
}

function indices({ cuentas, tarjetas, categorias }) {
  const nombres = {}; const iconos = {};
  [...cuentas, ...tarjetas].forEach((x) => { nombres[x.id] = x.nombre; });
  categorias.forEach((c) => { iconos[c.id] = c.icono; });
  return { nombres, iconos };
}

export async function montarFijosVariables(contenedor, contexto) {
  const { planItems, cuentas, tarjetas, categorias } = contexto;
  let datos = { cuentas: [], tarjetas: [], categorias: [] };
  let items = [];

  async function recargar() {
    const [i, c, t, k] = await Promise.all([
      planItems.listar(), cuentas.listarActivas(),
      tarjetas.listarActivas(), categorias.listarActivas(),
    ]);
    items = i;
    datos = { cuentas: c, tarjetas: t, categorias: k };
    pintar();
  }

  function pintar() {
    const { nombres, iconos } = indices(datos);
    contenedor.innerHTML = `
      <div class="pila">
        <p class="tenue" style="font-size:12.5px">
          Esto es lo que esperas que pase cada mes. Es lo que el planificador usa
          para decirte si alcanza.
        </p>
        ${GRUPOS.map((g) => grupo(
          g,
          items.filter((i) => i.clase === g.clase && i.variabilidad === g.variabilidad),
          nombres, iconos,
        )).join('')}
      </div>`;
    conectarDeslizar(contenedor);
  }

  function abrir(item) {
    abrirFormPlanItem(item, datos, {
      alGuardar: async (fila) => {
        await (item.id ? planItems.actualizar(item.id, fila) : planItems.crear(fila));
        await recargar();
      },
      alEliminar: async () => {
        if (!await borrar(item, planItems)) return false;
        await recargar();
        return true;
      },
    });
  }

  contenedor.addEventListener('click', async (evento) => {
    const o = evento.target.closest('[data-editar], [data-borrar], [data-nuevo]');
    if (!o) return;
    try {
      if (o.dataset.borrar) {
        cerrarDeslizada();
        const item = items.find((i) => i.id === o.dataset.borrar);
        if (await borrar(item, planItems)) await recargar();
        return;
      }
      if (o.dataset.nuevo) {
        const [clase, variabilidad] = o.dataset.nuevo.split(':');
        return abrir({ clase, variabilidad, activo: true });
      }
      abrir(items.find((i) => i.id === o.dataset.editar));
    } catch (e) { avisoError(e); }
  });

  contenedor.innerHTML = '<p class="tenue">Cargando…</p>';
  await recargar();
}

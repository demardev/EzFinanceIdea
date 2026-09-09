/* CRUD de categorías, agrupadas por tipo de movimiento.
   Al eliminar una en uso, los movimientos se quedan sin categoría (set null),
   no se borran: el diálogo dice cuántos quedan afectados. */

import { filaEditable, envolverLista, estadoVacio } from '../../ui/lista.js';
import { confirmar } from '../../ui/confirmar.js';
import { aviso, avisoError } from '../../ui/toast.js';
import { plural } from '../../ui/texto.js';
import { icono } from '../../iconos/render.js';
import { abrirFormCategoria, TIPOS } from './categorias-form.js';
import { mover } from './orden.js';
import { conectarDeslizar, cerrarDeslizada } from '../../ui/deslizar.js';

function grupo(titulo, lista, modoOrden) {
  const filas = lista.map((c) => filaEditable({
    id: c.id,
    nombre: c.nombre,
    sub: c.archivada ? 'Archivada' : '',
    iconoNombre: c.icono,
    modoOrden,
    deslizable: true,
  }));
  return `
    <div>
      <p class="seccion-titulo">${titulo}</p>
      ${lista.length ? envolverLista(filas)
        : `<p class="tenue-2" style="padding:4px 2px">Ninguna todavía.</p>`}
    </div>`;
}

function pintar(contenedor, porTipo, modoOrden) {
  const total = Object.values(porTipo).reduce((n, l) => n + l.length, 0);
  contenedor.innerHTML = `
    <div class="pila">
      <div class="seccion-barra">
        <span class="seccion-titulo" style="margin:0">Por tipo de movimiento</span>
        <button class="enlace-accion ${modoOrden ? 'activo' : ''}" id="btn-orden" type="button">
          ${modoOrden ? 'Listo' : 'Reordenar'}
        </button>
      </div>
      ${total ? TIPOS.map(([clave, etiqueta]) => grupo(etiqueta, porTipo[clave], modoOrden)).join('')
        : estadoVacio({ titulo: 'No tienes categorías.', sub: 'Crea la primera abajo.' })}
      <button class="btn btn-primario btn-bloque" id="btn-nueva" type="button">
        ${icono('plus', 18)} Nueva categoría
      </button>
    </div>`;
  conectarDeslizar(contenedor);
}

function agrupar(lista) {
  const porTipo = { ingreso: [], egreso: [], transferencia: [] };
  lista.forEach((c) => porTipo[c.tipo]?.push(c));
  return porTipo;
}

async function borrar(categoria, { categorias, movimientos }) {
  const cuantos = await movimientos.contarPorCategoria(categoria.id);
  const nota = cuantos
    ? `${plural(cuantos, 'movimiento', 'movimientos')} se quedarán sin categoría. No se borra ninguno.`
    : 'No hay movimientos usándola.';
  const ok = await confirmar({
    titulo: `¿Eliminar "${categoria.nombre}"?`,
    mensaje: `${nota} Si prefieres conservarla en el historial, edítala y márcala como archivada.`,
  });
  if (!ok) return false;
  await categorias.eliminar(categoria.id);
  aviso('Categoría eliminada.');
  return true;
}

export async function montarCategorias(contenedor, contexto) {
  const { categorias } = contexto;
  let lista = [];
  let modoOrden = false;

  async function recargar() {
    contenedor.innerHTML = '<p class="tenue">Cargando…</p>';
    lista = await categorias.listar();       // incluye archivadas: aquí se administran
    pintar(contenedor, agrupar(lista), modoOrden);
  }

  function abrirEdicion(categoria) {
    abrirFormCategoria(categoria, {
      alGuardar: async (datos) => {
        await (categoria.id ? categorias.actualizar(categoria.id, datos) : categorias.crear(datos));
        await recargar();
      },
      alEliminar: async () => {
        if (!await borrar(categoria, contexto)) return false;
        await recargar();
        return true;
      },
    });
  }

  contenedor.addEventListener('click', async (evento) => {
    const objetivo = evento.target.closest('[data-editar], [data-borrar], [data-mover], #btn-nueva, #btn-orden');
    if (!objetivo) return;
    try {
      if (objetivo.dataset.borrar) {
        cerrarDeslizada();
        const categoria = lista.find((c) => c.id === objetivo.dataset.borrar);
        if (await borrar(categoria, contexto)) await recargar();
        return;
      }
      if (objetivo.id === 'btn-orden') { modoOrden = !modoOrden; pintar(contenedor, agrupar(lista), modoOrden); return; }
      if (objetivo.id === 'btn-nueva') { abrirEdicion({}); return; }
      if (objetivo.dataset.mover) {
        /* Se reordena dentro del grupo, no contra la lista completa. */
        const actual = lista.find((c) => c.id === objetivo.dataset.id);
        await mover(categorias, agrupar(lista)[actual.tipo], actual.id, objetivo.dataset.mover);
        await recargar();
        return;
      }
      abrirEdicion(lista.find((c) => c.id === objetivo.dataset.editar));
    } catch (e) { avisoError(e); }
  });

  await recargar();
}

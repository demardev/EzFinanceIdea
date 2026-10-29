/* Clientes del negocio: crear, editar y archivar. Los activos primero y los
   archivados aparte, que siguen existiendo para sus operaciones viejas. */

import { filaEditable, envolverLista, estadoVacio } from '../../ui/lista.js';
import { avisoError } from '../../ui/toast.js';
import { icono } from '../../iconos/render.js';
import { abrirFormCliente } from './clientes-form.js';

function grupo(titulo, lista) {
  if (!lista.length) return '';
  const filas = lista.map((c) => filaEditable({
    id: c.id, nombre: c.nombre, iconoNombre: 'persona',
    sub: c.archivado ? 'Archivado' : '',
  }));
  return `
    <div>
      <p class="seccion-titulo">${titulo}</p>
      ${envolverLista(filas)}
    </div>`;
}

function pintar(contenedor, lista) {
  const activos = lista.filter((c) => !c.archivado);
  const archivados = lista.filter((c) => c.archivado);
  contenedor.innerHTML = `
    <div class="pila">
      ${lista.length ? `${grupo('Activos', activos)}${grupo('Archivados', archivados)}`
        : estadoVacio({ iconoNombre: 'persona', titulo: 'No tienes clientes.',
                        sub: 'Son opcionales en cada pago de recibo.' })}
      <button class="btn btn-primario btn-bloque" id="btn-nuevo" type="button">
        ${icono('plus', 18)} Nuevo cliente
      </button>
    </div>`;
}

export async function montarClientes(contenedor, contexto) {
  const { clientes } = contexto;
  let lista = [];

  async function recargar() {
    contenedor.innerHTML = '<p class="tenue">Cargando…</p>';
    lista = await clientes.listar();         // incluye archivados: aquí se administran
    pintar(contenedor, lista);
  }

  function abrirEdicion(cliente) {
    abrirFormCliente(cliente, {
      alGuardar: async (datos) => {
        await (cliente.id ? clientes.actualizar(cliente.id, datos) : clientes.crear(datos));
        await recargar();
      },
    });
  }

  contenedor.addEventListener('click', (evento) => {
    const objetivo = evento.target.closest('[data-editar], #btn-nuevo');
    if (!objetivo) return;
    try {
      if (objetivo.id === 'btn-nuevo') { abrirEdicion({}); return; }
      abrirEdicion(lista.find((c) => c.id === objetivo.dataset.editar));
    } catch (e) { avisoError(e); }
  });

  await recargar();
}

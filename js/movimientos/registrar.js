/* Abrir el formulario de movimiento desde donde sea: el botón flotante, la
   lista, o más adelante la pantalla de tarjetas. Carga los catálogos que el
   formulario necesita y avisa cuando algo cambió. */

import { abrirFormMovimiento } from './formulario.js';
import { confirmar } from '../ui/confirmar.js';
import { aviso } from '../ui/toast.js';
import { formatearFecha } from '../calc/fechas.js';
import { abrirSheet } from '../ui/sheet.js';
import { icono } from '../iconos/render.js';

async function cargarCatalogos({ cuentas, tarjetas, categorias }) {
  const [c, t, k] = await Promise.all([
    cuentas.listarActivas(), tarjetas.listarActivas(), categorias.listarActivas(),
  ]);
  return { cuentas: c, tarjetas: t, categorias: k };
}

/**
 * @param contexto  el de la app (repos)
 * @param mov       {} para nuevo, o el movimiento a editar
 * @param alCambiar se llama después de guardar o eliminar
 * @param catalogos opcional: si quien llama ya los tiene, evita 3 peticiones
 */
export async function abrirRegistro(contexto, mov, alCambiar, catalogos) {
  const { movimientos } = contexto;
  const datos = catalogos ?? await cargarCatalogos(contexto);

  abrirFormMovimiento(mov, datos, {
    alGuardar: async (fila) => {
      await (mov?.id ? movimientos.actualizar(mov.id, fila) : movimientos.crear(fila));
      aviso(mov?.id ? 'Movimiento guardado.' : 'Movimiento registrado.');
      await alCambiar();
    },
    alEliminar: () => eliminarMovimiento(contexto, mov, alCambiar),
  });
}

/**
 * Borrar con confirmación. Lo usan el sheet de edición y el gesto de
 * deslizar, para que los dos caminos avisen igual.
 */
export async function eliminarMovimiento({ movimientos }, mov, alCambiar) {
  const ok = await confirmar({
    titulo: '¿Eliminar este movimiento?',
    mensaje: `${mov.descripcion} · ${formatearFecha(mov.fecha)}. No se puede deshacer.`,
  });
  if (!ok) return false;
  await movimientos.eliminar(mov.id);
  aviso('Movimiento eliminado.');
  await alCambiar();
  return true;
}

/**
 * Qué abre el botón flotante. Sin negocio va directo al movimiento; con
 * negocio pregunta, porque son dos cosas distintas que se registran a diario.
 */
export function abrirNuevoDesdeFab(contexto, alCambiar, abrirPago) {
  if (!contexto.perfil?.negocio) return abrirRegistro(contexto, {}, alCambiar);

  const { hoja, cerrar } = abrirSheet({
    titulo: '¿Qué vas a registrar?',
    cuerpo: `
      <div class="pila-sm">
        <button class="btn btn-primario btn-bloque" data-elegir="movimiento">
          ${icono('movimientos', 18)} Movimiento
        </button>
        <button class="btn btn-bloque" data-elegir="recibo">
          ${icono('banknote', 18)} Pago de recibo
        </button>
      </div>`,
  });

  hoja.querySelectorAll('[data-elegir]').forEach((boton) => {
    boton.addEventListener('click', () => {
      cerrar();
      if (boton.dataset.elegir === 'recibo') abrirPago();
      else abrirRegistro(contexto, {}, alCambiar);
    });
  });
}

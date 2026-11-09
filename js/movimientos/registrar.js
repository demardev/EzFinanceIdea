/* Abrir el formulario de movimiento desde donde sea: el botón flotante, la
   lista, o más adelante la pantalla de tarjetas. Carga los catálogos que el
   formulario necesita y avisa cuando algo cambió. */

import { abrirFormMovimiento } from './formulario.js';
import { confirmar } from '../ui/confirmar.js';
import { aviso } from '../ui/toast.js';
import { formatearFecha, hoyISO } from '../calc/fechas.js';
import { TIPOS } from './tipos.js';
import { abrirSheet } from '../ui/sheet.js';
import { icono } from '../iconos/render.js';
import { unirDestino } from '../ui/campos.js';
import { crearVinculo } from './vinculo-prestamo.js';
import { cargarPrestamos } from '../pages/prestamos/datos.js';

async function cargarCatalogos({ cuentas, tarjetas, categorias }) {
  const [c, t, k] = await Promise.all([
    cuentas.listarActivas(), tarjetas.listarActivas(), categorias.listarActivas(),
  ]);
  return { cuentas: c, tarjetas: t, categorias: k };
}

/* Los préstamos para el botoncito del formulario. Sin la función en el plan
   no se pide nada; si falla, el formulario abre igual, sin el botón. */
async function prestamosParaVincular(contexto) {
  try {
    const datos = await cargarPrestamos(contexto, hoyISO());
    return datos && { activos: datos.resumen.activos, todos: datos.prestamos };
  } catch { return null; }
}

/* Un gasto fijo o un ingreso del plan ya trae casi todo el movimiento: se
   abre el mismo formulario de "nuevo" con eso puesto, y la fecha de hoy, que
   es cuando lo estás pagando o cobrando. Lo usan los avisos del Resumen y el
   detalle de la tarjeta. Un ingreso variable se propone con su mínimo. */
export function borradorDeFijo(item) {
  if (item.clase === 'ingreso') {
    return {
      tipo: 'ingreso',
      monto: Number(item.variabilidad === 'variable' ? item.monto_min : item.monto) || 0,
      descripcion: item.nombre,
      categoria_id: item.categoria_id ?? '',
      cuenta_id: item.cuenta_id ?? '',
    };
  }
  return {
    tipo: 'egreso',
    monto: Number(item.monto) || 0,
    descripcion: item.nombre,
    categoria_id: item.categoria_id ?? '',
    origen: unirDestino(item, 'cuenta_id', 'tarjeta_id'),
  };
}

/* Duplicar: lo mismo que el movimiento, pero como uno NUEVO y con la fecha de
   hoy. Se abre en el formulario para cambiar lo que haga falta antes de
   registrarlo. No se lleva la compra a meses ni el negocio: sale personal y
   suelto. */
export function borradorDeCopia(mov) {
  return {
    tipo: mov.tipo,
    monto: Number(mov.monto) || 0,
    fecha: hoyISO(),
    descripcion: mov.descripcion,
    categoria_id: mov.categoria_id ?? '',
    nota: mov.nota ?? '',
    ...TIPOS[mov.tipo].aFormulario(mov),
  };
}

/**
 * @param contexto  el de la app (repos)
 * @param mov       {} para nuevo, o el movimiento a editar
 * @param alCambiar se llama después de guardar o eliminar
 * @param catalogos opcional: si quien llama ya los tiene, evita 3 peticiones
 * @param alRegistrar opcional: (fila) => Promise, después de crear uno NUEVO y
 *                  antes de alCambiar. La bandeja lo usa para sacar la compra.
 * @param extra     opcional: columnas que se le agregan a uno NUEVO y que el
 *                  formulario no conoce, como el prestamo_id de un abono.
 */
export async function abrirRegistro(contexto, mov, alCambiar, catalogos,
                                    { alRegistrar, extra = {} } = {}) {
  const { movimientos } = contexto;
  const [datos, prestamos] = await Promise.all([
    catalogos ?? cargarCatalogos(contexto), prestamosParaVincular(contexto),
  ]);

  abrirFormMovimiento(mov, datos, {
    vinculo: crearVinculo(prestamos, mov?.prestamo_id ?? extra.prestamo_id),
    /* Lo que eligió en el formulario gana sobre `extra`: pudo quitar el préstamo. */
    alGuardar: async (fila) => {
      await (mov?.id ? movimientos.actualizar(mov.id, fila)
                     : movimientos.crear({ ...extra, ...fila }));
      if (!mov?.id) await alRegistrar?.(fila);
      aviso(mov?.id ? 'Movimiento guardado.' : 'Movimiento registrado.');
      await alCambiar();
    },
    alEliminar: () => eliminarMovimiento(contexto, mov, alCambiar),
    alDuplicar: () => abrirRegistro(contexto, borradorDeCopia(mov), alCambiar, datos),
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
  return elegirMovimientoOPago(() => abrirRegistro(contexto, {}, alCambiar), abrirPago);
}

/** La pregunta de un usuario con negocio: ¿movimiento o pago de recibo? */
export function elegirMovimientoOPago(alMovimiento, alPago) {
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
      if (boton.dataset.elegir === 'recibo') alPago();
      else alMovimiento();
    });
  });
}

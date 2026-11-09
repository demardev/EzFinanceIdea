/* Orquesta la pantalla de Préstamos (#/prestamos): carga, resume y conecta.
   No pinta (vista.js) ni calcula dinero (calc/prestamos.js).

   Es una función del plan: sin ella la pantalla solo lo dice. La base, de
   todos modos, no devolvería nada (tiene_funcion('prestamos')). */

import { pintarPrestamos } from './vista.js';
import { cargarPrestamos, tienePrestamos } from './datos.js';
import { abrirFormPrestamo } from './form.js';
import { abrirDetalle, borradorDeAbono } from './detalle.js';
import { abrirLigar, abrirElegir } from './ligar.js';
import { nombreDe } from './textos.js';
import { abrirRegistro } from '../../movimientos/registrar.js';
import { confirmar } from '../../ui/confirmar.js';
import { aviso, avisoError } from '../../ui/toast.js';
import { hoyISO } from '../../calc/fechas.js';

function sinFuncion(contenedor) {
  contenedor.innerHTML = `
    <div class="vacio">
      <p>Préstamos no viene en tu plan.</p>
      <p class="tenue-2">Pídele al administrador que te lo active.</p>
    </div>`;
}

async function eliminar(contexto, prestamo, alCambiar) {
  const ok = await confirmar({
    titulo: '¿Eliminar este préstamo?',
    mensaje: `${nombreDe(prestamo)}. Sus abonos se quedan como movimientos normales.`,
  });
  if (!ok) return false;
  await contexto.prestamos.eliminar(prestamo.id);
  aviso('Préstamo eliminado.');
  await alCambiar();
  return true;
}

/* Al crear, los movimientos elegidos se ligan en cuanto existe el préstamo.
   Si eso falla, el préstamo ya existe: no se lanza el error, porque el
   formulario seguiría abierto y guardar otra vez lo duplicaría. */
async function crear(contexto, fila, ids) {
  const creado = await contexto.prestamos.crear(fila);
  if (!ids.length) return aviso('Préstamo creado.');
  try {
    await contexto.prestamos.ligar(ids, creado.id);
    aviso(`Préstamo creado con ${ids.length} abono${ids.length === 1 ? '' : 's'}.`);
  } catch {
    avisoError('El préstamo se creó, pero no se ligaron los movimientos. '
      + 'Elígelos desde el préstamo.');
  }
}

function editar(contexto, prestamo, alCambiar) {
  abrirFormPrestamo(prestamo, {
    alGuardar: async (fila, ids) => {
      if (prestamo.id) {
        await contexto.prestamos.actualizar(prestamo.id, fila);
        aviso('Préstamo guardado.');
      } else await crear(contexto, fila, ids);
      await alCambiar();
    },
    elegir: (opciones) => abrirElegir(contexto, { ...opciones, verbo: 'Usar' }).catch(avisoError),
    alEliminar: () => eliminar(contexto, prestamo, alCambiar),
  });
}

async function desligar(contexto, movId, alCambiar) {
  const ok = await confirmar({
    titulo: '¿Quitar este abono del préstamo?',
    mensaje: 'El movimiento no se borra: se queda en tus movimientos, solo deja de contar para este préstamo.',
    textoOk: 'Quitar',
  });
  if (!ok) return false;
  try {
    await contexto.prestamos.desligar(movId);
    aviso('Abono quitado del préstamo.');
    await alCambiar();
    return true;
  } catch (e) { avisoError(e); return false; }
}

/** Tocar una fila: su detalle, y desde ahí abonar o editar. */
function abrirUno(contexto, datos, id, alCambiar) {
  const item = [...datos.resumen.activos, ...datos.resumen.terminados]
    .find((x) => x.prestamo.id === id);
  if (!item) return;
  abrirDetalle(item, datos.abonos.filter((a) => a.prestamo_id === id), {
    alAbonar: () => abrirRegistro(contexto, borradorDeAbono(item), alCambiar, undefined,
                                  { extra: { prestamo_id: id } }).catch(avisoError),
    alLigar: () => abrirLigar(contexto, item, alCambiar).catch(avisoError),
    alDesligar: (movId) => desligar(contexto, movId, alCambiar),
    alEditar: () => editar(contexto, item.prestamo, alCambiar),
  });
}

export async function montarPrestamos(contenedor, contexto, pantalla) {
  pantalla.ponerCabecera('Préstamos', '#/resumen');
  if (!tienePrestamos(contexto)) return sinFuncion(contenedor);
  contenedor.innerHTML = '<p class="tenue">Cargando…</p>';
  let datos;

  async function recargar() {
    datos = await cargarPrestamos(contexto, hoyISO());
    pintarPrestamos(contenedor, datos.resumen, hoyISO());
  }

  contenedor.addEventListener('click', (evento) => {
    if (evento.target.closest('#btn-nuevo-prestamo')) return editar(contexto, {}, recargar);
    const fila = evento.target.closest('[data-prestamo]');
    if (fila) abrirUno(contexto, datos, fila.dataset.prestamo, recargar);
  });

  try { await recargar(); } catch (e) {
    contenedor.innerHTML = '<p class="campo-error">No se pudo cargar.</p>';
    avisoError(e);
  }
}

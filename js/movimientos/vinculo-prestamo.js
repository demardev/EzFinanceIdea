/* El botoncito de "Préstamo" del formulario de movimiento: liga el
   movimiento a un préstamo para que cuente como abono. Un gasto solo puede
   ir a lo que debes y un ingreso a lo que te deben; una transferencia, a
   ninguno.

   El formulario no sabe de préstamos: solo pinta lo que esto le da y le
   pregunta qué poner en la fila. Sin la función en el plan, no hay nada. */

import { abrirSheet } from '../ui/sheet.js';
import { escapar } from '../ui/texto.js';
import { textoMonto } from '../ui/privacidad.js';
import { icono } from '../iconos/render.js';

const DIRECCION_DE_TIPO = { egreso: 'debo', ingreso: 'me_deben' };

const nombreDe = (p) => [p.persona, p.concepto].filter(Boolean).join(' · ');

/** Los préstamos activos que van con ese tipo de movimiento. */
function opcionesDe(vinculo, tipoClave) {
  const direccion = DIRECCION_DE_TIPO[tipoClave];
  return vinculo.activos.filter((x) => x.prestamo.direccion === direccion);
}

/**
 * @param prestamos { activos: [{ prestamo, estado }], todos: [prestamo] } o null
 * @param inicial   el prestamo_id que ya trae el movimiento
 * @returns el estado del vínculo, o null si no hay préstamos que ligar
 */
export function crearVinculo(prestamos, inicial) {
  if (!prestamos) return null;
  return { ...prestamos, id: inicial || null };
}

/** Al cambiar de tipo: si el préstamo ya no le va, se suelta. */
export function ajustarAlTipo(vinculo, tipoClave) {
  if (!vinculo?.id) return;
  const sigue = opcionesDe(vinculo, tipoClave).some((x) => x.prestamo.id === vinculo.id);
  if (!sigue) vinculo.id = null;
}

/** Lo que se agrega a la fila. Sin vínculo, nada: no toca la columna. */
export function columnaDe(vinculo) {
  return vinculo ? { prestamo_id: vinculo.id } : {};
}

/** El botón chico, o el préstamo ya elegido con su ✕. */
export function pintarVinculo(vinculo, tipoClave) {
  if (!vinculo || !DIRECCION_DE_TIPO[tipoClave]) return '';
  const elegido = vinculo.todos.find((p) => p.id === vinculo.id);
  if (elegido) {
    return `
      <div class="vinculo fila">
        ${icono('persona', 16)}
        <button type="button" class="vinculo-nombre crece truncar" data-vinculo-elegir>
          Abono a ${escapar(nombreDe(elegido))}</button>
        <button type="button" class="icono-btn" data-vinculo-quitar
                aria-label="Quitar del préstamo">${icono('x', 16)}</button>
      </div>`;
  }
  if (!opcionesDe(vinculo, tipoClave).length) return '';
  return `
    <button type="button" class="btn btn-sm" data-vinculo-elegir>
      ${icono('persona', 14)} Préstamo</button>`;
}

function filaPrestamo({ prestamo, estado }, elegido) {
  return `
    <button type="button" class="lista-fila" data-prestamo-id="${escapar(prestamo.id)}">
      <span class="icono-caja">${icono(elegido ? 'check' : 'persona', 18)}</span>
      <span class="crece truncar">
        <span class="titulo">${escapar(nombreDe(prestamo))}</span><br>
        <span class="sub">Falta ${textoMonto(estado.restante)}</span>
      </span>
    </button>`;
}

/* La hoja de elegir, encima del formulario. */
function elegir(vinculo, tipoClave, alCambiar) {
  const opciones = opcionesDe(vinculo, tipoClave);
  const que = tipoClave === 'egreso' ? 'Lo que debes' : 'Lo que te deben';
  const { hoja, cerrar } = abrirSheet({
    titulo: '¿De qué préstamo es?',
    cuerpo: `
      <div class="pila-sm">
        <p class="tenue" style="font-size:13px">${que}. Este movimiento cuenta como abono
          del que elijas: no se crea nada aparte.</p>
        <div class="lista">${opciones.map((x) => filaPrestamo(x, x.prestamo.id === vinculo.id)).join('')}</div>
      </div>`,
  });
  hoja.addEventListener('click', (evento) => {
    const fila = evento.target.closest('[data-prestamo-id]');
    if (!fila) return;
    vinculo.id = fila.dataset.prestamoId;
    cerrar();
    alCambiar();
  });
}

/** Se engancha después de cada repintado del formulario. */
export function conectarVinculo(raiz, vinculo, tipoClave, alCambiar) {
  if (!vinculo) return;
  raiz.querySelector('[data-vinculo-elegir]')?.addEventListener('click',
    () => elegir(vinculo, tipoClave, alCambiar));
  raiz.querySelector('[data-vinculo-quitar]')?.addEventListener('click', () => {
    vinculo.id = null;
    alCambiar();
  });
}

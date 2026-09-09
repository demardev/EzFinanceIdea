/* Un sheet con formulario: enviar, mostrar el error dentro, y opcionalmente
   eliminar. Los cuatro formularios de la app repetían este cableado; aquí
   vive una sola vez.

   La validación va dentro de alGuardar(): si lanza un Error, su mensaje se
   pinta en el formulario y el sheet no se cierra. */

import { abrirSheet } from './sheet.js';
import { datosDe } from './campos.js';
import { escapar } from './texto.js';

function plantilla({ id, cuerpo, textoGuardar, textoBorrar }) {
  return `
    <form id="${id}" novalidate>
      ${cuerpo}
      <p class="campo-error" data-error hidden></p>
      <button class="btn btn-primario btn-bloque" type="submit" style="margin-top:14px">
        ${escapar(textoGuardar)}
      </button>
    </form>
    ${textoBorrar ? `<button class="btn btn-peligro btn-bloque" data-borrar type="button"
                             style="margin-top:10px">${escapar(textoBorrar)}</button>` : ''}`;
}

function mostrar(error, mensaje) {
  error.hidden = false;
  error.textContent = mensaje;
}

/**
 * @param alGuardar  (datos) => Promise. Lanza Error para rechazar.
 * @param alEliminar () => Promise<boolean>. true si se eliminó.
 * @param alPintar   (hoja, form) => void, para enganchar lo propio del formulario.
 * @returns { hoja, form, cerrar }
 */
export function abrirSheetFormulario({
  titulo, id, cuerpo, textoGuardar, textoBorrar = '', alGuardar, alEliminar, alPintar,
}) {
  const { hoja, cerrar } = abrirSheet({
    titulo: escapar(titulo),
    cuerpo: plantilla({ id, cuerpo, textoGuardar, textoBorrar: alEliminar ? textoBorrar : '' }),
  });

  const form = hoja.querySelector(`#${id}`);
  const error = hoja.querySelector('[data-error]');
  const enviar = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    error.hidden = true;
    enviar.disabled = true;
    try {
      await alGuardar(datosDe(form));
      cerrar();
    } catch (e) {
      mostrar(error, e.message);
      enviar.disabled = false;
    }
  });

  hoja.querySelector('[data-borrar]')?.addEventListener('click', async () => {
    try { if (await alEliminar()) cerrar(); }
    catch (e) { mostrar(error, e.message); }
  });

  alPintar?.(hoja, form);
  return { hoja, form, cerrar };
}

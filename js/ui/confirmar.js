/* Diálogo de confirmación sobre el bottom sheet. Devuelve una promesa:
   true si el usuario confirma, false si cancela o cierra. */

import { abrirSheet } from './sheet.js';
import { escapar } from './texto.js';

export function confirmar({ titulo, mensaje, textoOk = 'Eliminar', peligro = true }) {
  return new Promise((resolver) => {
    let respondido = false;
    const responder = (valor) => {
      if (respondido) return;
      respondido = true;
      resolver(valor);
    };

    const { hoja, cerrar } = abrirSheet({
      titulo: escapar(titulo),
      cuerpo: `
        <p class="tenue" style="margin-bottom:18px">${escapar(mensaje)}</p>
        <div class="pila-sm">
          <button class="btn ${peligro ? 'btn-peligro' : 'btn-primario'} btn-bloque" data-ok>
            ${escapar(textoOk)}
          </button>
          <button class="btn btn-bloque" data-cancelar>Cancelar</button>
        </div>`,
      alCerrar: () => responder(false),
    });

    hoja.querySelector('[data-ok]').addEventListener('click', () => { responder(true); cerrar(); });
    hoja.querySelector('[data-cancelar]').addEventListener('click', cerrar);
  });
}

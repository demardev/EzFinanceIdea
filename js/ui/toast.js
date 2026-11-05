/* Avisos efímeros abajo. Sin lógica de negocio: solo pinta y se borra. */

const DURACION = 2800;

function contenedor() {
  return document.getElementById('toasts');
}

function mostrar(mensaje, clase, { duracion = DURACION, alTocar = null } = {}) {
  const caja = contenedor();
  if (!caja) return;
  const nodo = document.createElement('div');
  nodo.className = `toast ${clase}`.trim();
  nodo.textContent = mensaje;
  if (alTocar) {
    nodo.classList.add('toast-tocable');
    nodo.addEventListener('click', () => { nodo.remove(); alTocar(); });
  }
  caja.appendChild(nodo);
  setTimeout(() => nodo.remove(), duracion);
}

/** `alTocar` lo vuelve un atajo: tocarlo lleva a donde se resuelve. */
export function aviso(mensaje, opciones) {
  mostrar(mensaje, '', opciones);
}

export function avisoError(error) {
  mostrar(typeof error === 'string' ? error : error?.message || 'Algo salió mal.', 'toast-error');
}

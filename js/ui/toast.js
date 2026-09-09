/* Avisos efímeros abajo. Sin lógica de negocio: solo pinta y se borra. */

const DURACION = 2800;

function contenedor() {
  return document.getElementById('toasts');
}

function mostrar(mensaje, clase) {
  const caja = contenedor();
  if (!caja) return;
  const nodo = document.createElement('div');
  nodo.className = `toast ${clase}`.trim();
  nodo.textContent = mensaje;
  caja.appendChild(nodo);
  setTimeout(() => nodo.remove(), DURACION);
}

export function aviso(mensaje) {
  mostrar(mensaje, '');
}

export function avisoError(error) {
  mostrar(typeof error === 'string' ? error : error?.message || 'Algo salió mal.', 'toast-error');
}

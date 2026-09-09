/* Deslizar una fila hacia la izquierda para descubrir "Eliminar".

   Usa Pointer Events con `touch-action: pan-y` en la fila: el navegador se
   queda con el scroll vertical y nosotros con el horizontal, así no hay que
   adivinar el ángulo del gesto ni pelear con el desplazamiento de la lista.

   El gesto NO borra: descubre el botón, y ese botón pasa por la misma
   confirmación que el resto de la app. */

const ANCHO = 92;      // lo que mide el botón que se descubre
const UMBRAL = 40;     // a partir de aquí se queda abierta al soltar

let abierta = null;

function mover(fila, x) {
  fila.style.transform = x ? `translateX(${x}px)` : '';
}

export function cerrarDeslizada() {
  if (!abierta) return;
  mover(abierta, 0);
  abierta.classList.remove('abierta');
  abierta = null;
}

function abrir(fila) {
  if (abierta && abierta !== fila) cerrarDeslizada();
  mover(fila, -ANCHO);
  fila.classList.add('abierta');
  abierta = fila;
}

function alSoltar(fila, dx) {
  fila.classList.remove('arrastrando');
  if (dx <= -UMBRAL) abrir(fila);
  else { mover(fila, 0); if (abierta === fila) { fila.classList.remove('abierta'); abierta = null; } }
}

function conectarFila(fila) {
  let inicio = 0;
  let dx = 0;
  let activo = false;

  fila.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (abierta && abierta !== fila) cerrarDeslizada();
    inicio = e.clientX;
    dx = 0;
    activo = true;
    fila.classList.add('arrastrando');
  });

  fila.addEventListener('pointermove', (e) => {
    if (!activo) return;
    const base = fila.classList.contains('abierta') ? -ANCHO : 0;
    dx = Math.max(-ANCHO, Math.min(0, base + (e.clientX - inicio)));
    mover(fila, dx);
  });

  const soltar = () => {
    if (!activo) return;
    activo = false;
    alSoltar(fila, dx);
  };
  fila.addEventListener('pointerup', soltar);
  fila.addEventListener('pointercancel', soltar);
  fila.addEventListener('pointerleave', soltar);

  /* Si quedó abierta, el primer toque en la fila solo la cierra. */
  fila.addEventListener('click', (e) => {
    if (fila.classList.contains('abierta') && !e.target.closest('[data-borrar]')) {
      e.preventDefault();
      e.stopPropagation();
      cerrarDeslizada();
    }
  }, true);
}

/** Engancha todas las filas deslizables que haya dentro de `raiz`. */
export function conectarDeslizar(raiz) {
  abierta = null;
  raiz.querySelectorAll('.lista-fila[data-desliza]').forEach(conectarFila);
}

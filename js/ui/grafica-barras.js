/* Gráfica de barras en HTML y CSS, sin librerías. Las barras son columnas de
   una rejilla con su alto en porcentaje: se ajustan solas al ancho y el texto
   nunca se estira como pasaría dentro de un SVG escalado.

   Los montos van completos ($000.00) y en seis columnas de teléfono no caben
   encima de cada barra, así que la gráfica enseña la forma y el detalle de
   la barra elegida se pinta aparte. Pinta, no calcula. */

import { escapar } from './texto.js';

/**
 * @param serie    [{ clave, etiqueta, valor }] en el orden en que se dibujan
 * @param elegida  la clave de la barra resaltada
 * @param titulo   para lectores de pantalla
 */
export function graficaBarras({ serie, elegida, titulo }) {
  const max = Math.max(...serie.map((p) => p.valor), 0);
  const columnas = serie.map((p) => {
    const alto = max > 0 ? Math.max(2, Math.round((p.valor / max) * 100)) : 2;
    return `
      <button type="button" class="barra-col ${p.clave === elegida ? 'elegida' : ''}"
              data-barra="${escapar(p.clave)}" aria-label="${escapar(p.etiqueta)}">
        <span class="barra-pista"><span class="barra" style="height:${alto}%"></span></span>
        <span class="barra-etiqueta">${escapar(p.etiqueta)}</span>
      </button>`;
  });
  return `
    <div class="barras" role="group" aria-label="${escapar(titulo)}"
         style="--columnas:${serie.length}">${columnas.join('')}</div>`;
}

/** Tocar una barra la resalta y avisa cuál fue. Se llama tras cada repintado. */
export function conectarBarras(raiz, alElegir) {
  const barras = raiz.querySelector('.barras');
  barras?.addEventListener('click', (evento) => {
    const col = evento.target.closest('[data-barra]');
    if (!col) return;
    barras.querySelectorAll('.barra-col').forEach((c) => c.classList.toggle('elegida', c === col));
    alElegir(col.dataset.barra);
  });
}

/** Una barra horizontal delgada, proporcional a `valor` contra `max`. */
export function barraHorizontal(valor, max) {
  if (!(max > 0) || !(valor > 0)) return '';
  const ancho = Math.max(2, Math.round((valor / max) * 100));
  return `<span class="barra-h"><span style="width:${ancho}%"></span></span>`;
}

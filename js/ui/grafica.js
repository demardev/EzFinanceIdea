/* SVG inline dibujado a mano: el saldo día a día del horizonte.
   Sin librerías. Marca la zona bajo cero en rojo y el día más ajustado. */

import { formatearFecha } from '../calc/fechas.js';
import { textoMonto } from './privacidad.js';

const ANCHO = 320;
const ALTO = 110;
const MARGEN = 6;

function escalas(serie) {
  const totales = serie.map((p) => p.total);
  const max = Math.max(...totales, 0);
  const min = Math.min(...totales, 0);
  const rango = max - min || 1;
  const x = (i) => MARGEN + (i * (ANCHO - MARGEN * 2)) / Math.max(1, serie.length - 1);
  const y = (v) => MARGEN + ((max - v) / rango) * (ALTO - MARGEN * 2);
  return { x, y, max, min };
}

/** @returns markup del <svg>, o un aviso si no hay serie */
export function graficaSaldo(serie, diaMasAjustado) {
  if (!serie || serie.length < 2) return '<p class="tenue-2">Sin datos para graficar.</p>';

  const { x, y } = escalas(serie);
  const puntos = serie.map((p, i) => `${x(i).toFixed(1)},${y(p.total).toFixed(1)}`);
  const linea = `M${puntos.join(' L')}`;
  const area = `${linea} L${x(serie.length - 1).toFixed(1)},${ALTO - MARGEN} `
             + `L${x(0).toFixed(1)},${ALTO - MARGEN} Z`;
  const cero = y(0).toFixed(1);

  const iAjustado = serie.findIndex((p) => p.fecha === diaMasAjustado?.fecha);
  const marca = iAjustado >= 0
    ? `<circle cx="${x(iAjustado).toFixed(1)}" cy="${y(serie[iAjustado].total).toFixed(1)}"
               r="3" class="g-marca"/>`
    : '';

  return `
    <svg viewBox="0 0 ${ANCHO} ${ALTO}" class="grafica" role="img"
         aria-label="Saldo día a día del horizonte">
      <defs>
        <clipPath id="bajo-cero">
          <rect x="0" y="${cero}" width="${ANCHO}" height="${ALTO}"/>
        </clipPath>
      </defs>
      <path d="${area}" class="g-area"/>
      <path d="${area}" class="g-area-neg" clip-path="url(#bajo-cero)"/>
      <line x1="0" y1="${cero}" x2="${ANCHO}" y2="${cero}" class="g-cero"/>
      <path d="${linea}" class="g-linea"/>
      <path d="${linea}" class="g-linea-neg" clip-path="url(#bajo-cero)"/>
      ${marca}
    </svg>`;
}

/** Pie de la gráfica: primer y último día del horizonte, con su saldo. Sin
    montos la gráfica solo enseña una forma que no se puede leer. */
export function piesDeGrafica(serie) {
  if (!serie?.length) return '';
  const extremo = (p, lado) => `
    <span style="text-align:${lado}">${formatearFecha(p.fecha)}<br>
      <span class="monto" style="color:var(--fg-2)">${textoMonto(p.total)}</span></span>`;
  return `
    <div class="fila-entre tenue-2" style="font-size:11.5px">
      ${extremo(serie[0], 'left')}${extremo(serie.at(-1), 'right')}
    </div>`;
}

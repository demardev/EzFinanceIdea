/* Rodillo de dígitos: cuando una cifra cambia, los números ruedan hasta el
   valor nuevo en vez de saltar, como un cuentakilómetros.

   Cada dígito es una tira vertical del 0 al 9 dentro de una caja de una línea
   con el resto oculto. Se pinta en el valor ANTERIOR y, ya en pantalla, se
   mueve al nuevo: la transición de CSS hace la rueda.

   El valor anterior se recuerda aquí porque la pantalla se reconstruye entera
   en cada repintado y el DOM viejo no sobrevive. */

import { textoMonto, estaOculto } from './privacidad.js';
import { escapar } from './texto.js';

const anteriores = new Map();
const DIGITOS = [...Array(10).keys()].map((d) => `<span>${d}</span>`).join('');
const RETRASO = 22;          // ms entre dígito y dígito, de izquierda a derecha

/** ¿Ya se pintó esta cifra alguna vez en esta sesión? */
export function hayRodillo(id) {
  return anteriores.has(id);
}

function prefiereQuieto() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* Los dos textos se emparejan por la DERECHA: así los centavos quedan
   enfrentados aunque el número haya cambiado de largo ($9,999 -> $10,000). */
function digitoAnterior(anterior, nuevo, i) {
  const caracter = anterior[i - (nuevo.length - anterior.length)];
  return /\d/.test(caracter ?? '') ? caracter : null;
}

function tira(desde, hasta, retraso) {
  return `<span class="rodillo"><span class="tira" data-a="${hasta}"
      style="transform:translateY(-${desde}em);transition-delay:${retraso}ms"
      >${DIGITOS}</span></span>`;
}

/**
 * @param id  identifica la cifra entre repintados ('patrimonio', 'neto'…)
 * @returns HTML: el monto ya formateado, listo para rodar
 */
export function rodillo(id, valor, opciones) {
  const texto = textoMonto(valor, opciones);
  const anterior = anteriores.get(id);
  anteriores.set(id, texto);

  const quieto = anterior === undefined || anterior === texto
              || estaOculto() || prefiereQuieto();
  if (quieto) return `<span class="rodillos">${escapar(texto)}</span>`;

  const partes = [...texto].map((caracter, i) => {
    if (!/\d/.test(caracter)) return `<span>${escapar(caracter)}</span>`;
    return tira(digitoAnterior(anterior, texto, i) ?? caracter, caracter, i * RETRASO);
  });
  return `<span class="rodillos">${partes.join('')}</span>`;
}

/** Se llama después de pintar: mueve las tiras a su destino. */
export function animarRodillos(contenedor) {
  const tiras = contenedor.querySelectorAll('.tira[data-a]');
  if (!tiras.length) return;
  /* Leer una medida obliga al navegador a calcular la posición inicial. Sin
     esto pinta directo en el destino y no se ve rodar nada. */
  void contenedor.offsetHeight;

  const aterrizar = () => tiras.forEach((t) => {
    t.style.transform = `translateY(-${t.dataset.a}em)`;
  });

  /* Con la pestaña en segundo plano requestAnimationFrame no dispara nunca, y
     entonces la cifra se quedaría clavada en el valor VIEJO: eso es un número
     equivocado en pantalla, peor que no animar. El temporizador es la red;
     llamar dos veces no hace daño. */
  requestAnimationFrame(aterrizar);
  setTimeout(aterrizar, 150);
}

/* Aritmética de dinero. Función PURA: sin red, sin DOM, sin importar nada.
   Todo con 2 decimales; el reparto no pierde centavos. */

/** Redondea a 2 decimales evitando el error binario (1.005 -> 1.01, no 1.00). */
export function redondear(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export function sumar(...montos) {
  return redondear(montos.reduce((total, n) => total + Number(n || 0), 0));
}

/**
 * Reparte un total en n partes iguales SIN perder centavos:
 * la última parte absorbe el residuo. sum(partes) === redondear(total).
 */
export function repartir(total, partes) {
  if (partes < 1) return [];
  const base = redondear(Math.floor((redondear(total) * 100) / partes) / 100);
  const lista = Array(partes - 1).fill(base);
  const acumulado = redondear(base * (partes - 1));
  lista.push(redondear(redondear(total) - acumulado));
  return lista;
}

/** "1.234,5" no; formato es-MX con separador de miles: "$1,234.50". */
export function formatear(n, { signo = false, moneda = '$' } = {}) {
  const valor = redondear(Math.abs(Number(n) || 0));
  const texto = valor.toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  const prefijo = signo && Number(n) > 0 ? '+' : Number(n) < 0 ? '−' : '';
  return `${prefijo}${moneda}${texto}`;
}

/** Clase del acento según el signo. Nunca color fuera de los tres permitidos. */
export function claseSigno(n) {
  if (Number(n) > 0) return 'pos';
  if (Number(n) < 0) return 'neg';
  return 'tenue';
}

/* ---------------------------------------------------------------------------
   Entrada de montos, estilo calculadora: NO se teclea el punto decimal. Los
   dígitos entran por la derecha y los dos últimos son siempre los centavos,
   así que teclear 1,0,0,0 muestra $10.00. Es lo que hacen las apps de banco:
   en el teclado numérico del teléfono no hay que buscar el punto.

   El input es type="text" (no "number") porque uno numérico rechaza las comas
   y no se puede formatear mientras se escribe. Estas funciones son puras; el
   pegado con el DOM va en ui/monto-input.js.
   --------------------------------------------------------------------------- */

function conMiles(entero) {
  return String(entero).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** '1,234.50' o '$1,234.50' -> 1234.5 */
export function aNumero(texto) {
  const limpio = String(texto ?? '').replace(/[^\d.-]/g, '');
  const n = Number.parseFloat(limpio);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Lo que se ve mientras se teclea. Toma TODOS los dígitos del campo y los
 * interpreta como centavos: '1000' -> '10.00'. Idempotente, así que se puede
 * volver a aplicar sobre su propia salida.
 */
export function formatearEntrada(texto) {
  const crudo = String(texto ?? '');
  const digitos = crudo.replace(/\D/g, '');
  if (!digitos) return '';
  const signo = crudo.trimStart().startsWith('-') ? '-' : '';
  const centavos = Number.parseInt(digitos, 10);
  const enteros = Math.floor(centavos / 100);
  const resto = String(centavos % 100).padStart(2, '0');
  return `${signo}${conMiles(enteros)}.${resto}`;
}

/** Un número ya guardado -> lo que se pone en el campo. 18430 -> '18,430.00' */
export function montoAEntrada(valor) {
  if (valor === '' || valor === null || valor === undefined) return '';
  const n = redondear(Number(valor) || 0);
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* Utilidades de texto para pintar. Sin lógica de negocio. */

/** Escapa lo que escribe el usuario antes de meterlo en innerHTML. */
export function escapar(valor) {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** "3 movimientos" / "1 movimiento" / "ningún movimiento" */
export function plural(n, singular, plural_, cero = `ningún ${singular}`) {
  if (n === 0) return cero;
  if (n === 1) return `1 ${singular}`;
  return `${n} ${plural_}`;
}

/** ["A"] → "A" · ["A", "B"] → "A y B" · ["A", "B", "C"] → "A, B y C" */
export function enLista(palabras) {
  if (palabras.length < 2) return palabras.join('');
  return `${palabras.slice(0, -1).join(', ')} y ${palabras.at(-1)}`;
}

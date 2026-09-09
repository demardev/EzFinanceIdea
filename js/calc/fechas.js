/* Fechas como cadenas 'YYYY-MM-DD'. Función PURA: sin red, sin DOM.

   Regla de oro: nunca `new Date('2026-09-08')`. Ese constructor interpreta la
   cadena como UTC y en América devuelve el día anterior. Aquí siempre se parte
   la cadena a mano y se construye con `new Date(anio, mes-1, dia)`, que es local. */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
               'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const dos = (n) => String(n).padStart(2, '0');

export function partes(iso) {
  const [anio, mes, dia] = String(iso).slice(0, 10).split('-').map(Number);
  return { anio, mes, dia };
}

export function aISO(anio, mes, dia) {
  return `${anio}-${dos(mes)}-${dos(dia)}`;
}

export function hoyISO() {
  const h = new Date();
  return aISO(h.getFullYear(), h.getMonth() + 1, h.getDate());
}

/** Día 0 del mes siguiente = último día de este mes. */
export function ultimoDiaDelMes(anio, mes) {
  return new Date(anio, mes, 0).getDate();
}

/** Corte 31 en febrero -> 28 (o 29 si es bisiesto). */
export function clampDia(anio, mes, dia) {
  return Math.min(dia, ultimoDiaDelMes(anio, mes));
}

export function sumarMeses(iso, n) {
  const { anio, mes, dia } = partes(iso);
  const total = (anio * 12) + (mes - 1) + n;
  const anioNuevo = Math.floor(total / 12);
  const mesNuevo = (total % 12) + 1;
  return aISO(anioNuevo, mesNuevo, clampDia(anioNuevo, mesNuevo, dia));
}

/* Sumar días exige normalizar: aISO() solo rellena con ceros, así que
   `dia + 60` daría "2026-09-68" y arruinaría cualquier comparación de fechas. */
export function sumarDias(iso, n) {
  const { anio, mes, dia } = partes(iso);
  const d = new Date(anio, mes - 1, dia + n);
  return aISO(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function mesDe(iso) {
  return String(iso).slice(0, 7);
}

/** '2026-02' -> { desde:'2026-02-01', hasta:'2026-02-28' } */
export function rangoDelMes(mes) {
  const [anio, m] = mes.split('-').map(Number);
  return { desde: aISO(anio, m, 1), hasta: aISO(anio, m, ultimoDiaDelMes(anio, m)) };
}

export function formatearFecha(iso) {
  const { anio, mes, dia } = partes(iso);
  return `${dos(dia)}/${MESES[mes - 1]}/${anio}`;
}

export function diasEntre(desde, hasta) {
  const a = partes(desde), b = partes(hasta);
  const ms = new Date(b.anio, b.mes - 1, b.dia) - new Date(a.anio, a.mes - 1, a.dia);
  return Math.round(ms / 86400000);
}

export function etiquetaDia(iso, hoy = hoyISO()) {
  const dif = diasEntre(iso, hoy);
  if (dif === 0) return 'Hoy';
  if (dif === 1) return 'Ayer';
  return formatearFecha(iso);
}

/** Para el selector de mes: '2026-09' -> 'septiembre 2026' */
export function nombreDelMes(mes) {
  const largos = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
                  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const [anio, m] = mes.split('-').map(Number);
  return `${largos[m - 1]} ${anio}`;
}

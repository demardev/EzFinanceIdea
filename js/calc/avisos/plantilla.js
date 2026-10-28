/* Plantillas de aviso: el mensaje del banco con huecos donde cambia.
   Función PURA: sin red, sin DOM.

     'Se hizo un Debito en su Cuenta B. CUSCATLAN {origen} por USD{monto} el dia {fecha}. {*}'

   El texto fijo se compara sin importar mayúsculas, acentos ni espacios de
   más; cada hueco sabe qué buscar. Las de fábrica y las que enseña el
   usuario son lo mismo, así que un banco nuevo no exige tocar código. */

import { limpiar, aMonto, leerFecha, PATRON_MONTO, PATRON_FECHA } from './partes.js';

const HUECOS = {
  monto: `(${PATRON_MONTO})`,
  fecha: `(${PATRON_FECHA})`,
  comercio: '(.+?)',
  persona: '(.+?)',
  referencia: '(\\d+)',
  origen: 'X*(\\d{4})',       // últimos 4, aunque vengan tapados: XXXXXX9430
  destino: 'X*(\\d{4})',
  '*': '.*',                  // lo que cambia y no interesa
};
const SENTIDOS = ['sale', 'entra', 'entre'];
const MAX_TEXTO = 600;

const huecosDe = (texto) => [...texto.matchAll(/\{(\w+|\*)\}/g)].map((m) => m[1]);

/** null si sirve; si no, qué le falta, en palabras para el usuario. */
export function validarPlantilla(p) {
  if (typeof p?.texto !== 'string' || !p.texto.trim()) return 'Falta el texto del aviso.';
  if (p.texto.length > MAX_TEXTO) return 'El texto del aviso es demasiado largo.';
  if (!SENTIDOS.includes(p.sentido)) return 'Falta decir si el dinero sale, entra o se mueve entre tus cuentas.';
  const huecos = huecosDe(p.texto);
  const raro = huecos.find((h) => !(h in HUECOS));
  if (raro) return `No conozco el hueco {${raro}}.`;
  if (!huecos.includes('monto')) return 'Falta marcar el monto.';
  const repetido = huecos.find((h, i) => h !== '*' && huecos.indexOf(h) !== i);
  return repetido ? `El hueco {${repetido}} está dos veces.` : null;
}

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* Dentro del texto fijo, un espacio es "uno o más"; junto a un hueco, "cero o
   más": así "USD{monto}" acepta "USD23.98" y "USD 23.98". */
function aExpresion(texto) {
  const piezas = texto.split(/\{(\w+|\*)\}/).map((pieza, i) => (i % 2
    ? HUECOS[pieza]
    : limpiar(pieza).split(' ').filter(Boolean).map(escapar).join('\\s+')));
  return new RegExp(`^\\s*${piezas.filter(Boolean).join('\\s*')}[\\s.]*$`, 'i');
}

const compiladas = new Map();
function compilar(texto) {
  if (!compiladas.has(texto)) {
    compiladas.set(texto, { regex: aExpresion(texto),
                            nombres: huecosDe(texto).filter((h) => h !== '*') });
  }
  return compiladas.get(texto);
}

function producto(definicion, ultimos) {
  if (!definicion && !ultimos) return null;
  return { tipo: definicion?.tipo ?? null, nombre: definicion?.nombre ?? null,
           ultimos: ultimos ?? null };
}

function contraparte({ comercio, persona }) {
  if (comercio) return { tipo: 'comercio', nombre: comercio };
  return persona ? { tipo: 'persona', nombre: persona } : null;
}

/**
 * @param limpio el texto ya pasado por limpiar()
 * @returns lo que dice el aviso, o null si esta plantilla no es la suya
 */
export function leerConPlantilla(limpio, p) {
  if (validarPlantilla(p)) return null;
  const { regex, nombres } = compilar(p.texto);
  const m = regex.exec(limpio);
  if (!m) return null;
  const v = Object.fromEntries(nombres.map((nombre, i) => [nombre, m[i + 1]?.trim()]));
  const monto = aMonto(v.monto);
  if (!monto) return null;
  const cuando = v.fecha ? leerFecha(v.fecha) : null;
  return {
    reconocido: true, plantilla: p.id ?? null, banco: p.banco ?? null, sentido: p.sentido,
    monto, fecha: cuando?.fecha ?? null, hora: cuando?.hora ?? null,
    origen: producto(p.origen, v.origen), destino: producto(p.destino, v.destino),
    contraparte: contraparte(v), referencia: v.referencia ?? null,
  };
}

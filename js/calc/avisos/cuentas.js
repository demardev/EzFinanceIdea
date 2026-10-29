/* De qué cuenta de la app es cada aviso, y quién eres tú en los avisos.
   Función PURA: sin red, sin DOM.

   Se aprende al registrar, igual que las tarjetas de Wallet, y en la misma
   tabla (wallet_origenes), con un prefijo en el nombre:
     'aviso:tarjeta:0242'          → 'tarjeta:<id>'
     'aviso:niu:cuenta:cuenta niu' → 'cuenta:<id>'
     'persona:dennys omar lopez'   → 'propia'   (eres tú: va como transferencia)

   Con últimos 4 la clave no lleva el banco: la tarjeta 0242 es la misma en el
   aviso de Cuscatlán y en la recarga de Niu. Sin dígitos, sí: "la cuenta" de
   Cuscatlán no es la de Promerica. */

import { limpiar } from './partes.js';

const AVISO = 'aviso:';
const PERSONA = 'persona:';
const PROPIA = 'propia';
const BANCOS = { cuscatlan: 'Cuscatlán', niu: 'Niu', bac: 'BAC', promerica: 'Promerica' };
const TIPOS = { cuenta: 'Cuenta', tarjeta: 'Tarjeta', debito: 'Débito' };

const normal = (texto) => limpiar(texto).toLowerCase();

export const esClaveDeAviso = (clave) => clave.startsWith(AVISO) || clave.startsWith(PERSONA);

/** La clave de un producto leído del aviso ({ tipo, nombre, ultimos }), o null. */
export function claveDeProducto(banco, producto) {
  if (!producto?.tipo) return null;
  if (producto.ultimos) return `${AVISO}${producto.tipo}:${producto.ultimos}`;
  const nombre = producto.nombre ? `:${normal(producto.nombre)}` : '';
  return `${AVISO}${banco}:${producto.tipo}${nombre}`;
}

const mayuscula = (p) => p.charAt(0).toUpperCase() + p.slice(1);

/** Cómo se lee una clave en Ajustes. */
export function etiquetaDeClave(clave) {
  if (clave.startsWith(PERSONA)) return clave.slice(PERSONA.length).split(' ').map(mayuscula).join(' ');
  const partes = clave.slice(AVISO.length).split(':');
  if (/^\d{4}$/.test(partes[1])) return `${TIPOS[partes[0]] ?? partes[0]} ${partes[1]}`;
  return `${TIPOS[partes[1]] ?? partes[1]} de ${BANCOS[partes[0]] ?? partes[0]}`;
}

/* ------------------------------------------------------------ quién eres -- */

const palabras = (nombre) => normal(nombre).split(' ').filter(Boolean);

/* Iguales, o una es la otra con una letra menos: el banco que se come la Ñ. */
function parecidas(a, b) {
  if (a === b) return true;
  const [corta, larga] = a.length < b.length ? [a, b] : [b, a];
  if (larga.length - corta.length !== 1) return false;
  return [...larga].some((_, i) => larga.slice(0, i) + larga.slice(i + 1) === corta);
}

const dentro = (unas, otras) => unas.every((p) => otras.some((o) => parecidas(p, o)));

/** ¿Es uno de tus nombres? Basta con dos palabras que estén en uno aprendido. */
export function esPersonaPropia(nombre, aprendidas) {
  const suyas = palabras(nombre);
  if (suyas.length < 2) return false;
  return Object.entries(aprendidas)
    .filter(([clave, valor]) => clave.startsWith(PERSONA) && valor === PROPIA)
    .some(([clave]) => {
      const tuyas = palabras(clave.slice(PERSONA.length));
      return dentro(suyas, tuyas) || dentro(tuyas, suyas);
    });
}

/* ----------------------------------------------------- aplicar y aprender -- */

const claseDe = (valor) => String(valor || '').split(':')[0];
const idDe = (valor) => String(valor || '').split(':')[1] || '';

/* Una tarjeta solo puede ser una tarjeta; cuenta y débito, una cuenta. */
const compatible = (producto, valor) =>
  (producto.tipo === 'tarjeta') === (claseDe(valor) === 'tarjeta');

function aprendido(aviso, lado, aprendidas) {
  const producto = aviso[lado];
  const valor = aprendidas[claveDeProducto(aviso.banco, producto)] ?? '';
  return valor && compatible(producto, valor) ? valor : '';
}

/** El tipo de movimiento: entre tus cuentas si el aviso lo dice o si eres tú. */
export function tipoDeAviso(aviso, aprendidas) {
  if (aviso.sentido === 'entre') return 'transferencia';
  if (aviso.contraparte?.tipo === 'persona'
      && esPersonaPropia(aviso.contraparte.nombre, aprendidas)) return 'transferencia';
  return aviso.sentido === 'entra' ? 'ingreso' : 'egreso';
}

/** Los campos de ruteo del formulario para ese tipo, con lo aprendido. */
export function rutaDeAviso(aviso, tipo, aprendidas) {
  const origen = aprendido(aviso, 'origen', aprendidas);
  const destino = aprendido(aviso, 'destino', aprendidas);
  if (tipo === 'egreso') return { origen };
  const soloCuenta = (v) => (claseDe(v) === 'cuenta' ? idDe(v) : '');
  if (tipo === 'ingreso') return { cuenta_id: soloCuenta(destino) };
  return { cuenta_id: soloCuenta(origen), destino };
}

/* Lo que quedó de cada lado en la fila guardada, como 'cuenta:<id>'. */
function ladosDe(fila) {
  const uno = (cuenta, tarjeta) => (cuenta ? `cuenta:${cuenta}` : tarjeta ? `tarjeta:${tarjeta}` : '');
  if (fila.tipo === 'egreso') return { origen: uno(fila.cuenta_id, fila.tarjeta_id), destino: '' };
  if (fila.tipo === 'ingreso') return { origen: '', destino: uno(fila.cuenta_id) };
  return { origen: uno(fila.cuenta_id),
           destino: uno(fila.cuenta_destino_id, fila.tarjeta_destino_id) };
}

/** [[clave, valor]] que deja un aviso registrado como `fila`. Tu nombre solo
    si todavía no te reconoce: así no se juntan sus variantes en Ajustes. */
export function aprendizajeDe(item, fila, aprendidas = {}) {
  const aviso = item.aviso;
  if (!aviso?.reconocido) return [];
  const lados = ladosDe(fila);
  const pares = ['origen', 'destino']
    .filter((lado) => aviso[lado] && lados[lado] && compatible(aviso[lado], lados[lado]))
    .map((lado) => [claveDeProducto(aviso.banco, aviso[lado]), lados[lado]]);
  if (fila.tipo === 'transferencia' && aviso.sentido !== 'entre'
      && aviso.contraparte?.tipo === 'persona'
      && !esPersonaPropia(aviso.contraparte.nombre, aprendidas)) {
    pares.push([`${PERSONA}${normal(aviso.contraparte.nombre)}`, PROPIA]);
  }
  return pares;
}

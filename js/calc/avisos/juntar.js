/* Juntar en la bandeja lo que es una sola operación. Función PURA: sin red,
   sin DOM.

   Solo lo claro, de fuentes distintas:
   - 'mismo':         el mismo aviso por SMS y por correo: mismo banco,
                      sentido, monto, día y hora. El correo, que trae más
                      detalle, va al frente.
   - 'applepay':      el pago con Apple Pay y el SMS de esa compra.
   - 'transferencia': el envío de un banco y el abono en otro, a tu nombre
                      (cada lado puede ser ya un 'mismo').
   Dos pagos seguidos de montos distintos nunca se juntan, y dos iguales se
   juntan cada uno con el más cercano. Lo que separaste se queda separado.

   Una entrada juntada lleva `partes` (todos los items: se borran y se
   aprende de ellos) y `lados` (los dos que arman el borrador). */

import { borradorDeBandeja, nombreDeBanco } from '../bandeja.js';
import { esPersonaPropia, rutaDeAviso } from './cuentas.js';

const MINUTOS = { applepay: 15, transferencia: 30, mismo: 24 * 60 };

const centavos = (monto) => Math.round(Number(monto) * 100);
const minutosEntre = (a, b) => Math.abs(Date.parse(a.created_at) - Date.parse(b.created_at)) / 60000;
const leido = (item) => item.aviso?.reconocido;
const partesDe = (e) => e.partes ?? [e];

/** La misma clave sin importar el orden: es la que se guarda al separar. */
export const claveDe = (...entradas) => entradas.flatMap(partesDe).map((p) => p.id).sort().join('+');

const esPropia = (item, aprendidas) => item.aviso.contraparte?.tipo === 'persona'
  && esPersonaPropia(item.aviso.contraparte.nombre, aprendidas);

function comoMismo(a, b) {
  if (!leido(a) || !leido(b) || a.origen === b.origen || !a.aviso.hora) return null;
  const iguales = ['banco', 'sentido', 'fecha', 'hora'].every((k) => a.aviso[k] === b.aviso[k]);
  if (!iguales) return null;
  return { junta: 'mismo', lados: a.origen === 'correo' ? [a, b] : [b, a] };
}

function comoApplePay(a, b) {
  const [ap, otro] = a.origen === 'applepay' ? [a, b] : [b, a];
  if (ap.origen !== 'applepay' || !leido(otro) || otro.aviso.sentido !== 'sale') return null;
  return { junta: 'applepay', lados: [ap, otro] };
}

function comoTransferencia(a, b, aprendidas) {
  if (!leido(a) || !leido(b) || a.aviso.banco === b.aviso.banco) return null;
  const [sale, entra] = a.aviso.sentido === 'sale' ? [a, b] : [b, a];
  if (sale.aviso.sentido !== 'sale' || entra.aviso.sentido !== 'entra') return null;
  if (!esPropia(sale, aprendidas) && !esPropia(entra, aprendidas)) return null;
  return { junta: 'transferencia', lados: [sale, entra] };
}

function candidatos(items, reglas, separados) {
  const lista = [];
  items.forEach((a, i) => items.slice(i + 1).forEach((b) => {
    if (!a.monto || centavos(a.monto) !== centavos(b.monto)) return;
    const par = reglas.map((regla) => regla(a, b)).find(Boolean);
    const minutos = minutosEntre(a, b);
    if (par && minutos <= MINUTOS[par.junta] && !separados.has(claveDe(a, b))) {
      lista.push({ ...par, minutos });
    }
  }));
  return lista.sort((x, y) => x.minutos - y.minutos);
}

/* Lo juntado se ve como su primer lado, con todas sus partes. */
function entradaDe({ junta, lados }) {
  return { ...lados[0], id: claveDe(...lados), junta, lados, partes: lados.flatMap(partesDe) };
}

/* Una pasada: cada item en a lo más un par, el más cercano primero. */
function juntarCon(items, reglas, separados) {
  const usados = new Map();
  for (const par of candidatos(items, reglas, separados)) {
    if (par.lados.some((l) => usados.has(l.id))) continue;
    const entrada = entradaDe(par);
    par.lados.forEach((l) => usados.set(l.id, entrada));
  }
  const vistos = new Set();
  return items.map((item) => usados.get(item.id) ?? item)
    .filter((e) => !vistos.has(e.id) && vistos.add(e.id));
}

/**
 * @param items      los de la bandeja, ya pasados por conAviso()
 * @param aprendidas lo aprendido (para saber si una persona eres tú)
 * @param separados  Set de claveDe() que separaste
 * @returns los items sueltos y los juntados, en el orden en que llegaron
 */
export function juntarPendientes(items, aprendidas, separados = new Set()) {
  const sinRepetir = juntarCon(items, [comoMismo], separados);
  return juntarCon(sinRepetir, [comoApplePay, (a, b) => comoTransferencia(a, b, aprendidas)],
                   separados);
}

/* Apple Pay pone el comercio y la tarjeta de Wallet; el SMS, la fecha y, si
   Wallet no la sabe, la tarjeta que aprendió de sus avisos. */
function deApplePay([ap, sms], origenes, categorias) {
  const deAp = borradorDeBandeja(ap, origenes, categorias);
  const delSms = borradorDeBandeja(sms, origenes, categorias);
  return { ...deAp, fecha: delSms.fecha, origen: deAp.origen || delSms.origen };
}

function deTransferencia([sale, entra], origenes) {
  const base = borradorDeBandeja(sale, origenes);
  return {
    ...base, tipo: 'transferencia', categoria_id: '', origen: '',
    descripcion: `De ${nombreDeBanco(sale.aviso.banco)} a ${nombreDeBanco(entra.aviso.banco)}`,
    cuenta_id: rutaDeAviso(sale.aviso, 'transferencia', origenes).cuenta_id,
    destino: rutaDeAviso(entra.aviso, 'transferencia', origenes).destino,
  };
}

/** Lo que trae puesto el formulario, sea un item suelto o un par. */
export function borradorDeEntrada(entrada, origenes, categorias = {}) {
  if (entrada.junta === 'applepay') return deApplePay(entrada.lados, origenes, categorias);
  if (entrada.junta === 'transferencia') return deTransferencia(entrada.lados, origenes);
  return borradorDeBandeja(entrada, origenes, categorias);
}

/**
 * Lo que trae puesto el pago de recibo cuando eliges "negocio" en Por
 * confirmar: monto, día y cuenta, y el mensaje en la nota para llenar el
 * resto. Lo que no se sabe no va, para que el formulario ponga lo de Ajustes.
 */
export function borradorDePago(entrada, borrador) {
  const textos = (entrada.partes ?? [entrada]).map((p) => p.texto).filter(Boolean);
  const nota = textos.length ? textos.join(' / ')
    : ['Apple Pay', entrada.comercio, entrada.tarjeta].filter(Boolean).join(' · ');
  const [clase, id] = String(borrador.origen || '').split(':');
  return {
    ...(borrador.monto > 0 ? { monto_recibo: borrador.monto } : {}),
    fecha_pago: borrador.fecha,
    ...(clase === 'cuenta' && id ? { cuenta_pago_id: id } : {}),
    nota,
  };
}

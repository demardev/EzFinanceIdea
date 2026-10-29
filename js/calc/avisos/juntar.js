/* Juntar en la bandeja lo que es una sola operación. Función PURA: sin red,
   sin DOM.

   Solo pares claros, de dos fuentes distintas:
   - 'applepay':      el pago con Apple Pay y el SMS de esa compra.
   - 'transferencia': el envío de un banco y el abono en otro, a tu nombre.
   Mismo monto y llegados con minutos de diferencia. Dos pagos seguidos de
   montos distintos nunca se juntan, y dos iguales se juntan cada uno con
   el aviso más cercano. Lo que separaste a mano se queda separado. */

import { borradorDeBandeja, nombreDeBanco } from '../bandeja.js';
import { esPersonaPropia, rutaDeAviso } from './cuentas.js';

const MINUTOS = { applepay: 15, transferencia: 30 };

const centavos = (monto) => Math.round(Number(monto) * 100);
const minutosEntre = (a, b) => Math.abs(Date.parse(a.created_at) - Date.parse(b.created_at)) / 60000;
const leido = (item) => item.aviso?.reconocido;

/** La misma clave sin importar el orden: es la que se guarda al separar. */
export const claveDePar = (a, b) => [a.id, b.id].sort().join('+');

const esPropia = (item, aprendidas) => item.aviso.contraparte?.tipo === 'persona'
  && esPersonaPropia(item.aviso.contraparte.nombre, aprendidas);

/* [a, b] en el orden en que van en el par, o null si no son la misma operación. */
function comoPar(a, b, aprendidas) {
  if (!a.monto || centavos(a.monto) !== centavos(b.monto)) return null;
  const [ap, otro] = a.origen === 'applepay' ? [a, b] : [b, a];
  if (ap.origen === 'applepay' && leido(otro) && otro.aviso.sentido === 'sale') {
    return { junta: 'applepay', partes: [ap, otro] };
  }
  if (!leido(a) || !leido(b) || a.aviso.banco === b.aviso.banco) return null;
  const [sale, entra] = a.aviso.sentido === 'sale' ? [a, b] : [b, a];
  if (sale.aviso.sentido !== 'sale' || entra.aviso.sentido !== 'entra') return null;
  if (!esPropia(sale, aprendidas) && !esPropia(entra, aprendidas)) return null;
  return { junta: 'transferencia', partes: [sale, entra] };
}

function candidatos(items, aprendidas, separados) {
  const lista = [];
  items.forEach((a, i) => items.slice(i + 1).forEach((b) => {
    const par = comoPar(a, b, aprendidas);
    const minutos = minutosEntre(a, b);
    if (par && minutos <= MINUTOS[par.junta] && !separados.has(claveDePar(a, b))) {
      lista.push({ ...par, minutos });
    }
  }));
  return lista.sort((x, y) => x.minutos - y.minutos);
}

/* El par se ve como su primera parte, con la lista de las dos. */
function entradaDe({ junta, partes }) {
  const [principal] = partes;
  return { ...principal, id: claveDePar(...partes), junta, partes };
}

/**
 * @param items      los de la bandeja, ya pasados por conAviso()
 * @param aprendidas lo aprendido (para saber si una persona eres tú)
 * @param separados  Set de claveDePar() que separaste
 * @returns los items sueltos y los pares, en el orden en que llegaron
 */
export function juntarPendientes(items, aprendidas, separados = new Set()) {
  const usados = new Map();
  for (const par of candidatos(items, aprendidas, separados)) {
    if (par.partes.some((p) => usados.has(p.id))) continue;
    const entrada = entradaDe(par);
    par.partes.forEach((p) => usados.set(p.id, entrada));
  }
  const vistos = new Set();
  return items.map((item) => usados.get(item.id) ?? item)
    .filter((e) => !vistos.has(e.id) && vistos.add(e.id));
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
  if (entrada.junta === 'applepay') return deApplePay(entrada.partes, origenes, categorias);
  if (entrada.junta === 'transferencia') return deTransferencia(entrada.partes, origenes);
  return borradorDeBandeja(entrada, origenes, categorias);
}

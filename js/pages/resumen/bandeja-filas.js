/* Cómo se ve cada cosa en Por confirmar: un item suelto o un par juntado, y
   el bloque que dice qué se juntó, con su botón para separarlo.

   Lo separado se recuerda en este teléfono: es una preferencia de vista, no
   un dato. Si se pierde, el par simplemente vuelve a aparecer junto. */

import { filaEditable } from '../../ui/lista.js';
import { textoMonto } from '../../ui/privacidad.js';
import { escapar } from '../../ui/texto.js';
import { formatearFecha } from '../../calc/fechas.js';
import { fechaLocalDe, nombreDeBanco } from '../../calc/bandeja.js';

const LLAVE = 'finanzas.bandeja-separados';
const MAX_SEPARADOS = 100;

export function leerSeparados() {
  try { return new Set(JSON.parse(localStorage.getItem(LLAVE)) ?? []); } catch { return new Set(); }
}

export function separar(clave) {
  const lista = [...leerSeparados(), clave].slice(-MAX_SEPARADOS);
  try { localStorage.setItem(LLAVE, JSON.stringify(lista)); } catch { /* da igual */ }
}

const bancoDe = (item) => nombreDeBanco(item.aviso?.banco) ?? 'el banco';

/* De dónde vino. De un aviso que no se reconoció se enseña el principio del
   texto: es lo único que dice qué fue. */
function origenDe(item) {
  if (item.junta === 'applepay') return `Apple Pay + SMS de ${bancoDe(item.lados[1])}`;
  if (item.junta === 'mismo') return `${bancoDe(item)} · SMS + correo`;
  if (item.junta === 'transferencia') return 'Envío + abono';
  if (!item.aviso) return item.tarjeta ?? '';
  if (item.origen === 'correo' && !item.aviso.reconocido) return `Correo · ${item.texto.slice(0, 90)}`;
  if (!item.aviso.reconocido) return item.texto.slice(0, 90);
  const { origen, destino } = item.aviso;
  const ultimos = origen?.ultimos ?? destino?.ultimos;
  return `${bancoDe(item)}${ultimos ? ` ${ultimos}` : ''}`;
}

function iconoDe(item) {
  if (item.junta === 'transferencia') return 'arrows';
  return item.aviso && item.junta !== 'applepay' ? 'banco' : 'card';
}

/** @param borrador el de borradorDeEntrada(): su descripción es el nombre. */
export function filaDeEntrada(item, borrador) {
  const cuando = formatearFecha(borrador.fecha || fechaLocalDe(item.created_at));
  const de = origenDe(item);
  const sinLeer = item.aviso && !item.aviso.reconocido;
  return filaEditable({
    id: item.id,
    nombre: borrador.descripcion,
    sub: !de ? cuando : sinLeer ? `${cuando} · ${de}` : `${de} · ${cuando}`,
    derecha: item.monto ? textoMonto(item.monto) : 'Sin monto',
    iconoNombre: iconoDe(item),
    deslizable: true,
  });
}

/** Los pares juntados, cada uno con su "Separar". Nada si no hay. */
export function bloqueJuntados(pares, borradores) {
  if (!pares.length) return '';
  const filas = pares.map((par) => `
    <div class="fila" style="gap:8px">
      <span class="crece truncar">${escapar(borradores.get(par.id).descripcion)}</span>
      <span class="tenue">${textoMonto(par.monto)}</span>
      <button class="btn" type="button" data-separar="${escapar(par.id)}">Separar</button>
    </div>`);
  return `
    <div class="card pila-sm" style="margin-top:12px;font-size:13px">
      <p class="tenue">Se juntaron porque parecen la misma operación. Si no lo son,
        sepáralos.</p>
      ${filas.join('')}
    </div>`;
}

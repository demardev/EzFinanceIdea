/* "Por confirmar": lo que llegó solo por el atajo — compras con Apple Pay y
   avisos del banco por SMS. Tocar uno abre el formulario de movimiento ya
   lleno; deslizarlo lo descarta. Al registrarla sale de la bandeja, y si su tarjeta de Wallet
   todavía no tenía pareja en la app, se aprende para la próxima. */

import { abrirSheet } from '../../ui/sheet.js';
import { filaEditable, envolverLista } from '../../ui/lista.js';
import { conectarDeslizar, cerrarDeslizada } from '../../ui/deslizar.js';
import { confirmar } from '../../ui/confirmar.js';
import { textoMonto } from '../../ui/privacidad.js';
import { aviso, avisoError } from '../../ui/toast.js';
import { formatearFecha } from '../../calc/fechas.js';
import { fechaLocalDe, borradorDeBandeja, claveDeComercio, listasParaRegistrar,
         conAviso, nombreDeBanco, descripcionDe } from '../../calc/bandeja.js';
import { abrirRegistro } from '../../movimientos/registrar.js';
import { alRegistrarDe } from './bandeja-aprender.js';
import { TIPOS } from '../../movimientos/tipos.js';
import { plural } from '../../ui/texto.js';
import { icono } from '../../iconos/render.js';

/* De un aviso que no se reconoció se enseña el principio del texto: es lo
   único que dice qué fue. */
function subDe(item, cuando) {
  if (!item.aviso) return item.tarjeta ? `${item.tarjeta} · ${cuando}` : cuando;
  if (!item.aviso.reconocido) return `${cuando} · ${item.texto.slice(0, 90)}`;
  const { banco, origen, destino } = item.aviso;
  const ultimos = origen?.ultimos ?? destino?.ultimos;
  return `${nombreDeBanco(banco)}${ultimos ? ` ${ultimos}` : ''} · ${cuando}`;
}

function fila(item) {
  const cuando = formatearFecha(item.aviso?.fecha || fechaLocalDe(item.created_at));
  return filaEditable({
    id: item.id,
    nombre: descripcionDe(item),
    sub: subDe(item, cuando),
    derecha: item.monto ? textoMonto(item.monto) : 'Sin monto',
    iconoNombre: item.aviso ? 'banco' : 'card',
    deslizable: true,
  });
}

/* El historial solo se consulta para los comercios que aún no tienen
   categoría confirmada. */
async function cargarSugerencias(bandeja, items) {
  const [origenes, aprendidas] = await Promise.all([bandeja.origenes(), bandeja.aprendidas()]);
  const porBuscar = new Map(items
    .map((i) => [claveDeComercio(i.comercio), i.comercio])
    .filter(([clave]) => clave && !aprendidas[clave]));
  const historial = await bandeja.delHistorial([...porBuscar]);
  return { origenes, categorias: { aprendidas, historial } };
}

/* Lo que sigue activo: una tarjeta archivada o una categoría de otro tipo
   no cuentan como "puestas" para registrar sin revisar. */
async function cargarVigentes({ cuentas, tarjetas, categorias }) {
  const [cts, tjs, cats] = await Promise.all([
    cuentas.listarActivas(), tarjetas.listarActivas(), categorias.listarActivas(),
  ]);
  return {
    origenes: new Set([...cts.map((c) => `cuenta:${c.id}`), ...tjs.map((t) => `tarjeta:${t.id}`)]),
    categorias: new Set(cats.filter((c) => c.tipo === 'egreso').map((c) => c.id)),
  };
}

function botonTodas({ listas, total, faltan }) {
  if (!listas.length) return '';
  return `
    <button class="btn btn-primario btn-bloque" id="btn-registrar-todas" type="button"
            style="margin-bottom:10px">
      ${icono('check', 16)} Registrar ${plural(listas.length, 'completa', 'completas')}
      · ${textoMonto(total)}
    </button>
    ${faltan ? `<p class="tenue-2" style="font-size:12.5px;margin-bottom:10px">
      ${plural(faltan, 'se queda', 'se quedan')} para revisar: le falta tarjeta o categoría.</p>` : ''}`;
}

/* Una por una, en orden: si una falla, las anteriores ya quedaron y la que
   falló sigue en la bandeja. Cada movimiento sale de la bandeja al crearse. */
async function registrarTodas({ movimientos, bandeja }, { listas, total }) {
  const ok = await confirmar({
    titulo: `¿Registrar ${plural(listas.length, 'compra', 'compras')}?`,
    mensaje: `Por ${textoMonto(total)}, con la tarjeta y la categoría que traen.`,
    textoOk: 'Registrar', peligro: false,
  });
  if (!ok) return false;
  let hechas = 0;
  try {
    for (const { item, borrador } of listas) {
      await movimientos.crear(TIPOS.egreso.aFila({ ...borrador, nota: '' }));
      await bandeja.eliminar(item.id);
      hechas += 1;
    }
  } finally {
    if (hechas) aviso(`${plural(hechas, 'compra registrada', 'compras registradas')}.`);
  }
  return true;
}

async function descartar(contexto, item, alCambiar) {
  const que = item.aviso ? 'Aviso' : 'Compra';
  const ok = await confirmar({
    titulo: `¿Descartar ${item.aviso ? 'este aviso' : 'esta compra'}?`,
    mensaje: `${item.comercio || que}${item.monto ? ` · ${textoMonto(item.monto)}` : ''}. No se registra nada.`,
    textoOk: 'Descartar',
  });
  if (!ok) return false;
  await contexto.bandeja.eliminar(item.id);
  aviso(item.aviso ? 'Aviso descartado.' : 'Compra descartada.');
  await alCambiar();
  return true;
}

function conectarTodas(hoja, cerrar, registrar, alCambiar) {
  hoja.querySelector('#btn-registrar-todas')?.addEventListener('click', async () => {
    try {
      if (!await registrar()) return;
      cerrar();
    } catch (e) { avisoError(e); cerrar(); }
    await alCambiar();
  });
}

export async function abrirPorConfirmar(contexto, recibidos, alCambiar) {
  const items = recibidos.map((item) => conAviso(item));
  const [sugerencias, vigentes] = await Promise.all([
    cargarSugerencias(contexto.bandeja, items), cargarVigentes(contexto),
  ]);
  const completas = listasParaRegistrar(items, sugerencias, vigentes);
  const { hoja, cerrar } = abrirSheet({
    titulo: `Por confirmar · ${items.length}`,
    cuerpo: `
      ${botonTodas(completas)}
      <p class="tenue" style="font-size:13px;margin-bottom:10px">
        Toca una para registrarla. Desliza a la izquierda para descartarla.</p>
      ${envolverLista(items.map(fila))}`,
  });
  conectarDeslizar(hoja);
  conectarTodas(hoja, cerrar, () => registrarTodas(contexto, completas), alCambiar);

  hoja.addEventListener('click', async (evento) => {
    const objetivo = evento.target.closest('[data-editar], [data-borrar]');
    if (!objetivo) return;
    const item = items.find((i) => i.id === (objetivo.dataset.editar || objetivo.dataset.borrar));
    try {
      if (objetivo.dataset.borrar) {
        cerrarDeslizada();
        if (await descartar(contexto, item, alCambiar)) cerrar();
        return;
      }
      cerrar();
      const borrador = borradorDeBandeja(item, sugerencias.origenes, sugerencias.categorias);
      await abrirRegistro(contexto, borrador, alCambiar, undefined,
                          { alRegistrar: alRegistrarDe(contexto, item, sugerencias) });
    } catch (e) { avisoError(e); }
  });
}

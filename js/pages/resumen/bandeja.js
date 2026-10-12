/* "Por confirmar": las compras que llegaron solas (Apple Pay, por el atajo).
   Tocar una abre el formulario de movimiento ya lleno; deslizarla la
   descarta. Al registrarla sale de la bandeja, y si su tarjeta de Wallet
   todavía no tenía pareja en la app, se aprende para la próxima. */

import { abrirSheet } from '../../ui/sheet.js';
import { filaEditable, envolverLista } from '../../ui/lista.js';
import { conectarDeslizar, cerrarDeslizada } from '../../ui/deslizar.js';
import { confirmar } from '../../ui/confirmar.js';
import { unirDestino } from '../../ui/campos.js';
import { textoMonto } from '../../ui/privacidad.js';
import { aviso, avisoError } from '../../ui/toast.js';
import { formatearFecha } from '../../calc/fechas.js';
import { fechaLocalDe, borradorDeBandeja, claveDeComercio,
         listasParaRegistrar } from '../../calc/bandeja.js';
import { abrirRegistro } from '../../movimientos/registrar.js';
import { TIPOS } from '../../movimientos/tipos.js';
import { plural } from '../../ui/texto.js';
import { icono } from '../../iconos/render.js';

function fila(item) {
  const cuando = formatearFecha(fechaLocalDe(item.created_at));
  return filaEditable({
    id: item.id,
    nombre: item.comercio || 'Compra sin comercio',
    sub: item.tarjeta ? `${item.tarjeta} · ${cuando}` : cuando,
    derecha: textoMonto(item.monto),
    iconoNombre: 'card',
    deslizable: true,
  });
}

/* Lo que se hace al registrar: sacarla de la bandeja y recordar lo que
   elegiste si es nuevo o lo cambiaste — la tarjeta de Wallet y la categoría
   del comercio. Solo de egresos: es lo que llega de Apple Pay. */
function alRegistrarDe(contexto, item, { origenes, categorias }) {
  const { bandeja, userId } = contexto;
  return async (fila) => {
    await bandeja.eliminar(item.id);
    if (fila.tipo !== 'egreso') return;
    const origen = unirDestino(fila, 'cuenta_id', 'tarjeta_id');
    if (item.tarjeta && origen && origenes[item.tarjeta] !== origen) {
      await bandeja.recordarOrigen(userId, item.tarjeta, origen);
    }
    const comercio = claveDeComercio(item.comercio);
    if (comercio && fila.categoria_id && categorias.aprendidas[comercio] !== fila.categoria_id) {
      await bandeja.recordarCategoria(userId, comercio, fila.categoria_id);
    }
  };
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
  const ok = await confirmar({
    titulo: '¿Descartar esta compra?',
    mensaje: `${item.comercio || 'Compra'} · ${textoMonto(item.monto)}. No se registra nada.`,
    textoOk: 'Descartar',
  });
  if (!ok) return false;
  await contexto.bandeja.eliminar(item.id);
  aviso('Compra descartada.');
  await alCambiar();
  return true;
}

export async function abrirPorConfirmar(contexto, items, alCambiar) {
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

  hoja.querySelector('#btn-registrar-todas')?.addEventListener('click', async () => {
    try {
      if (!await registrarTodas(contexto, completas)) return;
      cerrar();
    } catch (e) { avisoError(e); cerrar(); }
    await alCambiar();
  });

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

/* "Por confirmar": lo que llegó solo por el atajo — compras con Apple Pay y
   avisos del banco por SMS. Lo que es una sola operación llega junto
   (avisos/juntar.js). Tocar uno abre el formulario de movimiento ya lleno;
   deslizarlo lo descarta. Al registrarlo sale de la bandeja y se aprende lo
   que elegiste (bandeja-aprender.js). */

import { abrirSheet } from '../../ui/sheet.js';
import { envolverLista } from '../../ui/lista.js';
import { conectarDeslizar, cerrarDeslizada } from '../../ui/deslizar.js';
import { confirmar } from '../../ui/confirmar.js';
import { textoMonto } from '../../ui/privacidad.js';
import { aviso, avisoError } from '../../ui/toast.js';
import { claveDeComercio, listasParaRegistrar, conAviso } from '../../calc/bandeja.js';
import { juntarPendientes, borradorDeEntrada } from '../../calc/avisos/juntar.js';
import { filaDeEntrada, bloqueJuntados, leerSeparados, separar } from './bandeja-filas.js';
import { abrirRegistro } from '../../movimientos/registrar.js';
import { alRegistrarDe } from './bandeja-aprender.js';
import { puedeSerPago, elegirYAbrir } from './bandeja-negocio.js';
import { TIPOS } from '../../movimientos/tipos.js';
import { plural } from '../../ui/texto.js';
import { icono } from '../../iconos/render.js';

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
      ${plural(faltan, 'se queda', 'se quedan')} para revisar una por una.</p>` : ''}`;
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
      for (const parte of item.partes ?? [item]) await bandeja.eliminar(parte.id);
      hechas += 1;
    }
  } finally {
    if (hechas) aviso(`${plural(hechas, 'compra registrada', 'compras registradas')}.`);
  }
  return true;
}

async function descartar(contexto, item, borrador, alCambiar) {
  const partes = item.partes ?? [item];
  const que = partes.length > 1 ? 'estos 2 avisos' : item.aviso ? 'este aviso' : 'esta compra';
  const ok = await confirmar({
    titulo: `¿Descartar ${que}?`,
    mensaje: `${borrador.descripcion}${item.monto ? ` · ${textoMonto(item.monto)}` : ''}. No se registra nada.`,
    textoOk: 'Descartar',
  });
  if (!ok) return false;
  for (const parte of partes) await contexto.bandeja.eliminar(parte.id);
  aviso('Descartado.');
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

/* Separar recuerda el par y vuelve a abrir la lista ya sin juntarlo. */
function conectarSeparar(hoja, cerrar, reabrir) {
  hoja.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-separar]');
    if (!boton) return;
    separar(boton.dataset.separar);
    cerrar();
    reabrir().catch(avisoError);
  });
}

async function alTocar(contexto, objetivo, { entradas, borradores, sugerencias }, cerrar, alCambiar) {
  const id = objetivo.dataset.editar || objetivo.dataset.borrar;
  const entrada = entradas.find((e) => e.id === id);
  const borrador = borradores.get(id);
  if (objetivo.dataset.borrar) {
    cerrarDeslizada();
    if (await descartar(contexto, entrada, borrador, alCambiar)) cerrar();
    return;
  }
  cerrar();
  const alRegistrar = alRegistrarDe(contexto, entrada, sugerencias);
  if (puedeSerPago(contexto, borrador)) {
    elegirYAbrir(contexto, entrada, borrador, alCambiar, alRegistrar);
    return;
  }
  await abrirRegistro(contexto, borrador, alCambiar, undefined, { alRegistrar });
}

export async function abrirPorConfirmar(contexto, recibidos, alCambiar) {
  const items = recibidos.map((item) => conAviso(item));
  const [sugerencias, vigentes] = await Promise.all([
    cargarSugerencias(contexto.bandeja, items), cargarVigentes(contexto),
  ]);
  const { origenes, categorias } = sugerencias;
  const entradas = juntarPendientes(items, origenes, leerSeparados());
  const borradores = new Map(entradas.map((e) => [e.id, borradorDeEntrada(e, origenes, categorias)]));
  const completas = listasParaRegistrar(entradas, sugerencias, vigentes, borradorDeEntrada);
  const { hoja, cerrar } = abrirSheet({
    titulo: `Por confirmar · ${entradas.length}`,
    cuerpo: `
      ${botonTodas(completas)}
      <p class="tenue" style="font-size:13px;margin-bottom:10px">
        Toca una para registrarla. Desliza a la izquierda para descartarla.</p>
      ${envolverLista(entradas.map((e) => filaDeEntrada(e, borradores.get(e.id))))}
      ${bloqueJuntados(entradas.filter((e) => e.partes), borradores)}`,
  });
  conectarDeslizar(hoja);
  conectarTodas(hoja, cerrar, () => registrarTodas(contexto, completas), alCambiar);
  conectarSeparar(hoja, cerrar, () => abrirPorConfirmar(contexto, recibidos, alCambiar));
  const estado = { entradas, borradores, sugerencias };
  hoja.addEventListener('click', async (evento) => {
    const objetivo = evento.target.closest('[data-editar], [data-borrar]');
    if (!objetivo) return;
    try { await alTocar(contexto, objetivo, estado, cerrar, alCambiar); } catch (e) { avisoError(e); }
  });
}

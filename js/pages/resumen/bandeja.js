/* "Por confirmar": lo que llegó solo por el atajo — compras con Apple Pay y
   avisos del banco por SMS. Lo que es una sola operación llega junto
   (avisos/juntar.js). Tocar uno abre el formulario de movimiento ya lleno;
   deslizarlo lo descarta. Al registrarlo sale de la bandeja y se aprende lo
   que elegiste (bandeja-aprender.js). Si es un gasto fijo del plan llega con
   su nombre y su categoría (calc/fijos-bandeja.js). */

import { abrirSheet } from '../../ui/sheet.js';
import { envolverLista } from '../../ui/lista.js';
import { conectarDeslizar, cerrarDeslizada } from '../../ui/deslizar.js';
import { confirmar } from '../../ui/confirmar.js';
import { textoMonto } from '../../ui/privacidad.js';
import { aviso, avisoError } from '../../ui/toast.js';
import { claveDeComercio, listasParaRegistrar, conAviso } from '../../calc/bandeja.js';
import { filaDeEntrada, bloqueJuntados, separar } from './bandeja-filas.js';
import { prepararEntradas } from './bandeja-datos.js';
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

/* Un gasto fijo del plan no puede ser un pago de recibo: no se pregunta. */
async function registrarEntrada(contexto, id, { entradas, borradores, pares, sugerencias },
                                alCambiar) {
  const entrada = entradas.find((e) => e.id === id);
  const borrador = borradores.get(id);
  const alRegistrar = alRegistrarDe(contexto, entrada, sugerencias);
  if (!pares.has(id) && puedeSerPago(contexto, borrador)) {
    elegirYAbrir(contexto, entrada, borrador, alCambiar, alRegistrar);
    return;
  }
  await abrirRegistro(contexto, borrador, alCambiar, undefined, { alRegistrar });
}

async function alTocar(contexto, objetivo, estado, cerrar, alCambiar) {
  const id = objetivo.dataset.editar || objetivo.dataset.borrar;
  if (objetivo.dataset.borrar) {
    cerrarDeslizada();
    const entrada = estado.entradas.find((e) => e.id === id);
    if (await descartar(contexto, entrada, estado.borradores.get(id), alCambiar)) cerrar();
    return;
  }
  cerrar();
  await registrarEntrada(contexto, id, estado, alCambiar);
}

/* Todo lo que hace falta para pintar la bandeja o registrar una entrada. */
async function prepararBandeja(contexto, recibidos, plan) {
  const items = recibidos.map((item) => conAviso(item));
  const [sugerencias, vigentes] = await Promise.all([
    cargarSugerencias(contexto.bandeja, items), cargarVigentes(contexto),
  ]);
  const listas = prepararEntradas(recibidos, sugerencias.origenes, sugerencias.categorias, plan);
  return { ...listas, sugerencias, vigentes };
}

/** Tocar en Próximos vencimientos un fijo cuyo cargo ya llegó: se registra
    esa entrada, para que salga de la bandeja y no quede dos veces. */
export async function registrarDeBandeja(contexto, recibidos, id, alCambiar, plan) {
  const estado = await prepararBandeja(contexto, recibidos, plan);
  if (!estado.borradores.has(id)) return;
  await registrarEntrada(contexto, id, estado, alCambiar);
}

/** @param plan { planItems, registrados }: para reconocer los gastos fijos. */
export async function abrirPorConfirmar(contexto, recibidos, alCambiar, plan) {
  const estado = await prepararBandeja(contexto, recibidos, plan);
  const { entradas, borradores, pares, sugerencias, vigentes } = estado;
  const completas = listasParaRegistrar(entradas, sugerencias, vigentes,
                                        (e) => borradores.get(e.id), pares);
  const { hoja, cerrar } = abrirSheet({
    titulo: `Por confirmar · ${entradas.length}`,
    cuerpo: `
      ${botonTodas(completas)}
      <p class="tenue" style="font-size:13px;margin-bottom:10px">
        Toca una para registrarla. Desliza a la izquierda para descartarla.</p>
      ${envolverLista(entradas.map((e) => filaDeEntrada(e, borradores.get(e.id), pares.get(e.id))))}
      ${bloqueJuntados(entradas.filter((e) => e.partes), borradores)}`,
  });
  conectarDeslizar(hoja);
  conectarTodas(hoja, cerrar, () => registrarTodas(contexto, completas), alCambiar);
  conectarSeparar(hoja, cerrar, () => abrirPorConfirmar(contexto, recibidos, alCambiar, plan));
  hoja.addEventListener('click', async (evento) => {
    const objetivo = evento.target.closest('[data-editar], [data-borrar]');
    if (!objetivo) return;
    try { await alTocar(contexto, objetivo, estado, cerrar, alCambiar); } catch (e) { avisoError(e); }
  });
}

/* Ajustes → Apple Pay y avisos: la clave del atajo, los pasos para armar el
   de Apple Pay y las automatizaciones de SMS, y las tarjetas de Wallet que
   ya se aprendieron.

   La clave se enseña UNA vez, al generarla: la base guarda solo su hash.
   Cambiarla deja inservible la anterior, así que si se filtra, se cambia. */

import { datosParaAtajo } from '../../api/client.js';
import { filaEditable, envolverLista } from '../../ui/lista.js';
import { conectarDeslizar, cerrarDeslizada } from '../../ui/deslizar.js';
import { confirmar } from '../../ui/confirmar.js';
import { separarDestino } from '../../ui/campos.js';
import { escapar } from '../../ui/texto.js';
import { aviso, avisoError } from '../../ui/toast.js';
import { icono } from '../../iconos/render.js';
import { fechaLocalDe } from '../../calc/bandeja.js';
import { formatearFecha } from '../../calc/fechas.js';
import { pasosDelAtajo, pasosDeAvisos } from './atajo-pasos.js';
import { pasosDeCorreo } from './atajo-correo.js';
import { esClaveDeAviso, etiquetaDeClave } from '../../calc/avisos/cuentas.js';

function bloqueClave({ fechaClave, claveNueva }) {
  if (claveNueva) {
    return `
      <div class="card pila-sm">
        <p class="cifra-etiqueta">Tu clave</p>
        <code style="word-break:break-all">${escapar(claveNueva)}</code>
        <p class="warn" style="font-size:12.5px">Cópiala ahora: no se vuelve a enseñar.</p>
        <button class="btn btn-primario" type="button" data-copiar="${escapar(claveNueva)}">
          ${icono('copiar', 16)} Copiar clave</button>
      </div>`;
  }
  if (!fechaClave) {
    return `<button class="btn btn-primario btn-bloque" id="btn-generar" type="button">
      Generar clave</button>`;
  }
  return `
    <div class="card pila-sm">
      <p class="tenue" style="font-size:13px">Tienes una clave desde el
        ${formatearFecha(fechaLocalDe(fechaClave))}.</p>
      <div class="fila" style="gap:8px">
        <button class="btn crece" id="btn-generar" type="button">Cambiar clave</button>
        <button class="btn btn-peligro crece" id="btn-quitar" type="button">Quitar</button>
      </div>
    </div>`;
}

/* El id de la fila es su posición en estado.origenes: el nombre viene de
   Wallet o de un aviso y no se mete crudo en un atributo. */
function bloqueAprendidas(estado, titulo, deAviso) {
  const filas = Object.keys(estado.origenes)
    .map((nombre, i) => ({ nombre, i }))
    .filter(({ nombre }) => esClaveDeAviso(nombre) === deAviso)
    .map(({ nombre, i }) => filaEditable({
      id: i, nombre: estado.etiquetaDe(nombre), sub: estado.destinoDe(nombre),
      iconoNombre: deAviso ? 'banco' : 'card', deslizable: true,
    }));
  if (!filas.length) return '';
  return `
    <div>
      <p class="seccion-titulo">${titulo}</p>
      ${envolverLista(filas)}
    </div>`;
}

function pintar(contenedor, estado) {
  const datos = datosParaAtajo();
  contenedor.innerHTML = `
    <div class="pila">
      <p class="tenue" style="font-size:13px">Cada pago con Apple Pay y cada aviso del
        banco por SMS o correo llegan solos a <strong>Por confirmar</strong>, en el
        Resumen. Ahí los revisas y los registras.</p>
      ${bloqueClave(estado)}
      ${pasosDelAtajo(datos)}
      ${pasosDeAvisos(datos)}
      ${pasosDeCorreo(datos, estado.claveNueva)}
      ${bloqueAprendidas(estado, 'Tarjetas de Wallet aprendidas', false)}
      ${bloqueAprendidas(estado, 'Aprendido de los avisos', true)}
    </div>`;
  conectarDeslizar(contenedor);          // hay que rehacerlo en cada repintado
}

async function copiar(texto) {
  await navigator.clipboard.writeText(texto);
  aviso('Copiado.');
}

async function generar({ bandeja }, estado) {
  if (estado.fechaClave && !await confirmar({
    titulo: '¿Cambiar la clave?',
    mensaje: 'La de ahora deja de servir: tendrás que pegar la nueva en el atajo.',
    textoOk: 'Cambiar',
  })) return;
  estado.claveNueva = await bandeja.nuevaClave();
  estado.fechaClave = await bandeja.fechaDeClave();
}

async function quitar({ bandeja, userId }, estado) {
  if (!await confirmar({
    titulo: '¿Quitar la clave?',
    mensaje: 'El atajo deja de funcionar hasta que generes otra.',
    textoOk: 'Quitar',
  })) return;
  await bandeja.quitarClave(userId);
  Object.assign(estado, { fechaClave: null, claveNueva: null });
}

async function olvidar({ bandeja }, estado, indice) {
  cerrarDeslizada();
  const nombre = Object.keys(estado.origenes)[indice];
  if (!await confirmar({
    titulo: `¿Olvidar "${estado.etiquetaDe(nombre)}"?`,
    mensaje: 'La próxima vez que llegue te va a preguntar de nuevo.',
    textoOk: 'Olvidar',
  })) return;
  await bandeja.olvidarOrigen(nombre);
  delete estado.origenes[nombre];
}

/* Un solo listener para el contenedor, que sobrevive a los repintados. */
function conectar(contenedor, contexto, estado) {
  contenedor.addEventListener('click', async (evento) => {
    const o = evento.target.closest('[data-copiar], #btn-generar, #btn-quitar, [data-borrar]');
    if (!o) return;
    try {
      if (o.dataset.copiar) return await copiar(o.dataset.copiar);
      if (o.id === 'btn-generar') await generar(contexto, estado);
      else if (o.id === 'btn-quitar') await quitar(contexto, estado);
      else await olvidar(contexto, estado, Number(o.dataset.borrar));
      pintar(contenedor, estado);
    } catch (e) { avisoError(e); }
  });
}

export async function montarAtajo(contenedor, contexto) {
  const { bandeja, tarjetas, cuentas } = contexto;
  contenedor.innerHTML = '<p class="tenue">Cargando…</p>';
  const [fechaClave, origenes, tjs, cts] = await Promise.all([
    bandeja.fechaDeClave(), bandeja.origenes(), tarjetas.listarActivas(), cuentas.listarActivas(),
  ]);
  const porId = new Map([...tjs, ...cts].map((x) => [x.id, x.nombre]));
  const estado = {
    fechaClave, claveNueva: null, origenes,
  };
  estado.etiquetaDe = (nombre) => (esClaveDeAviso(nombre) ? etiquetaDeClave(nombre) : nombre);
  estado.destinoDe = (nombre) => {
    const valor = estado.origenes[nombre];
    if (valor === 'propia') return 'Eres tú: va como transferencia';
    return `→ ${porId.get(separarDestino(valor).id) ?? 'ya no existe'}`;
  };
  pintar(contenedor, estado);
  conectar(contenedor, contexto, estado);
}

/* Sheet "Leer estado de cuenta" (asistente de tarjetas, premium). Subes el
   PDF, una foto o el texto; la IA lo lee en la Edge Function y aquí se ve lo
   leído con su veredicto: ¿da el saldo al corte del banco?

   Paso 1: solo lee y comprueba, no toca tus datos. El paso 2 (comparar con tus
   movimientos y proponer arreglos) está en docs/asistente-tarjetas.md. */

import { abrirSheet } from '../../ui/sheet.js';
import { escapar } from '../../ui/texto.js';
import { revisarLectura } from '../../calc/estado-cuenta.js';
import { pintarLectura } from './estado-cuenta-vista.js';

const ACEPTA = 'application/pdf,image/png,image/jpeg,image/webp,text/plain';
const MAX_BYTES = 7 * 1024 * 1024;
const MAX_ARCHIVOS = 6;

const CUERPO = `
  <p class="tenue" style="font-size:13px;margin:0 0 12px">
    Sube el estado de cuenta en PDF, una foto o el texto copiado (hasta ${MAX_ARCHIVOS} a la
    vez; cada uno cuenta como una lectura). La IA lo lee y la app comprueba que lo leído
    dé el saldo al corte del banco.</p>
  <label class="btn btn-primario btn-bloque" style="position:relative">
    Elegir archivos
    <input type="file" accept="${ACEPTA}" multiple data-estado-archivo
           style="position:absolute;inset:0;opacity:0;cursor:pointer">
  </label>
  <div data-estado-resultado class="pila" style="margin-top:16px"></div>`;

/** El archivo en base64, sin el prefijo "data:…;base64,". */
function aBase64(archivo) {
  return new Promise((resolver, fallar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result).split(',')[1] ?? '');
    lector.onerror = () => fallar(new Error('No se pudo abrir el archivo.'));
    lector.readAsDataURL(archivo);
  });
}

const mensaje = (texto, clase = 'tenue') =>
  `<p class="${clase}" style="font-size:13px">${escapar(texto)}</p>`;

/** Lee UN archivo y lo pinta en su propio bloque. */
async function leer({ asistente }, archivo, bloque) {
  if (archivo.size > MAX_BYTES) {
    bloque.innerHTML = mensaje('El archivo es muy grande (máximo 7 MB).', 'warn');
    return;
  }
  bloque.innerHTML = mensaje('Leyendo… puede tardar unos segundos.');
  try {
    const tipo = archivo.type || 'text/plain';
    const { lectura, quedan } = await asistente.leerEstado(await aBase64(archivo), tipo);
    bloque.innerHTML = pintarLectura(lectura, revisarLectura(lectura), quedan);
  } catch (e) {
    bloque.innerHTML = mensaje(e.message || 'No se pudo leer el estado de cuenta.', 'warn');
  }
}

/* Uno tras otro, no en paralelo: cada lectura descuenta cupo y así, si se
   acaba, los que faltan lo dicen en vez de fallar todos a la vez. */
async function leerVarios(contexto, archivos, resultado) {
  const bloques = archivos.map((archivo) => {
    const seccion = document.createElement('section');
    seccion.className = 'pila';
    seccion.innerHTML = `<p style="font-weight:550;margin:8px 0 0">${escapar(archivo.name)}</p><div></div>`;
    resultado.append(seccion);
    return seccion.lastElementChild;
  });
  for (let i = 0; i < archivos.length; i += 1) await leer(contexto, archivos[i], bloques[i]);
}

export function abrirLecturaEstado(contexto, tarjeta) {
  const { hoja } = abrirSheet({ titulo: `Estado de cuenta · ${escapar(tarjeta.nombre)}`, cuerpo: CUERPO });
  const entrada = hoja.querySelector('[data-estado-archivo]');
  const resultado = hoja.querySelector('[data-estado-resultado]');
  entrada.addEventListener('change', async () => {
    const archivos = [...entrada.files];
    if (!archivos.length) return;
    resultado.innerHTML = archivos.length > MAX_ARCHIVOS
      ? mensaje(`Son ${archivos.length} archivos: se leen los primeros ${MAX_ARCHIVOS}.`, 'warn') : '';
    entrada.disabled = true;
    await leerVarios(contexto, archivos.slice(0, MAX_ARCHIVOS), resultado);
    entrada.disabled = false;
    entrada.value = '';
  });
}

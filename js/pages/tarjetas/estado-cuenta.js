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

const CUERPO = `
  <p class="tenue" style="font-size:13px;margin:0 0 12px">
    Sube el estado de cuenta en PDF, una foto o el texto copiado. La IA lo lee y la app
    comprueba que lo leído dé el saldo al corte del banco.</p>
  <label class="btn btn-primario btn-bloque" style="position:relative">
    Elegir archivo
    <input type="file" accept="${ACEPTA}" data-estado-archivo
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

async function leer({ asistente }, archivo, resultado) {
  if (archivo.size > MAX_BYTES) {
    resultado.innerHTML = mensaje('El archivo es muy grande (máximo 7 MB).', 'warn');
    return;
  }
  resultado.innerHTML = mensaje('Leyendo el estado de cuenta… puede tardar unos segundos.');
  try {
    const tipo = archivo.type || 'text/plain';
    const { lectura, quedan } = await asistente.leerEstado(await aBase64(archivo), tipo);
    resultado.innerHTML = pintarLectura(lectura, revisarLectura(lectura), quedan);
  } catch (e) {
    resultado.innerHTML = mensaje(e.message || 'No se pudo leer el estado de cuenta.', 'warn');
  }
}

export function abrirLecturaEstado(contexto, tarjeta) {
  const { hoja } = abrirSheet({ titulo: `Estado de cuenta · ${escapar(tarjeta.nombre)}`, cuerpo: CUERPO });
  const entrada = hoja.querySelector('[data-estado-archivo]');
  const resultado = hoja.querySelector('[data-estado-resultado]');
  entrada.addEventListener('change', async () => {
    const [archivo] = entrada.files;
    if (!archivo) return;
    entrada.disabled = true;
    await leer(contexto, archivo, resultado);
    entrada.disabled = false;
    entrada.value = '';
  });
}

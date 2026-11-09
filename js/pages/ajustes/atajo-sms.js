/* Los SMS del banco: una automatización por palabra. "USD" la traen
   Cuscatlán, Niu y BAC; Promerica escribe "$", pero sus avisos dicen
   "Transfer365". Si un SMS trae las dos, la base lo guarda una sola vez. */

import { pasosDeUrl, claveParaPegar, siPreguntaAlgo } from './atajo-pasos.js';

function crearAutomatizacion() {
  return `
    <h4>1. Crear la automatización</h4>
    <ol>
      <li>En <strong>Atajos</strong> → <strong>Automatización</strong> → toca
        <strong>+</strong> y elige <strong>Mensaje</strong>.</li>
      <li>En <strong>El mensaje contiene</strong> escribe <strong>USD</strong>. No
        elijas remitente: los bancos no tienen número.</li>
      <li>Marca <strong>Ejecutar inmediatamente</strong>, toca
        <strong>Siguiente</strong> y elige <strong>Nuevo atajo en blanco</strong>.</li>
    </ol>`;
}

export function pasosDeAvisos({ urlAvisos, apikey }) {
  return `
    <p class="tenue">Cuando el banco te manda un SMS de una compra, el iPhone pasa
      el texto a tu app y ella saca el monto y el comercio. Usa la misma clave de
      arriba.</p>
    <p class="nota">Se arman dos automatizaciones iguales que solo cambian en la
      palabra: <strong>USD</strong> y <strong>Transfer365</strong>.</p>

    ${crearAutomatizacion()}

    <h4>2. Mandar el texto a tu app</h4>
    <ol>
      ${pasosDeUrl(urlAvisos, apikey)}
    </ol>
    <ul>
      ${claveParaPegar()}
      <li>Clave <strong>texto</strong> → en el valor, toca la barra de variables
        sobre el teclado y elige <strong>Entrada del atajo</strong>. Luego toca esa
        burbuja azul y cámbiala a <strong>Contenido</strong>.</li>
    </ul>
    <p>Toca <strong>OK</strong>. Después repite todo con la palabra
      <strong>Transfer365</strong>, para los avisos de Promerica.</p>

    <h4>3. Probarlo</h4>
    <p>Mándate un mensaje que diga <strong>prueba USD 1.00</strong>: aparece en
      <strong>Por confirmar</strong> y ahí lo descartas.</p>
    ${siPreguntaAlgo()}`;
}

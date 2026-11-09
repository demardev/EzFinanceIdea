/* Los pasos para armar el atajo de Apple Pay en el iPhone. Solo pinta: la
   URL y la llave las da api/client.js, que es quien sabe de Supabase.
   Las piezas que comparte con el de SMS (la acción "Obtener contenido de
   URL" y qué hacer si el atajo pregunta algo) viven aquí. */

import { escapar } from '../../ui/texto.js';
import { icono } from '../../iconos/render.js';

/** Un valor largo para copiar tal cual, con su botón. */
export function copiable(valor) {
  return `
    <div class="fila" style="gap:8px;margin-top:6px">
      <code class="crece" style="word-break:break-all;font-size:12px">${escapar(valor)}</code>
      <button class="btn" type="button" data-copiar="${escapar(valor)}">
        ${icono('copiar', 16)} Copiar</button>
    </div>`;
}

export function campoJson(nombre, valor) {
  return `<li>Clave <strong>${nombre}</strong> → ${valor}</li>`;
}

/** La acción "Obtener contenido de URL": URL fija, POST y el encabezado. */
export function pasosDeUrl(url, apikey) {
  return `
    <li>Toca <strong>Agregar acción</strong>, busca <strong>Obtener contenido de
      URL</strong> y tócala.</li>
    <li>Copia esta URL y pégala sobre la palabra azul <strong>URL</strong> de la
      acción:${copiable(url)}
      Tiene que quedar el texto pegado. No elijas ninguna variable ni
      «Preguntar cada vez».</li>
    <li>Toca la flecha <strong>›</strong> de la acción para ver más opciones.
      En <strong>Método</strong> elige <strong>POST</strong>.</li>
    <li>En <strong>Encabezados</strong> toca <strong>Agregar nuevo encabezado</strong>.
      En <em>Clave</em> escribe <strong>apikey</strong> y en <em>Texto</em> pega:
      ${copiable(apikey)}</li>
    <li>En <strong>Cuerpo de la solicitud</strong> elige <strong>JSON</strong>. Cada
      campo se agrega con <strong>Agregar nuevo campo → Texto</strong>:</li>`;
}

/** Lo que le pasó a alguien: el atajo pedía la URL cada vez que pagaba. */
export function siPreguntaAlgo() {
  return `
    <h4>Si al pagar te pide la URL o cualquier otra cosa</h4>
    <p>El atajo nunca debe preguntarte nada: está mal armado. Ábrelo y:</p>
    <ul>
      <li>Borra cualquier acción <strong>Solicitar entrada</strong> o
        <strong>Preguntar</strong>. Esta guía no usa ninguna; suelen venir de atajos
        descargados o armados con otra app.</li>
      <li>En <strong>Obtener contenido de URL</strong> borra lo que haya en la URL
        y pega otra vez la de arriba, como texto.</li>
      <li>Si sigue igual, borra la automatización y ármala de nuevo con estos pasos.</li>
    </ul>`;
}

export function claveParaPegar() {
  return `<li>Clave <strong>clave</strong> → pega <strong>tu clave</strong>, la de
    arriba. Si no la guardaste, toca <strong>Cambiar clave</strong> y pega la nueva
    en todos tus atajos.</li>`;
}

function crearAutomatizacion() {
  return `
    <h4>1. Crear la automatización</h4>
    <ol>
      <li>Abre la app <strong>Atajos</strong> y ve a la pestaña
        <strong>Automatización</strong>.</li>
      <li>Toca <strong>+</strong> (o <strong>Nueva automatización</strong>) y elige
        <strong>Transacción</strong>.</li>
      <li>En <strong>Tarjeta</strong>, marca las tarjetas con las que pagas. Deja
        todas las categorías y comercios.</li>
      <li>Marca <strong>Ejecutar inmediatamente</strong> y apaga
        <strong>Notificar al ejecutarse</strong>. Toca <strong>Siguiente</strong>.</li>
      <li>Elige <strong>Nuevo atajo en blanco</strong>.</li>
    </ol>`;
}

export function pasosDelAtajo({ url, apikey }) {
  return `
    <p class="tenue">Cada vez que pagas con Apple Pay, el iPhone manda el monto, el
      comercio y la tarjeta a tu app. Se arma una sola vez y toma unos 5 minutos.</p>
    <p class="nota">Antes de empezar genera tu clave (arriba) y tenla copiada.</p>

    ${crearAutomatizacion()}

    <h4>2. Mandar la compra a tu app</h4>
    <ol>
      ${pasosDeUrl(url, apikey)}
    </ol>
    <ul>
      ${claveParaPegar()}
      <li>Clave <strong>monto</strong> → en el valor, toca la barra de variables
        sobre el teclado y elige <strong>Entrada del atajo</strong>. Luego toca esa
        burbuja azul y cámbiala a <strong>Cantidad</strong> (Amount).</li>
      <li>Clave <strong>comercio</strong> → igual, <em>Entrada del atajo</em> →
        <strong>Comercio</strong> (Merchant).</li>
      <li>Clave <strong>tarjeta</strong> → igual, <em>Entrada del atajo</em> →
        <strong>Tarjeta o pase</strong> (Card or Pass).</li>
    </ul>
    <p>Toca <strong>OK</strong> arriba a la derecha y listo.</p>

    <h4>3. Probarlo</h4>
    <p>Paga algo de verdad con Apple Pay y abre el Resumen: aparece en
      <strong>Por confirmar</strong>. Con el botón ▶ no sirve, porque no hay
      compra y responde «Monto no válido».</p>
    ${siPreguntaAlgo()}`;
}

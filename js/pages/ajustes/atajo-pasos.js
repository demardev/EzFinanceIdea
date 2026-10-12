/* Los pasos para armar el atajo de Apple Pay en el iPhone. Solo pinta: la
   URL y la llave las da api/client.js, que es quien sabe de Supabase. */

import { escapar } from '../../ui/texto.js';
import { icono } from '../../iconos/render.js';

/** Un valor largo para copiar tal cual, con su botón. */
function copiable(valor) {
  return `
    <div class="pila-sm" style="margin-top:6px">
      <div class="fila" style="gap:8px">
        <code class="crece" style="word-break:break-all;font-size:12px">${escapar(valor)}</code>
        <button class="btn" type="button" data-copiar="${escapar(valor)}">
          ${icono('copiar', 16)} Copiar</button>
      </div>
    </div>`;
}

function campoJson(nombre, valor) {
  return `<li><strong>${nombre}</strong> (Texto) → ${valor}</li>`;
}

export function pasosDelAtajo({ url, apikey }) {
  return `
    <div class="card pila-sm" style="font-size:13.5px">
      <p class="seccion-titulo" style="margin:0">Cómo armar el atajo</p>
      <ol class="pila-sm" style="padding-left:20px;margin:0;list-style:decimal">
        <li>En la app <strong>Atajos</strong>: Automatización → <strong>+</strong> →
          <strong>Transacción</strong>.</li>
        <li>Elige las tarjetas con las que pagas y marca <strong>Ejecutar inmediatamente</strong>.</li>
        <li>Crea un atajo nuevo con la acción <strong>Obtener contenido de URL</strong>.</li>
        <li>Pega la URL:${copiable(url)}</li>
        <li>Toca la flecha de la acción: Método <strong>POST</strong>, y en Encabezados
          agrega <strong>apikey</strong> con este valor:${copiable(apikey)}</li>
        <li>Cuerpo de solicitud: <strong>JSON</strong>, con cuatro campos:
          <ul style="padding-left:16px;margin:6px 0 0">
            ${campoJson('clave', 'tu clave, la de arriba')}
            ${campoJson('monto', 'la variable <em>Importe</em> (Amount)')}
            ${campoJson('comercio', 'la variable <em>Comercio</em> (Merchant)')}
            ${campoJson('tarjeta', 'la variable <em>Tarjeta o pase</em> (Card or Pass)')}
          </ul></li>
        <li>Paga algo con Apple Pay y abre el Resumen: aparece en
          <strong>Por confirmar</strong>.</li>
      </ol>
    </div>`;
}

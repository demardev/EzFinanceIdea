/* Ajustes → los avisos que llegan por correo a Gmail. No hay atajo del
   iPhone: un script de Google Apps Script en TU cuenta revisa Gmail cada 5
   minutos y manda el texto a la misma puerta que los SMS, con tu clave.

   El script no es código de la app: es texto que el usuario pega en
   script.google.com. Aquí solo se arma con la URL, la llave y, si se acaba
   de generar, la clave. */

import { escapar } from '../../ui/texto.js';
import { icono } from '../../iconos/render.js';

const SIN_CLAVE = 'PEGA_AQUI_TU_CLAVE';

/* Lo que llega a recibir_aviso tiene que verse como lo esperan las
   plantillas de correo (js/calc/avisos/fabrica.js): asunto + cuerpo sin
   HTML, cortado antes del pie. Si cambias esto, cambian ellas. */
const SCRIPT = `/* Manda a Finanzas los avisos del banco que llegan a Gmail.
   Corre solo cada 5 minutos (Activadores). Cada correo se manda una vez. */
const URL = '@URL@';
const APIKEY = '@APIKEY@';
const CLAVE = '@CLAVE@';
const REMITENTES = ['soluciones@promericaotp.com.sv'];
const FINES = ['En caso que', 'Este correo se genera'];

function revisar() {
  const props = PropertiesService.getScriptProperties();
  const enviados = JSON.parse(props.getProperty('enviados') || '[]');
  const desde = Date.now() - 2 * 24 * 3600 * 1000;
  const busqueda = '{' + REMITENTES.map((r) => 'from:' + r).join(' ') + '} newer_than:2d';
  for (const hilo of GmailApp.search(busqueda, 0, 30)) {
    for (const correo of hilo.getMessages()) {
      const id = correo.getId();
      if (correo.getDate().getTime() < desde || enviados.includes(id)) continue;
      enviar(textoDe(correo));
      enviados.push(id);
      props.setProperty('enviados', JSON.stringify(enviados.slice(-300)));
    }
  }
}

function textoDe(correo) {
  let texto = correo.getBody()
    .replace(/<(style|script|head)[\\s\\S]*?<\\/\\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&#(\\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z])(acute|tilde|uml);/gi, '$1')
    .replace(/\\s+/g, ' ');
  for (const fin of FINES) {
    const i = texto.indexOf(fin);
    if (i > 0) texto = texto.slice(0, i);
  }
  return (correo.getSubject() + ' ' + texto).slice(0, 1000);
}

function enviar(texto) {
  const r = UrlFetchApp.fetch(URL, {
    method: 'post', contentType: 'application/json', headers: { apikey: APIKEY },
    payload: JSON.stringify({ clave: CLAVE, texto: texto, origen: 'correo' }),
    muteHttpExceptions: true,
  });
  if (r.getResponseCode() >= 300) throw new Error(r.getResponseCode() + ' ' + r.getContentText());
}
`;

export function scriptDeGmail({ urlAvisos, apikey }, clave) {
  return SCRIPT.replace('@URL@', urlAvisos).replace('@APIKEY@', apikey)
    .replace('@CLAVE@', clave || SIN_CLAVE);
}

export function pasosDeCorreo(datos, claveNueva) {
  const script = scriptDeGmail(datos, claveNueva);
  return `
    <div class="card pila-sm" style="font-size:13.5px">
      <p class="seccion-titulo" style="margin:0">Avisos del banco por correo (Gmail)</p>
      <p class="tenue" style="font-size:13px">Un script en tu cuenta de Google revisa
        Gmail cada 5 minutos. Solo lee los correos de los bancos de la lista y solo
        puede agregar a tu bandeja.</p>
      <ol class="pila-sm" style="padding-left:20px;margin:0;list-style:decimal">
        <li>Abre <strong>script.google.com</strong> con tu cuenta de Gmail →
          <strong>Nuevo proyecto</strong>.</li>
        <li>Borra lo que trae y pega este código:
          <pre style="max-height:200px;overflow:auto;font-size:11px;margin:6px 0;white-space:pre"><code>${escapar(script)}</code></pre>
          <button class="btn" type="button" data-copiar="${escapar(script)}">
            ${icono('copiar', 16)} Copiar código</button></li>
        <li>${claveNueva ? 'Ya trae tu clave nueva.'
          : `En la línea <strong>CLAVE</strong> cambia <code>${SIN_CLAVE}</code> por tu clave.`}</li>
        <li>Guarda y ejecuta <strong>revisar</strong> una vez. Google pide permiso para
          leer tu Gmail y conectarse a internet: es tu propio script, acéptalo
          (si dice «no verificada»: Configuración avanzada → Ir al proyecto).</li>
        <li>En <strong>Activadores</strong> (el reloj) → Añadir activador → función
          <strong>revisar</strong>, <strong>Según tiempo</strong>, cada 5 minutos.</li>
        <li>La primera vez manda los correos de los últimos 2 días. Para otro banco,
          agrega su correo en <strong>REMITENTES</strong>.</li>
      </ol>
    </div>`;
}

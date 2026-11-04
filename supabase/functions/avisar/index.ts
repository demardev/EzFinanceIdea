/* Edge Function `avisar`: manda notificaciones push.

   Paso 1 solo trae { accion: 'prueba' }: le manda una notificación de prueba
   a los dispositivos de quien la llama. Lee las suscripciones CON EL TOKEN
   DEL USUARIO, así que las políticas de la base limitan todo a lo suyo: esta
   función no puede ver las de nadie más.

   Secretos (supabase secrets set): VAPID_PUBLICA, VAPID_PRIVADA, VAPID_SUJETO.
   SUPABASE_URL y SUPABASE_ANON_KEY los pone Supabase solo. */

import { enviarPush } from '../_shared/webpush.js';

const URL_BASE = Deno.env.get('SUPABASE_URL');
const ANON = Deno.env.get('SUPABASE_ANON_KEY');
const VAPID = {
  publica: Deno.env.get('VAPID_PUBLICA'),
  privada: Deno.env.get('VAPID_PRIVADA'),
  sujeto: Deno.env.get('VAPID_SUJETO'),
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function responder(estado, cuerpo) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/** PostgREST con el token del usuario: lo que no es suyo, no existe. */
function datos(token, ruta, opciones = {}) {
  return fetch(`${URL_BASE}/rest/v1/${ruta}`, {
    ...opciones,
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, ...opciones.headers },
  });
}

/** Manda a cada dispositivo y borra los que el servicio dice que ya no existen. */
async function mandarATodos(token, suscripciones, mensaje) {
  let entregadas = 0;
  for (const s of suscripciones) {
    const estado = await enviarPush(s, mensaje, VAPID);
    if (estado >= 200 && estado < 300) entregadas++;
    if (estado === 404 || estado === 410) {
      await datos(token, `suscripciones_push?id=eq.${s.id}`, { method: 'DELETE' });
    }
  }
  return entregadas;
}

async function prueba(token) {
  const respuesta = await datos(token, 'suscripciones_push?select=id,endpoint,p256dh,auth');
  if (respuesta.status === 401) return responder(401, { error: 'Tu sesión expiró.' });
  const suscripciones = await respuesta.json();
  if (!suscripciones.length) {
    return responder(404, { error: 'No hay dispositivos con los avisos activados.' });
  }
  const entregadas = await mandarATodos(token, suscripciones, {
    titulo: 'Finanzas', cuerpo: 'Así se verán tus avisos.', url: './#/ajustes/notificaciones',
    etiqueta: 'prueba',
  });
  return responder(200, { entregadas, dispositivos: suscripciones.length });
}

Deno.serve(async (peticion) => {
  if (peticion.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (!VAPID.publica || !VAPID.privada) {
    return responder(500, { error: 'Faltan las llaves VAPID en los secretos de Supabase.' });
  }
  const token = (peticion.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return responder(401, { error: 'Falta la sesión.' });

  const { accion } = await peticion.json().catch(() => ({}));
  if (accion === 'prueba') return prueba(token);
  return responder(400, { error: 'Acción desconocida.' });
});

/* Edge Function `avisar`: manda las notificaciones push.

   - { accion: 'prueba' }   la pide desde Ajustes un admin o un usuario con negocio.
                            Lee con SU token: las políticas lo limitan a lo suyo.
   - { accion: 'resumen' }  el cierre del día; lo llama el cron de las 8 pm.
   - { accion: 'bandeja', user_id, origen }  lo llama el disparador al entrar
                            algo a Por confirmar.
   Las dos internas exigen la cabecera x-avisos-secreto (ver servidor.js).

   Secretos (supabase secrets set): VAPID_PUBLICA, VAPID_PRIVADA, VAPID_SUJETO.
   SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY los pone Supabase. */

import { enviarPush } from '../_shared/webpush.js';
import { mensajeBandeja } from '../../../js/calc/resumen-diario.js';
import { suscripciones, borrarSuscripcion, secretoValido } from './servidor.js';
import { resumenDe, hoyEnMexico } from './resumen.js';

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

/** Manda a cada dispositivo y borra los que el servicio dice que ya no existen. */
async function mandarATodos(lista, mensaje, borrar) {
  let entregadas = 0;
  for (const s of lista) {
    const estado = await enviarPush(s, mensaje, VAPID);
    if (estado >= 200 && estado < 300) entregadas++;
    if (estado === 404 || estado === 410) await borrar(s.id);
  }
  return entregadas;
}

async function prueba(token) {
  const conToken = (ruta, metodo = 'GET') => fetch(`${URL_BASE}/rest/v1/${ruta}`, {
    method: metodo, headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
  /* Solo admin o negocio. Su perfil se lee con su token: no lo puede falsear. */
  const perfil = await conToken('perfiles?select=admin,negocio&limit=1');
  if (perfil.status === 401) return responder(401, { error: 'Tu sesión expiró.' });
  const [banderas] = perfil.ok ? await perfil.json() : [];
  if (!banderas?.admin && !banderas?.negocio) return responder(403, { error: 'No disponible.' });

  const respuesta = await conToken('suscripciones_push?select=id,endpoint,p256dh,auth');
  const lista = await respuesta.json();
  if (!lista.length) return responder(404, { error: 'No hay dispositivos con los avisos activados.' });
  const entregadas = await mandarATodos(lista, {
    titulo: 'Finanzas', cuerpo: 'Así se verán tus avisos.', url: './#/ajustes/notificaciones',
    etiqueta: 'prueba',
  }, (id) => conToken(`suscripciones_push?id=eq.${id}`, 'DELETE'));
  return responder(200, { entregadas, dispositivos: lista.length });
}

/** Un usuario que falla no deja sin aviso a los demás. */
async function resumenes() {
  const hoy = hoyEnMexico();
  const porUsuario = new Map();
  for (const s of await suscripciones()) {
    porUsuario.set(s.user_id, [...(porUsuario.get(s.user_id) ?? []), s]);
  }
  const cuenta = { usuarios: porUsuario.size, entregadas: 0, errores: 0 };
  for (const [userId, lista] of porUsuario) {
    try {
      cuenta.entregadas += await mandarATodos(lista, await resumenDe(userId, hoy), borrarSuscripcion);
    } catch (e) {
      cuenta.errores++;
      console.error(`[resumen] ${userId}: ${e.message}`);
    }
  }
  return cuenta;
}

async function bandeja({ user_id: userId, origen }) {
  if (!userId) return { entregadas: 0 };
  const entregadas = await mandarATodos(await suscripciones(userId), mensajeBandeja(origen),
    borrarSuscripcion);
  return { entregadas };
}

Deno.serve(async (peticion) => {
  if (peticion.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (!VAPID.publica || !VAPID.privada) {
    return responder(500, { error: 'Faltan las llaves VAPID en los secretos de Supabase.' });
  }
  const cuerpo = await peticion.json().catch(() => ({}));

  if (cuerpo.accion === 'resumen' || cuerpo.accion === 'bandeja') {
    if (!(await secretoValido(peticion.headers.get('x-avisos-secreto')))) {
      return responder(401, { error: 'No autorizado.' });
    }
    return responder(200, cuerpo.accion === 'resumen' ? await resumenes() : await bandeja(cuerpo));
  }

  const token = (peticion.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return responder(401, { error: 'Falta la sesión.' });
  if (cuerpo.accion === 'prueba') return prueba(token);
  return responder(400, { error: 'Acción desconocida.' });
});

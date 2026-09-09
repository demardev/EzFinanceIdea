/* Credenciales del proyecto de Supabase. Las pegas tú (paso 1 del README).
   La ANON_KEY es pública por diseño: viaja en el JS que sirve Cloudflare.
   Lo que protege los datos es RLS, no el secreto de esta llave.
   NUNCA pongas aquí la service_role / secret key. */

export const SUPABASE_URL = 'https://tifmifpphzufarjtckpt.supabase.co';
export const ANON_KEY     = 'sb_publishable_JOazj0LFAnXykHa9WwQnyg_Sn--OhNI';

/* Errores de dedo que cuestan media hora si nadie los revisa. */
export function problemaConfig() {
  const url = SUPABASE_URL.trim();
  if (url.startsWith('PEGA_AQUI') || ANON_KEY.startsWith('PEGA_AQUI')) {
    return 'Falta pegar SUPABASE_URL y ANON_KEY en js/config.js.';
  }
  if (!/^https:\/\//.test(url)) {
    return 'SUPABASE_URL tiene que empezar con https:// — revisa js/config.js.';
  }
  if (url.includes('supabase.com/dashboard')) {
    return 'Esa es la URL del dashboard, no la del proyecto. Debe ser https://TU-ID.supabase.co';
  }
  if (/\/(rest|auth)\/v1/.test(url)) {
    return 'SUPABASE_URL va sin /rest/v1 ni /auth/v1 al final — solo https://TU-ID.supabase.co';
  }
  return null;
}

export function hayConfig() {
  return problemaConfig() === null;
}

/** Sin diagonal final: si no, se arman URLs con // y Supabase responde 404. */
export function urlBase() {
  return SUPABASE_URL.trim().replace(/\/+$/, '');
}

/* Edge Function `leer-estado` (asistente de tarjetas, premium).

   { archivo: <base64>, tipo: 'application/pdf' | 'image/…' | 'text/plain' }
     -> { lectura, quedan: { hoy, mes } }

   1. Valida la sesión con el token de quien llama. Nunca usa la llave de
      servicio: no lee ni escribe datos de nadie.
   2. Pregunta a la base, con ese token, si su plan tiene la función; cuenta
      los tokens del documento (gratis) y rechaza los muy largos; y solo
      entonces descuenta la lectura: 10 al día y 30 al mes por usuario, 100 al
      día para toda la app (usar_asistente_tarjetas, sql/17).
   3. La IA lee el documento (lector.ts) y se guardan los tokens que usó
      (registrar_tokens_asistente, sql/16). La respuesta se limpia con
      js/calc/estado-cuenta.js. Si cuadra o no lo decide la app.
   El archivo no se guarda en ningún lado.

   Secreto (supabase secrets set): ANTHROPIC_API_KEY.
   SUPABASE_URL y SUPABASE_ANON_KEY los pone Supabase. */

import Anthropic from 'npm:@anthropic-ai/sdk@1.4.0';
import { normalizarLectura } from '../../../js/calc/estado-cuenta.js';
import { leerConIA, contarTokens, ErrorLectura, TIPOS, MAX_TOKENS_ENTRADA,
         type Tokens } from './lector.ts';

const URL_BASE = Deno.env.get('SUPABASE_URL');
const ANON = Deno.env.get('SUPABASE_ANON_KEY');
const MAX_BASE64 = 10 * 1024 * 1024;   // ~7.5 MB de archivo

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function responder(estado: number, cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const MOTIVOS: Record<string, [number, string]> = {
  sin_sesion: [401, 'Tu sesión expiró. Vuelve a entrar.'],
  sin_funcion: [403, 'El asistente de tarjetas es parte del plan premium.'],
  sin_cupo: [429, 'Ya usaste todas las lecturas de este mes.'],
  sin_cupo_dia: [429, 'Ya usaste las lecturas de hoy. Mañana puedes seguir.'],
  sin_cupo_global: [429, 'El asistente llegó a su límite de hoy. Intenta mañana.'],
};

const negar = (motivo: string) => {
  const [estado, mensaje] = MOTIVOS[motivo] ?? MOTIVOS.sin_sesion;
  return responder(estado, { error: mensaje });
};

const rpc = (token: string, funcion: string, args: unknown) =>
  fetch(`${URL_BASE}/rest/v1/rpc/${funcion}`, {
    method: 'POST', body: JSON.stringify(args),
    headers: { apikey: ANON!, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });

/** ¿Su plan tiene el asistente? Sin descontar nada. null = sí, si no el motivo. */
async function motivoSinFuncion(token: string): Promise<string | null> {
  const r = await rpc(token, 'tiene_funcion', { p_clave: 'asistente_tarjetas' });
  if (!r.ok) return 'sin_sesion';
  return (await r.json()) === true ? null : 'sin_funcion';
}

/** Descuenta la lectura con el token del usuario: la base decide si puede. */
async function permiso(token: string) {
  const r = await rpc(token, 'usar_asistente_tarjetas', {});
  if (!r.ok) return { permitido: false, motivo: 'sin_sesion' };
  return await r.json();
}

/* Si no se puede guardar, la lectura sigue: es para medir, no para cobrar. */
async function registrarTokens(token: string, { entrada, salida }: Tokens) {
  try {
    const r = await rpc(token, 'registrar_tokens_asistente', { p_entrada: entrada, p_salida: salida });
    if (!r.ok) console.error('[leer-estado] tokens no guardados', r.status);
  } catch (e) {
    console.error('[leer-estado] tokens no guardados', e);
  }
}

function errorDeIA(e: unknown) {
  if (e instanceof ErrorLectura) return responder(e.estado, { error: e.message });
  if (e instanceof Anthropic.RateLimitError) {
    return responder(429, { error: 'El asistente está ocupado. Intenta en un minuto.' });
  }
  if (e instanceof Anthropic.AuthenticationError) {
    return responder(503, { error: 'El asistente no está configurado.' });
  }
  if (e instanceof Anthropic.BadRequestError) {
    return responder(422, { error: 'El asistente no pudo abrir ese archivo.' });
  }
  console.error('[leer-estado]', e);
  return responder(502, { error: 'El asistente no respondió. Intenta de nuevo.' });
}

/** Todo lo que se revisa antes de gastar. null = se puede leer. */
async function antesDeLeer(token: string, archivo?: string, tipo?: string) {
  if (!archivo || !tipo || !TIPOS.includes(tipo)) {
    return responder(400, { error: 'Sube un PDF, una foto o el texto del estado de cuenta.' });
  }
  if (archivo.length > MAX_BASE64) return responder(413, { error: 'El archivo es muy grande.' });
  if (!Deno.env.get('ANTHROPIC_API_KEY')) {
    return responder(503, { error: 'El asistente todavía no está configurado.' });
  }
  const motivo = await motivoSinFuncion(token);
  if (motivo) return negar(motivo);
  try {
    if (await contarTokens(tipo, archivo) > MAX_TOKENS_ENTRADA) {
      return responder(413, { error: 'El documento es muy largo: sube solo las páginas del estado de cuenta.' });
    }
  } catch (e) {
    return errorDeIA(e);
  }
  return null;
}

async function leer(token: string, cuerpo: { archivo?: string; tipo?: string }) {
  const { archivo, tipo } = cuerpo;
  const rechazo = await antesDeLeer(token, archivo, tipo);
  if (rechazo) return rechazo;

  const uso = await permiso(token);
  if (!uso.permitido) return negar(uso.motivo);

  let crudo;
  try {
    crudo = await leerConIA(tipo!, archivo!, (t) => registrarTokens(token, t));
  } catch (e) {
    return errorDeIA(e);
  }
  try {
    return responder(200, { lectura: normalizarLectura(crudo),
                            quedan: { hoy: uso.quedan_hoy, mes: uso.quedan_mes } });
  } catch (e) {
    return responder(422, { error: (e as Error).message });
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder(405, { error: 'Solo POST.' });
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return responder(401, { error: 'Falta la sesión.' });
  let cuerpo;
  try { cuerpo = await req.json(); } catch { return responder(400, { error: 'Cuerpo inválido.' }); }
  return leer(token, cuerpo);
});

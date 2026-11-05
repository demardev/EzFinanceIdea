/* Edge Function `administrar`: lo del panel de admin que exige la llave de
   servicio. Hoy, solo eliminar una cuenta para siempre:

   { accion: 'eliminar', user_id }

   1. Comprueba con el token de quien llama que sea admin, con su PIN vigente
      (admin_vigente()), y que no se esté borrando a sí mismo.
   2. Borra el usuario en Supabase Auth: su correo, su contraseña y sus
      sesiones. Las 14 tablas con user_id tienen `on delete cascade`, así que
      se van con él sus movimientos, cuentas, tarjetas, plan, negocio, todo.
   3. Borra sus fotos de recibos, que viven en Storage y no se van en cascada.

   No se puede deshacer. */

const URL_BASE = Deno.env.get('SUPABASE_URL');
const ANON = Deno.env.get('SUPABASE_ANON_KEY');
const SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const BUCKET = 'recibos';

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

const comoServicio = (extra = {}) =>
  ({ apikey: SERVICIO, Authorization: `Bearer ${SERVICIO}`, 'Content-Type': 'application/json', ...extra });

/** @returns el id de quien llama si es admin, o null */
async function adminQueLlama(token) {
  const conToken = { apikey: ANON, Authorization: `Bearer ${token}` };
  const usuario = await fetch(`${URL_BASE}/auth/v1/user`, { headers: conToken });
  if (!usuario.ok) return null;
  const { id } = await usuario.json();
  /* Admin Y con PIN puesto hace menos de 30 minutos (sql/11_planes_prestamos.sql). */
  const vigente = await fetch(`${URL_BASE}/rest/v1/rpc/admin_vigente`, {
    method: 'POST', headers: { ...conToken, 'Content-Type': 'application/json' }, body: '{}',
  });
  return vigente.ok && (await vigente.json()) === true ? id : null;
}

/** Todas sus fotos: la carpeta del bucket se llama como su id. */
async function borrarFotos(userId) {
  const rutas = [];
  for (let desde = 0; ; desde += 1000) {
    const r = await fetch(`${URL_BASE}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST', headers: comoServicio(),
      body: JSON.stringify({ prefix: userId, limit: 1000, offset: desde }),
    });
    const pagina = r.ok ? await r.json() : [];
    rutas.push(...pagina.map((f) => `${userId}/${f.name}`));
    if (pagina.length < 1000) break;
  }
  if (!rutas.length) return 0;
  const r = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE', headers: comoServicio(), body: JSON.stringify({ prefixes: rutas }),
  });
  if (!r.ok) throw new Error('Se eliminó la cuenta, pero no se pudieron borrar sus fotos.');
  return rutas.length;
}

async function eliminar(token, userId) {
  const admin = await adminQueLlama(token);
  if (!admin) return responder(403, { error: 'Solo el administrador, con su PIN vigente, puede hacer esto.' });
  if (!userId) return responder(400, { error: 'Falta el usuario.' });
  if (userId === admin) return responder(400, { error: 'No puedes eliminar tu propia cuenta.' });

  const r = await fetch(`${URL_BASE}/auth/v1/admin/users/${userId}`,
    { method: 'DELETE', headers: comoServicio() });
  if (r.status === 404) return responder(404, { error: 'Ese usuario ya no existe.' });
  if (!r.ok) return responder(500, { error: 'No se pudo eliminar la cuenta.' });

  try {
    return responder(200, { eliminado: true, fotos: await borrarFotos(userId) });
  } catch (e) {
    return responder(500, { error: e.message });
  }
}

Deno.serve(async (peticion) => {
  if (peticion.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const token = (peticion.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return responder(401, { error: 'Falta la sesión.' });
  const { accion, user_id: userId } = await peticion.json().catch(() => ({}));
  if (accion === 'eliminar') return eliminar(token, userId);
  return responder(400, { error: 'Acción desconocida.' });
});

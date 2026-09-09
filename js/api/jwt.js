/* Leer el payload de un JWT. Función PURA: sin red, sin DOM, sin imports.

   No valida la firma —eso lo hace el servidor— solo lee lo que ya trae el
   token que nos dieron. Se usa para sacar el id del usuario sin pedir otra
   vuelta a la red, y funciona con las sesiones que ya estaban guardadas. */

/** base64url -> texto. Difiere de base64 en dos caracteres y en el relleno. */
function desdeBase64Url(trozo) {
  const base64 = trozo.replaceAll('-', '+').replaceAll('_', '/');
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4);
  const binario = atob(base64 + relleno);
  /* Los bytes pueden ser UTF-8 (un email con acentos), así que se decodifica. */
  const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function leerPayload(token) {
  const partes = String(token ?? '').split('.');
  if (partes.length !== 3) return null;
  try {
    return JSON.parse(desdeBase64Url(partes[1]));
  } catch {
    return null;
  }
}

/** El `sub` de un token de Supabase es el uuid del usuario. */
export function idDeUsuario(token) {
  return leerPayload(token)?.sub ?? null;
}

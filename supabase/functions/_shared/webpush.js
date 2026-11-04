/* Web Push sin librerías: cifrado del mensaje (RFC 8291, aes128gcm) y firma
   VAPID (RFC 8292). Solo usa WebCrypto, así que corre igual en la Edge
   Function (Deno) que en test.html, donde se prueba contra el ejemplo del RFC.

   El servicio de push (Apple, Google, Mozilla) solo ve bytes cifrados: lo
   puede abrir únicamente el navegador que se suscribió. */

const texto = new TextEncoder();

export function aBase64Url(bytes) {
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function deBase64Url(cadena) {
  const b64 = cadena.replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

function unir(...partes) {
  const total = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of partes) { total.set(p, i); i += p.length; }
  return total;
}

async function hmac(llave, datos) {
  const k = await crypto.subtle.importKey('raw', llave, { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, datos));
}

/** HKDF de un solo bloque: todo lo que pide el RFC cabe en 32 bytes. */
async function hkdf(sal, ikm, info, largo) {
  const prk = await hmac(sal, ikm);
  return (await hmac(prk, unir(info, new Uint8Array([1])))).slice(0, largo);
}

/** Una llave P-256 a partir de su punto público (65 bytes) y, si se da, su `d`. */
function jwkDe(publica, privada) {
  const p = deBase64Url(publica);
  const jwk = { kty: 'EC', crv: 'P-256', x: aBase64Url(p.slice(1, 33)), y: aBase64Url(p.slice(33, 65)) };
  return privada ? { ...jwk, d: privada } : jwk;
}

async function llaveEfimera(dada) {
  if (dada) {
    const privada = await crypto.subtle.importKey('jwk', jwkDe(dada.publica, dada.privada),
      { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    return { privada, publica: deBase64Url(dada.publica) };
  }
  const par = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true,
    ['deriveBits']);
  return { privada: par.privateKey,
           publica: new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey)) };
}

/**
 * Cifra `texto` para una suscripción. `sal` y `efimera` solo se pasan en las
 * pruebas; en uso real salen nuevas en cada mensaje.
 * @returns Uint8Array, el cuerpo tal cual va en el POST al servicio de push
 */
export async function cifrarMensaje({ texto: mensaje, p256dh, auth, sal, efimera }) {
  const delNavegador = deBase64Url(p256dh);
  const suya = await crypto.subtle.importKey('jwk', jwkDe(p256dh),
    { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const mia = await llaveEfimera(efimera);
  const secreto = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'ECDH', public: suya }, mia.privada, 256));

  const info = unir(texto.encode('WebPush: info\0'), delNavegador, mia.publica);
  const ikm = await hkdf(deBase64Url(auth), secreto, info, 32);
  const salt = sal ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, texto.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, texto.encode('Content-Encoding: nonce\0'), 12);

  const llave = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const claro = unir(texto.encode(mensaje), new Uint8Array([2]));   // 2 = último registro
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce },
    llave, claro));

  const cabecera = new Uint8Array(21);
  cabecera.set(salt, 0);
  new DataView(cabecera.buffer).setUint32(16, 4096);             // tamaño de registro
  cabecera[20] = mia.publica.length;
  return unir(cabecera, mia.publica, cifrado);
}

/**
 * La cabecera Authorization de VAPID: un JWT ES256 para el origen del
 * endpoint, válido 12 horas, más la llave pública.
 */
export async function firmarVapid({ endpoint, publica, privada, sujeto,
                                    ahora = Math.floor(Date.now() / 1000) }) {
  const json = (o) => aBase64Url(texto.encode(JSON.stringify(o)));
  const firmado = `${json({ typ: 'JWT', alg: 'ES256' })}.${json({
    aud: new URL(endpoint).origin, exp: ahora + 12 * 3600, sub: sujeto })}`;
  const llave = await crypto.subtle.importKey('jwk', jwkDe(publica, privada),
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const firma = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' },
    llave, texto.encode(firmado)));
  return `vapid t=${firmado}.${aBase64Url(firma)}, k=${publica}`;
}

/**
 * Manda un mensaje a una suscripción. Devuelve el estado HTTP: 201 es
 * entregado; 404 y 410 quieren decir que la suscripción ya no existe.
 */
export async function enviarPush(suscripcion, mensaje, vapid) {
  const cuerpo = await cifrarMensaje({ texto: JSON.stringify(mensaje),
    p256dh: suscripcion.p256dh, auth: suscripcion.auth });
  const respuesta = await fetch(suscripcion.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await firmarVapid({ endpoint: suscripcion.endpoint, ...vapid }),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'normal',
    },
    body: cuerpo,
  });
  return respuesta.status;
}

/* Pruebas de supabase/functions/_shared/webpush.js — escritas antes que la
   implementación. El cifrado se compara byte por byte con el ejemplo del
   RFC 8291 (apéndice A): si coincide, cualquier navegador lo descifra. */

import { describir, igual, cierto } from './marco.js';
import { cifrarMensaje, firmarVapid, aBase64Url, deBase64Url }
  from '../../supabase/functions/_shared/webpush.js';

const RFC = {
  texto: 'When I grow up, I want to be a watermelon',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  efimeraPublica: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  efimeraPrivada: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  sal: 'DGv6ra1nlYgDCS1FRnbzlw',
  esperado: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};

describir('web push — base64url', (caso) => {
  caso('ida y vuelta sin relleno ni + /', () => {
    const bytes = new Uint8Array([251, 255, 191, 0, 1]);
    igual(aBase64Url(bytes), '-_-_AAE');
    igual([...deBase64Url('-_-_AAE')], [...bytes]);
  });
});

describir('web push — cifrado aes128gcm (RFC 8291)', (caso) => {
  caso('reproduce el ejemplo del RFC', async () => {
    const cuerpo = await cifrarMensaje({
      texto: RFC.texto, p256dh: RFC.p256dh, auth: RFC.auth,
      sal: deBase64Url(RFC.sal),
      efimera: { publica: RFC.efimeraPublica, privada: RFC.efimeraPrivada },
    });
    igual(aBase64Url(cuerpo), RFC.esperado);
  });

  caso('sin sal ni llave dadas, cada mensaje sale distinto', async () => {
    const a = await cifrarMensaje({ texto: 'hola', p256dh: RFC.p256dh, auth: RFC.auth });
    const b = await cifrarMensaje({ texto: 'hola', p256dh: RFC.p256dh, auth: RFC.auth });
    cierto(aBase64Url(a) !== aBase64Url(b), 'la sal y la llave efímera deben ser nuevas');
    igual(a.length, 16 + 4 + 1 + 65 + 'hola'.length + 1 + 16);
  });
});

describir('web push — firma VAPID', (caso) => {
  caso('el JWT va al origen del endpoint y su firma verifica', async () => {
    const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true,
      ['sign', 'verify']);
    const jwk = await crypto.subtle.exportKey('jwk', par.privateKey);
    const publica = aBase64Url(new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey)));

    const cabecera = await firmarVapid({
      endpoint: 'https://web.push.apple.com/QGuQyavXutnMJxyz', publica, privada: jwk.d,
      sujeto: 'mailto:yo@ejemplo.com', ahora: 1_800_000_000,
    });
    const [, token, k] = cabecera.match(/^vapid t=([^,]+), k=(.+)$/);
    igual(k, publica);

    const [h, c, firma] = token.split('.');
    const claims = JSON.parse(new TextDecoder().decode(deBase64Url(c)));
    igual(claims, { aud: 'https://web.push.apple.com', exp: 1_800_000_000 + 12 * 3600,
                    sub: 'mailto:yo@ejemplo.com' });
    const valida = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, par.publicKey,
      deBase64Url(firma), new TextEncoder().encode(`${h}.${c}`));
    cierto(valida, 'la firma ES256 no verifica');
  });
});

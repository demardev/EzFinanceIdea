/* Pruebas de api/jwt.js */

import { describir, igual } from './marco.js';
import { leerPayload, idDeUsuario } from '../api/jwt.js';

/* Arma un JWT de mentira. btoa() solo acepta Latin1, así que hay que pasar
   por los bytes UTF-8 igual que hace un servidor de verdad — si se le da la
   cadena tal cual, revienta con cualquier acento. */
function tokenCon(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const base64 = btoa(String.fromCharCode(...bytes));
  return `cabecera.${base64.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')}.firma`;
}

describir('jwt', (caso) => {
  caso('lee el payload', () => {
    const t = tokenCon({ sub: 'abc-123', email: 'yo@ejemplo.com', exp: 999 });
    igual(leerPayload(t).email, 'yo@ejemplo.com');
    igual(leerPayload(t).exp, 999);
  });

  caso('el sub es el id del usuario', () => {
    igual(idDeUsuario(tokenCon({ sub: '11111111-2222-4333-8444-555555555555' })),
          '11111111-2222-4333-8444-555555555555');
  });

  caso('sobrevive al relleno de base64url', () => {
    // payloads de largos distintos fuerzan 0, 2 y 3 caracteres de relleno
    for (const nombre of ['a', 'ab', 'abc', 'abcd', 'abcde']) {
      igual(leerPayload(tokenCon({ sub: nombre })).sub, nombre);
    }
  });

  caso('decodifica UTF-8, no solo ASCII', () => {
    igual(leerPayload(tokenCon({ sub: 'x', nombre: 'Muñoz — Íñigo' })).nombre, 'Muñoz — Íñigo');
  });

  caso('lo que no es un token devuelve null en vez de reventar', () => {
    igual(leerPayload('no-es-un-token'), null);
    igual(leerPayload(''), null);
    igual(leerPayload(null), null);
    igual(leerPayload('a.b.c'), null);
    igual(idDeUsuario('basura'), null);
  });
});

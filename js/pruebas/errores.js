/* Pruebas de api/errores.js. No es calc/, pero la distinción entre "no hay
   internet" y "el servidor te rechazó" decide si se cierra la sesión, y esa
   confusión ya causó un bug: merece quedar fijada. */

import { describir, igual } from './marco.js';
import { traducirError, errorApi, esFalloDeRed } from '../api/errores.js';

describir('errores de la API', (caso) => {
  caso('un fallo de red no es un rechazo del servidor', () => {
    igual(esFalloDeRed(errorApi('sin conexión', 0)), true);
    igual(esFalloDeRed(errorApi('no autorizado', 401)), false);
    igual(esFalloDeRed(errorApi('datos inválidos', 400)), false);
    igual(esFalloDeRed(new Error('cualquier cosa')), false);
    igual(esFalloDeRed(undefined), false);
  });

  caso('traduce por código HTTP', () => {
    igual(traducirError(0, null), 'Sin conexión. Revisa tu internet.');
    igual(traducirError(401, null), 'Tu sesión expiró. Vuelve a entrar.');
    igual(traducirError(409, null), 'Ese registro ya existe.');
  });

  caso('el mensaje del servidor gana sobre el código', () => {
    igual(traducirError(400, { message: 'Invalid login credentials' }),
          'Email o contraseña incorrectos.');
    igual(traducirError(404, { message: "Could not find the table 'public.cuentas'" }),
          'Esa tabla no existe. ¿Corriste sql/01_schema.sql en Supabase?');
  });

  caso('lo que no reconoce cae en un mensaje genérico', () => {
    igual(traducirError(418, { message: 'soy una tetera' }),
          'Algo salió mal. Intenta de nuevo.');
  });
});

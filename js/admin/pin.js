/* La puerta del panel: pedir el PIN, o crearlo la primera vez.
   El PIN lo revisa la base (admin_entrar): aquí solo se pinta y se manda.
   Cinco fallos seguidos bloquean 15 minutos; eso también lo lleva la base. */

import { escapar } from '../ui/texto.js';

const MENSAJES = {
  incorrecto: 'PIN incorrecto.',
  bloqueado: 'Demasiados intentos. Espera 15 minutos.',
  no_admin: 'Esta cuenta no es de administrador.',
};

function campoPin(nombre, etiqueta) {
  return `
    <div class="campo">
      <label for="c-${nombre}">${escapar(etiqueta)}</label>
      <input id="c-${nombre}" name="${nombre}" type="password" inputmode="numeric"
             pattern="[0-9]*" maxlength="8" autocomplete="off" required>
    </div>`;
}

function plantilla(crear) {
  return `
    <form class="pila" id="form-pin" novalidate style="max-width:360px; margin:40px auto 0">
      <div>
        <h2 style="margin:0 0 6px">${crear ? 'Crea tu PIN' : 'PIN de administrador'}</h2>
        <p class="tenue">${crear
          ? 'De 4 a 8 números. Lo vas a pedir cada vez que entres aquí.'
          : 'El acceso dura 30 minutos.'}</p>
      </div>
      ${campoPin('pin', crear ? 'PIN nuevo' : 'PIN')}
      ${crear ? campoPin('repetir', 'Repite el PIN') : ''}
      <p class="campo-error" data-error hidden></p>
      <button class="btn btn-primario btn-bloque" type="submit">${crear ? 'Crear PIN' : 'Entrar'}</button>
    </form>`;
}

/** Qué falla antes de mandar nada. */
function problemaLocal(pin, repetir, crear) {
  if (!/^[0-9]{4,8}$/.test(pin)) return 'El PIN son de 4 a 8 números.';
  if (crear && pin !== repetir) return 'Los dos PIN no coinciden.';
  return null;
}

/**
 * @param admin    repos/admin.js
 * @param alEntrar () => void, con el PIN ya aceptado
 * @param crear    true si la cuenta todavía no tiene PIN
 */
export function montarPin(contenedor, { admin, alEntrar, crear = false }) {
  contenedor.innerHTML = plantilla(crear);
  const form = contenedor.querySelector('#form-pin');
  const error = form.querySelector('[data-error]');
  const fallar = (texto) => { error.hidden = false; error.textContent = texto; };
  form.querySelector('input').focus();

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const pin = form.pin.value;
    const problema = problemaLocal(pin, form.repetir?.value, crear);
    if (problema) return fallar(problema);
    const boton = form.querySelector('button');
    boton.disabled = true;
    try {
      const respuesta = crear ? await admin.ponerPin(null, pin) : await admin.entrar(pin);
      if (respuesta === 'ok') return alEntrar();
      if (respuesta === 'sin_pin') return montarPin(contenedor, { admin, alEntrar, crear: true });
      fallar(MENSAJES[respuesta] ?? 'No se pudo entrar.');
      form.pin.value = '';
    } catch (e) { fallar(e.message); }
    boton.disabled = false;
  });
}

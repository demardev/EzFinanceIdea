/* Pantalla de entrada, con dos modos en el mismo formulario: entrar y crear
   cuenta. Solo maneja el formulario; quien sabe de tokens es api/sesion.js.

   El proyecto puede tener los registros cerrados en Supabase. No se adivina
   desde aquí: se intenta y el servidor lo dice, que es lo único que no miente. */

import { iniciarSesion, registrar } from '../api/sesion.js';
import { problemaConfig } from '../config.js';
import { avisoError, aviso } from '../ui/toast.js';

const MODOS = {
  entrar: {
    sub: 'Entra con tu cuenta para ver tus datos.',
    boton: 'Entrar', enviando: 'Entrando…',
    cambiar: '¿No tienes cuenta? Crear una', otro: 'crear',
    llave: 'current-password', confirma: false,
  },
  crear: {
    sub: 'Crea tu cuenta con un email y una contraseña.',
    boton: 'Crear cuenta', enviando: 'Creando…',
    cambiar: 'Ya tengo cuenta', otro: 'entrar',
    llave: 'new-password', confirma: true,
  },
};

function plantilla(modo) {
  const m = MODOS[modo];
  return `
    <div class="login-marca">
      <h1>Finanzas</h1>
      <p class="tenue">${m.sub}</p>
    </div>
    <form id="form-login" novalidate>
      <div class="campo">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" inputmode="email"
               autocomplete="username" autocapitalize="none" required>
      </div>
      <div class="campo">
        <label for="password">Contraseña</label>
        <input id="password" name="password" type="password"
               autocomplete="${m.llave}" required>
      </div>
      ${m.confirma ? `
        <div class="campo">
          <label for="password2">Repite la contraseña</label>
          <input id="password2" name="password2" type="password"
                 autocomplete="new-password" required>
          <span class="tenue-2" style="font-size:12.5px">Mínimo 8 caracteres.</span>
        </div>` : ''}
      <p class="campo-error" id="error-login" hidden></p>
      <button class="btn btn-primario btn-bloque" type="submit" id="btn-entrar">${m.boton}</button>
      <button class="enlace-accion btn-bloque" type="button" id="btn-modo"
              style="margin-top:12px">${m.cambiar}</button>
    </form>`;
}

/* Lo que el servidor no puede validar por ti: que las dos contraseñas sean la
   misma. El largo mínimo lo exige Supabase, pero decirlo antes evita un viaje. */
function problemaAlCrear({ password, password2 }) {
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (password !== password2) return 'Las dos contraseñas no son iguales.';
  return null;
}

async function enviar(modo, datos) {
  if (modo === 'entrar') {
    await iniciarSesion(datos.email, datos.password);
    return { entra: true };
  }
  const problema = problemaAlCrear(datos);
  if (problema) throw new Error(problema);
  const { confirmar } = await registrar(datos.email, datos.password);
  return { entra: !confirmar };
}

/** @param alEntrar callback que main.js usa para mostrar la app. */
export function montarLogin(contenedor, alEntrar) {
  let modo = 'entrar';

  function pintar() {
    contenedor.innerHTML = plantilla(modo);
    const form = contenedor.querySelector('#form-login');
    const boton = contenedor.querySelector('#btn-entrar');
    const error = contenedor.querySelector('#error-login');

    const problema = problemaConfig();
    if (problema) {
      error.hidden = false;
      error.textContent = problema;
      boton.disabled = true;
      return;
    }

    contenedor.querySelector('#btn-modo').addEventListener('click', () => {
      modo = MODOS[modo].otro;
      pintar();
    });

    form.addEventListener('submit', async (evento) => {
      evento.preventDefault();
      const datos = Object.fromEntries(new FormData(form));
      if (!datos.email || !datos.password) return;

      error.hidden = true;
      boton.disabled = true;
      boton.textContent = MODOS[modo].enviando;
      try {
        const { entra } = await enviar(modo, datos);
        if (entra) return alEntrar();
        /* Falta confirmar por correo: no hay sesión todavía. */
        aviso('Te mandamos un correo para confirmar la cuenta.');
        modo = 'entrar';
        pintar();
      } catch (e) {
        error.hidden = false;
        error.textContent = e.message;
        avisoError(e);
        boton.disabled = false;
        boton.textContent = MODOS[modo].boton;
      }
    });
  }

  pintar();
}

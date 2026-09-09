/* Pantalla de login. No hay registro: el usuario se crea a mano en Supabase.
   Solo maneja el formulario; quien sabe de tokens es api/sesion.js. */

import { iniciarSesion } from '../api/sesion.js';
import { problemaConfig } from '../config.js';
import { avisoError } from '../ui/toast.js';

function plantilla() {
  return `
    <div class="login-marca">
      <h1>Finanzas</h1>
      <p class="tenue">Entra con tu cuenta para ver tus datos.</p>
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
               autocomplete="current-password" required>
      </div>
      <p class="campo-error" id="error-login" hidden></p>
      <button class="btn btn-primario btn-bloque" type="submit" id="btn-entrar">Entrar</button>
    </form>`;
}

/** @param alEntrar callback que main.js usa para mostrar la app. */
export function montarLogin(contenedor, alEntrar) {
  contenedor.innerHTML = plantilla();
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

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const { email, password } = Object.fromEntries(new FormData(form));
    if (!email || !password) return;

    error.hidden = true;
    boton.disabled = true;
    boton.textContent = 'Entrando…';
    try {
      await iniciarSesion(email, password);
      alEntrar();
    } catch (e) {
      error.hidden = false;
      error.textContent = e.message;
      avisoError(e);
    } finally {
      boton.disabled = false;
      boton.textContent = 'Entrar';
    }
  });
}

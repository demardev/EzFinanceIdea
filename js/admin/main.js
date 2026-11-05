/* Arranque del panel de administración (admin/index.html). Es una página
   aparte de la app: sin tab bar, y con PIN antes de mostrar nada.

   Usa la MISMA sesión que la app (el token vive en localStorage del mismo
   origen): si no hay sesión, manda a entrar primero en la app. Quien protege
   los datos es la base: cada función admin_* exige la bandera admin y un PIN
   puesto hace menos de 30 minutos. */

import { crearClienteDatos } from '../api/client.js';
import { hayConfig } from '../config.js';
import { tokenVigente, haySesion, enSesionInvalida, idUsuario } from '../api/sesion.js';
import { repoAdmin } from '../repos/admin.js';
import { repoPerfiles } from '../repos/perfiles.js';
import { icono } from '../iconos/render.js';
import { pastillas, conectarPastillas } from '../ui/pastillas.js';
import { aviso, avisoError } from '../ui/toast.js';
import { montarPin } from './pin.js';
import { montarUsuarios } from './usuarios.js';
import { montarPlanes, montarFunciones } from './planes.js';

const PESTANAS = {
  usuarios:  { titulo: 'Usuarios',  montar: montarUsuarios },
  planes:    { titulo: 'Planes',    montar: montarPlanes },
  funciones: { titulo: 'Funciones', montar: montarFunciones },
};
const VOLVER = '../#/ajustes';

const vista = document.getElementById('vista');
const cliente = crearClienteDatos(tokenVigente);
const admin = repoAdmin(cliente);

function mensaje(texto, enlace = 'Ir a la app') {
  vista.innerHTML = `
    <div class="vacio"><p>${texto}</p>
      <a class="btn" href="${VOLVER}" style="margin-top:12px">${enlace}</a></div>`;
}

function pedirPin() {
  montarPin(vista, { admin, alEntrar: mostrarPanel });
}

/* Si el PIN caducó a medio uso, se vuelve a pedir; lo demás es un error normal. */
function alFallar(error) {
  if (/PIN/.test(error?.message ?? '')) {
    aviso('El acceso caducó. Pon tu PIN otra vez.');
    return pedirPin();
  }
  avisoError(error);
}

function mostrarPanel(pestana = 'usuarios') {
  const opciones = Object.entries(PESTANAS).map(([clave, p]) => [clave, p.titulo]);
  vista.innerHTML = `
    <div class="pila">
      <div data-pestanas>${pastillas({ opciones, valor: pestana })}</div>
      <div data-zona></div>
    </div>`;
  /* Cada pestaña estrena su contenedor: sus listeners se van con él. */
  const zona = document.createElement('div');
  vista.querySelector('[data-zona]').replaceWith(zona);
  conectarPastillas(vista.querySelector('[data-pestanas]'), (clave) => mostrarPanel(clave));
  PESTANAS[pestana].montar(zona, { admin, userId: idUsuario(), alFallar });
}

function conectarCabecera() {
  const atras = document.getElementById('btn-atras');
  atras.innerHTML = icono('atras', 20);
  atras.addEventListener('click', () => { location.href = VOLVER; });
  const salir = document.getElementById('btn-salir-admin');
  salir.innerHTML = icono('salir', 20);
  /* Cerrar el acceso en la base, no solo la página: el PIN vuelve a hacer falta. */
  salir.addEventListener('click', async () => {
    await admin.salir().catch(() => {});
    location.href = VOLVER;
  });
}

async function arrancar() {
  conectarCabecera();
  if (!haySesion() || !hayConfig()) return mensaje('Entra primero a la app con tu cuenta.');
  enSesionInvalida(() => mensaje('Tu sesión expiró. Vuelve a entrar en la app.'));
  const perfil = await repoPerfiles(cliente).mio().catch(() => ({ admin: false }));
  if (!perfil.admin) return mensaje('Esta cuenta no es de administrador.', 'Volver a la app');
  pedirPin();
}

arrancar();

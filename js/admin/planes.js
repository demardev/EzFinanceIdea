/* Planes y funciones del panel de admin.

   - Planes: cada plan con un interruptor por función. Encenderlo hace que
     todos los usuarios de ese plan la vean, y que la base los deje usarla.
   - Funciones: la lista, con qué hace cada una y en qué planes está.

   Las funciones no se crean aquí: existen porque existe su código, y se
   siembran en el SQL. Aquí solo se decide quién las tiene. */

import { campoInterruptor } from '../ui/campos.js';
import { escapar, enLista } from '../ui/texto.js';
import { aviso } from '../ui/toast.js';

function tarjetaPlan(plan, funciones) {
  const interruptores = funciones.map((f) => campoInterruptor({
    nombre: `${plan.clave}|${f.clave}`, etiqueta: f.nombre,
    activo: plan.funciones.includes(f.clave), ayuda: f.descripcion,
  })).join('');
  return `
    <div class="card">
      <p class="cifra-etiqueta">Plan</p>
      <p style="font-weight:600; margin-bottom:10px">${escapar(plan.nombre)}</p>
      ${interruptores || '<p class="tenue-2">Todavía no hay funciones.</p>'}
    </div>`;
}

async function cargar(admin) {
  const [planes, funciones] = await Promise.all([admin.planes(), admin.funciones()]);
  return { planes, funciones };
}

/** @param alFallar (error) => void */
export async function montarPlanes(contenedor, { admin, alFallar }) {
  contenedor.innerHTML = '<p class="tenue">Cargando…</p>';
  try {
    const { planes, funciones } = await cargar(admin);
    contenedor.innerHTML = `<div class="pila">${planes.map((p) => tarjetaPlan(p, funciones)).join('')}</div>`;
  } catch (e) { contenedor.textContent = e.message; alFallar(e); return; }

  contenedor.addEventListener('change', async (evento) => {
    const casilla = evento.target;
    const [plan, funcion] = casilla.name.split('|');
    try {
      await admin.ponerFuncion(plan, funcion, casilla.checked);
      aviso(casilla.checked ? 'Función encendida.' : 'Función apagada.');
    } catch (e) {
      casilla.checked = !casilla.checked;   // no quedó así
      alFallar(e);
    }
  });
}

function filaFuncion(f, planes) {
  const en = planes.filter((p) => p.funciones.includes(f.clave)).map((p) => p.nombre);
  return `
    <div class="lista-fila"><span class="fila-cuerpo" style="cursor:default">
      <span class="crece">
        <span class="titulo">${escapar(f.nombre)}</span><br>
        <span class="sub">${escapar(f.descripcion)}</span><br>
        <span class="sub ${en.length ? '' : 'warn'}">
          ${en.length ? `En: ${escapar(enLista(en))}` : 'En ningún plan'}</span>
      </span>
    </span></div>`;
}

export async function montarFunciones(contenedor, { admin, alFallar }) {
  contenedor.innerHTML = '<p class="tenue">Cargando…</p>';
  try {
    const { planes, funciones } = await cargar(admin);
    contenedor.innerHTML = funciones.length
      ? `<div class="lista">${funciones.map((f) => filaFuncion(f, planes)).join('')}</div>`
      : '<p class="tenue-2">Todavía no hay funciones.</p>';
  } catch (e) { contenedor.textContent = e.message; alFallar(e); }
}

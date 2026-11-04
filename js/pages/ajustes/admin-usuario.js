/* El sheet de un usuario en el panel de admin: darle o quitarle premium,
   encenderle el negocio, bloquear su cuenta o eliminarla para siempre. Cada botón se aplica al
   momento; lo que no se deshace solo pide confirmación antes. */

import { abrirSheet } from '../../ui/sheet.js';
import { campoInterruptor } from '../../ui/campos.js';
import { confirmar } from '../../ui/confirmar.js';
import { aviso } from '../../ui/toast.js';
import { escapar } from '../../ui/texto.js';
import { hoyISO, formatearFecha, isoLocalDe } from '../../calc/fechas.js';
import { nuevoVencimiento, textoPremium } from '../../calc/usuarios.js';

const PLAZOS = [['mes', '+1 mes'], ['anio', '+1 año'], ['siempre', 'Sin fin']];

function fechaO(marca, siFalta) {
  const iso = isoLocalDe(marca);
  return iso ? formatearFecha(iso) : siFalta;
}

function bloquePremium(u, hoy) {
  const botones = PLAZOS.map(([plazo, texto]) =>
    `<button class="btn" type="button" data-plazo="${plazo}">${texto}</button>`).join('');
  return `
    <div class="card">
      <p class="cifra-etiqueta">Plan</p>
      <p>${escapar(textoPremium(u, hoy))}</p>
      <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-top:12px">
        ${botones}
      </div>
      ${u.premium_hasta ? `<button class="btn btn-bloque" type="button" data-quitar-premium
                                   style="margin-top:6px">Quitar premium</button>` : ''}
    </div>`;
}

function cuerpo(u, esYo) {
  const hoy = hoyISO();
  return `
    <div class="pila">
      <p class="tenue-2" style="font-size:13px">
        Alta ${fechaO(u.creado, '—')} · Último acceso ${fechaO(u.ultimo_acceso, 'nunca')}
      </p>
      ${bloquePremium(u, hoy)}
      ${campoInterruptor({ nombre: 'negocio', etiqueta: 'Negocio de pago de recibos',
                           activo: u.negocio,
                           ayuda: 'Apagarlo no borra sus operaciones, solo las oculta.' })}
      ${esYo ? '' : `<button class="btn btn-peligro btn-bloque" type="button" data-bloquear>
                       ${u.bloqueado ? 'Desbloquear cuenta' : 'Bloquear cuenta'}</button>
                     <button class="btn btn-peligro btn-bloque" type="button" data-eliminar>
                       Eliminar cuenta</button>`}
      <p class="campo-error" data-error hidden></p>
    </div>`;
}

/** Pregunta antes solo lo que no se arregla con un toque. */
function confirmarSiHaceFalta(accion, u) {
  if (accion === 'quitar') {
    return confirmar({ titulo: 'Quitar premium', textoOk: 'Quitar',
                       mensaje: `${u.email} vuelve al plan normal desde hoy.` });
  }
  if (accion === 'bloquear' && !u.bloqueado) {
    return confirmar({ titulo: 'Bloquear cuenta', textoOk: 'Bloquear',
      mensaje: `${u.email} ya no podrá entrar y se le cierran las sesiones. `
             + 'El acceso que tenga abierto caduca en máximo una hora.' });
  }
  if (accion === 'eliminar') {
    return confirmar({ titulo: 'Eliminar cuenta', textoOk: 'Eliminar para siempre',
      mensaje: `Se borra ${u.email} con todo: su correo y contraseña, sus movimientos, `
             + 'cuentas, tarjetas, plan, negocio y fotos de recibos. No se puede deshacer.' });
  }
  return Promise.resolve(true);
}

/** Qué llamar y qué decir para cada botón. */
function operacion(accion, u, admin, valor) {
  if (accion === 'plazo') {
    const hasta = nuevoVencimiento(u.premium_hasta, valor, hoyISO());
    return { hacer: () => admin.ponerPremium(u.user_id, hasta), texto: 'Premium actualizado.' };
  }
  if (accion === 'quitar') {
    return { hacer: () => admin.ponerPremium(u.user_id, null), texto: 'Premium quitado.' };
  }
  if (accion === 'negocio') {
    return { hacer: () => admin.ponerNegocio(u.user_id, valor),
             texto: valor ? 'Negocio encendido.' : 'Negocio apagado.' };
  }
  if (accion === 'eliminar') {
    return { hacer: () => admin.eliminar(u.user_id), texto: 'Cuenta eliminada.' };
  }
  return { hacer: () => admin.bloquear(u.user_id, !u.bloqueado),
           texto: u.bloqueado ? 'Cuenta desbloqueada.' : 'Cuenta bloqueada.' };
}

function accionDe(evento) {
  const t = evento.target;
  if (t.closest('[data-plazo]')) return ['plazo', t.closest('[data-plazo]').dataset.plazo];
  if (t.closest('[data-quitar-premium]')) return ['quitar'];
  if (t.closest('[data-bloquear]')) return ['bloquear'];
  if (t.closest('[data-eliminar]')) return ['eliminar'];
  if (t.name === 'negocio') return ['negocio', t.checked];
  return null;
}

/** @param alCambiar () => Promise, recarga la lista tras cada cambio. */
export function abrirUsuario(u, { admin, esYo, alCambiar }) {
  const { hoja, cerrar } = abrirSheet({ titulo: escapar(u.email ?? 'Usuario'), cuerpo: cuerpo(u, esYo) });
  const error = hoja.querySelector('[data-error]');

  async function aplicar(evento) {
    const elegida = accionDe(evento);
    if (!elegida) return;
    const [accion, valor] = elegida;
    if (!(await confirmarSiHaceFalta(accion, u))) return;
    error.hidden = true;
    try {
      const { hacer, texto } = operacion(accion, u, admin, valor);
      await hacer();
      cerrar();
      aviso(texto);
      await alCambiar();
    } catch (e) {
      if (accion === 'negocio') evento.target.checked = !valor;   // no quedó así
      error.hidden = false;
      error.textContent = e.message;
    }
  }

  hoja.addEventListener('click', (evento) => { if (evento.target.type !== 'checkbox') aplicar(evento); });
  hoja.addEventListener('change', aplicar);
}

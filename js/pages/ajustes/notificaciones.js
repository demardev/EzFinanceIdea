/* Notificaciones push de ESTE dispositivo: activarlas y desactivarlas. Cada
   teléfono o computadora se activa aparte.

   Lo que cada quien lee depende de lo que tiene: sin negocio no se nombra el
   negocio, sin el atajo no se nombra Por confirmar, y la notificación de
   prueba es solo para admin o negocio (la función `avisar` también lo exige). */

import { icono } from '../../iconos/render.js';
import { aviso, avisoError } from '../../ui/toast.js';
import { estadoSoporte, suscripcionActual, suscribir, desuscribir, datosDe,
         nombreDispositivo } from '../../push/dispositivo.js';

const EXPLICACION = {
  instalar: 'En el iPhone los avisos solo funcionan con la app instalada: en Safari, '
          + 'Compartir → Añadir a pantalla de inicio, y ábrela desde ese icono.',
  bloqueado: 'Bloqueaste los avisos para esta app. Se vuelven a permitir en los ajustes '
           + 'del teléfono → Notificaciones → Finanzas.',
  'sin-soporte': 'Este navegador no admite notificaciones push.',
};

/* Lo programan sql/09_avisos_programados.sql y la función `avisar`. El de
   Por confirmar solo existe para quien configuró el atajo: sin su clave no
   entra nada a la bandeja, así que no hay nada que avisar. */
function queTeLlega({ negocio, conAtajo }) {
  const noche = negocio ? 'un resumen de tu día y de lo que te deben del negocio'
                        : 'un resumen de tu día';
  const atajo = conAtajo ? ' Y al momento, cuando llega algo a Por confirmar.' : '';
  return `<p class="tenue" style="font-size:13px">Cada noche a las 8:00 pm, ${noche}.${atajo}</p>`;
}

function boton(id, texto, iconoNombre, clase = '') {
  return `<button class="btn btn-bloque ${clase}" type="button" id="${id}">
            ${icono(iconoNombre, 18)} ${texto}</button>`;
}

function botones(activa, puedeProbar) {
  if (!activa) return boton('btn-activar', 'Activar en este dispositivo', 'plus', 'btn-primario');
  return `${puedeProbar ? boton('btn-probar', 'Mandarme una de prueba', 'check', 'btn-primario') : ''}
          ${boton('btn-apagar', 'Desactivar en este dispositivo', 'x', 'btn-peligro')}`;
}

function pintar(contenedor, estado, activa, perfil) {
  const explicacion = EXPLICACION[estado];
  contenedor.innerHTML = `
    <div class="pila">
      <div class="card">
        <p class="cifra-etiqueta">Este dispositivo</p>
        <p>${explicacion ? explicacion
             : activa ? 'Los avisos están activados aquí.' : 'Los avisos están apagados aquí.'}</p>
      </div>
      ${explicacion ? '' : botones(activa, perfil.puedeProbar)}
      ${queTeLlega(perfil)}
    </div>`;
}

/** Lo que hace cada botón. Si lanza, la pantalla muestra el error. */
function accionesDe(push) {
  return {
    'btn-activar': async () => {
      const datos = await suscribir();             // primero, por iOS: ver dispositivo.js
      await push.guardar(datos, nombreDispositivo());
      aviso('Avisos activados.');
    },
    'btn-probar': async () => {
      const { entregadas } = await push.probar();
      aviso(entregadas ? 'Enviada. Debe llegar en unos segundos.' : 'No se pudo entregar.');
    },
    'btn-apagar': async () => {
      const endpoint = await desuscribir();
      if (endpoint) await push.quitar(endpoint);
      aviso('Avisos desactivados aquí.');
    },
  };
}

/** Si falla la consulta, simplemente no se menciona Por confirmar. */
async function tieneAtajo(bandeja) {
  try { return Boolean(await bandeja.fechaDeClave()); } catch { return false; }
}

export async function montarNotificaciones(contenedor, contexto) {
  const { push, perfil: { negocio = false, admin = false } = {} } = contexto;
  const perfil = { negocio, puedeProbar: admin || negocio, conAtajo: false };

  async function repintar() {
    const estado = estadoSoporte();
    const actual = estado === 'ok' ? await suscripcionActual() : null;
    /* Se vuelve a guardar al entrar: si en este teléfono se cambió de cuenta,
       la suscripción pasa a la cuenta de ahora. */
    if (actual) push.guardar(datosDe(actual), nombreDispositivo()).catch(() => {});
    pintar(contenedor, estado, Boolean(actual), perfil);
  }

  const acciones = accionesDe(push);

  contenedor.addEventListener('click', async (evento) => {
    const objetivo = evento.target.closest('button[id]');
    const accion = objetivo && acciones[objetivo.id];
    if (!accion) return;
    objetivo.disabled = true;
    try { await accion(); await repintar(); }
    catch (e) { avisoError(e); objetivo.disabled = false; }
  });

  contenedor.innerHTML = '<p class="tenue">Cargando…</p>';
  perfil.conAtajo = await tieneAtajo(contexto.bandeja);
  await repintar();
}

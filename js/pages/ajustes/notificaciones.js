/* Notificaciones push de ESTE dispositivo: activarlas, mandarse una de
   prueba y desactivarlas. Cada teléfono o computadora se activa aparte. */

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

/* Lo programan sql/09_avisos_programados.sql y la función `avisar`. */
const QUE_AVISA = `
  <div class="card pila-sm">
    <p class="cifra-etiqueta">Qué te avisa</p>
    <p><strong>8:00 pm · Cierre del día.</strong> Cuántos movimientos registraste hoy,
       lo que vence mañana y, si llevas el negocio, los recibos que te deben
       desde hace una semana o más.</p>
    <p><strong>Al momento · Por confirmar.</strong> Cuando llega una compra de
       Apple Pay, un SMS o un correo del banco.</p>
    <p class="tenue-2" style="font-size:12.5px">Nunca lleva montos: se ve en la
       pantalla bloqueada.</p>
  </div>`;

function boton(id, texto, iconoNombre, clase = '') {
  return `<button class="btn btn-bloque ${clase}" type="button" id="${id}">
            ${icono(iconoNombre, 18)} ${texto}</button>`;
}

function pintar(contenedor, estado, activa) {
  const explicacion = EXPLICACION[estado];
  contenedor.innerHTML = `
    <div class="pila">
      <div class="card">
        <p class="cifra-etiqueta">Este dispositivo</p>
        <p>${explicacion ? explicacion
             : activa ? 'Los avisos están activados aquí.' : 'Los avisos están apagados aquí.'}</p>
      </div>
      ${explicacion ? '' : activa
        ? `${boton('btn-probar', 'Mandarme una de prueba', 'check', 'btn-primario')}
           ${boton('btn-apagar', 'Desactivar en este dispositivo', 'x', 'btn-peligro')}`
        : boton('btn-activar', 'Activar en este dispositivo', 'plus', 'btn-primario')}
      ${QUE_AVISA}
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

export async function montarNotificaciones(contenedor, contexto) {
  const { push } = contexto;

  async function repintar() {
    const estado = estadoSoporte();
    const actual = estado === 'ok' ? await suscripcionActual() : null;
    /* Se vuelve a guardar al entrar: si en este teléfono se cambió de cuenta,
       la suscripción pasa a la cuenta de ahora. */
    if (actual) push.guardar(datosDe(actual), nombreDispositivo()).catch(() => {});
    pintar(contenedor, estado, Boolean(actual));
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
  await repintar();
}

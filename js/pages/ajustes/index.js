/* Hub de Ajustes: decide qué subpantalla montar según el hash.
   #/ajustes -> el menú · #/ajustes/cuentas · #/ajustes/categorias
   Lo del negocio vive junto en su propio menú: #/ajustes/negocio/clientes */

import { cerrarSesion, emailSesion } from '../../api/sesion.js';
import { icono } from '../../iconos/render.js';
import { escapar } from '../../ui/texto.js';
import { confirmar } from '../../ui/confirmar.js';
import { montarCuentas } from './cuentas.js';
import { montarCategorias } from './categorias.js';
import { montarFijosVariables } from './fijos-variables.js';
import { montarDatos } from './datos.js';
import { montarNegocio } from './negocio.js';
import { montarClientes } from './clientes.js';
import { montarAtajo } from './atajo.js';
import { montarAdmin } from './admin.js';
import { montarNotificaciones } from './notificaciones.js';
import { suscripcionAlSalir } from '../../push/dispositivo.js';

const SECCIONES = {
  cuentas:    { titulo: 'Cuentas',    icono: 'wallet', sub: 'Crear, editar, reordenar, archivar', montar: montarCuentas },
  categorias: { titulo: 'Categorías', icono: 'tag',    sub: 'Agrupadas por tipo de movimiento',   montar: montarCategorias },
  plan:       { titulo: 'Fijos y variables', icono: 'repeat', sub: 'Lo que alimenta el planificador', montar: montarFijosVariables },
  applepay:   { titulo: 'Apple Pay y avisos', icono: 'card',
                sub: 'Compras, SMS y correos del banco que llegan a Por confirmar',
                montar: montarAtajo },
  notificaciones: { titulo: 'Notificaciones', icono: 'alerta',
                    sub: 'Avisos en este dispositivo', montar: montarNotificaciones },
  datos:      { titulo: 'Datos', icono: 'descarga', sub: 'Exportar e importar respaldo', montar: montarDatos },
  /* `solo` nombra la bandera de `perfiles` sin la cual la sección no aparece. */
  negocio:    { titulo: 'Negocio', icono: 'banknote', sub: 'Cuentas, comisión y clientes',
                montar: montarMenuNegocio, solo: 'negocio' },
  admin:      { titulo: 'Administración', icono: 'persona', sub: 'Usuarios, premium y bloqueos',
                montar: montarAdmin, solo: 'admin' },
};

/* Los apartados del negocio, dentro de Negocio. */
const NEGOCIO = {
  preferencias: { titulo: 'Cuentas y comisión', icono: 'wallet',
                  sub: 'Lo que trae puesto el pago de recibo', montar: montarNegocio },
  clientes:     { titulo: 'Clientes', icono: 'persona',
                  sub: 'De quién son los pagos de recibo', montar: montarClientes },
};

function filaSeccion(clave, seccion, base = '#/ajustes') {
  return `
    <a class="lista-fila" href="${base}/${clave}">
      <span class="fila-cuerpo">
        <span class="icono-caja">${icono(seccion.icono, 18)}</span>
        <span class="crece truncar">
          <span class="titulo">${escapar(seccion.titulo)}</span><br>
          <span class="sub">${escapar(seccion.sub)}</span>
        </span>
      </span>
      <span class="tenue-2">${icono('derecha', 16)}</span>
    </a>`;
}

function montarMenu(contenedor, contexto) {
  const { alSalir } = contexto;
  contenedor.innerHTML = `
    <div class="pila">
      <div class="lista">
        ${Object.entries(SECCIONES)
            .filter(([, s]) => !s.solo || contexto.perfil?.[s.solo])
            .map(([c, s]) => filaSeccion(c, s)).join('')}
      </div>
      <div class="card">
        <p class="cifra-etiqueta">Sesión iniciada como</p>
        <p class="truncar">${escapar(emailSesion())}</p>
      </div>
      <button class="btn btn-peligro btn-bloque" id="btn-salir">
        ${icono('salir', 18)} Cerrar sesión
      </button>
    </div>`;

  contenedor.querySelector('#btn-salir').addEventListener('click', async () => {
    const seguro = await confirmar({
      titulo: 'Cerrar sesión', textoOk: 'Cerrar sesión',
      mensaje: 'Para volver a entrar vas a necesitar tu email y tu contraseña.',
    });
    if (!seguro) return;
    await soltarAvisos(contexto);
    await cerrarSesion();
    alSalir();
  });
}

/* Los avisos de esta cuenta no deben seguir llegando a este teléfono cuando
   entre otra. Se da de baja en la base mientras el token aún sirve. Si algo
   falla se sale igual: la siguiente cuenta que active avisos se queda con el
   endpoint (guardar_suscripcion_push lo reasigna). */
async function soltarAvisos(contexto) {
  try {
    const suscripcion = await suscripcionAlSalir();
    if (!suscripcion) return;
    await contexto.push.quitar(suscripcion.endpoint).catch(() => {});
    await suscripcion.unsubscribe();
  } catch { /* sin permiso o sin soporte: no había nada que soltar */ }
}

function montarMenuNegocio(contenedor, contexto, pantalla) {
  const apartado = NEGOCIO[pantalla.detalle];
  if (apartado) {
    pantalla.ponerCabecera(apartado.titulo, '#/ajustes/negocio');
    return apartado.montar(contenedor, contexto);
  }
  contenedor.innerHTML = `
    <div class="lista">
      ${Object.entries(NEGOCIO).map(([c, s]) => filaSeccion(c, s, '#/ajustes/negocio')).join('')}
    </div>`;
}

export function montarAjustes(contenedor, contexto, pantalla) {
  const seccion = SECCIONES[pantalla.sub];
  if (!seccion) return montarMenu(contenedor, contexto);
  pantalla.ponerCabecera(seccion.titulo, '#/ajustes');
  return seccion.montar(contenedor, contexto, pantalla);
}

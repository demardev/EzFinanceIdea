/* Hub de Ajustes: decide qué subpantalla montar según el hash.
   #/ajustes -> el menú · #/ajustes/cuentas · #/ajustes/categorias */

import { cerrarSesion, emailSesion } from '../../api/sesion.js';
import { icono } from '../../iconos/render.js';
import { escapar } from '../../ui/texto.js';
import { montarCuentas } from './cuentas.js';
import { montarCategorias } from './categorias.js';
import { montarFijosVariables } from './fijos-variables.js';
import { montarDatos } from './datos.js';

const SECCIONES = {
  cuentas:    { titulo: 'Cuentas',    icono: 'wallet', sub: 'Crear, editar, reordenar, archivar', montar: montarCuentas },
  categorias: { titulo: 'Categorías', icono: 'tag',    sub: 'Agrupadas por tipo de movimiento',   montar: montarCategorias },
  plan:       { titulo: 'Fijos y variables', icono: 'repeat', sub: 'Lo que alimenta el planificador', montar: montarFijosVariables },
  datos:      { titulo: 'Datos', icono: 'descarga', sub: 'Exportar e importar respaldo', montar: montarDatos },
};

function filaSeccion(clave, seccion) {
  return `
    <a class="lista-fila" href="#/ajustes/${clave}">
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

function montarMenu(contenedor, { alSalir }) {
  contenedor.innerHTML = `
    <div class="pila">
      <div class="lista">
        ${Object.entries(SECCIONES).map(([c, s]) => filaSeccion(c, s)).join('')}
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
    await cerrarSesion();
    alSalir();
  });
}

export function montarAjustes(contenedor, contexto, pantalla) {
  const seccion = SECCIONES[pantalla.sub];
  if (!seccion) return montarMenu(contenedor, contexto);
  pantalla.ponerCabecera(seccion.titulo, '#/ajustes');
  return seccion.montar(contenedor, contexto);
}

/* Panel de admin: todos los usuarios, filtrados por plan y por estado, con
   búsqueda por correo. Tocar uno abre lo que se le puede cambiar.
   Solo aparece en el menú con `perfiles.admin`; quien la proteja es la base. */

import { filaEditable, envolverLista, estadoVacio } from '../../ui/lista.js';
import { pastillas, conectarPastillas } from '../../ui/pastillas.js';
import { avisoError } from '../../ui/toast.js';
import { hoyISO } from '../../calc/fechas.js';
import { filtrarUsuarios, contarUsuarios, textoPremium } from '../../calc/usuarios.js';
import { abrirUsuario } from './admin-usuario.js';

function opcionesPlan(n) {
  return [['', `Todos ${n.todos}`], ['normal', `Normal ${n.normal}`],
          ['premium', `Premium ${n.premium}`]];
}

function opcionesEstado(n) {
  return [['', 'Sin filtro'], ['negocio', `Negocio ${n.negocio}`],
          ['bloqueado', `Bloqueados ${n.bloqueado}`]];
}

function subtitulo(u, hoy) {
  return [textoPremium(u, hoy), u.negocio && 'Negocio', u.admin && 'Admin']
    .filter(Boolean).join(' · ');
}

function filas(lista, hoy) {
  if (!lista.length) {
    return estadoVacio({ iconoNombre: 'persona', titulo: 'Nadie con esos filtros.' });
  }
  return envolverLista(lista.map((u) => filaEditable({
    id: u.user_id, nombre: u.email ?? '(sin correo)', iconoNombre: 'persona',
    sub: subtitulo(u, hoy), derecha: u.bloqueado ? 'Bloqueado' : '',
  })));
}

function esqueleto(contenedor) {
  contenedor.innerHTML = `
    <div class="pila">
      <div>
        <div data-grupo="plan"></div>
        <div data-grupo="estado"></div>
        <div class="campo">
          <input type="search" data-buscar placeholder="Buscar por correo"
                 aria-label="Buscar por correo" autocomplete="off" autocapitalize="off">
        </div>
      </div>
      <div data-lista><p class="tenue">Cargando…</p></div>
    </div>`;
  const $ = (sel) => contenedor.querySelector(sel);
  return { plan: $('[data-grupo="plan"]'), estado: $('[data-grupo="estado"]'),
           buscar: $('[data-buscar]'), lista: $('[data-lista]') };
}

export async function montarAdmin(contenedor, contexto) {
  const { admin, userId } = contexto;
  const zonas = esqueleto(contenedor);
  const filtros = { plan: '', estado: '', texto: '' };
  let usuarios = [];

  /* El buscador nunca se repinta: si se repintara, el teclado se cerraría
     a cada letra. Solo cambian las pastillas (sus conteos) y la lista. */
  function pintar() {
    const hoy = hoyISO();
    const n = contarUsuarios(usuarios, hoy);
    zonas.plan.innerHTML = pastillas({ opciones: opcionesPlan(n), valor: filtros.plan });
    zonas.estado.innerHTML = pastillas({ opciones: opcionesEstado(n), valor: filtros.estado,
                                         compactas: true });
    zonas.lista.innerHTML = filas(filtrarUsuarios(usuarios, filtros, hoy), hoy);
  }

  async function recargar() {
    try {
      usuarios = await admin.usuarios();
      pintar();
    } catch (e) {
      zonas.lista.textContent = e.message;
      avisoError(e);
    }
  }

  conectarPastillas(zonas.plan, (v) => { filtros.plan = v; pintar(); });
  conectarPastillas(zonas.estado, (v) => { filtros.estado = v; pintar(); });
  zonas.buscar.addEventListener('input', () => { filtros.texto = zonas.buscar.value; pintar(); });
  zonas.lista.addEventListener('click', (evento) => {
    const fila = evento.target.closest('[data-editar]');
    const usuario = fila && usuarios.find((u) => u.user_id === fila.dataset.editar);
    if (usuario) abrirUsuario(usuario, { admin, esYo: usuario.user_id === userId, alCambiar: recargar });
  });

  await recargar();
}

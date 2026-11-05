/* Usuarios del panel de admin: filtrados por plan y por estado, con búsqueda
   por correo, de 5 en 5. Tocar uno abre lo que se le puede cambiar.
   Quien protege esto es la base: admin y PIN vigente (sql/11). */

import { filaEditable, envolverLista, estadoVacio } from '../ui/lista.js';
import { pastillas, conectarPastillas } from '../ui/pastillas.js';
import { hoyISO } from '../calc/fechas.js';
import { filtrarUsuarios, contarUsuarios, textoPremium } from '../calc/usuarios.js';
import { abrirUsuario } from './usuario.js';

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

const POR_PAGINA = 5;

function filas(lista, hoy, cuantos) {
  if (!lista.length) {
    return estadoVacio({ iconoNombre: 'persona', titulo: 'Nadie con esos filtros.' });
  }
  const visibles = lista.slice(0, cuantos);
  const faltan = lista.length - visibles.length;
  return envolverLista(visibles.map((u) => filaEditable({
    id: u.user_id, nombre: u.email ?? '(sin correo)', iconoNombre: 'persona',
    sub: subtitulo(u, hoy), derecha: u.bloqueado ? 'Bloqueado' : '',
  }))) + `<p class="tenue-2" style="font-size:12.5px; margin-top:8px">
      ${visibles.length} de ${lista.length}</p>`
    + (faltan ? `<button class="btn btn-bloque" type="button" data-mas style="margin-top:8px">
      Ver ${Math.min(POR_PAGINA, faltan)} más</button>` : '');
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

/** @param alFallar (error) => void — el panel decide si hay que pedir el PIN otra vez */
export async function montarUsuarios(contenedor, { admin, userId, alFallar }) {
  const zonas = esqueleto(contenedor);
  const filtros = { plan: '', estado: '', texto: '' };
  let usuarios = [];
  let cuantos = POR_PAGINA;

  /* El buscador nunca se repinta: si se repintara, el teclado se cerraría
     a cada letra. Solo cambian las pastillas (sus conteos) y la lista. */
  function pintar() {
    const hoy = hoyISO();
    const n = contarUsuarios(usuarios, hoy);
    zonas.plan.innerHTML = pastillas({ opciones: opcionesPlan(n), valor: filtros.plan });
    zonas.estado.innerHTML = pastillas({ opciones: opcionesEstado(n), valor: filtros.estado,
                                         compactas: true });
    zonas.lista.innerHTML = filas(filtrarUsuarios(usuarios, filtros, hoy), hoy, cuantos);
  }

  async function recargar() {
    try { usuarios = await admin.usuarios(); pintar(); }
    catch (e) { zonas.lista.textContent = e.message; alFallar(e); }
  }

  /* Cambiar un filtro vuelve a la primera página. */
  const filtrar = (campo, valor) => { filtros[campo] = valor; cuantos = POR_PAGINA; pintar(); };
  conectarPastillas(zonas.plan, (v) => filtrar('plan', v));
  conectarPastillas(zonas.estado, (v) => filtrar('estado', v));
  zonas.buscar.addEventListener('input', () => filtrar('texto', zonas.buscar.value));
  zonas.lista.addEventListener('click', (evento) => {
    if (evento.target.closest('[data-mas]')) { cuantos += POR_PAGINA; pintar(); return; }
    const fila = evento.target.closest('[data-editar]');
    const usuario = fila && usuarios.find((u) => u.user_id === fila.dataset.editar);
    if (usuario) abrirUsuario(usuario, { admin, esYo: usuario.user_id === userId, alCambiar: recargar });
  });

  await recargar();
}

/* Constructores de campos de formulario. Devuelven HTML; no tocan datos.
   Los montos siempre con inputmode="decimal" para que salga el teclado numérico. */

import { escapar } from './texto.js';
import { aNumero, montoAEntrada } from '../calc/dinero.js';
import { icono } from '../iconos/render.js';

export function campoTexto({ nombre, etiqueta, valor = '', tipo = 'text', requerido = true, ayuda = '' }) {
  return `
    <div class="campo">
      <label for="c-${nombre}">${escapar(etiqueta)}</label>
      <input id="c-${nombre}" name="${nombre}" type="${tipo}" value="${escapar(valor)}"
             ${requerido ? 'required' : ''} autocomplete="off" autocapitalize="sentences">
      ${ayuda ? `<span class="tenue-2" style="font-size:12.5px">${escapar(ayuda)}</span>` : ''}
    </div>`;
}

/* type="text" y no "number": un input numérico rechaza las comas, así que no
   se puede formatear a $000.00 mientras se escribe. El teclado sigue siendo el
   numérico por inputmode="decimal".
   Se teclea estilo calculadora: los dígitos entran por la derecha y los dos
   últimos son los centavos (1,0,0,0 -> $10.00). No se teclea el punto. */
export function campoMonto({ nombre, etiqueta, valor = 0, ayuda = '' }) {
  const inicial = montoAEntrada(valor);
  return `
    <div class="campo">
      <label for="c-${nombre}">${escapar(etiqueta)}</label>
      <div class="campo-monto">
        <span class="campo-prefijo" aria-hidden="true">$</span>
        <input id="c-${nombre}" name="${nombre}" type="text" inputmode="decimal"
               data-monto value="${escapar(inicial)}" placeholder="0.00" autocomplete="off">
      </div>
      ${ayuda ? `<span class="tenue-2" style="font-size:12.5px">${escapar(ayuda)}</span>` : ''}
    </div>`;
}

/** @param opciones [[valor, texto], ...] */
export function campoSelect({ nombre, etiqueta, valor = '', opciones }) {
  const items = opciones.map(([v, t]) =>
    `<option value="${escapar(v)}" ${v === valor ? 'selected' : ''}>${escapar(t)}</option>`).join('');
  return `
    <div class="campo">
      <label for="c-${nombre}">${escapar(etiqueta)}</label>
      <select id="c-${nombre}" name="${nombre}">${items}</select>
    </div>`;
}

export function campoInterruptor({ nombre, etiqueta, activo = false, ayuda = '' }) {
  return `
    <label class="interruptor">
      <input type="checkbox" name="${nombre}" ${activo ? 'checked' : ''}>
      <span class="crece">
        ${escapar(etiqueta)}
        ${ayuda ? `<br><span class="tenue-2" style="font-size:12.5px">${escapar(ayuda)}</span>` : ''}
      </span>
    </label>`;
}

/** Rejilla de iconos. Guarda la elección en un input oculto. */
export function selectorIcono({ nombre, valor, nombres }) {
  const botones = nombres.map((n) => `
    <button type="button" class="icono-opcion ${n === valor ? 'elegido' : ''}"
            data-icono="${n}" aria-label="${n}">${icono(n, 20)}</button>`).join('');
  return `
    <div class="campo">
      <label>Icono</label>
      <input type="hidden" name="${nombre}" value="${escapar(valor)}">
      <div class="rejilla-iconos">${botones}</div>
    </div>`;
}

/** Engancha la rejilla al input oculto. Se llama después de pintar el sheet. */
export function conectarSelectorIcono(raiz) {
  const oculto = raiz.querySelector('.rejilla-iconos')?.previousElementSibling;
  raiz.querySelector('.icono-opcion.elegido')?.scrollIntoView({ block: 'nearest' });
  raiz.querySelectorAll('.icono-opcion').forEach((boton) => {
    boton.addEventListener('click', () => {
      raiz.querySelectorAll('.icono-opcion').forEach((b) => b.classList.remove('elegido'));
      boton.classList.add('elegido');
      oculto.value = boton.dataset.icono;
    });
  });
}

/** Select con dos grupos: cuentas y tarjetas. El valor va como "clase:id". */
export function campoCuentaOTarjeta({ nombre, etiqueta, valor, cuentas, tarjetas = [], vacio }) {
  const grupo = (titulo, lista, clase) => (lista.length ? `
    <optgroup label="${titulo}">
      ${lista.map((x) => {
        const v = `${clase}:${x.id}`;
        return `<option value="${v}" ${v === valor ? 'selected' : ''}>${escapar(x.nombre)}</option>`;
      }).join('')}
    </optgroup>` : '');

  return `
    <div class="campo">
      <label for="c-${nombre}">${escapar(etiqueta)}</label>
      <select id="c-${nombre}" name="${nombre}">
        <option value="">${escapar(vacio)}</option>
        ${grupo('Cuentas', cuentas, 'cuenta')}
        ${grupo('Tarjetas', tarjetas, 'tarjeta')}
      </select>
    </div>`;
}

/** Desarma "cuenta:abc" en { clase, id }. */
export function separarDestino(valor) {
  const [clase, id] = String(valor || '').split(':');
  return { clase, id: id || null };
}

/** Arma "cuenta:abc" a partir de una fila que tiene las dos columnas. */
export function unirDestino(fila, campoCuenta, campoTarjeta) {
  if (fila[campoCuenta]) return `cuenta:${fila[campoCuenta]}`;
  if (fila[campoTarjeta]) return `tarjeta:${fila[campoTarjeta]}`;
  return '';
}

/** FormData -> objeto plano. Checkbox a booleano y montos a número. */
export function datosDe(form) {
  const datos = Object.fromEntries(new FormData(form));
  form.querySelectorAll('input[type="checkbox"]').forEach((c) => { datos[c.name] = c.checked; });
  form.querySelectorAll('input[data-monto]').forEach((i) => { datos[i.name] = aNumero(i.value); });
  return datos;
}

/* Cómo se pinta cada clase de campo. Otro mapa: agregar una clase de campo
   es agregar una entrada, sin tocar el formulario. */

import { campoTexto, campoMonto, campoSelect, campoCuentaOTarjeta } from '../ui/campos.js';

function opcionesDe(lista, vacio) {
  return [['', vacio], ...lista.map((x) => [x.id, x.nombre])];
}

export const RENDERERS = {
  monto: (campo, valor) =>
    campoMonto({ nombre: campo.nombre, etiqueta: campo.etiqueta, valor: valor ?? '' }),

  fecha: (campo, valor) =>
    campoTexto({ nombre: campo.nombre, etiqueta: campo.etiqueta, valor: valor ?? '', tipo: 'date' }),

  texto: (campo, valor) =>
    campoTexto({ nombre: campo.nombre, etiqueta: campo.etiqueta, valor: valor ?? '' }),

  nota: (campo, valor) =>
    campoTexto({ nombre: campo.nombre, etiqueta: campo.etiqueta, valor: valor ?? '', requerido: false }),

  /* Solo las categorías del tipo elegido: es la regla que pediste. */
  categoria: (campo, valor, datos, tipoClave) => campoSelect({
    nombre: campo.nombre, etiqueta: campo.etiqueta, valor: valor ?? '',
    opciones: opcionesDe(datos.categorias.filter((c) => c.tipo === tipoClave),
                         'Elige una categoría'),
  }),

  cuenta: (campo, valor, datos) => campoSelect({
    nombre: campo.nombre, etiqueta: campo.etiqueta, valor: valor ?? '',
    opciones: opcionesDe(datos.cuentas, 'Elige una cuenta'),
  }),

  origenMixto: (campo, valor, datos) => campoCuentaOTarjeta({
    nombre: campo.nombre, etiqueta: campo.etiqueta, valor: valor ?? '',
    cuentas: datos.cuentas, tarjetas: datos.tarjetas, vacio: 'Elige cuenta o tarjeta',
  }),

  destinoMixto: (campo, valor, datos) => campoCuentaOTarjeta({
    nombre: campo.nombre, etiqueta: campo.etiqueta, valor: valor ?? '',
    cuentas: datos.cuentas, tarjetas: datos.tarjetas, vacio: 'Elige cuenta o tarjeta',
  }),
};

function pintarUno(campo, valores, datos, tipoClave) {
  return RENDERERS[campo.clase](campo, valores[campo.nombre], datos, tipoClave);
}

/** Pinta los campos que declara el tipo, en el orden que los declara.
    Un array anidado son dos campos que van en la misma línea. */
export function pintarCampos(campos, valores, datos, tipoClave) {
  return campos.map((campo) => {
    if (!Array.isArray(campo)) return pintarUno(campo, valores, datos, tipoClave);
    const dos = campo.map((c) => pintarUno(c, valores, datos, tipoClave)).join('');
    return `<div class="campo-fila">${dos}</div>`;
  }).join('');
}

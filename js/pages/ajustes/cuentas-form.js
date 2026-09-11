/* Bottom sheet de crear/editar cuenta. Solo declara los campos y valida;
   el cableado del sheet lo pone ui/sheet-formulario.js. */

import { abrirSheetFormulario } from '../../ui/sheet-formulario.js';
import { campoTexto, campoMonto, campoSelect, campoInterruptor } from '../../ui/campos.js';
import { redondear } from '../../calc/dinero.js';
import { icono } from '../../iconos/render.js';

const TIPOS = [
  ['efectivo', 'Efectivo'],
  ['bancaria', 'Bancaria'],
  ['ahorro',   'Ahorro'],
  ['otro',     'Otro'],
];

function campos(cuenta) {
  return `
    ${campoTexto({ nombre: 'nombre', etiqueta: 'Nombre', valor: cuenta.nombre ?? '' })}
    ${campoSelect({ nombre: 'tipo', etiqueta: 'Tipo', valor: cuenta.tipo ?? 'bancaria', opciones: TIPOS })}
    ${campoMonto({
      nombre: 'saldo_inicial', etiqueta: 'Saldo inicial', valor: cuenta.saldo_inicial ?? 0,
      ayuda: 'Lo que hay en la cuenta hoy. El saldo real se calcula sumando los movimientos.',
    })}
    ${cuenta.id ? campoInterruptor({
      nombre: 'archivada', etiqueta: 'Archivada', activo: Boolean(cuenta.archivada),
      ayuda: 'Se oculta de las listas sin borrar su historial.',
    }) : ''}`;
}

/* Solo para cuentas de efectivo y con la bandera de negocio: quien decide es
   quien llama, aquí solo se pinta si mandó el callback. */
function botonContar() {
  return `
    <button class="btn btn-bloque" type="button" id="btn-contar" style="margin-top:14px">
      ${icono('banknote', 16)} Contar efectivo
    </button>`;
}

export function abrirFormCuenta(cuenta, { alGuardar, alEliminar, alContar = null }) {
  const hoja = abrirSheetFormulario({
    titulo: cuenta.id ? 'Editar cuenta' : 'Nueva cuenta',
    id: 'form-cuenta',
    cuerpo: campos(cuenta) + (alContar ? botonContar() : ''),
    alPintar: (h, form) => {
      form.querySelector('#btn-contar')?.addEventListener('click', () => {
        hoja.cerrar();          // el arqueo abre su propia hoja
        alContar();
      });
    },
    textoGuardar: cuenta.id ? 'Guardar' : 'Crear cuenta',
    textoBorrar: cuenta.id ? 'Eliminar cuenta' : '',
    alEliminar: cuenta.id ? alEliminar : null,
    alGuardar: (datos) => {
      if (!datos.nombre.trim()) throw new Error('Ponle un nombre a la cuenta.');
      return alGuardar({
        nombre: datos.nombre.trim(),
        tipo: datos.tipo,
        saldo_inicial: redondear(datos.saldo_inicial || 0),
        ...(cuenta.id ? { archivada: Boolean(datos.archivada) } : {}),
      });
    },
  });
  return hoja;
}

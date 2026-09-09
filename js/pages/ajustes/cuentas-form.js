/* Bottom sheet de crear/editar cuenta. Solo declara los campos y valida;
   el cableado del sheet lo pone ui/sheet-formulario.js. */

import { abrirSheetFormulario } from '../../ui/sheet-formulario.js';
import { campoTexto, campoMonto, campoSelect, campoInterruptor } from '../../ui/campos.js';
import { redondear } from '../../calc/dinero.js';

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

export function abrirFormCuenta(cuenta, { alGuardar, alEliminar }) {
  abrirSheetFormulario({
    titulo: cuenta.id ? 'Editar cuenta' : 'Nueva cuenta',
    id: 'form-cuenta',
    cuerpo: campos(cuenta),
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
}

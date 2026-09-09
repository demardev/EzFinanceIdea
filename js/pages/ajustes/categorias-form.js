/* Bottom sheet de crear/editar categoría. Una categoría pertenece a UN tipo
   de movimiento; por eso el tipo es un campo del formulario. */

import { abrirSheetFormulario } from '../../ui/sheet-formulario.js';
import { campoTexto, campoSelect, campoInterruptor,
         selectorIcono, conectarSelectorIcono } from '../../ui/campos.js';
import { iconosDeCategoria } from '../../iconos/render.js';

export const TIPOS = [
  ['ingreso',       'Ingreso'],
  ['egreso',        'Egreso'],
  ['transferencia', 'Transferencia'],
];

function campos(categoria) {
  return `
    ${campoTexto({ nombre: 'nombre', etiqueta: 'Nombre', valor: categoria.nombre ?? '' })}
    ${campoSelect({ nombre: 'tipo', etiqueta: 'Tipo de movimiento',
                    valor: categoria.tipo ?? 'egreso', opciones: TIPOS })}
    ${selectorIcono({ nombre: 'icono', valor: categoria.icono ?? 'tag',
                      nombres: iconosDeCategoria() })}
    ${categoria.id ? campoInterruptor({
      nombre: 'archivada', etiqueta: 'Archivada', activo: Boolean(categoria.archivada),
      ayuda: 'Deja de ofrecerse al registrar, sin tocar los movimientos que ya la usan.',
    }) : ''}`;
}

export function abrirFormCategoria(categoria, { alGuardar, alEliminar }) {
  abrirSheetFormulario({
    titulo: categoria.id ? 'Editar categoría' : 'Nueva categoría',
    id: 'form-categoria',
    cuerpo: campos(categoria),
    textoGuardar: categoria.id ? 'Guardar' : 'Crear categoría',
    textoBorrar: categoria.id ? 'Eliminar categoría' : '',
    alEliminar: categoria.id ? alEliminar : null,
    alPintar: (hoja) => conectarSelectorIcono(hoja),
    alGuardar: (datos) => {
      if (!datos.nombre.trim()) throw new Error('Ponle un nombre a la categoría.');
      return alGuardar({
        nombre: datos.nombre.trim(),
        tipo: datos.tipo,
        icono: datos.icono || 'tag',
        ...(categoria.id ? { archivada: Boolean(datos.archivada) } : {}),
      });
    },
  });
}

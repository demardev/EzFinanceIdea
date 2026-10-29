/* Bottom sheet de crear/editar cliente. No se borran: se archivan, y así sus
   operaciones viejas siguen diciendo de quién eran. */

import { abrirSheetFormulario } from '../../ui/sheet-formulario.js';
import { campoTexto, campoInterruptor } from '../../ui/campos.js';

function campos(cliente) {
  return `
    ${campoTexto({ nombre: 'nombre', etiqueta: 'Nombre', valor: cliente.nombre ?? '' })}
    ${cliente.id ? campoInterruptor({
      nombre: 'archivado', etiqueta: 'Archivado', activo: Boolean(cliente.archivado),
      ayuda: 'Deja de ofrecerse al registrar, sin tocar sus operaciones.',
    }) : ''}`;
}

export function abrirFormCliente(cliente, { alGuardar }) {
  abrirSheetFormulario({
    titulo: cliente.id ? 'Editar cliente' : 'Nuevo cliente',
    id: 'form-cliente',
    cuerpo: campos(cliente),
    textoGuardar: cliente.id ? 'Guardar' : 'Crear cliente',
    alGuardar: (datos) => {
      const nombre = datos.nombre.trim();
      if (!nombre) throw new Error('Ponle un nombre al cliente.');
      if (nombre.length > 100) throw new Error('El nombre es muy largo (máximo 100).');
      return alGuardar({
        nombre,
        ...(cliente.id ? { archivado: Boolean(datos.archivado) } : {}),
      });
    },
  });
}

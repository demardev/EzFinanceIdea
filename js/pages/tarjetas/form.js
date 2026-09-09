/* Bottom sheet de crear/editar tarjeta. */

import { abrirSheetFormulario } from '../../ui/sheet-formulario.js';
import { campoTexto, campoMonto, campoSelect, campoInterruptor } from '../../ui/campos.js';
import { redondear } from '../../calc/dinero.js';

const DIAS = Array.from({ length: 31 }, (_, i) => [String(i + 1), String(i + 1)]);

function campos(t, cuentas) {
  return `
    ${campoTexto({ nombre: 'nombre', etiqueta: 'Nombre', valor: t.nombre ?? '' })}
    ${campoTexto({ nombre: 'banco', etiqueta: 'Banco', valor: t.banco ?? '', requerido: false })}
    ${campoTexto({ nombre: 'ultimos_4', etiqueta: 'Últimos 4 dígitos',
                   valor: t.ultimos_4 ?? '', requerido: false })}
    ${campoMonto({ nombre: 'limite_credito', etiqueta: 'Límite de crédito',
                   valor: t.limite_credito ?? 0 })}
    ${campoSelect({ nombre: 'dia_corte', etiqueta: 'Día de corte',
                    valor: String(t.dia_corte ?? 15), opciones: DIAS })}
    ${campoSelect({ nombre: 'dia_limite_pago', etiqueta: 'Día límite de pago',
                    valor: String(t.dia_limite_pago ?? 5), opciones: DIAS })}
    ${campoSelect({ nombre: 'cuenta_pago_id', etiqueta: 'Cuenta con la que pagas',
                    valor: t.cuenta_pago_id ?? '',
                    opciones: [['', 'Ninguna'], ...cuentas.map((c) => [c.id, c.nombre])] })}
    ${t.id ? campoInterruptor({
      nombre: 'archivada', etiqueta: 'Archivada', activo: Boolean(t.archivada),
      ayuda: 'Se oculta sin borrar su historial.',
    }) : ''}`;
}

function aFila(datos, tarjeta) {
  return {
    nombre: datos.nombre.trim(),
    banco: datos.banco.trim() || null,
    ultimos_4: datos.ultimos_4.trim() || null,
    limite_credito: redondear(datos.limite_credito || 0),
    dia_corte: Number(datos.dia_corte),
    dia_limite_pago: Number(datos.dia_limite_pago),
    cuenta_pago_id: datos.cuenta_pago_id || null,
    ...(tarjeta.id ? { archivada: Boolean(datos.archivada) } : {}),
  };
}

export function abrirFormTarjeta(tarjeta, cuentas, { alGuardar, alEliminar }) {
  abrirSheetFormulario({
    titulo: tarjeta.id ? 'Editar tarjeta' : 'Nueva tarjeta',
    id: 'form-tarjeta',
    cuerpo: campos(tarjeta, cuentas),
    textoGuardar: tarjeta.id ? 'Guardar' : 'Crear tarjeta',
    textoBorrar: tarjeta.id ? 'Eliminar tarjeta' : '',
    alEliminar: tarjeta.id ? alEliminar : null,
    alGuardar: (datos) => {
      if (!datos.nombre.trim()) throw new Error('Ponle un nombre a la tarjeta.');
      return alGuardar(aFila(datos, tarjeta));
    },
  });
}

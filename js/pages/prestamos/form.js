/* Sheet para crear o editar un préstamo. El total se puede dejar en $0.00:
   entonces es el pago por el número de pagos (calc/prestamos.js). */

import { abrirSheetFormulario } from '../../ui/sheet-formulario.js';
import { campoTexto, campoMonto, campoSelect } from '../../ui/campos.js';
import { totalDe, validarPrestamo } from '../../calc/prestamos.js';
import { redondear } from '../../calc/dinero.js';

const OPCIONES_DIRECCION = [['debo', 'Yo debo'], ['me_deben', 'Me deben']];

function campos(p) {
  return `
    ${campoSelect({ nombre: 'direccion', etiqueta: '¿Quién le debe a quién?',
                    valor: p.direccion ?? 'debo', opciones: OPCIONES_DIRECCION })}
    ${campoTexto({ nombre: 'persona', etiqueta: 'Con quién', valor: p.persona ?? '' })}
    ${campoTexto({ nombre: 'concepto', etiqueta: 'De qué es', valor: p.concepto ?? '',
                   requerido: false })}
    ${campoMonto({ nombre: 'pago', etiqueta: 'Pago al mes', valor: p.pago ?? 0,
                   ayuda: 'El que pactaron, o el mínimo. Déjalo en $0.00 si no hay fecha fija.' })}
    ${campoTexto({ nombre: 'num_pagos', etiqueta: 'Número de pagos', valor: p.num_pagos ?? '',
                   tipo: 'number', requerido: false })}
    ${campoMonto({ nombre: 'monto_total', etiqueta: 'Total', valor: p.monto_total ?? 0,
                   ayuda: 'En $0.00 se calcula: pago al mes por número de pagos.' })}
    ${campoTexto({ nombre: 'primer_pago', etiqueta: 'Fecha del primer pago',
                   valor: p.primer_pago ?? '', tipo: 'date', requerido: false })}
    ${campoTexto({ nombre: 'nota', etiqueta: 'Nota', valor: p.nota ?? '', requerido: false })}`;
}

/** Del formulario a la fila: números como número, vacíos como null. */
function aFila(d) {
  const pago = Number(d.pago) > 0 ? redondear(d.pago) : null;
  return {
    direccion: d.direccion,
    persona: d.persona.trim(),
    concepto: String(d.concepto || '').trim() || null,
    monto_total: totalDe(d),
    pago,
    num_pagos: Number(d.num_pagos) > 0 ? Math.round(Number(d.num_pagos)) : null,
    primer_pago: pago ? d.primer_pago : (d.primer_pago || null),
    nota: String(d.nota || '').trim() || null,
  };
}

/**
 * @param prestamo  {} para uno nuevo, o el que se edita
 * @param acciones  { alGuardar(fila), alEliminar() }
 */
export function abrirFormPrestamo(prestamo, { alGuardar, alEliminar }) {
  const editando = Boolean(prestamo?.id);
  abrirSheetFormulario({
    titulo: editando ? 'Editar préstamo' : 'Nuevo préstamo',
    id: 'form-prestamo',
    cuerpo: campos(prestamo ?? {}),
    textoGuardar: editando ? 'Guardar' : 'Crear préstamo',
    textoBorrar: editando ? 'Eliminar préstamo' : '',
    alGuardar: async (datos) => {
      const problema = validarPrestamo(datos);
      if (problema) throw new Error(problema);
      await alGuardar(aFila(datos));
    },
    alEliminar,
  });
}

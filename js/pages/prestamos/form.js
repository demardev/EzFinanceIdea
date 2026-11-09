/* Sheet para crear o editar un préstamo, por secciones (form-campos.js).
   Aquí se engancha lo que cambia al elegir y se pasa del formulario a la
   fila. El total se puede dejar en $0.00: entonces es el pago por el número
   de pagos (calc/prestamos.js). */

import { abrirSheetFormulario } from '../../ui/sheet-formulario.js';
import { datosDe } from '../../ui/campos.js';
import { conectarPastillas } from '../../ui/pastillas.js';
import { textoMonto } from '../../ui/privacidad.js';
import { totalDe, validarPrestamo, cuentasDelFormulario } from '../../calc/prestamos.js';
import { redondear } from '../../calc/dinero.js';
import { camposPrestamo } from './form-campos.js';

/* Lo escondido no cuenta: sin fecha fija no hay pago al mes, y sin
   "ya hubo pagos" no hay nada abonado antes. */
function limpiar(d) {
  const libre = d.forma === 'libre';
  return {
    ...d,
    pago: libre ? 0 : d.pago,
    num_pagos: libre ? '' : d.num_pagos,
    primer_pago: libre ? '' : d.primer_pago,
    abonado_antes: d.hubo_pagos ? d.abonado_antes : 0,
  };
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
    abonado_antes: Number(d.abonado_antes) > 0 ? redondear(d.abonado_antes) : 0,
    nota: String(d.nota || '').trim() || null,
  };
}

/* La línea de abajo del total: cuánto es y, si ya hubo pagos, cuánto falta. */
function pintarTotal(form) {
  const d = limpiar(datosDe(form));
  const { total, falta } = cuentasDelFormulario(d);
  const linea = form.querySelector('[data-total]');
  if (!(total > 0)) { linea.textContent = ''; return; }
  linea.textContent = Number(d.abonado_antes) > 0
    ? `Total ${textoMonto(total)} · falta ${textoMonto(falta)}`
    : `Total ${textoMonto(total)}`;
}

function conectar(form) {
  const caja = form.querySelector('.form-prestamo');
  form.querySelectorAll('[data-elegir]').forEach((grupo) => {
    conectarPastillas(grupo, (valor) => {
      const campo = grupo.dataset.elegir;
      form.querySelector(`input[name="${campo}"]`).value = valor;
      caja.dataset[campo] = valor;
      grupo.querySelectorAll('.pastilla').forEach((b) =>
        b.classList.toggle('activa', b.dataset.pastilla === valor));
      pintarTotal(form);
    });
  });
  form.querySelector('input[name="hubo_pagos"]').addEventListener('change', (e) => {
    form.querySelector('[data-ya-pagado]').hidden = !e.target.checked;
    pintarTotal(form);
  });
  form.addEventListener('input', () => pintarTotal(form));
  pintarTotal(form);
}

/**
 * @param prestamo  {} para uno nuevo, o el que se edita
 * @param acciones  { alGuardar(fila), alEliminar() }
 */
export function abrirFormPrestamo(prestamo, { alGuardar, alEliminar }) {
  const p = prestamo ?? {};
  const editando = Boolean(p.id);
  abrirSheetFormulario({
    titulo: editando ? 'Editar préstamo' : 'Nuevo préstamo',
    id: 'form-prestamo',
    cuerpo: camposPrestamo({ ...p, direccion: p.direccion ?? 'debo',
                             forma: editando && !(p.pago > 0) ? 'libre' : 'cuotas',
                             abonado_antes: Number(p.abonado_antes) || 0 }),
    textoGuardar: editando ? 'Guardar' : 'Crear préstamo',
    textoBorrar: editando ? 'Eliminar préstamo' : '',
    alGuardar: async (datos) => {
      const limpio = limpiar(datos);
      const problema = validarPrestamo(limpio);
      if (problema) throw new Error(problema);
      await alGuardar(aFila(limpio));
    },
    alEliminar,
    alPintar: (hoja, form) => conectar(form),
  });
}

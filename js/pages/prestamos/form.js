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

/* Lo elegido solo cuenta con "ya hubo pagos" encendido. */
const ligadoDe = (d, eleccion) => (d.hubo_pagos ? eleccion.total : 0);

/* La línea de abajo del total: cuánto es y, si ya hubo pagos, cuánto falta. */
function pintarTotal(form, eleccion) {
  const d = limpiar(datosDe(form));
  const ligado = ligadoDe(d, eleccion);
  const { total, falta } = cuentasDelFormulario({ ...d, ligado });
  const linea = form.querySelector('[data-total]');
  if (!(total > 0)) { linea.textContent = ''; return; }
  linea.textContent = Number(d.abonado_antes) > 0 || ligado > 0
    ? `Total ${textoMonto(total)} · falta ${textoMonto(falta)}`
    : `Total ${textoMonto(total)}`;
}

function pintarElegidos(form, eleccion) {
  const linea = form.querySelector('[data-elegidos]');
  if (!linea) return;
  const n = eleccion.ids.length;
  linea.textContent = n ? `${n} elegido${n === 1 ? '' : 's'} · ${textoMonto(eleccion.total)}` : '';
  form.querySelector('[data-elegir-movs]').textContent = n ? 'Cambiar los elegidos' : 'Elegir movimientos';
}

/* Abre la hoja de elegir encima del formulario. Lo de antes queda marcado. */
function conectarElegir(form, eleccion, elegir, repintar) {
  form.querySelector('[data-elegir-movs]')?.addEventListener('click', () => {
    const d = limpiar(datosDe(form));
    const { falta } = cuentasDelFormulario(d);
    elegir({ direccion: d.direccion, restante: falta, yaElegidos: eleccion.ids,
             alElegir: async (ids, total) => { Object.assign(eleccion, { ids, total }); repintar(); } });
  });
}

function conectar(form, eleccion, elegir) {
  const repintar = () => { pintarElegidos(form, eleccion); pintarTotal(form, eleccion); };
  const caja = form.querySelector('.form-prestamo');
  form.querySelectorAll('[data-elegir]').forEach((grupo) => {
    conectarPastillas(grupo, (valor) => {
      const campo = grupo.dataset.elegir;
      form.querySelector(`input[name="${campo}"]`).value = valor;
      caja.dataset[campo] = valor;
      grupo.querySelectorAll('.pastilla').forEach((b) =>
        b.classList.toggle('activa', b.dataset.pastilla === valor));
      /* Gastos e ingresos no se mezclan: al cambiar de dirección se suelta. */
      if (campo === 'direccion') Object.assign(eleccion, { ids: [], total: 0 });
      repintar();
    });
  });
  form.querySelector('input[name="hubo_pagos"]').addEventListener('change', (e) => {
    form.querySelector('[data-ya-pagado]').hidden = !e.target.checked;
    repintar();
  });
  form.addEventListener('input', repintar);
  conectarElegir(form, eleccion, elegir, repintar);
  repintar();
}

/**
 * @param prestamo  {} para uno nuevo, o el que se edita
 * @param acciones  { alGuardar(fila, idsParaLigar), alEliminar(), elegir(opciones) }
 *                  `elegir` abre la hoja de elegir movimientos (ligar.js)
 */
export function abrirFormPrestamo(prestamo, { alGuardar, alEliminar, elegir }) {
  const p = prestamo ?? {};
  const editando = Boolean(p.id);
  const eleccion = { ids: [], total: 0 };
  abrirSheetFormulario({
    titulo: editando ? 'Editar préstamo' : 'Nuevo préstamo',
    id: 'form-prestamo',
    cuerpo: camposPrestamo({ ...p, direccion: p.direccion ?? 'debo', creando: !editando,
                             forma: editando && !(p.pago > 0) ? 'libre' : 'cuotas',
                             abonado_antes: Number(p.abonado_antes) || 0 }),
    textoGuardar: editando ? 'Guardar' : 'Crear préstamo',
    textoBorrar: editando ? 'Eliminar préstamo' : '',
    alGuardar: async (datos) => {
      const limpio = limpiar(datos);
      const problema = validarPrestamo(limpio);
      if (problema) throw new Error(problema);
      await alGuardar(aFila(limpio), limpio.hubo_pagos ? eleccion.ids : []);
    },
    alEliminar,
    alPintar: (hoja, form) => conectar(form, eleccion, elegir),
  });
}

/* Formulario de pago de recibo. Trae puestas las cuentas y la comisión que
   configuraste, y solo las cambias cuando ese día fue distinto. */

import { abrirSheetFormulario } from '../../ui/sheet-formulario.js';
import { campoMonto, campoSelect, campoTexto, campoInterruptor } from '../../ui/campos.js';
import { campoFoto, conectarFoto } from '../../ui/foto.js';
import { hoyISO } from '../../calc/fechas.js';
import { redondear } from '../../calc/dinero.js';

function opcionesCuenta(cuentas) {
  return [['', 'Elige una cuenta'], ...cuentas.map((c) => [c.id, c.nombre])];
}

function campos(pago, { cuentas, perfil }) {
  const cobrado = Boolean(pago.fecha_cobro);
  return `
    ${campoMonto({ nombre: 'monto_recibo', etiqueta: 'Monto del recibo',
                   valor: pago.monto_recibo ?? '' })}
    ${campoMonto({ nombre: 'comision', etiqueta: 'Comisión',
                   valor: pago.comision ?? perfil.comision_default ?? 0 })}
    ${campoTexto({ nombre: 'fecha_pago', etiqueta: 'Día que pagaste el recibo',
                   valor: pago.fecha_pago ?? hoyISO(), tipo: 'date' })}
    ${campoSelect({ nombre: 'cuenta_pago_id', etiqueta: 'Pagado desde',
                    valor: pago.cuenta_pago_id ?? perfil.cuenta_pago_id ?? '',
                    opciones: opcionesCuenta(cuentas) })}

    ${campoInterruptor({ nombre: 'cobrado', etiqueta: 'Ya me pagaron', activo: cobrado,
                         ayuda: 'Si no, queda pendiente de cobro y se registra solo la salida.' })}
    <div data-solo-cobrado ${cobrado ? '' : 'hidden'}>
      ${campoTexto({ nombre: 'fecha_cobro', etiqueta: 'Día que te pagaron',
                     valor: pago.fecha_cobro ?? hoyISO(), tipo: 'date' })}
      ${campoSelect({ nombre: 'cuenta_cobro_id', etiqueta: 'Cobrado en',
                      valor: pago.cuenta_cobro_id ?? perfil.cuenta_cobro_id ?? '',
                      opciones: opcionesCuenta(cuentas) })}
    </div>

    ${campoTexto({ nombre: 'nota', etiqueta: 'Nota', valor: pago.nota ?? '', requerido: false })}
    ${campoFoto({})}`;
}

/** Los campos del cobro solo estorban mientras no te hayan pagado. */
function conectarCobrado(hoja, form) {
  const interruptor = form.querySelector('[name="cobrado"]');
  const caja = form.querySelector('[data-solo-cobrado]');
  const aplicar = () => { caja.hidden = !interruptor.checked; };
  interruptor.addEventListener('change', aplicar);
  aplicar();
}

function aFila(d) {
  const cobrado = Boolean(d.cobrado);
  return {
    monto_recibo: redondear(d.monto_recibo),
    comision: redondear(d.comision || 0),
    fecha_pago: d.fecha_pago,
    cuenta_pago_id: d.cuenta_pago_id || null,
    fecha_cobro: cobrado ? d.fecha_cobro : null,
    cuenta_cobro_id: cobrado ? (d.cuenta_cobro_id || null) : null,
    nota: d.nota.trim() || null,
  };
}

function validar(d) {
  if (!(d.monto_recibo > 0)) throw new Error('Pon el monto del recibo.');
  if (!d.cuenta_pago_id) throw new Error('Elige de qué cuenta salió el pago.');
  if (d.cobrado && !d.cuenta_cobro_id) throw new Error('Elige en qué cuenta te pagaron.');
  if (d.cobrado && d.fecha_cobro < d.fecha_pago) {
    throw new Error('No te pueden haber pagado antes de que pagaras el recibo.');
  }
}

/** @param alGuardar (fila, foto) */
export function abrirFormPago(pago, datos, { alGuardar, alEliminar, urlFoto = null }) {
  let foto = null;

  abrirSheetFormulario({
    titulo: pago.id ? 'Editar pago de recibo' : 'Pago de recibo',
    id: 'form-pago-recibo',
    cuerpo: campos(pago, datos),
    textoGuardar: pago.id ? 'Guardar' : 'Registrar',
    textoBorrar: pago.id ? 'Eliminar operación' : '',
    alEliminar: pago.id ? alEliminar : null,
    alPintar: (hoja, form) => {
      conectarCobrado(hoja, form);
      conectarFoto(hoja, { alCambiar: (blob) => { foto = blob; }, urlPrevia: urlFoto });
    },
    alGuardar: (d) => { validar(d); return alGuardar(aFila(d), foto); },
  });
}

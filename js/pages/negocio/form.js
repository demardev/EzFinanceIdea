/* Formulario de pago de recibo. Trae puestas las cuentas y la comisión que
   configuraste, y solo las cambias cuando ese día fue distinto. */

import { abrirSheetFormulario } from '../../ui/sheet-formulario.js';
import { campoMonto, campoSelect, campoTexto, campoInterruptor } from '../../ui/campos.js';
import { campoFoto, conectarFoto } from '../../ui/foto.js';
import { hoyISO } from '../../calc/fechas.js';
import { redondear } from '../../calc/dinero.js';
import { abonosDe, agregarAbono, conAbonos, problemaDeAbonos, saldoDe } from '../../negocio/abonos.js';
import { opcionesCuenta, mostrarCon, camposAbono, conectarAbono, abonoDeDatos,
         listaAbonos, conectarListaAbonos } from './campos-abono.js';

/* Una operación nueva pregunta si ya te pagaron; una con abonos los enseña
   y deja registrar otro mientras falte algo. */
function seccionCobro(pago, { cuentas, perfil }) {
  const abonos = abonosDe(pago);
  const puedeAbonar = !abonos.length || saldoDe(pago) > 0;
  return `
    ${listaAbonos(pago, abonos, cuentas)}
    <div ${puedeAbonar ? '' : 'hidden'}>
      ${campoInterruptor({ nombre: 'cobrado',
                           etiqueta: abonos.length ? 'Registrar otro abono' : 'Ya me pagaron',
                           ayuda: abonos.length ? 'Lo que te pagaron después.'
                             : 'Si no, queda pendiente de cobro y se registra solo la salida.' })}
    </div>
    <div data-solo-cobrado hidden>
      ${camposAbono({ cuentas, cuentaId: perfil.cuenta_cobro_id ?? '' })}
    </div>`;
}

function campos(pago, { cuentas, perfil }) {
  return `
    ${campoTexto({ nombre: 'descripcion', etiqueta: 'Descripción',
                   valor: pago.descripcion ?? '',
                   ayuda: 'De quién es el recibo. Es por donde lo vas a buscar después.' })}
    <div class="campo-fila">
      ${campoMonto({ nombre: 'monto_recibo', etiqueta: 'Monto del recibo',
                     valor: pago.monto_recibo ?? '' })}
      ${campoMonto({ nombre: 'comision', etiqueta: 'Comisión',
                     valor: pago.comision ?? perfil.comision_default ?? 0 })}
    </div>
    <div class="campo-fila">
      ${campoTexto({ nombre: 'fecha_pago', etiqueta: 'Día del pago',
                     valor: pago.fecha_pago ?? hoyISO(), tipo: 'date' })}
      ${campoSelect({ nombre: 'cuenta_pago_id', etiqueta: 'Pagado desde',
                      valor: pago.cuenta_pago_id ?? perfil.cuenta_pago_id ?? '',
                      opciones: opcionesCuenta(cuentas) })}
    </div>

    ${seccionCobro(pago, { cuentas, perfil })}

    ${campoTexto({ nombre: 'nota', etiqueta: 'Nota', valor: pago.nota ?? '', requerido: false })}
    ${campoFoto({})}`;
}

function aFila(d) {
  return {
    descripcion: d.descripcion.trim(),
    monto_recibo: redondear(d.monto_recibo),
    comision: redondear(d.comision || 0),
    fecha_pago: d.fecha_pago,
    cuenta_pago_id: d.cuenta_pago_id || null,
    nota: d.nota.trim() || null,
  };
}

function validar(d) {
  if (!d.descripcion.trim()) throw new Error('Ponle una descripción, el nombre del cliente.');
  if (!(d.monto_recibo > 0)) throw new Error('Pon el monto del recibo.');
  if (!d.cuenta_pago_id) throw new Error('Elige de qué cuenta salió el pago.');
}

/** La fila con sus abonos: los que quedaron y, si lo hay, el nuevo. */
function conSusAbonos(d, abonosQuedan) {
  const fila = conAbonos(aFila(d), abonosQuedan);
  const lista = d.cobrado ? agregarAbono(fila, abonoDeDatos(d)) : fila;
  const problema = problemaDeAbonos(lista);
  if (problema) throw new Error(problema);
  return lista;
}

/** @param alGuardar (fila, foto): foto es un Blob, null si la quitaron o
 *  undefined si no la tocaron. */
export function abrirFormPago(pago, datos, { alGuardar, alEliminar, urlFoto = null }) {
  let foto;
  let abonosQuedan = () => abonosDe(pago);

  abrirSheetFormulario({
    titulo: pago.id ? 'Editar pago de recibo' : 'Pago de recibo',
    id: 'form-pago-recibo',
    cuerpo: campos(pago, datos),
    textoGuardar: pago.id ? 'Guardar' : 'Registrar',
    textoBorrar: pago.id ? 'Eliminar operación' : '',
    alEliminar: pago.id ? alEliminar : null,
    alPintar: (hoja, form) => {
      mostrarCon(form, 'cobrado', '[data-solo-cobrado]');
      conectarAbono(form);
      abonosQuedan = conectarListaAbonos(form, pago, abonosDe(pago));
      conectarFoto(hoja, { alCambiar: (blob) => { foto = blob; }, urlPrevia: urlFoto });
    },
    alGuardar: (d) => {
      validar(d);
      return alGuardar(conSusAbonos(d, abonosQuedan()), foto);
    },
  });
}

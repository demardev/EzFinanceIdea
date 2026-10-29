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

function ayudaCobro(abonos, conCliente) {
  if (abonos.length) return 'Lo que te pagaron después.';
  return conCliente ? 'Si no, queda pendiente.'
    : 'Si no, queda pendiente de cobro y se registra solo la salida.';
}

/* Una operación nueva pregunta si ya te pagaron; una con abonos los enseña
   y deja registrar otro mientras falte algo. El cliente va a la par: las dos
   cosas se deciden juntas al registrar. */
function seccionCobro(pago, { cuentas, perfil, clientes = [] }) {
  const abonos = abonosDe(pago);
  const puedeAbonar = !abonos.length || saldoDe(pago) > 0;
  const cliente = campoCliente(pago, clientes);
  const interruptor = `
    <div ${puedeAbonar ? '' : 'hidden'}>
      ${campoInterruptor({ nombre: 'cobrado',
                           etiqueta: abonos.length ? 'Registrar otro abono' : 'Ya me pagaron',
                           ayuda: ayudaCobro(abonos, Boolean(cliente)) })}
    </div>`;
  return `
    ${listaAbonos(pago, abonos, cuentas)}
    ${cliente ? `<div class="campo-fila fila-cliente-cobro">${cliente}${interruptor}</div>` : interruptor}
    <div data-solo-cobrado hidden>
      ${camposAbono({ cuentas, cuentaId: perfil.cuenta_cobro_id ?? '' })}
    </div>`;
}

/* Se ofrecen los activos; si la operación es de uno ya archivado, también
   ese, para que editarla no le quite el cliente. Sin clientes no hay campo. */
function campoCliente(pago, clientes) {
  const ofrecidos = clientes.filter((c) => !c.archivado || c.id === pago.cliente_id);
  if (!ofrecidos.length) return '';
  return campoSelect({ nombre: 'cliente_id', etiqueta: 'Cliente', valor: pago.cliente_id ?? '',
                       opciones: [['', 'Sin cliente'], ...ofrecidos.map((c) => [c.id, c.nombre])] });
}

/* Sin cliente el select resalta en amarillo, para que no se olvide. */
function resaltarSinCliente(form) {
  const select = form.querySelector('[name="cliente_id"]');
  if (!select) return;
  const aplicar = () => select.classList.toggle('sin-elegir', !select.value);
  select.addEventListener('change', aplicar);
  aplicar();
}

function campos(pago, { cuentas, perfil, clientes = [] }) {
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

    ${seccionCobro(pago, { cuentas, perfil, clientes })}

    ${campoTexto({ nombre: 'nota', etiqueta: 'Nota', valor: pago.nota ?? '', requerido: false })}
    ${campoFoto({})}`;
}

function aFila(d) {
  return {
    descripcion: d.descripcion.trim(),
    cliente_id: d.cliente_id || null,
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
      resaltarSinCliente(form);
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

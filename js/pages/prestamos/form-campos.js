/* Las secciones del formulario de préstamo. Solo pinta: lo que cambia con
   la dirección o la forma de pago se esconde por CSS (.solo-debo,
   .solo-me_deben, .solo-cuotas), así que no hay que repintar al elegir. */

import { campoTexto, campoMonto } from '../../ui/campos.js';
import { pastillas } from '../../ui/pastillas.js';
import { escapar } from '../../ui/texto.js';

/* Un texto para cada dirección: el formulario enseña uno u otro. */
const segun = (debo, meDeben) =>
  `<span class="solo-debo">${debo}</span><span class="solo-me_deben">${meDeben}</span>`;

function seccion(titulo, cuerpo, ayuda = '') {
  return `
    <div class="form-seccion pila-sm">
      <p class="seccion-titulo" style="margin:0">${titulo}</p>
      ${ayuda ? `<p class="tenue" style="font-size:13px">${ayuda}</p>` : ''}
      ${cuerpo}
    </div>`;
}

function quien(p) {
  return seccion('¿Quién le debe a quién?', `
    <input type="hidden" name="direccion" value="${escapar(p.direccion)}">
    <div data-elegir="direccion">${pastillas({ opciones: [['debo', 'Yo debo'], ['me_deben', 'Me deben']],
                                               valor: p.direccion })}</div>
    <p class="tenue" style="font-size:13px">${segun(
      'Le debes a alguien: lo que le pagues sale de tus cuentas.',
      'Alguien te debe: lo que te pague entra a tus cuentas.')}</p>`);
}

function conQuien(p) {
  return seccion('Con quién', `
    <div class="campo-fila">
      ${campoTexto({ nombre: 'persona', etiqueta: 'Persona', valor: p.persona ?? '' })}
      ${campoTexto({ nombre: 'concepto', etiqueta: 'De qué es (opcional)',
                     valor: p.concepto ?? '', requerido: false })}
    </div>`);
}

function cuotas(p) {
  return `
    <div class="solo-cuotas pila-sm">
      <div class="campo-fila">
        ${campoMonto({ nombre: 'pago', etiqueta: 'Pago al mes', valor: p.pago ?? 0 })}
        ${campoTexto({ nombre: 'num_pagos', etiqueta: 'Número de pagos (opcional)',
                       valor: p.num_pagos ?? '', tipo: 'number', requerido: false })}
      </div>
      ${campoTexto({ nombre: 'primer_pago', etiqueta: 'Fecha del primer pago',
                     valor: p.primer_pago ?? '', tipo: 'date', requerido: false })}
      <p class="tenue-2" style="font-size:12.5px">El pago al mes es el que pactaron, o el
        mínimo. Con él la app avisa unos días antes de cada pago y dice si hay atraso.</p>
    </div>`;
}

function cuantoYComo(p) {
  return seccion('Cuánto y cómo se paga', `
    <input type="hidden" name="forma" value="${escapar(p.forma)}">
    <div data-elegir="forma">${pastillas({ opciones: [['cuotas', 'Pagos al mes'],
                                                      ['libre', 'Sin fecha fija']],
                                           valor: p.forma })}</div>
    ${cuotas(p)}
    ${campoMonto({ nombre: 'monto_total', etiqueta: 'Total del préstamo', valor: p.monto_total ?? 0 })}
    <p class="tenue-2 solo-cuotas" style="font-size:12.5px">Si lo dejas en $0.00 se calcula:
      pago al mes por número de pagos.</p>
    <p class="tenue-2 solo-libre" style="font-size:12.5px">Sin fecha fija solo se lleva lo que
      falta: no hay avisos ni atrasos.</p>
    <p class="form-total" data-total></p>`);
}

function yaPagado(p) {
  return seccion('¿Ya hubo pagos?', `
    <label class="interruptor">
      <input type="checkbox" name="hubo_pagos" ${p.abonado_antes > 0 ? 'checked' : ''}>
      <span class="crece">${segun('Ya le pagué algo', 'Ya me pagó algo')}<br>
        <span class="tenue-2" style="font-size:12.5px">Antes de anotarlo aquí.</span></span>
    </label>
    <div class="pila-sm" data-ya-pagado ${p.abonado_antes > 0 ? '' : 'hidden'}>
      ${campoMonto({ nombre: 'abonado_antes', etiqueta: 'Cuánto, en total', valor: p.abonado_antes ?? 0 })}
      <p class="nota">No se crea ningún movimiento: ese dinero se movió antes y ya está en
        tus saldos. Solo cuenta para lo que falta. Lo que ${segun('pagues', 'te pague')} de
        aquí en adelante lo registras con <strong>${segun('Registrar pago', 'Registrar cobro')}</strong>.</p>
    </div>`, 'Si el préstamo ya venía de antes, pon lo que ya se abonó.');
}

/** @param p el préstamo, con `forma` ('cuotas' | 'libre') ya decidida */
export function camposPrestamo(p) {
  return `
    <div class="form-prestamo pila" data-direccion="${escapar(p.direccion)}"
         data-forma="${escapar(p.forma)}">
      ${quien(p)}
      ${conQuien(p)}
      ${cuantoYComo(p)}
      ${yaPagado(p)}
      ${seccion('Nota', campoTexto({ nombre: 'nota', etiqueta: 'Algo que quieras recordar (opcional)',
                                      valor: p.nota ?? '', requerido: false }))}
    </div>`;
}

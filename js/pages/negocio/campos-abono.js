/* Los campos de un abono —día, cuenta y cuánto— y la lista de los que ya
   tiene una operación. Los comparten el formulario de la operación y el cobro
   de "Por cobrar". Las cuentas de dinero las hace negocio/abonos.js. */

import { campoInterruptor, campoMonto, campoSelect, campoTexto } from '../../ui/campos.js';
import { textoMonto } from '../../ui/privacidad.js';
import { escapar } from '../../ui/texto.js';
import { icono } from '../../iconos/render.js';
import { formatearFecha, hoyISO } from '../../calc/fechas.js';
import { redondear } from '../../calc/dinero.js';
import { conAbonos, saldoDe } from '../../negocio/abonos.js';

export function opcionesCuenta(cuentas) {
  return [['', 'Elige una cuenta'], ...cuentas.map((c) => [c.id, c.nombre])];
}

/** Enseña `caja` solo mientras el interruptor `nombre` está encendido. */
export function mostrarCon(raiz, nombre, caja) {
  const interruptor = raiz.querySelector(`[name="${nombre}"]`);
  const destino = raiz.querySelector(caja);
  const aplicar = () => { destino.hidden = !interruptor.checked; };
  interruptor.addEventListener('change', aplicar);
  aplicar();
}

/* Lo normal es que te paguen todo, así que el monto solo aparece si fue una
   parte: sin tocarlo se abona lo que falte, con la comisión como quede. */
export function camposAbono({ cuentas, cuentaId = '' }) {
  return `
    <div class="campo-fila">
      ${campoTexto({ nombre: 'abono_fecha', etiqueta: 'Día que te pagaron',
                     valor: hoyISO(), tipo: 'date' })}
      ${campoSelect({ nombre: 'abono_cuenta', etiqueta: 'Cobrado en', valor: cuentaId,
                      opciones: opcionesCuenta(cuentas) })}
    </div>
    ${campoInterruptor({ nombre: 'abono_parcial', etiqueta: 'Fue solo una parte',
                         ayuda: 'Si no, se registra todo lo que falta.' })}
    <div data-solo-parcial hidden>
      ${campoMonto({ nombre: 'abono_monto', etiqueta: 'Cuánto te pagaron', valor: '',
                     ayuda: 'Lo demás queda pendiente de cobro.' })}
    </div>`;
}

export function conectarAbono(raiz) {
  mostrarCon(raiz, 'abono_parcial', '[data-solo-parcial]');
}

/** El abono tal como vino del formulario. `monto` null = todo lo que falta. */
export function abonoDeDatos(d) {
  return {
    fecha: d.abono_fecha,
    cuenta_id: d.abono_cuenta || null,
    monto: d.abono_parcial ? redondear(d.abono_monto) : null,
  };
}

/* ------------------------------------------------ abonos ya registrados --- */

function filaAbono(abono, i, nombreCuenta) {
  return `
    <div class="lista-fila" data-abono="${i}">
      <span class="crece" style="min-width:0">
        <span class="titulo monto" style="display:block">${textoMonto(abono.monto)}</span>
        <span class="sub">${formatearFecha(abono.fecha)} · ${escapar(nombreCuenta(abono.cuenta_id))}</span>
      </span>
      <button type="button" class="icono-btn" data-quitar-abono="${i}"
              aria-label="Quitar abono">${icono('x', 18)}</button>
    </div>`;
}

function textoSaldo(pago) {
  const saldo = saldoDe(pago);
  return saldo > 0 ? `Faltan ${textoMonto(saldo)}.` : 'Ya está todo cobrado.';
}

export function listaAbonos(pago, abonos, cuentas) {
  if (!abonos.length) return '';
  const nombreCuenta = (id) => cuentas.find((c) => c.id === id)?.nombre ?? 'Cuenta borrada';
  return `
    <div class="campo" data-abonos>
      <label>Lo que te han pagado</label>
      <div class="lista">${abonos.map((a, i) => filaAbono(a, i, nombreCuenta)).join('')}</div>
      <span class="tenue-2" style="font-size:12.5px" data-saldo>${textoSaldo(pago)}</span>
    </div>`;
}

/**
 * Quitar un abono solo lo esconde: se va de verdad al guardar, y cancelar el
 * formulario lo deja como estaba.
 * @returns () => los abonos que quedan
 */
export function conectarListaAbonos(raiz, pago, abonos) {
  const quitados = new Set();
  const quedan = () => abonos.filter((_, i) => !quitados.has(i));
  raiz.querySelectorAll('[data-quitar-abono]').forEach((boton) => {
    boton.addEventListener('click', () => {
      quitados.add(Number(boton.dataset.quitarAbono));
      boton.closest('[data-abono]').hidden = true;
      raiz.querySelector('[data-saldo]').textContent = textoSaldo(conAbonos(pago, quedan()));
    });
  });
  return quedan;
}

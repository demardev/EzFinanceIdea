/* Contar el efectivo que tienes en la mano y cuadrarlo con lo que la app cree
   que hay. Solo aparece con la bandera de negocio, y solo en cuentas de
   efectivo.

   El ajuste se registra como un movimiento PERSONAL: lo que cuadra es tu
   dinero real, no el flujo del negocio. */

import { abrirSheetFormulario } from '../../ui/sheet-formulario.js';
import { textoMonto } from '../../ui/privacidad.js';
import { escapar } from '../../ui/texto.js';
import { formatear } from '../../calc/dinero.js';
import { DENOMINACIONES, arqueo } from '../../calc/arqueo.js';

/* La denominación se escribe con formatear() y no con textoMonto(): es una
   etiqueta fija, no un dato tuyo que haya que esconder. */
function fila(denominacion) {
  return `
    <div class="arqueo-fila">
      <span class="monto">${formatear(denominacion)}</span>
      <span class="tenue-2">×</span>
      <input type="number" inputmode="numeric" min="0" step="1" placeholder="0"
             data-den="${denominacion}" aria-label="Unidades de ${formatear(denominacion)}">
      <span class="monto tenue" data-sub="${denominacion}">${formatear(0)}</span>
    </div>`;
}

function cuerpo(cuenta, esperado) {
  return `
    <p class="tenue-2" style="font-size:12.5px;margin-bottom:10px">
      Cuenta ${escapar(cuenta.nombre)}. Cuenta las piezas que tienes en la mano.
    </p>
    ${DENOMINACIONES.map(fila).join('')}
    <div class="card pila-sm" id="arqueo-resumen" style="margin-top:14px"></div>`;
}

function leerConteo(form) {
  const conteo = {};
  form.querySelectorAll('[data-den]').forEach((i) => { conteo[i.dataset.den] = i.value; });
  return conteo;
}

function pintarResumen(caja, r) {
  const signo = r.diferencia > 0 ? '+' : r.diferencia < 0 ? '−' : '';
  const acento = r.diferencia === 0 ? 'tenue' : r.diferencia > 0 ? 'pos' : 'neg';
  caja.innerHTML = `
    <div class="fila-entre"><span>Contado</span>
      <span class="monto">${textoMonto(r.contado)}</span></div>
    <div class="fila-entre"><span>Esperado</span>
      <span class="monto tenue">${textoMonto(r.esperado)}</span></div>
    <div class="fila-entre"><span>Diferencia</span>
      <span class="monto ${acento}">${signo}${textoMonto(Math.abs(r.diferencia))}
        ${r.diferencia < 0 ? ' faltan' : r.diferencia > 0 ? ' sobran' : ''}</span></div>`;
}

/** Recalcula en cada tecla: el total, la diferencia y qué dice el botón. */
function conectar(hoja, form, esperado) {
  const caja = hoja.querySelector('#arqueo-resumen');
  const enviar = form.querySelector('button[type="submit"]');
  const refrescar = () => {
    const r = arqueo(leerConteo(form), esperado);
    form.querySelectorAll('[data-sub]').forEach((s) => {
      const piezas = Number(form.querySelector(`[data-den="${s.dataset.sub}"]`).value) || 0;
      s.textContent = formatear(Number(s.dataset.sub) * piezas);
    });
    pintarResumen(caja, r);
    enviar.disabled = !r.ajuste;
    enviar.textContent = r.ajuste
      ? `Registrar ajuste de ${textoMonto(r.ajuste.monto)}`
      : 'Cuadra exacto';
  };
  form.addEventListener('input', refrescar);
  refrescar();
}

/**
 * @param esperado  saldo que la app calcula para esa cuenta, solo con lo que
 *                  ya pasó
 * @param alAjustar (resultado) => Promise, registra el movimiento
 */
export function abrirArqueo(cuenta, { esperado, alAjustar }) {
  /* alGuardar() recibe los datos del formulario, no el formulario: las
     unidades se leen por data-den, así que hay que guardarse la referencia. */
  let formulario = null;

  abrirSheetFormulario({
    titulo: 'Contar efectivo',
    id: 'form-arqueo',
    cuerpo: cuerpo(cuenta, esperado),
    textoGuardar: 'Cuadra exacto',
    alPintar: (hoja, form) => {
      formulario = form;
      conectar(hoja, form, esperado);
    },
    alGuardar: async () => {
      const r = arqueo(leerConteo(formulario), esperado);
      if (!r.ajuste) throw new Error('Cuadra exacto: no hay nada que ajustar.');
      await alAjustar(r);
    },
  });
}

/* Sheet de pago de tarjeta. Un pago ES una transferencia desde una cuenta
   hacia la tarjeta: eso reduce su deuda y resta de la cuenta. */

import { abrirSheetFormulario } from '../../ui/sheet-formulario.js';
import { campoMonto, campoSelect, campoTexto } from '../../ui/campos.js';
import { montoAEntrada, redondear } from '../../calc/dinero.js';
import { hoyISO } from '../../calc/fechas.js';
import { textoMonto } from '../../ui/privacidad.js';

/** La categoría de transferencia que corresponde a pagar una tarjeta. */
function categoriaPago(categorias) {
  return categorias.find(
    (c) => c.tipo === 'transferencia' && /pago de tarjeta/i.test(c.nombre))?.id ?? null;
}

function atajos(deuda) {
  return [
    ['Pagar el corte', deuda.aPagarAhora],
    ['Pagar todo', deuda.deudaTotal],
    ['Otro monto', null],
  ].map(([etiqueta, monto]) => `
    <button class="btn fila-entre" type="button" data-atajo="${monto ?? ''}"
            style="justify-content:space-between">
      <span>${etiqueta}</span>
      <span class="monto">${monto === null ? '' : textoMonto(monto)}</span>
    </button>`).join('');
}

function campos(tarjeta, deuda, cuentas) {
  return `
    <div class="pila-sm" style="margin-bottom:16px">${atajos(deuda)}</div>
    ${campoMonto({ nombre: 'monto', etiqueta: 'Monto a pagar', valor: deuda.aPagarAhora })}
    ${campoTexto({ nombre: 'fecha', etiqueta: 'Fecha', valor: hoyISO(), tipo: 'date' })}
    ${campoSelect({ nombre: 'cuenta_id', etiqueta: 'Sale de',
                    valor: tarjeta.cuenta_pago_id ?? '',
                    opciones: [['', 'Elige una cuenta'],
                               ...cuentas.map((c) => [c.id, c.nombre])] })}`;
}

/** Los botones de monto automático rellenan el campo. */
function conectarAtajos(hoja, form) {
  const campo = form.querySelector('[name="monto"]');
  hoja.querySelectorAll('[data-atajo]').forEach((boton) => {
    boton.addEventListener('click', () => {
      const monto = boton.dataset.atajo;
      campo.value = monto === '' ? '' : montoAEntrada(Number(monto));
      campo.focus();
    });
  });
}

export function abrirSheetPago(tarjeta, deuda, datos, alPagar) {
  abrirSheetFormulario({
    titulo: `Pagar ${tarjeta.nombre}`,
    id: 'form-pago',
    cuerpo: campos(tarjeta, deuda, datos.cuentas),
    textoGuardar: 'Registrar pago',
    alPintar: conectarAtajos,
    alGuardar: (d) => {
      if (!(d.monto > 0)) throw new Error('El monto tiene que ser mayor que cero.');
      if (!d.cuenta_id) throw new Error('Elige de qué cuenta sale el pago.');
      return alPagar({
        tipo: 'transferencia',
        monto: redondear(d.monto),
        fecha: d.fecha,
        descripcion: `Pago ${tarjeta.nombre}`,
        categoria_id: categoriaPago(datos.categorias),
        cuenta_id: d.cuenta_id,
        cuenta_destino_id: null,
        tarjeta_id: null,
        tarjeta_destino_id: tarjeta.id,
      });
    },
  });
}

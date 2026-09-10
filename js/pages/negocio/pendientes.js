/* Lo que pagaste y todavía no te devuelven, con el botón de cobrar.
   Es la lista de trabajo del negocio: mientras algo esté aquí, tu dinero
   está en la calle. */

import { abrirSheet } from '../../ui/sheet.js';
import { abrirSheetFormulario } from '../../ui/sheet-formulario.js';
import { campoMonto, campoSelect, campoTexto } from '../../ui/campos.js';
import { textoMonto } from '../../ui/privacidad.js';
import { escapar } from '../../ui/texto.js';
import { formatearFecha, hoyISO, diasEntre } from '../../calc/fechas.js';
import { redondear } from '../../calc/dinero.js';
import { totalPorCobrar } from '../../negocio/pago-recibo.js';
import { cobrarPago } from './acciones.js';
import { categoriasDeNegocio } from './registrar.js';

function fila(pago) {
  const dias = diasEntre(pago.fecha_pago, hoyISO());
  return `
    <div class="lista-fila">
      <button type="button" class="fila-cuerpo" data-cobrar="${pago.id}">
        <span class="crece" style="min-width:0">
          <span class="titulo truncar" style="display:block">
            ${textoMonto(pago.monto_recibo)}
            <span class="tenue-2">+ ${textoMonto(pago.comision)}</span>
          </span>
          <span class="sub ${dias >= 7 ? 'warn' : ''}">
            ${pago.descripcion ? `${escapar(pago.descripcion)} · ` : ''}pagado ${formatearFecha(pago.fecha_pago)} · hace ${dias} ${dias === 1 ? 'día' : 'días'}
            ${pago.nota ? `· ${escapar(pago.nota)}` : ''}
          </span>
        </span>
        <span class="badge">cobrar</span>
      </button>
    </div>`;
}

/** Pide fecha, cuenta y comisión final; ahí nacen los dos ingresos. */
function abrirCobro(contexto, pago, datos, alCambiar) {
  abrirSheetFormulario({
    titulo: `Cobrar ${textoMonto(pago.monto_recibo)}`,
    id: 'form-cobro',
    cuerpo: `
      ${campoTexto({ nombre: 'fecha', etiqueta: 'Día que te pagaron',
                     valor: hoyISO(), tipo: 'date' })}
      ${campoMonto({ nombre: 'comision', etiqueta: 'Comisión', valor: pago.comision })}
      ${campoSelect({ nombre: 'cuenta', etiqueta: 'Cobrado en',
                      valor: contexto.perfil.cuenta_cobro_id ?? '',
                      opciones: [['', 'Elige una cuenta'],
                                 ...datos.cuentas.map((c) => [c.id, c.nombre])] })}`,
    textoGuardar: 'Registrar cobro',
    alGuardar: async (d) => {
      if (!d.cuenta) throw new Error('Elige en qué cuenta te pagaron.');
      if (d.fecha < pago.fecha_pago) throw new Error('El cobro no puede ser antes del pago.');
      await cobrarPago(contexto, pago, {
        fecha: d.fecha, cuentaId: d.cuenta, comision: redondear(d.comision || 0),
        categorias: categoriasDeNegocio(datos.categorias),
      });
      await alCambiar();
    },
  });
}

export function abrirPendientes(contexto, pendientes, datos, alCambiar) {
  const { hoja, cerrar } = abrirSheet({
    titulo: `Por cobrar · ${textoMonto(totalPorCobrar(pendientes))}`,
    cuerpo: pendientes.length
      ? `<div class="lista">${pendientes.map(fila).join('')}</div>`
      : '<p class="tenue">No te deben nada. Todo cobrado.</p>',
  });

  hoja.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-cobrar]');
    if (!boton) return;
    cerrar();
    abrirCobro(contexto, pendientes.find((p) => p.id === boton.dataset.cobrar),
               datos, alCambiar);
  });
}

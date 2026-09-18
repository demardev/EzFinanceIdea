/* Lo que pagaste y todavía no te devuelven, con el botón de cobrar.
   Es la lista de trabajo del negocio: mientras algo esté aquí, tu dinero
   está en la calle. */

import { abrirSheet } from '../../ui/sheet.js';
import { abrirSheetFormulario } from '../../ui/sheet-formulario.js';
import { campoMonto } from '../../ui/campos.js';
import { textoMonto } from '../../ui/privacidad.js';
import { escapar } from '../../ui/texto.js';
import { formatearFecha, hoyISO, diasEntre } from '../../calc/fechas.js';
import { redondear } from '../../calc/dinero.js';
import { totalPorCobrar } from '../../negocio/pago-recibo.js';
import { cobradoDe, saldoDe, totalDe } from '../../negocio/abonos.js';
import { abonarPago } from './acciones.js';
import { categoriasDeNegocio } from './registrar.js';
import { camposAbono, conectarAbono, abonoDeDatos } from './campos-abono.js';

/* Sin abonos se lee "recibo + comisión"; con alguno, lo que falta de cuánto. */
function cifra(pago) {
  if (cobradoDe(pago) > 0) {
    return `${textoMonto(saldoDe(pago))}
            <span class="tenue-2">faltan de ${textoMonto(totalDe(pago))}</span>`;
  }
  return `${textoMonto(pago.monto_recibo)}
          <span class="tenue-2">+ ${textoMonto(pago.comision)}</span>`;
}

function fila(pago) {
  const dias = diasEntre(pago.fecha_pago, hoyISO());
  return `
    <div class="lista-fila">
      <button type="button" class="fila-cuerpo" data-cobrar="${pago.id}">
        <span class="crece" style="min-width:0">
          <span class="titulo truncar" style="display:block">${cifra(pago)}</span>
          <span class="sub ${dias >= 7 ? 'warn' : ''}">
            ${pago.descripcion ? `${escapar(pago.descripcion)} · ` : ''}pagado ${formatearFecha(pago.fecha_pago)} · hace ${dias} ${dias === 1 ? 'día' : 'días'}
            ${pago.nota ? `· ${escapar(pago.nota)}` : ''}
          </span>
        </span>
        <span class="badge">cobrar</span>
      </button>
    </div>`;
}

/** Pide día, cuenta, si fue solo una parte y la comisión final. */
function abrirCobro(contexto, pago, datos, alCambiar) {
  abrirSheetFormulario({
    titulo: `Cobrar ${textoMonto(saldoDe(pago))}`,
    id: 'form-cobro',
    cuerpo: `
      ${camposAbono({ cuentas: datos.cuentas, cuentaId: contexto.perfil.cuenta_cobro_id ?? '' })}
      ${campoMonto({ nombre: 'comision', etiqueta: 'Comisión', valor: pago.comision })}`,
    textoGuardar: 'Registrar cobro',
    alPintar: (hoja, form) => conectarAbono(form),
    alGuardar: async (d) => {
      await abonarPago(contexto, pago, {
        abono: abonoDeDatos(d), comision: redondear(d.comision || 0),
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

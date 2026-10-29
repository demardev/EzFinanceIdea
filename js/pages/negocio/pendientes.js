/* Lo que pagaste y todavía no te devuelven, con el botón de cobrar.
   Es la lista de trabajo del negocio: mientras algo esté aquí, tu dinero
   está en la calle. */

import { abrirSheet } from '../../ui/sheet.js';
import { abrirSheetFormulario } from '../../ui/sheet-formulario.js';
import { campoMonto } from '../../ui/campos.js';
import { textoMonto } from '../../ui/privacidad.js';
import { redondear } from '../../calc/dinero.js';
import { saldoDe } from '../../negocio/abonos.js';
import { porCobrarPorCliente } from '../../negocio/por-cliente.js';
import { cuerpoPendientes } from './pendientes-vista.js';
import { abonarPago } from './acciones.js';
import { categoriasDeNegocio } from './registrar.js';
import { camposAbono, conectarAbono, abonoDeDatos } from './campos-abono.js';

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

/** @param datos { cuentas, categorias, clientes } — clientes con archivados */
export function abrirPendientes(contexto, pendientes, datos, alCambiar) {
  const resumen = porCobrarPorCliente(pendientes, datos.clientes ?? []);
  const { hoja, cerrar } = abrirSheet({
    titulo: `Por cobrar · ${textoMonto(resumen.total)}`,
    cuerpo: cuerpoPendientes(resumen),
  });

  hoja.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-cobrar]');
    if (!boton) return;
    cerrar();
    abrirCobro(contexto, pendientes.find((p) => p.id === boton.dataset.cobrar),
               datos, alCambiar);
  });
}

/* Lo que pagaste y todavía no te devuelven, con el botón de cobrar.
   Es la lista de trabajo del negocio: mientras algo esté aquí, tu dinero
   está en la calle. */

import { abrirSheet } from '../../ui/sheet.js';
import { abrirSheetFormulario } from '../../ui/sheet-formulario.js';
import { campoMonto, campoSelect, campoTexto } from '../../ui/campos.js';
import { textoMonto } from '../../ui/privacidad.js';
import { redondear } from '../../calc/dinero.js';
import { hoyISO } from '../../calc/fechas.js';
import { escapar } from '../../ui/texto.js';
import { saldoDe } from '../../negocio/abonos.js';
import { porCobrarPorCliente } from '../../negocio/por-cliente.js';
import { cuerpoPendientes } from './pendientes-vista.js';
import { abonarPago, cobrarTodos } from './acciones.js';
import { categoriasDeNegocio } from './registrar.js';
import { camposAbono, conectarAbono, abonoDeDatos, opcionesCuenta } from './campos-abono.js';

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

/** Te pagó todo lo que debía: solo pregunta el día y la cuenta. */
function abrirCobroTodos(contexto, grupo, datos, alCambiar) {
  const cuantas = grupo.pagos.length === 1 ? 'la operación' : `las ${grupo.pagos.length} operaciones`;
  abrirSheetFormulario({
    titulo: `Cobrar todo a ${grupo.nombre}`,
    id: 'form-cobro-todos',
    cuerpo: `
      <p class="tenue" style="font-size:13px">
        Se registran ${cuantas} de ${escapar(grupo.nombre)} como cobradas:
        ${textoMonto(grupo.recibos)} de recibos + ${textoMonto(grupo.comisiones)} de comisiones
        = <strong>${textoMonto(grupo.total)}</strong>.
      </p>
      <div class="campo-fila">
        ${campoTexto({ nombre: 'fecha', etiqueta: 'Día que te pagó', valor: hoyISO(), tipo: 'date' })}
        ${campoSelect({ nombre: 'cuenta_id', etiqueta: 'Cobrado en',
                        valor: contexto.perfil.cuenta_cobro_id ?? '',
                        opciones: opcionesCuenta(datos.cuentas) })}
      </div>`,
    textoGuardar: `Cobrar ${textoMonto(grupo.total)}`,
    alGuardar: async (d) => {
      await cobrarTodos(contexto, grupo.pagos, {
        fecha: d.fecha, cuenta_id: d.cuenta_id,
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
    const todos = evento.target.closest('[data-cobrar-todos]');
    if (todos) {
      cerrar();
      abrirCobroTodos(contexto, resumen.grupos.find((g) => g.cliente_id === todos.dataset.cobrarTodos),
                      datos, alCambiar);
      return;
    }
    const boton = evento.target.closest('[data-cobrar]');
    if (!boton) return;
    cerrar();
    abrirCobro(contexto, pendientes.find((p) => p.id === boton.dataset.cobrar),
               datos, alCambiar);
  });
}

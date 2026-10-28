/* Sheet "Conciliar con el banco": escribes lo que dice el banco y se ve,
   mientras escribes, cuánto no cuadra y qué lo explicaría.

   Las pistas se corrigen desde aquí mismo: el formulario se abre encima y, al
   guardar, la comparación se recalcula con los datos nuevos sin cerrar nada. */

import { abrirSheet } from '../../ui/sheet.js';
import { campoMonto } from '../../ui/campos.js';
import { aNumero } from '../../calc/dinero.js';
import { formatearFecha } from '../../calc/fechas.js';
import { conciliar } from '../../calc/conciliacion.js';
import { avisoError } from '../../ui/toast.js';
import { pintarResultado } from './conciliar-vista.js';

/* Lo último que escribiste en cada tarjeta, mientras la app siga abierta:
   al volver a conciliar no hay que copiar de nuevo los números del banco. */
const escritos = new Map();

function campos(ciclo, previos) {
  return `
    <form id="form-conciliar" novalidate>
      ${campoMonto({ nombre: 'saldo', etiqueta: 'Saldo a la fecha', valor: previos.saldo ?? '',
                     ayuda: 'El que te muestra el banco hoy, sin las compras en proceso.' })}
      ${campoMonto({ nombre: 'flotante', etiqueta: 'En proceso (flotante)',
                     valor: previos.flotante ?? '',
                     ayuda: 'Compras autorizadas que el banco todavía no aplica. Si no las separa, déjalo vacío.' })}
      ${campoMonto({ nombre: 'saldoAlCorte',
                     etiqueta: `Saldo al corte del ${formatearFecha(ciclo.fechaUltimoCorte)}`,
                     valor: previos.saldoAlCorte ?? '',
                     ayuda: 'El de tu estado de cuenta. Es el que descubre compras puestas en el ciclo equivocado.' })}
    </form>
    <div id="resultado-conciliar" class="pila" style="margin-top:16px"></div>`;
}

/* Vacío no es $0.00: un campo sin escribir no se compara. */
function leer(form) {
  const valor = (nombre) => {
    const texto = form.elements[nombre].value.trim();
    return texto ? aNumero(texto) : null;
  };
  return { saldo: valor('saldo'), flotante: valor('flotante'),
           saldoAlCorte: valor('saldoAlCorte') };
}

/**
 * @param obtenerEntrada () => { tarjeta, deudores, planItems, ciclo } con los datos de AHORA
 * @param acciones { registrarFijo(item, despues), editarMovimiento(id, despues) }
 */
export function abrirConciliacion(obtenerEntrada, acciones) {
  const { tarjeta, ciclo } = obtenerEntrada();
  const { hoja } = abrirSheet({
    titulo: 'Conciliar con el banco',
    cuerpo: campos(ciclo, escritos.get(tarjeta.id) ?? {}),
  });
  const form = hoja.querySelector('#form-conciliar');
  const salida = hoja.querySelector('#resultado-conciliar');
  let resultado = null;

  const actualizar = () => {
    const banco = leer(form);
    escritos.set(tarjeta.id, banco);
    const entrada = obtenerEntrada();
    resultado = conciliar(entrada, banco);
    salida.innerHTML = pintarResultado(resultado, entrada.ciclo.fechaUltimoCorte);
  };
  form.addEventListener('input', actualizar);
  form.addEventListener('submit', (e) => e.preventDefault());

  salida.addEventListener('click', async (evento) => {
    const o = evento.target.closest('[data-registrar], [data-editar-mov]');
    if (!o) return;
    try {
      if (o.dataset.editarMov) return await acciones.editarMovimiento(o.dataset.editarMov, actualizar);
      const [clave, indice] = o.dataset.registrar.split(':');
      await acciones.registrarFijo(resultado[clave].pistas[Number(indice)].item, actualizar);
    } catch (e) { avisoError(e); }
  });
  actualizar();
}

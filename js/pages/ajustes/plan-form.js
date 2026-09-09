/* Formulario de un item del plan. Los campos de monto cambian según la
   variabilidad: uno fijo lleva monto y día del mes; uno variable lleva un
   rango y NO se agenda a una fecha. */

import { abrirSheetFormulario } from '../../ui/sheet-formulario.js';
import { campoTexto, campoMonto, campoSelect, campoInterruptor,
         campoCuentaOTarjeta, separarDestino, unirDestino } from '../../ui/campos.js';
import { redondear } from '../../calc/dinero.js';

const CLASES = [['ingreso', 'Ingreso'], ['gasto', 'Gasto']];
const VARIABILIDAD = [['fijo', 'Fijo'], ['variable', 'Variable']];
const DIAS = Array.from({ length: 31 }, (_, i) => [String(i + 1), `Día ${i + 1}`]);

function campos(item, datos) {
  const clase = item.clase ?? 'gasto';
  const categorias = datos.categorias.filter(
    (c) => c.tipo === (clase === 'ingreso' ? 'ingreso' : 'egreso'));
  return `
    ${campoTexto({ nombre: 'nombre', etiqueta: 'Nombre', valor: item.nombre ?? '' })}
    ${campoSelect({ nombre: 'clase', etiqueta: 'Tipo', valor: clase, opciones: CLASES })}
    ${campoSelect({ nombre: 'variabilidad', etiqueta: 'Comportamiento',
                    valor: item.variabilidad ?? 'fijo', opciones: VARIABILIDAD })}

    <div data-solo="fijo">
      ${campoMonto({ nombre: 'monto', etiqueta: 'Monto', valor: item.monto ?? '' })}
      ${campoSelect({ nombre: 'dia_mes', etiqueta: 'Día del mes',
                      valor: String(item.dia_mes ?? 1), opciones: DIAS })}
    </div>

    <div data-solo="variable">
      ${campoMonto({ nombre: 'monto_min', etiqueta: 'Mínimo al mes', valor: item.monto_min ?? '' })}
      ${campoMonto({ nombre: 'monto_max', etiqueta: 'Máximo al mes', valor: item.monto_max ?? '' })}
      <p class="tenue-2" style="font-size:12.5px">
        Los variables no se agendan a una fecha: el plan los reserva como colchón del mes.
      </p>
    </div>

    ${campoCuentaOTarjeta({
      nombre: 'destino', etiqueta: clase === 'ingreso' ? 'Entra a' : 'Sale de',
      valor: unirDestino(item, 'cuenta_id', 'tarjeta_id'),
      cuentas: datos.cuentas, tarjetas: clase === 'ingreso' ? [] : datos.tarjetas,
      vacio: 'Sin asignar',
    })}
    ${campoSelect({ nombre: 'categoria_id', etiqueta: 'Categoría',
                    valor: item.categoria_id ?? '',
                    opciones: [['', 'Sin categoría'], ...categorias.map((c) => [c.id, c.nombre])] })}
    ${campoInterruptor({ nombre: 'activo', etiqueta: 'Activo',
                         activo: item.activo ?? true,
                         ayuda: 'Si lo pausas, deja de contar en el plan sin borrarlo.' })}`;
}

/** Muestra solo los campos que corresponden a la variabilidad elegida. */
function conectarVariabilidad(hoja, form) {
  const select = form.querySelector('[name="variabilidad"]');
  const aplicar = () => {
    form.querySelectorAll('[data-solo]').forEach((caja) => {
      caja.hidden = caja.dataset.solo !== select.value;
    });
  };
  select.addEventListener('change', aplicar);
  aplicar();
}

function aFila(d) {
  const destino = separarDestino(d.destino);
  const esFijo = d.variabilidad === 'fijo';
  return {
    nombre: d.nombre.trim(),
    clase: d.clase,
    variabilidad: d.variabilidad,
    monto: esFijo ? redondear(d.monto) : null,
    monto_min: esFijo ? null : redondear(d.monto_min),
    monto_max: esFijo ? null : redondear(d.monto_max),
    dia_mes: esFijo ? Number(d.dia_mes) : null,
    cuenta_id: destino.clase === 'cuenta' ? destino.id : null,
    tarjeta_id: destino.clase === 'tarjeta' ? destino.id : null,
    categoria_id: d.categoria_id || null,
    activo: Boolean(d.activo),
  };
}

function validar(d) {
  if (!d.nombre.trim()) throw new Error('Ponle un nombre.');
  if (d.variabilidad === 'fijo') {
    if (!(d.monto > 0)) throw new Error('El monto tiene que ser mayor que cero.');
    return;
  }
  if (!(d.monto_min >= 0) || !(d.monto_max > 0)) throw new Error('Pon el mínimo y el máximo.');
  if (d.monto_max < d.monto_min) throw new Error('El máximo no puede ser menor que el mínimo.');
}

export function abrirFormPlanItem(item, datos, { alGuardar, alEliminar }) {
  abrirSheetFormulario({
    titulo: item.id ? 'Editar' : 'Nuevo en el plan',
    id: 'form-plan',
    cuerpo: campos(item, datos),
    textoGuardar: item.id ? 'Guardar' : 'Agregar',
    textoBorrar: item.id ? 'Eliminar del plan' : '',
    alEliminar: item.id ? alEliminar : null,
    alPintar: conectarVariabilidad,
    alGuardar: (d) => { validar(d); return alGuardar(aFila(d)); },
  });
}

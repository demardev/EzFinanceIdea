/* El formulario se CONSTRUYE leyendo tipos.js. No conoce ingreso, egreso ni
   transferencia por nombre: recorre TIPOS y pinta lo que cada uno declara.

   Todo lo que cambia mientras está abierto vive en `f` (el tipo elegido, lo
   escrito, el préstamo ligado); las funciones de abajo lo reciben. */

import { abrirSheet } from '../ui/sheet.js';
import { datosDe } from '../ui/campos.js';
import { conectarMontos } from '../ui/monto-input.js';
import { icono } from '../iconos/render.js';
import { hoyISO } from '../calc/fechas.js';
import { TIPOS, CLAVES_TIPO } from './tipos.js';
import { pintarCampos } from './campos.js';
import { pintarVinculo, conectarVinculo, ajustarAlTipo, columnaDe } from './vinculo-prestamo.js';

/** Los tres botones de arriba, uno por entrada del mapa. */
function selectorTipo(activo) {
  const botones = CLAVES_TIPO.map((clave) => `
    <button type="button" class="pastilla ${clave === activo ? 'activa' : ''}"
            data-tipo="${clave}">
      ${icono(TIPOS[clave].icono, 16)} ${TIPOS[clave].etiqueta}
    </button>`).join('');
  return `<div class="pastillas">${botones}</div>`;
}

/* Un nuevo puede venir con valores puestos (un gasto fijo del plan). */
function valoresIniciales(mov) {
  if (!mov?.id) return { fecha: hoyISO(), ...mov };
  return {
    monto: mov.monto, fecha: mov.fecha, descripcion: mov.descripcion,
    categoria_id: mov.categoria_id ?? '', nota: mov.nota ?? '',
    ...TIPOS[mov.tipo].aFormulario(mov),
  };
}

function plantilla(f) {
  const { editando, acciones } = f;
  return `
    ${selectorTipo(f.tipoClave)}
    <form id="form-mov" novalidate>
      ${pintarCampos(TIPOS[f.tipoClave].campos, f.valores, f.datos, f.tipoClave)}
      <div data-vinculo-slot></div>
      <p class="campo-error" id="error-mov" hidden></p>
      <button class="btn btn-primario btn-bloque" type="submit" style="margin-top:14px">
        ${editando ? 'Guardar' : 'Registrar'}
      </button>
    </form>
    ${editando && acciones.alDuplicar ? `<button class="btn btn-bloque" id="btn-duplicar"
        type="button" style="margin-top:10px">${icono('copiar', 16)} Duplicar</button>` : ''}
    ${editando ? `<button class="btn btn-peligro btn-bloque" id="btn-borrar" type="button"
        style="margin-top:10px">Eliminar movimiento</button>` : ''}`;
}

function pintar(f) {
  f.cuerpo.innerHTML = plantilla(f);
  conectar(f);
  pintarVinculoSolo(f);
}

/* Solo su hueco: repintar todo borraría lo que ya escribiste. */
function pintarVinculoSolo(f) {
  const hueco = f.cuerpo.querySelector('[data-vinculo-slot]');
  hueco.innerHTML = pintarVinculo(f.vinculo, f.tipoClave);
  conectarVinculo(hueco, f.vinculo, f.tipoClave, () => pintarVinculoSolo(f));
}

/* Al cambiar de tipo se conserva lo que sigue teniendo sentido (monto,
   fecha, descripción, nota) y se sueltan cuentas, categoría y el préstamo
   si ya no le va, que dependen del tipo. */
function cambiarTipo(f, nuevo) {
  const { monto, fecha, descripcion, nota } = datosDe(f.cuerpo.querySelector('#form-mov'));
  f.valores = { monto, fecha, descripcion, nota };
  f.tipoClave = nuevo;
  ajustarAlTipo(f.vinculo, nuevo);
  pintar(f);
}

function fallar(f, mensaje) {
  const error = f.cuerpo.querySelector('#error-mov');
  error.hidden = false;
  error.textContent = mensaje;
}

async function enviarFormulario(f, evento, form, boton) {
  evento.preventDefault();
  const tipo = TIPOS[f.tipoClave];
  const datosForm = datosDe(form);
  const problema = tipo.validar(datosForm);
  if (problema) return fallar(f, problema);

  f.cuerpo.querySelector('#error-mov').hidden = true;
  boton.disabled = true;
  try {
    await f.acciones.alGuardar({ ...tipo.aFila(datosForm), ...columnaDe(f.vinculo) });
    f.cerrar();
  } catch (e) {
    fallar(f, e.message);
    boton.disabled = false;
  }
}

function conectar(f) {
  const { cuerpo, acciones } = f;
  conectarMontos(cuerpo);   // el cuerpo se repinta al cambiar de tipo
  cuerpo.querySelectorAll('[data-tipo]').forEach((boton) => {
    boton.addEventListener('click', () => cambiarTipo(f, boton.dataset.tipo));
  });

  const form = cuerpo.querySelector('#form-mov');
  const enviar = form.querySelector('button[type="submit"]');
  form.addEventListener('submit', (e) => enviarFormulario(f, e, form, enviar));

  /* Duplicar suelta este sheet y abre uno de "nuevo" con lo mismo puesto. */
  cuerpo.querySelector('#btn-duplicar')?.addEventListener('click', () => {
    f.cerrar();
    acciones.alDuplicar();
  });

  cuerpo.querySelector('#btn-borrar')?.addEventListener('click', async () => {
    try { if (await acciones.alEliminar()) f.cerrar(); }
    catch (e) { fallar(f, e.message); }
  });
}

/**
 * @param mov       {} para nuevo (o con valores ya puestos), o el movimiento a editar
 * @param datos     { cuentas, tarjetas, categorias } ya cargados
 * @param acciones  { alGuardar(fila), alEliminar(), alDuplicar() opcional,
 *                    vinculo opcional: el préstamo al que va (vinculo-prestamo.js) }
 */
export function abrirFormMovimiento(mov, datos, acciones) {
  const editando = Boolean(mov?.id);
  const { hoja, cerrar } = abrirSheet({
    titulo: editando ? 'Editar movimiento' : 'Nuevo movimiento',
    cuerpo: '<div id="cuerpo-mov"></div>',
  });
  pintar({
    cuerpo: hoja.querySelector('#cuerpo-mov'), cerrar, datos, acciones, editando,
    tipoClave: mov?.tipo ?? 'egreso', valores: valoresIniciales(mov), vinculo: acciones.vinculo,
  });
}

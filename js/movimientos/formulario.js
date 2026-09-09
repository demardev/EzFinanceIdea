/* El formulario se CONSTRUYE leyendo tipos.js. No conoce ingreso, egreso ni
   transferencia por nombre: recorre TIPOS y pinta lo que cada uno declara. */

import { abrirSheet } from '../ui/sheet.js';
import { datosDe } from '../ui/campos.js';
import { conectarMontos } from '../ui/monto-input.js';
import { icono } from '../iconos/render.js';
import { hoyISO } from '../calc/fechas.js';
import { TIPOS, CLAVES_TIPO } from './tipos.js';
import { pintarCampos } from './campos.js';

/** Los tres botones de arriba, uno por entrada del mapa. */
function selectorTipo(activo) {
  const botones = CLAVES_TIPO.map((clave) => `
    <button type="button" class="pastilla ${clave === activo ? 'activa' : ''}"
            data-tipo="${clave}">
      ${icono(TIPOS[clave].icono, 16)} ${TIPOS[clave].etiqueta}
    </button>`).join('');
  return `<div class="pastillas">${botones}</div>`;
}

function valoresIniciales(mov) {
  if (!mov?.id) return { fecha: hoyISO() };
  return {
    monto: mov.monto, fecha: mov.fecha, descripcion: mov.descripcion,
    categoria_id: mov.categoria_id ?? '', nota: mov.nota ?? '',
    ...TIPOS[mov.tipo].aFormulario(mov),
  };
}

/**
 * @param mov       {} para nuevo, o el movimiento a editar
 * @param datos     { cuentas, tarjetas, categorias } ya cargados
 * @param acciones  { alGuardar(fila), alEliminar() }
 */
export function abrirFormMovimiento(mov, datos, { alGuardar, alEliminar }) {
  const editando = Boolean(mov?.id);
  let tipoClave = mov?.tipo ?? 'egreso';
  let valores = valoresIniciales(mov);

  const { hoja, cerrar } = abrirSheet({
    titulo: editando ? 'Editar movimiento' : 'Nuevo movimiento',
    cuerpo: `<div id="cuerpo-mov"></div>`,
  });
  const cuerpo = hoja.querySelector('#cuerpo-mov');

  function pintar() {
    const tipo = TIPOS[tipoClave];
    cuerpo.innerHTML = `
      ${selectorTipo(tipoClave)}
      <form id="form-mov" novalidate>
        ${pintarCampos(tipo.campos, valores, datos, tipoClave)}
        <p class="campo-error" id="error-mov" hidden></p>
        <button class="btn btn-primario btn-bloque" type="submit" style="margin-top:14px">
          ${editando ? 'Guardar' : 'Registrar'}
        </button>
      </form>
      ${editando ? '<button class="btn btn-peligro btn-bloque" id="btn-borrar" type="button" ' +
                   'style="margin-top:10px">Eliminar movimiento</button>' : ''}`;
    conectar();
  }

  /* Al cambiar de tipo se conserva lo que sigue teniendo sentido (monto,
     fecha, descripción, nota) y se sueltan cuentas y categoría, que dependen
     del tipo. */
  function cambiarTipo(nuevo) {
    const form = cuerpo.querySelector('#form-mov');
    const actuales = datosDe(form);
    valores = {
      monto: actuales.monto, fecha: actuales.fecha,
      descripcion: actuales.descripcion, nota: actuales.nota,
    };
    tipoClave = nuevo;
    pintar();
  }

  function fallar(mensaje) {
    const error = cuerpo.querySelector('#error-mov');
    error.hidden = false;
    error.textContent = mensaje;
  }

  async function enviarFormulario(evento, form, boton) {
    evento.preventDefault();
    const tipo = TIPOS[tipoClave];
    const datosForm = datosDe(form);
    const problema = tipo.validar(datosForm);
    if (problema) return fallar(problema);

    cuerpo.querySelector('#error-mov').hidden = true;
    boton.disabled = true;
    try {
      await alGuardar(tipo.aFila(datosForm));
      cerrar();
    } catch (e) {
      fallar(e.message);
      boton.disabled = false;
    }
  }

  function conectar() {
    conectarMontos(cuerpo);   // el cuerpo se repinta al cambiar de tipo
    cuerpo.querySelectorAll('[data-tipo]').forEach((boton) => {
      boton.addEventListener('click', () => cambiarTipo(boton.dataset.tipo));
    });

    const form = cuerpo.querySelector('#form-mov');
    const enviar = form.querySelector('button[type="submit"]');
    form.addEventListener('submit', (e) => enviarFormulario(e, form, enviar));

    cuerpo.querySelector('#btn-borrar')?.addEventListener('click', async () => {
      try { if (await alEliminar()) cerrar(); }
      catch (e) { fallar(e.message); }
    });
  }

  pintar();
}

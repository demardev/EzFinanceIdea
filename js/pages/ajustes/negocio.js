/* Preferencias del negocio: las que trae puestas el formulario de pago de
   recibo. Se guardan en `perfiles`, que tiene permisos por columna: desde
   aquí se pueden cambiar estas tres y nada más — la bandera `negocio` no. */

import { campoMonto, campoSelect, datosDe } from '../../ui/campos.js';
import { aviso, avisoError } from '../../ui/toast.js';
import { redondear } from '../../calc/dinero.js';

function opciones(cuentas) {
  return [['', 'Sin elegir'], ...cuentas.map((c) => [c.id, c.nombre])];
}

export async function montarNegocio(contenedor, contexto) {
  const { perfiles, cuentas, userId } = contexto;
  contenedor.innerHTML = '<p class="tenue">Cargando…</p>';

  const [perfil, lista] = await Promise.all([perfiles.mio(), cuentas.listarActivas()]);

  contenedor.innerHTML = `
    <form class="pila" id="form-negocio">
      <p class="tenue" style="font-size:13px">
        Lo que el formulario de pago de recibo trae puesto. Puedes cambiarlo
        en cada operación cuando ese día sea distinto.
      </p>
      ${campoSelect({ nombre: 'cuenta_pago_id', etiqueta: 'Pago los recibos desde',
                      valor: perfil.cuenta_pago_id ?? '', opciones: opciones(lista) })}
      ${campoSelect({ nombre: 'cuenta_cobro_id', etiqueta: 'Me pagan en',
                      valor: perfil.cuenta_cobro_id ?? '', opciones: opciones(lista) })}
      ${campoMonto({ nombre: 'comision_default', etiqueta: 'Comisión habitual',
                     valor: perfil.comision_default ?? 0 })}
      <p class="campo-error" data-error hidden></p>
      <button class="btn btn-primario btn-bloque" type="submit">Guardar</button>
    </form>`;

  const form = contenedor.querySelector('#form-negocio');
  const error = contenedor.querySelector('[data-error]');

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const d = datosDe(form);
    error.hidden = true;
    try {
      await perfiles.guardarPreferencias(userId, {
        cuenta_pago_id: d.cuenta_pago_id || null,
        cuenta_cobro_id: d.cuenta_cobro_id || null,
        comision_default: redondear(d.comision_default || 0),
      });
      Object.assign(contexto.perfil, {
        cuenta_pago_id: d.cuenta_pago_id || null,
        cuenta_cobro_id: d.cuenta_cobro_id || null,
        comision_default: redondear(d.comision_default || 0),
      });
      aviso('Preferencias guardadas.');
    } catch (e) {
      error.hidden = false;
      error.textContent = e.message;
      avisoError(e);
    }
  });
}

/* Qué pasa al tocar un movimiento de "Últimos movimientos". Es el mismo
   camino que en la pantalla de Movimientos: el mismo formulario y la misma
   confirmación de borrado, para que las dos pantallas se comporten igual. */

import { abrirRegistro, eliminarMovimiento, borradorDeFijo } from '../../movimientos/registrar.js';
import { cerrarDeslizada } from '../../ui/deslizar.js';
import { abrirSheet } from '../../ui/sheet.js';
import { avisoError } from '../../ui/toast.js';

/* Un movimiento del negocio no se edita solo: se abre su operación y desde
   ahí se regeneran los tres. */
async function abrirOperacion(contexto, pagoId, alCambiar) {
  const [pago, cuentas, categorias] = await Promise.all([
    contexto.pagos.obtener(pagoId),
    contexto.cuentas.listarActivas(),
    contexto.categorias.listarActivas(),
  ]);
  if (!pago) return;
  const { abrirPagoRecibo } = await import('../negocio/registrar.js');
  await abrirPagoRecibo(contexto, pago, { cuentas, categorias }, alCambiar);
}

/**
 * Se engancha UNA vez: el contenedor es nuevo en cada navegación y el
 * listener delegado sobrevive a los repintados.
 *
 * @param movimientos todos los cargados, para encontrar el de la fila
 */
export function conectarMovimientos(contenedor, contexto, movimientos, alCambiar) {
  contenedor.addEventListener('click', async (evento) => {
    const objetivo = evento.target.closest('[data-editar], [data-borrar], [data-operacion]');
    if (!objetivo) return;
    const buscar = (id) => movimientos().find((m) => m.id === id);
    try {
      if (objetivo.dataset.operacion) {
        await abrirOperacion(contexto, objetivo.dataset.operacion, alCambiar);
        return;
      }
      if (objetivo.dataset.borrar) {
        cerrarDeslizada();
        await eliminarMovimiento(contexto, buscar(objetivo.dataset.borrar), alCambiar);
        return;
      }
      await abrirRegistro(contexto, buscar(objetivo.dataset.editar), alCambiar);
    } catch (e) { avisoError(e); }
  });
}

/**
 * Tocar un gasto fijo o un ingreso de "Próximos vencimientos" lo registra.
 * Si su cargo ya llegó a Por confirmar, se registra ese: así sale de la
 * bandeja y no queda dos veces.
 * @param alLlegado (id de la entrada) => Promise
 */
export function conectarVencimientos(contenedor, contexto, vencimientos, alCambiar, alLlegado) {
  contenedor.addEventListener('click', async (evento) => {
    const objetivo = evento.target.closest('[data-vencimiento]');
    if (!objetivo) return;
    const { item, porConfirmar } = vencimientos[Number(objetivo.dataset.vencimiento)];
    try {
      if (porConfirmar) await alLlegado(porConfirmar);
      else await abrirRegistro(contexto, borradorDeFijo(item), alCambiar);
    } catch (e) { avisoError(e); }
  });
}

const AYUDA_FIJOS = `
  <div class="pila-sm" style="font-size:14px;line-height:1.5">
    <p>Cuando el cobro de un gasto fijo llega a <b>Por confirmar</b> (por aviso del
      banco o Apple Pay), se reconoce solo si trae el monto exacto del plan, cae a
      lo más 10 días de su fecha y no viene de otra cuenta.</p>
    <p>Aquí el gasto dice <b>llegó · por confirmar</b>. Tócalo y se registra ese
      cobro: sale de los dos lados y no queda repetido.</p>
    <p>En Por confirmar llega con el nombre, la categoría y la cuenta del plan.
      Si dice <b>¿Gasto fijo?</b>, el nombre del banco no se pareció al del plan:
      revisa que sí sea ese antes de registrarlo.</p>
    <p>Si ya lo habías registrado, sale como <b>Ya registrado</b>: deslízalo para
      descartarlo.</p>
    <p class="tenue">¿No lo reconoce? Revisa que el monto del gasto fijo sea el
      exacto y que su cuenta sea la misma con la que llega el aviso.</p>
  </div>`;

/** El "?" de Próximos vencimientos. Se engancha una vez, como los demás. */
export function conectarAyudaFijos(contenedor) {
  contenedor.addEventListener('click', (evento) => {
    if (!evento.target.closest('#btn-ayuda-fijos')) return;
    abrirSheet({ titulo: 'Gastos fijos y Por confirmar', cuerpo: AYUDA_FIJOS });
  });
}

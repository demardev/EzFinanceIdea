/* Qué pasa al tocar un movimiento de "Últimos movimientos". Es el mismo
   camino que en la pantalla de Movimientos: el mismo formulario y la misma
   confirmación de borrado, para que las dos pantallas se comporten igual. */

import { abrirRegistro, eliminarMovimiento } from '../../movimientos/registrar.js';
import { cerrarDeslizada } from '../../ui/deslizar.js';
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

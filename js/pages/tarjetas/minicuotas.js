/* Acciones de minicuotas: trasladar compras y deshacer un traslado.
   Un traslado toca dos tablas —la compra en `compras_cuotas`, sus cuotas y
   las compras originales en `movimientos`— y aquí se coordinan. Los montos y
   las fechas los decide calc/minicuotas.js. */

import { comprasTrasladables, fechasPorDefecto, generarTraslado } from '../../calc/minicuotas.js';
import { calcularCiclo } from '../../calc/ciclo-tarjeta.js';
import { hoyISO } from '../../calc/fechas.js';
import { confirmar } from '../../ui/confirmar.js';
import { aviso } from '../../ui/toast.js';
import { plural } from '../../ui/texto.js';
import { abrirFormMinicuotas } from './minicuotas-form.js';

async function crearTraslado({ compras, movimientos }, tarjeta, fila, ids) {
  const traslado = await compras.crear({ ...fila, tarjeta_id: tarjeta.id });
  try {
    await movimientos.crearVarios(generarTraslado(traslado));
    await Promise.all(ids.map((id) => movimientos.actualizar(id, { traslado_id: traslado.id })));
  } catch (e) {
    /* A medias contaría dos veces o ninguna: se borra y las originales vuelven. */
    await compras.eliminar(traslado.id);
    throw e;
  }
  aviso(`${plural(ids.length, 'compra pasada', 'compras pasadas')} a ${traslado.num_cuotas} minicuotas.`);
}

/** Abre el formulario con las compras del corte abierto de esa tarjeta. */
export function abrirTraslado(contexto, tarjeta, datos, alTerminar) {
  const hoy = hoyISO();
  const ciclo = calcularCiclo(tarjeta.dia_corte, tarjeta.dia_limite_pago, hoy);
  const trasladables = comprasTrasladables(datos.movimientos, tarjeta, ciclo);
  if (!trasladables.length) {
    aviso('No hay compras en el corte abierto para trasladar.');
    return;
  }
  abrirFormMinicuotas({
    tarjeta, trasladables, categorias: datos.categorias, hoy,
    fechas: fechasPorDefecto(tarjeta, hoy),
  }, async (fila, ids) => {
    await crearTraslado(contexto, tarjeta, fila, ids);
    await alTerminar();
  });
}

/** Un traslado no se edita: se deshace y se vuelve a hacer. */
export async function deshacerTraslado({ compras }, traslado) {
  const ok = await confirmar({
    titulo: `¿Deshacer "${traslado.descripcion}"?`,
    mensaje: 'Se borran sus cuotas y su comisión, y las compras originales vuelven a '
      + 'contar en el corte como antes. Para cambiar el plazo o el interés, deshazlo '
      + 'y trasládalas otra vez.',
  });
  if (!ok) return false;
  await compras.eliminar(traslado.id);   // cuotas por cascade; originales por set null
  aviso('Traslado deshecho.');
  return true;
}

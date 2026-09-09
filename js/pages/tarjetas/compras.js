/* Acciones sobre compras a cuotas: crear, editar y eliminar.
   Una compra vive en dos tablas — la compra en `compras_cuotas` y sus cuotas
   como movimientos — así que aquí se coordinan las dos. El reparto lo decide
   calc/cuotas.js; aquí no se hace aritmética. */

import { generarCuotas, planRegeneracion } from '../../calc/cuotas.js';
import { hoyISO } from '../../calc/fechas.js';
import { confirmar } from '../../ui/confirmar.js';
import { aviso } from '../../ui/toast.js';
import { plural } from '../../ui/texto.js';

export async function crearCompra({ compras, movimientos }, tarjeta, datos) {
  const compra = await compras.crear({ ...datos, tarjeta_id: tarjeta.id });
  try {
    await movimientos.crearVarios(generarCuotas(compra));
  } catch (e) {
    /* Sin sus cuotas la compra no significa nada: no dejarla a medias. */
    await compras.eliminar(compra.id);
    throw e;
  }
  aviso(`Compra registrada en ${compra.num_cuotas} cuotas.`);
  return compra;
}

export async function editarCompra({ compras, movimientos }, compra, datos) {
  const existentes = await movimientos.listarDeCompra(compra.id);
  const plan = planRegeneracion({ ...compra, ...datos }, existentes, hoyISO());
  if (plan.aviso) throw new Error(plan.aviso);

  const actualizada = await compras.actualizar(compra.id, datos);
  await movimientos.eliminarPendientesDeCompra(compra.id, hoyISO());
  await movimientos.crearVarios(planRegeneracion(actualizada, existentes, hoyISO()).aCrear);

  aviso(plan.yaCobradas
    ? `Se regeneraron ${plural(plan.aCrear.length, 'cuota', 'cuotas')} pendientes.`
    : 'Compra actualizada.');
  return actualizada;
}

export async function eliminarCompra({ compras, movimientos }, compra) {
  const cuotas = await movimientos.listarDeCompra(compra.id);
  const cobradas = cuotas.filter((c) => c.fecha <= hoyISO()).length;
  const ok = await confirmar({
    titulo: `¿Eliminar "${compra.descripcion}"?`,
    mensaje: `Se borran sus ${plural(cuotas.length, 'cuota', 'cuotas')}`
      + (cobradas ? `, incluidas ${plural(cobradas, 'ya cobrada', 'ya cobradas')}` : '')
      + '. La deuda de la tarjeta baja en consecuencia. No se puede deshacer.',
  });
  if (!ok) return false;
  await compras.eliminar(compra.id);   // las cuotas se van por on delete cascade
  aviso('Compra eliminada.');
  return true;
}

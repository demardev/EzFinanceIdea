/* Crear, editar, cobrar y eliminar un pago de recibo. Una operación vive en
   tres sitios —la fila de `pagos_recibo`, sus movimientos y la foto en
   Storage— así que aquí se coordinan los tres. La aritmética la hace
   negocio/pago-recibo.js. */

import { movimientosDePago } from '../../negocio/pago-recibo.js';
import { confirmar } from '../../ui/confirmar.js';
import { aviso } from '../../ui/toast.js';
import { textoMonto } from '../../ui/privacidad.js';

const BUCKET = 'recibos';

/** Las fotos van a <uuid del usuario>/<id de la operación>.jpg */
function rutaFoto(userId, pagoId) {
  return `${userId}/${pagoId}.jpg`;
}

async function regenerarMovimientos({ movimientos }, pago, categorias) {
  await movimientos.eliminarPorPago(pago.id);
  await movimientos.crearVarios(movimientosDePago(pago, categorias));
}

export async function crearPago(contexto, datos, { foto, categorias }) {
  const { pagos, almacen, userId } = contexto;
  const pago = await pagos.crear(datos);
  try {
    if (foto) {
      const ruta = await almacen.subir(BUCKET, rutaFoto(userId, pago.id), foto);
      Object.assign(pago, await pagos.actualizar(pago.id, { foto_ruta: ruta }));
    }
    await regenerarMovimientos(contexto, pago, categorias);
  } catch (e) {
    /* Sin sus movimientos la operación no significa nada: no dejarla a medias. */
    await pagos.eliminar(pago.id);
    throw e;
  }
  aviso('Pago de recibo registrado.');
  return pago;
}

/** `foto`: un Blob la pone o la cambia, null la quita, undefined la deja. */
export async function editarPago(contexto, pago, datos, { foto, categorias }) {
  const { pagos, almacen, userId } = contexto;
  const cambios = { ...datos };
  if (foto) cambios.foto_ruta = await almacen.subir(BUCKET, rutaFoto(userId, pago.id), foto);
  if (foto === null && pago.foto_ruta) cambios.foto_ruta = null;

  const actualizado = await pagos.actualizar(pago.id, cambios);
  if (foto === null && pago.foto_ruta) {
    /* Como al eliminar: si el archivo no se borra, queda huérfano y ya. */
    try { await almacen.borrar(BUCKET, pago.foto_ruta); } catch { /* ignorado */ }
  }
  await regenerarMovimientos(contexto, actualizado, categorias);
  aviso('Operación actualizada.');
  return actualizado;
}

/** Marcar como cobrado: aquí nacen los dos ingresos, con la fecha del cobro. */
export async function cobrarPago(contexto, pago, { fecha, cuentaId, comision, categorias }) {
  const actualizado = await contexto.pagos.actualizar(pago.id, {
    fecha_cobro: fecha, cuenta_cobro_id: cuentaId, comision,
  });
  await regenerarMovimientos(contexto, actualizado, categorias);
  aviso(`Cobrado. Ganaste ${textoMonto(comision)}.`);
  return actualizado;
}

export async function eliminarPago(contexto, pago) {
  const { pagos, almacen, userId } = contexto;
  const ok = await confirmar({
    titulo: '¿Eliminar esta operación?',
    mensaje: `Se borran sus movimientos${pago.foto_ruta ? ' y su foto' : ''}. `
           + 'No se puede deshacer.',
  });
  if (!ok) return false;

  await pagos.eliminar(pago.id);          // los movimientos se van en cascada
  if (pago.foto_ruta) {
    /* Si la foto no se puede borrar no se deshace todo: queda un archivo
       huérfano, que es mucho menos malo que dejar la operación viva. */
    try { await almacen.borrar(BUCKET, rutaFoto(userId, pago.id)); } catch { /* ignorado */ }
  }
  aviso('Operación eliminada.');
  return true;
}

/** Descarga la foto y devuelve una URL para mostrarla. */
export async function urlDeFoto({ almacen }, pago) {
  if (!pago.foto_ruta) return null;
  const blob = await almacen.descargar(BUCKET, pago.foto_ruta);
  return URL.createObjectURL(blob);
}

/* Aplicar los arreglos del asistente (calc/arreglos-estado.js) a tus datos,
   y deshacerlos. Cada arreglo usa lo que ya existe —crear o actualizar un
   movimiento, editarCompra() para mover las cuotas— y deja anotado cómo
   volver atrás. Si uno falla, se para: lo aplicado hasta ahí se puede deshacer. */

import { editarCompra } from './compras.js';

/** Aplica UNO y devuelve cómo deshacerlo. */
async function aplicarUno(contexto, tarjeta, arreglo, compras) {
  const { movimientos } = contexto;
  if (arreglo.fila) {
    const creado = await movimientos.crear(arreglo.fila);
    return () => movimientos.eliminar(creado.id);
  }
  if (arreglo.movimientoId) {
    await movimientos.actualizar(arreglo.movimientoId, arreglo.cambios);
    return () => movimientos.actualizar(arreglo.movimientoId, arreglo.antes);
  }
  return moverCuotas(contexto, tarjeta, arreglo, compras.find((c) => c.id === arreglo.compraId));
}

const cuotasDe = async ({ movimientos }, compraId) =>
  (await movimientos.listarDeCompra(compraId)).filter((m) => m.cuota_num > 0);

/* Deshacer no puede volver a regenerar: sin primera cuota, editarCompra()
   usaría la regla de la tarjeta, que puede no ser la que tenían. Se guarda
   una copia de las cuotas y se restauran tal cual. */
async function moverCuotas(contexto, tarjeta, arreglo, compra) {
  const { movimientos, compras } = contexto;
  const copia = (await cuotasDe(contexto, compra.id))
    .map(({ id, created_at: _c, user_id: _u, ...resto }) => resto);
  await editarCompra(contexto, tarjeta, compra, arreglo.cambios);
  return async () => {
    await compras.actualizar(compra.id, arreglo.antes);
    const ahora = await cuotasDe(contexto, compra.id);
    await Promise.all(ahora.map((m) => movimientos.eliminar(m.id)));
    await movimientos.crearVarios(copia);
  };
}

/**
 * @returns { aplicados, error, deshacer } — `deshacer()` revierte lo aplicado,
 *          del último al primero.
 */
export async function aplicarArreglos(contexto, tarjeta, arreglos, compras) {
  const reversas = [];
  let error = null;
  for (const arreglo of arreglos) {
    try {
      reversas.push(await aplicarUno(contexto, tarjeta, arreglo, compras));
    } catch (e) {
      error = e;
      break;
    }
  }
  const deshacer = async () => {
    for (const reversa of [...reversas].reverse()) await reversa();
  };
  return { aplicados: reversas.length, error, deshacer };
}

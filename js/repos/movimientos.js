/* Repositorio de movimientos. Mismo contrato CRUD que los demás, más las
   consultas propias de esta entidad.

   Se filtra por MES en el servidor (que es lo que acota el volumen) y el
   resto de filtros se aplican en el cliente sobre esas filas: a escala
   personal son decenas, y así la búsqueda responde mientras se escribe. */

import { crearRepo } from './base.js';
import { rangoDelMes } from '../calc/fechas.js';

export function repoMovimientos(cliente) {
  /* Desempate por created_at: `fecha` no lleva hora, así que sin esto dos
   movimientos del mismo día llegarían en orden arbitrario. */
  const base = crearRepo(cliente, 'movimientos', { orden: 'fecha.desc,created_at.desc' });

  /** @param mes 'YYYY-MM' */
  function listarDelMes(mes, extra = {}) {
    const { desde, hasta } = rangoDelMes(mes);
    return base.listar({ fecha: [`gte.${desde}`, `lte.${hasta}`], ...extra });
  }

  /** Las N cuotas de una compra se insertan de un viaje, no una por una. */
  function crearVarios(filas) {
    return cliente.insertar('movimientos', filas);
  }

  /* Saldos sin bajar el historial: Postgres suma por ruteo y devuelve unas
     pocas filas con forma de movimiento. La regla del dinero sigue en
     js/calc/saldos.js; aquí solo llega el total ya sumado. */
  async function totalesPorCuenta(hasta) {
    try {
      return await cliente.rpc('totales_de_movimientos', { hasta });
    } catch (error) {
      /* 404 = la función todavía no existe en esa base (falta correr el SQL).
         Mejor caer al camino viejo —bajarse el historial— que dejar la
         pantalla rota; en cuanto se corra el SQL deja de pasar. */
      if (error?.estado !== 404) throw error;
      return base.listar({ fecha: `lte.${hasta}` });
    }
  }

  /** Los que tocan una tarjeta: cargos y pagos, que es lo que necesitan la
      deuda, los ciclos y las cuotas. */
  function listarDeTarjetas() {
    return base.listar({ or: '(tarjeta_id.not.is.null,tarjeta_destino_id.not.is.null)' });
  }

  /** Los últimos que YA ocurrieron. Se piden de más porque después se filtran
      por ámbito y la lista se quedaría corta. */
  function listarUltimos(hoy, cuantos = 20) {
    return base.listar({ fecha: `lte.${hoy}`, limit: String(cuantos) });
  }

  /** Los que todavía no ocurren: pendientes que se cargarán solos. */
  function listarFuturos(hoy) {
    return base.listar({ fecha: `gt.${hoy}`, order: 'fecha.asc' });
  }

  function listarDeCompra(compraId) {
    return base.listar({ compra_id: `eq.${compraId}`, order: 'cuota_num.asc' });
  }

  /* Borra las cuotas que aún no se cobran, con un filtro en vez de N borrados:
     `fecha > hoy` es exactamente la definición de "pendiente". */
  function eliminarPendientesDeCompra(compraId, hoy) {
    return cliente.eliminar('movimientos', { compra_id: `eq.${compraId}`, fecha: `gt.${hoy}` });
  }

  /* Al editar una operación se borran sus movimientos y se regeneran: son
     generados, nunca se editan uno por uno. */
  function eliminarPorPago(pagoId) {
    return cliente.eliminar('movimientos', { pago_id: `eq.${pagoId}` });
  }

  function ultimos(cuantos = 5) {
    return base.listar({ limit: String(cuantos) });
  }

  async function contar(filtros) {
    const filas = await cliente.seleccionar('movimientos', { ...filtros, select: 'id' });
    return filas.length;
  }

  /** Al borrar la categoría estos movimientos se quedan sin ella (set null). */
  function contarPorCategoria(id) {
    return contar({ categoria_id: `eq.${id}` });
  }

  /** Al borrar la cuenta estos movimientos SE BORRAN (on delete cascade). */
  async function contarPorCuenta(id) {
    const [origen, destino] = await Promise.all([
      contar({ cuenta_id: `eq.${id}` }),
      contar({ cuenta_destino_id: `eq.${id}` }),
    ]);
    return origen + destino;
  }

  return { ...base, listarDelMes, listarFuturos, totalesPorCuenta, listarDeTarjetas,
           listarUltimos, ultimos, crearVarios, listarDeCompra, eliminarPorPago,
           eliminarPendientesDeCompra, contarPorCategoria, contarPorCuenta };
}

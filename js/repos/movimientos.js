/* Repositorio de movimientos. Mismo contrato CRUD que los demás, más las
   consultas propias de esta entidad.

   Se filtra por MES en el servidor (que es lo que acota el volumen) y el
   resto de filtros se aplican en el cliente sobre esas filas: a escala
   personal son decenas, y así la búsqueda responde mientras se escribe. */

import { crearRepo } from './base.js';
import { rangoDelMes } from '../calc/fechas.js';

export function repoMovimientos(cliente) {
  const base = crearRepo(cliente, 'movimientos', { orden: 'fecha.desc' });

  /** @param mes 'YYYY-MM' */
  function listarDelMes(mes, extra = {}) {
    const { desde, hasta } = rangoDelMes(mes);
    return base.listar({ fecha: [`gte.${desde}`, `lte.${hasta}`], ...extra });
  }

  /** Las N cuotas de una compra se insertan de un viaje, no una por una. */
  function crearVarios(filas) {
    return cliente.insertar('movimientos', filas);
  }

  function listarDeCompra(compraId) {
    return base.listar({ compra_id: `eq.${compraId}`, order: 'cuota_num.asc' });
  }

  /* Borra las cuotas que aún no se cobran, con un filtro en vez de N borrados:
     `fecha > hoy` es exactamente la definición de "pendiente". */
  function eliminarPendientesDeCompra(compraId, hoy) {
    return cliente.eliminar('movimientos', { compra_id: `eq.${compraId}`, fecha: `gt.${hoy}` });
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

  return { ...base, listarDelMes, ultimos, crearVarios, listarDeCompra,
           eliminarPendientesDeCompra, contarPorCategoria, contarPorCuenta };
}

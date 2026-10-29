/* Lo que el Resumen necesita del negocio, ya calculado. Carga las
   operaciones y los clientes una vez y arma todo lo que pintan las dos
   vistas: el bloque del mes y la pantalla de la pastilla Negocio. */

import { totalesDeNegocio, totalPorCobrar, estaPendiente } from '../../negocio/pago-recibo.js';
import { porMes } from '../../negocio/por-mes.js';
import { clientesDelMes } from '../../negocio/por-cliente.js';
import { tiemposDeCobro, pendientesViejos } from '../../negocio/tiempos.js';
import { ultimasOperaciones } from '../../negocio/ultimas.js';

/* Las operaciones se nombran por su cliente y, si no tiene, por su
   descripción: es como las buscas en Por cobrar. */
function conNombre(pendientes, clientes) {
  const nombres = new Map(clientes.map((c) => [c.id, c.nombre]));
  return pendientes.map((p) => ({ ...p, cliente: nombres.get(p.cliente_id) ?? null }));
}

/** @returns { negocio, pendientes }; sin la bandera, negocio en null. */
export async function datosDeNegocio(contexto, mes, hoy) {
  if (!contexto.perfil?.negocio) return { negocio: null, pendientes: [] };
  const [pagos, clientes] = await Promise.all([
    contexto.pagos.listar(),
    contexto.clientes.listar().catch(() => []),   // si fallan, todo es "sin cliente"
  ]);
  const pendientes = pagos.filter(estaPendiente);
  const serie = porMes(pagos, mes, 6);
  return {
    negocio: {
      ...totalesDeNegocio(pagos, mes),
      porCobrar: { total: totalPorCobrar(pagos), cuantos: pendientes.length },
      porMes: serie,
      /* Uno por cada mes de la gráfica: al tocar una barra cambia la lista. */
      clientesPorMes: Object.fromEntries(
        serie.map((m) => [m.mes, clientesDelMes(pagos, clientes, m.mes)])),
      tiempos: tiemposDeCobro(pagos, hoy),
      viejos: conNombre(pendientesViejos(pagos, hoy), clientes),
      ultimas: conNombre(ultimasOperaciones(pagos, 5), clientes),
    },
    pendientes,
  };
}

/* El cierre del día de un usuario, calculado con los MISMOS repos y la misma
   lógica que el Resumen de la app (js/repos, js/calc, js/negocio): lo que dice
   la notificación es lo que vas a ver al abrirla. */

import { repoMovimientos } from '../../../js/repos/movimientos.js';
import { repoTarjetas } from '../../../js/repos/tarjetas.js';
import { repoCompras } from '../../../js/repos/compras.js';
import { repoPlanItems } from '../../../js/repos/plan-items.js';
import { repoPagosRecibo } from '../../../js/repos/pagos-recibo.js';
import { repoBandeja } from '../../../js/repos/bandeja.js';
import { proximosVencimientos } from '../../../js/calc/vencimientos.js';
import { sumarDias } from '../../../js/calc/fechas.js';
import { armarResumenDiario } from '../../../js/calc/resumen-diario.js';
import { pendientesViejos } from '../../../js/negocio/tiempos.js';
import { clienteDeUsuario } from './servidor.js';

/** 'YYYY-MM-DD' en la Ciudad de México: el servidor vive en UTC y a las 8 pm
    de aquí allá ya es mañana. */
export function hoyEnMexico(ahora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(ahora);
}

async function cobrosViejos(cliente, perfil, hoy) {
  if (!perfil?.negocio) return 0;
  return pendientesViejos(await repoPagosRecibo(cliente).listarPendientes(), hoy).length;
}

/** @returns el mensaje listo para enviarPush() */
export async function resumenDe(userId, hoy) {
  const cliente = clienteDeUsuario(userId);
  const movimientos = repoMovimientos(cliente);
  /* El mismo rango que el Resumen: los fijos se dan por pagados con un
     movimiento de unos días antes o después de su fecha. */
  const [deTarjetas, cercanos, tarjetas, compras, planItems, bandeja, [perfil]] =
    await Promise.all([
      movimientos.listarDeTarjetas(),
      movimientos.listarEntre(sumarDias(hoy, -13), sumarDias(hoy, 17)),
      repoTarjetas(cliente).listarActivas(),
      repoCompras(cliente).listar(),
      repoPlanItems(cliente).listarActivos(),
      repoBandeja(cliente).pendientes(),
      cliente.seleccionar('perfiles', { limit: '1' }),
    ]);

  const vencimientos = proximosVencimientos(
    { tarjetas, movimientos: deTarjetas, compras, planItems, registrados: cercanos },
    { hoy, dias: 2 });
  return armarResumenDiario({
    movimientos: cercanos, vencimientos, porConfirmar: bandeja.length,
    cobrosViejos: await cobrosViejos(cliente, perfil, hoy),
  }, hoy);
}

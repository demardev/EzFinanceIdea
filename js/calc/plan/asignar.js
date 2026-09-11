/* Reparte los ingresos entre las obligaciones, en orden de vencimiento.
   Función PURA: sin red, sin DOM.

   Recorre la línea de tiempo llevando el saldo de cada cuenta. Cada ingreso
   abre un "sobre"; cada obligación se cuelga del sobre abierto en ese momento.
   Si la cuenta asignada no alcanza pero otra tiene excedente, se propone una
   transferencia explícita; si aun así no alcanza, se reporta el faltante con
   su monto exacto y su fecha. */

import { sumar, redondear } from '../dinero.js';
import { diasEntre, sumarDias } from '../fechas.js';

function totalDe(saldos) {
  return sumar(...Object.values(saldos));
}

/** Saca `falta` de las otras cuentas, la más holgada primero. */
function moverDeOtras(saldos, cuentaId, falta, fecha, transferencias) {
  const otras = Object.keys(saldos)
    .filter((id) => id !== cuentaId && saldos[id] > 0)
    .sort((a, b) => saldos[b] - saldos[a]);

  let pendiente = falta;
  for (const id of otras) {
    if (pendiente <= 0) break;
    const mueve = redondear(Math.min(saldos[id], pendiente));
    saldos[id] = redondear(saldos[id] - mueve);
    saldos[cuentaId] = redondear((saldos[cuentaId] ?? 0) + mueve);
    transferencias.push({ desde: id, hacia: cuentaId, monto: mueve, antesDe: fecha });
    pendiente = redondear(pendiente - mueve);
  }
  return pendiente;
}

/** Un día por fecha, con el saldo total tras aplicar lo de ese día. */
function serieDiaria(desde, hasta, porFecha) {
  const puntos = [];
  const dias = diasEntre(desde, hasta);
  let acumulado = porFecha.saldoInicial;
  for (let i = 0; i <= dias; i += 1) {
    const fecha = sumarDias(desde, i);
    acumulado = redondear(acumulado + (porFecha.deltas[fecha] ?? 0));
    puntos.push({ fecha, total: acumulado });
  }
  return puntos;
}

/* El colchón se reparte por los DÍAS que cubre cada sobre, no por lo que
   trae: los variables se gastan día a día, y cada sobre los paga hasta que
   llega el siguiente ingreso. Lo de hoy solo aguanta hasta el primer cobro;
   un salario, un mes. El último absorbe el residuo para no perder centavos. */
function repartirColchon(sobres, colchon, hasta) {
  const dias = sobres.map((s, i) => {
    const siguiente = sobres[i + 1];
    s.colchonHasta = siguiente ? sumarDias(siguiente.fecha, -1) : hasta;
    return siguiente ? diasEntre(s.fecha, siguiente.fecha) : diasEntre(s.fecha, hasta) + 1;
  });
  const totalDias = dias.reduce((n, d) => n + d, 0);
  if (colchon <= 0 || totalDias <= 0) return;
  sobres.forEach((s, i) => { s.colchon = redondear((colchon * dias[i]) / totalDias); });
  const ultimo = sobres.at(-1);
  ultimo.colchon = redondear(ultimo.colchon + (colchon - sumar(...sobres.map((s) => s.colchon))));
}

function sobreNuevo(nombre, fecha, monto) {
  return { nombre, fecha, monto, asignaciones: [], colchon: 0, libre: 0, traspasos: [] };
}

/* Si un sobre se queda corto y los anteriores tienen sobrante, lo cubren: es
   el mismo dinero, solo estaba etiquetado en otro sobre. Se anota en los dos
   para que la cuenta de cada uno se pueda seguir. Un sobre queda en rojo solo
   cuando antes no sobra lo suficiente. El más cercano da primero. */
function cubrirConSobrantes(sobres) {
  sobres.forEach((sobre, i) => {
    for (let j = i - 1; j >= 0 && sobre.libre < 0; j -= 1) {
      const donante = sobres[j];
      if (donante.libre <= 0) continue;
      const pasa = redondear(Math.min(donante.libre, -sobre.libre));
      donante.libre = redondear(donante.libre - pasa);
      sobre.libre = redondear(sobre.libre + pasa);
      /* Con fecha: varios sobres se llaman igual ("Salario") y sin ella no se
         sabría a cuál fue. */
      donante.traspasos.push({ nombre: sobre.nombre, fecha: sobre.fecha, monto: -pasa });
      sobre.traspasos.push({ nombre: donante.nombre, fecha: donante.fecha, monto: pasa });
    }
  });
}

/** Recorre la línea de tiempo llevando el saldo de cada cuenta. */
function recorrer(eventos, estado, caja) {
  let abierto = caja.sobres[0];

  for (const evento of eventos) {
    const monto = redondear(evento.monto);
    caja.deltas[evento.fecha] = redondear((caja.deltas[evento.fecha] ?? 0)
      + (evento.clase === 'ingreso' ? monto : -monto));

    if (evento.clase === 'ingreso') {
      const cuenta = evento.cuentaId ?? '_sin_cuenta';
      estado[cuenta] = redondear((estado[cuenta] ?? 0) + monto);
      abierto = sobreNuevo(evento.nombre, evento.fecha, monto);
      caja.sobres.push(abierto);
      continue;
    }

    const cuenta = evento.cuentaId ?? Object.keys(estado)[0] ?? '_sin_cuenta';
    estado[cuenta] ??= 0;
    let falta = redondear(monto - estado[cuenta]);
    if (falta > 0) falta = moverDeOtras(estado, cuenta, falta, evento.fecha, caja.transferencias);
    if (falta > 0) {
      caja.faltantes.push({ nombre: evento.nombre, fecha: evento.fecha, monto: falta,
                            cuentaId: cuenta, origen: evento.origen });
    }
    estado[cuenta] = redondear(estado[cuenta] - Math.min(monto, estado[cuenta] + falta));
    abierto.asignaciones.push({ nombre: evento.nombre, fecha: evento.fecha,
                                monto, origen: evento.origen, nota: evento.nota });
  }
}

export function asignar({ eventos, saldos, colchon = 0, desde, hasta }) {
  const estado = { ...saldos };
  const saldoInicial = totalDe(estado);
  const caja = {
    deltas: {}, transferencias: [], faltantes: [],
    sobres: [sobreNuevo('Saldo de hoy', desde, saldoInicial)],
  };

  recorrer(eventos, estado, caja);

  const { sobres, faltantes, transferencias, deltas } = caja;
  repartirColchon(sobres, colchon, hasta);
  sobres.forEach((s) => {
    s.libre = redondear(s.monto - sumar(...s.asignaciones.map((a) => a.monto)) - s.colchon);
  });
  cubrirConSobrantes(sobres);

  const serie = serieDiaria(desde, hasta, { saldoInicial, deltas });
  const diaMasAjustado = serie.reduce((peor, p) => (p.total < peor.total ? p : peor), serie[0]);

  return {
    /* Un sobre sin dinero se enseña igual si le tocan días de colchón: si
       no, parte del colchón desaparecería de la vista. */
    sobres: sobres.filter((s) => s.monto > 0 || s.asignaciones.length || s.colchon > 0),
    faltantes,
    transferencias,
    serie,
    diaMasAjustado,
    saldosFinales: estado,
    libreTotal: redondear(serie.at(-1).total - colchon),
  };
}

/* Las reglas para emparejar las líneas de un estado de cuenta con los
   movimientos de la app. Función PURA: sin red, sin DOM. La usa
   calc/emparejar-estado.js, que arma el resultado y los saldos.

   Una "partida" es cualquier cosa de un lado que pesa en el saldo, con
   `sentido` ('cargo' sube la deuda, 'credito' la baja) y monto positivo:
   - del banco: cada línea, más los intereses que van fuera de la lista;
   - de la app: cargos, pagos y reembolsos de la tarjeta, más un crédito por
     cada compra pasada a minicuotas (el banco las acredita: "CR MINICUOTAS"). */

import { diasEntre } from './fechas.js';

const TOLERANCIA_DIAS = 3;   // el banco a veces pone la fecha de aplicación, días después

const CUOTA = /CUOTA\s*:?\s*0*(\d+)\s*\/\s*0*(\d+)/i;

/** Las líneas del banco como partidas, con el número de cuota si lo trae. */
export function partidasDelBanco(lectura) {
  const lineas = lectura.movimientos.map((m, i) => {
    const cuota = m.concepto.match(CUOTA);
    return { ...m, i, cuota: cuota ? { num: Number(cuota[1]), total: Number(cuota[2]) } : null };
  });
  if (lectura.intereses_fuera_de_lista > 0) {
    lineas.push({ i: lineas.length, fecha: lectura.fecha_corte, concepto: 'Intereses del corte',
                  monto: lectura.intereses_fuera_de_lista, sentido: 'cargo', cuota: null,
                  esInteres: true });
  }
  return lineas;
}

/** Un movimiento de la app como partida, o null si no pesa en la tarjeta. */
export function partidaDeLaApp(m) {
  if (m.tipo === 'egreso' && m.tarjeta_id) {
    const cuota = m.compra_id && m.cuota_num > 0
      ? { compra: m.compra_id, num: m.cuota_num, total: m.cuota_total } : null;
    return { movimiento: m, fecha: m.fecha, monto: Number(m.monto), sentido: 'cargo', cuota };
  }
  const credito = (m.tipo === 'transferencia' && m.tarjeta_destino_id)
    || (m.tipo === 'ingreso' && m.tarjeta_id);
  return credito ? { movimiento: m, fecha: m.fecha, monto: Number(m.monto), sentido: 'credito', cuota: null } : null;
}

/** El crédito que el banco da por cada compra que pasaste a minicuotas. */
export function creditosDeTraslados(movimientos, compras) {
  const fechas = new Map(compras.filter((c) => c.tipo === 'minicuotas').map((c) => [c.id, c.fecha_compra]));
  return movimientos
    .filter((m) => m.traslado_id && !m.compra_id && fechas.has(m.traslado_id))
    .map((m) => ({ movimiento: m, fecha: fechas.get(m.traslado_id), monto: Number(m.monto),
                   sentido: 'credito', cuota: null, deTraslado: true }));
}

const distancia = (linea, app, hasta) => Math.abs(diasEntre(linea.fecha ?? hasta, app.fecha));

/* ---------------------------------------------------------- parecidos --- */

const GENERICAS = new Set(['COMPRA', 'PAGO', 'CUOTA', 'SALVADO', 'SALVADOR', 'PLAZA', 'RECIBIDO',
                           'GRACIAS', 'MINICUOTAS']);

function palabras(texto) {
  return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
    .split(/[^A-Z0-9]+/).filter((p) => p.length >= 4 && !GENERICAS.has(p) && !/^\d+$/.test(p));
}

/** "SELECTOS SAN BARTOLO ILOPANGO" y "Selectos San Bartolo" se parecen. */
export function seParecen(a, b) {
  const deA = new Set(palabras(a));
  return palabras(b).some((p) => deA.has(p));
}

/* ------------------------------------------------------------- pasos --- */

/**
 * Cada paso recorre las líneas que faltan y busca su pareja entre las
 * partidas libres de la app. Devuelve pares { linea, app, motivo } y saca de
 * las listas lo que empareja. `motivo` null = emparejado tal cual.
 */
function paso(lineas, libres, buscar) {
  const pares = [];
  for (const linea of [...lineas]) {
    const encontrado = buscar(linea, libres);
    if (!encontrado) continue;
    const { app, motivo = null } = encontrado;
    pares.push({ linea, app, motivo });
    lineas.splice(lineas.indexOf(linea), 1);
    libres.splice(libres.indexOf(app), 1);
  }
  return pares;
}

/** La más cercana en fecha entre las que cumplen `prueba`. */
const masCercana = (libres, prueba, linea, hasta) => libres.filter(prueba)
  .sort((x, y) => distancia(linea, x, hasta) - distancia(linea, y, hasta))[0];

export function emparejarPartidas(lineasBanco, partidasApp, { desde, hasta }) {
  const lineas = [...lineasBanco];
  const libres = [...partidasApp];
  const enPeriodo = (app) => app.fecha > desde && app.fecha <= hasta;
  const mismo = (linea) => (app) => app.sentido === linea.sentido && app.monto === linea.monto;

  /* Cuotas: por su número, aunque la fecha no coincida. Si la app la cobra en
     otro corte, es una cuota corrida. */
  const cuotas = paso(lineas, libres, (linea, apps) => {
    if (!linea.cuota) return null;
    const app = apps.find((a) => a.cuota && a.cuota.num === linea.cuota.num
      && a.cuota.total === linea.cuota.total && a.monto === linea.monto);
    return app ? { app, motivo: enPeriodo(app) ? null : 'cuota' } : null;
  });
  const exactos = paso(lineas, libres, (linea, apps) => {
    const app = masCercana(apps, (a) => mismo(linea)(a) && (linea.fecha
      ? distancia(linea, a, hasta) <= TOLERANCIA_DIAS : enPeriodo(a)), linea, hasta);
    return app ? { app } : null;
  });
  const porFecha = paso(lineas, libres, (linea, apps) => {
    const app = masCercana(apps, mismo(linea), linea, hasta);
    return app ? { app, motivo: 'fecha' } : null;
  });
  const porMonto = paso(lineas, libres, (linea, apps) => {
    const app = masCercana(apps, (a) => a.sentido === linea.sentido && a.monto !== linea.monto
      && distancia(linea, a, hasta) <= TOLERANCIA_DIAS
      && seParecen(linea.concepto, a.movimiento.descripcion), linea, hasta);
    return app ? { app, motivo: 'monto' } : null;
  });
  return { pares: [...cuotas, ...exactos, ...porFecha, ...porMonto], lineas, libres };
}

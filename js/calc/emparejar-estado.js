/* Comparar un estado de cuenta (ya leído y comprobado) con los movimientos de
   la app: qué falta, qué sobra y qué está distinto en ese corte, y cuánto de
   la diferencia de saldo explica cada cosa. Función PURA: sin red, sin DOM.
   Las reglas de emparejado están en calc/emparejar-reglas.js.

   El saldo de la app se calcula "como el banco": las compras que pasaste a
   minicuotas cuentan como cargo el día que las hiciste y salen con un crédito
   el día del traslado, y las cuotas cuentan el día que se cobran.

   `sobran` son movimientos del corte que el banco no trae; si son de los
   últimos días van aparte, en `delSiguiente`: suelen estar bien.

   Cada diferencia trae `efecto`: cuánto mueve el saldo de la app frente al del
   banco. arrastre + la suma de los efectos = diferencia, siempre; lo que no
   cuadre de esa suma es `sinExplicar` (debería ser 0). */

import { sumar, redondear } from './dinero.js';
import { partes, sumarDias } from './fechas.js';
import { calcularCiclo } from './ciclo-tarjeta.js';
import { conSaldoInicial } from './saldo-inicial-tarjeta.js';
import { sinCuotasYaPagadas } from './cuotas.js';
import { partidasDelBanco, partidaDeLaApp, creditosDeTraslados,
         emparejarPartidas } from './emparejar-reglas.js';

const conSigno = (p) => (p.sentido === 'cargo' ? p.monto : -p.monto);

/** Lo que pesa en la deuda de la tarjeta, como partidas (sin las cuotas que ya venían pagadas). */
function partidasDeLaTarjeta(tarjeta, movimientos, compras) {
  const suyos = movimientos.filter(
    (m) => m.tarjeta_id === tarjeta.id || m.tarjeta_destino_id === tarjeta.id);
  return [
    ...conSaldoInicial(sinCuotasYaPagadas(suyos, compras), tarjeta).map(partidaDeLaApp).filter(Boolean),
    ...creditosDeTraslados(suyos, compras),
  ];
}

/** Lo que la app dice que se debía ese día, contado como el banco. */
const saldoAl = (partidas, fecha) => sumar(...partidas.filter((p) => p.fecha <= fecha).map(conSigno));

/** El corte anterior al del estado de cuenta, con su mismo día de corte. */
function periodoDe(lectura) {
  const hasta = lectura.fecha_corte;
  const { fechaCorteAnterior } = calcularCiclo(partes(hasta).dia, 1, hasta);
  return { desde: fechaCorteAnterior, hasta };
}

/** Cuánto mueve cada cosa el saldo de la app frente al del banco, en este corte. */
function efectoDe(par, periodo) {
  /* En un grupo (una partida = varias del otro lado), la que se repite cuenta una vez. */
  const enPeriodo = par.app && par.resto !== 'app'
    && par.app.fecha > periodo.desde && par.app.fecha <= periodo.hasta;
  const deLaApp = enPeriodo ? conSigno(par.app) : 0;
  const delBanco = par.linea && par.resto !== 'linea' ? conSigno(par.linea) : 0;
  return redondear(deLaApp - delBanco);
}

const DIAS_ALREDEDOR = 5;   // de la app solo se miran partidas cerca del periodo
const DIAS_AL_FINAL = 3;    // lo de estos últimos días el banco puede aplicarlo en el siguiente

/**
 * @param lectura    de normalizarLectura() (calc/estado-cuenta.js)
 * @param movimientos todos los de la app (se filtran los de la tarjeta)
 * @param compras    las compras a cuotas, para las ya pagadas y los traslados
 */
export function emparejarEstado({ lectura, tarjeta, movimientos, compras }) {
  const periodo = periodoDe(lectura);
  const todas = partidasDeLaTarjeta(tarjeta, movimientos, compras);
  const desdeVentana = calcularCiclo(partes(periodo.desde).dia, 1, periodo.desde).fechaCorteAnterior;
  const cerca = todas.filter((p) => p.fecha > desdeVentana
    && p.fecha <= sumarDias(periodo.hasta, DIAS_ALREDEDOR));
  const { pares, lineas, libres } = emparejarPartidas(partidasDelBanco(lectura), cerca, periodo);

  const conEfecto = (par) => ({ linea: par.linea, movimiento: par.app?.movimiento ?? null,
    motivo: par.motivo, deTraslado: Boolean(par.app?.deTraslado), agrupado: Boolean(par.resto)
      || pares.some((o) => o !== par && o.resto && (o.app === par.app || o.linea === par.linea)),
    efecto: efectoDe(par, periodo) });
  const emparejados = pares.filter((p) => !p.motivo).map(conEfecto);
  const distintos = pares.filter((p) => p.motivo).map(conEfecto);
  const faltan = lineas.map((linea) => ({ linea, movimiento: null, efecto: efectoDe({ linea }, periodo) }));
  const sueltas = libres.filter((a) => a.fecha > periodo.desde && a.fecha <= periodo.hasta)
    .map((app) => ({ linea: null, movimiento: app.movimiento, deTraslado: Boolean(app.deTraslado),
                     efecto: efectoDe({ app }, periodo) }));
  /* Lo de los últimos días del corte que el banco no trae casi siempre está bien:
     el banco lo aplicó uno o dos días después y sale en el siguiente estado de
     cuenta. Las cuotas no: el banco las cobra en su fecha. */
  const ultimosDias = sumarDias(periodo.hasta, -DIAS_AL_FINAL);
  const esDelSiguiente = (s) => s.movimiento.fecha > ultimosDias && !s.movimiento.compra_id
    && !s.deTraslado && !s.movimiento.saldoInicial;
  const delSiguiente = sueltas.filter(esDelSiguiente);
  const sobran = sueltas.filter((s) => !esDelSiguiente(s));

  const saldoApp = saldoAl(todas, periodo.hasta);
  const diferencia = redondear(saldoApp - lectura.saldo_al_corte);
  const arrastre = redondear(saldoAl(todas, periodo.desde) - lectura.saldo_anterior);
  const explicado = sumar(arrastre, ...[...emparejados, ...distintos, ...faltan, ...sueltas]
    .map((x) => x.efecto));
  return { periodo, emparejados, distintos, faltan, sobran, delSiguiente, saldoApp,
           saldoBanco: lectura.saldo_al_corte, diferencia, arrastre,
           totalSobran: sumar(...sobran.map((x) => x.efecto)),
           totalDelSiguiente: sumar(...delSiguiente.map((x) => x.efecto)),
           sinExplicar: redondear(diferencia - explicado) };
}

/* Conciliar una tarjeta con el banco. Función PURA: sin red, sin DOM.

   Se comparan dos cosas, cada una solo si escribiste su número:
   - Hoy: el saldo a la fecha del banco MÁS lo que tiene en proceso
     (flotante), contra la deuda de la app. La app registra las compras el día
     que las haces; el banco las separa hasta aplicarlas.
   - Al corte: el saldo del estado de cuenta contra lo que la app dice que
     debías ese día. Es lo que descubre compras puestas en el ciclo equivocado,
     que en la deuda de hoy no se notan.

   No corrige nada: dice cuánto no cuadra y qué lo explicaría. */

import { redondear, sumar } from './dinero.js';
import { pistasDeHoy, pistasDelCorte, posiblesCancelaciones,
         combinacionExacta } from './conciliacion-pistas.js';

/** Cargos menos pagos con fecha hasta ese día, incluido. Negativo = a favor. */
export function saldoAl(movimientos, fecha) {
  const hasta = movimientos.filter((m) => m.fecha <= fecha);
  const cargos = hasta.filter((m) => m.tipo === 'egreso').map((m) => m.monto);
  const pagos = hasta.filter((m) => m.tipo === 'transferencia').map((m) => m.monto);
  return redondear(sumar(...cargos) - sumar(...pagos));
}

/* Primero las pistas que explican la diferencia, para que se lean primero. */
function comparar(app, banco, pistas) {
  const diferencia = redondear(app - banco);
  const explican = combinacionExacta(pistas.map((p) => p.efecto), -diferencia);
  const orden = [...(explican ?? []), ...pistas.map((_, i) => i)
    .filter((i) => !explican?.includes(i))];
  return {
    app, banco, diferencia,
    pistas: orden.map((i) => pistas[i]),
    explican: explican ? explican.map((_, k) => k) : null,
  };
}

const escrito = (n) => n !== null && n !== undefined && n !== '';

/**
 * @param entrada { tarjeta, deudores, planItems, ciclo } — `deudores` como los
 *                da cargosDeTarjeta(); `ciclo` de calcularCiclo(), con su `hoy`
 * @param banco   { saldo, flotante, saldoAlCorte } — null o ausente = no se compara
 * @returns { hoy, corte, cancelaciones }; `hoy` y `corte` son
 *          { app, banco, diferencia (app − banco), pistas, explican } o null.
 *          `explican` son índices en `pistas`: [] si cuadra, null si nada lo da.
 */
export function conciliar(entrada, banco) {
  const { deudores, ciclo } = entrada;
  return {
    hoy: escrito(banco.saldo)
      ? comparar(saldoAl(deudores, ciclo.hoy), sumar(banco.saldo, banco.flotante),
                 pistasDeHoy(entrada))
      : null,
    corte: escrito(banco.saldoAlCorte)
      ? comparar(saldoAl(deudores, ciclo.fechaUltimoCorte), redondear(banco.saldoAlCorte),
                 pistasDelCorte(entrada))
      : null,
    cancelaciones: posiblesCancelaciones(entrada),
  };
}

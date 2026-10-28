/* Los cálculos de UNA tarjeta que usa la pantalla, juntos en un solo lugar
   para que la lista, el detalle y la conciliación partan de lo mismo.
   Solo junta funciones de calc/: aquí no hay aritmética propia. */

import { calcularCiclo } from '../../calc/ciclo-tarjeta.js';
import { calcularDeuda } from '../../calc/deuda-tarjeta.js';
import { cargosDeTarjeta, conSaldoInicial } from '../../calc/saldo-inicial-tarjeta.js';
import { desgloseDeDeuda } from '../../calc/desglose-tarjeta.js';

/** Los movimientos que tocan esta tarjeta: cargos y pagos. */
export function deLaTarjeta(movimientos, id) {
  return movimientos.filter((m) => m.tarjeta_id === id || m.tarjeta_destino_id === id);
}

export function calcularTodo(tarjeta, movimientos, compras) {
  /* El saldo inicial también se lista, en su corte, para que se vea de dónde sale. */
  const propios = conSaldoInicial(deLaTarjeta(movimientos, tarjeta.id), tarjeta);
  const ciclo = calcularCiclo(tarjeta.dia_corte, tarjeta.dia_limite_pago);
  /* Las cuotas que ya venían pagadas siguen en el historial pero no son deuda. */
  const deudores = cargosDeTarjeta(tarjeta, movimientos, compras);
  /* `comprometido` sale del propio cálculo: si se sumara aparte, el
     disponible y esa línea podrían contar cosas distintas. */
  return { ciclo, propios, deudores,
           deuda: calcularDeuda(deudores, ciclo, tarjeta.limite_credito),
           desglose: desgloseDeDeuda(deudores, ciclo) };
}

/** Lo que la conciliación necesita de esta tarjeta, con los datos de este momento. */
export function entradaDe(datos, tarjetaId) {
  const tarjeta = datos.tarjetas.find((t) => t.id === tarjetaId);
  const { ciclo, deudores } = calcularTodo(tarjeta, datos.movimientos, datos.compras);
  return { tarjeta, ciclo, deudores, planItems: datos.fijos };
}

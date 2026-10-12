/* Pruebas del saldo pendiente con que arranca una tarjeta — escritas antes
   que la implementación. Es el caso real que lo motivó: Cuscatlán, corte 8,
   pago 5, hoy 12/oct/2026. La app se empezó a usar con el corte de septiembre
   ya en curso, así que sus compras de agosto no existen aquí. */

import { describir, igual } from './marco.js';
import { conSaldoInicial, cargosDeTarjeta } from '../calc/saldo-inicial-tarjeta.js';
import { desgloseDeDeuda, efectoDeSaldoInicial } from '../calc/desglose-tarjeta.js';
import { corteQueIncluye, calcularCiclo } from '../calc/ciclo-tarjeta.js';
import { deudaTotalDeTarjetas } from '../calc/deuda-tarjeta.js';

const HOY = '2026-10-12';
const TARJETA = { id: 'cus', nombre: 'Cuscatlán', dia_corte: 8, dia_limite_pago: 5,
                  limite_credito: 0, saldo_inicial: 0, fecha_saldo_inicial: null };
const CON_SALDO = { ...TARJETA, saldo_inicial: 74.69, fecha_saldo_inicial: '2026-09-08' };

const cargo = (monto, fecha) => ({ tipo: 'egreso', monto, fecha, tarjeta_id: 'cus' });
const pago  = (monto, fecha) => ({ tipo: 'transferencia', monto, fecha, tarjeta_destino_id: 'cus' });

const MOVIMIENTOS = [
  cargo(15.75, '2026-08-19'),                              // cuota 4
  cargo(36.98, '2026-09-12'), cargo(20.98, '2026-09-12'),
  cargo(15.75, '2026-09-19'), cargo(0.98, '2026-09-26'),
  cargo(19.99, '2026-10-02'),
  pago(90.44, '2026-09-26'),
];

const ciclo = () => calcularCiclo(8, 5, HOY);

describir('saldo pendiente inicial de una tarjeta', (caso) => {
  caso('sin saldo inicial no se agrega nada', () => {
    igual(conSaldoInicial(MOVIMIENTOS, TARJETA).length, MOVIMIENTOS.length);
  });

  caso('entra como un cargo con su fecha, marcado como saldo inicial', () => {
    const lista = conSaldoInicial([], CON_SALDO);
    igual(lista.length, 1);
    igual(lista[0].tipo, 'egreso');
    igual(lista[0].monto, 74.69);
    igual(lista[0].fecha, '2026-09-08');
    igual(lista[0].tarjeta_id, 'cus');
    igual(lista[0].saldoInicial, true);
  });

  caso('sin fecha no cuenta: no se sabría en qué corte cae', () => {
    igual(conSaldoInicial([], { ...CON_SALDO, fecha_saldo_inicial: null }), []);
  });

  caso('cargosDeTarjeta junta los suyos, quita cuotas ya pagadas y suma el saldo', () => {
    const otra = { tipo: 'egreso', monto: 5, fecha: '2026-10-01', tarjeta_id: 'otra' };
    const lista = cargosDeTarjeta(CON_SALDO, [...MOVIMIENTOS, otra], []);
    igual(lista.length, MOVIMIENTOS.length + 1);
  });

  caso('la deuda total del resumen lo cuenta', () => {
    igual(deudaTotalDeTarjetas([TARJETA], MOVIMIENTOS, [], HOY), 19.99);
    igual(deudaTotalDeTarjetas([CON_SALDO], MOVIMIENTOS, [], HOY), 94.68);
  });
});

describir('corte en que cae una fecha', (caso) => {
  caso('el día del corte pertenece a ese corte', () => {
    igual(corteQueIncluye('2026-09-08', 8), '2026-09-08');
  });
  caso('un día después ya es del corte siguiente', () => {
    igual(corteQueIncluye('2026-09-09', 8), '2026-10-08');
  });
  caso('corte 30 en febrero se ajusta al último día', () => {
    igual(corteQueIncluye('2026-01-31', 30), '2026-02-28');
  });
});

describir('desglose de la deuda de una tarjeta', (caso) => {
  caso('saldo inicial + cargos − pagos = deuda', () => {
    const d = desgloseDeDeuda(cargosDeTarjeta(CON_SALDO, MOVIMIENTOS, []), ciclo());
    igual(d.saldoInicial, 74.69);
    igual(d.cargos, 110.43);
    igual(d.pagos, 90.44);
    igual(d.deudaTotal, 94.68);
    igual(d.saldoAFavor, 0);
    igual(d.faltaDelCorte, 94.68);
    igual(d.corte, '2026-10-08');
    igual(d.vence, '2026-11-05');
  });

  caso('los cargos que aún no ocurren no entran', () => {
    const d = desgloseDeDeuda([...MOVIMIENTOS, cargo(15.75, '2026-10-19')], ciclo());
    igual(d.cargos, 110.43);
  });

  caso('si los pagos cubren el corte, no falta nada', () => {
    // Lo que se compró después del corte se debe, pero todavía no toca pagarlo.
    const d = desgloseDeDeuda(
      [...MOVIMIENTOS, pago(19.99, '2026-10-10'), cargo(7, '2026-10-10')], ciclo());
    igual(d.faltaDelCorte, 0);
    igual(d.deudaTotal, 7);
  });

  caso('si sobra, es saldo a favor', () => {
    const d = desgloseDeDeuda([cargo(10, '2026-10-01'), pago(25, '2026-10-02')], ciclo());
    igual(d.deudaTotal, 0);
    igual(d.saldoAFavor, 15);
  });
});

describir('efecto de poner un saldo inicial', (caso) => {
  caso('dice en qué corte cae y cómo cambia la deuda', () => {
    const e = efectoDeSaldoInicial({ tarjeta: TARJETA, movimientos: MOVIMIENTOS, compras: [] },
                                   { monto: 74.69, fecha: '2026-09-08' }, HOY);
    igual(e, { corte: '2026-09-08', antes: 19.99, despues: 94.68 });
  });

  caso('al editarlo, "antes" es sin ningún saldo inicial', () => {
    const e = efectoDeSaldoInicial({ tarjeta: CON_SALDO, movimientos: MOVIMIENTOS, compras: [] },
                                   { monto: 10, fecha: '2026-09-08' }, HOY);
    igual(e.antes, 19.99);
    igual(e.despues, 29.99);
  });

  caso('el día de corte que se está escribiendo manda sobre el guardado', () => {
    const e = efectoDeSaldoInicial(
      { tarjeta: { ...TARJETA, dia_corte: 20 }, movimientos: [], compras: [] },
      { monto: 50, fecha: '2026-09-08' }, HOY);
    igual(e.corte, '2026-09-20');
  });
});

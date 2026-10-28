/* Pruebas de calc/conciliacion.js — escritas antes que la implementación.
   Los números son los de los incidentes reales de la Niu y la Tigo (oct 2026). */

import { describir, igual, cierto } from './marco.js';
import { conciliar, saldoAl } from '../calc/conciliacion.js';
import { combinacionExacta } from '../calc/conciliacion-pistas.js';
import { calcularCiclo } from '../calc/ciclo-tarjeta.js';

const HOY = '2026-10-28';
const cargo = (tarjeta, descripcion, monto, fecha, extra) =>
  ({ id: `${descripcion}-${fecha}`, tipo: 'egreso', descripcion, monto, fecha,
     tarjeta_id: tarjeta, ...extra });
const pago = (tarjeta, monto, fecha) =>
  ({ id: `pago-${monto}-${fecha}`, tipo: 'transferencia', descripcion: 'Pago', monto, fecha,
     tarjeta_destino_id: tarjeta });
const fijo = (tarjeta, nombre, monto, dia_mes) =>
  ({ id: nombre, nombre, monto, dia_mes, tarjeta_id: tarjeta, clase: 'gasto',
     variabilidad: 'fijo', activo: true });

/* Niu: corte el 11. El estado de cuenta del 11/oct dice $34.40. La app tenía
   Burger King y Texaco en ese corte, pero el banco los aplicó después. */
const NIU = { id: 'niu', dia_corte: 11, dia_limite_pago: 5 };
const MOVS_NIU = [
  cargo('niu', 'Compras Varias', 176.87, '2026-09-10'),
  cargo('niu', 'Compras', 372.68, '2026-09-25'),
  pago('niu', 541.55, '2026-09-28'),
  cargo('niu', "McDonald's PeYa", 14.50, '2026-10-03'),
  pago('niu', 14.50, '2026-10-07'),
  cargo('niu', 'Señor Birria', 26.40, '2026-10-09'),
  cargo('niu', 'Burger King PeYa', 18.45, '2026-10-10'),
  cargo('niu', 'Texaco', 14.40, '2026-10-11'),
  cargo('niu', 'Varias', 103.37, '2026-10-15'),
  cargo('niu', 'Freakies', 27.19, '2026-10-27'),
  pago('niu', 34.40, '2026-10-27'),
];
const FIJOS_NIU = [fijo('niu', 'PeYa Plus', 5.99, 26), fijo('niu', 'Seguro T. NIU', 1.75, 25)];
const entradaNiu = (movs = MOVS_NIU) => ({ tarjeta: NIU, deudores: movs, planItems: FIJOS_NIU,
                                           ciclo: calcularCiclo(11, 5, HOY) });

/* Tigo: corte el 8. Tres errores que se compensaban hasta dar $0.98. */
const TIGO = { id: 'tigo', dia_corte: 8, dia_limite_pago: 3 };
const MOVS_TIGO = [
  cargo('tigo', 'Corte de septiembre', 35.74, '2026-10-01'),
  pago('tigo', 35.74, '2026-10-27'),
  cargo('tigo', 'Varias', 125.62, '2026-10-15'),
  cargo('tigo', 'AirPods (6/36)', 15.75, '2026-10-19', { compra_id: 'c1' }),
];
const FIJOS_TIGO = [fijo('tigo', 'Seguro de crédito', 1.75, 23),
                    fijo('tigo', 'Telemovil', 14.98, 20)];
const entradaTigo = { tarjeta: TIGO, deudores: MOVS_TIGO, planItems: FIJOS_TIGO,
                      ciclo: calcularCiclo(8, 3, HOY) };

const nombres = (comparacion) =>
  comparacion.explican.map((i) => comparacion.pistas[i].nombre).sort();

describir('conciliar: saldo de la app a una fecha', (caso) => {
  caso('cargos menos pagos hasta ese día, incluido', () => {
    igual(saldoAl(MOVS_NIU, '2026-09-28'), 8);
    igual(saldoAl(MOVS_NIU, '2026-10-11'), 67.25);
  });

  caso('lo que vence después de la fecha no cuenta', () => {
    igual(saldoAl(MOVS_NIU, HOY), 163.41);
    igual(saldoAl(MOVS_TIGO, '2026-10-18'), 161.36);   // la cuota del 19 aún no
  });
});

describir('conciliar: el caso Niu', (caso) => {
  caso('al corte: la app debe $32.85 de más', () => {
    const { corte } = conciliar(entradaNiu(), { saldoAlCorte: 34.40 });
    igual(corte.app, 67.25);
    igual(corte.banco, 34.40);
    igual(corte.diferencia, 32.85);
  });

  caso('al corte: Burger King + Texaco explican la diferencia exacta', () => {
    const { corte } = conciliar(entradaNiu(), { saldoAlCorte: 34.40 });
    igual(nombres(corte), ['Burger King PeYa', 'Texaco']);
    const bk = corte.pistas.find((p) => p.nombre === 'Burger King PeYa');
    igual(bk.clase, 'cargo-corte');
    igual(bk.efecto, -18.45);
    igual(bk.mov.id, 'Burger King PeYa-2026-10-10');
  });

  caso('hoy: con el flotante, a la app le faltan $7.74', () => {
    const { hoy } = conciliar(entradaNiu(), { saldo: 143.96, flotante: 27.19 });
    igual(hoy.app, 163.41);
    igual(hoy.banco, 171.15);
    igual(hoy.diferencia, -7.74);
  });

  caso('hoy: los dos fijos sin registrar explican los $7.74', () => {
    const { hoy } = conciliar(entradaNiu(), { saldo: 143.96, flotante: 27.19 });
    igual(nombres(hoy), ['PeYa Plus', 'Seguro T. NIU']);
    const peya = hoy.pistas.find((p) => p.nombre === 'PeYa Plus');
    igual(peya.clase, 'fijo');
    igual(peya.efecto, 5.99);
    igual(peya.item.id, 'PeYa Plus');
  });

  caso('el pedido cancelado registrado como compra + pago sale como aviso', () => {
    const { cancelaciones } = conciliar(entradaNiu(), { saldo: 143.96 });
    igual(cancelaciones.length, 1);
    igual(cancelaciones[0].cargo.descripcion, "McDonald's PeYa");
    igual(cancelaciones[0].pago.fecha, '2026-10-07');
  });

  caso('ya corregida, cuadra al centavo en los dos', () => {
    const corregidos = MOVS_NIU
      .filter((m) => !['Burger King PeYa', 'Texaco', "McDonald's PeYa"].includes(m.descripcion)
                     && !(m.tipo === 'transferencia' && m.monto === 14.50))
      .concat(cargo('niu', 'Burger King PeYa', 18.45, '2026-10-12'),
              cargo('niu', 'Texaco', 14.40, '2026-10-12'),
              cargo('niu', 'PeYa Plus', 5.99, '2026-10-26'),
              cargo('niu', 'Seguro T. NIU', 1.75, '2026-10-27'));
    const r = conciliar(entradaNiu(corregidos),
                        { saldo: 143.96, flotante: 27.19, saldoAlCorte: 34.40 });
    igual(r.hoy.diferencia, 0);
    igual(r.corte.diferencia, 0);
    igual(r.hoy.explican, []);
    igual(r.cancelaciones, []);
  });
});

describir('conciliar: el caso Tigo', (caso) => {
  caso('hoy: la app tiene $0.98 de menos', () => {
    const { hoy } = conciliar(entradaTigo, { saldo: 127.37, flotante: 14.98 });
    igual(hoy.app, 141.37);
    igual(hoy.diferencia, -0.98);
  });

  caso('hoy: tres causas que se compensan explican los $0.98', () => {
    const { hoy } = conciliar(entradaTigo, { saldo: 127.37, flotante: 14.98 });
    igual(nombres(hoy), ['AirPods (6/36)', 'Seguro de crédito', 'Telemovil']);
    const cuota = hoy.pistas.find((p) => p.clase === 'cuota');
    igual(cuota.efecto, -15.75);
  });
});

describir('conciliar: lo que no se pidió no se compara', (caso) => {
  caso('sin saldo al corte no hay comparación del corte, y al revés', () => {
    igual(conciliar(entradaTigo, { saldo: 127.37 }).corte, null);
    igual(conciliar(entradaTigo, { saldoAlCorte: 35.74 }).hoy, null);
  });

  caso('si nada da la diferencia exacta, lo dice y deja las pistas', () => {
    const { hoy } = conciliar(entradaTigo, { saldo: 500 });
    igual(hoy.explican, null);
    cierto(hoy.pistas.length === 3, 'deberían quedar las tres pistas');
  });
});

describir('conciliar: combinación exacta', (caso) => {
  caso('busca la que suma justo el objetivo, al centavo', () => {
    igual(combinacionExacta([5.99, 1.75, 3.10], 7.74), [0, 1]);
    igual(combinacionExacta([1.75, 14.98, -15.75], 0.98), [0, 1, 2]);
  });

  caso('si hay varias, la de menos movimientos', () => {
    igual(combinacionExacta([1, 2, 3], 3), [2]);
  });

  caso('objetivo cero es la combinación vacía; imposible es null', () => {
    igual(combinacionExacta([1, 2], 0), []);
    igual(combinacionExacta([1, 2], 4), null);
  });
});

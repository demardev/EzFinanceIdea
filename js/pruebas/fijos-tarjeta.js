/* Pruebas de calc/fijos-tarjeta.js — escritas antes que la implementación. */

import { describir, igual, cierto } from './marco.js';
import { fijosPorCargar } from '../calc/fijos-tarjeta.js';
import { proximosVencimientos } from '../calc/vencimientos.js';
import { calcularCiclo } from '../calc/ciclo-tarjeta.js';

/* Como la Tigo: corte el 8. Hoy 28/oct: corte actual 09/sep–08/oct,
   ciclo abierto 09/oct–08/nov. */
const HOY = '2026-10-28';
const TIGO = { id: 'tigo', nombre: 'Tigo', dia_corte: 8, dia_limite_pago: 3,
               limite_credito: 660, archivada: false };
const CICLO = calcularCiclo(8, 3, HOY);

const fijo = (extra) => ({ id: 'f1', nombre: 'Seguro de crédito', clase: 'gasto',
  variabilidad: 'fijo', monto: 1.75, dia_mes: 23, tarjeta_id: 'tigo', activo: true,
  categoria_id: 'k-seguro', ...extra });
const cargo = (fecha, extra) => ({ tipo: 'egreso', descripcion: 'Seguro de crédito',
  monto: 1.75, fecha, tarjeta_id: 'tigo', ...extra });

const pendientes = (items, movs) =>
  fijosPorCargar(TIGO, items, movs, CICLO).map((p) => p.fecha);

describir('fijos de tarjeta por cargar', (caso) => {
  caso('sin registrar, falta en el ciclo abierto', () => {
    igual(pendientes([fijo()], []), ['2026-10-23']);
  });

  caso('el corte que ya cerró no se revisa: ya lo trae el estado de cuenta', () => {
    // El del 23/sep tampoco está registrado, y no sale.
    igual(pendientes([fijo({ dia_mes: 25 })], []), ['2026-10-25']);
  });

  caso('cada pendiente trae el item, su monto y cuántos días lleva', () => {
    const [p] = fijosPorCargar(TIGO, [fijo()], [cargo('2026-09-23')], CICLO);
    igual(p.item.id, 'f1');
    igual(p.monto, 1.75);
    igual(p.fecha, '2026-10-23');
    igual(p.dias, -5);
  });

  caso('registrado unos días después de su fecha, ya no falta', () => {
    // El banco lo cobró el 27 aunque el plan dice 23.
    igual(pendientes([fijo()], [cargo('2026-09-23'), cargo('2026-10-27')]), []);
  });

  caso('hasta 10 días de atraso cuenta como el mismo cargo', () => {
    const linea = fijo({ nombre: 'Telemovil', dia_mes: 20 });
    const movs = [cargo('2026-09-20', { descripcion: 'Telemovil' }),
                  cargo('2026-10-30', { descripcion: 'Telemovil' })];
    igual(pendientes([linea], movs), []);
  });

  caso('aunque el monto haya subido, por el nombre lo reconoce', () => {
    const movs = [cargo('2026-09-23'), cargo('2026-10-24', { monto: 2.10 })];
    igual(pendientes([fijo()], movs), []);
  });

  caso('el cargo del mes pasado no tapa el de este mes', () => {
    igual(pendientes([fijo()], [cargo('2026-09-23')]), ['2026-10-23']);
  });

  caso('si se cobró en otra tarjeta, aquí sigue faltando', () => {
    igual(pendientes([fijo()], [cargo('2026-09-23'), cargo('2026-10-23', { tarjeta_id: 'niu' })]),
          ['2026-10-23']);
  });

  caso('un cargo que el banco pasó antes del corte también cuenta', () => {
    // Plan dice día 10 (ciclo abierto), el banco lo aplicó el 07/oct (corte anterior).
    igual(pendientes([fijo({ dia_mes: 10 })], [cargo('2026-10-07')]), []);
  });

  caso('solo los gastos fijos activos de ESTA tarjeta y con día', () => {
    const items = [fijo({ tarjeta_id: 'niu' }), fijo({ tarjeta_id: null, cuenta_id: 'banco' }),
                   fijo({ activo: false }), fijo({ dia_mes: null }),
                   fijo({ variabilidad: 'variable' }), fijo({ clase: 'ingreso' })];
    igual(pendientes(items, []), []);
  });

  caso('salen ordenados por fecha', () => {
    const items = [fijo({ id: 'a', dia_mes: 25 }), fijo({ id: 'b', nombre: 'Internet', dia_mes: 12 })];
    const fechas = pendientes(items, []);
    cierto(fechas.every((f, i) => i === 0 || fechas[i - 1] <= f), 'no está ordenado');
  });
});

describir('fijos de tarjeta en los avisos del Resumen', (caso) => {
  const base = { tarjetas: [TIGO], movimientos: [cargo('2026-09-23')], compras: [],
                 registrados: [] };

  caso('siguen a la vista pasados los 3 días de gracia', () => {
    // 23/oct + 5 días: uno de cuenta ya se habría ido.
    const lista = proximosVencimientos({ ...base, planItems: [fijo()] }, { hoy: HOY, dias: 14 });
    const gasto = lista.filter((v) => v.clase === 'gasto');
    igual(gasto.length, 1);
    igual(gasto[0].fecha, '2026-10-23');
    igual(gasto[0].item.id, 'f1');
  });

  caso('se van al registrarlos en la tarjeta, aunque sea días después', () => {
    const lista = proximosVencimientos({ ...base, planItems: [fijo()],
      movimientos: [...base.movimientos, cargo('2026-10-27')] }, { hoy: HOY, dias: 14 });
    igual(lista.filter((v) => v.clase === 'gasto'), []);
  });
});

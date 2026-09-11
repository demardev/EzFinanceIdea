/* Pruebas de calc/plan/linea-tiempo.js — escritas antes que la implementación. */

import { describir, igual, cierto } from './marco.js';
import { ocurrenciasMensuales, eventosDePlan, colchonDelPeriodo, hayGastosVariables,
         eventosDeTarjeta, construirLineaTiempo } from '../calc/plan/linea-tiempo.js';
import { asignar } from '../calc/plan/asignar.js';

const ITEMS = [
  { id: 'p1', nombre: 'Sueldo', clase: 'ingreso', variabilidad: 'fijo',
    monto: 24000, dia_mes: 30, cuenta_id: 'banco', activo: true },
  { id: 'p2', nombre: 'Freelance', clase: 'ingreso', variabilidad: 'variable',
    monto_min: 5000, monto_max: 15000, cuenta_id: 'banco', activo: true },
  { id: 'p3', nombre: 'Renta', clase: 'gasto', variabilidad: 'fijo',
    monto: 12000, dia_mes: 1, cuenta_id: 'banco', activo: true },
  { id: 'p4', nombre: 'Netflix', clase: 'gasto', variabilidad: 'fijo',
    monto: 200, dia_mes: 5, tarjeta_id: 'bbva', activo: true },
  { id: 'p5', nombre: 'Comida', clase: 'gasto', variabilidad: 'variable',
    monto_min: 3000, monto_max: 6000, cuenta_id: 'efectivo', activo: true },
  { id: 'p6', nombre: 'Pausado', clase: 'gasto', variabilidad: 'fijo',
    monto: 999, dia_mes: 10, cuenta_id: 'banco', activo: false },
];

describir('línea de tiempo — ocurrencias', (caso) => {
  caso('repite el día del mes dentro del rango', () => {
    igual(ocurrenciasMensuales(15, '2026-09-01', '2026-11-30'),
          ['2026-09-15', '2026-10-15', '2026-11-15']);
  });

  caso('no incluye los días anteriores al inicio', () => {
    igual(ocurrenciasMensuales(5, '2026-09-10', '2026-10-31'), ['2026-10-05']);
  });

  caso('el día 31 se ajusta en los meses que no lo tienen', () => {
    igual(ocurrenciasMensuales(31, '2026-01-01', '2026-04-30'),
          ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  caso('rango vacío si no cabe ninguna ocurrencia', () => {
    igual(ocurrenciasMensuales(20, '2026-09-21', '2026-09-30'), []);
  });
});

describir('línea de tiempo — eventos del plan', (caso) => {
  caso('los ingresos fijos entran con su día y su cuenta', () => {
    const eventos = eventosDePlan(ITEMS, '2026-09-01', '2026-09-30', 'min');
    const sueldo = eventos.find((e) => e.nombre === 'Sueldo');
    igual(sueldo.clase, 'ingreso');
    igual(sueldo.monto, 24000);
    igual(sueldo.fecha, '2026-09-30');
    igual(sueldo.cuentaId, 'banco');
  });

  caso('los ingresos variables usan el mínimo en el escenario conservador', () => {
    const eventos = eventosDePlan(ITEMS, '2026-09-01', '2026-09-30', 'min');
    igual(eventos.find((e) => e.nombre === 'Freelance').monto, 5000);
  });

  caso('un ingreso variable sin día cae al inicio del rango', () => {
    const eventos = eventosDePlan(ITEMS, '2026-09-08', '2026-09-30', 'min');
    igual(eventos.find((e) => e.nombre === 'Freelance').fecha, '2026-09-08');
  });

  caso('los gastos fijos con cuenta son obligaciones en su día', () => {
    const eventos = eventosDePlan(ITEMS, '2026-09-01', '2026-09-30', 'min');
    const renta = eventos.find((e) => e.nombre === 'Renta');
    igual(renta.clase, 'obligacion');
    igual(renta.monto, 12000);
    igual(renta.fecha, '2026-09-01');
  });

  caso('los gastos fijos cargados a tarjeta NO son salida de efectivo', () => {
    // Netflix se cobra a la tarjeta: el dinero sale cuando se paga la tarjeta.
    const eventos = eventosDePlan(ITEMS, '2026-09-01', '2026-09-30', 'min');
    igual(eventos.filter((e) => e.nombre === 'Netflix').length, 0);
  });

  caso('los gastos variables no se agendan', () => {
    const eventos = eventosDePlan(ITEMS, '2026-09-01', '2026-09-30', 'min');
    igual(eventos.filter((e) => e.nombre === 'Comida').length, 0);
  });

  caso('lo pausado no entra', () => {
    const eventos = eventosDePlan(ITEMS, '2026-09-01', '2026-09-30', 'min');
    igual(eventos.filter((e) => e.nombre === 'Pausado').length, 0);
  });
});

describir('línea de tiempo — colchón de variables', (caso) => {
  caso('un mes completo reserva el total mensual', () => {
    igual(colchonDelPeriodo(ITEMS, 'min', '2026-09-01', '2026-09-30'), 3000);
  });

  caso('se prorratea por días cuando el horizonte es más corto', () => {
    // 15 días de 30 -> la mitad
    igual(colchonDelPeriodo(ITEMS, 'min', '2026-09-16', '2026-09-30'), 1500);
  });

  caso('el escenario pesimista usa el máximo', () => {
    igual(colchonDelPeriodo(ITEMS, 'max', '2026-09-01', '2026-09-30'), 6000);
  });

  caso('sin gastos variables, no hay colchón', () => {
    igual(colchonDelPeriodo([], 'min', '2026-09-01', '2026-09-30'), 0);
  });

  /* Sin ellos el veredicto asume que no gastas en comida: hay que avisarlo. */
  caso('detecta si hay gastos variables con qué armar el colchón', () => {
    igual(hayGastosVariables(ITEMS), true);                     // "Comida"
    igual(hayGastosVariables([]), false);
  });

  caso('un ingreso variable no cuenta como gasto variable', () => {
    igual(hayGastosVariables(ITEMS.filter((i) => i.nombre !== 'Comida')), false);
  });

  caso('un gasto variable pausado tampoco cuenta', () => {
    const pausado = ITEMS.map((i) => (i.nombre === 'Comida' ? { ...i, activo: false } : i));
    igual(hayGastosVariables(pausado), false);
  });
});

describir('línea de tiempo — pagos de tarjeta', (caso) => {
  const tarjeta = { id: 'bbva', nombre: 'BBVA', dia_corte: 15, dia_limite_pago: 5,
                    limite_credito: 50000, cuenta_pago_id: 'banco' };
  const cargo = (monto, fecha) => ({ tipo: 'egreso', monto, fecha, tarjeta_id: 'bbva' });

  caso('el saldo al corte vence en su fecha límite', () => {
    // Hoy 20/sep: último corte 15/sep, vence 05/oct.
    const eventos = eventosDeTarjeta(tarjeta, [cargo(3000, '2026-09-10')], [],
                                     '2026-09-20', '2026-10-31');
    const primero = eventos[0];
    igual(primero.clase, 'obligacion');
    igual(primero.monto, 3000);
    igual(primero.fecha, '2026-10-05');
    igual(primero.cuentaId, 'banco');
  });

  caso('proyecta el corte siguiente con lo del ciclo abierto', () => {
    const eventos = eventosDeTarjeta(tarjeta, [cargo(3000, '2026-09-10'), cargo(800, '2026-09-18')],
                                     [], '2026-09-20', '2026-11-30');
    igual(eventos.length, 2);
    igual(eventos[1].monto, 800);
    igual(eventos[1].fecha, '2026-11-05');   // corte 15/oct -> vence 05/nov
  });

  caso('las cuotas futuras caen en el corte que les toca', () => {
    const cuota = { tipo: 'egreso', monto: 500, fecha: '2026-10-20', tarjeta_id: 'bbva',
                    compra_id: 'c1', cuota_num: 2, cuota_total: 6 };
    const eventos = eventosDeTarjeta(tarjeta, [cuota], [], '2026-09-20', '2026-12-31');
    // Cae después del corte del 15/oct -> entra al corte del 15/nov, vence 05/dic.
    const conCuota = eventos.find((e) => e.monto === 500);
    igual(conCuota.fecha, '2026-12-05');
  });

  caso('un gasto fijo cargado a la tarjeta se proyecta al corte', () => {
    const netflix = [{ ...ITEMS[3] }];
    const eventos = eventosDeTarjeta(tarjeta, [], netflix, '2026-09-20', '2026-11-30');
    // Netflix el 5/oct entra al corte del 15/oct, que vence el 05/nov.
    igual(eventos.length, 1);
    igual(eventos[0].monto, 200);
    igual(eventos[0].fecha, '2026-11-05');
  });

  caso('sin deuda ni proyección, no hay eventos', () => {
    igual(eventosDeTarjeta(tarjeta, [], [], '2026-09-20', '2026-10-31'), []);
  });
});

describir('línea de tiempo — todo junto', (caso) => {
  caso('sale ordenada por fecha', () => {
    const linea = construirLineaTiempo(
      { planItems: ITEMS, tarjetas: [], movimientos: [], compras: [] },
      { hoy: '2026-09-01', hasta: '2026-09-30', escenario: 'min' });
    const fechas = linea.map((e) => e.fecha);
    cierto(fechas.every((f, i) => i === 0 || fechas[i - 1] <= f), 'no está ordenada');
  });

  /* Conservador: no se cuenta con que el depósito llegue antes que el cobro
     del banco el mismo día. Un pago que vence el día de cobro se paga con lo
     que ya tienes. */
  const MISMO_DIA = [
    { id: 'a', nombre: 'Pago', clase: 'gasto', variabilidad: 'fijo',
      monto: 150, dia_mes: 28, cuenta_id: 'banco', activo: true },
    { id: 'b', nombre: 'Salario', clase: 'ingreso', variabilidad: 'fijo',
      monto: 520, dia_mes: 28, cuenta_id: 'banco', activo: true },
  ];

  caso('a igual fecha, el pago va ANTES que el ingreso', () => {
    const linea = construirLineaTiempo(
      { planItems: MISMO_DIA, tarjetas: [], movimientos: [], compras: [] },
      { hoy: '2026-09-01', hasta: '2026-09-30', escenario: 'min' });
    igual(linea.map((e) => e.nombre), ['Pago', 'Salario']);
  });

  caso('un pago del día de cobro sale del dinero que ya tienes, no del salario', () => {
    const eventos = construirLineaTiempo(
      { planItems: MISMO_DIA, tarjetas: [], movimientos: [], compras: [] },
      { hoy: '2026-09-01', hasta: '2026-09-30', escenario: 'min' });
    const r = asignar({ eventos, saldos: { banco: 732 }, colchon: 0,
                        desde: '2026-09-01', hasta: '2026-09-30' });
    igual(r.sobres[0].nombre, 'Saldo de hoy');
    igual(r.sobres[0].asignaciones.map((a) => a.nombre), ['Pago']);
    igual(r.sobres[1].asignaciones, []);
  });

  caso('si hoy no alcanza para el pago del día de cobro, se avisa', () => {
    const eventos = construirLineaTiempo(
      { planItems: MISMO_DIA, tarjetas: [], movimientos: [], compras: [] },
      { hoy: '2026-09-01', hasta: '2026-09-30', escenario: 'min' });
    const r = asignar({ eventos, saldos: { banco: 100 }, colchon: 0,
                        desde: '2026-09-01', hasta: '2026-09-30' });
    igual(r.faltantes.map((f) => `${f.nombre} ${f.monto}`), ['Pago 50']);
  });
});

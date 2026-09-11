/* Pruebas de calc/plan/linea-tiempo.js — escritas antes que la implementación. */

import { describir, igual, cierto } from './marco.js';
import { ocurrenciasMensuales, eventosDePlan, colchonDelPeriodo, hayGastosVariables,
         ingresosSinFecha, variablesEnEfectivo,
         construirLineaTiempo } from '../calc/plan/linea-tiempo.js';
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

  caso('un ingreso variable con día usa el mínimo en el escenario conservador', () => {
    const conDia = ITEMS.map((i) => (i.nombre === 'Freelance' ? { ...i, dia_mes: 20 } : i));
    const freelance = eventosDePlan(conDia, '2026-09-01', '2026-09-30', 'min')
      .find((e) => e.nombre === 'Freelance');
    igual(`${freelance.fecha} ${freelance.monto}`, '2026-09-20 5000');
  });

  /* Un ingreso incierto y sin fecha no paga nada hasta que llega: cuando lo
     registras como movimiento ya está en el saldo de hoy. */
  caso('un ingreso variable sin día no se agenda', () => {
    const eventos = eventosDePlan(ITEMS, '2026-09-08', '2026-09-30', 'min');
    igual(eventos.some((e) => e.nombre === 'Freelance'), false);
  });

  caso('se puede saber cuáles quedaron fuera', () => {
    igual(ingresosSinFecha(ITEMS), ['Freelance']);
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

  caso('un variable con tarjeta no va al colchón: va al pago de su tarjeta', () => {
    const conTarjeta = [...ITEMS, { id: 'p7', nombre: 'Maquillaje', clase: 'gasto',
      variabilidad: 'variable', monto_min: 20, monto_max: 60, tarjeta_id: 'bbva', activo: true }];
    igual(colchonDelPeriodo(conTarjeta, 'min', '2026-09-01', '2026-09-30'), 3000);   // solo Comida
  });

  caso('se puede decir qué variables forman el colchón', () => {
    const conTarjeta = [...ITEMS, { nombre: 'Maquillaje', clase: 'gasto', variabilidad: 'variable',
                                    tarjeta_id: 'bbva', activo: true }];
    igual(variablesEnEfectivo(conTarjeta), ['Comida']);   // el de tarjeta va a su pago
  });

  caso('uno con tarjeta sí cuenta para no mostrar el aviso', () => {
    igual(hayGastosVariables([{ clase: 'gasto', variabilidad: 'variable',
                                tarjeta_id: 'bbva', activo: true }]), true);
  });

  caso('un gasto variable pausado tampoco cuenta', () => {
    const pausado = ITEMS.map((i) => (i.nombre === 'Comida' ? { ...i, activo: false } : i));
    igual(hayGastosVariables(pausado), false);
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

/* Pruebas de la proyección de pagos de tarjeta en el plan — escritas antes
   que la implementación. Salieron de plan-linea-tiempo.js por tamaño. */

import { describir, igual, cierto } from './marco.js';
import { eventosDeTarjeta, construirLineaTiempo } from '../calc/plan/linea-tiempo.js';

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

/* Lo que gastas con tarjeta sale de tu cuenta el día que PAGAS la tarjeta,
   no el día que compras. Hoy 20/sep y último corte 15/sep: el ciclo abierto
   cierra el 15/oct, se paga el 05/nov, y le quedan 25 días por gastar. */
describir('plan — gastos variables con tarjeta', (caso) => {
  const tarjeta = { id: 'bbva', nombre: 'BBVA', dia_corte: 15, dia_limite_pago: 5,
                    limite_credito: 50000, cuenta_pago_id: 'banco' };
  const comida = { id: 'v1', nombre: 'Comida', clase: 'gasto', variabilidad: 'variable',
                   monto_min: 300, monto_max: 600, tarjeta_id: 'bbva', activo: true };
  const proyectar = (movs, hasta, escenarioGastos = 'min') => eventosDeTarjeta(
    tarjeta, movs, [], '2026-09-20', hasta, { variables: [comida], escenarioGastos });
  const texto = (eventos) => eventos.map((e) => `${e.fecha} ${e.monto}`);

  caso('se paga en la fecha límite de la tarjeta, no a diario', () => {
    igual(texto(proyectar([], '2026-11-30')), ['2026-11-05 250']);          // 300 × 25/30
  });

  caso('el ciclo abierto solo estima los días que le faltan', () => {
    const gastado = { tipo: 'egreso', monto: 120, fecha: '2026-09-18', tarjeta_id: 'bbva' };
    igual(proyectar([gastado], '2026-11-30')[0].monto, 370);                  // 120 + 250
  });

  caso('un ciclo futuro completo estima el mes entero', () => {
    igual(texto(proyectar([], '2026-12-31')),
          ['2026-11-05 250', '2026-12-05 310']);                              // 31 días
  });

  caso('el escenario pesimista usa el máximo', () => {
    igual(proyectar([], '2026-11-30', 'max')[0].monto, 500);                  // 600 × 25/30
  });

  caso('lo que se paga después del horizonte no entra', () => {
    igual(proyectar([], '2026-11-04'), []);
  });

  caso('la línea de tiempo le pasa a cada tarjeta sus variables', () => {
    const linea = construirLineaTiempo(
      { planItems: [{ ...comida, monto_min: 30 }], tarjetas: [tarjeta], movimientos: [], compras: [] },
      { hoy: '2026-09-20', hasta: '2026-11-30', escenario: 'min', escenarioGastos: 'min' });
    igual(linea.map((e) => `${e.nombre} ${e.fecha} ${e.monto}`), ['Pago BBVA 2026-11-05 25']);
  });
});

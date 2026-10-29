/* Pruebas de calc/plan/registrado.js — escritas antes que la implementación. */

import { describir, igual, cierto } from './marco.js';
import { coincide, yaRegistrado } from '../calc/plan/registrado.js';
import { eventosDePlan } from '../calc/plan/linea-tiempo.js';
import { proximosVencimientos } from '../calc/vencimientos.js';

const SUELDO = { id: 'p1', nombre: 'Sueldo', clase: 'ingreso', variabilidad: 'fijo',
                 monto: 24000, dia_mes: 30, cuenta_id: 'banco', categoria_id: 'sal',
                 activo: true };
const BONO = { id: 'p2', nombre: 'Bono', clase: 'ingreso', variabilidad: 'variable',
               monto_min: 1000, monto_max: 3000, dia_mes: 15, cuenta_id: 'banco',
               categoria_id: 'bon', activo: true };
const RENTA = { id: 'p3', nombre: 'Renta', clase: 'gasto', variabilidad: 'fijo',
                monto: 12000, dia_mes: 1, cuenta_id: 'banco', activo: true };

const ingreso = (fecha, extra = {}) =>
  ({ tipo: 'ingreso', descripcion: 'Sueldo', monto: 24000, fecha, cuenta_id: 'banco', ...extra });

describir('registrado — reconocer el movimiento de un item del plan', (caso) => {
  caso('un ingreso se reconoce por el nombre', () => {
    cierto(coincide(SUELDO, ingreso('2026-10-28')));
  });

  caso('un egreso con el mismo nombre no es el ingreso', () => {
    cierto(!coincide(SUELDO, ingreso('2026-10-28', { tipo: 'egreso' })));
  });

  caso('con otro nombre, por categoría y monto exacto si es fijo', () => {
    cierto(coincide(SUELDO, ingreso('2026-10-28', { descripcion: 'Nómina', categoria_id: 'sal' })));
    cierto(!coincide(SUELDO, ingreso('2026-10-28',
      { descripcion: 'Nómina', categoria_id: 'sal', monto: 500 })));
  });

  caso('si es variable, por categoría y un monto dentro del rango', () => {
    const m = { tipo: 'ingreso', descripcion: 'Extra', categoria_id: 'bon', fecha: '2026-10-15' };
    cierto(coincide(BONO, { ...m, monto: 2500 }));
    cierto(!coincide(BONO, { ...m, monto: 9000 }));
  });

  caso('cuenta si llegó hasta 10 días antes o 3 después', () => {
    cierto(yaRegistrado(SUELDO, '2026-10-30', [ingreso('2026-10-20')]));
    cierto(yaRegistrado(SUELDO, '2026-10-30', [ingreso('2026-11-02')]));
    cierto(!yaRegistrado(SUELDO, '2026-10-30', [ingreso('2026-10-19')]));
    cierto(!yaRegistrado(SUELDO, '2026-10-30', [ingreso('2026-11-03')]));
  });
});

describir('plan — lo ya registrado no se cuenta dos veces', (caso) => {
  caso('el sueldo que ya registraste no se vuelve a agendar', () => {
    const eventos = eventosDePlan([SUELDO], '2026-10-28', '2026-11-30', 'min',
                                  [ingreso('2026-10-27')]);
    igual(eventos.map((e) => e.fecha), ['2026-11-30']);
  });

  caso('sin registrar, el sueldo sigue agendado', () => {
    const eventos = eventosDePlan([SUELDO], '2026-10-28', '2026-11-30', 'min', []);
    igual(eventos.map((e) => e.fecha), ['2026-10-30', '2026-11-30']);
  });

  caso('la renta pagada por adelantado tampoco se cobra otra vez', () => {
    const pago = { tipo: 'egreso', descripcion: 'Renta', monto: 12000, fecha: '2026-10-28' };
    const eventos = eventosDePlan([RENTA], '2026-10-28', '2026-11-30', 'min', [pago]);
    igual(eventos, []);
  });
});

const vacio = { tarjetas: [], movimientos: [], compras: [], planItems: [] };

describir('próximos — también los ingresos', (caso) => {
  caso('un ingreso con día aparece con su fecha y monto', () => {
    const lista = proximosVencimientos({ ...vacio, planItems: [SUELDO] },
                                       { hoy: '2026-10-28', dias: 14 });
    igual(lista.length, 1);
    igual(lista[0], { clase: 'ingreso', nombre: 'Sueldo', fecha: '2026-10-30',
                      monto: 24000, dias: 2, estado: 'urgente', item: SUELDO });
  });

  caso('un ingreso variable se anuncia con su mínimo', () => {
    const lista = proximosVencimientos({ ...vacio, planItems: [BONO] },
                                       { hoy: '2026-11-10', dias: 14 });
    igual(lista[0].monto, 1000);
  });

  caso('al registrarlo deja de aparecer', () => {
    const lista = proximosVencimientos(
      { ...vacio, planItems: [SUELDO], registrados: [ingreso('2026-10-28')] },
      { hoy: '2026-10-28', dias: 14 });
    igual(lista, []);
  });

  caso('un ingreso sin día no se anuncia', () => {
    const lista = proximosVencimientos(
      { ...vacio, planItems: [{ ...SUELDO, dia_mes: null }] }, { hoy: '2026-10-28', dias: 14 });
    igual(lista, []);
  });
});

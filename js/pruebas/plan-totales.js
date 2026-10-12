/* Pruebas de los totales de cada sobre — escritas antes que la implementación.
   Con los números reales del plan que lo motivó (12/oct/2026): Préstamo Jona
   trae $26.00 y le vencen $132.39, así que Salario le pasa lo que falta. */

import { describir, igual } from './marco.js';
import { asignar } from '../calc/plan/asignar.js';

const ingreso = (nombre, fecha, monto) =>
  ({ clase: 'ingreso', nombre, fecha, monto, cuentaId: 'banco', origen: 'plan' });
const obligacion = (nombre, fecha, monto) =>
  ({ clase: 'obligacion', nombre, fecha, monto, cuentaId: 'banco', origen: 'plan' });

const PLAN = {
  eventos: [
    obligacion('Pago BAC ECONOMIA', '2026-10-28', 64.58),
    ingreso('Salario', '2026-10-28', 520.55),
    ingreso('Prestamo Jona', '2026-10-31', 26),
    obligacion('Tarjeta BAC Debito Uso', '2026-11-02', 1.41),
    obligacion('Youtube Premium', '2026-11-04', 7.99),
    obligacion('Claude', '2026-11-04', 20),
    obligacion('Pago NIU CREDITO', '2026-11-05', 67.25),
    obligacion('Pago CUSCATLAN TIGO', '2026-11-05', 35.74),
  ],
  saldos: { banco: 475.66 },
  colchon: 0,
  desde: '2026-10-12', hasta: '2026-11-11',
};

const sobreDe = (r, nombre) => r.sobres.find((s) => s.nombre === nombre);

describir('totales de cada sobre', (caso) => {
  caso('el que recibe: lo que trae más lo recibido, contra lo que paga', () => {
    const jona = sobreDe(asignar(PLAN), 'Prestamo Jona');
    igual(jona.totalEntra, 132.39);
    igual(jona.totalSale, 132.39);
    igual(jona.libre, 0);
  });

  caso('el que pasa: lo que trae menos lo que pasó', () => {
    const salario = sobreDe(asignar(PLAN), 'Salario');
    igual(salario.totalEntra, 414.16);
    igual(salario.totalSale, 0);
    igual(salario.libre, 414.16);
  });

  caso('sin traspasos, lo que entra es lo que trae', () => {
    const hoy = sobreDe(asignar(PLAN), 'Saldo de hoy');
    igual(hoy.totalEntra, 475.66);
    igual(hoy.totalSale, 64.58);
    igual(hoy.libre, 411.08);
  });

  caso('el colchón también es lo que sale', () => {
    const r = asignar({ ...PLAN, eventos: [ingreso('Salario', '2026-10-12', 1000),
                                           obligacion('Renta', '2026-10-20', 300)],
                        saldos: { banco: 0 }, colchon: 200 });
    const s = sobreDe(r, 'Salario');
    igual(s.totalSale, 500);
    igual(s.libre, 500);
  });

  caso('si no alcanza, el libre es lo que entra menos lo que sale, en negativo', () => {
    const r = asignar({ ...PLAN, eventos: [ingreso('Salario', '2026-10-12', 100),
                                           obligacion('Renta', '2026-10-20', 300)],
                        saldos: { banco: 0 } });
    const s = sobreDe(r, 'Salario');
    igual(s.totalEntra, 100);
    igual(s.totalSale, 300);
    igual(s.libre, -200);
  });
});

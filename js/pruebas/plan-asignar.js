/* Pruebas de calc/plan/asignar.js — escritas antes que la implementación. */

import { describir, igual, cierto } from './marco.js';
import { asignar } from '../calc/plan/asignar.js';

const ingreso = (nombre, fecha, monto, cuentaId = 'banco') =>
  ({ clase: 'ingreso', nombre, fecha, monto, cuentaId, origen: 'plan' });
const obligacion = (nombre, fecha, monto, cuentaId = 'banco') =>
  ({ clase: 'obligacion', nombre, fecha, monto, cuentaId, origen: 'plan' });

describir('asignar — sobres', (caso) => {
  caso('cada obligación se cuelga del ingreso que la precede', () => {
    const r = asignar({
      eventos: [
        ingreso('Sueldo', '2026-09-15', 2400),
        obligacion('Renta', '2026-09-20', 700),
        obligacion('Tarjeta BBVA', '2026-09-22', 840),
      ],
      saldos: { banco: 0 },
      colchon: 400,
      desde: '2026-09-15', hasta: '2026-09-30',
    });
    igual(r.sobres.length, 1);
    igual(r.sobres[0].nombre, 'Sueldo');
    igual(r.sobres[0].monto, 2400);
    igual(r.sobres[0].asignaciones.map((a) => a.nombre), ['Renta', 'Tarjeta BBVA']);
    igual(r.sobres[0].colchon, 400);
    igual(r.sobres[0].libre, 460);       // 2400 − 700 − 840 − 400
  });

  caso('lo que se paga antes del primer ingreso sale del saldo de hoy', () => {
    const r = asignar({
      eventos: [obligacion('Renta', '2026-09-10', 500), ingreso('Sueldo', '2026-09-15', 2000)],
      saldos: { banco: 800 },
      colchon: 0,
      desde: '2026-09-01', hasta: '2026-09-30',
    });
    igual(r.sobres[0].nombre, 'Saldo de hoy');
    igual(r.sobres[0].monto, 800);
    igual(r.sobres[0].asignaciones.map((a) => a.nombre), ['Renta']);
    igual(r.sobres[1].nombre, 'Sueldo');
  });

  caso('el colchón se reparte entre los ingresos, sin perder centavos', () => {
    const r = asignar({
      eventos: [ingreso('A', '2026-09-05', 1000), ingreso('B', '2026-09-20', 2000)],
      saldos: { banco: 0 },
      colchon: 1000,
      desde: '2026-09-01', hasta: '2026-09-30',
    });
    const total = r.sobres.reduce((n, s) => n + s.colchon, 0);
    igual(Math.round(total * 100) / 100, 1000);
    cierto(r.sobres[1].colchon > r.sobres[0].colchon, 'el sobre mayor carga más colchón');
  });
});

describir('asignar — faltantes y transferencias', (caso) => {
  caso('propone mover dinero cuando otra cuenta tiene excedente', () => {
    const r = asignar({
      eventos: [obligacion('Tarjeta', '2026-09-22', 1000, 'banco')],
      saldos: { banco: 300, ahorros: 5000 },
      colchon: 0,
      desde: '2026-09-01', hasta: '2026-09-30',
    });
    igual(r.faltantes, []);
    igual(r.transferencias.length, 1);
    igual(r.transferencias[0], { desde: 'ahorros', hacia: 'banco', monto: 700, antesDe: '2026-09-22' });
  });

  caso('si ninguna cuenta alcanza, reporta el faltante exacto y su fecha', () => {
    const r = asignar({
      eventos: [obligacion('Amex', '2026-09-28', 1000, 'banco')],
      saldos: { banco: 400, ahorros: 280 },
      colchon: 0,
      desde: '2026-09-01', hasta: '2026-09-30',
    });
    igual(r.faltantes.length, 1);
    igual(r.faltantes[0].nombre, 'Amex');
    igual(r.faltantes[0].fecha, '2026-09-28');
    igual(r.faltantes[0].monto, 320);     // 1000 − 400 − 280
  });

  caso('un ingreso que llega DESPUÉS del vencimiento no salva el pago', () => {
    const r = asignar({
      eventos: [
        obligacion('Amex', '2026-09-28', 1000, 'banco'),
        ingreso('Sueldo', '2026-09-30', 24000),
      ],
      saldos: { banco: 680 },
      colchon: 0,
      desde: '2026-09-01', hasta: '2026-09-30',
    });
    igual(r.faltantes.length, 1);
    igual(r.faltantes[0].monto, 320);
  });

  caso('el mismo ingreso un día antes sí lo salva', () => {
    const r = asignar({
      eventos: [
        ingreso('Sueldo', '2026-09-27', 24000),
        obligacion('Amex', '2026-09-28', 1000, 'banco'),
      ],
      saldos: { banco: 680 },
      colchon: 0,
      desde: '2026-09-01', hasta: '2026-09-30',
    });
    igual(r.faltantes, []);
  });
});

describir('asignar — serie diaria', (caso) => {
  const r = asignar({
    eventos: [
      obligacion('Renta', '2026-09-02', 900),
      ingreso('Sueldo', '2026-09-04', 2000),
    ],
    saldos: { banco: 1000 },
    colchon: 0,
    desde: '2026-09-01', hasta: '2026-09-05',
  });

  caso('un punto por día del horizonte', () => {
    igual(r.serie.length, 5);
    igual(r.serie[0].fecha, '2026-09-01');
    igual(r.serie.at(-1).fecha, '2026-09-05');
  });

  caso('el saldo del día refleja los eventos ya ocurridos', () => {
    igual(r.serie.map((p) => p.total), [1000, 100, 100, 2100, 2100]);
  });

  caso('marca el día más ajustado', () => {
    igual(r.diaMasAjustado.fecha, '2026-09-02');
    igual(r.diaMasAjustado.total, 100);
  });

  caso('el libre total descuenta el colchón', () => {
    const c = asignar({
      eventos: [ingreso('Sueldo', '2026-09-01', 1000)],
      saldos: { banco: 0 }, colchon: 400,
      desde: '2026-09-01', hasta: '2026-09-05',
    });
    igual(c.libreTotal, 600);
  });
});

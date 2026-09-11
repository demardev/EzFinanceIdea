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

  /* Los variables se gastan día a día: cada sobre aparta los de los días que
     cubre, hasta que llega el siguiente ingreso. No importa cuánto traiga. */
  caso('el colchón se reparte por los días que cubre cada sobre, sin perder centavos', () => {
    const r = asignar({
      eventos: [ingreso('A', '2026-09-05', 1000), ingreso('B', '2026-09-20', 2000)],
      saldos: { banco: 0 },
      colchon: 1000,
      desde: '2026-09-01', hasta: '2026-09-30',
    });
    // Hoy 4 días, A 15 días, B 11 días: 30 en total.
    igual(r.sobres.map((s) => s.colchon), [133.33, 500, 366.67]);
  });

  caso('un sobre sin dinero igual carga los días que cubre', () => {
    const r = asignar({
      eventos: [ingreso('A', '2026-09-05', 1000)],
      saldos: { banco: 0 }, colchon: 300,
      desde: '2026-09-01', hasta: '2026-09-30',
    });
    igual(r.sobres[0].nombre, 'Saldo de hoy');
    igual(r.sobres[0].colchon, 40);          // 4 de 30 días
  });

  caso('con tus números: lo de hoy aguanta hasta el cobro, cada salario un mes', () => {
    const r = asignar({
      eventos: ['2026-09-28', '2026-10-28', '2026-11-28'].map((f) => ingreso('Salario', f, 520.55)),
      saldos: { banco: 732.07 }, colchon: 276,
      desde: '2026-09-10', hasta: '2026-12-10',
    });
    igual(r.sobres.map((s) => s.colchon), [54, 90, 93, 39]);
    igual(r.sobres.map((s) => s.colchonHasta),
          ['2026-09-27', '2026-10-27', '2026-11-27', '2026-12-10']);
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

/* Un sobre corto lo cubre lo que sobró de los anteriores, y se ve: así un
   sobre solo queda en rojo cuando de verdad no alcanza el dinero. */
describir('asignar — un sobre cubre al siguiente', (caso) => {
  const conSaldo = (saldo) => asignar({
    eventos: [ingreso('Comisión', '2026-09-10', 100), obligacion('BAC', '2026-09-28', 150)],
    saldos: { banco: saldo }, colchon: 0, desde: '2026-09-01', hasta: '2026-09-30',
  });

  caso('lo que sobró de un sobre cubre al que se queda corto', () => {
    const r = conSaldo(800);
    igual(r.sobres.map((s) => `${s.nombre} ${s.libre}`), ['Saldo de hoy 750', 'Comisión 0']);
    igual(r.sobres[1].traspasos, [{ nombre: 'Saldo de hoy', fecha: '2026-09-01', monto: 50 }]);
    igual(r.sobres[0].traspasos, [{ nombre: 'Comisión', fecha: '2026-09-10', monto: -50 }]);
    igual(r.faltantes, []);
  });

  caso('si antes no sobra lo suficiente, queda en rojo solo lo que de verdad falta', () => {
    const r = conSaldo(20);
    igual(r.sobres[1].libre, -30);
    igual(r.faltantes.map((f) => f.monto), [30]);
  });

  caso('un sobre que alcanza no toca a los demás', () => {
    const r = asignar({
      eventos: [ingreso('Sueldo', '2026-09-10', 1000), obligacion('Renta', '2026-09-20', 700)],
      saldos: { banco: 500 }, colchon: 0, desde: '2026-09-01', hasta: '2026-09-30',
    });
    igual(r.sobres.map((s) => s.traspasos), [[], []]);
  });
});

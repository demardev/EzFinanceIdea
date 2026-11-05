/* Pruebas de calc/prestamos.js — escritas antes que la implementación.
   Préstamos entre personas: lo que debes (el teléfono con la tarjeta de tu
   mamá) y lo que te deben (los AirPods a pagos). */

import { describir, igual, cierto } from './marco.js';
import { fechaDePago, estadoPrestamo, resumenPrestamos, totalDe, validarPrestamo }
  from '../calc/prestamos.js';

const HOY = '2026-11-04';

/* Tu amigo: $300.00 en pagos de mínimo $50.00 desde el 15 de agosto. */
const airpods = {
  id: 'a', direccion: 'me_deben', persona: 'Luis', concepto: 'AirPods',
  monto_total: 300, pago: 50, num_pagos: null, primer_pago: '2026-08-15',
};
/* Tú a tu mamá: 24 pagos de $30.00 desde el 10 de octubre. */
const telefono = {
  id: 't', direccion: 'debo', persona: 'Mamá', concepto: 'Teléfono',
  monto_total: 720, pago: 30, num_pagos: 24, primer_pago: '2026-10-10',
};
const abono = (monto, fecha) => ({ monto, fecha });

describir('préstamos — fechas de pago', (caso) => {
  caso('el primero es la fecha que pusiste', () => {
    igual(fechaDePago(airpods, 1), '2026-08-15');
  });

  caso('los demás caen el mismo día cada mes', () => {
    igual(fechaDePago(airpods, 4), '2026-11-15');
  });

  caso('el 31 no se va corriendo: febrero cae en 28 y marzo vuelve al 31', () => {
    const p = { ...airpods, primer_pago: '2027-01-31' };
    igual(fechaDePago(p, 2), '2027-02-28');
    igual(fechaDePago(p, 3), '2027-03-31');
  });
});

describir('préstamos — cuánto falta', (caso) => {
  caso('suma los abonos y resta del total', () => {
    const e = estadoPrestamo(airpods, [abono(70, '2026-08-15'), abono(50, '2026-09-15'),
                                       abono(50, '2026-10-15')], HOY);
    igual(e.abonado, 170);
    igual(e.restante, 130);
    igual(e.pagos, 3);
    igual(e.terminado, false);
  });

  caso('el avance es el porcentaje abonado, sin pasar de 100', () => {
    igual(estadoPrestamo(airpods, [abono(75, '2026-08-15')], HOY).avance, 25);
    igual(estadoPrestamo({ ...airpods, monto_total: 50 }, [abono(75, '2026-08-15')], HOY).avance, 100);
  });

  caso('sin abonos falta todo', () => {
    const e = estadoPrestamo(telefono, [], HOY);
    igual(e.abonado, 0);
    igual(e.restante, 720);
  });

  caso('al llegar al total queda terminado y sin próximo pago', () => {
    const e = estadoPrestamo({ ...airpods, monto_total: 100 },
                             [abono(70, '2026-08-15'), abono(30, '2026-09-15')], HOY);
    igual(e.restante, 0);
    igual(e.terminado, true);
    igual(e.proximo, null);
    igual(e.atraso, 0);
  });

  caso('pagar de más no deja un saldo negativo', () => {
    const e = estadoPrestamo({ ...airpods, monto_total: 100 }, [abono(120, '2026-08-15')], HOY);
    igual(e.restante, 0);
  });

  caso('los centavos no se pierden', () => {
    const e = estadoPrestamo({ ...telefono, monto_total: 100 },
                             [abono(33.33, '2026-10-10'), abono(33.33, '2026-11-01')], HOY);
    igual(e.restante, 33.34);
  });

  caso('con número de pagos dice en cuál vas', () => {
    const e = estadoPrestamo(telefono, [abono(30, '2026-10-10')], HOY);
    igual(e.progreso, '1/24');
  });

  caso('sin número de pagos no hay progreso por pagos', () => {
    igual(estadoPrestamo(airpods, [], HOY).progreso, '');
  });
});

describir('préstamos — próximo pago y atrasos', (caso) => {
  caso('al corriente: el próximo es el del mes que viene', () => {
    const e = estadoPrestamo(telefono, [abono(30, '2026-10-10')], HOY);
    igual(e.proximo, { fecha: '2026-11-10', monto: 30, atrasado: false });
    igual(e.atraso, 0);
  });

  caso('lo que diste de más se toma a cuenta del siguiente', () => {
    /* 70 + 50 + 50 = 170: con 20 de adelanto, en noviembre le faltan 30. */
    const e = estadoPrestamo(airpods, [abono(70, '2026-08-15'), abono(50, '2026-09-15'),
                                       abono(50, '2026-10-15')], HOY);
    igual(e.proximo, { fecha: '2026-11-15', monto: 30, atrasado: false });
    igual(e.atraso, 0);
  });

  caso('si un mes no pagó, se atrasa por lo que falta', () => {
    /* Vencieron agosto, septiembre y octubre: debían ser 150 y lleva 100. */
    const e = estadoPrestamo(airpods, [abono(50, '2026-08-15'), abono(50, '2026-09-15')], HOY);
    igual(e.atraso, 50);
    igual(e.proximo, { fecha: '2026-10-15', monto: 50, atrasado: true });
  });

  caso('el pago de hoy todavía no está atrasado', () => {
    const e = estadoPrestamo({ ...telefono, primer_pago: HOY }, [], HOY);
    igual(e.atraso, 0);
    igual(e.proximo.atrasado, false);
  });

  caso('el último pago es solo lo que falta, no el pago completo', () => {
    const e = estadoPrestamo({ ...airpods, monto_total: 180 },
                             [abono(70, '2026-08-15'), abono(50, '2026-09-15'),
                              abono(50, '2026-10-15')], HOY);
    igual(e.proximo, { fecha: '2026-11-15', monto: 10, atrasado: false });
  });

  caso('lo que se espera nunca pasa del total', () => {
    const e = estadoPrestamo({ ...airpods, monto_total: 120 }, [abono(50, '2026-08-15')], HOY);
    igual(e.atraso, 70);
  });

  caso('sin pago pactado no hay calendario ni atrasos', () => {
    const e = estadoPrestamo({ ...airpods, pago: null, primer_pago: null }, [], HOY);
    igual(e.proximo, null);
    igual(e.atraso, 0);
  });
});

describir('préstamos — resumen', (caso) => {
  const movs = [
    { prestamo_id: 'a', monto: 70, fecha: '2026-08-15' },
    { prestamo_id: 't', monto: 30, fecha: '2026-10-10' },
    { prestamo_id: 'otro', monto: 999, fecha: '2026-10-10' },
  ];

  caso('separa lo que debes de lo que te deben', () => {
    const r = resumenPrestamos([airpods, telefono], movs, HOY);
    igual(r.debes, 690);
    igual(r.teDeben, 230);
  });

  caso('cada préstamo trae solo sus abonos', () => {
    const r = resumenPrestamos([airpods, telefono], movs, HOY);
    igual(r.activos.find((x) => x.prestamo.id === 'a').estado.abonado, 70);
  });

  caso('los terminados se apartan y no suman', () => {
    const r = resumenPrestamos([{ ...airpods, monto_total: 70 }, telefono], movs, HOY);
    igual(r.teDeben, 0);
    igual(r.terminados.length, 1);
    igual(r.activos.length, 1);
  });

  caso('avisa de lo atrasado y de lo que vence en una semana', () => {
    /* AirPods: atrasado. Teléfono: el 10 de noviembre, en 6 días. */
    const r = resumenPrestamos([airpods, telefono], movs, HOY);
    igual(r.avisos.map((a) => a.prestamo.id), ['a', 't']);
  });

  caso('lo que vence en más de una semana no avisa', () => {
    const r = resumenPrestamos([telefono], movs, '2026-10-20');
    igual(r.avisos.length, 0);
  });
});

describir('préstamos — formulario', (caso) => {
  caso('sin total, se calcula con el pago por el número de pagos', () => {
    igual(totalDe({ monto_total: 0, pago: 30, num_pagos: '24' }), 720);
  });

  caso('si escribiste el total, manda el total', () => {
    igual(totalDe({ monto_total: 700, pago: 30, num_pagos: '24' }), 700);
  });

  caso('pide persona y total', () => {
    cierto(validarPrestamo({ persona: '', monto_total: 100 }));
    cierto(validarPrestamo({ persona: 'Mamá', monto_total: 0 }));
  });

  caso('con pago pactado pide la fecha del primero', () => {
    cierto(validarPrestamo({ persona: 'Luis', monto_total: 300, pago: 50, primer_pago: '' }));
    igual(validarPrestamo({ persona: 'Luis', monto_total: 300, pago: 50,
                            primer_pago: '2026-08-15' }), null);
  });

  caso('el pago no puede ser mayor que el total', () => {
    cierto(validarPrestamo({ persona: 'Luis', monto_total: 30, pago: 50,
                             primer_pago: '2026-08-15' }));
  });
});

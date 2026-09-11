/* Pruebas de calc/cuotas.js — escritas antes que la implementación.
   Meses sin intereses: tasa cero, nunca se calculan intereses. */

import { describir, igual, cierto } from './marco.js';
import { generarCuotas, planRegeneracion, progresoDeCompra,
         sinCuotasYaPagadas } from '../calc/cuotas.js';
import { sumar } from '../calc/dinero.js';

const COMPRA = {
  id: 'compra1', tarjeta_id: 't1', descripcion: 'Laptop',
  monto_total: 1200, num_cuotas: 12, fecha_compra: '2026-09-08',
  categoria_id: 'k4', comercio: 'Apple',
};

describir('cuotas', (caso) => {
  caso('genera una cuota por mes, con su número y su total', () => {
    const cuotas = generarCuotas(COMPRA);
    igual(cuotas.length, 12);
    igual(cuotas[0].cuota_num, 1);
    igual(cuotas[11].cuota_num, 12);
    cierto(cuotas.every((c) => c.cuota_total === 12));
  });

  caso('cada cuota es un egreso cargado a la tarjeta, atado a la compra', () => {
    const [primera] = generarCuotas(COMPRA);
    igual(primera.tipo, 'egreso');
    igual(primera.tarjeta_id, 't1');
    igual(primera.compra_id, 'compra1');
    igual(primera.cuenta_id, null);
    igual(primera.categoria_id, 'k4');
    igual(primera.comercio, 'Apple');
  });

  caso('la descripción lleva el progreso', () => {
    const cuotas = generarCuotas(COMPRA);
    igual(cuotas[2].descripcion, 'Laptop — cuota 3/12');
    igual(cuotas[0].descripcion, 'Laptop — cuota 1/12');
  });

  caso('la cuota k cae k−1 meses después de la compra', () => {
    const cuotas = generarCuotas(COMPRA);
    igual(cuotas[0].fecha, '2026-09-08');
    igual(cuotas[1].fecha, '2026-10-08');
    igual(cuotas[11].fecha, '2027-08-08');
  });

  caso('si el día no existe en ese mes, se ajusta al último', () => {
    const cuotas = generarCuotas({ ...COMPRA, fecha_compra: '2026-01-31', num_cuotas: 3 });
    igual(cuotas.map((c) => c.fecha), ['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  caso('reparto exacto cuando divide bien', () => {
    igual(generarCuotas(COMPRA).map((c) => c.monto), Array(12).fill(100));
  });

  caso('cuando no divide exacto, la última absorbe el residuo', () => {
    const cuotas = generarCuotas({ ...COMPRA, monto_total: 1000, num_cuotas: 3 });
    igual(cuotas.map((c) => c.monto), [333.33, 333.33, 333.34]);
    igual(sumar(...cuotas.map((c) => c.monto)), 1000);
  });

  caso('nunca se pierden centavos, con cualquier división', () => {
    for (const [total, n] of [[100, 7], [999.99, 6], [1234.56, 11], [50, 24]]) {
      const cuotas = generarCuotas({ ...COMPRA, monto_total: total, num_cuotas: n });
      igual(sumar(...cuotas.map((c) => c.monto)), total, `${total}/${n}:`);
    }
  });

  caso('tasa cero: la suma de las cuotas es el monto de la compra, sin recargo', () => {
    const cuotas = generarCuotas({ ...COMPRA, monto_total: 9999.99, num_cuotas: 18 });
    igual(sumar(...cuotas.map((c) => c.monto)), 9999.99);
  });
});

describir('regeneración de cuotas al editar', (caso) => {
  const existentes = generarCuotas(COMPRA).map((c, i) => ({ ...c, id: `m${i + 1}` }));

  caso('solo se regeneran las cuotas que aún no se cobraron', () => {
    // Hoy 20/nov/2026: ya se cobraron las de sep, oct y nov (3 cuotas).
    const plan = planRegeneracion(COMPRA, existentes, '2026-11-20');
    igual(plan.yaCobradas, 3);
    igual(plan.aBorrar.length, 9);
    igual(plan.aCrear.length, 9);
    igual(plan.aBorrar[0], 'm4');
  });

  caso('al cambiar el monto, lo cobrado se respeta y el resto se reparte', () => {
    // 3 cuotas cobradas de 100 = 300. Nuevo total 1500 -> quedan 1200 en 9.
    const plan = planRegeneracion({ ...COMPRA, monto_total: 1500 }, existentes, '2026-11-20');
    igual(sumar(...plan.aCrear.map((c) => c.monto)), 1200);
    igual(plan.aCrear[0].monto, 133.33);
    igual(plan.aCrear.at(-1).monto, 133.36);   // la última absorbe el residuo
  });

  caso('las cuotas regeneradas conservan su numeración y sus fechas', () => {
    const plan = planRegeneracion(COMPRA, existentes, '2026-11-20');
    igual(plan.aCrear[0].cuota_num, 4);
    igual(plan.aCrear[0].fecha, '2026-12-08');
    igual(plan.aCrear[0].descripcion, 'Laptop — cuota 4/12');
  });

  caso('si nada se ha cobrado, se regenera todo', () => {
    const plan = planRegeneracion(COMPRA, existentes, '2026-09-01');
    igual(plan.yaCobradas, 0);
    igual(plan.aBorrar.length, 12);
    igual(plan.aCrear.length, 12);
    igual(sumar(...plan.aCrear.map((c) => c.monto)), 1200);
  });

  /* Una compra a meses no cambia de fecha en la vida real: si la fecha cambia
     es que se registró mal, y entonces las fechas viejas nunca fueron
     ciertas. Los MONTOS cobrados se respetan; las FECHAS se corrigen todas. */
  caso('corregir la fecha mueve también las cuotas ya cobradas', () => {
    const plan = planRegeneracion({ ...COMPRA, fecha_compra: '2026-09-20' }, existentes, '2026-11-20');
    igual(plan.aMover, [
      { id: 'm1', fecha: '2026-09-20' },
      { id: 'm2', fecha: '2026-10-20' },
      { id: 'm3', fecha: '2026-11-20' },
    ]);
    igual(plan.aCrear[0].fecha, '2026-12-20');   // y las pendientes, desde la nueva
  });

  caso('sin cambiar la fecha no se mueve ninguna cobrada', () => {
    igual(planRegeneracion({ ...COMPRA, monto_total: 1500 }, existentes, '2026-11-20').aMover, []);
  });

  caso('al corregir la fecha, lo cobrado conserva su monto', () => {
    const plan = planRegeneracion({ ...COMPRA, fecha_compra: '2026-09-20' }, existentes, '2026-11-20');
    igual(sumar(...plan.aCrear.map((c) => c.monto)), 900);   // 1200 − 3 × 100 intactas
  });

  caso('acortar el plazo por debajo de lo ya cobrado no borra historial', () => {
    const plan = planRegeneracion({ ...COMPRA, num_cuotas: 2 }, existentes, '2026-11-20');
    igual(plan.aCrear.length, 0);
    igual(plan.yaCobradas, 3);
    cierto(plan.aviso.includes('3'));
  });
});

describir('progreso de una compra', (caso) => {
  const cuotas = generarCuotas(COMPRA).map((c, i) => ({ ...c, id: `m${i + 1}` }));

  caso('cuenta las cobradas contra el total', () => {
    igual(progresoDeCompra(COMPRA, cuotas, '2026-11-20'), {
      cobradas: 3, total: 12, texto: '3/12', montoCuota: 100, restante: 900,
    });
  });

  caso('el monto "al mes" es el de una cuota normal, no el residuo', () => {
    // 359.00 en 36 cuotas: 35 de 9.97 y la última de 10.05.
    const compra = { ...COMPRA, id: 'c2', monto_total: 359, num_cuotas: 36 };
    const generadas = generarCuotas(compra).map((c, i) => ({ ...c, id: `x${i + 1}` }));
    igual(generadas.at(-1).monto, 10.05, 'la última absorbe el residuo:');
    // Llegan de la base ordenadas por fecha descendente: la primera del arreglo
    // es la ÚLTIMA cuota. El progreso no debe reportar ese monto.
    const alReves = [...generadas].reverse();
    igual(progresoDeCompra(compra, alReves, '2026-11-20').montoCuota, 9.97);
  });

  caso('recién comprada: ninguna cobrada todavía', () => {
    const p = progresoDeCompra(COMPRA, cuotas, '2026-09-01');
    igual(p.texto, '0/12');
    igual(p.restante, 1200);
  });

  caso('terminada: todas cobradas y nada restante', () => {
    const p = progresoDeCompra(COMPRA, cuotas, '2027-09-01');
    igual(p.texto, '12/12');
    igual(p.restante, 0);
  });
});

describir('cuotas ya pagadas antes de usar la app', (caso) => {
  /* Compra de 6 cuotas hecha hace meses, de la que ya se pagaron 4 al banco. */
  const compra = { ...COMPRA, id: 'mini', descripcion: 'Minicuota',
                   monto_total: 261.72, num_cuotas: 6, fecha_compra: '2026-05-08',
                   cuotas_pagadas: 4 };
  const cuotas = generarCuotas(compra).map((c, i) => ({ ...c, id: `mc${i + 1}` }));

  caso('las cuotas ya pagadas salen del cálculo de deuda', () => {
    const quedan = sinCuotasYaPagadas(cuotas, [compra]);
    igual(quedan.length, 2);
    igual(quedan.map((c) => c.cuota_num), [5, 6]);
  });

  caso('sin cuotas pagadas no se quita nada', () => {
    igual(sinCuotasYaPagadas(cuotas, [{ ...compra, cuotas_pagadas: 0 }]).length, 6);
    igual(sinCuotasYaPagadas(cuotas, [{ ...compra, cuotas_pagadas: undefined }]).length, 6);
  });

  caso('los movimientos que no son cuotas nunca se tocan', () => {
    const suelto = { tipo: 'egreso', monto: 900, fecha: '2026-09-01', tarjeta_id: 't1' };
    const quedan = sinCuotasYaPagadas([...cuotas, suelto], [compra]);
    cierto(quedan.includes(suelto));
    igual(quedan.length, 3);
  });

  caso('una compra sin registrar no filtra sus cuotas', () => {
    igual(sinCuotasYaPagadas(cuotas, []).length, 6);
  });

  caso('el progreso sigue contando por fecha, no por lo ya pagado', () => {
    // A 20/sep ya se cobraron las de may, jun, jul, ago y sep = 5 de 6.
    igual(progresoDeCompra(compra, cuotas, '2026-09-20').texto, '5/6');
  });
});

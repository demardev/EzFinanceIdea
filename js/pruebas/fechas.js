/* Pruebas de calc/fechas.js — escritas antes que la implementación. */

import { describir, igual, cierto } from './marco.js';
import { partes, aISO, clampDia, ultimoDiaDelMes, sumarMeses, rangoDelMes,
         mesDe, formatearFecha, etiquetaDia, diasEntre, hoyISO,
         sumarDias } from '../calc/fechas.js';

describir('fechas', (caso) => {
  caso('parte y rearma una fecha ISO sin tocar zonas horarias', () => {
    igual(partes('2026-09-08'), { anio: 2026, mes: 9, dia: 8 });
    igual(aISO(2026, 9, 8), '2026-09-08');
    igual(aISO(2026, 1, 1), '2026-01-01');
  });

  caso('hoyISO() no se corre de día por la zona horaria', () => {
    const hoy = new Date();
    igual(partes(hoyISO()), { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1, dia: hoy.getDate() });
  });

  caso('último día del mes, con año bisiesto', () => {
    igual(ultimoDiaDelMes(2026, 2), 28);
    igual(ultimoDiaDelMes(2024, 2), 29);
    igual(ultimoDiaDelMes(2026, 4), 30);
    igual(ultimoDiaDelMes(2026, 12), 31);
  });

  caso('el día 31 en febrero se ajusta al último día', () => {
    igual(clampDia(2026, 2, 31), 28);
    igual(clampDia(2024, 2, 31), 29);
    igual(clampDia(2026, 9, 31), 30);
    igual(clampDia(2026, 9, 8), 8);
  });

  caso('sumar meses ajusta el día cuando no existe', () => {
    igual(sumarMeses('2026-01-31', 1), '2026-02-28');
    igual(sumarMeses('2024-01-31', 1), '2024-02-29');
    igual(sumarMeses('2026-08-31', 1), '2026-09-30');
  });

  caso('sumar meses cruza el año en los dos sentidos', () => {
    igual(sumarMeses('2026-12-15', 1), '2027-01-15');
    igual(sumarMeses('2026-01-15', -1), '2025-12-15');
    igual(sumarMeses('2026-03-31', -1), '2026-02-28');
    igual(sumarMeses('2026-09-08', 12), '2027-09-08');
  });

  caso('sumar días normaliza el mes y el año', () => {
    igual(sumarDias('2026-09-08', 60), '2026-11-07');
    igual(sumarDias('2026-09-08', 30), '2026-10-08');
    igual(sumarDias('2026-12-25', 10), '2027-01-04');
    igual(sumarDias('2026-01-05', -10), '2025-12-26');
    igual(sumarDias('2024-02-28', 1), '2024-02-29');   // bisiesto
    igual(sumarDias('2026-02-28', 1), '2026-03-01');
    igual(sumarDias('2026-09-08', 0), '2026-09-08');
  });

  caso('rango del mes cubre del primero al último día', () => {
    igual(rangoDelMes('2026-02'), { desde: '2026-02-01', hasta: '2026-02-28' });
    igual(rangoDelMes('2026-09'), { desde: '2026-09-01', hasta: '2026-09-30' });
  });

  caso('mesDe recorta la fecha al mes', () => {
    igual(mesDe('2026-09-08'), '2026-09');
  });

  caso('formato DD/mmm/YYYY', () => {
    igual(formatearFecha('2026-09-08'), '08/sep/2026');
    igual(formatearFecha('2026-12-31'), '31/dic/2026');
    igual(formatearFecha('2026-01-01'), '01/ene/2026');
  });

  caso('etiqueta del día: hoy, ayer, o la fecha', () => {
    igual(etiquetaDia('2026-09-08', '2026-09-08'), 'Hoy');
    igual(etiquetaDia('2026-09-07', '2026-09-08'), 'Ayer');
    igual(etiquetaDia('2026-09-01', '2026-09-08'), '01/sep/2026');
  });

  caso('días entre dos fechas, con signo', () => {
    igual(diasEntre('2026-09-08', '2026-09-10'), 2);
    igual(diasEntre('2026-09-10', '2026-09-08'), -2);
    igual(diasEntre('2026-02-28', '2026-03-01'), 1);
    cierto(diasEntre('2026-09-08', '2026-09-08') === 0);
  });
});

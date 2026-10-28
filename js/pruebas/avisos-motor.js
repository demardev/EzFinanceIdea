/* Pruebas del motor de avisos: montos, fechas y plantillas.
   Escritas antes que la implementación. */

import { describir, igual, cierto } from './marco.js';
import { limpiar, aMonto, leerFecha } from '../calc/avisos/partes.js';
import { validarPlantilla, leerConPlantilla } from '../calc/avisos/plantilla.js';
import { leerAviso } from '../calc/avisos/leer.js';

describir('avisos: limpiar el texto', (caso) => {
  caso('junta espacios y saltos de línea, y quita acentos', () => {
    igual(limpiar('  Se hizo un Débito\nen su   Cuenta  '), 'Se hizo un Debito en su Cuenta');
  });

  caso('sin texto da cadena vacía', () => {
    igual(limpiar(null), '');
  });
});

describir('avisos: montos', (caso) => {
  caso('con y sin separador de miles', () => {
    igual(aMonto('23.98'), 23.98);
    igual(aMonto('1,234.50'), 1234.5);
    igual(aMonto('150'), 150);
  });

  caso('cero o basura no es monto', () => {
    igual(aMonto('0.00'), null);
    igual(aMonto('abc'), null);
  });
});

describir('avisos: fechas', (caso) => {
  caso('año-mes-día con hora corta', () => {
    igual(leerFecha('2026-08-27 16:45'), { fecha: '2026-08-27', hora: '16:45' });
    igual(leerFecha('2026-08-15 0:07'), { fecha: '2026-08-15', hora: '00:07' });
  });

  caso('año/mes/día con segundos', () => {
    igual(leerFecha('2026/09/04 14:17:29'), { fecha: '2026-09-04', hora: '14:17' });
  });

  caso('día/mes/año con A.M. y P.M.', () => {
    igual(leerFecha('26/08/2026 03:21:28 P.M.'), { fecha: '2026-08-26', hora: '15:21' });
    igual(leerFecha('21/08/2026 08:07:48 A.M.'), { fecha: '2026-08-21', hora: '08:07' });
  });

  caso('las 12 P.M. son mediodía y las 12 A.M. medianoche', () => {
    igual(leerFecha('01/09/2026 12:05:00 P.M.').hora, '12:05');
    igual(leerFecha('01/09/2026 12:30:00 A.M.').hora, '00:30');
  });

  caso('segundos cortados por el banco', () => {
    igual(leerFecha('29/08/2026 03:14:0 P.M.'), { fecha: '2026-08-29', hora: '15:14' });
    igual(leerFecha('17/08/2026 10:22:2 A.M.'), { fecha: '2026-08-17', hora: '10:22' });
  });

  caso('año de dos dígitos y "a las"', () => {
    igual(leerFecha('07/10/26 a las 14:02:43'), { fecha: '2026-10-07', hora: '14:02' });
  });

  caso('sin hora, la fecha sola', () => {
    igual(leerFecha('2026-08-27'), { fecha: '2026-08-27', hora: null });
  });

  caso('una fecha que no existe no se inventa', () => {
    igual(leerFecha('2026-13-40 10:00'), null);
    igual(leerFecha('31/02/2026 10:00:00'), null);
    igual(leerFecha('sin fecha'), null);
  });
});

const PROPIA = { id: 'mia', banco: 'otro', sentido: 'sale', origen: { tipo: 'tarjeta' },
                 texto: 'Banco Otro: cargo de $ {monto} en {comercio} con tarjeta {origen} el {fecha}' };

describir('avisos: plantillas', (caso) => {
  caso('una plantilla bien hecha es válida', () => {
    igual(validarPlantilla(PROPIA), null);
  });

  caso('sin monto, sin sentido o con un hueco raro no sirve', () => {
    cierto(validarPlantilla({ ...PROPIA, texto: 'cargo en {comercio}' }));
    cierto(validarPlantilla({ ...PROPIA, sentido: 'arriba' }));
    cierto(validarPlantilla({ ...PROPIA, texto: 'cargo de {monto} {color}' }));
    cierto(validarPlantilla({ ...PROPIA, texto: 'cargo de {monto} y {monto}' }));
  });

  caso('lee los huecos, sin importar mayúsculas, acentos ni espacios', () => {
    const r = leerConPlantilla(
      limpiar('BANCO OTRO:  cargo de $12.50 en Café   Central con tarjeta XXXX4321 el 2026-10-20 10:00'),
      PROPIA);
    igual(r.monto, 12.5);
    igual(r.contraparte, { tipo: 'comercio', nombre: 'Cafe Central' });
    igual(r.origen, { tipo: 'tarjeta', nombre: null, ultimos: '4321' });
    igual(r.fecha, '2026-10-20');
    igual(r.hora, '10:00');
    igual(r.plantilla, 'mia');
  });

  caso('si el texto fijo no coincide, no la usa', () => {
    igual(leerConPlantilla(limpiar('Banco Otro: abono de $ 12.50 en Cafe'), PROPIA), null);
  });

  caso('los caracteres especiales del texto fijo se toman tal cual', () => {
    const p = { sentido: 'sale', texto: 'Pago (web) +ok: ${monto}' };
    igual(leerConPlantilla(limpiar('Pago (web) +ok: $9.99'), p).monto, 9.99);
  });

  caso('las plantillas propias van antes que las de fábrica', () => {
    const otra = { id: 'nueva-niu', banco: 'niu', sentido: 'entra',
                   texto: 'Niu te informa que realizaste una transferencia {*} por USD {monto} {*}' };
    const r = leerAviso('Niu te informa que realizaste una transferencia con tu Cuenta NIU por USD 50.00 el 07/10/26 a las 14:02:43 con referencia 1060361009', [otra]);
    igual(r.plantilla, 'nueva-niu');
  });

  caso('una plantilla propia inválida se ignora sin romper la lectura', () => {
    const r = leerAviso('Se hizo un Debito en su Cuenta B. CUSCATLAN 9214 por USD23.98 el dia 2026-08-27 16:45. Mas inf. 22122000',
                        [{ texto: 'sin monto' }]);
    igual(r.plantilla, 'cuscatlan-debito');
  });
});

describir('avisos: lo que no se reconoce', (caso) => {
  caso('una promoción no es un movimiento', () => {
    const r = leerAviso('¡UNA CUOTA ES MAS FACIL! Consolida YA tus saldos de otros bancos con tasa preferencial. Hasta 30/sep/26 https://qr.promocuscatlan.com/ConsolidaYA');
    igual(r.reconocido, false);
    igual(r.monto, null);
  });

  caso('si trae monto, fecha o tarjeta, se aprovechan', () => {
    const r = leerAviso('Banco Nuevo: cargo por USD 12.50 a su tarjeta 4321 el 2026/10/20 10:00:00');
    igual(r, { reconocido: false, monto: 12.5, fecha: '2026-10-20', hora: '10:00',
               ultimos: '4321' });
  });

  caso('Promerica escribe $ en vez de USD', () => {
    igual(leerAviso('Algo nuevo por $ 7.25 hoy').monto, 7.25);
  });
});

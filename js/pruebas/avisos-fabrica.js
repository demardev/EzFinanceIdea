/* Pruebas de los avisos de fábrica: mensajes reales de Cuscatlán, Niu, BAC y
   Promerica (oct 2026), con los nombres de terceros cambiados.
   Escritas antes que la implementación. */

import { describir, igual } from './marco.js';
import { leerAviso } from '../calc/avisos/leer.js';

/* Lo esencial de una lectura, para comparar de un vistazo. */
function resumen(texto) {
  const r = leerAviso(texto);
  if (!r.reconocido) return { reconocido: false };
  return { plantilla: r.plantilla, banco: r.banco, sentido: r.sentido, monto: r.monto,
           fecha: r.fecha, hora: r.hora };
}

describir('avisos de fábrica: Cuscatlán', (caso) => {
  caso('débito de cuenta, sin comercio', () => {
    const texto = 'Se hizo un Debito en su Cuenta B. CUSCATLAN 9214 por USD23.98 el dia 2026-08-27 16:45. Mas inf. 22122000';
    igual(resumen(texto), { plantilla: 'cuscatlan-debito', banco: 'cuscatlan', sentido: 'sale',
                            monto: 23.98, fecha: '2026-08-27', hora: '16:45' });
    const r = leerAviso(texto);
    igual(r.origen, { tipo: 'cuenta', nombre: null, ultimos: '9214' });
    igual(r.contraparte, null);
  });

  caso('compra con la tarjeta adicional', () => {
    const r = leerAviso('Alerta de compra B.CUSCATLAN con su Tarjeta de Credito Adicional 0242 por USD9.98 en KFC METROCENTRO LOURDES el 2026-08-15 0:07. Mas inf. 22122000');
    igual(r.plantilla, 'cuscatlan-compra');
    igual(r.monto, 9.98);
    igual(r.hora, '00:07');
    igual(r.origen, { tipo: 'tarjeta', nombre: null, ultimos: '0242' });
    igual(r.contraparte, { tipo: 'comercio', nombre: 'KFC METROCENTRO LOURDES' });
  });

  caso('compra con la titular, y comercio que dice "EL" adentro', () => {
    igual(leerAviso('Alerta de compra B.CUSCATLAN con su Tarjeta de Credito Titular 9840 por USD36.98 en Tigo_Facturas-CYB el 2026-08-13 21:23. Mas inf. 22122000').origen.ultimos, '9840');
    igual(leerAviso('Alerta de compra B.CUSCATLAN con su Tarjeta de Credito Adicional 0242 por USD5.55 en WOMPI*STARBUCKS EL CASCO el 2026-08-12 22:52. Mas inf. 22122000').contraparte.nombre,
          'WOMPI*STARBUCKS EL CASCO');
  });

  caso('Transfer365 enviada: destino y a quién', () => {
    const texto = 'Su Op. Transfer365 AHORRO XXXXXX9430 a DENNYS OMAR LOPEZ MUNOZ por USD 36.08 ha sido aplicada el dia 26/08/2026 03:21:28 P.M.';
    igual(resumen(texto), { plantilla: 'cuscatlan-transfer-enviada', banco: 'cuscatlan', sentido: 'sale',
                            monto: 36.08, fecha: '2026-08-26', hora: '15:21' });
    const r = leerAviso(texto);
    igual(r.destino, { tipo: 'cuenta', nombre: null, ultimos: '9430' });
    igual(r.contraparte, { tipo: 'persona', nombre: 'DENNYS OMAR LOPEZ MUNOZ' });
  });

  caso('Transfer365 a cuenta corriente, con cinco X y segundos cortados', () => {
    const corriente = leerAviso('Su Op. Transfer365 CORRIENTE XXXXXX0156 a PERSONA DE PRUEBA por USD 25.00 ha sido aplicada el dia 29/08/2026 03:17:10 P.M.');
    igual(corriente.destino.ultimos, '0156');
    igual(corriente.contraparte.nombre, 'PERSONA DE PRUEBA');
    const cortada = leerAviso('Su Op. Transfer365 AHORRO XXXXX5434 a DENNYS OMAR LOPEZ MUOZ por USD 100.00 ha sido aplicada el dia 18/08/2026 02:42:5 P.M.');
    igual([cortada.destino.ultimos, cortada.hora], ['5434', '14:42']);
  });

  caso('abono recibido', () => {
    const texto = 'Ha recibido un abono a su CUENTA DE AHORRO por USD 290.80 en 29/08/2026 03:14:0 P.M. de DENNYS OMAR LOPEZ MUOZ en concepto de Transfer365';
    igual(resumen(texto), { plantilla: 'cuscatlan-abono', banco: 'cuscatlan', sentido: 'entra',
                            monto: 290.8, fecha: '2026-08-29', hora: '15:14' });
    igual(leerAviso(texto).contraparte, { tipo: 'persona', nombre: 'DENNYS OMAR LOPEZ MUOZ' });
  });
});

describir('avisos de fábrica: Niu', (caso) => {
  const NIU_CUENTA = { tipo: 'cuenta', nombre: 'Cuenta Niu', ultimos: null };

  caso('pago de la tarjeta: entre dos productos tuyos', () => {
    const texto = 'Niu te informa que pagaste tu Tarjeta de Credito Niu  con tu Cuenta Niu por USD 136.87 el 26/09/26 a las 09:59:45 con referencia 1004438275';
    igual(resumen(texto), { plantilla: 'niu-pago-tarjeta', banco: 'niu', sentido: 'entre',
                            monto: 136.87, fecha: '2026-09-26', hora: '09:59' });
    const r = leerAviso(texto);
    igual(r.origen, NIU_CUENTA);
    igual(r.destino, { tipo: 'tarjeta', nombre: 'Tarjeta Niu', ultimos: null });
    igual(r.referencia, '1004438275');
  });

  caso('transferencia desde la cuenta', () => {
    const r = leerAviso('Niu te informa que realizaste una transferencia con tu Cuenta NIU por USD 50.00 el 07/10/26 a las 14:02:43 con referencia 1060361009');
    igual([r.plantilla, r.sentido, r.monto, r.referencia], ['niu-transferencia', 'sale', 50, '1060361009']);
    igual(r.origen, NIU_CUENTA);
  });

  caso('recarga a la cuenta con la tarjeta 0242', () => {
    const r = leerAviso('Niu te informa que realizaste una recarga a tu cuenta con tu  tarjeta(0242) por USD 25.00 el 16/08/26 a las 18:45:10 con referencia 777169332');
    igual([r.plantilla, r.sentido, r.monto], ['niu-recarga-cuenta', 'entre', 25]);
    igual(r.origen, { tipo: 'tarjeta', nombre: null, ultimos: '0242' });
    igual(r.destino, NIU_CUENTA);
  });

  caso('recarga de celular, con la referencia pegada', () => {
    const r = leerAviso('Niu te informa que realizaste una recarga de celular a Claro - Paquetes con tu Cuenta NIU por USD 1.00 el 17/09/26 a las 11:28:50 con referencia952478098.');
    igual([r.plantilla, r.monto, r.referencia], ['niu-recarga-celular', 1, '952478098']);
    igual(r.contraparte, { tipo: 'comercio', nombre: 'Claro - Paquetes' });
  });
});

describir('avisos de fábrica: BAC', (caso) => {
  caso('compra con la de crédito', () => {
    const texto = 'Alertas PRF VISA 1969: has realizado una compra por USD 2.99 en el comercio: APPLE.COM BILL  2026/09/04 14:17:29 Inf. https://bit.ly/32mcTdq';
    igual(resumen(texto), { plantilla: 'bac-credito', banco: 'bac', sentido: 'sale',
                            monto: 2.99, fecha: '2026-09-04', hora: '14:17' });
    const r = leerAviso(texto);
    igual(r.origen, { tipo: 'tarjeta', nombre: null, ultimos: '1969' });
    igual(r.contraparte.nombre, 'APPLE.COM BILL');
  });

  caso('comercio con guiones', () => {
    igual(leerAviso('Alertas PRF VISA 1969: has realizado una compra por USD 2.00 en el comercio: PAQUETES CLARO -BEL- 2026/10/14 14:40:37 Inf. https://bit.ly/32mcTdq').contraparte.nombre,
          'PAQUETES CLARO -BEL-');
  });

  caso('compra con la de débito: sale de la cuenta', () => {
    const r = leerAviso('AlertaDebito VISA 2518: has realizado una compra  por USD 20.00 en el comercio ANTHROPIC* CLAUDE SUB 2026/10/04 22:59:57  Inf. https://bit.ly/32mcTdq');
    igual([r.plantilla, r.monto, r.fecha], ['bac-debito', 20, '2026-10-04']);
    igual(r.origen, { tipo: 'debito', nombre: null, ultimos: '2518' });
    igual(r.contraparte.nombre, 'ANTHROPIC* CLAUDE SUB');
  });
});

describir('avisos de fábrica: Promerica', (caso) => {
  caso('Transfer365 enviada, con $ en vez de USD', () => {
    const texto = 'Su Op. Transfer365 de Transferencia de Fondos a cuenta de ahorro a Dennys Lopez por $ 150.00 ha sido aplicada el 21/08/2026 16:51:21';
    igual(resumen(texto), { plantilla: 'promerica-transfer-enviada', banco: 'promerica', sentido: 'sale',
                            monto: 150, fecha: '2026-08-21', hora: '16:51' });
    igual(leerAviso(texto).contraparte.nombre, 'Dennys Lopez');
  });

  caso('abono recibido, de alguien con "DE" en el nombre', () => {
    const r = leerAviso('Ha recibido un abono Transferencia de Fondos a cuenta de ahorro de ANA DE LOS RIOS DE PRUEBA por $ 300.00 a traves de Transfer365 el 25/08/2026 15:47:07');
    igual([r.plantilla, r.sentido, r.monto], ['promerica-abono', 'entra', 300]);
    igual(r.contraparte.nombre, 'ANA DE LOS RIOS DE PRUEBA');
  });

  caso('el abono de hoy, de tu propia cuenta', () => {
    igual(resumen('Ha recibido un abono Transferencia de Fondos a cuenta de ahorro de DENNYS OMAR LOPEZ por $ 61.98 a traves de Transfer365 el 28/10/2026 11:12:49'),
          { plantilla: 'promerica-abono', banco: 'promerica', sentido: 'entra',
            monto: 61.98, fecha: '2026-10-28', hora: '11:12' });
  });
});

describir('avisos de fábrica: lo que se ignora', (caso) => {
  caso('promociones de Tigo, Cuscatlán y Promerica', () => {
    igual(resumen('Gracias por el pago puntual de la factura de tu servicio movil. Como beneficio por tu pronto pago el proximo ciclo recibiras 5GB y 20GB de TikTok por 30 dias'),
          { reconocido: false });
    igual(resumen('20%OFF menu Hyatt al pagar con Tta Cred CUSCATLAN. Vig. 3, 10, 17 y 24sep26. De 7 a 10pm Inf. https://qr.promocuscatlan.com/PasaporteCulinario-HyattCentric'),
          { reconocido: false });
    igual(resumen('¡Solo hoy! recibe 50% DE DCTO en tu primera compra al obtener en linea tu Tarjeta Promerica VISA. Disfruta de los mejores beneficios. gprom.co/p/PSTE48UG'),
          { reconocido: false });
  });
});

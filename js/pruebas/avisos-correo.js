/* Pruebas de los avisos por correo: Promerica (oct 2026), con el texto tal
   como lo manda el script de Gmail (asunto + cuerpo sin HTML, cortado antes
   del pie). Escritas antes que la implementación. */

import { describir, igual } from './marco.js';
import { leerAviso } from '../calc/avisos/leer.js';
import { conAviso } from '../calc/bandeja.js';
import { juntarPendientes, borradorDeEntrada } from '../calc/avisos/juntar.js';

export const PAGO_SERVICIO = 'Notificación de Pago de Servicio   Banco Promerica   Pago de Servicio  DENNYS LOPEZ   Te notificamos que se procesó correctamente tu pago de servicio:   Referencia:  588264519   Servicio Pagado:  ARABELA DE EL SALVADOR SA DE C, PAGO DE FACTURAS   Valor Pagado:  $61.98   Fecha:  28-10-2026 a las 11:14:30 a. m.   Cuenta origen:  CUENTA INICIA - 9430   ';
export const RECIBIDA = 'CONFIRMACIÓN TRANSACCIÓN Transfer365   Detalle de Transfer365 del Banco Central de Reserva recibida   Estimado Cliente   Te informamos que se ha recibido exitosamente transacción del Sistema de Pagos Masivo de acuerdo al detalle siguiente:   ID TRANSACCION ORIGEN  FECHA/HORA  TIPO DE CUENTA  REFERENCIA  MONTO USD  NOMBRE DEL ORDENANTE  TIPO PRODUCTO   BACUSVSS20261028000063787914  28/10/2026 11:12:49 AM  Deposito en cuenta de ahorro  2000XXXXXXXXXX9430  $ 61.98  DENNYS OMAR LOPEZ  Transferencia de Fondos a cuenta de ahorro   Descripción: Transfer365   ';
export const ENVIADA = 'CONFIRMACIÓN TRANSACCIÓN SPM   Detalle de Transfer365 del Banco Central de Reserva enviada   Estimado Cliente   Te informamos que el estado de tu transferencia es el siguiente:   ESTADO DE LA TRANSACCIÓN:  PAGADO   Número de transacción:  12572832   Fecha y hora:  21/08/2026 04:50:14 PM   Destino:  BANCO CUSCATLAN DE EL SALVADOR S.A.   Descripción:  Transfer   Cuenta del debito:  **********9430   Titular cuenta origen:  LOPEZ MUÑOZ DENNYS OMAR   Monto de la transacción:  $ 150.00   Tipo de producto:  Transferencia de Fondos a cuenta de ahorro   Producto destino:  ************9214   Titular cuenta destino:  Dennys Omar Lopez Muñoz   ';

describir('avisos por correo: Promerica', (caso) => {
  caso('pago de servicio: lo que el SMS no avisa', () => {
    const r = leerAviso(PAGO_SERVICIO);
    igual([r.plantilla, r.banco, r.sentido, r.monto, r.fecha, r.hora, r.referencia],
          ['promerica-correo-pago-servicio', 'promerica', 'sale', 61.98, '2026-10-28', '11:14', '588264519']);
    igual(r.origen, { tipo: 'cuenta', nombre: null, ultimos: '9430' });
    igual(r.contraparte, { tipo: 'comercio', nombre: 'ARABELA DE EL SALVADOR SA DE C, PAGO DE FACTURAS' });
  });

  caso('Transfer365 recibida: la cuenta y quién te la mandó', () => {
    const r = leerAviso(RECIBIDA);
    igual([r.plantilla, r.sentido, r.monto, r.fecha, r.hora],
          ['promerica-correo-transfer-recibida', 'entra', 61.98, '2026-10-28', '11:12']);
    igual(r.destino, { tipo: 'cuenta', nombre: null, ultimos: '9430' });
    igual(r.contraparte, { tipo: 'persona', nombre: 'DENNYS OMAR LOPEZ' });
  });

  caso('Transfer365 enviada: de qué cuenta a cuál, aunque tapen con asteriscos', () => {
    const r = leerAviso(ENVIADA);
    igual([r.plantilla, r.sentido, r.monto, r.fecha, r.hora, r.referencia],
          ['promerica-correo-transfer-enviada', 'sale', 150, '2026-08-21', '16:50', '12572832']);
    igual([r.origen.ultimos, r.destino.ultimos], ['9430', '9214']);
    igual(r.contraparte, { tipo: 'persona', nombre: 'Dennys Omar Lopez Munoz' });
  });

  caso('una transferencia que no se pagó no se lee como hecha', () => {
    igual(leerAviso(ENVIADA.replace('PAGADO', 'RECHAZADO')).reconocido, false);
  });
});

describir('juntar: el mismo aviso por SMS y por correo', (caso) => {
  const item = (id, origen, texto, min) => conAviso({ id, origen, monto: null, comercio: null,
    tarjeta: null, texto, created_at: new Date(Date.UTC(2026, 9, 28, 17, min)).toISOString() });
  const SMS_ABONO = 'Ha recibido un abono Transferencia de Fondos a cuenta de ahorro de DENNYS OMAR LOPEZ por $ 61.98 a traves de Transfer365 el 28/10/2026 11:12:49';
  const ENVIO_CUS = 'Su Op. Transfer365 AHORRO XXXXXX9430 a DENNYS OMAR LOPEZ MUNOZ por USD 61.98 ha sido aplicada el dia 28/10/2026 11:12:40 A.M.';
  const PROPIO = { 'persona:dennys omar lopez munoz': 'propia' };
  const ids = (es) => es.map((e) => (e.partes ? e.partes.map((p) => p.id).join('+') : e.id));

  caso('mismo banco, monto, sentido y hora: uno solo, el correo al frente', () => {
    const r = juntarPendientes([item('s', 'sms', SMS_ABONO, 0), item('c', 'correo', RECIBIDA, 9)], {});
    igual(ids(r), ['c+s']);
    igual(r[0].junta, 'mismo');
    igual(borradorDeEntrada(r[0], {}).tipo, 'ingreso');
  });

  caso('dos del mismo origen no se juntan así', () => {
    igual(ids(juntarPendientes([item('s1', 'sms', SMS_ABONO, 0), item('s2', 'sms', `${SMS_ABONO} `, 1)], {})),
          ['s1', 's2']);
  });

  caso('envío de Cuscatlán + abono por SMS y por correo: una sola transferencia', () => {
    const r = juntarPendientes([item('e', 'sms', ENVIO_CUS, 0), item('s', 'sms', SMS_ABONO, 1),
                                item('c', 'correo', RECIBIDA, 9)], PROPIO);
    igual(ids(r), ['e+c+s']);
    const b = borradorDeEntrada(r[0], { ...PROPIO, 'aviso:cuenta:9430': 'cuenta:pro',
                                        'aviso:cuscatlan:cuenta': 'cuenta:cus' });
    igual([b.tipo, b.cuenta_id, b.destino], ['transferencia', 'cus', 'cuenta:pro']);
  });

  caso('si separas los tres, se separan', () => {
    igual(ids(juntarPendientes([item('e', 'sms', ENVIO_CUS, 0), item('s', 'sms', SMS_ABONO, 1),
                                item('c', 'correo', RECIBIDA, 9)], PROPIO, new Set(['c+e+s']))),
          ['e', 'c+s']);
  });
});

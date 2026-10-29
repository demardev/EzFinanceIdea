/* Pruebas de calc/avisos/juntar.js — escritas antes que la implementación.
   Dos cosas de la bandeja que son la misma operación se juntan; dos pagos
   seguidos de montos distintos, nunca. */

import { describir, igual } from './marco.js';
import { juntarPendientes, borradorDeEntrada } from '../calc/avisos/juntar.js';
import { conAviso } from '../calc/bandeja.js';

const a_las = (min) => new Date(Date.UTC(2026, 9, 28, 17, min)).toISOString();
const sms = (id, texto, min) => conAviso({ id, origen: 'sms', monto: null, comercio: null,
                                           tarjeta: null, texto, created_at: a_las(min) });
const applepay = (id, monto, comercio, min) => ({ id, origen: 'applepay', monto, comercio,
  tarjeta: 'BAC Visa', texto: null, created_at: a_las(min) });
const compraBac = (id, monto, min) => sms(id, `Alertas PRF VISA 1969: has realizado una compra por USD ${monto} en el comercio: APPLE.COM BILL  2026/10/28 11:0${min % 10}:00 Inf. https://bit.ly/32mcTdq`, min);
const ENVIO = (min) => sms('envio', 'Su Op. Transfer365 AHORRO XXXXXX9430 a DENNYS OMAR LOPEZ MUNOZ por USD 61.98 ha sido aplicada el dia 28/10/2026 11:12:40 A.M.', min);
const ABONO = (min) => sms('abono', 'Ha recibido un abono Transferencia de Fondos a cuenta de ahorro de DENNYS OMAR LOPEZ por $ 61.98 a traves de Transfer365 el 28/10/2026 11:12:49', min);
const PROPIO = { 'persona:dennys omar lopez munoz': 'propia' };
const ids = (entradas) => entradas.map((e) => (e.partes ? e.partes.map((p) => p.id).join('+') : e.id));

describir('juntar: Apple Pay y su SMS', (caso) => {
  caso('mismo monto, minutos de diferencia: es una sola compra', () => {
    const r = juntarPendientes([applepay('ap', 2.99, 'Apple', 0), compraBac('s', '2.99', 1)], {});
    igual(ids(r), ['ap+s']);
    igual([r[0].junta, r[0].monto, r[0].comercio], ['applepay', 2.99, 'Apple']);
  });

  caso('montos distintos seguidos: dos compras', () => {
    const r = juntarPendientes([applepay('ap', 2.99, 'Apple', 0), compraBac('s', '3.99', 1)], {});
    igual(ids(r), ['ap', 's']);
  });

  caso('mismo monto pero horas aparte: dos compras', () => {
    igual(ids(juntarPendientes([applepay('ap', 2.99, 'Apple', 0), compraBac('s', '2.99', 50)], {})),
          ['ap', 's']);
  });

  caso('dos compras iguales seguidas, cada una con su SMS: dos pares', () => {
    const r = juntarPendientes([applepay('ap1', 2, 'Claro', 0), applepay('ap2', 2, 'Claro', 6),
                                compraBac('s1', '2.00', 1), compraBac('s2', '2.00', 7)], {});
    igual(ids(r), ['ap1+s1', 'ap2+s2']);
  });

  caso('un abono nunca se junta con una compra', () => {
    igual(ids(juntarPendientes([applepay('ap', 61.98, 'X', 0), ABONO(1)], PROPIO)), ['ap', 'abono']);
  });
});

describir('juntar: lo que envías y lo que te llega', (caso) => {
  caso('el envío de un banco y el abono del otro, a tu nombre', () => {
    const r = juntarPendientes([ENVIO(0), ABONO(2)], PROPIO);
    igual(ids(r), ['envio+abono']);
    igual(r[0].junta, 'transferencia');
  });

  caso('sin saber que el nombre es tuyo, no se juntan', () => {
    igual(ids(juntarPendientes([ENVIO(0), ABONO(2)], {})), ['envio', 'abono']);
  });

  caso('si los separaste, se quedan separados', () => {
    igual(ids(juntarPendientes([ENVIO(0), ABONO(2)], PROPIO, new Set(['abono+envio']))),
          ['envio', 'abono']);
  });
});

describir('juntar: el borrador del par', (caso) => {
  caso('Apple Pay pone el comercio; el SMS, la tarjeta si Wallet no la sabe', () => {
    const [par] = juntarPendientes([applepay('ap', 2.99, 'Apple', 0), compraBac('s', '2.99', 1)], {});
    const b = borradorDeEntrada(par, { 'aviso:tarjeta:1969': 'tarjeta:bac' });
    igual([b.tipo, b.monto, b.descripcion, b.origen], ['egreso', 2.99, 'Apple', 'tarjeta:bac']);
  });

  caso('la tarjeta de Wallet aprendida gana', () => {
    const [par] = juntarPendientes([applepay('ap', 2.99, 'Apple', 0), compraBac('s', '2.99', 1)], {});
    igual(borradorDeEntrada(par, { 'BAC Visa': 'tarjeta:w', 'aviso:tarjeta:1969': 'tarjeta:bac' }).origen,
          'tarjeta:w');
  });

  caso('envío + abono: de la cuenta del envío a la del abono', () => {
    const [par] = juntarPendientes([ENVIO(0), ABONO(2)], { ...PROPIO,
      'aviso:cuscatlan:cuenta': 'cuenta:cus', 'aviso:promerica:cuenta': 'cuenta:pro' });
    const b = borradorDeEntrada(par, { ...PROPIO,
      'aviso:cuscatlan:cuenta': 'cuenta:cus', 'aviso:promerica:cuenta': 'cuenta:pro' });
    igual([b.tipo, b.monto, b.fecha, b.cuenta_id, b.destino],
          ['transferencia', 61.98, '2026-10-28', 'cus', 'cuenta:pro']);
    igual(b.descripcion, 'De Cuscatlán a Promerica');
  });

  caso('uno solo, igual que siempre', () => {
    igual(borradorDeEntrada(ABONO(0), {}).tipo, 'ingreso');
  });
});

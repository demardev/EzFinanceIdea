/* Pruebas de calc/avisos/cuentas.js — escritas antes que la implementación.
   De qué cuenta de la app es cada aviso, y quién eres tú en los avisos. */

import { describir, igual, cierto } from './marco.js';
import { claveDeProducto, esPersonaPropia, aprendizajeDe, etiquetaDeClave }
  from '../calc/avisos/cuentas.js';
import { conAviso, borradorDeBandeja } from '../calc/bandeja.js';

const aviso = (texto) => conAviso({ id: 'a', origen: 'sms', monto: null, comercio: null,
                                    tarjeta: null, texto, created_at: '2026-10-28T17:00:00Z' });
const DEBITO_CUS = aviso('Se hizo un Debito en su Cuenta B. CUSCATLAN 9214 por USD23.98 el dia 2026-10-27 16:45. Mas inf. 22122000');
const COMPRA_0242 = aviso('Alerta de compra B.CUSCATLAN con su Tarjeta de Credito Adicional 0242 por USD9.98 en KFC LOURDES el 2026-10-15 0:07. Mas inf. 22122000');
const PAGO_NIU = aviso('Niu te informa que pagaste tu Tarjeta de Credito Niu con tu Cuenta Niu por USD 136.87 el 26/09/26 a las 09:59:45 con referencia 1004438275');
const ENVIO_PROPIO = aviso('Su Op. Transfer365 AHORRO XXXXXX9430 a DENNYS OMAR LOPEZ MUNOZ por USD 36.08 ha sido aplicada el dia 26/10/2026 03:21:28 P.M.');
const ABONO_PROPIO = aviso('Ha recibido un abono Transferencia de Fondos a cuenta de ahorro de DENNYS OMAR LOPEZ por $ 61.98 a traves de Transfer365 el 28/10/2026 11:12:49');
const ABONO_AJENO = aviso('Ha recibido un abono Transferencia de Fondos a cuenta de ahorro de ANA PRUEBA por $ 300.00 a traves de Transfer365 el 25/10/2026 15:47:07');
const RECARGA_NIU = aviso('Niu te informa que realizaste una recarga a tu cuenta con tu tarjeta(0242) por USD 25.00 el 16/10/26 a las 18:45:10 con referencia 777169332');

describir('avisos: la clave de cada producto', (caso) => {
  caso('con últimos 4, la clave es tipo + dígitos, sin importar el banco', () => {
    igual(claveDeProducto('cuscatlan', DEBITO_CUS.aviso.origen), 'aviso:cuenta:9214');
    igual(claveDeProducto('niu', RECARGA_NIU.aviso.origen), 'aviso:tarjeta:0242');
    igual(claveDeProducto('cuscatlan', COMPRA_0242.aviso.origen), 'aviso:tarjeta:0242');
  });

  caso('sin dígitos, la clave es del banco y el producto', () => {
    igual(claveDeProducto('niu', PAGO_NIU.aviso.origen), 'aviso:niu:cuenta:cuenta niu');
    igual(claveDeProducto('promerica', ABONO_AJENO.aviso.destino), 'aviso:promerica:cuenta');
  });

  caso('sin producto, no hay clave', () => {
    igual(claveDeProducto('bac', null), null);
  });

  caso('en Ajustes se lee como algo tuyo', () => {
    igual(etiquetaDeClave('aviso:tarjeta:0242'), 'Tarjeta 0242');
    igual(etiquetaDeClave('aviso:debito:2518'), 'Débito 2518');
    igual(etiquetaDeClave('aviso:niu:cuenta:cuenta niu'), 'Cuenta de Niu');
    igual(etiquetaDeClave('aviso:promerica:cuenta'), 'Cuenta de Promerica');
    igual(etiquetaDeClave('persona:dennys omar lopez munoz'), 'Dennys Omar Lopez Munoz');
  });
});

describir('avisos: quién eres tú', (caso) => {
  const PROPIAS = { 'persona:dennys omar lopez munoz': 'propia' };

  caso('tu nombre completo, o una parte de dos o más palabras', () => {
    cierto(esPersonaPropia('DENNYS OMAR LOPEZ MUNOZ', PROPIAS));
    cierto(esPersonaPropia('Dennys Lopez', PROPIAS));
    cierto(esPersonaPropia('DENNYS OMAR LOPEZ', PROPIAS));
  });

  caso('aunque el banco se coma la Ñ', () => {
    cierto(esPersonaPropia('DENNYS OMAR LOPEZ MUOZ', PROPIAS));
  });

  caso('otra persona, o una sola palabra, no', () => {
    cierto(!esPersonaPropia('ANA PRUEBA', PROPIAS));
    cierto(!esPersonaPropia('Dennys', PROPIAS));
    cierto(!esPersonaPropia('DENNYS OMAR LOPEZ MUNOZ', {}));
  });
});

describir('avisos: el borrador con lo aprendido', (caso) => {
  caso('un egreso trae la cuenta de donde sale', () => {
    igual(borradorDeBandeja(DEBITO_CUS, { 'aviso:cuenta:9214': 'cuenta:cus' }).origen, 'cuenta:cus');
    igual(borradorDeBandeja(COMPRA_0242, { 'aviso:tarjeta:0242': 'tarjeta:t1' }).origen, 'tarjeta:t1');
  });

  caso('sin aprender, queda por elegir', () => {
    igual(borradorDeBandeja(DEBITO_CUS, {}).origen, '');
  });

  caso('un ingreso trae la cuenta a la que entra', () => {
    const b = borradorDeBandeja(ABONO_AJENO, { 'aviso:promerica:cuenta': 'cuenta:pro' });
    igual([b.tipo, b.cuenta_id], ['ingreso', 'pro']);
  });

  caso('el pago de la tarjeta Niu va de la cuenta a la tarjeta', () => {
    const b = borradorDeBandeja(PAGO_NIU, { 'aviso:niu:cuenta:cuenta niu': 'cuenta:cus',
                                            'aviso:niu:tarjeta:tarjeta niu': 'tarjeta:niu' });
    igual([b.tipo, b.cuenta_id, b.destino], ['transferencia', 'cus', 'tarjeta:niu']);
  });

  caso('un envío a tu nombre es transferencia entre tus cuentas', () => {
    const b = borradorDeBandeja(ENVIO_PROPIO, {
      'persona:dennys omar lopez munoz': 'propia',
      'aviso:cuscatlan:cuenta': 'cuenta:cus', 'aviso:cuenta:9430': 'cuenta:pro',
    });
    igual([b.tipo, b.cuenta_id, b.destino], ['transferencia', 'cus', 'cuenta:pro']);
  });

  caso('un abono de ti mismo es transferencia, y se sabe a dónde entró', () => {
    const b = borradorDeBandeja(ABONO_PROPIO, { 'persona:dennys omar lopez munoz': 'propia',
                                                'aviso:promerica:cuenta': 'cuenta:pro' });
    igual([b.tipo, b.cuenta_id, b.destino], ['transferencia', '', 'cuenta:pro']);
  });

  caso('una tarjeta no puede ser el origen de una transferencia', () => {
    const b = borradorDeBandeja(RECARGA_NIU, { 'aviso:tarjeta:0242': 'tarjeta:t1' });
    igual([b.tipo, b.cuenta_id], ['transferencia', '']);
  });
});

describir('avisos: lo que se aprende al registrar', (caso) => {
  const egreso = (extra) => ({ tipo: 'egreso', cuenta_id: null, tarjeta_id: null,
                               cuenta_destino_id: null, tarjeta_destino_id: null, ...extra });

  caso('de un egreso, la cuenta o tarjeta de donde salió', () => {
    igual(aprendizajeDe(DEBITO_CUS, egreso({ cuenta_id: 'cus' })),
          [['aviso:cuenta:9214', 'cuenta:cus']]);
  });

  caso('de un ingreso, la cuenta a la que entró', () => {
    igual(aprendizajeDe(ABONO_AJENO, egreso({ tipo: 'ingreso', cuenta_id: 'pro' })),
          [['aviso:promerica:cuenta', 'cuenta:pro']]);
  });

  caso('de una transferencia con tu nombre: las dos cuentas y que eres tú', () => {
    igual(aprendizajeDe(ENVIO_PROPIO, egreso({ tipo: 'transferencia', cuenta_id: 'cus',
                                               cuenta_destino_id: 'pro' })),
          [['aviso:cuscatlan:cuenta', 'cuenta:cus'], ['aviso:cuenta:9430', 'cuenta:pro'],
           ['persona:dennys omar lopez munoz', 'propia']]);
  });

  caso('si ya te reconoce con otra variante del nombre, no la guarda de más', () => {
    igual(aprendizajeDe(ENVIO_PROPIO, egreso({ tipo: 'transferencia', cuenta_id: 'cus' }),
                        { 'persona:dennys lopez': 'propia' }),
          [['aviso:cuscatlan:cuenta', 'cuenta:cus']]);
  });

  caso('una tarjeta nunca se aprende como cuenta', () => {
    igual(aprendizajeDe(RECARGA_NIU, egreso({ tipo: 'transferencia', cuenta_id: 'cus',
                                              cuenta_destino_id: 'cus2' })),
          [['aviso:niu:cuenta:cuenta niu', 'cuenta:cus2']]);
  });

  caso('si lo registras como egreso, el nombre no se aprende como tuyo', () => {
    igual(aprendizajeDe(ENVIO_PROPIO, egreso({ cuenta_id: 'cus' })),
          [['aviso:cuscatlan:cuenta', 'cuenta:cus']]);
  });

  caso('de una compra de Apple Pay, nada: eso va por la tarjeta de Wallet', () => {
    igual(aprendizajeDe({ id: 'x', origen: 'applepay', monto: 3 }, egreso({ cuenta_id: 'c' })), []);
  });
});

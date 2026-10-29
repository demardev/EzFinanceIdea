/* Pruebas de calc/bandeja.js — escritas antes que la implementación.
   Lo que llega del atajo (Apple Pay o un aviso del banco) y cómo se vuelve
   un movimiento. */

import { describir, igual } from './marco.js';
import { fechaLocalDe, borradorDeBandeja, claveDeComercio,
         listasParaRegistrar, conAviso } from '../calc/bandeja.js';

const COMPRA = { id: 'b1', origen: 'applepay', monto: 15.75, comercio: 'ISHOP PASEO',
                 tarjeta: 'Cuscatlán Visa', created_at: '2026-10-08T21:30:00Z' };

describir('bandeja de por confirmar', (caso) => {
  caso('la fecha es la del día local en que llegó, no la de UTC', () => {
    // Las 11:30 p. m. de aquí ya son mañana en UTC: tiene que quedar hoy.
    const noche = new Date(2026, 9, 12, 23, 30).toISOString();
    igual(fechaLocalDe(noche), '2026-10-12');
    const madrugada = new Date(2026, 9, 13, 0, 5).toISOString();
    igual(fechaLocalDe(madrugada), '2026-10-13');
  });

  caso('se vuelve un egreso con monto, comercio y fecha', () => {
    const b = borradorDeBandeja(COMPRA, {});
    igual(b.tipo, 'egreso');
    igual(b.monto, 15.75);
    igual(b.descripcion, 'ISHOP PASEO');
    igual(b.fecha, fechaLocalDe(COMPRA.created_at));
  });

  caso('si ya se aprendió la tarjeta de Wallet, trae el origen', () => {
    const b = borradorDeBandeja(COMPRA, { 'Cuscatlán Visa': 'tarjeta:cus' });
    igual(b.origen, 'tarjeta:cus');
  });

  caso('si no, el origen queda por elegir', () => {
    igual(borradorDeBandeja(COMPRA, { 'BAC Visa': 'tarjeta:bac' }).origen, '');
  });

  caso('sin comercio, una descripción que diga de dónde vino', () => {
    igual(borradorDeBandeja({ ...COMPRA, comercio: null }, {}).descripcion,
          'Compra con Apple Pay');
  });

  caso('el monto llega de la base como texto y sale como número', () => {
    igual(borradorDeBandeja({ ...COMPRA, monto: '15.75' }, {}).monto, 15.75);
  });

  caso('el comercio se compara sin mayúsculas ni espacios de más', () => {
    igual(claveDeComercio('  Starbucks   Paseo '), 'starbucks paseo');
    igual(claveDeComercio(null), '');
  });

  caso('la categoría que confirmaste para ese comercio llega puesta', () => {
    const b = borradorDeBandeja(COMPRA, {}, { aprendidas: { 'ishop paseo': 'k-tec' } });
    igual(b.categoria_id, 'k-tec');
  });

  caso('si no la has confirmado, se toma la de tu historial', () => {
    const b = borradorDeBandeja(COMPRA, {}, { historial: { 'ishop paseo': 'k-hist' } });
    igual(b.categoria_id, 'k-hist');
  });

  caso('lo confirmado gana sobre el historial', () => {
    const b = borradorDeBandeja(COMPRA, {}, { aprendidas: { 'ishop paseo': 'k-tec' },
                                              historial: { 'ishop paseo': 'k-hist' } });
    igual(b.categoria_id, 'k-tec');
  });

  caso('sin nada que la diga, la categoría queda por elegir', () => {
    igual(borradorDeBandeja(COMPRA, {}).categoria_id, '');
    igual(borradorDeBandeja({ ...COMPRA, comercio: null }, {},
                            { historial: { '': 'k' } }).categoria_id, '');
  });

});

describir('avisos del banco en la bandeja', (caso) => {
  const aviso = (texto) => ({ id: 'a1', origen: 'sms', monto: null, comercio: null,
                              tarjeta: null, texto, created_at: '2026-10-28T23:30:00Z' });
  const COMPRA_BAC = aviso('Alertas PRF VISA 1969: has realizado una compra por USD 2.99 en el comercio: APPLE.COM BILL  2026/09/04 14:17:29 Inf. https://bit.ly/32mcTdq');

  caso('lo que dice el aviso llena monto y comercio', () => {
    const i = conAviso(COMPRA_BAC);
    igual([i.monto, i.comercio, i.aviso.banco], [2.99, 'APPLE.COM BILL', 'bac']);
  });

  caso('un item de Apple Pay pasa igual', () => {
    igual(conAviso(COMPRA), COMPRA);
  });

  caso('la fecha es la del aviso, no la de llegada', () => {
    igual(borradorDeBandeja(conAviso(COMPRA_BAC), {}).fecha, '2026-09-04');
  });

  caso('el tipo sale del sentido del aviso', () => {
    const abono = conAviso(aviso('Ha recibido un abono Transferencia de Fondos a cuenta de ahorro de ANA PRUEBA por $ 300.00 a traves de Transfer365 el 25/08/2026 15:47:07'));
    const pago = conAviso(aviso('Niu te informa que pagaste tu Tarjeta de Credito Niu con tu Cuenta Niu por USD 136.87 el 26/09/26 a las 09:59:45 con referencia 1004438275'));
    igual([borradorDeBandeja(abono, {}).tipo, borradorDeBandeja(pago, {}).tipo],
          ['ingreso', 'transferencia']);
    igual(borradorDeBandeja(abono, {}).descripcion, 'ANA PRUEBA');
  });

  caso('fuera de un egreso no se sugiere categoría de comercio', () => {
    const abono = conAviso(aviso('Ha recibido un abono Transferencia de Fondos a cuenta de ahorro de ANA PRUEBA por $ 300.00 a traves de Transfer365 el 25/08/2026 15:47:07'));
    igual(borradorDeBandeja(abono, {}, { aprendidas: { 'ana prueba': 'k' } }).categoria_id, '');
  });

  caso('sin comercio ni persona, dice de qué banco es', () => {
    const debito = conAviso(aviso('Se hizo un Debito en su Cuenta B. CUSCATLAN 9214 por USD23.98 el dia 2026-08-27 16:45. Mas inf. 22122000'));
    igual(borradorDeBandeja(debito, {}).descripcion, 'Aviso de Cuscatlán');
  });

  caso('uno que no se reconoce trae lo que se pudo adivinar', () => {
    const raro = conAviso(aviso('Pago de servicio por USD 12.50 con su cuenta 1234'));
    const b = borradorDeBandeja(raro, {});
    igual([raro.monto, b.tipo, b.monto, b.descripcion], [12.5, 'egreso', 12.5, 'Aviso del banco']);
    igual(b.fecha, fechaLocalDe(raro.created_at));
  });

  caso('un aviso nunca se registra sin revisar', () => {
    const r = listasParaRegistrar([conAviso(COMPRA_BAC)],
      { origenes: {}, categorias: { aprendidas: { 'apple.com bill': 'k' } } },
      { origenes: new Set(['']), categorias: new Set(['k']) });
    igual(r.listas, []);
  });
});

describir('registrar todas las de la bandeja', (caso) => {
  const SUGERENCIAS = {
    origenes: { 'Cuscatlán Visa': 'tarjeta:cus' },
    categorias: { aprendidas: { 'ishop paseo': 'k-tec' }, historial: { starbucks: 'k-comida' } },
  };
  const VIGENTES = { origenes: new Set(['tarjeta:cus']), categorias: new Set(['k-tec', 'k-comida']) };
  const compra = (id, comercio, monto, tarjeta = 'Cuscatlán Visa') =>
    ({ ...COMPRA, id, comercio, monto, tarjeta });

  caso('solo entran las que ya traen tarjeta y categoría', () => {
    const r = listasParaRegistrar([
      compra('a', 'ISHOP PASEO', 15.75),             // las dos aprendidas
      compra('b', 'STARBUCKS', '4.50'),              // categoría del historial
      compra('c', 'TIENDA NUEVA', 9),                // sin categoría
      compra('d', 'ISHOP PASEO', 3, 'BAC Visa'),     // tarjeta sin pareja
    ], SUGERENCIAS, VIGENTES);
    igual(r.listas.map((l) => l.item.id), ['a', 'b']);
    igual(r.listas[1].borrador.categoria_id, 'k-comida');
    igual(r.total, 20.25);
    igual(r.faltan, 2);
  });

  caso('una tarjeta o categoría que ya no está activa no cuenta como puesta', () => {
    const r = listasParaRegistrar([compra('a', 'ISHOP PASEO', 15.75)], SUGERENCIAS,
      { origenes: new Set(), categorias: new Set(['k-tec']) });
    igual(r.listas, []);
    igual(r.faltan, 1);
  });

  caso('sin ninguna completa, total cero', () => {
    const r = listasParaRegistrar([compra('c', 'TIENDA NUEVA', 9)], SUGERENCIAS, VIGENTES);
    igual(r.total, 0);
  });
});

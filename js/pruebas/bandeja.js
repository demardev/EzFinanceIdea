/* Pruebas de calc/bandeja.js — escritas antes que la implementación.
   Lo que llega del atajo de Apple Pay y cómo se vuelve un movimiento. */

import { describir, igual } from './marco.js';
import { fechaLocalDe, borradorDeBandeja, claveDeComercio } from '../calc/bandeja.js';

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

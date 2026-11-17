/* Pruebas de calc/estado-cuenta.js — escritas antes que la implementación.
   La IA lee el estado de cuenta; el código decide si lo leído es creíble:
   saldo anterior + cargos − créditos + intereses tiene que dar el saldo al
   corte que dice el mismo estado de cuenta. Si no da, la IA leyó mal. */

import { describir, igual, cierto } from './marco.js';
import { normalizarLectura, revisarLectura } from '../calc/estado-cuenta.js';
import { SEPTIEMBRE, OCTUBRE, NOVIEMBRE } from './estados-bac.js';

const conMovimiento = (lectura, i, cambio) => ({
  ...lectura,
  movimientos: lectura.movimientos.map((m, k) => (k === i ? { ...m, ...cambio } : m)),
});

describir('estado de cuenta: ¿lo leído cuadra?', (caso) => {
  caso('los tres cortes reales de BAC cuadran', () => {
    for (const lectura of [SEPTIEMBRE, OCTUBRE, NOVIEMBRE]) {
      const r = revisarLectura(normalizarLectura(lectura));
      cierto(r.cuadra, `${lectura.fecha_corte}: diferencia ${r.diferencia}`);
      igual(r.diferencia, 0);
    }
  });

  caso('suma cargos, créditos e intereses por separado', () => {
    const r = revisarLectura(normalizarLectura(NOVIEMBRE));
    igual(r.cargos, 597.09);
    igual(r.creditos, 242.42);
    igual(r.intereses, 4.62);
    igual(r.calculado, 423.87);
  });

  caso('un monto mal leído no cuadra y dice por cuánto', () => {
    const mal = conMovimiento(NOVIEMBRE, 4, { monto: 17.45 });
    const r = revisarLectura(normalizarLectura(mal));
    cierto(!r.cuadra);
    igual(r.diferencia, -154);
  });

  caso('olvidar los intereses del pie no cuadra', () => {
    const r = revisarLectura(normalizarLectura({ ...NOVIEMBRE, intereses_fuera_de_lista: 0 }));
    cierto(!r.cuadra);
    igual(r.diferencia, -4.62);
  });

  caso('un crédito leído como cargo no cuadra', () => {
    const r = revisarLectura(normalizarLectura(conMovimiento(OCTUBRE, 10, { sentido: 'cargo' })));
    cierto(!r.cuadra);
  });
});

describir('estado de cuenta: limpiar lo que devuelve la IA', (caso) => {
  caso('redondea a centavos y quita espacios', () => {
    const l = normalizarLectura({ ...SEPTIEMBRE, saldo_al_corte: 150.4900001,
      movimientos: [{ fecha: '2026-09-02', concepto: '  LLAOLLAO  ', monto: 10.979999,
                      sentido: 'cargo' }] });
    igual(l.saldo_al_corte, 150.49);
    igual(l.movimientos[0], { fecha: '2026-09-02', concepto: 'LLAOLLAO', monto: 10.98,
                              sentido: 'cargo' });
  });

  caso('una línea sin fecha se acepta (la bonificación no trae)', () => {
    igual(normalizarLectura(SEPTIEMBRE).movimientos.at(-1).fecha, null);
  });

  caso('quita las líneas en cero (puntos, cashback)', () => {
    const l = normalizarLectura({ ...SEPTIEMBRE,
      movimientos: [...SEPTIEMBRE.movimientos, { fecha: null, concepto: 'CASHBAC', monto: 0,
                                                 sentido: 'credito' }] });
    igual(l.movimientos.length, SEPTIEMBRE.movimientos.length);
  });

  caso('rechaza lo que no es un estado de cuenta usable', () => {
    const falla = (cambio) => {
      try { normalizarLectura({ ...SEPTIEMBRE, ...cambio }); return false; } catch { return true; }
    };
    cierto(falla({ fecha_corte: '09/09/2026' }), 'fecha que no es ISO');
    cierto(falla({ fecha_corte: '2026-02-30' }), 'fecha que no existe');
    cierto(falla({ saldo_al_corte: 'mucho' }), 'saldo que no es número');
    cierto(falla({ movimientos: 'nada' }), 'movimientos que no son lista');
    cierto(falla({ movimientos: [{ fecha: null, concepto: 'X', monto: -5, sentido: 'cargo' }] }),
      'monto negativo');
    cierto(falla({ movimientos: [{ fecha: null, concepto: 'X', monto: 5, sentido: 'otro' }] }),
      'sentido desconocido');
  });

  /* Con la forma obligatoria, la IA devuelve algo aunque el PDF sea un recibo
     de luz: todo en cero y sin movimientos, que "cuadra" (0 = 0). */
  caso('rechaza un documento que no es estado de cuenta', () => {
    const falla = (lectura) => {
      try { normalizarLectura(lectura); return ''; } catch (e) { return e.message; }
    };
    const vacia = { ...SEPTIEMBRE, fecha_corte: null, saldo_anterior: 0, saldo_al_corte: 0,
                    intereses_fuera_de_lista: 0, pago_contado: null, movimientos: [] };
    cierto(falla({ ...vacia, es_estado_de_cuenta: false }).includes('no parece'));
    cierto(falla({ ...SEPTIEMBRE, es_estado_de_cuenta: false }).includes('no parece'),
      'aunque traiga datos, si la IA dice que no es, no es');
    cierto(falla(vacia).includes('fecha de corte'), 'sin fecha de corte no se puede usar');
  });

  caso('un estado de cuenta real sigue pasando', () => {
    igual(normalizarLectura({ ...SEPTIEMBRE, es_estado_de_cuenta: true }).fecha_corte,
          '2026-09-09');
  });

  caso('un saldo a favor (negativo) sí se acepta', () => {
    igual(normalizarLectura({ ...SEPTIEMBRE, saldo_al_corte: -12.5 }).saldo_al_corte, -12.5);
  });
});

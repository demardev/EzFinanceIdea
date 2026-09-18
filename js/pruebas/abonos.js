/* Pruebas de negocio/abonos.js — escritas antes que la implementación.
   El caso de la vida real: un recibo de $50.00 con $1.00 de comisión, del que
   te dan $35.00 en efectivo ese día y el resto otro día por transferencia. */

import { describir, igual, cierto } from './marco.js';
import { abonosDe, totalDe, cobradoDe, saldoDe, repartirAbonos, liquidacion,
         problemaDeAbonos, conAbonos, agregarAbono } from '../negocio/abonos.js';

const BASE = {
  id: 'p1', monto_recibo: 50, comision: 1,
  fecha_pago: '2026-09-01', cuenta_pago_id: 'banco',
  fecha_cobro: null, cuenta_cobro_id: null, abonos: [],
};

const EFECTIVO = { fecha: '2026-09-01', cuenta_id: 'efectivo', monto: 35 };
const RESTO = { fecha: '2026-09-05', cuenta_id: 'banco', monto: 16 };

const con = (...abonos) => ({ ...BASE, abonos });

describir('abonos — cuánto te deben', (caso) => {
  caso('el total es el recibo más la comisión', () => {
    igual(totalDe(BASE), 51);
  });

  caso('sin abonos no has cobrado nada', () => {
    igual(abonosDe(BASE), []);
    igual(cobradoDe(BASE), 0);
    igual(saldoDe(BASE), 51);
  });

  caso('lo abonado se descuenta de lo que te deben', () => {
    igual(cobradoDe(con(EFECTIVO)), 35);
    igual(saldoDe(con(EFECTIVO)), 16);
    igual(saldoDe(con(EFECTIVO, RESTO)), 0);
  });

  caso('los abonos salen en orden de fecha, como pasaron', () => {
    igual(abonosDe(con(RESTO, EFECTIVO)).map((a) => a.monto), [35, 16]);
  });

  caso('lo cobrado antes de los abonos cuenta como un solo abono por todo', () => {
    const viejo = { ...BASE, abonos: undefined,
                    fecha_cobro: '2026-09-08', cuenta_cobro_id: 'efectivo' };
    igual(abonosDe(viejo), [{ fecha: '2026-09-08', cuenta_id: 'efectivo', monto: 51 }]);
    igual(saldoDe(viejo), 0);
  });
});

describir('abonos — primero el recibo, la comisión al final', (caso) => {
  const partes = (pago) => repartirAbonos(pago).map((a) => `${a.recibo}+${a.comision}`);

  caso('un abono menor al recibo es todo recibo', () => {
    igual(partes(con(EFECTIVO)), ['35+0']);
  });

  caso('el abono que completa el recibo trae la comisión', () => {
    igual(partes(con(EFECTIVO, RESTO)), ['35+0', '15+1']);
  });

  caso('la comisión se puede cubrir en dos abonos', () => {
    igual(partes(con({ ...EFECTIVO, monto: 50.5 }, { ...RESTO, monto: 0.5 })),
          ['50+0.5', '0+0.5']);
  });

  caso('cada parte conserva la fecha y la cuenta de su abono', () => {
    const [, segundo] = repartirAbonos(con(EFECTIVO, RESTO));
    igual(segundo.fecha, '2026-09-05');
    igual(segundo.cuenta_id, 'banco');
  });
});

describir('abonos — cuándo queda saldado', (caso) => {
  caso('mientras falte algo sigue pendiente', () => {
    igual(liquidacion(con(EFECTIVO)), { fecha_cobro: null, cuenta_cobro_id: null });
    igual(liquidacion(BASE), { fecha_cobro: null, cuenta_cobro_id: null });
  });

  caso('saldado: la fecha y la cuenta del abono que lo completó', () => {
    igual(liquidacion(con(RESTO, EFECTIVO)),
          { fecha_cobro: '2026-09-05', cuenta_cobro_id: 'banco' });
  });
});

describir('abonos — lo que no se puede guardar', (caso) => {
  caso('abonos bien puestos no tienen problema', () => {
    igual(problemaDeAbonos(con(EFECTIVO, RESTO)), null);
    igual(problemaDeAbonos(BASE), null);
  });

  caso('un abono en cero no es un abono', () => {
    cierto(problemaDeAbonos(con({ ...EFECTIVO, monto: 0 })));
  });

  caso('no te pueden pagar más de lo que te deben', () => {
    cierto(/\$1\.00/.test(problemaDeAbonos(con(EFECTIVO, { ...RESTO, monto: 17 }))));
  });

  caso('no te pueden pagar antes de que pagaras el recibo', () => {
    cierto(problemaDeAbonos(con({ ...EFECTIVO, fecha: '2026-08-31' })));
  });

  caso('cada abono necesita su cuenta', () => {
    cierto(problemaDeAbonos(con({ ...EFECTIVO, cuenta_id: null })));
  });
});

describir('abonos — agregar y quitar', (caso) => {
  caso('un abono con monto entra tal cual y sigue pendiente', () => {
    const r = agregarAbono(BASE, EFECTIVO);
    igual(r.abonos, [EFECTIVO]);
    igual(r.fecha_cobro, null);
  });

  caso('un abono sin monto es por todo lo que falta, y lo salda', () => {
    const r = agregarAbono(con(EFECTIVO), { fecha: '2026-09-05', cuenta_id: 'banco', monto: null });
    igual(r.abonos.map((a) => a.monto), [35, 16]);
    igual(r.fecha_cobro, '2026-09-05');
    igual(r.cuenta_cobro_id, 'banco');
  });

  caso('quitar un abono lo vuelve a dejar pendiente', () => {
    const saldado = conAbonos(BASE, [EFECTIVO, RESTO]);
    igual(saldado.fecha_cobro, '2026-09-05');
    const r = conAbonos(saldado, [EFECTIVO]);
    igual(r.fecha_cobro, null);
    igual(r.cuenta_cobro_id, null);
  });

  caso('quitar el único abono de una operación vieja la deja pendiente', () => {
    const viejo = { ...BASE, abonos: [], fecha_cobro: '2026-09-08', cuenta_cobro_id: 'efectivo' };
    const r = conAbonos(viejo, []);
    igual(r.fecha_cobro, null);
    igual(saldoDe(r), 51);
  });

  caso('no deja la operación vieja convertida a medias', () => {
    const viejo = { ...BASE, abonos: [], fecha_cobro: '2026-09-08', cuenta_cobro_id: 'efectivo' };
    igual(agregarAbono(viejo, EFECTIVO).abonos.length, 2);
  });
});

/* Pruebas de calc/saldos.js — escritas antes que la implementación. */

import { describir, igual } from './marco.js';
import { deltaEnCuenta, saldoDeCuenta, saldosPorCuenta,
         patrimonioLiquido, totalesDelMes } from '../calc/saldos.js';

const CUENTAS = [
  { id: 'banco',   saldo_inicial: 1000 },
  { id: 'ahorros', saldo_inicial: 5000 },
];

const MOVS = [
  { tipo: 'ingreso',       monto: 2400, cuenta_id: 'banco' },
  { tipo: 'egreso',        monto: 300,  cuenta_id: 'banco' },
  { tipo: 'egreso',        monto: 150,  tarjeta_id: 'amex' },          // no toca cuentas
  { tipo: 'transferencia', monto: 500,  cuenta_id: 'banco', cuenta_destino_id: 'ahorros' },
  { tipo: 'transferencia', monto: 200,  cuenta_id: 'banco', tarjeta_destino_id: 'amex' }, // pago tarjeta
];

describir('saldos', (caso) => {
  caso('el ingreso suma a su cuenta y el egreso resta', () => {
    igual(deltaEnCuenta({ tipo: 'ingreso', monto: 100, cuenta_id: 'banco' }, 'banco'), 100);
    igual(deltaEnCuenta({ tipo: 'egreso', monto: 100, cuenta_id: 'banco' }, 'banco'), -100);
  });

  caso('un egreso a tarjeta no mueve ninguna cuenta', () => {
    igual(deltaEnCuenta({ tipo: 'egreso', monto: 100, tarjeta_id: 'amex' }, 'banco'), 0);
  });

  caso('la transferencia sale de una cuenta y entra a la otra', () => {
    const mov = { tipo: 'transferencia', monto: 500, cuenta_id: 'banco', cuenta_destino_id: 'ahorros' };
    igual(deltaEnCuenta(mov, 'banco'), -500);
    igual(deltaEnCuenta(mov, 'ahorros'), 500);
    igual(deltaEnCuenta(mov, 'otra'), 0);
  });

  caso('pagar una tarjeta solo resta de la cuenta que paga', () => {
    const mov = { tipo: 'transferencia', monto: 200, cuenta_id: 'banco', tarjeta_destino_id: 'amex' };
    igual(deltaEnCuenta(mov, 'banco'), -200);
  });

  caso('saldo de cuenta = inicial + movimientos', () => {
    // 1000 + 2400 − 300 − 500 − 200 = 2400
    igual(saldoDeCuenta(CUENTAS[0], MOVS), 2400);
    igual(saldoDeCuenta(CUENTAS[1], MOVS), 5500);
  });

  caso('saldosPorCuenta devuelve un mapa por id', () => {
    igual(saldosPorCuenta(CUENTAS, MOVS), { banco: 2400, ahorros: 5500 });
  });

  caso('patrimonio líquido suma todas las cuentas', () => {
    igual(patrimonioLiquido(CUENTAS, MOVS), 7900);
  });

  caso('totales del mes: las transferencias no son ni entrada ni salida', () => {
    // entró 2400; salió 300 + 150 (la compra con tarjeta sí es gasto)
    igual(totalesDelMes(MOVS), { entro: 2400, salio: 450, neto: 1950 });
  });

  caso('sin movimientos, el saldo es el inicial', () => {
    igual(saldoDeCuenta({ id: 'x', saldo_inicial: 250.5 }, []), 250.5);
    igual(totalesDelMes([]), { entro: 0, salio: 0, neto: 0 });
  });
});

/* Un movimiento con fecha futura es un pendiente: no es dinero que tengas
   hoy. El día que llega entra solo, sin confirmar nada. */
describir('saldos — lo que todavía no pasa no cuenta', (caso) => {
  const banco = { id: 'banco', saldo_inicial: 100 };
  const efectivo = { id: 'efectivo', saldo_inicial: 0 };
  const mov = (tipo, monto, fecha, extra = {}) =>
    ({ tipo, monto, fecha, cuenta_id: 'banco', ...extra });

  caso('un ingreso de la semana que viene no sube el saldo de hoy', () => {
    igual(saldoDeCuenta(banco, [mov('ingreso', 500, '2026-09-20')], '2026-09-11'), 100);
  });

  caso('el día que le toca, entra solo', () => {
    igual(saldoDeCuenta(banco, [mov('ingreso', 500, '2026-09-20')], '2026-09-20'), 600);
  });

  caso('una transferencia futura no mueve ninguna de las dos cuentas', () => {
    const movs = [mov('transferencia', 50, '2026-09-20', { cuenta_destino_id: 'efectivo' })];
    igual(saldoDeCuenta(banco, movs, '2026-09-11'), 100);
    igual(saldoDeCuenta(efectivo, movs, '2026-09-11'), 0);
  });

  caso('el patrimonio tampoco cuenta el futuro', () => {
    igual(patrimonioLiquido([banco, efectivo], [mov('ingreso', 500, '2026-09-20')],
                            '2026-09-11'), 100);
  });

  caso('un movimiento sin fecha se cuenta: no se pierde dinero en silencio', () => {
    igual(saldoDeCuenta(banco, [{ tipo: 'ingreso', monto: 40, cuenta_id: 'banco' }],
                        '2026-09-11'), 140);
  });

  caso('saldosPorCuenta hace el mismo corte', () => {
    igual(saldosPorCuenta([banco], [mov('egreso', 30, '2026-09-20')], '2026-09-11'),
          { banco: 100 });
  });
});

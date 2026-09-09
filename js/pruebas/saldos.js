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

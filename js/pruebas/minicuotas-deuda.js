/* Pruebas de calc/minicuotas.js: que un traslado no cuente dos veces ni en la
   deuda de la tarjeta ni en el gasto del mes. Mismo caso que pruebas/minicuotas.js. */

import { describir, igual, cierto } from './marco.js';
import { generarTraslado, esCompraTrasladada, esCuotaDeTraslado } from '../calc/minicuotas.js';
import { cargosDeTarjeta } from '../calc/saldo-inicial-tarjeta.js';
import { calcularDeuda } from '../calc/deuda-tarjeta.js';
import { progresoDeCompra, esCuotaYaPagada } from '../calc/cuotas.js';
import { totalesDelMes } from '../calc/saldos.js';
import { TARJETA, TRASLADO, ciclo, cargo } from './minicuotas.js';

describir('minicuotas: no contar dos veces', (caso) => {
  const originales = [cargo('a', 171.45, '2026-10-23', { traslado_id: 'tr1' }),
                      cargo('b', 128.55, '2026-11-02', { traslado_id: 'tr1' })];
  const otro = cargo('c', 10, '2026-11-01');
  const generados = generarTraslado(TRASLADO).map((m, i) => ({ ...m, id: `g${i}` }));
  const todos = [...originales, otro, ...generados];

  caso('quién es quién', () => {
    cierto(esCompraTrasladada(originales[0]));
    cierto(!esCompraTrasladada(generados[0]));
    cierto(esCuotaDeTraslado(generados.find((m) => m.cuota_num === 1)));
    cierto(!esCuotaDeTraslado(generados.find((m) => m.cuota_num === 0)));
  });

  caso('la deuda deja fuera las originales y suma la comisión', () => {
    const cargos = cargosDeTarjeta(TARJETA, todos, [TRASLADO]);
    cierto(!cargos.some(esCompraTrasladada));
    cierto(cargos.some((m) => m.cuota_num === 0), 'la comisión no se pierde');
  });

  caso('el corte abierto baja y las cuotas quedan comprometidas', () => {
    const deuda = calcularDeuda(cargosDeTarjeta(TARJETA, todos, [TRASLADO]),
                                { ...ciclo(), hoy: '2026-11-05' });
    igual(deuda.nuevoCiclo, 22.5);      // 10 de la otra compra + 12.50 de comisión
    igual(deuda.comprometido, 300);
  });

  caso('el gasto del mes cuenta originales y comisión, no las cuotas', () => {
    const delMes = [...originales, ...generados].filter((m) => m.fecha.startsWith('2026-1'));
    igual(totalesDelMes(delMes).salio, 312.5);
  });

  caso('la comisión no cuenta en el avance de cuotas', () => {
    igual(progresoDeCompra(TRASLADO, generados, '2026-11-05').texto, '0/6');
  });

  caso('la comisión no se marca como cuota ya pagada', () => {
    cierto(!esCuotaYaPagada(generados.find((m) => m.cuota_num === 0), [TRASLADO]));
  });
});

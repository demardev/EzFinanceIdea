/* Pruebas de calc/minicuotas.js — escritas antes que la implementación.
   Caso parecido a BAC: corte el 12, hoy 04/nov/2026. Se pasan a minicuotas
   compras del corte abierto (13/oct en adelante); el banco cobra una comisión
   única al día siguiente y la primera cuota 30 días después. */

import { describir, igual, cierto } from './marco.js';
import { comprasTrasladables, fechasPorDefecto, generarTraslado,
         esCompraTrasladada, esCuotaDeTraslado, previaTraslado } from '../calc/minicuotas.js';
import { cargosDeTarjeta } from '../calc/saldo-inicial-tarjeta.js';
import { calcularCiclo } from '../calc/ciclo-tarjeta.js';
import { calcularDeuda } from '../calc/deuda-tarjeta.js';
import { progresoDeCompra, esCuotaYaPagada } from '../calc/cuotas.js';
import { totalesDelMes } from '../calc/saldos.js';
import { sumar } from '../calc/dinero.js';

const HOY = '2026-11-04';
const TARJETA = { id: 'bac', dia_corte: 12, dia_limite_pago: 2, saldo_inicial: 0,
                  minicuotas: true, minicuotas_primera: 'dias_30', minicuotas_interes: 'comision' };
const ciclo = () => calcularCiclo(12, 2, HOY);

const cargo = (id, monto, fecha, extra = {}) =>
  ({ id, tipo: 'egreso', monto, fecha, tarjeta_id: 'bac', ...extra });

const TRASLADO = {
  id: 'tr1', tarjeta_id: 'bac', tipo: 'minicuotas', descripcion: 'Minicuotas',
  monto_total: 300, num_cuotas: 6, interes: 12.5, interes_en_cuotas: false,
  fecha_compra: HOY, fecha_primera_cuota: '2026-12-04', fecha_comision: '2026-11-05',
  categoria_id: 'kc', cuotas_pagadas: 0,
};

describir('minicuotas: qué compras se pueden trasladar', (caso) => {
  const MOVS = [
    cargo('viejo', 50, '2026-10-12'),                         // corte ya cerrado
    cargo('a', 171.45, '2026-10-23'),
    cargo('b', 40.32, '2026-11-02'),
    cargo('cuota', 9.97, '2026-10-28', { compra_id: 'c1', cuota_num: 12 }),
    cargo('ya', 30, '2026-11-01', { traslado_id: 'otro' }),
    cargo('futuro', 20, '2026-11-10'),
    cargo('otra', 15, '2026-11-01', { tarjeta_id: 'otra' }),
    { id: 'pago', tipo: 'transferencia', monto: 64.58, fecha: '2026-10-27',
      tarjeta_destino_id: 'bac', cuenta_id: 'k' },
  ];

  caso('solo cargos del corte abierto, sin cuotas ni ya trasladados', () => {
    const ids = comprasTrasladables(MOVS, TARJETA, ciclo()).map((m) => m.id);
    igual(ids, ['b', 'a']);
  });
});

describir('minicuotas: fechas que vienen escritas', (caso) => {
  caso('30 días después y la comisión al día siguiente', () => {
    igual(fechasPorDefecto(TARJETA, HOY),
      { fecha_primera_cuota: '2026-12-04', fecha_comision: '2026-11-05' });
  });

  caso('en el corte abierto: el día del corte que viene', () => {
    const t = { ...TARJETA, minicuotas_primera: 'corte_abierto' };
    igual(fechasPorDefecto(t, HOY).fecha_primera_cuota, '2026-11-12');
  });

  caso('en el siguiente corte: un corte después', () => {
    const t = { ...TARJETA, minicuotas_primera: 'corte_siguiente' };
    igual(fechasPorDefecto(t, HOY).fecha_primera_cuota, '2026-12-12');
  });
});

describir('minicuotas: movimientos del traslado', (caso) => {
  caso('comisión aparte: las cuotas suman lo trasladado y la comisión va sola', () => {
    const movs = generarTraslado(TRASLADO);
    const cuotas = movs.filter((m) => m.cuota_num > 0);
    const comision = movs.filter((m) => m.cuota_num === 0);
    igual(cuotas.length, 6);
    igual(sumar(...cuotas.map((m) => m.monto)), 300);
    igual(comision.length, 1);
    igual(comision[0].monto, 12.5);
    igual(comision[0].fecha, '2026-11-05');
  });

  caso('las cuotas empiezan en la primera fecha y siguen cada mes', () => {
    const cuotas = generarTraslado(TRASLADO).filter((m) => m.cuota_num > 0);
    igual(cuotas.map((m) => m.fecha).slice(0, 3), ['2026-12-04', '2027-01-04', '2027-02-04']);
  });

  caso('todo va atado al traslado y a la tarjeta', () => {
    cierto(generarTraslado(TRASLADO).every((m) => m.compra_id === 'tr1'
      && m.traslado_id === 'tr1' && m.tarjeta_id === 'bac' && m.tipo === 'egreso'));
  });

  caso('interés en las cuotas: suman lo trasladado más el interés, sin comisión', () => {
    const movs = generarTraslado({ ...TRASLADO, interes_en_cuotas: true });
    igual(movs.length, 6);
    igual(sumar(...movs.map((m) => m.monto)), 312.5);
  });

  caso('sin interés no hay cargo de comisión', () => {
    igual(generarTraslado({ ...TRASLADO, interes: 0 }).length, 6);
  });
});

describir('minicuotas: vista previa', (caso) => {
  const elegidas = [cargo('a', 171.45, '2026-10-23'), cargo('b', 128.55, '2026-11-02')];
  const condiciones = { num_cuotas: 6, interes: 12.5, interes_en_cuotas: false,
                        fecha_primera_cuota: '2026-12-04', fecha_comision: '2026-11-05' };

  caso('suma lo elegido y dice cuánto se paga en total', () => {
    const p = previaTraslado(elegidas, condiciones);
    igual(p.monto, 300);
    igual(p.cuotas.length, 6);
    igual(p.cuotas[0].monto, 50);
    igual(p.comision.monto, 12.5);
    igual(p.totalAPagar, 312.5);
  });

  caso('con el interés en las cuotas no hay comisión aparte', () => {
    const p = previaTraslado(elegidas, { ...condiciones, interes_en_cuotas: true });
    igual(p.comision, null);
    igual(p.totalAPagar, 312.5);
  });
});

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

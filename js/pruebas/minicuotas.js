/* Pruebas de calc/minicuotas.js — escritas antes que la implementación.
   Caso parecido a BAC: corte el 12, hoy 04/nov/2026. Se pasan a minicuotas
   compras del corte abierto (13/oct en adelante) o del que acaba de cerrar
   (13/sep al 12/oct); el banco cobra una comisión única al día siguiente, la
   primera cuota 30 días después, y la cuota mensual que da para el plazo puede
   traer interés aparte de esa comisión. */

import { describir, igual, cierto } from './marco.js';
import { comprasTrasladables, agruparPorCorte, fechasPorDefecto, generarTraslado,
         esCompraTrasladada, esCuotaDeTraslado, previaTraslado } from '../calc/minicuotas.js';
import { calcularCiclo } from '../calc/ciclo-tarjeta.js';
import { sumar } from '../calc/dinero.js';

const HOY = '2026-11-04';
export const TARJETA = { id: 'bac', dia_corte: 12, dia_limite_pago: 2, saldo_inicial: 0,
                  minicuotas: true, minicuotas_primera: 'dias_30' };
export const ciclo = () => calcularCiclo(12, 2, HOY);

export const cargo = (id, monto, fecha, extra = {}) =>
  ({ id, tipo: 'egreso', monto, fecha, tarjeta_id: 'bac', ...extra });

export const TRASLADO = {
  id: 'tr1', tarjeta_id: 'bac', tipo: 'minicuotas', descripcion: 'Minicuotas',
  monto_total: 300, num_cuotas: 6, interes: 12.5, cuota_mensual: null,
  fecha_compra: HOY, fecha_primera_cuota: '2026-12-04', fecha_comision: '2026-11-05',
  categoria_id: 'kc', cuotas_pagadas: 0,
};

describir('minicuotas: qué compras se pueden trasladar', (caso) => {
  const MOVS = [
    cargo('viejo', 50, '2026-10-12'),                         // corte recién cerrado
    cargo('cerrado', 25, '2026-09-13'),                       // primer día de ese corte
    cargo('antiguo', 70, '2026-09-12'),                       // dos cortes atrás
    cargo('a', 171.45, '2026-10-23'),
    cargo('b', 40.32, '2026-11-02'),
    cargo('cuota', 9.97, '2026-10-28', { compra_id: 'c1', cuota_num: 12 }),
    cargo('ya', 30, '2026-11-01', { traslado_id: 'otro' }),
    cargo('futuro', 20, '2026-11-10'),
    cargo('otra', 15, '2026-11-01', { tarjeta_id: 'otra' }),
    { id: 'pago', tipo: 'transferencia', monto: 64.58, fecha: '2026-10-27',
      tarjeta_destino_id: 'bac', cuenta_id: 'k' },
  ];

  caso('cargos del corte abierto y del recién cerrado, sin cuotas ni ya trasladados', () => {
    const ids = comprasTrasladables(MOVS, TARJETA, ciclo()).map((m) => m.id);
    igual(ids, ['b', 'a', 'viejo', 'cerrado']);
  });

  caso('se agrupan por corte, el abierto primero', () => {
    const grupos = agruparPorCorte(comprasTrasladables(MOVS, TARJETA, ciclo()), ciclo());
    igual(grupos.map((g) => g.abierto), [true, false]);
    igual(grupos.map((g) => g.compras.map((m) => m.id)), [['b', 'a'], ['viejo', 'cerrado']]);
    igual(grupos[1].fechaCorte, '2026-10-12');
  });

  caso('un corte sin compras no sale', () => {
    const grupos = agruparPorCorte([cargo('a', 1, '2026-10-23')], ciclo());
    igual(grupos.length, 1);
    cierto(grupos[0].abierto);
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

  caso('sin cuota mensual: lo trasladado repartido entre los meses', () => {
    const cuotas = generarTraslado(TRASLADO).filter((m) => m.cuota_num > 0);
    cierto(cuotas.every((m) => m.monto === 50));
  });

  caso('con la cuota del banco: cada mes esa cuota, aparte de la comisión', () => {
    const movs = generarTraslado({ ...TRASLADO, cuota_mensual: 52.08 });
    const cuotas = movs.filter((m) => m.cuota_num > 0);
    igual(cuotas.length, 6);
    cierto(cuotas.every((m) => m.monto === 52.08));
    igual(movs.find((m) => m.cuota_num === 0).monto, 12.5);
  });

  caso('la cuota sin comisión: solo las cuotas', () => {
    const movs = generarTraslado({ ...TRASLADO, interes: 0, cuota_mensual: 52.08 });
    igual(movs.length, 6);
    igual(sumar(...movs.map((m) => m.monto)), 312.48);
  });

  caso('sin comisión no hay cargo de comisión', () => {
    igual(generarTraslado({ ...TRASLADO, interes: 0 }).length, 6);
  });
});

describir('minicuotas: vista previa', (caso) => {
  const elegidas = [cargo('a', 171.45, '2026-10-23'), cargo('b', 128.55, '2026-11-02')];
  const condiciones = { num_cuotas: 6, interes: 12.5, cuota_mensual: 0,
                        fecha_primera_cuota: '2026-12-04', fecha_comision: '2026-11-05' };

  caso('suma lo elegido y dice cuánto se paga en total', () => {
    const p = previaTraslado(elegidas, condiciones);
    igual(p.monto, 300);
    igual(p.cuotas.length, 6);
    igual(p.cuotas[0].monto, 50);
    igual(p.comision.monto, 12.5);
    igual(p.interesEnCuotas, 0);
    igual(p.totalAPagar, 312.5);
  });

  caso('separa el interés de las cuotas de la comisión', () => {
    const p = previaTraslado(elegidas, { ...condiciones, cuota_mensual: 52.08 });
    igual(p.cuotas[0].monto, 52.08);
    igual(p.interesEnCuotas, 12.48);
    igual(p.comision.monto, 12.5);
    igual(p.totalAPagar, 324.98);
  });

  caso('la cuota sin interés del plazo, para comparar con la del banco', () => {
    igual(previaTraslado(elegidas, condiciones).cuotaSinInteres, 50);
    igual(previaTraslado(elegidas, { ...condiciones, num_cuotas: 12 }).cuotaSinInteres, 25);
  });

  caso('una cuota que no cubre lo trasladado da interés negativo', () => {
    cierto(previaTraslado(elegidas, { ...condiciones, cuota_mensual: 40 }).interesEnCuotas < 0);
  });

  caso('sin comisión no hay comisión', () => {
    igual(previaTraslado(elegidas, { ...condiciones, interes: 0 }).comision, null);
  });
});

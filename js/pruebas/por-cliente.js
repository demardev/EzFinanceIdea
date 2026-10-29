/* Pruebas de negocio/por-cliente.js — escritas antes que la implementación.
   Por cobrar agrupado por cliente: de cada uno, cuánto te debe de recibos,
   cuánto de comisiones y el total. */

import { describir, igual } from './marco.js';
import { porCobrarPorCliente, saldarTodos, clientesDelMes } from '../negocio/por-cliente.js';

const CLIENTES = [
  { id: 'rosa', nombre: 'Rosa' },
  { id: 'ana', nombre: 'Ana' },
  { id: 'pepe', nombre: 'Pepe', archivado: true },
];

const pago = (id, cliente_id, monto_recibo, comision, abonos = []) => ({
  id, cliente_id, monto_recibo, comision, abonos,
  fecha_pago: '2026-10-01', fecha_cobro: null, cuenta_cobro_id: null,
});

const resumen = (r) => r.grupos.map((g) =>
  `${g.nombre ?? '—'} ${g.recibos} + ${g.comisiones} = ${g.total} (${g.pagos.length})`);

describir('por cobrar — por cliente', (caso) => {
  caso('suma recibos y comisiones de cada cliente', () => {
    const r = porCobrarPorCliente([
      pago('a', 'rosa', 50, 1), pago('b', 'rosa', 30, 1), pago('c', 'ana', 20, 0.5),
    ], CLIENTES);
    igual(resumen(r), ['Ana 20 + 0.5 = 20.5 (1)', 'Rosa 80 + 2 = 82 (2)']);
  });

  caso('los totales generales son la suma de todos', () => {
    const r = porCobrarPorCliente([
      pago('a', 'rosa', 50, 1), pago('c', 'ana', 20, 0.5), pago('d', null, 10, 1),
    ], CLIENTES);
    igual([r.recibos, r.comisiones, r.total], [80, 2.5, 82.5]);
  });

  caso('sin cliente va en su propio grupo, al final', () => {
    const r = porCobrarPorCliente([pago('d', null, 10, 1), pago('a', 'rosa', 50, 1)], CLIENTES);
    igual(r.grupos.map((g) => g.cliente_id), ['rosa', null]);
    igual(r.grupos[1].nombre, null);
  });

  caso('un cliente archivado sigue saliendo con su nombre', () => {
    const r = porCobrarPorCliente([pago('e', 'pepe', 15, 1)], CLIENTES);
    igual(resumen(r), ['Pepe 15 + 1 = 16 (1)']);
  });

  caso('un cliente que no está en la lista cae en sin cliente', () => {
    const r = porCobrarPorCliente([pago('f', 'borrado', 15, 1)], CLIENTES);
    igual(r.grupos.map((g) => g.cliente_id), [null]);
  });

  caso('con abonos cuenta solo lo que falta: primero se cubre el recibo', () => {
    // 50 + 1, abonados 35: faltan 15 de recibo y 1 de comisión
    const parcial = pago('a', 'rosa', 50, 1, [{ fecha: '2026-10-02', cuenta_id: 'x', monto: 35 }]);
    igual(resumen(porCobrarPorCliente([parcial], CLIENTES)), ['Rosa 15 + 1 = 16 (1)']);
  });

  caso('con el recibo cubierto solo falta la comisión', () => {
    const parcial = pago('a', 'rosa', 50, 1, [{ fecha: '2026-10-02', cuenta_id: 'x', monto: 50.4 }]);
    igual(resumen(porCobrarPorCliente([parcial], CLIENTES)), ['Rosa 0 + 0.6 = 0.6 (1)']);
  });

  caso('lo ya cobrado no aparece', () => {
    const saldado = pago('a', 'rosa', 50, 1, [{ fecha: '2026-10-02', cuenta_id: 'x', monto: 51 }]);
    const r = porCobrarPorCliente([saldado, pago('c', 'ana', 20, 0)], CLIENTES);
    igual(resumen(r), ['Ana 20 + 0 = 20 (1)']);
  });

  caso('sin pendientes no hay grupos y todo es cero', () => {
    igual(porCobrarPorCliente([], CLIENTES),
          { grupos: [], recibos: 0, comisiones: 0, total: 0 });
  });

  caso('dentro de un cliente las operaciones conservan su orden', () => {
    const r = porCobrarPorCliente([pago('b', 'rosa', 30, 1), pago('a', 'rosa', 50, 1)], CLIENTES);
    igual(r.grupos[0].pagos.map((p) => p.id), ['b', 'a']);
  });

  caso('los centavos no se descuadran', () => {
    const r = porCobrarPorCliente([pago('a', 'rosa', 0.1, 0.1), pago('b', 'rosa', 0.2, 0.2)], CLIENTES);
    igual([r.recibos, r.comisiones, r.total], [0.3, 0.3, 0.6]);
  });
});

describir('por cobrar — cobrar todo a un cliente', (caso) => {
  const DIA = { fecha: '2026-10-05', cuenta_id: 'banco' };

  caso('cada operación queda saldada con un abono por lo que le falta', () => {
    const parcial = pago('b', 'rosa', 30, 1, [{ fecha: '2026-10-02', cuenta_id: 'x', monto: 10 }]);
    const r = saldarTodos([pago('a', 'rosa', 50, 1), parcial], DIA);
    igual(r.problema, null);
    igual(r.pagos.map((p) => p.abonos.map((a) => a.monto)), [[51], [10, 21]]);
    r.pagos.forEach((p) => {
      igual(p.fecha_cobro, '2026-10-05');
      igual(p.cuenta_cobro_id, 'banco');
    });
  });

  caso('no toca la lista original', () => {
    const original = pago('a', 'rosa', 50, 1);
    saldarTodos([original], DIA);
    igual(original.abonos, []);
  });

  caso('sin cuenta no se cobra nada', () => {
    const r = saldarTodos([pago('a', 'rosa', 50, 1)], { fecha: '2026-10-05', cuenta_id: '' });
    igual(r.problema, 'Elige en qué cuenta te pagaron.');
    igual(r.pagos, []);
  });

  caso('si una no se puede, no se cobra ninguna', () => {
    const tarde = { ...pago('b', 'rosa', 30, 1), fecha_pago: '2026-10-09' };
    const r = saldarTodos([pago('a', 'rosa', 50, 1), tarde], DIA);
    igual(r.problema, 'No te pueden haber pagado antes de que pagaras el recibo.');
    igual(r.pagos, []);
  });
});

describir('negocio — clientes del mes', (caso) => {
  const conCobro = (p, fecha) => ({ ...p, abonos: [
    { fecha, cuenta_id: 'x', monto: p.monto_recibo + p.comision }] });
  const resumenMes = (lista) => lista.map((c) =>
    `${c.nombre ?? '—'} ganado ${c.ganado} movido ${c.movido} (${c.operaciones})`);

  caso('cada cliente con lo que ganaste y moviste en el mes', () => {
    const pagos = [
      conCobro(pago('a', 'rosa', 50, 1), '2026-10-02'),
      conCobro(pago('b', 'rosa', 30, 1), '2026-10-03'),
      pago('c', 'ana', 20, 3),                              // pendiente: movido sí, ganado no
    ];
    igual(resumenMes(clientesDelMes(pagos, CLIENTES, '2026-10')), [
      'Rosa ganado 2 movido 80 (2)',
      'Ana ganado 0 movido 20 (1)',
    ]);
  });

  caso('van de quien más te dejó a quien menos', () => {
    const pagos = [
      conCobro(pago('a', 'ana', 10, 1), '2026-10-02'),
      conCobro(pago('b', 'rosa', 10, 3), '2026-10-02'),
    ];
    igual(clientesDelMes(pagos, CLIENTES, '2026-10').map((c) => c.cliente_id), ['rosa', 'ana']);
  });

  caso('con el mismo ganado, primero el que movió más', () => {
    const pagos = [pago('a', 'ana', 10, 1), pago('b', 'rosa', 90, 1)];
    igual(clientesDelMes(pagos, CLIENTES, '2026-10').map((c) => c.cliente_id), ['rosa', 'ana']);
  });

  caso('sin cliente va al final aunque haya dejado más', () => {
    const pagos = [
      conCobro(pago('a', null, 10, 9), '2026-10-02'),
      conCobro(pago('b', 'ana', 10, 1), '2026-10-02'),
    ];
    igual(clientesDelMes(pagos, CLIENTES, '2026-10').map((c) => c.cliente_id), ['ana', null]);
  });

  caso('un cliente sin nada en ese mes no sale', () => {
    const pagos = [{ ...pago('a', 'rosa', 50, 1), fecha_pago: '2026-09-10' }];
    igual(clientesDelMes(pagos, CLIENTES, '2026-10'), []);
  });

  caso('la comisión cuenta en el mes en que te la pagaron', () => {
    const pagos = [conCobro({ ...pago('a', 'rosa', 50, 1), fecha_pago: '2026-09-30' }, '2026-10-01')];
    igual(resumenMes(clientesDelMes(pagos, CLIENTES, '2026-10')), ['Rosa ganado 1 movido 0 (0)']);
    igual(resumenMes(clientesDelMes(pagos, CLIENTES, '2026-09')), ['Rosa ganado 0 movido 50 (1)']);
  });
});

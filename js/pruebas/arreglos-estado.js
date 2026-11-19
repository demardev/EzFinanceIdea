/* Pruebas de calc/arreglos-estado.js — escritas antes que la implementación.
   El corte de noviembre como estaba el 17/nov: los arreglos que propone el
   asistente, aplicados en memoria, tienen que dejarlo como quedó cuadrado a mano. */

import { describir, igual, cierto } from './marco.js';
import { proponerArreglos, aplicarEnMemoria } from '../calc/arreglos-estado.js';
import { emparejarEstado } from '../calc/emparejar-estado.js';
import { normalizarLectura } from '../calc/estado-cuenta.js';
import { NOVIEMBRE } from './estados-bac.js';
import { TARJETA, COMPRAS, MOVIMIENTOS } from './movimientos-bac.js';
import { sumarMeses } from '../calc/fechas.js';

const LECTURA = normalizarLectura(NOVIEMBRE);
const CATEGORIAS = [
  { id: 'otro', nombre: 'Otro gasto', tipo: 'egreso' },
  { id: 'reemb', nombre: 'Reembolso', tipo: 'ingreso' },
];

/* Como estaba antes: sin intereses ni bonificación, el Movistar con otra fecha,
   y las cuotas un corte antes que el banco, con las ya pagadas de entonces
   (Airpods: el día 8 y 10 pagadas; minicuota de junio: el 8 y 3 pagadas). */
function cuotas(compra, monto, ultima, fechaDe) {
  return Array.from({ length: compra.num_cuotas }, (_, i) => ({
    id: `${compra.id}-${i + 1}`, tipo: 'egreso', tarjeta_id: 'bac', compra_id: compra.id,
    cuota_num: i + 1, cuota_total: compra.num_cuotas, fecha: fechaDe(i + 1),
    monto: i + 1 === compra.num_cuotas ? ultima : monto,
    descripcion: `${compra.descripcion} — cuota ${i + 1}/${compra.num_cuotas}`,
  }));
}
const AIRPODS = { ...COMPRAS.find((c) => c.id === 'airpods'), cuotas_pagadas: 10 };
const JUNIO = { ...COMPRAS.find((c) => c.id === 'mc6'), cuotas_pagadas: 3 };

function antes() {
  const sueltos = MOVIMIENTOS.filter((m) => !['m38', 'm40'].includes(m.id)
    && !['airpods', 'mc6'].includes(m.compra_id))
    .map((m) => (m.id === 'm28' ? { ...m, fecha: '2026-11-09' } : m));
  const movimientos = [...sueltos,
    ...cuotas(AIRPODS, 9.97, 10.05, (n) => sumarMeses('2025-11-08', n - 1)),
    ...cuotas(JUNIO, 43.62, 43.62, (n) => (n === 1 ? '2026-06-09' : sumarMeses('2026-07-08', n - 2)))];
  const compras = COMPRAS.map((c) => ({ airpods: AIRPODS, mc6: JUNIO }[c.id] ?? c));
  return { movimientos, compras };
}

const entrada = (datos) => ({ lectura: LECTURA, tarjeta: TARJETA, categorias: CATEGORIAS,
                              hoy: '2026-11-17', ...datos });

describir('arreglos: qué propone para el corte de noviembre', (caso) => {
  const datos = antes();
  const { arreglos } = proponerArreglos(emparejarEstado(entrada(datos)), entrada(datos));
  const de = (tipo) => arreglos.filter((a) => a.tipo === tipo);

  caso('agregar los intereses del corte como cargo, con categoría', () => {
    const [cargo] = de('agregar_cargo');
    igual([cargo.fila.monto, cargo.fila.fecha, cargo.fila.tipo], [4.62, '2026-11-09', 'egreso']);
    igual(cargo.fila.categoria_id, 'otro');
    igual(cargo.fila.tarjeta_id, 'bac');
  });

  caso('agregar la bonificación como reembolso a la tarjeta', () => {
    const [reembolso] = de('agregar_reembolso');
    igual([reembolso.fila.monto, reembolso.fila.tipo, reembolso.fila.fecha], [6.39, 'ingreso', '2026-11-09']);
    igual(reembolso.fila.categoria_id, 'reemb');
  });

  caso('mover el Movistar a la fecha del banco', () => {
    const [mover] = de('mover_fecha');
    igual([mover.movimientoId, mover.cambios.fecha], ['m28', '2026-11-04']);
  });

  caso('fijar la primera cuota de las dos compras corridas', () => {
    const fijar = Object.fromEntries(de('fijar_primera_cuota').map((a) => [a.compraId, a.cambios]));
    igual(fijar.airpods.fecha_primera_cuota, '2025-11-28');
    igual(fijar.mc6.fecha_primera_cuota, '2026-07-09');
  });

  /* El banco ya cobró las que cobró: si al mover las fechas una cuota pasa al
     futuro, una de las "ya pagadas" vuelve a contar (lo que se hizo a mano). */
  caso('y ajustar las ya pagadas para que hoy cuenten las mismas cuotas', () => {
    const fijar = Object.fromEntries(de('fijar_primera_cuota').map((a) => [a.compraId, a.cambios]));
    igual(fijar.airpods.cuotas_pagadas, 9);
    igual(fijar.mc6.cuotas_pagadas, 2);
  });

  caso('nada de lo que sobra se borra solo', () => {
    cierto(!arreglos.some((a) => a.tipo === 'quitar'));
  });
});

describir('arreglos: aplicados en memoria dejan la tarjeta cuadrada', (caso) => {
  const datos = antes();
  const { arreglos } = proponerArreglos(emparejarEstado(entrada(datos)), entrada(datos));
  const despues = aplicarEnMemoria(arreglos, datos);
  const r = emparejarEstado(entrada(despues));

  caso('ya no falta nada ni hay nada distinto', () => {
    igual(r.faltan, []);
    igual(r.distintos, []);
  });

  caso('solo sobra lo que el banco puso en el corte siguiente', () => {
    igual(r.sobran.map((s) => s.movimiento.id).sort(), ['m31', 'm39', 'm42', 'm43', 'm44']);
    igual(r.sinExplicar, 0);
  });

  caso('las cuotas quedan en las fechas del banco', () => {
    const fecha = (id) => despues.movimientos.find((m) => m.id === id).fecha;
    igual([fecha('airpods-12'), fecha('airpods-13'), fecha('mc6-5'), fecha('mc6-6')],
          ['2026-10-28', '2026-11-28', '2026-11-09', '2026-12-09']);
  });

  caso('no cambia los datos originales', () => {
    igual(datos.movimientos.find((m) => m.id === 'm28').fecha, '2026-11-09');
  });
});

describir('arreglos: lo que no se arregla solo', (caso) => {
  caso('un pago que falta pide la cuenta: queda como manual', () => {
    const datos = { movimientos: MOVIMIENTOS.filter((m) => m.id !== 'm16'), compras: COMPRAS };
    const { arreglos, manuales } = proponerArreglos(emparejarEstado(entrada(datos)), entrada(datos));
    cierto(!arreglos.some((a) => a.fila?.monto === 64.58));
    cierto(manuales.some((m) => m.item.linea?.monto === 64.58 && /pago/i.test(m.motivo)));
  });

  caso('un monto distinto en un movimiento normal se corrige', () => {
    const datos = { movimientos: MOVIMIENTOS.map((m) => (m.id === 'm13' ? { ...m, monto: 17.45 } : m)),
                    compras: COMPRAS };
    const { arreglos } = proponerArreglos(emparejarEstado(entrada(datos)), entrada(datos));
    const corregir = arreglos.find((a) => a.tipo === 'corregir_monto');
    igual([corregir.movimientoId, corregir.cambios.monto], ['m13', 171.45]);
  });
});

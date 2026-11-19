/* Pruebas de calc/emparejar-estado.js — escritas antes que la implementación.
   El estado de cuenta de BAC del 09/nov/2026 contra los movimientos reales de la
   app: como quedaron cuadrados, y como estaban el 17/nov antes de arreglarlos. */

import { describir, igual, cierto } from './marco.js';
import { emparejarEstado } from '../calc/emparejar-estado.js';
import { normalizarLectura } from '../calc/estado-cuenta.js';
import { NOVIEMBRE } from './estados-bac.js';
import { TARJETA, COMPRAS, MOVIMIENTOS } from './movimientos-bac.js';

const LECTURA = normalizarLectura(NOVIEMBRE);
const comparar = (movimientos = MOVIMIENTOS, compras = COMPRAS) =>
  emparejarEstado({ lectura: LECTURA, tarjeta: TARJETA, movimientos, compras });
const ids = (lista) => lista.map((x) => x.movimiento?.id ?? x.linea?.concepto).sort();
const montos = (lista) => lista.map((x) => (x.linea ?? x.movimiento).monto).sort((a, b) => a - b);

/* Lo que el banco puso en el corte siguiente aunque la app lo tenga antes del 09/nov:
   1893 Restaurante, Wendys, Parqueo, Puma Ilopango y el Supercell de $58.11. */
const DEL_SIGUIENTE = ['m31', 'm39', 'm42', 'm43', 'm44'];

describir('emparejar: el corte de noviembre ya cuadrado', (caso) => {
  const r = comparar();

  caso('el periodo va del corte anterior al del estado de cuenta', () => {
    igual(r.periodo, { desde: '2026-10-09', hasta: '2026-11-09' });
  });

  caso('no falta nada ni hay nada distinto', () => {
    igual(r.faltan, []);
    igual(r.distintos, []);
  });

  caso('sobra solo lo que el banco puso en el corte siguiente', () => {
    igual(ids(r.sobran), DEL_SIGUIENTE);
  });

  caso('intereses, bonificación y cuotas se emparejan', () => {
    const conceptoDe = (id) => r.emparejados.find((e) => e.movimiento.id === id)?.linea.concepto;
    cierto(/inter/i.test(conceptoDe('m40')), 'intereses del pie');
    igual(conceptoDe('m38'), 'BONIFICACION PAGO SALDO DOLARES');
    igual(conceptoDe('m17'), 'COMPRA EN CUOTA ISHOP CUOTA:12/36');
    igual(conceptoDe('m41'), 'MINICUOTA 0% 6M CUOTA:05/06');
  });

  caso('la app debe al corte lo del banco más lo que sobra, y eso lo explica', () => {
    igual(r.saldoBanco, 423.87);
    igual(r.saldoApp, 550.41);
    igual(r.diferencia, 126.54);
    igual(r.arrastre, 0);
    igual(r.totalSobran, 126.54);
    igual(r.sinExplicar, 0);
  });
});

/* Como estaba el 17/nov: sin intereses ni bonificación del corte, el Movistar del
   04/nov puesto el 09/nov y las cuotas de los Airpods y de la minicuota de junio
   un corte antes que el banco. */
function antesDelCuadre() {
  const cambios = {
    m28: { fecha: '2026-11-09' },
    m17: { fecha: '2026-10-08' },
    m8: { fecha: '2026-10-08', cuota_num: 5, descripcion: 'Minicuotas — cuota 5/6' },
    m41: { fecha: '2026-11-08', cuota_num: 6, descripcion: 'Minicuotas — cuota 6/6' },
  };
  const movs = MOVIMIENTOS.filter((m) => !['m38', 'm40'].includes(m.id))
    .map((m) => ({ ...m, ...cambios[m.id] }));
  movs.push({ id: 'm53', tipo: 'egreso', monto: 9.97, fecha: '2026-11-08', tarjeta_id: 'bac',
              descripcion: 'Airpods — cuota 13/36', compra_id: 'airpods', cuota_num: 13, cuota_total: 36 });
  return comparar(movs);
}

describir('emparejar: el corte de noviembre antes de cuadrarlo', (caso) => {
  const r = antesDelCuadre();

  caso('faltan los intereses y la bonificación del corte', () => {
    igual(montos(r.faltan), [4.62, 6.39]);
  });

  caso('el Movistar está con otra fecha', () => {
    const fecha = r.distintos.find((d) => d.motivo === 'fecha');
    igual(fecha.movimiento.id, 'm28');
    igual(fecha.linea.fecha, '2026-11-04');
  });

  caso('las cuotas del banco la app las cobró un corte antes', () => {
    const corridas = r.distintos.filter((d) => d.motivo === 'cuota').map((d) => d.movimiento.id);
    igual(corridas.sort(), ['m17', 'm8']);
  });

  caso('y sobran las cuotas que el banco todavía no cobra', () => {
    igual(ids(r.sobran), [...DEL_SIGUIENTE, 'm41', 'm53'].sort());
  });

  caso('todas las diferencias juntas explican el saldo', () => {
    igual(r.sinExplicar, 0);
  });
});

describir('emparejar: montos distintos y traslados a minicuotas', (caso) => {
  caso('un cargo con otro monto y concepto parecido es "distinto", no falta y sobra', () => {
    const movs = MOVIMIENTOS.map((m) => (m.id === 'm13' ? { ...m, monto: 17.45 } : m));
    const distinto = comparar(movs).distintos.find((d) => d.motivo === 'monto');
    igual(distinto.movimiento.id, 'm13');
    igual(distinto.linea.monto, 171.45);
    igual(distinto.efecto, -154);
  });

  caso('los créditos de minicuotas del banco se emparejan con el traslado', () => {
    const lectura = normalizarLectura({ ...NOVIEMBRE, fecha_corte: '2026-12-09',
      saldo_anterior: 0, saldo_al_corte: 0, intereses_fuera_de_lista: 0,
      movimientos: [{ fecha: '2026-11-13', concepto: 'CR MINICUOTAS FUN CAPITAL',
                      monto: 36.16, sentido: 'credito' }] });
    const r = emparejarEstado({ lectura, tarjeta: TARJETA, movimientos: MOVIMIENTOS, compras: COMPRAS });
    cierto(r.emparejados.some((e) => e.linea.concepto === 'CR MINICUOTAS FUN CAPITAL'
      && e.movimiento.id === 'm48'));
    cierto(!r.faltan.some((f) => f.linea.concepto.startsWith('CR MINICUOTAS')));
  });
});

/* Pasó con el estado de cuenta de octubre: el banco anotó el pago del 12/sep en
   dos líneas ($149.07 + $1.42) y la app lo tiene como uno de $150.49. Decía
   "cuadra" pero mostraba dos que faltan y uno que sobra. */
describir('emparejar: una línea que equivale a varias del otro lado', (caso) => {
  caso('un pago de la app = dos líneas del banco del mismo día', () => {
    const juntos = { id: 'm1516', tipo: 'transferencia', monto: 236.03, fecha: '2026-10-27',
                     descripcion: 'Pago BAC ECONOMIA', tarjeta_destino_id: 'bac', cuenta_id: 'k' };
    const r = comparar([...MOVIMIENTOS.filter((m) => !['m15', 'm16'].includes(m.id)), juntos]);
    igual(r.faltan, []);
    igual(r.distintos, []);
    igual(r.sobran.map((s) => s.movimiento.id).sort(), DEL_SIGUIENTE);
    igual(r.emparejados.filter((e) => e.movimiento.id === 'm1516').length, 2);
    igual(r.sinExplicar, 0);
  });

  caso('una línea del banco = dos movimientos de la app del mismo día', () => {
    const partes = [{ ...MOVIMIENTOS.find((m) => m.id === 'm13'), id: 'm13a', monto: 100 },
                    { ...MOVIMIENTOS.find((m) => m.id === 'm13'), id: 'm13b', monto: 71.45 }];
    const r = comparar([...MOVIMIENTOS.filter((m) => m.id !== 'm13'), ...partes]);
    igual(r.faltan, []);
    igual(r.sobran.map((s) => s.movimiento.id).sort(), DEL_SIGUIENTE);
    igual(r.sinExplicar, 0);
  });

  caso('no junta cosas de días lejanos aunque sumen igual', () => {
    const lejos = { id: 'mx', tipo: 'transferencia', monto: 236.03, fecha: '2026-11-08',
                    descripcion: 'Pago', tarjeta_destino_id: 'bac', cuenta_id: 'k' };
    const r = comparar([...MOVIMIENTOS.filter((m) => !['m15', 'm16'].includes(m.id)), lejos]);
    igual(r.faltan.length, 2);
  });
});

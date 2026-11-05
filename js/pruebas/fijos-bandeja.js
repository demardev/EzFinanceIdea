/* Pruebas de calc/fijos-bandeja.js — escritas antes que la implementación.
   Lo que llega a Por confirmar y es un gasto fijo del plan. */

import { describir, igual, cierto } from './marco.js';
import { emparejarFijos, conFijo, marcarPorConfirmar, nombreParecido }
  from '../calc/fijos-bandeja.js';
import { listasParaRegistrar } from '../calc/bandeja.js';

const fijo = (extra) => ({ id: 'claude', nombre: 'Claude', clase: 'gasto',
  variabilidad: 'fijo', monto: 20, dia_mes: 4, cuenta_id: 'bac', activo: true,
  categoria_id: 'k-sus', ...extra });
const YOUTUBE = fijo({ id: 'yt', nombre: 'Youtube Premium', monto: 7.99 });

const entrada = (id, comercio, extra) => ({ id, comercio, texto: 'aviso', ...extra });
const borrador = (monto, extra) => ({ tipo: 'egreso', monto, fecha: '2026-11-04',
  descripcion: 'x', categoria_id: '', origen: '', ...extra });

/* Arma las dos piezas como las arma la bandeja. */
function emparejar(lista, items, registrados = []) {
  const entradas = lista.map(([e]) => e);
  const borradores = new Map(lista.map(([e, b]) => [e.id, b]));
  return emparejarFijos(entradas, borradores, items, registrados);
}

describir('gastos fijos en Por confirmar', (caso) => {
  caso('el nombre del banco contiene el del plan, sin espacios ni signos', () => {
    cierto(nombreParecido('ANTHROPIC* CLAUDE SUB', 'Claude'));
    cierto(nombreParecido('Google YouTubePremium', 'Youtube Premium'));
    cierto(!nombreParecido('Google YouTubePremium', 'Claude'));
    cierto(!nombreParecido('', 'Claude'));
  });

  caso('mismo monto, cerca de su día y con el nombre: es ese fijo, seguro', () => {
    const p = emparejar([[entrada('a', 'ANTHROPIC* CLAUDE SUB'), borrador(20)]],
                        [fijo(), YOUTUBE]);
    igual(p.get('a').item.id, 'claude');
    igual(p.get('a').fecha, '2026-11-04');
    cierto(p.get('a').seguro);
    cierto(!p.get('a').registrado);
  });

  caso('dos fijos y dos cargos: cada uno con el suyo', () => {
    const p = emparejar([[entrada('a', 'ANTHROPIC* CLAUDE SUB'), borrador(20)],
                         [entrada('b', 'Google YouTubePremium'), borrador(7.99)]],
                        [fijo(), YOUTUBE]);
    igual(p.get('a').item.id, 'claude');
    igual(p.get('b').item.id, 'yt');
  });

  caso('el banco cobra días antes o después: la fecha es la del plan', () => {
    const p = emparejar([[entrada('a', 'CLAUDE'), borrador(20, { fecha: '2026-11-11' })]],
                        [fijo()]);
    igual(p.get('a').fecha, '2026-11-04');
  });

  caso('más de 10 días lejos de su fecha, no es ese', () => {
    const p = emparejar([[entrada('a', 'CLAUDE'), borrador(20, { fecha: '2026-11-19' })]],
                        [fijo()]);
    cierto(!p.has('a'));
  });

  caso('otro monto no es el fijo, aunque se llame igual', () => {
    cierto(!emparejar([[entrada('a', 'CLAUDE'), borrador(21)]], [fijo()]).has('a'));
  });

  caso('un ingreso nunca es un gasto fijo', () => {
    const p = emparejar([[entrada('a', 'CLAUDE'), borrador(20, { tipo: 'ingreso' })]],
                        [fijo()]);
    cierto(!p.has('a'));
  });

  caso('si el aviso ya trae otra cuenta, no es ese fijo', () => {
    const p = emparejar([[entrada('a', 'CLAUDE'), borrador(20, { origen: 'cuenta:otra' })]],
                        [fijo()]);
    cierto(!p.has('a'));
  });

  caso('sin el nombre, el único con ese monto cuenta, pero no seguro', () => {
    const p = emparejar([[entrada('a', 'PAGO EN LINEA'), borrador(20)]], [fijo()]);
    igual(p.get('a').item.id, 'claude');
    cierto(!p.get('a').seguro);
  });

  caso('sin el nombre y dos fijos del mismo monto: no se adivina', () => {
    const otro = fijo({ id: 'gym', nombre: 'Gimnasio' });
    cierto(!emparejar([[entrada('a', 'PAGO EN LINEA'), borrador(20)]], [fijo(), otro]).has('a'));
  });

  caso('fijos inactivos o variables no cuentan', () => {
    const items = [fijo({ activo: false }), fijo({ id: 'v', variabilidad: 'variable' })];
    cierto(!emparejar([[entrada('a', 'CLAUDE'), borrador(20)]], items).has('a'));
  });

  caso('dos avisos del mismo cobro: solo uno se lleva el fijo', () => {
    const p = emparejar([[entrada('a', 'PAGO'), borrador(20)],
                         [entrada('b', 'CLAUDE'), borrador(20)]], [fijo()]);
    cierto(!p.has('a'));
    igual(p.get('b').item.id, 'claude');
  });

  caso('si ya lo registraste, se marca como registrado', () => {
    const mov = { tipo: 'egreso', descripcion: 'Claude', monto: 20, fecha: '2026-11-03',
                  categoria_id: 'k-sus' };
    const p = emparejar([[entrada('a', 'CLAUDE'), borrador(20)]], [fijo()], [mov]);
    cierto(p.get('a').registrado);
  });

  caso('se sabe si la cuenta venía del aviso o solo del plan', () => {
    const p = emparejar([[entrada('a', 'CLAUDE'), borrador(20)],
                         [entrada('b', 'YOUTUBE'), borrador(7.99, { origen: 'cuenta:bac' })]],
                        [fijo(), YOUTUBE]);
    cierto(!p.get('a').origenConocido);
    cierto(p.get('b').origenConocido);
  });

  caso('el borrador toma el nombre, la categoría y la cuenta del plan', () => {
    const [par] = emparejar([[entrada('a', 'CLAUDE'), borrador(20)]], [fijo()]).values();
    const b = conFijo(borrador(20, { descripcion: 'ANTHROPIC* CLAUDE SUB' }), par);
    igual(b.descripcion, 'Claude');
    igual(b.categoria_id, 'k-sus');
    igual(b.origen, 'cuenta:bac');
    igual(b.monto, 20);
  });

  caso('la cuenta del aviso manda sobre la del plan', () => {
    const tarjeta = fijo({ cuenta_id: null, tarjeta_id: 'bac-v' });
    const b = conFijo(borrador(20, { origen: 'tarjeta:bac-v' }),
                      { item: tarjeta, seguro: true });
    igual(b.origen, 'tarjeta:bac-v');
  });

  caso('sin pareja, el borrador queda igual', () => {
    const b = borrador(20);
    igual(conFijo(b, undefined), b);
  });
});

describir('vencimientos con su cargo en Por confirmar', (caso) => {
  const venc = (item, fecha) => ({ clase: 'gasto', nombre: item.nombre, fecha, item });

  caso('el vencimiento sabe qué entrada de la bandeja es su cargo', () => {
    const pares = new Map([['a', { item: fijo(), fecha: '2026-11-04', registrado: false }]]);
    const [v, otro] = marcarPorConfirmar([venc(fijo(), '2026-11-04'), venc(YOUTUBE, '2026-11-04')],
                                         pares);
    igual(v.porConfirmar, 'a');
    igual(otro.porConfirmar, undefined);
  });

  caso('otra fecha del mismo fijo no es ese cargo', () => {
    const pares = new Map([['a', { item: fijo(), fecha: '2026-10-04', registrado: false }]]);
    igual(marcarPorConfirmar([venc(fijo(), '2026-11-04')], pares)[0].porConfirmar, undefined);
  });
});

describir('registrar completas con gastos fijos', (caso) => {
  const SUG = { origenes: {}, categorias: {} };
  const VIG = { origenes: new Set(['cuenta:bac']), categorias: new Set(['k-sus']) };
  const listo = borrador(20, { origen: 'cuenta:bac', categoria_id: 'k-sus' });
  const conPar = (par) => listasParaRegistrar([entrada('a', 'CLAUDE')], SUG, VIG,
                                              () => listo, new Map([['a', par]]));

  caso('un aviso que es un fijo seguro, con su cuenta, entra', () => {
    igual(conPar({ seguro: true, registrado: false, origenConocido: true }).listas.length, 1);
  });

  caso('si no es seguro, ya está registrado o la cuenta la puso el plan, no', () => {
    igual(conPar({ seguro: false, registrado: false, origenConocido: true }).listas.length, 0);
    igual(conPar({ seguro: true, registrado: true, origenConocido: true }).listas.length, 0);
    igual(conPar({ seguro: true, registrado: false, origenConocido: false }).listas.length, 0);
  });

  caso('un aviso sin pareja sigue sin entrar', () => {
    igual(listasParaRegistrar([entrada('a', 'CLAUDE')], SUG, VIG, () => listo).listas.length, 0);
  });
});

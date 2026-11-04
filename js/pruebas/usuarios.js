/* Pruebas de calc/usuarios.js — escritas antes que la implementación.
   El panel de admin: cuándo vence el premium, cómo se lee y los filtros. */

import { describir, igual } from './marco.js';
import { SIN_VENCIMIENTO, esPremium, nuevoVencimiento, textoPremium,
         filtrarUsuarios, contarUsuarios } from '../calc/usuarios.js';

const HOY = '2026-11-03';
const usuario = (email, extra = {}) => ({
  user_id: email, email, negocio: false, bloqueado: false, premium_hasta: null, ...extra,
});

describir('usuarios — vencimiento del premium', (caso) => {
  caso('sin premium, un mes empieza a contar hoy', () => {
    igual(nuevoVencimiento(null, 'mes', HOY), '2026-12-03');
  });

  caso('un año son doce meses', () => {
    igual(nuevoVencimiento(null, 'anio', HOY), '2027-11-03');
  });

  caso('renovar antes de tiempo suma desde el vencimiento, no desde hoy', () => {
    igual(nuevoVencimiento('2026-11-20', 'mes', HOY), '2026-12-20');
  });

  caso('si ya venció, vuelve a contar desde hoy', () => {
    igual(nuevoVencimiento('2026-10-01', 'mes', HOY), '2026-12-03');
  });

  caso('31 de enero más un mes cae en el último de febrero', () => {
    igual(nuevoVencimiento(null, 'mes', '2027-01-31'), '2027-02-28');
  });

  caso('sin vencimiento, y sumarle a eso lo deja igual', () => {
    igual(nuevoVencimiento(null, 'siempre', HOY), SIN_VENCIMIENTO);
    igual(nuevoVencimiento(SIN_VENCIMIENTO, 'mes', HOY), SIN_VENCIMIENTO);
  });
});

describir('usuarios — leer el premium', (caso) => {
  caso('vale hasta su último día inclusive', () => {
    igual(esPremium(usuario('a', { premium_hasta: HOY }), HOY), true);
    igual(esPremium(usuario('a', { premium_hasta: '2026-11-02' }), HOY), false);
    igual(esPremium(usuario('a'), HOY), false);
  });

  caso('cada estado se lee con su fecha', () => {
    igual(textoPremium(usuario('a'), HOY), 'Normal');
    igual(textoPremium(usuario('a', { premium_hasta: '2026-12-03' }), HOY),
      'Premium hasta 03/dic/2026');
    igual(textoPremium(usuario('a', { premium_hasta: SIN_VENCIMIENTO }), HOY),
      'Premium sin vencimiento');
    igual(textoPremium(usuario('a', { premium_hasta: '2026-10-01' }), HOY),
      'Normal · el premium venció el 01/oct/2026');
  });
});

const LISTA = [
  usuario('ana@x.com', { premium_hasta: '2026-12-01', negocio: true }),
  usuario('beto@x.com'),
  usuario('caro@y.com', { premium_hasta: '2026-01-01', bloqueado: true }),
  usuario('dani@y.com', { negocio: true }),
];
const correos = (lista) => lista.map((u) => u.email);

describir('usuarios — filtros del panel', (caso) => {
  caso('sin filtros salen todos', () => {
    igual(filtrarUsuarios(LISTA, {}, HOY).length, 4);
  });

  caso('normal incluye a quien se le venció el premium', () => {
    igual(correos(filtrarUsuarios(LISTA, { plan: 'normal' }, HOY)),
      ['beto@x.com', 'caro@y.com', 'dani@y.com']);
    igual(correos(filtrarUsuarios(LISTA, { plan: 'premium' }, HOY)), ['ana@x.com']);
  });

  caso('el estado se combina con el plan', () => {
    igual(correos(filtrarUsuarios(LISTA, { plan: 'normal', estado: 'negocio' }, HOY)),
      ['dani@y.com']);
    igual(correos(filtrarUsuarios(LISTA, { estado: 'bloqueado' }, HOY)), ['caro@y.com']);
  });

  caso('la búsqueda ignora mayúsculas y espacios', () => {
    igual(correos(filtrarUsuarios(LISTA, { texto: '  @Y.COM ' }, HOY)),
      ['caro@y.com', 'dani@y.com']);
  });

  caso('los conteos de cada pastilla', () => {
    igual(contarUsuarios(LISTA, HOY),
      { todos: 4, normal: 3, premium: 1, negocio: 2, bloqueado: 1 });
  });
});

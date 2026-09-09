/* Mapa {nombre: contenido del <svg>}. Estilo Lucide: viewBox 24, trazo 1.5, currentColor.
   Nunca emojis, nunca CDN. Agregar un icono = agregar una entrada aquí. */

export const TRAZOS = {
  // --- navegación y shell
  resumen:     '<path d="M3 20h18"/><path d="M6 20v-6"/><path d="M11 20V8"/><path d="M16 20v-9"/>',
  movimientos: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3.5 6h.01"/><path d="M3.5 12h.01"/><path d="M3.5 18h.01"/>',
  plan:        '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/>',
  ajustes:     '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',

  // --- acciones
  plus:     '<path d="M12 5v14"/><path d="M5 12h14"/>',
  minus:    '<path d="M5 12h14"/>',
  x:        '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check:    '<path d="M20 6 9 17l-5-5"/>',
  lapiz:    '<path d="M4 20h4L20 8l-4-4L4 16v4Z"/><path d="m14 6 4 4"/>',
  basura:   '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="m6 7 1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
  ojo:      '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  'ojo-off':'<path d="M10.7 5.1A11 11 0 0 1 12 5c6.4 0 10 7 10 7a18.5 18.5 0 0 1-2.7 3.7"/><path d="M6.6 6.6A18.6 18.6 0 0 0 2 12s3.6 7 10 7a10.7 10.7 0 0 0 5.4-1.4"/><path d="m2 2 20 20"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  salir:    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  buscar:   '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  filtro:   '<path d="M3 5h18"/><path d="M7 12h10"/><path d="M11 19h2"/>',
  derecha:  '<path d="m9 6 6 6-6 6"/>',
  abajo:    '<path d="m6 9 6 6 6-6"/>',
  arriba:   '<path d="m18 15-6-6-6 6"/>',
  atras:    '<path d="m15 18-6-6 6-6"/>',
  'orden-desc': '<path d="M6 4v15"/><path d="m3 16 3 3 3-3"/><path d="M12 6h9"/><path d="M12 12h6"/><path d="M12 18h3"/>',
  'orden-asc':  '<path d="M6 20V5"/><path d="m3 8 3-3 3 3"/><path d="M12 6h3"/><path d="M12 12h6"/><path d="M12 18h9"/>',
  descarga: '<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/>',
  entra:    '<path d="M17 7 7 17"/><path d="M17 17H7V7"/>',
  sale:     '<path d="M7 17 17 7"/><path d="M7 7h10v10"/>',
  alerta:   '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4"/><path d="M12 17h.01"/>',
  reloj:    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',

  // --- cuentas y categorías (los que siembra el SQL)
  wallet:   '<rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M3 10h18"/><circle cx="17" cy="15" r="1.2"/>',
  banco:    '<path d="M3 10 12 4l9 6"/><path d="M5 10v9"/><path d="M10 10v9"/><path d="M14 10v9"/><path d="M19 10v9"/><path d="M3 21h18"/>',
  laptop:   '<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M2 20h20"/>',
  tag:      '<path d="M3 11V4h7l10 10-7 7L3 11Z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
  gift:     '<rect x="3" y="9" width="18" height="12" rx="2"/><path d="M3 13h18"/><path d="M12 9v12"/><path d="M12 9C10 4 5 5 6.5 8.2 7.3 9.9 12 9 12 9Z"/><path d="M12 9c2-5 7-4 5.5-.8C16.7 9.9 12 9 12 9Z"/>',
  rotate:   '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 4v5h-5"/>',
  utensils: '<path d="M6 3v8a2 2 0 0 0 4 0V3"/><path d="M8 11v10"/><path d="M17 3c-1.7 1.2-2.5 3-2.5 5.5 0 1.6.8 2.5 2.5 2.5V3Z"/><path d="M17 11v10"/>',
  cart:     '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 4h3l2.6 11h11L21 7H6"/>',
  car:      '<rect x="2" y="10" width="20" height="6" rx="2"/><path d="m5 10 2-5h10l2 5"/><path d="M4 16v3"/><path d="M20 16v3"/><path d="M6 13h.01"/><path d="M18 13h.01"/>',
  home:     '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  zap:      '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
  heart:    '<path d="M12 20s-8-4.9-8-10.2A4.8 4.8 0 0 1 12 7a4.8 4.8 0 0 1 8 2.8C20 15.1 12 20 12 20Z"/>',
  film:     '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M8 4v16"/><path d="M16 4v16"/>',
  repeat:   '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  shirt:    '<path d="M9 3 4 6l2 4 2-1v9h8v-9l2 1 2-4-5-3a3 3 0 0 1-6 0Z"/>',
  book:     '<path d="M5 4a2 2 0 0 1 2-2h12v18H7a2 2 0 0 0-2 2V4Z"/><path d="M5 18h14"/>',
  paw:      '<circle cx="7" cy="9" r="1.8"/><circle cx="11.5" cy="6.5" r="1.8"/><circle cx="16.5" cy="9" r="1.8"/><path d="M12 12c-3 0-5 2.2-5 4.6C7 19 9 20 12 20s5-1 5-3.4C17 14.2 15 12 12 12Z"/>',
  card:     '<rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/>',
  piggy:    '<path d="M3 12a7 7 0 0 1 7-7h4a6 6 0 0 1 6 6v1l2 1v2h-3l-1 3h-3v-2h-4v2H8l-1-3a6 6 0 0 1-4-3Z"/><circle cx="16" cy="10.5" r="1"/>',
  banknote: '<rect x="2" y="6" width="20" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01"/><path d="M18 12h.01"/>',
  arrows:   '<path d="M4 8h13l-3-3"/><path d="M20 16H7l3 3"/>',
};

/* Los que tiene sentido elegir para una categoría o una cuenta. El resto del
   mapa son iconos de interfaz (flechas, papelera, lupa) y no se ofrecen. */
export const ICONOS_CATEGORIA = [
  'wallet', 'banco', 'banknote', 'piggy', 'card', 'cart', 'tag', 'gift',
  'utensils', 'car', 'home', 'zap', 'heart', 'film', 'repeat', 'shirt',
  'book', 'paw', 'laptop', 'rotate', 'arrows', 'plus', 'minus', 'reloj',
];

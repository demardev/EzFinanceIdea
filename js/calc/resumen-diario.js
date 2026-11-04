/* El texto de las notificaciones push: el cierre del día (8 pm) y el aviso de
   Por confirmar. Función PURA: sin red, sin DOM. La usa la Edge Function
   `avisar` (supabase/functions/avisar/), que corre este mismo archivo.

   Nunca lleva montos: la notificación se ve en la pantalla bloqueada. */

const conPlural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/* Cómo se lee cada clase de vencimiento en "Mañana: …". */
const FORMA = {
  pago: (nombre) => `pago de ${nombre}`,
  corte: (nombre) => `corte de ${nombre}`,
  gasto: (nombre) => nombre,
  ingreso: (nombre) => `entra ${nombre}`,
};

function lineaRegistro(movimientos, hoy) {
  /* Las cuotas se cargan solas: no son algo que tú hayas registrado hoy. */
  const n = movimientos.filter((m) => m.fecha === hoy && !m.compra_id).length;
  if (!n) return 'Hoy no has registrado movimientos.';
  return `Hoy registraste ${conPlural(n, 'movimiento', 'movimientos')}. ¿Falta alguno?`;
}

function lineaManana(vencimientos) {
  const manana = vencimientos.filter((v) => v.dias === 1);
  if (!manana.length) return null;
  return `Mañana: ${manana.map((v) => (FORMA[v.clase] ?? FORMA.gasto)(v.nombre)).join(', ')}.`;
}

/**
 * @param movimientos los cercanos a hoy (sirven los del Resumen)
 * @param vencimientos lo de proximosVencimientos(); se toma lo de mañana
 * @param porConfirmar cuántos esperan en la bandeja
 * @param cobrosViejos cuántos recibos del negocio te deben desde hace 7+ días
 */
export function armarResumenDiario({ movimientos, vencimientos = [], porConfirmar = 0,
                                     cobrosViejos = 0 }, hoy) {
  const lineas = [
    lineaRegistro(movimientos, hoy),
    porConfirmar ? `Tienes ${porConfirmar} por confirmar.` : null,
    lineaManana(vencimientos),
    cobrosViejos
      ? `Te deben ${conPlural(cobrosViejos, 'recibo', 'recibos')} desde hace una semana o más.`
      : null,
  ];
  return { titulo: 'Cierre del día', cuerpo: lineas.filter(Boolean).join('\n'),
           url: './#/resumen', etiqueta: 'resumen-diario' };
}

const LLEGO = {
  applepay: 'Llegó una compra de Apple Pay.',
  sms: 'Llegó un aviso del banco.',
  correo: 'Llegó un correo del banco.',
};

/** Al entrar algo a la bandeja. Misma etiqueta: varias seguidas se juntan en una. */
export function mensajeBandeja(origen) {
  return { titulo: 'Por confirmar', cuerpo: LLEGO[origen] ?? 'Llegó algo nuevo.',
           url: './#/resumen', etiqueta: 'bandeja' };
}

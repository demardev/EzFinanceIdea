/* Cómo se dice cada cosa de un préstamo. Lo comparten la pantalla de
   Préstamos y la tarjeta del Resumen, para que digan lo mismo. No calcula
   dinero: recibe el estado ya hecho por calc/prestamos.js. */

import { textoMonto } from '../../ui/privacidad.js';
import { diasEntre, formatearFecha } from '../../calc/fechas.js';

export const DIRECCIONES = {
  debo:     { titulo: 'Lo que debes',     verbo: 'Pagar a', accion: 'Registrar pago', tipo: 'egreso' },
  me_deben: { titulo: 'Lo que te deben', verbo: 'Cobrar a', accion: 'Registrar cobro', tipo: 'ingreso' },
};

/** "Mamá · Teléfono" */
export function nombreDe(prestamo) {
  return [prestamo.persona, prestamo.concepto].filter(Boolean).join(' · ');
}

function cuando(fecha, hoy) {
  const dias = diasEntre(hoy, fecha);
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'mañana';
  return dias < 0 ? `desde el ${formatearFecha(fecha)}` : `en ${dias} días`;
}

/** Lo urgente, en una línea: el atraso, o el siguiente pago. */
export function textoAviso({ prestamo, estado }, hoy) {
  const { proximo, atraso } = estado;
  if (!proximo) return '';
  if (atraso > 0) {
    return prestamo.direccion === 'me_deben'
      ? `${prestamo.persona} se atrasó ${textoMonto(atraso)}`
      : `Vas atrasado ${textoMonto(atraso)} con ${prestamo.persona}`;
  }
  const verbo = DIRECCIONES[prestamo.direccion].verbo;
  return `${verbo} ${prestamo.persona} ${textoMonto(proximo.monto)} ${cuando(proximo.fecha, hoy)}`;
}

/** El subtítulo de la fila: el progreso. El aviso va aparte (textoAviso). */
export function subtituloDe({ estado }) {
  if (estado.terminado) return `Saldado · ${textoMonto(estado.abonado)}`;
  return [estado.progreso && `${estado.progreso} pagos`, `${textoMonto(estado.abonado)} abonado`]
    .filter(Boolean).join(' · ');
}

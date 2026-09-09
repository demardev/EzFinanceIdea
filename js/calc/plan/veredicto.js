/* Alcanza / Justo / No alcanza, más lo que hay que avisar.
   Función PURA: sin red, sin DOM.

   Devuelve datos estructurados, no frases armadas: quien pinta se encarga de
   redactarlas, para que el botón de ocultar montos siga funcionando. */

import { sumar } from '../dinero.js';

/**
 * @param base       resultado de asignar() con los variables al mínimo
 * @param pesimista  el mismo cálculo con los gastos variables al máximo
 */
export function evaluar({ base, pesimista }) {
  const faltantes = [...base.faltantes].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const faltanteTotal = sumar(...faltantes.map((f) => f.monto));
  const apretadoEnPesimista = pesimista.libreTotal < 0;

  /* Un libre negativo sin faltantes con fecha significa que el colchón de
     gastos variables no cabe: se cubren los pagos agendados, pero el mes no
     cierra. Eso también es "no alcanza". */
  const colchonNoCabe = base.libreTotal < 0;
  const nivel = faltantes.length || colchonNoCabe ? 'no-alcanza'
    : base.libreTotal === 0 || apretadoEnPesimista ? 'justo'
    : 'alcanza';

  return {
    nivel,
    faltantes,
    faltanteTotal,
    primerFaltante: faltantes[0] ?? null,
    transferencias: base.transferencias,
    libreBase: base.libreTotal,
    librePesimista: pesimista.libreTotal,
    apretadoEnPesimista,
    colchonNoCabe,
    diaMasAjustado: base.diaMasAjustado,
  };
}

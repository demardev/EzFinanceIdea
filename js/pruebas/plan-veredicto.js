/* Pruebas de calc/plan/veredicto.js — escritas antes que la implementación. */

import { describir, igual } from './marco.js';
import { evaluar } from '../calc/plan/veredicto.js';

const resultado = (extra = {}) => ({
  faltantes: [], transferencias: [], libreTotal: 1000,
  diaMasAjustado: { fecha: '2026-09-20', total: 500 },
  serie: [{ fecha: '2026-09-01', total: 1000 }], sobres: [], ...extra,
});

describir('veredicto', (caso) => {
  caso('alcanza cuando sobra dinero en los dos escenarios', () => {
    const v = evaluar({ base: resultado(), pesimista: resultado({ libreTotal: 300 }) });
    igual(v.nivel, 'alcanza');
    igual(v.libreBase, 1000);
    igual(v.librePesimista, 300);
  });

  caso('no alcanza en cuanto hay un faltante', () => {
    const v = evaluar({
      base: resultado({ faltantes: [{ nombre: 'Amex', fecha: '2026-09-28', monto: 320 }] }),
      pesimista: resultado({ libreTotal: -500 }),
    });
    igual(v.nivel, 'no-alcanza');
    igual(v.faltanteTotal, 320);
    igual(v.primerFaltante.nombre, 'Amex');
  });

  caso('suma varios faltantes y toma el más próximo como primero', () => {
    const v = evaluar({
      base: resultado({ faltantes: [
        { nombre: 'Amex', fecha: '2026-09-28', monto: 320 },
        { nombre: 'Renta', fecha: '2026-09-25', monto: 80 },
      ] }),
      pesimista: resultado(),
    });
    igual(v.faltanteTotal, 400);
    igual(v.primerFaltante.nombre, 'Renta');
  });

  caso('justo cuando queda exactamente en ceros', () => {
    igual(evaluar({ base: resultado({ libreTotal: 0 }),
                    pesimista: resultado({ libreTotal: 0 }) }).nivel, 'justo');
  });

  caso('no alcanza si el colchón de variables no cabe, aunque no haya faltantes con fecha', () => {
    const v = evaluar({ base: resultado({ libreTotal: -50 }),
                        pesimista: resultado({ libreTotal: -900 }) });
    igual(v.nivel, 'no-alcanza');
    igual(v.colchonNoCabe, true);
    igual(v.faltantes, []);
  });

  caso('justo si con los variables al máximo ya no alcanza', () => {
    const v = evaluar({
      base: resultado({ libreTotal: 460 }),
      pesimista: resultado({ libreTotal: -120 }),
    });
    igual(v.nivel, 'justo');
    igual(v.apretadoEnPesimista, true);
  });

  caso('las transferencias propuestas se conservan', () => {
    const v = evaluar({
      base: resultado({ transferencias: [
        { desde: 'ahorros', hacia: 'banco', monto: 700, antesDe: '2026-09-22' }] }),
      pesimista: resultado(),
    });
    igual(v.transferencias.length, 1);
    igual(v.transferencias[0].monto, 700);
  });

  caso('reporta el día más ajustado del escenario base', () => {
    const v = evaluar({
      base: resultado({ diaMasAjustado: { fecha: '2026-09-22', total: 40 } }),
      pesimista: resultado(),
    });
    igual(v.diaMasAjustado, { fecha: '2026-09-22', total: 40 });
  });
});

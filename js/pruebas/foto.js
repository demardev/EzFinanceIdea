/* Pruebas de ui/foto.js. La parte pura es el cálculo de tamaño, que es
   justo donde una foto vertical del teléfono se deforma si está mal. */

import { describir, igual } from './marco.js';
import { dimensionesDestino } from '../ui/foto.js';

describir('tamaño de la foto', (caso) => {
  caso('encoge una foto horizontal respetando la proporción', () => {
    igual(dimensionesDestino(4032, 3024, 1400), { ancho: 1400, alto: 1050 });
  });

  caso('encoge una vertical sin voltearla', () => {
    igual(dimensionesDestino(3024, 4032, 1400), { ancho: 1050, alto: 1400 });
  });

  caso('nunca agranda una imagen chica', () => {
    igual(dimensionesDestino(800, 600, 1400), { ancho: 800, alto: 600 });
    igual(dimensionesDestino(1400, 1400, 1400), { ancho: 1400, alto: 1400 });
  });

  caso('respeta un lado máximo distinto', () => {
    igual(dimensionesDestino(4000, 2000, 1000), { ancho: 1000, alto: 500 });
  });

  caso('no revienta con medidas raras', () => {
    igual(dimensionesDestino(0, 0, 1400), { ancho: 0, alto: 0 });
  });
});

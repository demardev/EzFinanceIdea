/* Pruebas de calc/dinero.js */

import { describir, igual } from './marco.js';
import { redondear, sumar, repartir, formatear,
         aNumero, formatearEntrada, montoAEntrada } from '../calc/dinero.js';

describir('dinero', (caso) => {
  caso('redondea a 2 decimales sin error binario', () => {
    igual(redondear(1.005), 1.01);
    igual(redondear(0.1 + 0.2), 0.3);
  });

  caso('suma sin arrastrar decimales fantasma', () => {
    igual(sumar(0.1, 0.2, 0.3), 0.6);
  });

  caso('reparte exacto cuando divide bien', () => {
    igual(repartir(1200, 12), Array(12).fill(100));
  });

  caso('la última cuota absorbe el residuo: 1000/3', () => {
    const partes = repartir(1000, 3);
    igual(partes, [333.33, 333.33, 333.34]);
    igual(sumar(...partes), 1000);
  });

  caso('reparto raro: 100/7 suma exactamente 100', () => {
    igual(sumar(...repartir(100, 7)), 100);
  });

  caso('formatea con separador de miles y 2 decimales', () => {
    igual(formatear(1234.5), '$1,234.50');
    igual(formatear(-80), '−$80.00');
    igual(formatear(2400, { signo: true }), '+$2,400.00');
  });

  caso('todo monto sale con signo de peso y dos decimales', () => {
    igual(formatear(0), '$0.00');
    igual(formatear(7), '$7.00');
    igual(formatear(0.5), '$0.50');
    igual(formatear(1000000), '$1,000,000.00');
  });

  caso('aNumero lee lo que el usuario tiene escrito', () => {
    igual(aNumero('1,234.50'), 1234.5);
    igual(aNumero('$1,234.50'), 1234.5);
    igual(aNumero('-1,234'), -1234);
    igual(aNumero(''), 0);
    igual(aNumero('.'), 0);
    igual(aNumero('abc'), 0);
  });

  caso('los dígitos entran por la derecha: los dos últimos son centavos', () => {
    igual(formatearEntrada('1'), '0.01');
    igual(formatearEntrada('10'), '0.10');
    igual(formatearEntrada('100'), '1.00');
    igual(formatearEntrada('1000'), '10.00');
  });

  caso('agrupa miles conforme crece el número', () => {
    igual(formatearEntrada('123456'), '1,234.56');
    igual(formatearEntrada('100000000'), '1,000,000.00');
  });

  caso('borrar un dígito recorre el punto a la izquierda', () => {
    // '10.00' menos el último carácter -> '10.0' -> dígitos '100' -> 1.00
    igual(formatearEntrada('10.0'), '1.00');
    igual(formatearEntrada('1.0'), '0.10');
  });

  caso('campo vacío se queda vacío, y la basura se ignora', () => {
    igual(formatearEntrada(''), '');
    igual(formatearEntrada('abc'), '');
    igual(formatearEntrada('a1b2c3'), '1.23');
  });

  caso('reformatear lo ya formateado no cambia nada', () => {
    igual(formatearEntrada('1,234.56'), '1,234.56');
    igual(formatearEntrada(formatearEntrada('99')), '0.99');
  });

  caso('conserva el signo negativo', () => {
    igual(formatearEntrada('-4500'), '-45.00');
  });

  caso('montoAEntrada pone un número guardado en el campo', () => {
    igual(montoAEntrada(18430), '18,430.00');
    igual(montoAEntrada(1234.5), '1,234.50');
    igual(montoAEntrada(0), '0.00');
    igual(montoAEntrada(''), '');
    igual(montoAEntrada(null), '');
  });

});

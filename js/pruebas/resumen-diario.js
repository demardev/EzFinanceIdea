/* Pruebas de calc/resumen-diario.js — escritas antes que la implementación.
   El texto de la notificación de las 8 pm y el de Por confirmar. */

import { describir, igual } from './marco.js';
import { armarResumenDiario, mensajeBandeja } from '../calc/resumen-diario.js';

const HOY = '2026-11-03';
const mov = (fecha, extra = {}) => ({ fecha, ...extra });
const venc = (clase, nombre, dias) => ({ clase, nombre, dias, fecha: '' });
const cuerpo = (datos) => armarResumenDiario(datos, HOY).cuerpo;

describir('resumen diario — registrar lo del día', (caso) => {
  caso('sin movimientos hoy lo dice tal cual', () => {
    igual(cuerpo({ movimientos: [] }), 'Hoy no has registrado movimientos.');
  });

  caso('cuenta solo los de hoy, sin las cuotas que se cargan solas', () => {
    const lista = [mov(HOY), mov(HOY), mov('2026-11-02'), mov(HOY, { compra_id: 'c1' })];
    igual(cuerpo({ movimientos: lista }), 'Hoy registraste 2 movimientos. ¿Falta alguno?');
  });

  caso('en singular con uno', () => {
    igual(cuerpo({ movimientos: [mov(HOY)] }), 'Hoy registraste 1 movimiento. ¿Falta alguno?');
  });

  caso('lo que espera en Por confirmar va en su propia línea', () => {
    igual(cuerpo({ movimientos: [], porConfirmar: 2 }),
      'Hoy no has registrado movimientos.\nTienes 2 por confirmar.');
  });
});

describir('resumen diario — lo de mañana y los cobros', (caso) => {
  caso('solo lo que vence mañana, cada clase con su forma', () => {
    const vencimientos = [venc('pago', 'Visa', 1), venc('corte', 'Amex', 1),
                          venc('gasto', 'Renta', 1), venc('ingreso', 'Sueldo', 1),
                          venc('gasto', 'Luz', 0), venc('pago', 'Oro', 2)];
    igual(cuerpo({ movimientos: [mov(HOY)], vencimientos }),
      'Hoy registraste 1 movimiento. ¿Falta alguno?\n'
      + 'Mañana: pago de Visa, corte de Amex, Renta, entra Sueldo.');
  });

  caso('los cobros viejos del negocio al final', () => {
    igual(cuerpo({ movimientos: [], cobrosViejos: 1 }),
      'Hoy no has registrado movimientos.\nTe deben 1 recibo desde hace una semana o más.');
    igual(cuerpo({ movimientos: [], cobrosViejos: 3 }).split('\n')[1],
      'Te deben 3 recibos desde hace una semana o más.');
  });

  caso('el resto del mensaje: título, a dónde lleva y su etiqueta', () => {
    const { titulo, url, etiqueta } = armarResumenDiario({ movimientos: [] }, HOY);
    igual({ titulo, url, etiqueta },
      { titulo: 'Cierre del día', url: './#/resumen', etiqueta: 'resumen-diario' });
  });
});

describir('resumen diario — Por confirmar al llegar', (caso) => {
  caso('dice qué llegó, sin montos', () => {
    igual(mensajeBandeja('applepay').cuerpo, 'Llegó una compra de Apple Pay.');
    igual(mensajeBandeja('sms').cuerpo, 'Llegó un aviso del banco.');
    igual(mensajeBandeja('correo').cuerpo, 'Llegó un correo del banco.');
    igual(mensajeBandeja('otro').cuerpo, 'Llegó algo nuevo.');
  });

  caso('todos con la misma etiqueta, para que se junten en una', () => {
    igual(mensajeBandeja('sms').etiqueta, 'bandeja');
    igual(mensajeBandeja('sms').titulo, 'Por confirmar');
  });
});

/* Los tres estados de cuenta reales de BAC (corte el 9) como los debería
   devolver la lectura: es el caso de prueba de calc/estado-cuenta.js. Los
   intereses van al pie, fuera de la lista, y sí suman al saldo al corte. */

const c = (fecha, concepto, monto) => ({ fecha, concepto, monto, sentido: 'cargo' });
const a = (fecha, concepto, monto) => ({ fecha, concepto, monto, sentido: 'credito' });
const base = { banco: 'BAC', moneda: 'USD' };

export const SEPTIEMBRE = {
  ...base, fecha_corte: '2026-09-09', fecha_limite_pago: '2026-09-28',
  saldo_anterior: 108.87, saldo_al_corte: 150.49, intereses_fuera_de_lista: 1.42,
  pago_contado: 149.07,
  movimientos: [
    c('2026-08-10', 'APPLE.COM/BILL', 4.29), c('2026-08-19', "BENNINGAN'S", 21.66),
    c('2026-08-21', 'KENTUCKY FRIED CHICKEN', 5.99),
    c('2026-08-28', 'COMPRA EN CUOTA ISHOP CUOTA:10/36', 9.97),
    a('2026-08-28', 'SU PAGO RECIBIDO GRACIAS', 107.74),
    c('2026-09-02', 'LLAOLLAO RAMBLAS', 10.98), c('2026-09-02', 'OYE CHICO LAS RAMBLAS', 23.08),
    c('2026-09-03', 'WOMPI*HILL N GRILL', 10.50), c('2026-09-05', 'APPLE.COM BILL', 2.99),
    c('2026-09-08', 'Disney Plus', 15.99), c('2026-09-09', 'MINICUOTA 0% 6M CUOTA:03/06', 43.62),
    a(null, 'BONIFICACION PAGO SALDO DOLARES', 1.13),
  ],
};

export const OCTUBRE = {
  ...base, fecha_corte: '2026-10-09', fecha_limite_pago: '2026-10-28',
  saldo_anterior: 150.49, saldo_al_corte: 64.58, intereses_fuera_de_lista: 6.39,
  pago_contado: 58.19,
  movimientos: [
    a('2026-09-12', 'SU PAGO RECIBIDO GRACIAS', 149.07),
    a('2026-09-12', 'SU PAGO RECIBIDO GRACIAS', 1.42),
    c('2026-09-12', 'LC WAIKIKI', 84.96), c('2026-09-12', 'BENDITA BURGER', 47.82),
    c('2026-09-12', 'BATH AND BODY WORKS', 52.00), c('2026-09-17', 'APPLE.COM/BILL', 10.99),
    c('2026-09-28', 'COMPRA EN CUOTA ISHOP CUOTA:11/36', 9.97),
    c('2026-09-29', 'PAQUETES CLARO', 1.00), c('2026-09-30', 'PAQUETES CLARO', 1.00),
    c('2026-10-05', 'APPLE.COM/BILL', 2.99), a('2026-10-07', 'SU PAGO RECIBIDO GRACIAS', 210.73),
    c('2026-10-08', 'Disney Plus', 15.99), c('2026-10-09', 'MINICUOTA 0% 6M CUOTA:04/06', 43.62),
    a(null, 'BONIFICACION PAGO SALDO DOLARES', 1.42),
  ],
};

export const NOVIEMBRE = {
  ...base, fecha_corte: '2026-11-09', fecha_limite_pago: '2026-11-30',
  saldo_anterior: 64.58, saldo_al_corte: 423.87, intereses_fuera_de_lista: 4.62,
  pago_contado: 419.25,
  movimientos: [
    c('2026-10-13', 'RECARGA MOVISTAR', 2.00), c('2026-10-14', 'PAQUETES CLARO', 2.00),
    c('2026-10-16', 'APPLE.COM/BILL', 8.99), c('2026-10-23', 'PAQUETES MOVISTAR', 5.00),
    c('2026-10-23', 'SELECTOS SAN BARTOLO', 171.45), c('2026-10-25', 'BOBALUBA VENECIA', 9.90),
    a('2026-10-27', 'SU PAGO RECIBIDO GRACIAS', 171.45),
    a('2026-10-27', 'SU PAGO RECIBIDO GRACIAS', 64.58),
    c('2026-10-28', 'COMPRA EN CUOTA ISHOP CUOTA:12/36', 9.97),
    c('2026-10-30', 'KFC ORDEN DE MALTA', 8.99), c('2026-10-31', 'APPLE.COM/BILL', 2.99),
    c('2026-10-31', 'SELECTOS SAN MARTIN', 71.40), c('2026-11-01', 'PUMA PALERMO', 24.00),
    c('2026-11-01', 'CINEMARK', 14.59), c('2026-11-02', 'DOLLAR CITY PLAZA MUNDO', 9.05),
    c('2026-11-02', 'SHARK BITES MILLENNIUM', 40.32), c('2026-11-02', 'FERRETERIAS FREUND', 16.85),
    c('2026-11-02', 'XIAOMI PLZ M SOYAPANGO', 30.00), c('2026-11-04', 'CINEMARK', 13.35),
    c('2026-11-04', 'PAQUETES MOVISTAR', 5.00), c('2026-11-05', 'APPLE.COM/BILL', 2.99),
    c('2026-11-07', 'PEDIDOSYA RESTAURANTES', 30.64), c('2026-11-07', 'MUSIK KLUB', 12.00),
    c('2026-11-07', 'MUSIK KLUB', 9.00), c('2026-11-07', 'MUSIK KLUB', 6.00),
    c('2026-11-07', 'MUSIK KLUB', 10.00), c('2026-11-07', 'BARLLENO PLAZA PRESIDENTE', 21.00),
    c('2026-11-08', 'Disney Plus', 15.99), c('2026-11-09', 'MINICUOTA 0% 6M CUOTA:05/06', 43.62),
    a(null, 'BONIFICACION PAGO SALDO DOLARES', 6.39),
  ],
};

/* Los avisos que la app ya sabe leer. Son datos, no código: el mismo formato
   que las plantillas que enseña el usuario (ver plantilla.js).

   Para agregar un banco aquí: copiar el mensaje tal cual, poner huecos donde
   cambia y escribir su prueba en js/pruebas/avisos-fabrica.js. */

const CUENTA = { tipo: 'cuenta' };
const TARJETA = { tipo: 'tarjeta' };
const CUENTA_NIU = { tipo: 'cuenta', nombre: 'Cuenta Niu' };
const TARJETA_NIU = { tipo: 'tarjeta', nombre: 'Tarjeta Niu' };

const CUSCATLAN = [
  { id: 'cuscatlan-debito', sentido: 'sale', origen: CUENTA,
    texto: 'Se hizo un Debito en su Cuenta B. CUSCATLAN {origen} por USD{monto} el dia {fecha}. {*}' },
  /* "Titular" o "Adicional" según el plástico: lo absorbe el {*}. */
  { id: 'cuscatlan-compra', sentido: 'sale', origen: TARJETA,
    texto: 'Alerta de compra B.CUSCATLAN con su Tarjeta de Credito {*} {origen} por USD{monto} en {comercio} el {fecha}. {*}' },
  /* No dice de qué cuenta sale: solo hay una de Cuscatlán. AHORRO o CORRIENTE va en el {*}. */
  { id: 'cuscatlan-transfer-enviada', sentido: 'sale', origen: CUENTA, destino: CUENTA,
    texto: 'Su Op. Transfer365 {*} {destino} a {persona} por USD {monto} ha sido aplicada el dia {fecha}' },
  { id: 'cuscatlan-abono', sentido: 'entra', destino: CUENTA,
    texto: 'Ha recibido un abono a su {*} por USD {monto} en {fecha} de {persona} en concepto de {*}' },
].map((p) => ({ ...p, banco: 'cuscatlan' }));

const NIU = [
  { id: 'niu-pago-tarjeta', sentido: 'entre', origen: CUENTA_NIU, destino: TARJETA_NIU,
    texto: 'Niu te informa que pagaste tu Tarjeta de Credito Niu con tu Cuenta Niu por USD {monto} el {fecha} con referencia {referencia}' },
  { id: 'niu-transferencia', sentido: 'sale', origen: CUENTA_NIU,
    texto: 'Niu te informa que realizaste una transferencia con tu Cuenta NIU por USD {monto} el {fecha} con referencia {referencia}' },
  { id: 'niu-recarga-cuenta', sentido: 'entre', origen: TARJETA, destino: CUENTA_NIU,
    texto: 'Niu te informa que realizaste una recarga a tu cuenta con tu tarjeta({origen}) por USD {monto} el {fecha} con referencia {referencia}' },
  { id: 'niu-recarga-celular', sentido: 'sale', origen: CUENTA_NIU,
    texto: 'Niu te informa que realizaste una recarga de celular a {comercio} con tu Cuenta NIU por USD {monto} el {fecha} con referencia {referencia}' },
].map((p) => ({ ...p, banco: 'niu' }));

/* Llegan desde el +503 6302 2620. La de débito saca el dinero de la cuenta. */
const BAC = [
  { id: 'bac-credito', sentido: 'sale', origen: TARJETA,
    texto: 'Alertas PRF VISA {origen}: has realizado una compra por USD {monto} en el comercio: {comercio} {fecha} {*}' },
  { id: 'bac-debito', sentido: 'sale', origen: { tipo: 'debito' },
    texto: 'AlertaDebito VISA {origen}: has realizado una compra por USD {monto} en el comercio {comercio} {fecha} {*}' },
].map((p) => ({ ...p, banco: 'bac' }));

/* Promerica escribe "$" en vez de "USD", y no avisa los pagos de servicios. */
const PROMERICA = [
  { id: 'promerica-transfer-enviada', sentido: 'sale', origen: CUENTA,
    texto: 'Su Op. Transfer365 de Transferencia de Fondos a cuenta de ahorro a {persona} por $ {monto} ha sido aplicada el {fecha}' },
  { id: 'promerica-abono', sentido: 'entra', destino: CUENTA,
    texto: 'Ha recibido un abono Transferencia de Fondos a cuenta de ahorro de {persona} por $ {monto} a traves de Transfer365 el {fecha}' },
].map((p) => ({ ...p, banco: 'promerica' }));

export const DE_FABRICA = [...CUSCATLAN, ...NIU, ...BAC, ...PROMERICA];

/* Lo que se hace al registrar algo de Por confirmar: sacarlo de la bandeja y
   recordar lo que elegiste si es nuevo o lo cambiaste, para que la próxima
   vez llegue puesto:
   - de Apple Pay, la tarjeta de Wallet;
   - de un aviso, sus cuentas y si la persona eres tú (avisos/cuentas.js);
   - de cualquier egreso, la categoría del comercio. */

import { unirDestino } from '../../ui/campos.js';
import { claveDeComercio } from '../../calc/bandeja.js';
import { aprendizajeDe } from '../../calc/avisos/cuentas.js';

function deWallet(item, fila) {
  if (!item.tarjeta || fila.tipo !== 'egreso') return [];
  const origen = unirDestino(fila, 'cuenta_id', 'tarjeta_id');
  return origen ? [[item.tarjeta, origen]] : [];
}

export function alRegistrarDe(contexto, item, { origenes, categorias }) {
  const { bandeja, userId } = contexto;
  return async (fila) => {
    await bandeja.eliminar(item.id);
    const nuevos = [...deWallet(item, fila), ...aprendizajeDe(item, fila, origenes)]
      .filter(([nombre, valor]) => origenes[nombre] !== valor);
    for (const [nombre, valor] of nuevos) await bandeja.recordarOrigen(userId, nombre, valor);
    const comercio = claveDeComercio(item.comercio);
    if (fila.tipo === 'egreso' && comercio && fila.categoria_id
        && categorias.aprendidas[comercio] !== fila.categoria_id) {
      await bandeja.recordarCategoria(userId, comercio, fila.categoria_id);
    }
  };
}

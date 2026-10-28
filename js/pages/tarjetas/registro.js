/* Registrar o editar un movimiento desde Tarjetas: el bloque "Por registrar"
   y las pistas de la conciliación abren el mismo formulario de siempre. */

import { abrirRegistro, borradorDeFijo } from '../../movimientos/registrar.js';

const catalogosDe = (datos) => ({
  cuentas: datos.cuentas, categorias: datos.categorias,
  tarjetas: datos.tarjetas.filter((t) => !t.archivada),
});

/**
 * @param obtenerDatos () => los datos de la pantalla de AHORA (cambian al recargar)
 * @param recargar     vuelve a pedir y repintar la pantalla
 * Cada acción recibe `despues`, que corre tras recargar: así el sheet de
 * conciliar se recalcula con lo que acabas de guardar.
 */
export function accionesDeRegistro(contexto, obtenerDatos, recargar) {
  const abrir = (mov, despues) => abrirRegistro(contexto, mov, async () => {
    await recargar();
    despues?.();
  }, catalogosDe(obtenerDatos()));
  return {
    registrarFijo: (item, despues) => abrir(borradorDeFijo(item), despues),
    editarMovimiento: (id, despues) =>
      abrir(obtenerDatos().movimientos.find((m) => m.id === id), despues),
  };
}

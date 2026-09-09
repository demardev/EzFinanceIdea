/* Punto de entrada del pago de recibo: abre el formulario ya cargado con las
   categorías y preferencias, y coordina el guardado. */

import { abrirFormPago } from './form.js';
import { crearPago, editarPago, eliminarPago, urlDeFoto } from './acciones.js';

/** Las tres categorías del negocio, por nombre; el RPC las siembra. */
export function categoriasDeNegocio(categorias) {
  const buscar = (tipo, patron) =>
    categorias.find((c) => c.tipo === tipo && patron.test(c.nombre))?.id ?? null;
  return {
    pago: buscar('egreso', /pago de recibo/i),
    cobro: buscar('ingreso', /cobro de recibo/i),
    comision: buscar('ingreso', /comisi[oó]n/i),
  };
}

/**
 * @param pago      {} para uno nuevo, o el que se edita
 * @param alCambiar se llama después de guardar o eliminar
 */
export async function abrirPagoRecibo(contexto, pago, datos, alCambiar) {
  const categorias = categoriasDeNegocio(datos.categorias);
  const urlFoto = pago.id ? await urlDeFoto(contexto, pago).catch(() => null) : null;

  abrirFormPago(pago, { cuentas: datos.cuentas, perfil: contexto.perfil }, {
    urlFoto,
    alGuardar: async (fila, foto) => {
      await (pago.id
        ? editarPago(contexto, pago, fila, { foto, categorias })
        : crearPago(contexto, fila, { foto, categorias }));
      await alCambiar();
    },
    alEliminar: async () => {
      if (!await eliminarPago(contexto, pago)) return false;
      await alCambiar();
      return true;
    },
  });
}

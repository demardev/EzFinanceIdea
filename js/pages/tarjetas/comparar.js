/* Debajo de una lectura que cuadra: comparar con tus movimientos (paso 2) y
   proponer los arreglos (paso 3). Se ve qué pasaría con los marcados antes
   de aplicarlos, se pide confirmación, y lo aplicado se puede deshacer
   mientras la hoja siga abierta. Siempre con los datos de ESTE momento. */

import { emparejarEstado } from '../../calc/emparejar-estado.js';
import { proponerArreglos, comprobarArreglos } from '../../calc/arreglos-estado.js';
import { hoyISO } from '../../calc/fechas.js';
import { confirmar } from '../../ui/confirmar.js';
import { avisoError } from '../../ui/toast.js';
import { plural } from '../../ui/texto.js';
import { pintarComparacion } from './comparacion-vista.js';
import { pintarArreglos, pintarComprobacion, pintarAplicado } from './arreglos-vista.js';
import { aplicarArreglos } from './arreglos.js';

const BOTON = `
  <button type="button" class="btn btn-bloque" data-comparar style="margin-top:12px">
    Comparar con mis movimientos</button>
  <div data-comparacion class="pila" style="margin-top:12px"></div>`;

const marcadosDe = (zona, arreglos) =>
  arreglos.filter((a) => zona.querySelector(`[name="arreglo_${a.id}"]`)?.checked);

/** Repinta "qué pasaría" cada vez que se marca o desmarca un arreglo. */
function conectarCasillas(zona, arreglos, entrada) {
  const refrescar = () => {
    const marcados = marcadosDe(zona, arreglos);
    zona.querySelector('[data-comprobacion]').innerHTML =
      pintarComprobacion(comprobarArreglos(marcados, entrada), marcados.length);
    zona.querySelector('[data-aplicar]').disabled = !marcados.length;
  };
  zona.querySelector('[data-arreglos-form]').addEventListener('change', refrescar);
  refrescar();
}

async function aplicar(zona, arreglos, ctx, entrada, volver) {
  const marcados = marcadosDe(zona, arreglos);
  const ok = await confirmar({
    titulo: `¿Aplicar ${plural(marcados.length, 'arreglo', 'arreglos')}?`,
    mensaje: 'Se guardan en tus movimientos y compras a cuotas. Podrás deshacerlos mientras esta hoja siga abierta.',
    textoOk: 'Aplicar', peligro: false,
  });
  if (!ok) return;
  const resultado = await aplicarArreglos(ctx.contexto, ctx.tarjeta, marcados, entrada.compras);
  await ctx.alCambiar();
  zona.innerHTML = pintarAplicado(resultado);
  zona.querySelector('[data-deshacer]').addEventListener('click', async (evento) => {
    evento.target.disabled = true;
    try {
      await resultado.deshacer();
      await ctx.alCambiar();
      volver();
    } catch (e) {
      avisoError(e);
    }
  });
}

/** Compara y pinta comparación + arreglos en `destino`. */
function comparar(destino, lectura, ctx) {
  const { movimientos, compras, categorias } = ctx.obtenerDatos();
  const entrada = { lectura, tarjeta: ctx.tarjeta, movimientos, compras, categorias, hoy: hoyISO() };
  const resultado = emparejarEstado(entrada);
  const propuesta = proponerArreglos(resultado, entrada);
  destino.innerHTML = pintarComparacion(resultado) + pintarArreglos(propuesta);
  const zona = destino.querySelector('[data-arreglos]');
  if (!zona || !propuesta.arreglos.length) return;
  conectarCasillas(zona, propuesta.arreglos, entrada);
  zona.querySelector('[data-aplicar]').addEventListener('click', () =>
    aplicar(zona, propuesta.arreglos, ctx, entrada, () => comparar(destino, lectura, ctx))
      .catch(avisoError));
}

/**
 * @param ctx { contexto, tarjeta, obtenerDatos: () => datos, alCambiar: () => Promise }
 */
export function conectarComparar(bloque, lectura, ctx) {
  bloque.insertAdjacentHTML('beforeend', BOTON);
  const boton = bloque.querySelector('[data-comparar]');
  boton.addEventListener('click', () => {
    comparar(bloque.querySelector('[data-comparacion]'), lectura, ctx);
    boton.remove();
  });
}

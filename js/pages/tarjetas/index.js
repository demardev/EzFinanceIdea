/* Orquesta Tarjetas: lista con sus cálculos, detalle, pago y CRUD.
   No calcula dinero (calc/) ni pinta (vista.js / detalle.js). */

import { cardTarjeta } from './vista.js';
import { pintarDetalle, alternarOrden, alternarBloque,
         alternarCuotasDe } from './detalle.js';
import { abrirFormTarjeta } from './form.js';
import { abrirSheetPago } from './pagar.js';
import { abrirFormCompra } from './cuotas-form.js';
import { crearCompra, editarCompra, eliminarCompra } from './compras.js';
import { calcularCiclo } from '../../calc/ciclo-tarjeta.js';
import { calcularDeuda } from '../../calc/deuda-tarjeta.js';
import { sinCuotasYaPagadas } from '../../calc/cuotas.js';
import { confirmar } from '../../ui/confirmar.js';
import { aviso, avisoError } from '../../ui/toast.js';
import { plural } from '../../ui/texto.js';
import { icono } from '../../iconos/render.js';
import { estadoVacio } from '../../ui/lista.js';

/** Los movimientos que tocan esta tarjeta: cargos y pagos. */
function deLaTarjeta(movimientos, id) {
  return movimientos.filter((m) => m.tarjeta_id === id || m.tarjeta_destino_id === id);
}

function calcularTodo(tarjeta, movimientos, compras) {
  const propios = deLaTarjeta(movimientos, tarjeta.id);
  const ciclo = calcularCiclo(tarjeta.dia_corte, tarjeta.dia_limite_pago);
  /* Las cuotas que ya venían pagadas siguen en el historial pero no son deuda. */
  const deudores = sinCuotasYaPagadas(propios, compras);
  /* `comprometido` sale del propio cálculo: si se sumara aparte, el
     disponible y esa línea podrían contar cosas distintas. */
  return { ciclo, propios, deuda: calcularDeuda(deudores, ciclo, tarjeta.limite_credito) };
}

function indices(categorias) {
  const nombres = {}; const iconos = {};
  categorias.forEach((c) => { nombres[c.id] = c.nombre; iconos[c.id] = c.icono; });
  return { nombres, iconos };
}

export async function montarTarjetas(contenedor, contexto, pantalla) {
  const { tarjetas, cuentas, categorias, movimientos, compras } = contexto;
  let datos = { tarjetas: [], cuentas: [], categorias: [], movimientos: [], compras: [] };

  async function cargar() {
    const [t, c, k, m, p] = await Promise.all([
      tarjetas.listar(), cuentas.listarActivas(), categorias.listarActivas(),
      movimientos.listarDeTarjetas(), compras.listar(),   // solo lo que toca tarjetas
    ]);
    datos = { tarjetas: t, cuentas: c, categorias: k, movimientos: m, compras: p };
  }

  async function recargar() {
    await cargar();
    pintar();
  }

  function pintarLista() {
    const activas = datos.tarjetas.filter((t) => !t.archivada);
    contenedor.innerHTML = `
      <div class="pila">
        ${activas.length
          ? activas.map((t) => {
              const { ciclo, deuda } = calcularTodo(t, datos.movimientos, datos.compras);
              return cardTarjeta(t, deuda, ciclo);
            }).join('')
          : estadoVacio({ iconoNombre: 'card', titulo: 'No tienes tarjetas.',
                          sub: 'Agrega la primera abajo.' })}
        <button class="btn btn-primario btn-bloque" id="btn-nueva" type="button">
          ${icono('plus', 18)} Nueva tarjeta
        </button>
      </div>`;
  }

  function pintar() {
    const tarjeta = pantalla.sub ? datos.tarjetas.find((t) => t.id === pantalla.sub) : null;
    if (!tarjeta) { pantalla.ponerCabecera('Tarjetas'); pintarLista(); return; }
    pantalla.ponerCabecera(tarjeta.nombre, '#/tarjetas');
    const { ciclo, deuda, propios } = calcularTodo(tarjeta, datos.movimientos, datos.compras);
    pintarDetalle(contenedor, {
      tarjeta, ciclo, deuda, movimientos: propios,
      compras: datos.compras.filter((c) => c.tarjeta_id === tarjeta.id),
      todasLasCompras: datos.compras,
      ...indices(datos.categorias),
    });
  }

  function editar(tarjeta) {
    abrirFormTarjeta(tarjeta, datos.cuentas, {
      alGuardar: async (fila) => {
        await (tarjeta.id ? tarjetas.actualizar(tarjeta.id, fila) : tarjetas.crear(fila));
        await recargar();
      },
      alEliminar: async () => {
        const cuantos = deLaTarjeta(datos.movimientos, tarjeta.id).length;
        const ok = await confirmar({
          titulo: `¿Eliminar "${tarjeta.nombre}"?`,
          mensaje: cuantos
            ? `Se van a BORRAR también ${plural(cuantos, 'movimiento', 'movimientos')} de esta tarjeta, cargos y pagos incluidos. No se puede deshacer.`
            : 'No tiene movimientos asociados.',
        });
        if (!ok) return false;
        await tarjetas.eliminar(tarjeta.id);
        aviso('Tarjeta eliminada.');
        location.hash = '#/tarjetas';
        return true;
      },
    });
  }

  function abrirCompra(tarjeta, compra) {
    abrirFormCompra(compra, datos, {
      alGuardar: async (d) => {
        await (compra.id ? editarCompra(contexto, compra, d) : crearCompra(contexto, tarjeta, d));
        await recargar();
      },
      alEliminar: async () => {
        if (!await eliminarCompra(contexto, compra)) return false;
        await recargar();
        return true;
      },
    });
  }

  contenedor.addEventListener('click', async (evento) => {
    const o = evento.target.closest('[data-pagar], [data-cuotas], [data-detalle], [data-compra],'
      + ' [data-cuotas-de], [data-bloque], #btn-nueva, #btn-orden-tarjeta, #btn-editar-tarjeta');
    if (!o) return;
    try {
      /* Lo que solo cambia cómo se ve la pantalla: se repinta y ya. */
      if (o.id === 'btn-orden-tarjeta') { alternarOrden(); return pintar(); }
      if (o.dataset.bloque) { alternarBloque(o.dataset.bloque); return pintar(); }
      if (o.dataset.cuotasDe) { alternarCuotasDe(o.dataset.cuotasDe); return pintar(); }

      if (o.id === 'btn-nueva') return editar({});
      if (o.dataset.detalle) { location.hash = `#/tarjetas/${o.dataset.detalle}`; return; }
      if (o.dataset.compra) {
        const compra = datos.compras.find((c) => c.id === o.dataset.compra);
        return abrirCompra(datos.tarjetas.find((t) => t.id === compra.tarjeta_id), compra);
      }
      const id = o.dataset.pagar || o.dataset.cuotas || pantalla.sub;
      const tarjeta = datos.tarjetas.find((t) => t.id === id);
      if (o.id === 'btn-editar-tarjeta') return editar(tarjeta);
      if (o.dataset.cuotas) return abrirCompra(tarjeta, {});
      const { deuda } = calcularTodo(tarjeta, datos.movimientos, datos.compras);
      abrirSheetPago(tarjeta, deuda, datos, async (fila) => {
        await movimientos.crear(fila);
        aviso('Pago registrado.');
        await recargar();
      });
    } catch (e) { avisoError(e); }
  });

  contenedor.innerHTML = '<p class="tenue">Cargando…</p>';
  await recargar();
}

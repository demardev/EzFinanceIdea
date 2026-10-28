/* Orquesta Tarjetas: lista con sus cálculos, detalle, pago y CRUD.
   No calcula dinero (calc/) ni pinta (vista.js / detalle.js). */

import { cardTarjeta } from './vista.js';
import { pintarDetalle, alternarOrden, elegirTramo,
         alternarCuotasDe } from './detalle.js';
import { abrirMenuTarjeta } from './menu.js';
import { abrirFormTarjeta } from './form.js';
import { abrirSheetPago } from './pagar.js';
import { abrirFormCompra } from './cuotas-form.js';
import { crearCompra, editarCompra, eliminarCompra } from './compras.js';
import { abrirConciliacion } from './conciliar.js';
import { calcularTodo, deLaTarjeta, entradaDe } from './calculos.js';
import { accionesDeRegistro } from './registro.js';
import { efectoDeSaldoInicial } from '../../calc/desglose-tarjeta.js';
import { fijosPorCargar } from '../../calc/fijos-tarjeta.js';
import { hoyISO } from '../../calc/fechas.js';
import { confirmar } from '../../ui/confirmar.js';
import { aviso, avisoError } from '../../ui/toast.js';
import { plural } from '../../ui/texto.js';
import { icono } from '../../iconos/render.js';
import { estadoVacio } from '../../ui/lista.js';
import { conectarPastillas } from '../../ui/pastillas.js';

/** Lo que haría el saldo inicial escrito en el formulario, con su día de corte. */
function simuladorDe(tarjeta, datos) {
  return (form) => efectoDeSaldoInicial({
    tarjeta: { ...tarjeta, dia_corte: Number(form.dia_corte),
               dia_limite_pago: Number(form.dia_limite_pago) },
    movimientos: datos.movimientos, compras: datos.compras,
  }, { monto: form.saldo_inicial, fecha: form.fecha_saldo_inicial }, hoyISO());
}

function indices(categorias) {
  const nombres = {}; const iconos = {};
  categorias.forEach((c) => { nombres[c.id] = c.nombre; iconos[c.id] = c.icono; });
  return { nombres, iconos };
}

export async function montarTarjetas(contenedor, contexto, pantalla) {
  const { tarjetas, cuentas, categorias, movimientos, compras, planItems } = contexto;
  let datos = { tarjetas: [], cuentas: [], categorias: [], movimientos: [], compras: [],
                fijos: [] };

  async function cargar() {
    const [t, c, k, m, p, f] = await Promise.all([
      tarjetas.listar(), cuentas.listarActivas(), categorias.listarActivas(),
      movimientos.listarDeTarjetas(), compras.listar(),   // solo lo que toca tarjetas
      planItems.listarActivos(),   // para marcar los gastos fijos en el detalle
    ]);
    datos = { tarjetas: t, cuentas: c, categorias: k, movimientos: m, compras: p, fijos: f };
  }

  async function recargar() {
    await cargar();
    pintar();
  }
  const acciones = accionesDeRegistro(contexto, () => datos, recargar);

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
    const { ciclo, deuda, desglose, propios, deudores } =
      calcularTodo(tarjeta, datos.movimientos, datos.compras);
    pintarDetalle(contenedor, {
      tarjeta, ciclo, deuda, desglose, movimientos: propios,
      compras: datos.compras.filter((c) => c.tarjeta_id === tarjeta.id),
      todasLasCompras: datos.compras, fijos: datos.fijos,
      porRegistrar: fijosPorCargar(tarjeta, datos.fijos, deudores, ciclo),
      ...indices(datos.categorias),
    });
  }

  function editar(tarjeta) {
    abrirFormTarjeta(tarjeta, datos.cuentas, {
      simular: simuladorDe(tarjeta, datos),
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
      tarjeta,
      alGuardar: async (d) => {
        await (compra.id ? editarCompra(contexto, tarjeta, compra, d)
                         : crearCompra(contexto, tarjeta, d));
        await recargar();
      },
      alEliminar: async () => {
        if (!await eliminarCompra(contexto, compra)) return false;
        await recargar();
        return true;
      },
    });
  }

  /* Lo que se hace con UNA tarjeta: desde su menú ⋯, o "Pagar" en la lista. */
  function actuar(accion, tarjeta) {
    if (accion === 'conciliar') {
      return abrirConciliacion(() => entradaDe(datos, tarjeta.id), acciones);
    }
    if (accion === 'editar') return editar(tarjeta);
    if (accion === 'cuotas') return abrirCompra(tarjeta, {});
    const { deuda } = calcularTodo(tarjeta, datos.movimientos, datos.compras);
    return abrirSheetPago(tarjeta, deuda, datos, async (fila) => {
      await movimientos.crear(fila);
      aviso('Pago registrado.');
      await recargar();
    });
  }

  const tarjetaDe = (id) => datos.tarjetas.find((t) => t.id === id);

  contenedor.addEventListener('click', async (evento) => {
    const o = evento.target.closest('[data-pagar], [data-cuotas], [data-acciones], [data-detalle],'
      + ' [data-compra], [data-cuotas-de], [data-fijo], #btn-nueva, #btn-orden-tarjeta');
    if (!o) return;
    try {
      /* Lo que solo cambia cómo se ve la pantalla: se repinta y ya. */
      if (o.id === 'btn-orden-tarjeta') { alternarOrden(); return pintar(); }
      if (o.dataset.cuotasDe) { alternarCuotasDe(o.dataset.cuotasDe); return pintar(); }

      if (o.dataset.acciones) {
        const tarjeta = tarjetaDe(o.dataset.acciones);
        return abrirMenuTarjeta(tarjeta, (accion) =>
          Promise.resolve().then(() => actuar(accion, tarjeta)).catch(avisoError));
      }
      if (o.dataset.pagar) return actuar('pagar', tarjetaDe(o.dataset.pagar));
      if (o.dataset.cuotas) return actuar('cuotas', tarjetaDe(o.dataset.cuotas));
      if (o.dataset.fijo) {
        /* El mismo cálculo que pintó la fila: así el índice apunta al mismo fijo. */
        const { tarjeta, ciclo, deudores } = entradaDe(datos, pantalla.sub);
        const pendientes = fijosPorCargar(tarjeta, datos.fijos, deudores, ciclo);
        return acciones.registrarFijo(pendientes[Number(o.dataset.fijo)].item);
      }
      if (o.id === 'btn-nueva') return editar({});
      if (o.dataset.detalle) { location.hash = `#/tarjetas/${o.dataset.detalle}`; return; }
      const compra = datos.compras.find((c) => c.id === o.dataset.compra);
      return abrirCompra(tarjetaDe(compra.tarjeta_id), compra);
    } catch (e) { avisoError(e); }
  });
  conectarPastillas(contenedor, (valor) => { elegirTramo(valor); pintar(); });

  contenedor.innerHTML = '<p class="tenue">Cargando…</p>';
  await recargar();
}

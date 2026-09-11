/* CRUD de cuentas. La vista pide al repo y pinta; el formulario vive en
   cuentas-form.js y el reordenar en orden.js. */

import { filaEditable, envolverLista, estadoVacio } from '../../ui/lista.js';
import { textoMonto } from '../../ui/privacidad.js';
import { confirmar } from '../../ui/confirmar.js';
import { aviso, avisoError } from '../../ui/toast.js';
import { plural } from '../../ui/texto.js';
import { icono } from '../../iconos/render.js';
import { abrirFormCuenta } from './cuentas-form.js';
import { abrirArqueo } from './arqueo.js';
import { saldoDeCuenta } from '../../calc/saldos.js';
import { formatear } from '../../calc/dinero.js';
import { hoyISO } from '../../calc/fechas.js';
import { mover } from './orden.js';
import { conectarDeslizar, cerrarDeslizada } from '../../ui/deslizar.js';

const ICONO_POR_TIPO = {
  efectivo: 'banknote', bancaria: 'banco', ahorro: 'piggy', otro: 'wallet',
};

const ETIQUETA_TIPO = {
  efectivo: 'Efectivo', bancaria: 'Bancaria', ahorro: 'Ahorro', otro: 'Otro',
};

function pintar(contenedor, lista, modoOrden) {
  const filas = lista.map((c) => filaEditable({
    id: c.id,
    nombre: c.nombre,
    sub: c.archivada ? `${ETIQUETA_TIPO[c.tipo]} · archivada` : ETIQUETA_TIPO[c.tipo],
    derecha: textoMonto(c.saldo_inicial),
    iconoNombre: ICONO_POR_TIPO[c.tipo] || 'wallet',
    modoOrden,
    deslizable: true,
  }));

  contenedor.innerHTML = `
    <div class="pila">
      <div>
        <div class="seccion-barra">
          <span class="seccion-titulo" style="margin:0">Todas las cuentas</span>
          <button class="enlace-accion ${modoOrden ? 'activo' : ''}" id="btn-orden" type="button">
            ${modoOrden ? 'Listo' : 'Reordenar'}
          </button>
        </div>
        ${lista.length ? envolverLista(filas) : estadoVacio({
          iconoNombre: 'wallet', titulo: 'No tienes cuentas.', sub: 'Crea la primera abajo.',
        })}
      </div>
      <button class="btn btn-primario btn-bloque" id="btn-nueva" type="button">
        ${icono('plus', 18)} Nueva cuenta
      </button>
    </div>`;
  conectarDeslizar(contenedor);
}

async function borrar(cuenta, { cuentas, movimientos }) {
  const cuantos = await movimientos.contarPorCuenta(cuenta.id);
  const nota = cuantos
    ? `Se van a BORRAR también ${plural(cuantos, 'movimiento', 'movimientos')} de esta cuenta. No se puede deshacer.`
    : 'No tiene movimientos asociados.';
  const ok = await confirmar({
    titulo: `¿Eliminar "${cuenta.nombre}"?`,
    mensaje: `${nota} Si solo quieres ocultarla, edítala y márcala como archivada.`,
  });
  if (!ok) return false;
  await cuentas.eliminar(cuenta.id);
  aviso('Cuenta eliminada.');
  return true;
}

/* El esperado se calcula solo con lo que YA pasó: un movimiento fechado
   mañana haría "cuadrar" con dinero que todavía no existe. */
async function abrirArqueoDe(cuenta, contexto, alTerminar) {
  const { movimientos, categorias } = contexto;
  const movs = await movimientos.listar();
  const esperado = saldoDeCuenta(cuenta, movs.filter((m) => m.fecha <= hoyISO()));

  abrirArqueo(cuenta, {
    esperado,
    alAjustar: async (r) => {
      const cats = await categorias.listarActivas();
      const cat = cats.find((c) => c.tipo === r.ajuste.tipo && /ajuste de caja/i.test(c.nombre));
      await movimientos.crear({
        tipo: r.ajuste.tipo, monto: r.ajuste.monto, fecha: hoyISO(),
        descripcion: 'Ajuste de caja', categoria_id: cat?.id ?? null,
        cuenta_id: cuenta.id, cuenta_destino_id: null,
        tarjeta_id: null, tarjeta_destino_id: null,
        nota: `Contado ${formatear(r.contado)} contra ${formatear(r.esperado)} esperados.`,
      });
      aviso(`Ajuste registrado: ${formatear(r.ajuste.monto)}.`);
      await alTerminar();
    },
  });
}

export async function montarCuentas(contenedor, contexto) {
  const { cuentas } = contexto;
  let lista = [];
  let modoOrden = false;

  async function recargar() {
    contenedor.innerHTML = '<p class="tenue">Cargando…</p>';
    lista = await cuentas.listar();          // incluye archivadas: aquí se administran
    pintar(contenedor, lista, modoOrden);
  }

  contenedor.addEventListener('click', async (evento) => {
    const objetivo = evento.target.closest('[data-editar], [data-borrar], [data-mover], #btn-nueva, #btn-orden');
    if (!objetivo) return;
    try {
      if (objetivo.dataset.borrar) {
        cerrarDeslizada();
        const cuenta = lista.find((c) => c.id === objetivo.dataset.borrar);
        if (await borrar(cuenta, contexto)) await recargar();
        return;
      }
      if (objetivo.id === 'btn-orden') { modoOrden = !modoOrden; pintar(contenedor, lista, modoOrden); return; }
      if (objetivo.id === 'btn-nueva') { abrirEdicion({}); return; }
      if (objetivo.dataset.mover) { await mover(cuentas, lista, objetivo.dataset.id, objetivo.dataset.mover); await recargar(); return; }
      abrirEdicion(lista.find((c) => c.id === objetivo.dataset.editar));
    } catch (e) { avisoError(e); }
  });

  function abrirEdicion(cuenta) {
    const puedeContar = Boolean(contexto.perfil?.negocio) && cuenta.tipo === 'efectivo' && cuenta.id;
    abrirFormCuenta(cuenta, {
      alContar: puedeContar ? () => abrirArqueoDe(cuenta, contexto, recargar) : null,
      alGuardar: async (datos) => {
        await (cuenta.id ? cuentas.actualizar(cuenta.id, datos) : cuentas.crear(datos));
        await recargar();
      },
      alEliminar: async () => {
        if (!await borrar(cuenta, contexto)) return false;
        await recargar();
        return true;
      },
    });
  }

  await recargar();
}

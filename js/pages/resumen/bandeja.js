/* "Por confirmar": las compras que llegaron solas (Apple Pay, por el atajo).
   Tocar una abre el formulario de movimiento ya lleno; deslizarla la
   descarta. Al registrarla sale de la bandeja, y si su tarjeta de Wallet
   todavía no tenía pareja en la app, se aprende para la próxima. */

import { abrirSheet } from '../../ui/sheet.js';
import { filaEditable, envolverLista } from '../../ui/lista.js';
import { conectarDeslizar, cerrarDeslizada } from '../../ui/deslizar.js';
import { confirmar } from '../../ui/confirmar.js';
import { unirDestino } from '../../ui/campos.js';
import { textoMonto } from '../../ui/privacidad.js';
import { aviso, avisoError } from '../../ui/toast.js';
import { formatearFecha } from '../../calc/fechas.js';
import { fechaLocalDe, borradorDeBandeja } from '../../calc/bandeja.js';
import { abrirRegistro } from '../../movimientos/registrar.js';

function fila(item) {
  const cuando = formatearFecha(fechaLocalDe(item.created_at));
  return filaEditable({
    id: item.id,
    nombre: item.comercio || 'Compra sin comercio',
    sub: item.tarjeta ? `${item.tarjeta} · ${cuando}` : cuando,
    derecha: textoMonto(item.monto),
    iconoNombre: 'card',
    deslizable: true,
  });
}

/* Lo que se hace al registrar: sacarla de la bandeja y, si es un egreso de
   una tarjeta de Wallet que aún no tenía pareja (o la cambiaste), recordarla. */
function alRegistrarDe(contexto, item, origenes) {
  return async (fila) => {
    await contexto.bandeja.eliminar(item.id);
    const origen = unirDestino(fila, 'cuenta_id', 'tarjeta_id');
    if (fila.tipo === 'egreso' && item.tarjeta && origen && origenes[item.tarjeta] !== origen) {
      await contexto.bandeja.recordarOrigen(contexto.userId, item.tarjeta, origen);
    }
  };
}

async function descartar(contexto, item, alCambiar) {
  const ok = await confirmar({
    titulo: '¿Descartar esta compra?',
    mensaje: `${item.comercio || 'Compra'} · ${textoMonto(item.monto)}. No se registra nada.`,
    textoOk: 'Descartar',
  });
  if (!ok) return false;
  await contexto.bandeja.eliminar(item.id);
  aviso('Compra descartada.');
  await alCambiar();
  return true;
}

export async function abrirPorConfirmar(contexto, items, alCambiar) {
  const origenes = await contexto.bandeja.origenes();
  const { hoja, cerrar } = abrirSheet({
    titulo: `Por confirmar · ${items.length}`,
    cuerpo: `
      <p class="tenue" style="font-size:13px;margin-bottom:10px">
        Toca una para registrarla. Desliza a la izquierda para descartarla.</p>
      ${envolverLista(items.map(fila))}`,
  });
  conectarDeslizar(hoja);

  hoja.addEventListener('click', async (evento) => {
    const objetivo = evento.target.closest('[data-editar], [data-borrar]');
    if (!objetivo) return;
    const item = items.find((i) => i.id === (objetivo.dataset.editar || objetivo.dataset.borrar));
    try {
      if (objetivo.dataset.borrar) {
        cerrarDeslizada();
        if (await descartar(contexto, item, alCambiar)) cerrar();
        return;
      }
      cerrar();
      await abrirRegistro(contexto, borradorDeBandeja(item, origenes), alCambiar, undefined,
                          { alRegistrar: alRegistrarDe(contexto, item, origenes) });
    } catch (e) { avisoError(e); }
  });
}

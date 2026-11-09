/* Elegir movimientos que ya hiciste y ligarlos a un préstamo: el pago a tu
   mamá que registraste como gasto normal, la transferencia que te mandó
   Luis. No se crea nada nuevo: el movimiento pasa a contar como abono. */

import { abrirSheet } from '../../ui/sheet.js';
import { escapar } from '../../ui/texto.js';
import { textoMonto } from '../../ui/privacidad.js';
import { aviso, avisoError } from '../../ui/toast.js';
import { formatearFecha, sumarMeses, hoyISO } from '../../calc/fechas.js';
import { cuentasDeEleccion } from '../../calc/prestamos.js';
import { DIRECCIONES } from './textos.js';

const MESES_ATRAS = 6;

function filaCandidato(m) {
  const texto = m.descripcion || 'Sin descripción';
  return `
    <label class="lista-fila elegible" data-buscar="${escapar(texto.toLowerCase())}">
      <input type="checkbox" value="${escapar(m.id)}">
      <span class="crece truncar">
        <span class="titulo">${escapar(texto)}</span><br>
        <span class="sub">${formatearFecha(m.fecha)}</span>
      </span>
      <span class="monto">${textoMonto(m.monto)}</span>
    </label>`;
}

function cuerpo(prestamo, movimientos) {
  const { tipo } = DIRECCIONES[prestamo.direccion];
  const que = tipo === 'egreso' ? 'gastos' : 'ingresos';
  if (!movimientos.length) {
    return `<p class="tenue">No hay ${que} sueltos de los últimos ${MESES_ATRAS} meses.
      Los que ya están en otro préstamo o son del negocio no salen aquí.</p>`;
  }
  return `
    <div class="pila-sm">
      <p class="tenue" style="font-size:13px">Marca los ${que} que ya registraste y que
        fueron ${prestamo.direccion === 'debo' ? 'pagos de' : 'cobros de'} este préstamo.
        No se crea nada nuevo: el movimiento se queda donde está y pasa a contar como abono.</p>
      <div class="campo"><input type="search" data-filtro placeholder="Buscar por descripción"
             autocomplete="off" aria-label="Buscar por descripción"></div>
      <div class="lista">${movimientos.map(filaCandidato).join('')}</div>
      <p class="tenue-2" data-sin-resultados hidden>Nada coincide.</p>
      <p class="form-total" data-resumen></p>
      <button class="btn btn-primario btn-bloque" type="button" data-ligar disabled>Ligar</button>
    </div>`;
}

function filtrar(hoja, texto) {
  const buscado = texto.trim().toLowerCase();
  let visibles = 0;
  hoja.querySelectorAll('[data-buscar]').forEach((fila) => {
    fila.hidden = !fila.dataset.buscar.includes(buscado);
    if (!fila.hidden) visibles += 1;
  });
  hoja.querySelector('[data-sin-resultados]').hidden = visibles > 0;
}

const elegidos = (hoja) => [...hoja.querySelectorAll('.elegible input:checked')].map((c) => c.value);

function pintarResumen(hoja, movimientos, restante) {
  const { cuantos, total, sobra } = cuentasDeEleccion(movimientos, elegidos(hoja), restante);
  hoja.querySelector('[data-resumen]').textContent = !cuantos ? ''
    : `${cuantos} elegido${cuantos === 1 ? '' : 's'} · ${textoMonto(total)}`
      + (sobra > 0 ? ` · pasa ${textoMonto(sobra)} de lo que falta` : '');
  const boton = hoja.querySelector('[data-ligar]');
  boton.disabled = !cuantos;
  boton.textContent = cuantos ? `Ligar ${cuantos} al préstamo` : 'Ligar';
}

/**
 * @param item     { prestamo, estado } de resumenPrestamos()
 * @param alCambiar () => Promise, recarga la pantalla
 */
export async function abrirLigar(contexto, { prestamo, estado }, alCambiar) {
  const { tipo } = DIRECCIONES[prestamo.direccion];
  const movimientos = await contexto.prestamos.candidatos(tipo, sumarMeses(hoyISO(), -MESES_ATRAS));
  const { hoja, cerrar } = abrirSheet({ titulo: 'Elegir movimientos', cuerpo: cuerpo(prestamo, movimientos) });
  if (!movimientos.length) return;
  hoja.querySelector('[data-filtro]').addEventListener('input', (e) => filtrar(hoja, e.target.value));
  hoja.addEventListener('change', () => pintarResumen(hoja, movimientos, estado.restante));
  hoja.querySelector('[data-ligar]').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      const ids = elegidos(hoja);
      await contexto.prestamos.ligar(ids, prestamo.id);
      aviso(ids.length === 1 ? 'Movimiento ligado.' : `${ids.length} movimientos ligados.`);
      cerrar();
      await alCambiar();
    } catch (error) { e.target.disabled = false; avisoError(error); }
  });
}

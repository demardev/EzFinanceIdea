/* El Resumen con la pastilla Negocio: solo el negocio, con su historia.
   Recibe todo calculado: aquí no se suma nada. */

import { textoMonto } from '../../ui/privacidad.js';
import { pastillasAmbito } from '../../ui/ambito.js';
import { graficaBarras, conectarBarras, barraHorizontal } from '../../ui/grafica-barras.js';
import { mesCorto, nombreDelMes, formatearFecha } from '../../calc/fechas.js';
import { plural, escapar } from '../../ui/texto.js';
import { icono } from '../../iconos/render.js';
import { botonPorConfirmar, panelNegocio } from './vista.js';
import { seccionCobro } from './vista-cobro.js';

function detalleDelMes(m) {
  return `
    <span class="titulo">${nombreDelMes(m.mes)}</span><br>
    <span class="tenue">Ganado <span class="monto pos">${textoMonto(m.ganado)}</span>
      · movido <span class="monto">${textoMonto(m.movido)}</span>
      · ${plural(m.operaciones, 'operación', 'operaciones', 'ninguna operación')}</span>`;
}

/* La forma de los últimos meses; el detalle es del mes elegido, y al
   empezar es el actual. */
function tarjetaPorMes(porMes) {
  const actual = porMes.at(-1);
  return `
    <div>
      <p class="seccion-titulo">Comisiones por mes</p>
      <div class="card pila-sm">
        ${graficaBarras({
          serie: porMes.map((m) => ({ clave: m.mes, etiqueta: mesCorto(m.mes), valor: m.ganado })),
          elegida: actual.mes,
          titulo: 'Comisiones ganadas en los últimos meses',
        })}
        <p style="font-size:13px" data-detalle-mes>${detalleDelMes(actual)}</p>
      </div>
    </div>`;
}

function filaCliente(c, max) {
  return `
    <div class="lista-fila">
      <span class="fila-cuerpo" style="cursor:default">
        <span class="crece" style="min-width:0">
          <span class="titulo truncar" style="display:block">${c.nombre === null ? 'Sin cliente' : escapar(c.nombre)}</span>
          <span class="sub">${plural(c.operaciones, 'operación', 'operaciones', 'ninguna operación')}
            · movido <span class="monto">${textoMonto(c.movido)}</span></span>
          ${barraHorizontal(c.ganado, max)}
        </span>
        <span class="monto pos">${textoMonto(c.ganado)}</span>
      </span>
    </div>`;
}

/* Quién te dejó más en el mes elegido en la gráfica. */
function contenidoClientes(lista, mes) {
  const max = Math.max(0, ...lista.map((c) => c.ganado));
  return `
    <p class="seccion-titulo">Por cliente · ${nombreDelMes(mes)}</p>
    ${lista.length ? `<div class="lista">${lista.map((c) => filaCliente(c, max)).join('')}</div>`
                   : '<p class="tenue-2">Nada ese mes.</p>'}`;
}

/* Tocarla abre la operación completa: el Resumen ya escucha data-operacion.
   Con cliente, la descripción va abajo: dos del mismo cliente se distinguen. */
function filaOperacion(p) {
  const estado = p.cobrada ? '<span class="pos">cobrada</span>'
    : `<span class="warn">faltan ${textoMonto(p.saldo)}</span>`;
  return `
    <div class="lista-fila">
      <button type="button" class="fila-cuerpo" data-operacion="${p.id}">
        <span class="icono-caja">${icono('banknote', 18)}</span>
        <span class="crece" style="min-width:0">
          <span class="titulo truncar" style="display:block">${escapar(p.cliente ?? p.descripcion ?? 'Pago de recibo')}</span>
          <span class="sub">${p.cliente && p.descripcion ? `${escapar(p.descripcion)} · ` : ''}${formatearFecha(p.fecha_pago)} · ${estado}</span>
        </span>
        <span class="monto">${textoMonto(p.total)}</span>
      </button>
    </div>`;
}

function seccionUltimas(ultimas) {
  return `
    <div>
      <p class="seccion-titulo">Últimas operaciones</p>
      ${ultimas.length ? `<div class="lista">${ultimas.map(filaOperacion).join('')}</div>`
                       : '<p class="tenue-2">Todavía no registras operaciones.</p>'}
    </div>`;
}

/** @param e { ambito, porConfirmar, negocio: { ..., porMes, clientesPorMes, ultimas } } */
export function pintarResumenNegocio(contenedor, e) {
  const actual = e.negocio.porMes.at(-1).mes;
  contenedor.innerHTML = `
    <div class="pila">
      ${pastillasAmbito(e.ambito)}
      ${e.porConfirmar ? botonPorConfirmar(e.porConfirmar) : ''}
      ${panelNegocio(e.negocio)}
      ${seccionCobro(e.negocio.tiempos, e.negocio.viejos)}
      ${tarjetaPorMes(e.negocio.porMes)}
      <div data-clientes-mes>${contenidoClientes(e.negocio.clientesPorMes[actual], actual)}</div>
      ${seccionUltimas(e.negocio.ultimas)}
    </div>`;

  const detalle = contenedor.querySelector('[data-detalle-mes]');
  const clientes = contenedor.querySelector('[data-clientes-mes]');
  conectarBarras(contenedor, (mes) => {
    detalle.innerHTML = detalleDelMes(e.negocio.porMes.find((m) => m.mes === mes));
    clientes.innerHTML = contenidoClientes(e.negocio.clientesPorMes[mes], mes);
  });
}

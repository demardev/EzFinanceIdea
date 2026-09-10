/* Pinta el Resumen. Recibe todo calculado: aquí no se suma nada. */

import { icono } from '../../iconos/render.js';
import { escapar } from '../../ui/texto.js';
import { textoMonto } from '../../ui/privacidad.js';
import { formatearFecha } from '../../calc/fechas.js';
import { tipoDe } from '../../movimientos/tipos.js';
import { pastillasAmbito } from '../../ui/ambito.js';
import { rodillo } from '../../ui/rodillo.js';

const ICONO_POR_TIPO = {
  efectivo: 'banknote', bancaria: 'banco', ahorro: 'piggy', otro: 'wallet',
};
const SIGNO = { ingreso: '+', egreso: '−', transferencia: '' };
const ICONO_VENCIMIENTO = { pago: 'card', corte: 'reloj', gasto: 'sale' };
const QUE_ES = { pago: 'pagar', corte: 'corta', gasto: 'se cobra' };
const ACENTO = { vencido: 'neg', urgente: 'warn', normal: 'tenue' };

function cuandoTexto(dias) {
  if (dias < 0) {
    const n = Math.abs(dias);
    return `venció hace ${n} ${n === 1 ? 'día' : 'días'}`;
  }
  return dias === 0 ? 'hoy' : `en ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

function filaCuenta(cuenta, saldos) {
  return `
    <div class="lista-fila">
      <span class="fila-cuerpo" style="cursor:default">
        <span class="icono-caja">${icono(ICONO_POR_TIPO[cuenta.tipo] || 'wallet', 18)}</span>
        <span class="crece truncar"><span class="titulo">${escapar(cuenta.nombre)}</span></span>
        <span class="monto">${textoMonto(saldos[cuenta.id])}</span>
      </span>
    </div>`;
}

function filaMovimiento(mov) {
  const tipo = tipoDe(mov);
  return `
    <div class="lista-fila">
      <span class="fila-cuerpo" style="cursor:default">
        <span class="icono-caja">${icono(tipo.icono, 18)}</span>
        <span class="crece truncar">
          <span class="titulo">${escapar(mov.descripcion)}</span><br>
          <span class="sub">${formatearFecha(mov.fecha)}</span>
        </span>
        <span class="monto ${tipo.acento}">${SIGNO[mov.tipo]}${textoMonto(mov.monto)}</span>
      </span>
    </div>`;
}

function filaVencimiento(v) {
  return `
    <div class="lista-fila">
      <span class="fila-cuerpo" style="cursor:default">
        <span class="icono-caja">${icono(ICONO_VENCIMIENTO[v.clase], 18)}</span>
        <span class="crece" style="min-width:0">
          <span class="titulo truncar" style="display:block">${escapar(v.nombre)}</span>
          <span class="sub"><span class="${ACENTO[v.estado]}">
            ${QUE_ES[v.clase]} ${formatearFecha(v.fecha)} · ${cuandoTexto(v.dias)}
          </span></span>
        </span>
        <span class="monto">${textoMonto(v.monto)}</span>
      </span>
    </div>`;
}

/** @param encabezado va entre el título y la lista; hoy solo las pastillas. */
function seccion(titulo, filas, vacio, encabezado = '') {
  return `
    <div>
      <p class="seccion-titulo">${titulo}</p>
      ${encabezado}
      ${filas.length ? `<div class="lista">${filas.join('')}</div>`
                     : `<p class="tenue-2">${vacio}</p>`}
    </div>`;
}

/* Del negocio no se dice "entró/salió": eso mentiría. MOVIDO es lo que pasó
   por tus manos; GANADO son las comisiones que ya cobraste. */
function panelNegocio(n) {
  return `
    <div>
      <p class="seccion-titulo">Negocio este mes</p>
      <div class="card fila-entre">
        <span><span class="cifra-etiqueta">Movido</span><br>
          <span class="monto">${textoMonto(n.movido)}</span></span>
        <span><span class="cifra-etiqueta">Ganado</span><br>
          <span class="monto pos">${textoMonto(n.ganado)}</span></span>
        <span><span class="cifra-etiqueta">Operaciones</span><br>
          <span class="monto">${n.operaciones}</span></span>
      </div>
      ${n.porCobrar.cuantos > 0 ? `
        <button class="btn btn-bloque" id="btn-por-cobrar" type="button" style="margin-top:8px">
          ${icono('reloj', 16)} Por cobrar: ${textoMonto(n.porCobrar.total)}
          <span class="badge badge-warn">${n.porCobrar.cuantos}</span>
        </button>` : ''}
    </div>`;
}

export function pintarResumen(contenedor, e) {
  contenedor.innerHTML = `
    <div class="pila">
      <div class="card">
        <p class="cifra-etiqueta">Patrimonio líquido</p>
        <p class="cifra monto">${rodillo('patrimonio', e.patrimonio)}</p>
        ${e.deuda > 0 ? `<p class="tenue" style="font-size:12.5px">
          Deuda de tarjetas: <span class="monto neg">${textoMonto(e.deuda)}</span></p>` : ''}
      </div>

      <div class="card fila-entre">
        <span><span class="cifra-etiqueta">Entró</span><br>
          <span class="monto pos">${rodillo('entro', e.totales.entro)}</span></span>
        <span><span class="cifra-etiqueta">Salió</span><br>
          <span class="monto neg">${rodillo('salio', e.totales.salio)}</span></span>
        <span><span class="cifra-etiqueta">Neto</span><br>
          <span class="monto">${rodillo('neto', e.totales.neto)}</span></span>
      </div>

      ${e.negocio ? panelNegocio(e.negocio) : ''}
      ${e.vencimientos.length
        ? seccion('Próximos vencimientos', e.vencimientos.map(filaVencimiento), '') : ''}
      ${seccion('Cuentas', e.cuentas.map((c) => filaCuenta(c, e.saldos)),
                'Todavía no hay cuentas.')}
      ${seccion('Últimos movimientos', e.ultimos.map(filaMovimiento),
                e.ambito ? 'Nada de este ámbito todavía.' : 'Aún no registras nada. Usa el botón +.',
                e.negocio ? pastillasAmbito(e.ambito) : '')}
    </div>`;
}

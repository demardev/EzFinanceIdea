/* Resumen. La vista no hace fetch ni aritmética: pide a los repos y pinta.
   Tarjetas y próximos vencimientos se agregan cuando exista esa pantalla. */

import { icono } from '../iconos/render.js';
import { textoMonto } from '../ui/privacidad.js';
import { avisoError } from '../ui/toast.js';
import { escapar } from '../ui/texto.js';
import { saldosPorCuenta, patrimonioLiquido, totalesDelMes } from '../calc/saldos.js';
import { deudaTotalDeTarjetas } from '../calc/deuda-tarjeta.js';
import { mesDe, hoyISO, formatearFecha } from '../calc/fechas.js';
import { proximosVencimientos } from '../calc/vencimientos.js';
import { tipoDe } from '../movimientos/tipos.js';

const ICONO_POR_TIPO = {
  efectivo: 'banknote', bancaria: 'banco', ahorro: 'piggy', otro: 'wallet',
};

const SIGNO = { ingreso: '+', egreso: '−', transferencia: '' };


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

const ICONO_VENCIMIENTO = { pago: 'card', corte: 'reloj', gasto: 'sale' };

const QUE_ES = { pago: 'pagar', corte: 'corta', gasto: 'se cobra' };

/** "quedan 3 días" · "vence hoy" · "venció hace 5 días" */
function cuandoTexto(dias) {
  if (dias < 0) {
    const n = Math.abs(dias);
    return `venció hace ${n} ${n === 1 ? 'día' : 'días'}`;
  }
  if (dias === 0) return 'hoy';
  return `en ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

const ACENTO = { vencido: 'neg', urgente: 'warn', normal: 'tenue' };

function filaVencimiento(v) {
  return `
    <div class="lista-fila">
      <span class="fila-cuerpo" style="cursor:default">
        <span class="icono-caja">${icono(ICONO_VENCIMIENTO[v.clase], 18)}</span>
        <span class="crece" style="min-width:0">
          <span class="titulo truncar" style="display:block">${escapar(v.nombre)}</span>
          <span class="sub">
            <span class="${ACENTO[v.estado]}">
              ${QUE_ES[v.clase]} ${formatearFecha(v.fecha)} · ${cuandoTexto(v.dias)}
            </span>
          </span>
        </span>
        <span class="monto">${textoMonto(v.monto)}</span>
      </span>
    </div>`;
}

function bloqueVencimientos(vencimientos) {
  if (!vencimientos.length) return '';
  return `
    <div>
      <p class="seccion-titulo">Próximos vencimientos</p>
      <div class="lista">${vencimientos.map(filaVencimiento).join('')}</div>
    </div>`;
}

function plantilla({ cuentas, saldos, patrimonio, totales, ultimos, vencimientos, deuda }) {
  return `
    <div class="pila">
      <div class="card">
        <p class="cifra-etiqueta">Patrimonio líquido</p>
        <p class="cifra monto">${textoMonto(patrimonio)}</p>
        ${deuda > 0 ? `<p class="tenue" style="font-size:12.5px">
          Deuda de tarjetas: <span class="monto neg">${textoMonto(deuda)}</span></p>` : ''}
      </div>

      <div class="card fila-entre">
        <span><span class="cifra-etiqueta">Entró</span><br>
          <span class="monto pos">${textoMonto(totales.entro)}</span></span>
        <span><span class="cifra-etiqueta">Salió</span><br>
          <span class="monto neg">${textoMonto(totales.salio)}</span></span>
        <span><span class="cifra-etiqueta">Neto</span><br>
          <span class="monto">${textoMonto(totales.neto)}</span></span>
      </div>

      <div>
        <p class="seccion-titulo">Cuentas</p>
        ${cuentas.length
          ? `<div class="lista">${cuentas.map((c) => filaCuenta(c, saldos)).join('')}</div>`
          : `<p class="tenue-2">Todavía no hay cuentas.</p>`}
      </div>

      ${bloqueVencimientos(vencimientos)}

      <div>
        <p class="seccion-titulo">Últimos movimientos</p>
        ${ultimos.length
          ? `<div class="lista">${ultimos.map(filaMovimiento).join('')}</div>`
          : `<p class="tenue-2">Aún no registras nada. Usa el botón +.</p>`}
      </div>
    </div>`;
}

export async function montarResumen(contenedor, contexto) {
  const { cuentas, movimientos, tarjetas, compras, planItems } = contexto;
  contenedor.innerHTML = '<p class="tenue">Cargando…</p>';
  try {
    const hoy = hoyISO();
    const [lista, todos, delMes, tjs, cmps, items] = await Promise.all([
      cuentas.listarActivas(),
      movimientos.listar(),               // el saldo real necesita todo el historial
      movimientos.listarDelMes(mesDe(hoy)),
      tarjetas.listarActivas(),
      compras.listar(),
      planItems.listarActivos(),
    ]);
    const vencimientos = proximosVencimientos(
      { tarjetas: tjs, movimientos: todos, compras: cmps, planItems: items },
      { hoy, dias: 14 });

    contenedor.innerHTML = plantilla({
      cuentas: lista,
      saldos: saldosPorCuenta(lista, todos),
      patrimonio: patrimonioLiquido(lista, todos),
      totales: totalesDelMes(delMes),
      ultimos: todos.slice(0, 5),
      vencimientos,
      deuda: deudaTotalDeTarjetas(tjs, todos, cmps),
    });
  } catch (e) {
    contenedor.innerHTML = '<p class="campo-error">No se pudo cargar.</p>';
    avisoError(e);
  }
}

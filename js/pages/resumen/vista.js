/* Pinta el Resumen. Recibe todo calculado: aquí no se suma nada. */

import { icono } from '../../iconos/render.js';
import { escapar } from '../../ui/texto.js';
import { textoMonto } from '../../ui/privacidad.js';
import { formatearFecha } from '../../calc/fechas.js';
import { tipoDe } from '../../movimientos/tipos.js';
import { pastillasAmbito } from '../../ui/ambito.js';
import { rodillo } from '../../ui/rodillo.js';
import { bloquePrestamos } from './vista-prestamos.js';
import { filaAccesos, conectarAccesos } from './vista-accesos.js';
import { marcaPrestamo } from '../movimientos/vista.js';
import { bloqueVencimientos } from './vista-vencimientos.js';

const ICONO_POR_TIPO = {
  efectivo: 'banknote', bancaria: 'banco', ahorro: 'piggy', otro: 'wallet',
};
const SIGNO = { ingreso: '+', egreso: '−', transferencia: '' };

/* Con el negocio encendido, la cuenta de efectivo abre el arqueo: es lo que
   más se repite en el día, y desde aquí son dos toques menos que por Ajustes.
   Las demás cuentas siguen sin hacer nada al tocarlas. */
function filaCuenta(cuenta, saldos, contable) {
  const cuerpo = `
    <span class="icono-caja">${icono(ICONO_POR_TIPO[cuenta.tipo] || 'wallet', 18)}</span>
    <span class="crece truncar"><span class="titulo">${escapar(cuenta.nombre)}</span></span>
    ${contable ? '<span class="badge">contar</span>' : ''}
    <span class="monto">${textoMonto(saldos[cuenta.id])}</span>`;

  const interior = contable
    ? `<button type="button" class="fila-cuerpo" data-arqueo="${cuenta.id}">${cuerpo}</button>`
    : `<span class="fila-cuerpo" style="cursor:default">${cuerpo}</span>`;
  return `<div class="lista-fila">${interior}</div>`;
}

/* Igual que en Movimientos: la fila abre el movimiento y se desliza para
   descubrir Eliminar. Los del negocio no: esos se abren como operación
   completa, porque sus movimientos nunca se editan uno por uno. */
function filaMovimiento(mov) {
  const tipo = tipoDe(mov);
  const cuerpo = `
    <span class="icono-caja">${icono(tipo.icono, 18)}</span>
    <span class="crece truncar">
      <span class="titulo">${marcaPrestamo(mov)}${escapar(mov.descripcion)}</span><br>
      <span class="sub">${formatearFecha(mov.fecha)}</span>
    </span>
    <span class="monto ${tipo.acento}">${SIGNO[mov.tipo]}${textoMonto(mov.monto)}</span>`;

  if (mov.pago_id) {
    return `
      <div class="lista-fila">
        <button type="button" class="fila-cuerpo" data-operacion="${mov.pago_id}">
          ${cuerpo}
        </button>
      </div>`;
  }
  return `
    <div class="fila-deslizable">
      <button class="borrar-deslizado" type="button" data-borrar="${mov.id}">
        ${icono('basura', 18)} Eliminar
      </button>
      <div class="lista-fila" data-desliza>
        <button type="button" class="fila-cuerpo" data-editar="${mov.id}">${cuerpo}</button>
      </div>
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
function cifrasNegocio(n) {
  return `
    <div class="fila-entre">
      <span><span class="cifra-etiqueta">Movido</span><br>
        <span class="monto">${textoMonto(n.movido)}</span></span>
      <span><span class="cifra-etiqueta">Ganado</span><br>
        <span class="monto pos">${textoMonto(n.ganado)}</span></span>
      <span><span class="cifra-etiqueta">Operaciones</span><br>
        <span class="monto">${n.operaciones}</span></span>
    </div>`;
}

/** Abierto, como pantalla del negocio (vista-negocio.js). */
export function panelNegocio(n) {
  return `
    <div>
      <p class="seccion-titulo">Negocio este mes</p>
      <div class="card">${cifrasNegocio(n)}</div>
    </div>`;
}

/* En la fila de accesos: lo ganado en el cuadrito (en verde), las tres cifras al abrirlo. */
function bloqueNegocio(n) {
  return {
    id: 'negocio', titulo: 'Negocio', tituloPanel: 'Negocio este mes', iconoNombre: 'banknote',
    sub: textoMonto(n.ganado), acento: 'pos', cuerpo: cifrasNegocio(n),
  };
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

      ${filaAccesos({
        porConfirmar: e.porConfirmar, porCobrar: e.negocio?.porCobrar, prestamos: e.prestamos,
        bloques: [e.negocio && bloqueNegocio(e.negocio), bloquePrestamos(e.prestamos),
                  bloqueVencimientos(e.vencimientos)],
      })}
      ${seccion('Cuentas',
                e.cuentas.map((c) => filaCuenta(c, e.saldos,
                  Boolean(e.negocio) && c.tipo === 'efectivo')),
                'Todavía no hay cuentas.')}
      ${seccion('Últimos movimientos', e.ultimos.map(filaMovimiento),
                e.ambito ? 'Nada de este ámbito todavía.' : 'Aún no registras nada. Usa el botón +.',
                e.negocio ? pastillasAmbito(e.ambito) : '')}
    </div>`;
  conectarAccesos(contenedor);
}

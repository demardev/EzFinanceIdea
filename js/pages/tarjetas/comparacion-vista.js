/* Cómo se ve la comparación de un estado de cuenta con tus movimientos
   (calc/emparejar-estado.js). Solo pinta: las cifras vienen hechas.
   Los arreglos van aparte (arreglos-vista.js). */

import { escapar } from '../../ui/texto.js';
import { textoMonto } from '../../ui/privacidad.js';
import { formatearFecha } from '../../calc/fechas.js';
import { icono } from '../../iconos/render.js';
import { desplegable } from '../../ui/desplegable.js';

const fecha = (iso) => (iso ? formatearFecha(iso) : 'sin fecha');
const firmado = (p) => (p.sentido === 'credito' ? -p.monto : p.monto);
const montoDeMov = (m) => (m.tipo === 'egreso' ? m.monto : -m.monto);

function fila(titulo, sub, monto) {
  return `
    <div class="lista-fila"><span class="fila-cuerpo" style="cursor:default">
      <span class="crece" style="min-width:0;overflow-wrap:anywhere"><span class="titulo">${titulo}</span><br>
        <span class="sub">${sub}</span></span>
      <span class="monto ${monto < 0 ? 'pos' : 'neg'}">${textoMonto(-monto, { signo: true })}</span>
    </span></div>`;
}

const filaFalta = ({ linea }) => fila(escapar(linea.concepto), fecha(linea.fecha), firmado(linea));

function filaSobra({ movimiento, deTraslado }) {
  if (movimiento.saldoInicial) return fila('Saldo pendiente al empezar', fecha(movimiento.fecha), movimiento.monto);
  const sub = deTraslado ? `${fecha(movimiento.fecha)} · crédito de minicuotas` : fecha(movimiento.fecha);
  return fila(escapar(movimiento.descripcion), sub,
              deTraslado ? -movimiento.monto : montoDeMov(movimiento));
}

const POR_QUE = {
  monto: ({ linea, movimiento }) => `El banco: ${textoMonto(linea.monto)} · la app: ${textoMonto(movimiento.monto)}`,
  fecha: ({ linea, movimiento }) => `El banco: ${fecha(linea.fecha)} · la app: ${fecha(movimiento.fecha)}`,
  cuota: ({ movimiento }) => `La app la cobra el ${fecha(movimiento.fecha)}, en otro corte`,
};

const filaDistinta = (d) => fila(escapar(d.linea.concepto), POR_QUE[d.motivo](d), firmado(d.linea));

/* Una línea que coincide junto con otras: el banco partió un pago en dos
   líneas, o tú lo registraste en dos movimientos. */
function subIgual({ linea, movimiento, agrupado }) {
  if (!agrupado) return fecha(linea.fecha);
  const como = linea.monto < movimiento.monto
    ? `en la app es un solo movimiento de ${textoMonto(movimiento.monto)}`
    : 'en la app está partido en varios movimientos';
  return `${fecha(linea.fecha)} · coincide junto con otras: ${como}`;
}

function grupo(id, titulo, sub, items, pintar) {
  if (!items.length) return '';
  return desplegable({ id, titulo: `${titulo} (${items.length})`, sub,
                       cuerpo: `<div class="lista">${items.map(pintar).join('')}</div>` });
}

const compras = (n) => (n === 1 ? '1 compra' : `${n} compras`);

function veredicto(r) {
  const hayDiferencias = r.faltan.length + r.sobran.length + r.distintos.length > 0;
  const soloDelSiguiente = !hayDiferencias && r.arrastre === 0 && r.sinExplicar === 0
    && r.diferencia !== 0 && r.diferencia === r.totalDelSiguiente;
  if (soloDelSiguiente) {
    return `<p class="pos" style="font-size:13px">${icono('check', 13)} Tu app está bien.</p>
      <p class="tenue" style="font-size:12.5px">La diferencia es solo de ${compras(r.delSiguiente.length)}
      que hiciste en los últimos días del corte y que el banco aplicó después: van a salir en tu
      próximo estado de cuenta.</p>`;
  }
  if (r.diferencia === 0 && !hayDiferencias) {
    return `<p class="pos" style="font-size:13px">${icono('check', 13)} La app cuadra con el banco
      y cada línea coincide.</p>`;
  }
  if (r.diferencia === 0) {
    return `<p class="pos" style="font-size:13px">${icono('check', 13)} En total la app cuadra con
      el banco.</p><p class="tenue" style="font-size:12.5px">Pero hay líneas que no coinciden una a
      una y se compensan entre sí: revísalas abajo, puede ser lo mismo registrado de otra forma.</p>`;
  }
  return `<p class="tenue" style="font-size:13px">${r.sinExplicar === 0
    ? 'Las diferencias de abajo la explican completa.'
    : `Quedan ${textoMonto(r.sinExplicar)} que las diferencias de abajo no explican.`}</p>`;
}

function cabecera(r) {
  const cuadra = r.diferencia === 0;
  return `
    <div class="card card-plana pila-sm">
      <p style="font-weight:550">Al corte del ${formatearFecha(r.periodo.hasta)}</p>
      <p class="tenue" style="font-size:13px">La app dice ${textoMonto(r.saldoApp)} y el banco
        ${textoMonto(r.saldoBanco)}${cuadra ? '.' : `: diferencia de ${textoMonto(r.diferencia, { signo: true })}.`}</p>
      ${veredicto(r)}
      ${r.arrastre !== 0 ? `<p class="warn" style="font-size:12.5px">${icono('alerta', 13)}
        La app ya no cuadraba en el corte anterior (${textoMonto(r.arrastre, { signo: true })}).
        Compara también ese estado de cuenta.</p>` : ''}
    </div>`;
}

/** @param r de emparejarEstado() */
export function pintarComparacion(r) {
  return `
    ${cabecera(r)}
    ${grupo('faltan', 'Faltan en la app', 'Están en el estado de cuenta y no en tus movimientos.',
            r.faltan, filaFalta)}
    ${grupo('distintos', 'Distintos', 'Están en los dos, pero con otro monto, fecha o cuota.',
            r.distintos, filaDistinta)}
    ${grupo('siguiente', 'Del corte siguiente en el banco',
            'Ya los tienes y están bien. Los hiciste en los últimos días del corte, pero el banco '
            + 'los aplicó después: saldrán en tu próximo estado de cuenta.', r.delSiguiente, filaSobra)}
    ${grupo('sobran', 'Sobran en la app',
            'Están en tus movimientos de este corte y no en el estado de cuenta: revisa si se '
            + 'registraron dos veces, si son de otra tarjeta o si tienen otra fecha.', r.sobran, filaSobra)}
    ${grupo('iguales', 'Iguales', 'Coinciden en monto y fecha.', r.emparejados,
            (e) => fila(escapar(e.linea.concepto), subIgual(e), firmado(e.linea)))}
    <p class="tenue-2" style="font-size:12px">Cada monto es lo que esa línea pesa en tu deuda:
      en rojo la sube, en verde la baja.</p>`;
}

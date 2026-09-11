/* Pinta el planificador. No hace aritmética: recibe todo calculado y lo
   redacta en español llano. */

import { icono } from '../../iconos/render.js';
import { escapar } from '../../ui/texto.js';
import { textoMonto } from '../../ui/privacidad.js';
import { formatearFecha } from '../../calc/fechas.js';
import { graficaSaldo, piesDeGrafica } from '../../ui/grafica.js';
import { bloqueSobres } from './sobres.js';

const TITULO = { alcanza: 'Alcanza', justo: 'Justo', 'no-alcanza': 'No alcanza' };

function frase(v) {
  if (v.nivel === 'no-alcanza' && v.primerFaltante) {
    const f = v.primerFaltante;
    return `Lo primero que se cae es ${escapar(f.nombre)} el ${formatearFecha(f.fecha)}. `
         + `En total te faltan ${textoMonto(v.faltanteTotal)} en el horizonte.`;
  }
  if (v.nivel === 'no-alcanza') {
    return `Los pagos con fecha sí los cubres, pero el colchón de gastos variables no cabe: `
         + `te quedas ${textoMonto(Math.abs(v.libreBase))} corto para el mes.`;
  }
  if (v.nivel === 'justo') {
    return v.apretadoEnPesimista
      ? `Sale con los gastos variables en su mínimo, pero si se van al máximo te quedas corto.`
      : `Cubres todo, pero no te sobra nada: quedas en ${textoMonto(v.libreBase)}.`;
  }
  return `Cubres todo lo del horizonte y te quedan ${textoMonto(v.libreBase)} libres.`;
}

function veredicto(v) {
  return `
    <div class="veredicto ${v.nivel}">
      <h2>${TITULO[v.nivel]}</h2>
      <p class="tenue">${frase(v)}</p>
    </div>`;
}

function alerta(texto, clase = '') {
  return `<div class="alerta ${clase}">${icono('alerta', 16)}<span>${texto}</span></div>`;
}

function alertas(v, nombres) {
  const filas = v.faltantes.map((f) =>
    alerta(`<strong>${escapar(f.nombre)}</strong> vence el ${formatearFecha(f.fecha)} y no hay `
         + `con qué cubrirlo: te faltan ${textoMonto(f.monto)}.`));

  const movidas = v.transferencias.map((t) =>
    alerta(`Mueve ${textoMonto(t.monto)} de <strong>${escapar(nombres[t.desde] ?? t.desde)}</strong> `
         + `a <strong>${escapar(nombres[t.hacia] ?? t.hacia)}</strong> antes del `
         + `${formatearFecha(t.antesDe)}.`, 'warn'));

  return [...filas, ...movidas].join('');
}

function rango(v) {
  if (v.libreBase === v.librePesimista) return '';
  return `
    <p class="tenue" style="font-size:13px">
      Si los gastos variables se van al máximo, te quedan
      ${textoMonto(v.librePesimista)} en vez de ${textoMonto(v.libreBase)}.
    </p>`;
}

/* Si el punto más bajo es hoy, "el día más ajustado es hoy" no dice nada: lo
   que importa es que el saldo nunca baja de ahí. */
function fraseAjustado(d, serie) {
  if (!d) return '';
  if (d.fecha === serie[0]?.fecha && d.total >= 0) {
    return `Tu saldo no baja de lo que tienes hoy en todo el horizonte.`;
  }
  return `El día más ajustado es el ${formatearFecha(d.fecha)}, con ${textoMonto(d.total)}.`;
}

function bloqueGrafica(base) {
  const d = base.diaMasAjustado;
  return `
    <div class="card">
      <p class="seccion-titulo" style="margin-bottom:10px">Saldo día a día</p>
      ${graficaSaldo(base.serie, d)}
      ${piesDeGrafica(base.serie)}
      ${d ? `<p class="tenue-2" style="font-size:12.5px;margin-top:6px">
        ${fraseAjustado(d, base.serie)}</p>` : ''}
    </div>`;
}

/* "Horizonte" no dice nada por sí solo: al lado va hasta qué día mira el
   plan, que es lo que de verdad cambia el resultado. */
function barraHorizonte({ horizonte, horizontes, hasta }) {
  const opciones = horizontes.map(([clave, etiqueta]) =>
    `<option value="${clave}" ${clave === horizonte ? 'selected' : ''}>${etiqueta}</option>`).join('');
  return `
    <div>
      <div class="seccion-barra" style="margin-bottom:2px">
        <span class="seccion-titulo" style="margin:0">Horizonte</span>
        <select id="sel-horizonte" class="enlace-accion activo"
                style="border:none;background:none">${opciones}</select>
      </div>
      <p class="tenue-2" style="font-size:12.5px">
        Hasta dónde mira el plan: cuenta solo los ingresos y pagos que caen
        de hoy al ${formatearFecha(hasta)}.
      </p>
    </div>`;
}

function sinDatos() {
  return `
    <div class="vacio">
      <span class="icono-caja">${icono('plan', 22)}</span>
      <p>Todavía no hay nada que planear.</p>
      <p class="tenue-2" style="font-size:12.5px">
        El plan trabaja con tus ingresos y tus gastos fijos: agrégalos en
        Ajustes → Fijos y variables. Con eso te dice si te alcanza hasta la
        fecha del horizonte.
      </p>
    </div>`;
}

/* Sin gastos variables el veredicto asume que no comes ni te mueves: hay que
   decirlo junto al veredicto, no enterrado en Ajustes. */
function avisoSinVariables() {
  return alerta('No tienes gastos variables: este plan asume que no gastas nada en '
    + 'comida, gasolina ni salidas. Agrégalos en Ajustes → Fijos y variables para '
    + 'que el veredicto sea real.', 'warn');
}

/* Decir qué ingresos no se cuentan: si no, un ingreso que desaparece del plan
   parece un error. */
function notaSinFecha(nombres) {
  if (!nombres.length) return '';
  return `<p class="tenue-2" style="font-size:12.5px">No cuento
    ${nombres.map(escapar).join(', ')}: los ingresos variables sin día fijo entran al
    plan cuando los registras como movimiento.</p>`;
}

export function pintarPlan(contenedor, {
  v, base, nombres, horizonte, horizontes, hasta, sinVariables = false, sinFecha = [],
}) {
  if (v.nivel === 'vacio') {
    contenedor.innerHTML = `
      <div class="pila">${barraHorizonte({ horizonte, horizontes, hasta })}${sinDatos()}</div>`;
    return;
  }

  contenedor.innerHTML = `
    <div class="pila">
      ${barraHorizonte({ horizonte, horizontes, hasta })}
      ${veredicto(v)}
      ${sinVariables ? avisoSinVariables() : ''}
      ${alertas(v, nombres)}
      ${notaSinFecha(sinFecha)}
      ${rango(v)}
      ${bloqueSobres(base.sobres)}
      ${bloqueGrafica(base)}
    </div>`;
}

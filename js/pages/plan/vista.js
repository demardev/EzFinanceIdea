/* Pinta el planificador. No hace aritmética: recibe todo calculado y lo
   redacta en español llano. */

import { icono } from '../../iconos/render.js';
import { escapar } from '../../ui/texto.js';
import { textoMonto } from '../../ui/privacidad.js';
import { formatearFecha } from '../../calc/fechas.js';
import { graficaSaldo, piesDeGrafica } from '../../ui/grafica.js';

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

function lineaSobre(a) {
  return `
    <div class="sobre-linea">
      <span class="crece truncar">${escapar(a.nombre)}
        <span class="tenue-2">· vence ${formatearFecha(a.fecha)}</span></span>
      <span class="monto neg">${textoMonto(a.monto)}</span>
    </div>`;
}

function sobre(s) {
  return `
    <div class="sobre">
      <div class="sobre-cabeza">
        <span class="crece truncar">
          <span class="titulo">${escapar(s.nombre)}</span>
          <span class="tenue-2">· ${formatearFecha(s.fecha)}</span>
        </span>
        <span class="monto pos">${textoMonto(s.monto)}</span>
      </div>
      ${s.asignaciones.map(lineaSobre).join('')}
      ${s.colchon > 0 ? `
        <div class="sobre-linea">
          <span class="crece truncar">Colchón de gastos variables</span>
          <span class="monto tenue">${textoMonto(s.colchon)}</span>
        </div>` : ''}
      <div class="sobre-pie">
        <span>Libre</span>
        <span class="monto ${s.libre < 0 ? 'neg' : 'pos'}">${textoMonto(s.libre)}</span>
      </div>
    </div>`;
}

function rango(v) {
  if (v.libreBase === v.librePesimista) return '';
  return `
    <p class="tenue" style="font-size:13px">
      Si los gastos variables se van al máximo, te quedan
      ${textoMonto(v.librePesimista)} en vez de ${textoMonto(v.libreBase)}.
    </p>`;
}

function bloqueGrafica(base) {
  const d = base.diaMasAjustado;
  return `
    <div class="card">
      <p class="seccion-titulo" style="margin-bottom:10px">Saldo día a día</p>
      ${graficaSaldo(base.serie, d)}
      ${piesDeGrafica(base.serie)}
      ${d ? `<p class="tenue-2" style="font-size:12.5px;margin-top:6px">
        El día más ajustado es el ${formatearFecha(d.fecha)}, con ${textoMonto(d.total)}.
      </p>` : ''}
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

export function pintarPlan(contenedor, { v, base, nombres, horizonte, horizontes, hasta }) {
  if (v.nivel === 'vacio') {
    contenedor.innerHTML = `
      <div class="pila">${barraHorizonte({ horizonte, horizontes, hasta })}${sinDatos()}</div>`;
    return;
  }

  contenedor.innerHTML = `
    <div class="pila">
      ${barraHorizonte({ horizonte, horizontes, hasta })}
      ${veredicto(v)}
      ${alertas(v, nombres)}
      ${rango(v)}
      ${base.sobres.length ? `
        <div>
          <p class="seccion-titulo">Sobres por ingreso</p>
          <div class="pila-sm">${base.sobres.map(sobre).join('')}</div>
        </div>` : `<p class="tenue">No hay ingresos ni obligaciones en este horizonte.</p>`}
      ${bloqueGrafica(base)}
    </div>`;
}

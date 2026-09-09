/* Estado de los filtros y el sheet para editarlos. Los filtros distintos del
   mes se aplican en memoria sobre las filas del mes (a escala personal son
   decenas, y así la búsqueda responde mientras se escribe). */

import { abrirSheet } from '../../ui/sheet.js';
import { campoTexto, campoSelect, datosDe } from '../../ui/campos.js';
import { mesDe, hoyISO, sumarMeses, nombreDelMes } from '../../calc/fechas.js';
import { TIPOS, CLAVES_TIPO } from '../../movimientos/tipos.js';
import { escapar } from '../../ui/texto.js';

export function filtrosVacios() {
  return { mes: mesDe(hoyISO()), tipo: '', cuenta: '', categoria: '', texto: '', ambito: '' };
}

export const AMBITOS = [['', 'Todo'], ['personal', 'Personal'], ['negocio', 'Negocio']];

/** Cuántos filtros activos hay, sin contar el mes (que siempre está puesto). */
export function cuantosActivos(f) {
  return ['tipo', 'cuenta', 'categoria', 'texto', 'ambito'].filter((k) => f[k]).length;
}

function tocaCuenta(mov, id) {
  return [mov.cuenta_id, mov.cuenta_destino_id, mov.tarjeta_id, mov.tarjeta_destino_id]
    .includes(id);
}

function coincideTexto(mov, texto) {
  const aguja = texto.trim().toLowerCase();
  if (!aguja) return true;
  return [mov.descripcion, mov.comercio, mov.nota]
    .some((campo) => String(campo || '').toLowerCase().includes(aguja));
}

export function aplicar(movimientos, f) {
  return movimientos.filter((m) =>
    (!f.ambito || (m.ambito ?? 'personal') === f.ambito) &&
    (!f.tipo || m.tipo === f.tipo) &&
    (!f.cuenta || tocaCuenta(m, f.cuenta)) &&
    (!f.categoria || m.categoria_id === f.categoria) &&
    coincideTexto(m, f.texto));
}

/** Doce meses hacia atrás desde el actual, más el que esté seleccionado. */
function mesesOfrecidos(actual) {
  const hoy = mesDe(hoyISO());
  const lista = [];
  for (let i = 0; i < 12; i++) lista.push(mesDe(sumarMeses(`${hoy}-01`, -i)));
  if (!lista.includes(actual)) lista.unshift(actual);
  return lista.map((m) => [m, nombreDelMes(m)]);
}

/* Si el tipo está en "Todos" se ofrecen todas las categorías; si hay un tipo
   elegido, solo las de ese tipo. Una categoría pertenece a un solo tipo, así
   que ofrecer las demás sería ofrecer un filtro que nunca da resultados. */
function opcionesCategoria(categorias, tipo) {
  const lista = tipo ? categorias.filter((c) => c.tipo === tipo) : categorias;
  return [['', 'Todas'], ...lista.map((c) => [c.id, c.nombre])];
}

/** Repinta el select de categorías cuando cambia el tipo, conservando la
    selección si sigue siendo válida. */
function encadenarTipoYCategoria(hoja, categorias) {
  const selTipo = hoja.querySelector('[name="tipo"]');
  const selCategoria = hoja.querySelector('[name="categoria"]');

  selTipo.addEventListener('change', () => {
    const elegida = selCategoria.value;
    const opciones = opcionesCategoria(categorias, selTipo.value);
    selCategoria.innerHTML = opciones
      .map(([v, t]) => `<option value="${escapar(v)}">${escapar(t)}</option>`).join('');
    selCategoria.value = opciones.some(([v]) => v === elegida) ? elegida : '';
  });
}

function campos(filtros, datos) {
  const cuentasYTarjetas = [
    ...datos.cuentas.map((c) => [c.id, c.nombre]),
    ...datos.tarjetas.map((t) => [t.id, `${t.nombre} (tarjeta)`]),
  ];
  return `
      <form id="form-filtros">
        ${campoSelect({ nombre: 'mes', etiqueta: 'Mes', valor: filtros.mes,
                        opciones: mesesOfrecidos(filtros.mes) })}
        ${datos.negocio ? campoSelect({ nombre: 'ambito', etiqueta: 'Ámbito',
                        valor: filtros.ambito, opciones: AMBITOS }) : ''}
        ${campoSelect({ nombre: 'tipo', etiqueta: 'Tipo', valor: filtros.tipo,
                        opciones: [['', 'Todos'], ...CLAVES_TIPO.map((k) => [k, TIPOS[k].etiqueta])] })}
        ${campoSelect({ nombre: 'cuenta', etiqueta: 'Cuenta o tarjeta', valor: filtros.cuenta,
                        opciones: [['', 'Todas'], ...cuentasYTarjetas] })}
        ${campoSelect({ nombre: 'categoria', etiqueta: 'Categoría', valor: filtros.categoria,
                        opciones: opcionesCategoria(datos.categorias, filtros.tipo) })}
        ${campoTexto({ nombre: 'texto', etiqueta: 'Buscar', valor: filtros.texto, requerido: false,
                       ayuda: 'En la descripción, el comercio y la nota.' })}
        <div class="pila-sm" style="margin-top:16px">
          <button class="btn btn-primario btn-bloque" type="submit">Aplicar</button>
          <button class="btn btn-bloque" type="button" id="btn-limpiar">Limpiar filtros</button>
        </div>
      </form>`;
}

export function abrirSheetFiltros(filtros, datos, alAplicar) {
  const { hoja, cerrar } = abrirSheet({
    titulo: 'Filtros',
    cuerpo: campos(filtros, datos),
  });

  encadenarTipoYCategoria(hoja, datos.categorias);

  const form = hoja.querySelector('#form-filtros');
  form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    alAplicar({ ...filtrosVacios(), ...datosDe(form) });
    cerrar();
  });
  hoja.querySelector('#btn-limpiar').addEventListener('click', () => {
    alAplicar({ ...filtrosVacios(), mes: filtros.mes });
    cerrar();
  });
}

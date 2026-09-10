/* EL MAPA. Cada tipo de movimiento define sus campos, su validación y cómo
   se convierte a fila de la base. Agregar un tipo es agregar una entrada
   aquí: ni el formulario ni la lista se tocan.

   Los campos mixtos ('origenMixto' / 'destinoMixto') guardan el valor como
   "cuenta:<id>" o "tarjeta:<id>"; separar() lo desarma al mapear a la fila. */

import { redondear } from '../calc/dinero.js';
import { deltaEnCuenta } from '../calc/saldos.js';
import { separarDestino as separar, unirDestino as unir } from '../ui/campos.js';

const MONTO       = { clase: 'monto',  nombre: 'monto',       etiqueta: 'Monto' };
const FECHA       = { clase: 'fecha',  nombre: 'fecha',       etiqueta: 'Fecha' };
const DESCRIPCION = { clase: 'texto',  nombre: 'descripcion', etiqueta: 'Descripción' };
const CATEGORIA   = { clase: 'categoria', nombre: 'categoria_id', etiqueta: 'Categoría' };
const NOTA        = { clase: 'nota',   nombre: 'nota',        etiqueta: 'Nota', opcional: true };

/** Lo común a los tres: monto positivo, fecha y descripción. */
function validarBase(datos) {
  if (!(Number(datos.monto) > 0)) return 'El monto tiene que ser mayor que cero.';
  if (!datos.fecha) return 'Falta la fecha.';
  if (!String(datos.descripcion || '').trim()) return 'Ponle una descripción.';
  if (!datos.categoria_id) return 'Elige una categoría.';
  return null;
}

/* Al editar se hace PATCH: si un tipo no limpia las columnas de ruteo que no
   usa, quedarían las del tipo anterior y Postgres rechazaría la fila por el
   check `mov_origen_valido`. Por eso cada aFila() parte de esto. */
const SIN_RUTEO = {
  cuenta_id: null, cuenta_destino_id: null, tarjeta_id: null, tarjeta_destino_id: null,
};

function comunes(datos) {
  return {
    monto: redondear(datos.monto),
    fecha: datos.fecha,
    descripcion: datos.descripcion.trim(),
    categoria_id: datos.categoria_id || null,
    nota: String(datos.nota || '').trim() || null,
  };
}

export const TIPOS = {
  ingreso: {
    etiqueta: 'Ingreso',
    icono: 'entra',
    acento: 'pos',
    campos: [[MONTO, FECHA], DESCRIPCION, CATEGORIA,
      { clase: 'cuenta', nombre: 'cuenta_id', etiqueta: 'Entra a' }, NOTA],
    validar(datos) {
      return validarBase(datos) || (datos.cuenta_id ? null : 'Elige a qué cuenta entra.');
    },
    aFila(datos) {
      return { tipo: 'ingreso', ...comunes(datos), ...SIN_RUTEO, cuenta_id: datos.cuenta_id };
    },
    aFormulario(mov) {
      return { cuenta_id: mov.cuenta_id ?? '' };
    },
  },

  egreso: {
    etiqueta: 'Egreso',
    icono: 'sale',
    acento: 'neg',
    campos: [[MONTO, FECHA], DESCRIPCION, CATEGORIA,
      { clase: 'origenMixto', nombre: 'origen', etiqueta: 'Sale de' }, NOTA],
    validar(datos) {
      return validarBase(datos) || (separar(datos.origen).id ? null : 'Elige de dónde sale.');
    },
    aFila(datos) {
      const origen = separar(datos.origen);
      return {
        tipo: 'egreso', ...comunes(datos), ...SIN_RUTEO,
        cuenta_id:  origen.clase === 'cuenta'  ? origen.id : null,
        tarjeta_id: origen.clase === 'tarjeta' ? origen.id : null,
      };
    },
    aFormulario(mov) {
      return { origen: unir(mov, 'cuenta_id', 'tarjeta_id') };
    },
  },

  transferencia: {
    etiqueta: 'Transferencia',
    icono: 'arrows',
    acento: 'tenue',
    campos: [[MONTO, FECHA], DESCRIPCION, CATEGORIA,
      { clase: 'cuenta', nombre: 'cuenta_id', etiqueta: 'Sale de' },
      { clase: 'destinoMixto', nombre: 'destino', etiqueta: 'Entra a' }, NOTA],
    validar(datos) {
      const base = validarBase(datos);
      if (base) return base;
      if (!datos.cuenta_id) return 'Elige la cuenta de origen.';
      const destino = separar(datos.destino);
      if (!destino.id) return 'Elige el destino.';
      if (destino.clase === 'cuenta' && destino.id === datos.cuenta_id) {
        return 'El origen y el destino no pueden ser la misma cuenta.';
      }
      return null;
    },
    aFila(datos) {
      const destino = separar(datos.destino);
      return {
        tipo: 'transferencia', ...comunes(datos), ...SIN_RUTEO,
        cuenta_id: datos.cuenta_id,
        cuenta_destino_id:  destino.clase === 'cuenta'  ? destino.id : null,
        tarjeta_destino_id: destino.clase === 'tarjeta' ? destino.id : null,
      };
    },
    aFormulario(mov) {
      return {
        cuenta_id: mov.cuenta_id ?? '',
        destino: unir(mov, 'cuenta_destino_id', 'tarjeta_destino_id'),
      };
    },
  },
};

export const CLAVES_TIPO = Object.keys(TIPOS);

export function tipoDe(mov) {
  return TIPOS[mov.tipo] ?? TIPOS.egreso;
}

/** Reexportado para que las vistas no tengan que conocer calc/saldos.js. */
export { deltaEnCuenta };

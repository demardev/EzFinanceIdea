/* Exportar e importar todo en JSON. Es el respaldo manual, aparte del que
   Supabase le hace al Postgres.

   El orden de las tablas importa: primero las que otras referencian. */

const TABLAS = ['cuentas', 'categorias', 'tarjetas', 'compras_cuotas',
                'movimientos', 'plan_items'];

/* user_id se quita a propósito: al importar lo pone la base con auth.uid(),
   así el respaldo se puede restaurar en otra cuenta. */
function limpiar(fila) {
  const { user_id, ...resto } = fila;
  return resto;
}

export async function exportarTodo(cliente) {
  const listas = await Promise.all(
    TABLAS.map((t) => cliente.seleccionar(t, { order: 'created_at.asc' })));

  const tablas = {};
  TABLAS.forEach((t, i) => { tablas[t] = listas[i].map(limpiar); });

  return {
    app: 'finanzas',
    version: 1,
    exportado: new Date().toISOString(),
    tablas,
  };
}

export function contarFilas(respaldo) {
  return TABLAS.reduce((n, t) => n + (respaldo.tablas?.[t]?.length ?? 0), 0);
}

/** Valida la forma antes de tocar la base. Lanza si no cuadra. */
export function revisarRespaldo(texto) {
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch {
    throw new Error('Eso no es un JSON válido.');
  }
  if (datos?.app !== 'finanzas' || !datos.tablas) {
    throw new Error('El archivo no es un respaldo de esta app.');
  }
  const desconocidas = Object.keys(datos.tablas).filter((t) => !TABLAS.includes(t));
  if (desconocidas.length) {
    throw new Error(`El respaldo trae tablas que no reconozco: ${desconocidas.join(', ')}.`);
  }
  return datos;
}

/**
 * Inserta con upsert por id: reimportar el mismo respaldo no duplica nada y
 * las filas que ya existían se actualizan.
 */
export async function importarTodo(cliente, respaldo) {
  let insertadas = 0;
  for (const tabla of TABLAS) {
    const filas = (respaldo.tablas[tabla] ?? []).map(limpiar);
    if (!filas.length) continue;
    await cliente.insertar(tabla, filas, { fusionar: true });
    insertadas += filas.length;
  }
  return insertadas;
}

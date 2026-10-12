/* La bandeja de "Por confirmar", lo aprendido de las tarjetas de Wallet y la
   clave del atajo. Mismo contrato que los demás repos para la bandeja; lo
   otro son unas pocas consultas propias. */

import { crearRepo } from './base.js';

/** Lo aprendido: { 'nombre en Wallet': 'tarjeta:<id>' }. */
function origenesDeWallet(cliente) {
  async function origenes() {
    const filas = await cliente.seleccionar('wallet_origenes', { order: 'nombre.asc' });
    return Object.fromEntries(filas.map((f) => [f.nombre, f.origen]));
  }

  /* Upsert por (user_id, nombre): si cambias de tarjeta, gana la última. */
  function recordarOrigen(userId, nombre, origen) {
    return cliente.insertar('wallet_origenes', [{ user_id: userId, nombre, origen }],
                            { fusionar: true });
  }

  function olvidarOrigen(nombre) {
    return cliente.eliminar('wallet_origenes', { nombre: `eq.${nombre}` });
  }

  return { origenes, recordarOrigen, olvidarOrigen };
}

/* En un ILIKE, % y _ son comodines: un comercio que los traiga se busca tal
   cual. (El * lo convierte PostgREST en comodín y no se puede escapar: en el
   peor caso "GOOGLE *G1SK" encuentra también "GOOGLE xG1SK", que da igual.) */
const literal = (texto) => texto.replace(/[\\%_]/g, '\\$&');

/** Qué categoría lleva cada comercio: lo confirmado y lo del historial. */
function categoriasDeComercios(cliente) {
  /** { claveDeComercio: categoria_id }. Sin la tabla (falta el SQL), nada. */
  async function aprendidas() {
    try {
      const filas = await cliente.seleccionar('comercio_categorias');
      return Object.fromEntries(filas.map((f) => [f.comercio, f.categoria_id]));
    } catch (error) {
      if (error?.estado === 404) return {};
      throw error;
    }
  }

  function recordarCategoria(userId, comercio, categoriaId) {
    return cliente.insertar('comercio_categorias',
      [{ user_id: userId, comercio, categoria_id: categoriaId }], { fusionar: true });
  }

  /* La categoría del último egreso con esa misma descripción. Una consulta
     por comercio: en la bandeja hay pocos y así cada una trae una sola fila. */
  async function ultimaDelHistorial(comercio) {
    const filas = await cliente.seleccionar('movimientos', {
      select: 'categoria_id', tipo: 'eq.egreso', categoria_id: 'not.is.null',
      descripcion: `ilike.${literal(comercio.trim())}`,
      order: 'fecha.desc,created_at.desc', limit: '1',
    });
    return filas?.[0]?.categoria_id ?? null;
  }

  /** @param comercios [[clave, texto tal como llegó]] -> { clave: categoria_id } */
  async function delHistorial(comercios) {
    const pares = await Promise.all(comercios.map(
      async ([clave, texto]) => [clave, await ultimaDelHistorial(texto)]));
    return Object.fromEntries(pares.filter(([, id]) => id));
  }

  return { aprendidas, recordarCategoria, delHistorial };
}

/** La clave del atajo. Solo se sabe cuándo se generó: la clave en sí no se lee. */
function claveDelAtajo(cliente) {
  async function fechaDeClave() {
    const filas = await cliente.seleccionar('claves_entrada', { select: 'created_at' });
    return filas?.[0]?.created_at ?? null;
  }

  /** La genera (o la cambia) y la devuelve esta única vez. */
  function nuevaClave() {
    return cliente.rpc('nueva_clave_entrada');
  }

  function quitarClave(userId) {
    return cliente.eliminar('claves_entrada', { user_id: `eq.${userId}` });
  }

  return { fechaDeClave, nuevaClave, quitarClave };
}

export function repoBandeja(cliente) {
  const base = crearRepo(cliente, 'bandeja', { orden: 'created_at.asc' });

  /* 404 = todavía no se corrió sql/03_bandeja.sql. El Resumen no se rompe
     por eso: simplemente no hay nada por confirmar. */
  async function pendientes() {
    try {
      return await base.listar();
    } catch (error) {
      if (error?.estado === 404) return [];
      throw error;
    }
  }

  return { ...base, pendientes, ...origenesDeWallet(cliente), ...claveDelAtajo(cliente),
           ...categoriasDeComercios(cliente) };
}

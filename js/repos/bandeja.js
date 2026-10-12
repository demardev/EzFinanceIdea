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

  return { ...base, pendientes, ...origenesDeWallet(cliente), ...claveDelAtajo(cliente) };
}

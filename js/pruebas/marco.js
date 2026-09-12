/* Arnés de pruebas mínimo: sin frameworks, sin npm. Lo usa test.html. */

const grupos = [];

export function describir(nombre, cuerpo) {
  const casos = [];
  cuerpo((titulo, fn) => casos.push({ titulo, fn }));
  grupos.push({ nombre, casos });
}

export function igual(recibido, esperado, nota = '') {
  const a = JSON.stringify(recibido), b = JSON.stringify(esperado);
  if (a !== b) throw new Error(`${nota} esperaba ${b}, recibió ${a}`);
}

export function cierto(condicion, nota = '') {
  if (!condicion) throw new Error(nota || 'se esperaba verdadero');
}

/* Se espera cada caso: los hay async —los repos devuelven promesas— y si no
   se esperaran, pasarían siempre sin haberse ejecutado. `await` sobre una
   función normal no cambia nada. */
/** Corre todo y pinta la lista de pasa/falla en el contenedor dado. */
export async function correr(contenedor) {
  let pasan = 0, fallan = 0;
  const partes = [];
  for (const { nombre, casos } of grupos) {
    const filas = [];
    for (const { titulo, fn } of casos) {
      try { await fn(); pasan++; filas.push(`<li class="ok">✓ ${titulo}</li>`); }
      catch (e) {
        fallan++;
        filas.push(`<li class="mal">✗ ${titulo}<br><small>${e.message}</small></li>`);
      }
    }
    partes.push(`<section><h2>${nombre}</h2><ul>${filas.join('')}</ul></section>`);
  }
  const clase = fallan ? 'mal' : 'ok';
  contenedor.innerHTML =
    `<p class="marcador ${clase}">${pasan} pasan · ${fallan} fallan</p>` + partes.join('');
}

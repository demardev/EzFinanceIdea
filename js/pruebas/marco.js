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

/** Corre todo y pinta la lista de pasa/falla en el contenedor dado. */
export function correr(contenedor) {
  let pasan = 0, fallan = 0;
  const partes = grupos.map(({ nombre, casos }) => {
    const filas = casos.map(({ titulo, fn }) => {
      try { fn(); pasan++; return `<li class="ok">✓ ${titulo}</li>`; }
      catch (e) { fallan++; return `<li class="mal">✗ ${titulo}<br><small>${e.message}</small></li>`; }
    });
    return `<section><h2>${nombre}</h2><ul>${filas.join('')}</ul></section>`;
  });
  const clase = fallan ? 'mal' : 'ok';
  contenedor.innerHTML =
    `<p class="marcador ${clase}">${pasan} pasan · ${fallan} fallan</p>` + partes.join('');
}

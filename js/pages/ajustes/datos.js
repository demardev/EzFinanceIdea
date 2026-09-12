/* Ajustes → Datos: bajar el respaldo y volver a subirlo.
   La vista pinta y conecta; la lógica del respaldo vive en respaldo.js. */

import { icono } from '../../iconos/render.js';
import { confirmar } from '../../ui/confirmar.js';
import { aviso, avisoError } from '../../ui/toast.js';
import { plural } from '../../ui/texto.js';
import { hoyISO } from '../../calc/fechas.js';
import { exportarTodo, importarTodo, revisarRespaldo, contarFilas } from './respaldo.js';

function plantilla() {
  return `
    <div class="pila">
      <div>
        <p class="seccion-titulo">Exportar</p>
        <p class="tenue" style="font-size:13px;margin-bottom:10px">
          Baja un JSON con todo: cuentas, categorías, tarjetas, compras a cuotas,
          movimientos y el plan. Guárdalo donde quieras.
        </p>
        <div class="pila-sm">
          <button class="btn btn-primario btn-bloque" id="btn-bajar" type="button">
            ${icono('descarga', 18)} Descargar respaldo
          </button>
          <button class="btn btn-bloque" id="btn-copiar" type="button">
            Copiar al portapapeles
          </button>
        </div>
      </div>

      <div>
        <p class="seccion-titulo">Importar</p>
        <p class="tenue" style="font-size:13px;margin-bottom:10px">
          Vuelve a meter un respaldo. Lo que ya existe se actualiza y lo que no,
          se crea: importar dos veces el mismo archivo no duplica nada.
        </p>
        <div class="pila-sm">
          <input type="file" id="archivo" accept="application/json,.json" hidden>
          <button class="btn btn-bloque" id="btn-elegir" type="button">
            Elegir archivo…
          </button>
          <textarea id="pegado" rows="4" placeholder="…o pega aquí el JSON"
                    style="width:100%;padding:11px 13px;border:1px solid var(--line);
                           border-radius:var(--r);background:var(--bg-2);font-size:15px"></textarea>
          <button class="btn btn-bloque" id="btn-pegado" type="button">Importar lo pegado</button>
        </div>
        <p class="campo-error" id="error-datos" hidden></p>
      </div>
    </div>`;
}

/** iOS no siempre respeta <a download>; por eso está el botón de copiar. */
function bajarArchivo(texto, nombre) {
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function montarDatos(contenedor, contexto) {
  const { cliente } = contexto;
  contenedor.innerHTML = plantilla();
  const error = contenedor.querySelector('#error-datos');

  const fallar = (e) => {
    error.hidden = false;
    error.textContent = e.message;
    avisoError(e);
  };

  async function conRespaldo(accion) {
    error.hidden = true;
    try {
      accion(JSON.stringify(await exportarTodo(cliente), null, 2));
    } catch (e) { fallar(e); }
  }

  function confirmarImportacion(respaldo) {
    return confirmar({
      titulo: '¿Importar este respaldo?',
      mensaje: `Trae ${plural(contarFilas(respaldo), 'fila', 'filas')} `
             + `del ${respaldo.exportado?.slice(0, 10)}. `
             + 'Lo que ya exista con el mismo id se sobreescribe.',
      textoOk: 'Importar',
      peligro: false,
    });
  }

  async function importar(texto) {
    error.hidden = true;
    try {
      const respaldo = revisarRespaldo(texto);
      if (!await confirmarImportacion(respaldo)) return;
      const n = await importarTodo(cliente, respaldo);
      /* Se escribió por fuera de los repos, así que lo guardado en memoria
         quedó viejo. */
      Object.values(contexto).forEach((repo) => repo?.olvidar?.());
      aviso(`Se importaron ${plural(n, 'fila', 'filas')}.`);
    } catch (e) { fallar(e); }
  }

  contenedor.querySelector('#btn-bajar').addEventListener('click', () =>
    conRespaldo((texto) => {
      bajarArchivo(texto, `finanzas-${hoyISO()}.json`);
      aviso('Respaldo descargado.');
    }));

  contenedor.querySelector('#btn-copiar').addEventListener('click', () =>
    conRespaldo(async (texto) => {
      await navigator.clipboard.writeText(texto);
      aviso('Respaldo copiado.');
    }));

  const archivo = contenedor.querySelector('#archivo');
  contenedor.querySelector('#btn-elegir').addEventListener('click', () => archivo.click());
  archivo.addEventListener('change', async () => {
    const [f] = archivo.files;
    if (f) await importar(await f.text());
    archivo.value = '';
  });

  contenedor.querySelector('#btn-pegado').addEventListener('click', () => {
    const texto = contenedor.querySelector('#pegado').value.trim();
    if (texto) importar(texto);
  });
}

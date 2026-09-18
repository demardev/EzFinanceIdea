/* Tomar una foto, encogerla y previsualizarla.

   Comprimir NO es un lujo: una foto del iPhone pesa 3–5 MB y el plan gratuito
   de Storage da 1 GB. A 1400px y JPEG al 72% un ticket baja a 100–200 KB y se
   sigue leyendo perfecto. La diferencia es entre ~250 fotos y varios miles. */

const MAX_LADO = 1400;
const CALIDAD = 0.72;

/** Encoge para que el lado mayor quepa en `maxLado`. Nunca agranda. */
export function dimensionesDestino(ancho, alto, maxLado = MAX_LADO) {
  const mayor = Math.max(ancho, alto);
  if (!mayor || mayor <= maxLado) return { ancho, alto };
  const factor = maxLado / mayor;
  return { ancho: Math.round(ancho * factor), alto: Math.round(alto * factor) };
}

/* Se carga en un <img> y no con createImageBitmap a propósito: el navegador
   aplica solo la orientación EXIF al renderizar una imagen, y las fotos del
   iPhone vienen rotadas casi siempre. */
function cargarImagen(archivo) {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolver(img); };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rechazar(new Error('No se pudo leer esa imagen.'));
    };
    img.src = url;
  });
}

function aBlob(lienzo, calidad) {
  return new Promise((resolver, rechazar) => {
    lienzo.toBlob(
      (blob) => (blob ? resolver(blob) : rechazar(new Error('No se pudo procesar la imagen.'))),
      'image/jpeg', calidad);
  });
}

/**
 * @returns { blob, ancho, alto, bytes, bytesOriginales }
 */
export async function comprimirImagen(archivo, { maxLado = MAX_LADO, calidad = CALIDAD } = {}) {
  const img = await cargarImagen(archivo);
  const { ancho, alto } = dimensionesDestino(img.naturalWidth, img.naturalHeight, maxLado);

  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  lienzo.getContext('2d').drawImage(img, 0, 0, ancho, alto);

  const blob = await aBlob(lienzo, calidad);
  return { blob, ancho, alto, bytes: blob.size, bytesOriginales: archivo.size };
}

/* --------------------------------------------------------------- campo --- */

/* Dos entradas y no una: con `capture` el teléfono abre directo la cámara y
   no deja ir a la galería, y sin él cada navegador ofrece la cámara a su
   manera (o no la ofrece). Así los dos caminos quedan a un toque. */
export function campoFoto({ nombre = 'foto', etiqueta = 'Foto del recibo' } = {}) {
  return `
    <div class="campo campo-foto" data-foto>
      <label>${etiqueta}</label>
      <input type="file" name="${nombre}" accept="image/*" hidden data-entrada="galeria">
      <input type="file" accept="image/*" capture="environment" hidden data-entrada="camara">
      <div class="foto-vista" hidden><img alt="Foto adjunta"></div>
      <div class="fila" style="gap:8px">
        <button type="button" class="btn btn-sm crece" data-elegir="galeria">Galería</button>
        <button type="button" class="btn btn-sm crece" data-elegir="camara">Cámara</button>
        <button type="button" class="btn btn-sm btn-peligro" data-quitar hidden>Quitar</button>
      </div>
      <span class="tenue-2" style="font-size:12px" data-peso></span>
    </div>`;
}

/** Cada botón abre su entrada: la de la galería o la de la cámara. */
function engancharEntradas(caja, alElegir) {
  for (const boton of caja.querySelectorAll('[data-elegir]')) {
    const entrada = caja.querySelector(`[data-entrada="${boton.dataset.elegir}"]`);
    boton.addEventListener('click', () => entrada.click());
    entrada.addEventListener('change', () => alElegir(entrada));
  }
}

/**
 * Engancha el campo. `alCambiar(blob|null)` recibe la imagen ya comprimida.
 * @param urlPrevia para editar algo que ya tenía foto
 */
export function conectarFoto(raiz, { alCambiar, urlPrevia = null } = {}) {
  const caja = raiz.querySelector('[data-foto]');
  if (!caja) return;
  const vista = caja.querySelector('.foto-vista');
  const img = vista.querySelector('img');
  const quitar = caja.querySelector('[data-quitar]');
  const peso = caja.querySelector('[data-peso]');

  function mostrar(url, texto = '') {
    img.src = url ?? '';
    vista.hidden = !url;
    quitar.hidden = !url;
    peso.textContent = texto;
  }

  if (urlPrevia) mostrar(urlPrevia);

  async function alElegir(entrada) {
    const [archivo] = entrada.files;
    if (!archivo) return;
    peso.textContent = 'Procesando…';
    try {
      const r = await comprimirImagen(archivo);
      mostrar(URL.createObjectURL(r.blob),
              `${r.ancho}×${r.alto} · ${Math.round(r.bytes / 1024)} KB`);
      alCambiar?.(r.blob);
    } catch (e) {
      /* Sin avisar null: eso significa "quitar", y al editar borraría la que había. */
      peso.textContent = e.message;
    } finally {
      entrada.value = '';
    }
  }

  engancharEntradas(caja, alElegir);
  quitar.addEventListener('click', () => { mostrar(null); alCambiar?.(null); });
}

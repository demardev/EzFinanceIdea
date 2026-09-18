# Finanzas — invariantes del proyecto

El spec completo está en `PROMPT.md`. Esto es lo que se rompe con más facilidad y hay que
verificar en **cada** pantalla, incluidas las que aún no existen.

## Montos

- Se muestran **siempre** como `$000.00`: signo de peso, separador de miles y **dos decimales**.
  Nunca `$1,234`, nunca `1234.5`, nunca sin `$`. Negativos con `−$80.00`.
- **Todo input de monto se formatea solo mientras se escribe**, estilo calculadora: **no se
  teclea el punto**. Los dígitos entran por la derecha y los dos últimos son los centavos, así
  que `1`,`0`,`0`,`0` da `$10.00`, no `$1,000`. Borrar recorre el decimal. Sin excepción:
  movimientos, saldo inicial, límite de tarjeta, montos del plan.
- Los campos de monto usan `campoMonto()` de `js/ui/campos.js`: `type="text"` +
  `inputmode="decimal"` + `data-monto`, con el `$` como prefijo visual y el cursor al final.
  El enganche lo hace `conectarMontos()` de `js/ui/monto-input.js`, que `abrirSheet()` ya llama
  solo — si un formulario repinta su cuerpo, tiene que volver a llamarlo.
- `formatearEntrada()` (dígitos tecleados → texto) y `montoAEntrada()` (número guardado → texto)
  son cosas distintas: no las confundas.
- `datosDe()` devuelve los montos como **número**, nunca como la cadena formateada.

## Categorías

- Una categoría pertenece a un solo tipo de movimiento. Donde se elija categoría junto a un tipo,
  solo se ofrecen las de ese tipo — **también en los filtros**. Con el tipo en "Todos", todas.

## Listas

- Las filas que se pueden borrar llevan `deslizable: true` en `filaEditable()` y la pantalla
  llama a `conectarDeslizar(contenedor)` **después de cada repintado**. El gesto solo descubre
  el botón: el borrado pasa por la misma `confirmar()` que el resto.
- El deslizar se apaga en modo reordenar, donde las flechas ocupan ese lado.

## Negocio de pago de recibos

- `perfiles.negocio` decide si la función existe para ese usuario. **La restricción
  vive en la base**: las políticas de `pagos_recibo` y del bucket exigen `es_negocio()`.
  Ocultar el botón no protege nada.
- Una operación es el egreso más los ingresos de sus **abonos** (`pagos_recibo.abonos`,
  lista de `{fecha, cuenta_id, monto}`), todos con `ambito = 'negocio'` y `pago_id`.
  Cada abono cubre primero el recibo; la comisión es **una por operación** y entra con
  el abono que la completa. Mientras falte algo está **pendiente** (`fecha_cobro` en
  null) y te deben el recibo más la comisión menos lo abonado. `fecha_cobro` y
  `cuenta_cobro_id` son del abono que saldó: se calculan con `conAbonos()`, no a mano.
- El **flujo personal del Resumen excluye el negocio**; el **patrimonio los suma
  todos**, porque ese dinero sí está en la cuenta. No los confundas.
- Los movimientos generados **nunca se editan uno por uno**: se borran y se
  regeneran desde la operación.

## Estructura

- Ningún archivo pasa de 200 líneas, ninguna función de 40. Se parte al momento, no al final.
  Para medirlo hay que balancear llaves: contar hasta el siguiente `}` en columna 0 da
  falsos positivos y, peor, esconde las funciones `montarX()` que sí se pasan.
- `js/calc/` son funciones puras sin red ni DOM, y **todo lo que vive ahí va con pruebas** en
  `test.html` (los casos se escriben antes que la implementación).
- Solo `js/api/client.js` hace `fetch` y sabe que existe Supabase.
- **Cero dependencias y cero scripts externos.** Ni npm, ni CDN, ni fuentes remotas: todo
  se sirve del mismo origen. No es estilo, es seguridad — el token de sesión vive en
  `localStorage`, así que cualquier script de terceros comprometido entregaría la sesión, y
  ese es el vector más probable contra esta app. Lo que la protege hoy es que no existe.
  Por lo mismo, todo texto del usuario se pinta con `escapar()`; `confirmar()` escapa su
  título y su mensaje, y los toast usan `textContent`.
- Las vistas no hacen `fetch` ni aritmética de dinero.
- Fechas siempre `DD/mmm/YYYY`. Nunca `new Date('2026-09-08')`: ese constructor lee UTC y corre
  el día. Usar `js/calc/fechas.js`.

## Cómo trabajar

- Todo en español: texto de la app, comentarios, nombres de variables.
- Se construye por pasos (sección 9 de `PROMPT.md`) y se para al final de cada uno a mostrar.
- No agregar funciones que no se pidieron.

## PWA

- Al agregar o quitar un archivo del shell (HTML, CSS, JS, iconos) hay que **actualizar la lista
  `SHELL` de `sw-shell.js` y subir `VERSION` en `sw.js`**, si no la app sirve el cache viejo.
  Los dos: el navegador detecta la actualización por el contenido de `sw.js`.
- El shell **no pide `index.html`**: el hosting (Cloudflare Pages) lo redirige a `/` con un 308, y
  una respuesta con redirect guardada en el cache hace que Safari se niegue a abrir la app
  ("the response served by the service worker has redirections"). Se pide `./`, que responde 200.
- Los iconos se regeneran con `python3 icons/generar-iconos.py`. Sin dependencias.

## Desarrollo local

`python3 -m http.server` sirve módulos cacheados y confunde las pruebas, y además responde
HTTP/1.0, con lo que el navegador **rechaza registrar el service worker**. Usar un servidor con
`Cache-Control: no-store` y `protocol_version = 'HTTP/1.1'`, o recargar con `Cmd+Shift+R`.

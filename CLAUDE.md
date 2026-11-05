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

## Planes y funciones

- Una función de pago (hoy `prestamos`) vive en `funciones`, y `plan_funciones` dice en qué
  plan está. El plan sale de `perfiles.premium_hasta`. **La restricción vive en la base**:
  la política de la tabla exige `tiene_funcion('clave')`. La app solo lee `mis_funciones()`
  (`contexto.funciones`) para decidir qué mostrar.
- La función `avisar` lee con la llave de servicio, que se salta las políticas: ahí hay que
  preguntar `funcionesDe(userId)` antes de leer algo de una función de pago.
- El panel de admin es otra página (`admin/`), con PIN. Toda función `admin_*` exige
  `exigir_admin()`: bandera admin **y** PIN puesto hace menos de 30 minutos.
- Préstamos: los abonos son movimientos normales con `prestamo_id`, y sí se editan uno
  por uno (no son generados). La regla del atraso es acumulada (`js/calc/prestamos.js`).

## Estructura

- Ningún archivo pasa de 200 líneas, ninguna función de 40. Se parte al momento, no al final.
  Para medirlo hay que balancear llaves: contar hasta el siguiente `}` en columna 0 da
  falsos positivos y, peor, esconde las funciones `montarX()` que sí se pasan.
- `js/calc/` son funciones puras sin red ni DOM, y **todo lo que vive ahí va con pruebas** en
  `test.html` (los casos se escriben antes que la implementación).
- Solo `js/api/client.js` hace `fetch` y sabe que existe Supabase.
- El código de servidor vive en `supabase/functions/` (Edge Functions, Deno) y tampoco usa
  dependencias: `_shared/webpush.js` cifra y firma los push con WebCrypto y se prueba en
  `test.html` contra el ejemplo del RFC 8291. Se despliega con
  `supabase functions deploy avisar --remote=tifmifpphzufarjtckpt --use-api --no-verify-jwt`
  (la función valida la sesión ella misma, leyendo con el token del usuario).
  `administrar` (eliminar cuentas) se despliega igual; usa la llave de servicio, así que
  comprueba primero que quien llama sea admin. Las tablas con `user_id` necesitan
  `on delete cascade` hacia `auth.users`, o eliminar una cuenta les deja basura.
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
- **Al terminar un cambio, se corre y se publica sin preguntar** (lo pidió el usuario):
  1. El SQL nuevo se corre en producción con
     `supabase db query --remote=tifmifpphzufarjtckpt --yes -f sql/NN_nombre.sql`, y se
     verifica con una consulta `--read-only`. Siempre **antes** de publicar.
  2. Las Edge Functions que cambiaron se despliegan (comando en Estructura, con `--yes`).
  3. Commit y push a `main`, que es de donde se publica la PWA.
  Si algo falla a medias, se para y se avisa: no se publica una app contra una base que
  no tiene su SQL.

## PWA

- Al agregar o quitar un archivo del shell (HTML, CSS, JS, iconos) hay que **actualizar la lista
  `SHELL` de `sw-shell.js` y subir `VERSION` en `sw.js`**, si no la app sirve el cache viejo.
  Los dos: el navegador detecta la actualización por el contenido de `sw.js`.
- El service worker contesta toda navegación con `./`, salvo `…/admin/`, que es otra página.
- El shell **no pide `index.html`**: el hosting (Cloudflare Pages) lo redirige a `/` con un 308, y
  una respuesta con redirect guardada en el cache hace que Safari se niegue a abrir la app
  ("the response served by the service worker has redirections"). Se pide `./`, que responde 200.
- Los iconos se regeneran con `python3 icons/generar-iconos.py`. Sin dependencias.

## Desarrollo local

`python3 -m http.server` sirve módulos cacheados y confunde las pruebas, y además responde
HTTP/1.0, con lo que el navegador **rechaza registrar el service worker**. Usar un servidor con
`Cache-Control: no-store` y `protocol_version = 'HTTP/1.1'`, o recargar con `Cmd+Shift+R`.

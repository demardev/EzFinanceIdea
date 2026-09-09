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

## Estructura

- Ningún archivo pasa de 200 líneas, ninguna función de 40. Se parte al momento, no al final.
- `js/calc/` son funciones puras sin red ni DOM, y **todo lo que vive ahí va con pruebas** en
  `test.html` (los casos se escriben antes que la implementación).
- Solo `js/api/client.js` hace `fetch` y sabe que existe Supabase.
- Las vistas no hacen `fetch` ni aritmética de dinero.
- Fechas siempre `DD/mmm/YYYY`. Nunca `new Date('2026-09-08')`: ese constructor lee UTC y corre
  el día. Usar `js/calc/fechas.js`.

## Cómo trabajar

- Todo en español: texto de la app, comentarios, nombres de variables.
- Se construye por pasos (sección 9 de `PROMPT.md`) y se para al final de cada uno a mostrar.
- No agregar funciones que no se pidieron.

## PWA

- Al agregar o quitar un archivo del shell (HTML, CSS, JS, iconos) hay que **actualizar la lista
  `SHELL` y subir `VERSION` en `sw.js`**, si no la app sirve el cache viejo.
- Los iconos se regeneran con `python3 icons/generar-iconos.py`. Sin dependencias.

## Desarrollo local

`python3 -m http.server` sirve módulos cacheados y confunde las pruebas, y además responde
HTTP/1.0, con lo que el navegador **rechaza registrar el service worker**. Usar un servidor con
`Cache-Control: no-store` y `protocol_version = 'HTTP/1.1'`, o recargar con `Cmd+Shift+R`.

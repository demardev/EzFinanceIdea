# Asistente de tarjetas (premium)

Ayuda a cuadrar una tarjeta con el banco: lee el estado de cuenta con IA, lo
compara con tus movimientos y propone los arreglos. Nace de cuadrar BAC ECONOMIA a
mano en noviembre de 2026 (ver "El caso que lo originó", al final).

## Reglas que no se rompen

1. **La IA lee y propone; el código calcula, comprueba y aplica.** La IA nunca
   hace aritmética de dinero ni escribe en la base.
2. **Todo lo leído se comprueba solo:** saldo anterior + cargos − créditos +
   intereses fuera de la lista = saldo al corte del mismo estado de cuenta
   (`revisarLectura()` en `js/calc/estado-cuenta.js`). Si no da, no se usa.
3. **Aislado por usuario:** la Edge Function lee con el token de quien llama,
   nunca con la llave de servicio. Las políticas de la base hacen el resto.
4. **La restricción vive en la base:** `usar_asistente_tarjetas()` exige
   `tiene_funcion('asistente_tarjetas')` y cuenta el cupo (30 lecturas al mes).
5. **Nada se aplica sin confirmación** del usuario, y lo aplicado se puede deshacer.
6. **El documento es datos, no instrucciones:** el texto de un estado de cuenta
   (o la descripción de un movimiento) puede intentar dar órdenes. Por eso la IA
   solo devuelve datos con forma fija y acciones cerradas que el servidor valida.
7. El SDK de Anthropic (`npm:@anthropic-ai/sdk@<versión exacta>`) solo vive en
   `supabase/functions/`. La app del navegador sigue sin ninguna dependencia.

## Paso 1 — Leer y comprobar (hecho)

| Pieza | Archivo |
|---|---|
| Limpiar lo leído y comprobar el saldo | `js/calc/estado-cuenta.js` (+ `js/pruebas/estado-cuenta.js`, `estados-bac.js`) |
| Edge Function: sesión, cupo y llamada a Claude Haiku 5.5 | `supabase/functions/leer-estado/index.ts`, `lector.ts` |
| Función premium y cupo | `sql/15_asistente_tarjetas.sql` |
| Hoja "Leer estado de cuenta" (menú ⋯ de la tarjeta) | `js/pages/tarjetas/estado-cuenta.js`, `estado-cuenta-vista.js` |
| Repo | `js/repos/asistente.js` |

La lectura tiene esta forma (la misma en servidor y app):

```
{ banco, moneda, fecha_corte, fecha_limite_pago, saldo_anterior, saldo_al_corte,
  intereses_fuera_de_lista, pago_contado,
  movimientos: [{ fecha | null, concepto, monto (>0), sentido: 'cargo' | 'credito' }] }
```

Pendiente de probar con IA real: los 3 PDF de BAC (sep, oct y nov de 2026) deben
salir "cuadra". Si alguno no cuadra, ajustar el prompt de `lector.ts` (no el
código de comprobación) y medirlo de nuevo con los tres.

## Paso 2 — Comparar con tus movimientos (por hacer)

Objetivo: con una lectura que cuadra, decir qué falta, qué sobra y qué está
distinto en la app para ese corte, y por qué la app no da el saldo del banco.

### 2.1 Emparejar (código puro, sin IA) — `js/calc/emparejar-estado.js`

Entrada: la lectura, los movimientos de la tarjeta (`cargosDeTarjeta()`), sus
compras a cuotas y el ciclo.

1. **Ventana:** movimientos de la app con fecha entre `fecha_corte` del corte
   anterior (exclusivo) y `fecha_corte` + 3 días: el banco a veces pone la fecha
   de aplicación, un día después de la compra (pasó con Supercell $58.11 y
   Apple $2.38), y lo que se aplicó después del corte va al siguiente.
2. **Emparejar por monto exacto y sentido**, la fecha más cercana primero
   (tolerancia ±3 días). Un movimiento de la app se usa una sola vez. Cargos de
   la app = egresos a la tarjeta; créditos = pagos (transferencias) y reembolsos
   (ingresos a la tarjeta).
3. **Cuotas:** una línea del banco "CUOTA:12/36" o "MINICUOTA … CUOTA:05/06" se
   empareja con la cuota de ese número de su compra, aunque la fecha no coincida.
   Si el número no coincide con el de la app (la app dice 13, el banco 12),
   es una **cuota corrida**: proponer `fijar_primera_cuota` (ver 3.1).
4. **Compras pasadas a minicuotas:** las originales (`traslado_id`) siguen en el
   estado de cuenta del corte en que se hicieron; se emparejan aunque no cuenten
   como deuda en la app.
5. **Intereses y bonificaciones:** `intereses_fuera_de_lista` se compara con un
   egreso "Intereses" del día del corte; "BONIFICACION PAGO SALDO" es un
   reembolso a la tarjeta (`ingreso` con `tarjeta_id`, sql/14).
6. Salida:
   ```
   { emparejados: [{ linea, movimiento, diferenciaDias }],
     faltan:      [linea],        // en el banco, no en la app
     sobran:      [movimiento],   // en la app, no en el banco
     distintos:   [{ linea, movimiento, motivo: 'monto' | 'fecha' | 'cuota' }],
     saldoApp, saldoBanco, diferencia }
   ```
   `saldoApp` = deuda de la app al corte, contando las originales de minicuotas
   como el banco (mismo cálculo que se usó a mano: compras originales sí,
   cuotas del traslado nuevo no).
7. **Pruebas primero** con el caso real de noviembre, antes y después del cuadre:
   antes debía salir faltan = [intereses 4.62, bonificación 6.39, Supercell 18.48*],
   distintos = [Apple 0.88 vs 20.88, Movistar 09/nov vs 04/nov, cuotas corridas].
   (*El Supercell de 18.48 es del corte siguiente: probarlo con el de diciembre.)

### 2.2 Ambigüedades (IA, opcional)

Lo que no empareja por monto (p. ej. "APPLE.COM/BILL $8.99" = "DUOLINGO" en la
app) se le manda a la IA **solo con esas líneas y esos movimientos**, y devuelve
pares `{ linea, movimiento_id, confianza }`. El código acepta solo pares con el
mismo monto y sentido; si no, quedan como faltan/sobran. Cuesta otra lectura del cupo.

### 2.3 Pantalla

Debajo del veredicto de la lectura: "Comparar con mis movimientos". Muestra tres
grupos plegables (Faltan / Sobran / Distintos) y arriba: "La app dice $X al
corte, el banco $Y: diferencia $Z, y esto la explica". Sin botones de aplicar
todavía: eso es el paso 3.

## Paso 3 — Proponer y aplicar arreglos (después)

### 3.1 Acciones cerradas

Cada diferencia del paso 2 se traduce (código, no IA) en una acción:

| Acción | Cuándo | Cómo se aplica (código que ya existe) |
|---|---|---|
| `agregar_cargo` | falta un cargo | `movimientos.crear` egreso a la tarjeta |
| `agregar_reembolso` | falta un crédito que no es pago | ingreso a la tarjeta (sql/14) |
| `agregar_pago` | falta un pago | `abrirSheetPago` (pide la cuenta de origen: no se adivina) |
| `corregir_monto` / `mover_fecha` | distintos | `movimientos.actualizar` |
| `registrar_intereses` | faltan intereses | egreso "Intereses" el día del corte |
| `fijar_primera_cuota` | cuota corrida | `compras.actualizar` + `planRegeneracion()` |
| `quitar` | sobra | `movimientos.eliminar` con `confirmar()` |

La IA solo elige categoría y descripción para lo que se agrega (puede usar los
nombres de tus categorías). Montos y fechas salen de la lectura.

### 3.2 Comprobar antes de mostrar

Se aplican las acciones en memoria y se recalcula con `calcularDeuda()`: solo se
proponen si con ellas la app da el saldo del banco. Si no, se muestran como
"sugerencias sin comprobar".

### 3.3 Confirmar y deshacer

El usuario marca qué aplicar. Se guarda un registro (`asistente_cambios`:
user_id, fecha, acción, antes, después) para poder deshacer todo el lote.

## Después

- Minicuotas desde el asistente: si el estado de cuenta trae "CR MINICUOTAS …",
  proponer el traslado con esas compras, la comisión ("DB COMISION MINICUOTAS") y el
  plazo de la pestaña Financiamientos.
- Pago de contado tras un traslado: comparar lo que pide el banco con
  `aPagarAhora` y explicar la diferencia (pendiente de ver cómo lo recalcula BAC).
- Chat sobre la tarjeta: solo lectura y explicaciones; sin consejos de inversión.

## Costo y cupo

Claude Haiku 5.5: $0.10 por millón de tokens de entrada y $0.50 de salida (hasta
100K tokens de prompt). Un estado de cuenta de una página son pocos miles de tokens:
menos de un centavo por lectura. Cupo: 30 lecturas al mes por usuario
(`usar_asistente_tarjetas()`); se cuenta antes de llamar a la IA, aunque falle.

## El caso que lo originó

BAC ECONOMIA, corte del 09/nov/2026: la app decía $289.69 y el banco $287.92.
Faltaban los intereses ($4.62) y la bonificación (−$6.39) del corte, las cuotas
de los Airpods y de la minicuota de junio iban corridas un mes, y un Apple de
$20.88 estaba como $0.88. Cuadrarlo a mano llevó tres estados de cuenta y varias
vueltas; es justo lo que este asistente debe hacer solo.

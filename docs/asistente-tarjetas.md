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
   `tiene_funcion('asistente_tarjetas')` y cuenta el cupo (ver "Límites").
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

## Paso 2b — Dar de alta una tarjeta desde su estado de cuenta (después del 2)

Objetivo: el usuario crea la tarjeta, sube el último estado de cuenta (y si
quiere, capturas de "movimientos recientes" y de "Financiamientos") y la tarjeta
queda cuadrada con el banco desde el primer día. Usa el emparejamiento del paso 2
para no duplicar si la tarjeta ya tiene movimientos.

### 2b.1 Configurar la tarjeta (código puro) — `js/calc/alta-desde-estado.js`

- **Día de corte** = día de `fecha_corte`.
- **Día límite de pago:** el banco lo corre cuando cae en fin de semana (BAC: 28
  en sep y oct, 30 en nov porque el 28/nov/2026 fue sábado). Con 2 o más
  estados de cuenta se toma el día que más se repite; con uno solo, se propone
  y se le pregunta al usuario.
- **Comprobar fechas contra hoy:** con ese día de corte, `calcularCiclo(hoy)`
  tiene que dar como último corte la `fecha_corte` leída (o la siguiente, si el
  estado de cuenta es del corte anterior). Si no, se avisa antes de crear nada:
  puede ser un estado de cuenta viejo o un día de corte mal leído.

### 2b.2 Saldo, sin contar dos veces — el usuario elige

- **A (simple y exacta):** `saldo_inicial` = `saldo_al_corte`, con
  `fecha_saldo_inicial` = `fecha_corte` (ya existe en tarjetas:
  `js/calc/saldo-inicial-tarjeta.js`). Solo se crean los movimientos posteriores
  al corte (de la captura de movimientos recientes).
- **B (con historial):** `saldo_inicial` = `saldo_anterior` con la fecha del corte
  anterior, y se crean también las líneas del estado de cuenta. Así queda el
  gasto de ese mes por categoría. Las cuotas de compras a meses del estado de
  cuenta NO se crean como cargos sueltos: las genera su compra (2b.4).

### 2b.3 Crear los movimientos

| Línea leída | Se crea como |
|---|---|
| cargo | egreso a la tarjeta |
| crédito que es pago ("SU PAGO RECIBIDO") | transferencia a la tarjeta: **se pregunta la cuenta de origen**, el banco no la dice |
| otro crédito (devolución, bonificación) | ingreso a la tarjeta (reembolso, sql/14) |
| `intereses_fuera_de_lista` | egreso "Intereses" el día del corte |
| "CR MINICUOTAS …" / "DB COMISION MINICUOTAS" | traslado a minicuotas (no movimientos sueltos) |

La IA solo sugiere categoría (de las del usuario, por nombre) y una descripción
más legible. Montos, fechas y sentido salen de la lectura, nunca de la IA.

### 2b.4 Compras a cuotas

- Cada "CUOTA:n/N" o "MINICUOTA … CUOTA:n/N" se agrupa por compra.
- Con la captura de Financiamientos (fecha, concepto, cuotas n/N, monto de cuota,
  saldo inicial, saldo faltante) se crea la compra a cuotas con `monto_total` =
  saldo inicial, `num_cuotas` = N, `cuotas_pagadas` según el modo de saldo (A: las
  cobradas hasta el corte; B: las anteriores al estado de cuenta) y
  **`fecha_primera_cuota`** a partir de la fecha de la cuota n en el estado de cuenta
  (BAC: Airpods el día 28, minicuotas el día del corte).
- Comprobar: lo pendiente de cada compra en la app = su saldo faltante del banco.

### 2b.5 Comprobación final y confirmación

Antes de guardar, en memoria:
- deuda de la app (`calcularDeuda`) = saldo actual del banco (si se dio), o
  saldo al corte en el modo A sin movimientos posteriores;
- `comprometido` = total de Financiamientos (si se dio).

Si no cuadra, se muestra por cuánto y no se guarda nada. Si cuadra, el usuario ve
la lista completa (tarjeta, saldo inicial, movimientos, compras a cuotas), la
confirma, y se guarda en lote con su registro para deshacer (3.3).

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

## Límites (contra el abuso)

| Límite | Dónde | Al pasarse |
|---|---|---|
| Sin sesión o sin el plan | `leer-estado` (`tiene_funcion`) | se rechaza sin llamar a la IA |
| Documento de más de 40 mil tokens (~15–20 páginas) | `leer-estado` cuenta con `countTokens` (gratis) | se rechaza sin gastar ni descontar |
| 10 lecturas al día por usuario | `usar_asistente_tarjetas()` (sql/17) | "Ya usaste las lecturas de hoy" |
| 30 lecturas al mes por usuario | idem | "Ya usaste todas las lecturas de este mes" |
| 100 lecturas al día en toda la app | idem (con candado para que no se pase) | "El asistente llegó a su límite de hoy" |
| Gasto mensual | Claude Console → límite de gasto (lo pone el usuario dueño) | Anthropic deja de responder: "El asistente no respondió" |
| Apagado de emergencia | panel de admin: quitar la función del plan premium | desaparece para todos |

Peor caso por usuario con estos límites: 30 lecturas de 40 mil tokens de entrada
($0.12) con la salida al máximo de 16 mil ($0.24) ≈ $0.36 al mes. Lo normal: ~$0.003
por lectura.
Los días y meses se cuentan con la hora de El Salvador.

## Costo y cupo

Claude Haiku 5.5: $0.10 por millón de tokens de entrada y $0.50 de salida (hasta
100K tokens de prompt). Estimado sin medir: un estado de cuenta de una página son
2–4 mil tokens de entrada (el PDF entra como texto e imagen de cada página) y 2–4
mil de salida (la lista más lo que el modelo piensa, que se cobra como salida):
unos $0.002–0.003 por lectura.

Lo real se guarda: `leer-estado` suma los tokens de cada respuesta de la IA
(también las que no sirven: se pagan igual) en `uso_asistente.tokens_entrada` y
`tokens_salida` (sql/16). Costo por usuario y mes, con los precios de Haiku 5.5:

```sql
select user_id, mes, lecturas, tokens_entrada, tokens_salida,
       round(tokens_entrada * 0.10 / 1e6 + tokens_salida * 0.50 / 1e6, 4) as usd
from uso_asistente order by mes desc, usd desc;
```

Si se cambia de modelo, cambiar también estos precios. Cada lectura se descuenta del
cupo (ver "Límites") antes de llamar a la IA y después de contar los tokens, aunque
luego falle.

## El caso que lo originó

BAC ECONOMIA, corte del 09/nov/2026: la app decía $289.69 y el banco $287.92.
Faltaban los intereses ($4.62) y la bonificación (−$6.39) del corte, las cuotas
de los Airpods y de la minicuota de junio iban corridas un mes, y un Apple de
$20.88 estaba como $0.88. Cuadrarlo a mano llevó tres estados de cuenta y varias
vueltas; es justo lo que este asistente debe hacer solo.

# Prompt — App personal de finanzas (PWA para iPhone)

> Pegar completo en un chat nuevo de Claude Code, dentro de la carpeta vacía donde vivirá el proyecto.

---

Quiero que construyas conmigo una app personal de finanzas. Es **solo para mí** (uso personal, 1–2
usuarios), la voy a usar **desde el iPhone** instalada en la pantalla de inicio, y necesito que sea
**gratis de operar**. Lee todo el prompt antes de empezar a escribir código.

## 1. Stack — no lo cambies

- **Frontend:** HTML + CSS + JavaScript vanilla (ES modules). **Sin framework, sin build step, sin
  `npm install`, sin bundler.** Los archivos se abren con un editor y se sirven tal cual.
- **Backend / BD:** **Supabase** (Postgres del free tier). **No uses la librería `supabase-js` ni
  ningún CDN.** Habla directo con la API REST de Supabase usando `fetch`:
  - datos → PostgREST: `${SUPABASE_URL}/rest/v1/<tabla>` con headers `apikey` y
    `Authorization: Bearer <access_token>`
  - auth → GoTrue: `${SUPABASE_URL}/auth/v1/token?grant_type=password` y `.../logout`,
    con refresh del token cuando expire
  - funciones → `${SUPABASE_URL}/rest/v1/rpc/<funcion>`
  Escribe un wrapper propio en `js/api/` (ver la arquitectura de la sección 8). Cero dependencias
  externas: así el
  service worker puede cachear el 100% de la app.
- **Hosting:** sitio estático en Cloudflare Pages (o GitHub Pages). Deploy con `git push`.
- **Auth:** login con email + contraseña de Supabase. **No construyas pantalla de registro** — el
  usuario se crea a mano desde el dashboard de Supabase. Solo pantalla de login + "cerrar sesión".
  La sesión persiste en `localStorage` y se refresca sola; no quiero volver a loguearme cada día.

Razón de estas restricciones: quiero poder abrir cualquier archivo y entenderlo sin herramientas,
y que la app arranque instantáneo en el celular.

## 2. Estética — minimalista, blanco y negro

Monocromo con **exactamente tres acentos**: verde (entra dinero), rojo (sale dinero), ámbar (alerta).
Nada más de color. Referencia visual: Linear / Vercel / Apple Wallet.

Tokens CSS exactos (defínelos en `:root` y redefine solo lo necesario en dark):

```css
:root{
  --bg:#ffffff; --bg-2:#fafafa; --bg-3:#f4f4f5;
  --fg:#0a0a0a; --fg-2:#71717a; --fg-3:#a1a1aa;
  --line:#e4e4e7;
  --pos:#12a150; --neg:#e5484d; --warn:#d9880a;
  --r:14px;
}
@media (prefers-color-scheme: dark){
  :root{
    --bg:#0b0b0c; --bg-2:#141416; --bg-3:#1c1c1f;
    --fg:#fafafa; --fg-2:#a1a1aa; --fg-3:#71717a;
    --line:#27272a;
    --pos:#3dd68c; --neg:#ff6369; --warn:#ffb224;
  }
}
```

Reglas:
- Tipografía del sistema (`-apple-system, system-ui`). Todos los montos con
  `font-variant-numeric: tabular-nums` para que las columnas de números no bailen.
- Bordes de 1px, radios de 14px, **sin sombras** (o una sombra apenas perceptible en los bottom
  sheets). Sin degradados. Sin animaciones decorativas — solo transiciones de 150ms en estados.
- **Iconos: SVG inline estilo Lucide**, trazo 1.5px, `currentColor`. **Nunca emojis, nunca CDN.**
  Van en `js/iconos/svg.js` (el mapa `{nombre: '<path .../>'}`) y `js/iconos/render.js` (el helper).
- **Mobile-first de verdad:** diseñado a 390px de ancho; si escala a desktop es bonus.
  - Tab bar inferior fija con 5 pestañas, con `padding-bottom: env(safe-area-inset-bottom)`.
  - `padding-top: env(safe-area-inset-top)` en el header.
  - Todo lo tocable mide mínimo 44×44px.
  - Los formularios se abren como **bottom sheet** que sube desde abajo, no como modal centrado.
  - `<input type="number" inputmode="decimal">` en los montos para que salga el teclado numérico.
  - Nada que dependa de `:hover`.
- Fechas siempre en formato `DD/mmm/YYYY` (ej. `08/sep/2026`). Montos con separador de miles.
- Debe existir un botón de **ocultar montos** (los reemplaza por `••••••`) para revisar la app en público.

## 2 bis. Reglas transversales — se aplican a TODA la app, siempre

Estas no son de una pantalla: valen para cualquier pantalla ya construida o por construir.
Si una pantalla nueva las incumple, está mal aunque el resto funcione.

### Montos

- **Todo monto se muestra como `$000.00`**: siempre con el signo de peso, siempre con separador
  de miles y siempre con exactamente **dos decimales**. Nunca `$1,234`, nunca `1234.5`, nunca
  un monto sin `$`. Vale para cifras grandes, filas de lista, badges, gráficas y diálogos de
  confirmación.
- Los negativos van con `−` delante del signo (`−$80.00`) y, donde aporte, `+` en los positivos.
- **Todos los inputs de monto se formatean solos mientras se escribe**, y siempre muestran los
  dos decimales. Sin excepción: montos de movimientos, saldo inicial de cuentas, límite de
  tarjetas, montos del plan, mínimos y máximos.
- **Se teclea estilo calculadora: no se escribe el punto decimal.** Los dígitos entran por la
  derecha y los dos últimos son siempre los centavos, así que teclear `1`,`0`,`0`,`0` muestra
  `$10.00` (no `$1,000`). Borrar un dígito recorre el decimal hacia la izquierda. Es lo que
  hacen las apps de banco: en el teclado del teléfono no hay que buscar el punto.
- Por eso los campos de monto son `type="text"` con `inputmode="decimal"` (un `type="number"`
  rechaza las comas y no se puede formatear). El `$` es un prefijo del campo, no parte del valor,
  y el cursor va siempre al final.
- El valor que llega al repositorio siempre es un **número**, no la cadena formateada.

### Categorías dependientes del tipo

- Una categoría pertenece a **un solo** tipo de movimiento. En **cualquier** lugar donde se
  elija una categoría junto a un tipo, solo se ofrecen las de ese tipo.
- Esto incluye los **filtros**: si filtro por Egreso, el selector de categorías solo lista las
  de egreso; si el tipo está en **Todos**, se listan todas. Al cambiar el tipo, el selector de
  categorías se repinta y conserva la selección solo si sigue siendo válida.

## 3. Modelo de datos

Crea `sql/01_schema.sql` con exactamente esto — lo voy a pegar en el SQL Editor de Supabase:

```sql
-- ============================================================================
--  Finanzas — esquema completo. Idempotente: se puede volver a correr.
-- ============================================================================

do $$ begin create type tipo_mov as enum ('ingreso','egreso','transferencia');
exception when duplicate_object then null; end $$;
do $$ begin create type tipo_cuenta as enum ('efectivo','bancaria','ahorro','otro');
exception when duplicate_object then null; end $$;
do $$ begin create type clase_plan as enum ('ingreso','gasto');
exception when duplicate_object then null; end $$;
do $$ begin create type variabilidad as enum ('fijo','variable');
exception when duplicate_object then null; end $$;

create table if not exists cuentas (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre        text not null,
  tipo          tipo_cuenta not null default 'bancaria',
  saldo_inicial numeric(14,2) not null default 0,
  color         text,
  orden         int not null default 0,
  archivada     boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Una categoría pertenece a UN tipo de movimiento.
create table if not exists categorias (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre     text not null,
  tipo       tipo_mov not null,
  icono      text not null default 'tag',
  orden      int not null default 0,
  archivada  boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists tarjetas (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre           text not null,
  banco            text,
  ultimos_4        text,
  limite_credito   numeric(14,2) not null default 0,
  dia_corte        int not null check (dia_corte between 1 and 31),
  dia_limite_pago  int not null check (dia_limite_pago between 1 and 31),
  cuenta_pago_id   uuid references cuentas(id) on delete set null,
  color            text,
  orden            int not null default 0,
  archivada        boolean not null default false,
  created_at       timestamptz not null default now()
);

-- Compras diferidas a meses SIN INTERESES (tasa cero).
create table if not exists compras_cuotas (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tarjeta_id   uuid not null references tarjetas(id) on delete cascade,
  descripcion  text not null,
  monto_total  numeric(14,2) not null check (monto_total > 0),
  num_cuotas   int not null check (num_cuotas between 2 and 60),
  fecha_compra date not null,
  categoria_id uuid references categorias(id) on delete set null,
  comercio     text,
  created_at   timestamptz not null default now()
);

--  ingreso        -> entra a cuenta_id
--  egreso         -> sale de cuenta_id  O  se carga a tarjeta_id (compra a crédito)
--  transferencia  -> sale de cuenta_id hacia cuenta_destino_id
--                    O hacia tarjeta_destino_id (= pago de tarjeta)
create table if not exists movimientos (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo               tipo_mov not null,
  monto              numeric(14,2) not null check (monto > 0),
  fecha              date not null default current_date,
  descripcion        text not null,
  categoria_id       uuid references categorias(id) on delete set null,
  cuenta_id          uuid references cuentas(id) on delete cascade,
  cuenta_destino_id  uuid references cuentas(id) on delete cascade,
  tarjeta_id         uuid references tarjetas(id) on delete cascade,
  tarjeta_destino_id uuid references tarjetas(id) on delete cascade,
  compra_id          uuid references compras_cuotas(id) on delete cascade,
  cuota_num          int,
  cuota_total        int,
  comercio           text,
  nota               text,
  created_at         timestamptz not null default now(),
  constraint mov_origen_valido check (
    (tipo = 'ingreso'       and cuenta_id is not null and tarjeta_id is null)
 or (tipo = 'egreso'        and (cuenta_id is not null) <> (tarjeta_id is not null))
 or (tipo = 'transferencia' and cuenta_id is not null
                            and ((cuenta_destino_id is not null) <> (tarjeta_destino_id is not null)))
  )
);

create index if not exists idx_mov_fecha   on movimientos (user_id, fecha desc);
create index if not exists idx_mov_tarjeta on movimientos (tarjeta_id, fecha);
create index if not exists idx_mov_cuenta  on movimientos (cuenta_id, fecha);
create index if not exists idx_mov_compra  on movimientos (compra_id);

-- Lo que ESPERAS que pase cada mes. Alimenta el planificador.
create table if not exists plan_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre        text not null,
  clase         clase_plan not null,
  variabilidad  variabilidad not null default 'fijo',
  monto         numeric(14,2),
  monto_min     numeric(14,2),
  monto_max     numeric(14,2),
  dia_mes       int check (dia_mes between 1 and 31),
  cuenta_id     uuid references cuentas(id) on delete set null,
  tarjeta_id    uuid references tarjetas(id) on delete set null,
  categoria_id  uuid references categorias(id) on delete set null,
  activo        boolean not null default true,
  orden         int not null default 0,
  created_at    timestamptz not null default now(),
  constraint plan_monto_valido check (
    (variabilidad = 'fijo'     and monto is not null)
 or (variabilidad = 'variable' and monto_min is not null and monto_max is not null
                               and monto_max >= monto_min)
  )
);

-- ------------------------------------------------------------------ RLS ----
do $$
declare t text;
begin
  foreach t in array array['cuentas','categorias','tarjetas','compras_cuotas','movimientos','plan_items']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "propio_%s" on %I', t, t);
    execute format(
      'create policy "propio_%s" on %I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
  end loop;
end $$;

-- ------------------------------------------------------- datos por defecto -
create or replace function sembrar_datos_iniciales()
returns json language plpgsql security invoker as $$
declare uid uuid := auth.uid(); n_cuentas int; n_cats int;
begin
  if uid is null then raise exception 'no autenticado'; end if;
  select count(*) into n_cuentas from cuentas    where user_id = uid;
  select count(*) into n_cats    from categorias where user_id = uid;

  if n_cuentas = 0 then
    insert into cuentas (user_id, nombre, tipo, saldo_inicial, orden) values
      (uid,'Efectivo','efectivo',0,1),
      (uid,'Banco','bancaria',0,2),
      (uid,'Ahorros','ahorro',0,3);
  end if;

  if n_cats = 0 then
    insert into categorias (user_id, nombre, tipo, icono, orden) values
      (uid,'Sueldo','ingreso','wallet',1),
      (uid,'Freelance','ingreso','laptop',2),
      (uid,'Venta','ingreso','tag',3),
      (uid,'Regalo','ingreso','gift',4),
      (uid,'Reembolso','ingreso','rotate',5),
      (uid,'Otro ingreso','ingreso','plus',6),
      (uid,'Comida','egreso','utensils',1),
      (uid,'Supermercado','egreso','cart',2),
      (uid,'Transporte','egreso','car',3),
      (uid,'Vivienda','egreso','home',4),
      (uid,'Servicios','egreso','zap',5),
      (uid,'Salud','egreso','heart',6),
      (uid,'Entretenimiento','egreso','film',7),
      (uid,'Suscripciones','egreso','repeat',8),
      (uid,'Ropa','egreso','shirt',9),
      (uid,'Educación','egreso','book',10),
      (uid,'Mascotas','egreso','paw',11),
      (uid,'Otro gasto','egreso','minus',12),
      (uid,'Pago de tarjeta','transferencia','card',1),
      (uid,'Ahorro','transferencia','piggy',2),
      (uid,'Retiro efectivo','transferencia','banknote',3),
      (uid,'Entre cuentas','transferencia','arrows',4);
  end if;

  return json_build_object('cuentas_creadas', n_cuentas = 0, 'categorias_creadas', n_cats = 0);
end $$;

grant execute on function sembrar_datos_iniciales() to authenticated;
```

Notas de implementación sobre el modelo:
- El **saldo de una cuenta** se calcula, no se guarda: `saldo_inicial` + ingresos − egresos
  − transferencias salientes + transferencias entrantes. Calcúlalo en el cliente.
- Cuentas y categorías por defecto se siembran llamando al RPC `sembrar_datos_iniciales` la primera
  vez que entro. **Todas deben poder editarse y eliminarse** desde la app, ninguna es intocable.
  Si una categoría está en uso, al eliminarla los movimientos quedan sin categoría (`set null`),
  no se borran — avísame en el diálogo de confirmación cuántos movimientos se van a quedar sin ella.

## 4. Pantallas

Tab bar inferior de 5: **Resumen · Movimientos · Tarjetas · Plan · Ajustes**.
Botón flotante "+" persistente para registrar un movimiento en 3 toques.

### Resumen
- Patrimonio líquido (suma de cuentas) y deuda total de tarjetas, grandes, arriba.
- Del mes en curso: entró / salió / neto.
- Lista compacta de cuentas con su saldo.
- Próximos vencimientos (7–14 días): cortes y fechas límite de tarjetas, gastos fijos.
- Últimos 5 movimientos.

### Movimientos
- Lista agrupada por día, orden descendente, scroll infinito o paginado de 50.
- Filtros: mes, tipo, cuenta/tarjeta, categoría, búsqueda por texto.
- Formulario (bottom sheet) con selector de tipo arriba: **Ingreso / Egreso / Transferencia**.
  El formulario cambia según el tipo, y **las categorías que se ofrecen son solo las de ese tipo**:
  - Ingreso: monto, fecha, descripción, categoría, **cuenta destino**.
  - Egreso: monto, fecha, descripción, categoría, **origen = cuenta O tarjeta de crédito**.
  - Transferencia: monto, fecha, descripción, categoría, **cuenta origen** → **destino: otra cuenta
    o una tarjeta** (si el destino es tarjeta, eso ES un pago de tarjeta y debe reducir su deuda).
- Editar y eliminar cualquier movimiento, con confirmación al eliminar.

### Tarjetas
Card por tarjeta mostrando:
- Nombre, banco, últimos 4, límite.
- **Deuda total** y **barra de uso del límite** (%).
- **Saldo al corte** = lo que debo pagar ahora, y **la fecha límite de pago con "quedan N días"**
  (en ámbar si faltan ≤5 días, en rojo si ya venció).
- **Nuevo ciclo** = lo gastado después del último corte, que se cobrará en el próximo corte, con la
  fecha del próximo corte y "faltan N días".
- **Saldo a favor** si pagué de más (badge verde).
- **Comprometido en cuotas** = suma de cuotas futuras aún no cobradas.
- Botón **Pagar** con montos automáticos: `Pagar el corte` · `Pagar todo` · `Otro monto`.
  Genera una transferencia desde la `cuenta_pago_id` hacia la tarjeta.
- Botón **Compra a cuotas** (ver abajo).
- Detalle de la tarjeta: movimientos agrupados en tres bloques — *anterior al corte*,
  *corte actual*, *ciclo abierto* — y la lista de compras a cuotas con su progreso (`3/12`).

### Plan  ← esta es la pantalla más importante
Ver sección 6.

### Ajustes
- Cuentas: crear / editar / eliminar / reordenar / archivar.
- Categorías: agrupadas por tipo (ingreso/egreso/transferencia), crear / editar / eliminar / reordenar.
- **Fijos y variables** (alimenta el Plan): cuatro grupos editables —
  *Ingresos fijos* (sueldo el día 30), *Ingresos variables* (freelance, entre X y Y al mes),
  *Gastos fijos* (renta el día 1, Netflix el 5 en la tarjeta), *Gastos variables*
  (comida entre X y Y al mes). Cada uno con su cuenta o tarjeta asociada.
- Exportar todo a JSON y volver a importarlo (respaldo manual).
- Cerrar sesión. Ocultar montos.

## 5. Lógica de tarjetas — impleméntala exactamente así

En `js/calc/ciclo-tarjeta.js` (fechas), `js/calc/deuda-tarjeta.js` (cubetas y cascada) y
`js/calc/cuotas.js`. Funciones puras: sin red, sin DOM, con pruebas en `test.html`.

**Fechas del ciclo** — `calcularCiclo(diaCorte, diaLimitePago, hoy)`:
- Si el día no existe en el mes (corte 31 en febrero) se ajusta al último día del mes.
- `fechaUltimoCorte` = el corte más reciente que sea `<= hoy`.
- `fechaProximoCorte` = el siguiente corte después de hoy.
- `fechaLimiteDelCorte` = el primer día `diaLimitePago` que cae **después** de `fechaUltimoCorte`
  (si `diaLimitePago <= diaCorte`, cae el mes siguiente al corte).

**Saldos** — dado el historial de cargos y pagos de la tarjeta:
- `cargos` = movimientos `egreso` con `tarjeta_id` (incluye cuotas).
- `pagos` = movimientos `transferencia` con `tarjeta_destino_id`.
- Divide los cargos en tres cubetas por fecha:
  `deuda_vieja` (≤ corte anterior al último), `saldo_al_corte` (dentro del último ciclo cerrado),
  `nuevo_ciclo` (> `fechaUltimoCorte`).
- **Los pagos se aplican en cascada, lo más viejo primero:** primero saldan `deuda_vieja`, luego
  `saldo_al_corte`, luego `nuevo_ciclo`; lo que sobre es `saldo_a_favor`.
- `deuda_total` = suma de las tres cubetas después de aplicar pagos.

**Compras a cuotas tasa cero:**
- Al guardar una compra en `compras_cuotas`, la app genera **N movimientos** tipo `egreso` con
  `tarjeta_id`, `compra_id`, `cuota_num` y `cuota_total`.
- `monto_cuota = redondear(monto_total / num_cuotas, 2)`, y **la última cuota absorbe el residuo**
  para que la suma dé exactamente `monto_total` (nada de perder centavos).
- La cuota *k* tiene `fecha = fecha_compra + (k−1) meses`, ajustando si el día no existe en ese mes.
- Descripción generada: `"Laptop — cuota 3/12"`.
- **Tasa cero: no calcules intereses.** No hay campo de tasa y no debe haberlo.
- Editar la compra = borrar y regenerar sus cuotas **no pagadas**; eliminarla borra sus cuotas
  (el `on delete cascade` ya lo hace, pero confírmame antes diciendo cuántas cuotas se borran).
- Las cuotas futuras cuentan como *comprometido*, no como deuda actual, hasta que su fecha llegue.

## 6. El planificador de pagos — el corazón de la app

Pantalla **Plan**. El cálculo va en `js/calc/plan/` partido en tres (`linea-tiempo.js`,
`asignar.js`, `veredicto.js`); la vista en `js/pages/plan.js`, que no hace aritmética.

**Pregunta que debe responder:** *"con el dinero que voy a recibir y cuándo lo voy a recibir,
¿qué pago con qué, y en qué orden, para no quedar corto?"*

**Entradas:**
- Saldos actuales de todas las cuentas.
- Ingresos de `plan_items` (`clase='ingreso'`) con su `dia_mes` y su cuenta destino.
  Los variables se calculan por defecto con `monto_min` (escenario conservador).
- Gastos fijos de `plan_items` (`clase='gasto', variabilidad='fijo'`) con su `dia_mes`.
- Gastos variables (`variabilidad='variable'`): **no se agendan a una fecha**; se reservan como
  colchón del mes y se restan del disponible.
- Pagos de tarjeta: por cada tarjeta, el `saldo_al_corte` con vencimiento en `fechaLimiteDelCorte`,
  y los cortes futuros que caigan dentro del horizonte (proyectando el `nuevo_ciclo` + cuotas).
- Horizonte seleccionable: **Este mes · Próximos 30 días · Próximos 60 días · 3 meses**.

**Algoritmo — asignación por vencimiento más próximo primero:**
1. Construye una línea de tiempo ordenada por fecha con todos los eventos (ingresos y obligaciones).
2. Recorre día a día llevando el saldo de cada cuenta.
3. Cada ingreso suma a su cuenta.
4. Cada obligación intenta pagarse desde su cuenta asignada. Si esa cuenta no alcanza pero **otra sí
   tiene excedente**, propón una transferencia explícita ("mueve $X de Ahorros a Banco antes del 22").
5. Si aun así no alcanza → **alerta de faltante**, con el monto exacto y la fecha.
6. Reserva el colchón de gastos variables antes de declarar dinero "libre".

**Salida en pantalla — en español llano, no en tablas frías:**
- Un veredicto arriba: *"Alcanza"* (verde) / *"Justo"* (ámbar) / *"No alcanza"* (rojo), con una
  frase que lo explique.
- **Sobres por ingreso** — lo que más quiero ver:
  > **Sueldo del 15 · $2,400**
  > → Tarjeta BBVA · $840 · vence el 22
  > → Renta · $700 · vence el 1
  > → Colchón comida · $400
  > **Libre: $460**
- **Alertas** concretas: *"El pago de Amex vence el 28 y ningún ingreso llega antes — te faltan $320."*
- **Rango por los variables:** *"Si los gastos variables se van al máximo, te quedan $120 en vez de
  $460; con el mínimo aguanta cómodo."*
- Una gráfica **SVG inline dibujada a mano** (sin librerías) del saldo día a día en el horizonte,
  marcando la zona bajo cero en rojo y el día más ajustado.

Todo determinista: son reglas y aritmética, sin IA, sin llamadas externas.

## 7. PWA — instalación en el iPhone

- `manifest.json` con `display: standalone`, `theme_color` y `background_color` que coincidan con
  los tokens, `start_url: "/"`, nombre corto para el icono del home screen.
- `apple-touch-icon` **PNG de 180×180** + iconos de 192 y 512 para el manifest. Genera los PNG con
  un script propio (Python + zlib, o `qlmanage` de macOS para rasterizar un SVG) — un diseño
  minimalista monocromo, sin texto pequeño.
- `<meta name="apple-mobile-web-app-capable" content="yes">` y
  `<meta name="theme-color">` con variante para dark mode.
- `sw.js`: precachea el shell completo (HTML, CSS, JS, iconos) con estrategia *cache-first* para los
  estáticos y *network-first* para los datos. Versiona el cache y limpia los viejos al activarse, de
  modo que un `git push` se refleje al abrir la app sin reinstalar.
- Debe abrir y mostrar la última data conocida **sin internet**; solo las escrituras requieren red.

## 8. Arquitectura — SOLID pragmático y archivos chicos

**Regla dura: ningún archivo pasa de 200 líneas, ninguna función pasa de 40.** Si algo crece más,
se parte. Vengo de una app donde terminé con archivos de 80,000 caracteres y no quiero repetirlo.
Cuando un archivo se acerque al límite, divídelo por responsabilidad y dime cómo lo partiste.

Aplica SOLID **en su versión pragmática para JS vanilla**. Quiero la disciplina, no la ceremonia:
nada de clases donde basta una función, nada de interfaces simuladas, nada de contenedor de
inyección de dependencias, nada de factories que solo envuelven un `new`. Si una abstracción no
elimina un `if` o no permite testear algo aislado, no la agregues.

Qué significa cada letra aquí, en concreto:

- **S — una responsabilidad por archivo.** Un archivo o calcula, o habla con la red, o pinta DOM,
  o coordina. Nunca dos. En particular: **las vistas no hacen `fetch` ni aritmética de dinero**,
  y los módulos de cálculo no tocan el DOM.
- **O — abierto/cerrado por tabla, no por `if`.** Donde el comportamiento varía por tipo, usa un
  mapa en vez de un `switch`. Ejemplo concreto: los tres tipos de movimiento se definen en
  `js/movimientos/tipos.js` como `{ ingreso: {...}, egreso: {...}, transferencia: {...} }`, cada
  uno con sus campos, su validación y su efecto sobre saldos. Agregar un tipo debe ser agregar una
  entrada al mapa, sin editar el formulario ni la lista. Lo mismo con los iconos y los renderers.
- **L — los repositorios comparten contrato.** Todos exponen la misma forma
  (`listar / obtener / crear / actualizar / eliminar`) y son intercambiables. Eso me permite
  cambiar un repo real por uno en memoria en las pruebas sin tocar la vista.
- **I — exports angostos.** Prohibido un `store.js` que lo sepa todo. Cada página importa solo los
  repositorios que usa. Ningún módulo exporta un objeto gigante con veinte métodos; exporta
  funciones nombradas.
- **D — la vista depende de abstracciones, no de Supabase.** Las páginas importan repositorios; los
  repositorios usan `api/client.js`; **solo `api/client.js` sabe que existe Supabase y hace `fetch`.**
  Si algún día cambio de backend, toco un archivo. El cliente HTTP se le **pasa** al repositorio,
  no se importa como singleton dentro de él.

Capas, y la dirección de las dependencias (nunca al revés):

```
pages/  →  repos/  →  api/client.js  →  red
   ↓         ↓
  ui/      calc/          (calc/ no importa nada: funciones puras)
```

Estructura de archivos que espero:

```
/
├── index.html            shell + tab bar; las vistas se montan por JS
├── manifest.json
├── sw.js
├── test.html             corre las pruebas de calc/ y muestra pasa/falla
├── icons/                180 / 192 / 512 png
├── css/
│   ├── tokens.css        variables de color, tipografía, radios
│   ├── base.css          reset, layout, tab bar, safe areas
│   └── componentes.css   botones, inputs, cards, bottom sheet, badges
├── js/
│   ├── main.js           arranque: sesión, router, primer render
│   ├── config.js         SUPABASE_URL y ANON_KEY (los pongo yo)
│   ├── router.js         hash routing
│   ├── api/
│   │   ├── client.js     ÚNICO archivo que hace fetch y conoce Supabase
│   │   ├── sesion.js     login, logout, refresh, persistencia del token
│   │   └── errores.js    traduce errores de la API a mensajes en español
│   ├── repos/            uno por entidad, mismo contrato CRUD
│   │   ├── cuentas.js · categorias.js · tarjetas.js
│   │   ├── movimientos.js · compras.js · plan-items.js
│   ├── calc/             funciones PURAS, sin red ni DOM, testeables
│   │   ├── fechas.js         clamp de día del mes, sumar meses, formato
│   │   ├── dinero.js         redondeo a 2 decimales, reparto sin perder centavos
│   │   ├── saldos.js         saldo de cuenta a partir de movimientos
│   │   ├── ciclo-tarjeta.js  fechas de corte y de límite de pago
│   │   ├── deuda-tarjeta.js  cubetas + cascada de pagos
│   │   ├── cuotas.js         generación de cuotas tasa cero
│   │   └── plan/
│   │       ├── linea-tiempo.js   arma los eventos ordenados por fecha
│   │       ├── asignar.js        reparte ingresos a obligaciones
│   │       └── veredicto.js      alcanza / justo / no alcanza + alertas
│   ├── ui/               componentes sin lógica de negocio
│   │   ├── sheet.js · confirmar.js · toast.js
│   │   ├── campos.js     inputs de monto, fecha, selector
│   │   ├── lista.js      filas y agrupación por día
│   │   └── grafica.js    SVG inline dibujado a mano
│   ├── iconos/
│   │   ├── svg.js        el mapa {nombre: path}
│   │   └── render.js     helper icon(nombre, tamaño)
│   ├── movimientos/
│   │   ├── tipos.js      el mapa que define ingreso/egreso/transferencia
│   │   └── formulario.js se construye leyendo tipos.js
│   └── pages/
│       ├── resumen.js · movimientos.js · tarjetas.js · plan.js
│       └── ajustes/      cuentas.js · categorias.js · fijos-variables.js · datos.js
├── sql/01_schema.sql
└── README.md             pasos de setup, en español
```

Si una página se pasa de 200 líneas, sepárala en `pages/x/vista.js` (pinta) y `pages/x/acciones.js`
(maneja eventos y llama repos). No la dejes crecer.


## 9. Cómo quiero que trabajes

- **Habla y comenta el código en español.** Nombres de variables y tablas en español, como el schema.
- Respeta los límites de la sección 8 mientras escribes, no como limpieza al final. Si un archivo se
  te está yendo de 200 líneas, párate y pártelo en ese momento.
- Construye en este orden y **para al final de cada paso a mostrarme**, no me entregues todo de golpe:
  1. `sql/01_schema.sql` + `README.md` con los pasos de setup → los corro yo antes de seguir.
  2. Esqueleto de arquitectura: `api/client.js`, `api/sesion.js`, el contrato de `repos/` con **una**
     entidad implementada (cuentas), `router.js`, y los tres CSS con los tokens. Login funcionando.
     Quiero revisar la forma antes de que la repliques seis veces.
  3. Cuentas + categorías (CRUD completo) + siembra de datos por defecto.
  4. `movimientos/tipos.js` y el formulario que se construye a partir de ese mapa; lista y filtros.
  5. Tarjetas: `calc/ciclo-tarjeta.js` y `calc/deuda-tarjeta.js` primero **con sus pruebas**, después
     la pantalla y el pago.
  6. `calc/cuotas.js` con pruebas, después la UI de compra a cuotas tasa cero.
  7. Fijos y variables en Ajustes.
  8. `calc/plan/` con pruebas, después la pantalla del planificador.
  9. PWA: manifest, iconos, service worker.
- **Todo lo que viva en `js/calc/` va con pruebas.** Escribe los casos ANTES de la implementación en
  `test.html`: un archivo que importa las funciones puras, corre asserts y pinta una lista de
  pasa/falla. Sin frameworks, sin `npm`. Casos que quiero ver cubiertos sí o sí:
  - corte el día 31 en febrero, y día límite menor que el día de corte (cae el mes siguiente)
  - cascada de pagos con pago parcial, pago exacto y sobrepago (saldo a favor)
  - reparto de cuotas donde `monto_total / num_cuotas` no da exacto: las cuotas deben sumar el total
  - planificador con un ingreso que llega después del vencimiento → debe reportar faltante
- No agregues funciones que no pedí. Nada de presupuestos, metas de ahorro, multi-moneda, intereses,
  ni compartir con otros usuarios. Si crees que falta algo, dilo en una línea y sigue.
- Cuando termines un paso, dime exactamente **qué tengo que hacer yo** (correr un SQL, pegar una
  key, hacer push) en pasos numerados, y reporta el largo de los archivos que tocaste si alguno
  pasó de 150 líneas.


## 10. Setup que voy a hacer yo

Guíame con estos pasos en el `README.md`:
1. Crear proyecto gratis en supabase.com; copiar `Project URL` y la `anon key` a `js/config.js`.
2. Pegar `sql/01_schema.sql` en el SQL Editor y ejecutarlo.
3. Crear mi usuario en Authentication → Users → Add user (email + contraseña).
4. Publicar el repo en Cloudflare Pages conectando GitHub (sin build command; carpeta raíz).
5. Abrir la URL en Safari del iPhone → Compartir → Añadir a pantalla de inicio.

Empieza por el paso 1 de la sección 9.

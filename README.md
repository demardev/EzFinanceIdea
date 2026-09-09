# Finanzas

App personal de finanzas. PWA para iPhone, HTML + CSS + JavaScript vanilla (sin build, sin
`npm install`, sin dependencias) sobre Supabase.

- **Frontend:** archivos estáticos servidos tal cual.
- **Backend:** Supabase (Postgres free tier), hablado directo por REST con `fetch`.
- **Hosting:** Cloudflare Pages (o GitHub Pages). Deploy con `git push`.

---

## Setup (una sola vez)

### 1. Crear el proyecto en Supabase

1. Entra a [supabase.com](https://supabase.com) y crea un proyecto gratis.
2. Cuando termine de aprovisionarse, ve a **Project Settings → API** y copia:
   - **Project URL** → algo como `https://abcdefgh.supabase.co`
   - **anon public key** → el JWT largo que empieza con `eyJ...`
3. Pégalos en `js/config.js` (ese archivo se crea en el paso 2 de la construcción):

   ```js
   export const SUPABASE_URL = 'https://abcdefgh.supabase.co';
   export const ANON_KEY     = 'eyJ...';
   ```

   La `anon key` es pública por diseño: no da acceso a nada porque **RLS** está activo en todas las
   tablas y cada fila queda amarrada a `auth.uid()`. La que **nunca** se pone aquí es la
   `service_role key`.

### 2. Crear el esquema

1. En el dashboard, abre **SQL Editor → New query**.
2. Pega el contenido completo de [`sql/01_schema.sql`](sql/01_schema.sql) y dale **Run**.
3. Debe terminar con `Success. No rows returned`.

El script es **idempotente**: se puede volver a correr sin romper nada ni borrar datos. Crea:

| Tabla            | Para qué                                                          |
|------------------|-------------------------------------------------------------------|
| `cuentas`        | Efectivo, bancos, ahorros. El saldo se calcula, no se guarda.      |
| `categorias`     | Cada una pertenece a un solo tipo de movimiento.                   |
| `tarjetas`       | Crédito: límite, día de corte, día límite de pago, cuenta de pago. |
| `compras_cuotas` | Compras a meses sin intereses (tasa cero).                         |
| `movimientos`    | Ingresos, egresos y transferencias. Pagar tarjeta = transferencia. |
| `plan_items`     | Ingresos y gastos, fijos y variables. Alimenta el planificador.    |

Más el RPC `sembrar_datos_iniciales()`, que crea 3 cuentas y 22 categorías por defecto la primera
vez que entras (todas editables y borrables desde la app).

### 3. Crear tu usuario

**No hay pantalla de registro**, a propósito. El usuario se crea a mano:

1. **Authentication → Users → Add user → Create new user**.
2. Pon tu email y una contraseña.
3. Marca **Auto Confirm User** para no tener que confirmar por correo.
4. **Cierra los registros públicos:** Authentication → Sign In / Providers → Email →
   apaga **Allow new users to sign up**. Sin esto, cualquiera que vea el repo puede crearse
   una cuenta en tu proyecto (no vería tus datos, pero te consume el free tier).

### Sobre la `anon key` en `js/config.js`

Está en el repo a propósito y no es un descuido.

- **Es pública por diseño.** Cualquier app que hable con Supabase desde el navegador tiene que
  entregarle esta llave al navegador para firmar cada petición. Meterla en una variable de entorno
  no la esconde: los bundlers la escriben literal dentro del JS que se descarga.
- **Lo que protege los datos es RLS**, no el secreto de la llave. Con la anon key y sin login,
  las políticas del script no devuelven ni una fila.
- **La que sí es secreta es la `service_role` / secret key.** Esa se salta RLS. Nunca va al repo,
  ni a `config.js`, ni a un chat. Si alguna vez se filtra, se rota desde el dashboard.
- Si aun así prefieres que no aparezca en GitHub, pon el repo en **privado**: Cloudflare Pages
  despliega repos privados igual.

### 4. Publicar en Cloudflare Pages

1. Sube el repo a GitHub.
2. En [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages → Create → Pages →
   Connect to Git** y elige el repo.
3. Configuración del build:
   - **Framework preset:** `None`
   - **Build command:** *(vacío)*
   - **Build output directory:** `/`
4. **Save and Deploy**. Cada `git push` a `main` vuelve a publicar solo.

### 5. Instalar en el iPhone

1. Abre la URL de Cloudflare Pages en **Safari** (tiene que ser Safari, no Chrome).
2. Botón **Compartir** → **Añadir a pantalla de inicio**.
3. Ábrela desde el icono: arranca a pantalla completa, sin barra del navegador.

---

## Correr en local

Sin build ni dependencias, pero sí hace falta un servidor: los ES modules no cargan desde `file://`.

```bash
python3 -m http.server 8000
```

Y abre `http://localhost:8000`.

---

## Pruebas

Todo lo que vive en `js/calc/` son funciones puras (sin red, sin DOM) y va con pruebas.
Abre `test.html` en el navegador: corre los asserts y pinta la lista de pasa/falla. Sin frameworks.

---

## Respaldo

**Ajustes → Datos** baja un JSON con todo (cuentas, categorías, tarjetas, compras a cuotas,
movimientos y plan) y lo vuelve a subir. Es el respaldo manual, aparte del que Supabase hace
del Postgres.

- El JSON **no lleva `user_id`**: al importar lo pone la base con `auth.uid()`, así el respaldo
  se puede restaurar en otra cuenta.
- La importación es **idempotente**: usa upsert por id, así que meter dos veces el mismo archivo
  no duplica nada — actualiza lo que ya existía y crea lo que faltaba.
- En el iPhone, si el botón de descargar no hace nada (Safari en modo app es quisquilloso con
  las descargas), usa **Copiar al portapapeles** y pégalo donde lo quieras guardar.

## Instalada en el iPhone

La app es una PWA: se instala desde Safari con **Compartir → Añadir a pantalla de inicio** y a
partir de ahí abre a pantalla completa, sin barra del navegador.

- **Abre sin internet** y muestra la última data que descargó. Solo las escrituras necesitan red.
- Un `git push` se ve **en la siguiente apertura**: el service worker sirve del cache al instante
  y revalida en segundo plano.
- Si tocas archivos del shell (agregar un `.js`, por ejemplo), hay que actualizar la lista `SHELL`
  y subir `VERSION` en [`sw.js`](sw.js). Al activarse, borra los caches viejos.
- Los iconos se regeneran con `python3 icons/generar-iconos.py` (sin dependencias, solo zlib).

---

## Estructura

```
/
├── index.html            shell + tab bar; las vistas se montan por JS
├── manifest.json
├── sw.js                 precache del shell; funciona sin internet
├── test.html             pruebas de js/calc/
├── icons/                180 / 192 / 512 png
├── css/                  tokens.css · base.css · componentes.css
├── js/
│   ├── main.js           arranque: sesión, router, primer render
│   ├── config.js         SUPABASE_URL y ANON_KEY  ← los pones tú
│   ├── router.js
│   ├── api/              client.js (único que hace fetch) · sesion.js · errores.js
│   ├── repos/            uno por entidad, mismo contrato CRUD
│   ├── calc/             funciones puras: fechas, dinero, saldos, tarjetas, cuotas, plan/
│   ├── ui/               sheet, confirmar, toast, campos, lista, grafica
│   ├── iconos/           svg.js (mapa de paths) · render.js
│   ├── movimientos/      tipos.js (el mapa) · formulario.js
│   └── pages/            resumen · movimientos · tarjetas · plan · ajustes/
├── sql/01_schema.sql
└── README.md
```

Dependencias entre capas, siempre en esta dirección:

```
pages/  →  repos/  →  api/client.js  →  red
   ↓         ↓
  ui/      calc/          (calc/ no importa nada: funciones puras)
```

Reglas duras: ningún archivo pasa de 200 líneas, ninguna función pasa de 40. Solo `api/client.js`
sabe que existe Supabase.

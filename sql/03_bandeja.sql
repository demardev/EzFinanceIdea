-- ============================================================================
--  Bandeja de "Por confirmar": compras que llegan solas (hoy, de Apple Pay por
--  medio de un atajo del iPhone) y que tú confirmas en la app antes de que
--  sean movimientos. Idempotente: se puede volver a correr.
--
--  Cómo entra algo sin tu sesión: el atajo manda una CLAVE que generas en la
--  app. La base guarda solo su hash, y la única puerta que abre es
--  recibir_en_bandeja(), que solo puede AGREGAR a tu bandeja. Con la clave no
--  se lee nada, no se toca un movimiento ni una cuenta. Si se filtra, se
--  cambia desde Ajustes y la vieja deja de servir.
-- ============================================================================

-- ---------------------------------------------------------------- bandeja --
-- Sin fecha: la pone la app a partir de created_at, en TU zona horaria. Así
-- el atajo no tiene que formatearla, y el servidor (que vive en UTC) no
-- corre el día de las compras de la noche.
create table if not exists bandeja (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  origen     text not null default 'applepay' check (origen in ('applepay', 'sms', 'correo')),
  monto      numeric(14,2) not null check (monto > 0),
  comercio   text,
  tarjeta    text,            -- el nombre de la tarjeta tal como lo manda Wallet
  created_at timestamptz not null default now()
);

alter table bandeja enable row level security;
-- Leer y descartar lo propio. NO hay política de insert: solo entra por la
-- función de abajo.
drop policy if exists "bandeja_leer_propio" on bandeja;
create policy "bandeja_leer_propio" on bandeja
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "bandeja_descartar_propio" on bandeja;
create policy "bandeja_descartar_propio" on bandeja
  for delete to authenticated using (user_id = auth.uid());

-- ------------------------------------------------- tarjeta de Wallet -> app --
-- "Cuscatlán Visa" en Wallet es "CUSCATLAN TIGO" en la app. Se aprende la
-- primera vez que confirmas una compra de esa tarjeta. `origen` tiene la
-- forma del formulario de movimientos: 'tarjeta:<id>' o 'cuenta:<id>'.
create table if not exists wallet_origenes (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre     text not null,
  origen     text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, nombre)
);

alter table wallet_origenes enable row level security;
drop policy if exists "propio_wallet_origenes" on wallet_origenes;
create policy "propio_wallet_origenes" on wallet_origenes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- --------------------------------------------------- comercio -> categoría --
-- "starbucks" va en Comida. Se aprende al confirmar una compra; `comercio`
-- está normalizado (sin mayúsculas ni espacios de más, ver claveDeComercio()
-- en js/calc/bandeja.js). Si borras la categoría, se olvida sola.
create table if not exists comercio_categorias (
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  comercio     text not null,
  categoria_id uuid not null references categorias(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, comercio)
);

alter table comercio_categorias enable row level security;
drop policy if exists "propio_comercio_categorias" on comercio_categorias;
create policy "propio_comercio_categorias" on comercio_categorias for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ------------------------------------------------------------------ clave --
-- Una por usuario. Solo el hash: la clave en claro se enseña una vez, al
-- generarla, y no se puede volver a leer.
create table if not exists claves_entrada (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  hash       text not null unique,
  created_at timestamptz not null default now()
);

alter table claves_entrada enable row level security;
drop policy if exists "claves_ver_propia" on claves_entrada;
create policy "claves_ver_propia" on claves_entrada
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "claves_quitar_propia" on claves_entrada;
create policy "claves_quitar_propia" on claves_entrada
  for delete to authenticated using (user_id = auth.uid());

create or replace function hash_de_clave(clave text)
returns text language sql immutable as $$
  select encode(sha256(convert_to(clave, 'UTF8')), 'hex');
$$;

-- Genera (o cambia) la clave del usuario de esta sesión y la devuelve UNA vez.
-- Dos UUID v4 seguidos: 244 bits al azar, sin depender de pgcrypto.
create or replace function nueva_clave_entrada()
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid   uuid := auth.uid();
  clave text;
begin
  if uid is null then
    raise exception 'Hace falta iniciar sesión.' using errcode = '28000';
  end if;
  clave := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into claves_entrada (user_id, hash) values (uid, hash_de_clave(clave))
    on conflict (user_id) do update set hash = excluded.hash, created_at = now();
  return clave;
end $$;

revoke all on function nueva_clave_entrada() from public, anon;
grant execute on function nueva_clave_entrada() to authenticated;

-- "$1,234.56", "1234.56", "1.234,56" o un número: lo que mande el atajo.
create or replace function monto_de_texto(texto text)
returns numeric language plpgsql immutable as $$
declare limpio text := regexp_replace(coalesce(texto, ''), '[^0-9.,]', '', 'g');
begin
  if limpio ~ ',[0-9]{1,2}$' then
    limpio := replace(replace(limpio, '.', ''), ',', '.');   -- coma decimal
  else
    limpio := replace(limpio, ',', '');                       -- coma de miles
  end if;
  return round(limpio::numeric, 2);
exception when others then
  return null;
end $$;

-- La puerta del atajo. La puede llamar cualquiera con la llave pública, pero
-- sin una clave válida no hace nada, y con ella solo agrega a esa bandeja.
create or replace function recibir_en_bandeja(
  clave text, monto text, comercio text default null, tarjeta text default null,
  origen text default 'applepay')
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid   uuid;
  valor numeric := monto_de_texto(monto);
begin
  select c.user_id into uid from claves_entrada c where c.hash = hash_de_clave(clave);
  if uid is null then
    raise exception 'Clave no válida.' using errcode = '28000';
  end if;
  if valor is null or valor <= 0 or valor >= 1e9 then
    raise exception 'Monto no válido: %', left(monto, 40) using errcode = '22023';
  end if;
  -- Un atajo en bucle no llena la bandeja: más de 100 en una hora se rechaza.
  if (select count(*) from bandeja b
      where b.user_id = uid and b.created_at > now() - interval '1 hour') >= 100 then
    raise exception 'Demasiadas compras en una hora.' using errcode = '54000';
  end if;
  insert into bandeja (user_id, origen, monto, comercio, tarjeta)
  values (uid, origen, valor,
          nullif(left(trim(comercio), 120), ''), nullif(left(trim(tarjeta), 80), ''));
end $$;

revoke all on function recibir_en_bandeja(text, text, text, text, text) from public;
grant execute on function recibir_en_bandeja(text, text, text, text, text) to anon, authenticated;

-- Que PostgREST vea las funciones nuevas sin esperar.
notify pgrst, 'reload schema';

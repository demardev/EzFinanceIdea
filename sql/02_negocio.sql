-- ============================================================================
--  Negocio de pago de recibos. Idempotente: se puede volver a correr.
--
--  Añade tres cosas al esquema base:
--    1. `perfiles`  : la bandera que decide quién ve esta función.
--    2. `ambito`    : separa lo personal de lo del negocio en los movimientos.
--    3. `pagos_recibo` + bucket de fotos, con acceso restringido a la bandera.
--
--  Después de correrlo hay que encender tu bandera a mano (ver el final).
-- ============================================================================

-- --------------------------------------------------------------- perfiles --
-- Una fila por usuario. La bandera NO la puede cambiar el propio usuario:
-- las políticas solo permiten leer la fila propia. Se enciende desde aquí.
create table if not exists perfiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  negocio    boolean not null default false,
  created_at timestamptz not null default now()
);

alter table perfiles enable row level security;
drop policy if exists "perfiles_leer_propio" on perfiles;
create policy "perfiles_leer_propio" on perfiles
  for select to authenticated using (user_id = auth.uid());

-- ¿El usuario de esta sesión tiene el negocio activado?
-- La usan las políticas de abajo: la restricción vive en la base, no en la
-- interfaz, así que no sirve de nada saltarse el JavaScript.
create or replace function es_negocio()
returns boolean language sql stable security invoker as $$
  select exists (select 1 from perfiles p where p.user_id = auth.uid() and p.negocio);
$$;

grant execute on function es_negocio() to authenticated;

-- ------------------------------------------------------------ movimientos --
-- `ambito` separa lo personal de lo del negocio usando las MISMAS cuentas.
-- El patrimonio los suma todos (el dinero está ahí de verdad); lo que se
-- separa es el flujo de entró/salió.
do $$ begin create type ambito_mov as enum ('personal','negocio');
exception when duplicate_object then null; end $$;

alter table movimientos add column if not exists ambito ambito_mov not null default 'personal';

-- ------------------------------------------------------------ operaciones --
-- Un pago de recibo genera hasta tres movimientos:
--   egreso  monto_recibo   el día que pagas                     (siempre)
--   ingreso monto_recibo   el día que te pagan                  (al cobrar)
--   ingreso comision       el día que te pagan                  (al cobrar)
-- Con `fecha_cobro` en null la operación está PENDIENTE: pagaste de tu
-- bolsa y todavía te deben monto_recibo + comision.
create table if not exists pagos_recibo (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  monto_recibo    numeric(14,2) not null check (monto_recibo > 0),
  comision        numeric(14,2) not null default 0 check (comision >= 0),
  fecha_pago      date not null default current_date,
  cuenta_pago_id  uuid references cuentas(id) on delete set null,
  fecha_cobro     date,
  cuenta_cobro_id uuid references cuentas(id) on delete set null,
  foto_ruta       text,
  nota            text,
  created_at      timestamptz not null default now(),
  constraint cobro_completo check (
    (fecha_cobro is null) or (cuenta_cobro_id is not null)
  )
);

create index if not exists idx_pagos_pendientes on pagos_recibo (user_id, fecha_cobro);

-- Los movimientos generados quedan atados a su operación.
alter table movimientos add column if not exists pago_id uuid
  references pagos_recibo(id) on delete cascade;
create index if not exists idx_mov_pago on movimientos (pago_id);

-- Solo el dueño Y con la bandera encendida.
alter table pagos_recibo enable row level security;
drop policy if exists "pagos_recibo_propio" on pagos_recibo;
create policy "pagos_recibo_propio" on pagos_recibo for all to authenticated
  using      (user_id = auth.uid() and es_negocio())
  with check (user_id = auth.uid() and es_negocio());

-- ------------------------------------------------------ fotos de recibos --
-- Bucket privado. Las fotos se guardan como  <user_id>/<uuid>.jpg  y la
-- política corta por esa primera carpeta, así nadie ve las de otro.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recibos', 'recibos', false, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "recibos_propios" on storage.objects;
create policy "recibos_propios" on storage.objects for all to authenticated
  using      (bucket_id = 'recibos'
              and (storage.foldername(name))[1] = auth.uid()::text
              and es_negocio())
  with check (bucket_id = 'recibos'
              and (storage.foldername(name))[1] = auth.uid()::text
              and es_negocio());

-- ------------------------------------------- categorías propias del negocio -
-- Se llaman desde la app la primera vez que se detecta la bandera.
create or replace function sembrar_datos_negocio()
returns json language plpgsql security invoker as $$
declare uid uuid := auth.uid(); creadas int := 0;
begin
  if uid is null then raise exception 'no autenticado'; end if;
  if not es_negocio() then raise exception 'este usuario no tiene el negocio activado'; end if;

  insert into categorias (user_id, nombre, tipo, icono, orden)
  select uid, n.nombre, n.tipo::tipo_mov, n.icono, n.orden
  from (values
      ('Pago de recibo', 'egreso',  'banknote', 90),
      ('Cobro de recibo','ingreso', 'banknote', 90),
      ('Comisión',       'ingreso', 'tag',      91)
  ) as n(nombre, tipo, icono, orden)
  where not exists (
    select 1 from categorias c
    where c.user_id = uid and c.nombre = n.nombre and c.tipo = n.tipo::tipo_mov);

  get diagnostics creadas = row_count;
  return json_build_object('categorias_creadas', creadas);
end $$;

grant execute on function sembrar_datos_negocio() to authenticated;

-- ============================================================================
--  ENCENDER TU BANDERA
--  Corre esto aparte, con TU uuid (lo sacas de: select id, email from auth.users)
-- ============================================================================
-- insert into perfiles (user_id, negocio) values ('TU-UUID-AQUI', true)
--   on conflict (user_id) do update set negocio = true;

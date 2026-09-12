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
  -- Cuántas cuotas ya habías pagado al banco cuando registraste la compra.
  -- Aparecen en el historial y cuentan para el progreso, pero NO como deuda.
  cuotas_pagadas int not null default 0,
  fecha_compra date not null,
  categoria_id uuid references categorias(id) on delete set null,
  comercio     text,
  created_at   timestamptz not null default now()
);

-- Para bases creadas antes de que existiera la columna: el script es idempotente
-- y se puede volver a correr tal cual.
alter table compras_cuotas add column if not exists cuotas_pagadas int not null default 0;
do $$ begin
  alter table compras_cuotas drop constraint if exists cuotas_pagadas_valido;
  alter table compras_cuotas add constraint cuotas_pagadas_valido
    check (cuotas_pagadas >= 0 and cuotas_pagadas <= num_cuotas);
end $$;

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

-- ------------------------------------------------------------- saldos ------
-- Suma los movimientos por combinación de ruteo para que el cliente no tenga
-- que bajarse el historial entero solo para calcular saldos.
--
-- Devuelve filas con la MISMA forma que un movimiento (tipo, las dos cuentas y
-- un monto), así que deltaEnCuenta() de js/calc/saldos.js las lee igual: la
-- regla del dinero NO se duplica aquí, esto solo suma.
--
-- `hasta` lo manda el cliente con SU hoy: el del servidor es UTC y adelantaría
-- el corte unas horas, contando como tuyo dinero que todavía no llega.
create or replace function totales_de_movimientos(hasta date)
returns table (tipo tipo_mov, cuenta_id uuid, cuenta_destino_id uuid, monto numeric)
language sql stable security invoker as $$
  select m.tipo, m.cuenta_id, m.cuenta_destino_id, sum(m.monto)
  from movimientos m
  where m.user_id = auth.uid() and m.fecha <= hasta
  group by m.tipo, m.cuenta_id, m.cuenta_destino_id;
$$;

grant execute on function totales_de_movimientos(date) to authenticated;

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

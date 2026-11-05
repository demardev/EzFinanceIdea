-- ============================================================================
--  Planes, funciones, PIN de admin y préstamos. Requiere sql/07_admin.sql.
--  Idempotente: se puede volver a correr.
--
--  1. `funciones` + `planes` + `plan_funciones`: qué puede usar cada plan. El
--     plan de un usuario sale de `perfiles.premium_hasta` (vigente = premium).
--     Las funciones existen porque existe su código: se siembran aquí, y el
--     panel de admin solo decide en qué plan se encienden.
--  2. `tiene_funcion(clave)`: la usan las políticas. Ocultar el botón no
--     protege nada; esto sí.
--  3. PIN de admin: el panel pide PIN, y TODAS las funciones admin_* exigen
--     haberlo puesto hace menos de 30 minutos.
--  4. `prestamos` + `movimientos.prestamo_id`: lo que debes y lo que te deben.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------ planes y funciones --
create table if not exists funciones (
  clave       text primary key,
  nombre      text not null,
  descripcion text not null default ''
);
create table if not exists planes (
  clave  text primary key,
  nombre text not null,
  orden  int  not null default 0
);
create table if not exists plan_funciones (
  plan    text not null references planes(clave)    on delete cascade,
  funcion text not null references funciones(clave) on delete cascade,
  primary key (plan, funcion)
);

-- Sin políticas: nadie las lee directo. Se leen con las funciones de abajo.
alter table funciones      enable row level security;
alter table planes         enable row level security;
alter table plan_funciones enable row level security;

insert into planes (clave, nombre, orden) values ('normal', 'Normal', 1), ('premium', 'Premium', 2)
on conflict (clave) do nothing;
insert into funciones (clave, nombre, descripcion) values
  ('prestamos', 'Préstamos', 'Lo que debes y lo que te deben a personas, con pagos y avisos.')
on conflict (clave) do update set nombre = excluded.nombre, descripcion = excluded.descripcion;
-- Solo la primera vez: después lo decide el panel.
insert into plan_funciones (plan, funcion)
select 'premium', 'prestamos'
where not exists (select 1 from plan_funciones where funcion = 'prestamos');

create or replace function plan_de(p_usuario uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case when exists (select 1 from public.perfiles p
                           where p.user_id = p_usuario and p.premium_hasta >= current_date)
              then 'premium' else 'normal' end;
$$;

create or replace function tiene_funcion(p_clave text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.plan_funciones pf
                 where pf.funcion = p_clave and pf.plan = public.plan_de(auth.uid()));
$$;

-- Lo que la app enciende al arrancar.
create or replace function mis_funciones()
returns setof text language sql stable security definer set search_path = '' as $$
  select pf.funcion from public.plan_funciones pf where pf.plan = public.plan_de(auth.uid());
$$;

-- Para la función de avisos, que corre con la llave de servicio.
create or replace function funciones_de_usuario(p_usuario uuid)
returns setof text language sql stable security definer set search_path = '' as $$
  select pf.funcion from public.plan_funciones pf where pf.plan = public.plan_de(p_usuario);
$$;

-- ------------------------------------------------------------ PIN admin ---
-- Aparte de `perfiles`: el usuario lee su fila de perfiles, y el hash no
-- tiene por qué viajar a la app. Sin políticas: solo las funciones la tocan.
create table if not exists admin_acceso (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  pin_hash        text not null,
  intentos        int  not null default 0,
  bloqueado_hasta timestamptz,
  vigente_hasta   timestamptz
);
alter table admin_acceso enable row level security;

-- Ahora ser admin es la bandera Y un PIN puesto hace menos de 30 minutos.
create or replace function exigir_admin()
returns void language plpgsql stable security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.perfiles p where p.user_id = auth.uid() and p.admin) then
    raise exception 'Solo el administrador puede hacer esto.';
  end if;
  if not exists (select 1 from public.admin_acceso a
                 where a.user_id = auth.uid() and a.vigente_hasta > now()) then
    raise exception 'Pon tu PIN de administrador otra vez.';
  end if;
end $$;
revoke execute on function exigir_admin() from public, anon, authenticated;

-- Para la Edge Function `administrar`, que no puede llamar a exigir_admin().
create or replace function admin_vigente()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles p
                 join public.admin_acceso a on a.user_id = p.user_id
                 where p.user_id = auth.uid() and p.admin and a.vigente_hasta > now());
$$;

-- Devuelve el resultado en vez de lanzar: un error desharía la cuenta de
-- intentos fallidos. 'ok' | 'incorrecto' | 'bloqueado' | 'sin_pin' | 'no_admin'
create or replace function admin_entrar(p_pin text)
returns text language plpgsql security definer set search_path = '' as $$
declare fila public.admin_acceso;
begin
  if not exists (select 1 from public.perfiles p where p.user_id = auth.uid() and p.admin) then
    return 'no_admin';
  end if;
  select * into fila from public.admin_acceso where user_id = auth.uid();
  if not found then return 'sin_pin'; end if;
  if fila.bloqueado_hasta > now() then return 'bloqueado'; end if;

  if extensions.crypt(p_pin, fila.pin_hash) = fila.pin_hash then
    update public.admin_acceso set intentos = 0, bloqueado_hasta = null,
           vigente_hasta = now() + interval '30 minutes' where user_id = auth.uid();
    return 'ok';
  end if;
  -- Cinco fallos seguidos: 15 minutos sin poder intentar.
  update public.admin_acceso
     set intentos = case when intentos + 1 >= 5 then 0 else intentos + 1 end,
         bloqueado_hasta = case when intentos + 1 >= 5 then now() + interval '15 minutes' end
   where user_id = auth.uid();
  return 'incorrecto';
end $$;

-- Crear el PIN la primera vez, o cambiarlo sabiendo el actual.
create or replace function admin_poner_pin(p_actual text, p_nuevo text)
returns text language plpgsql security definer set search_path = '' as $$
declare fila public.admin_acceso;
begin
  if not exists (select 1 from public.perfiles p where p.user_id = auth.uid() and p.admin) then
    return 'no_admin';
  end if;
  if p_nuevo !~ '^[0-9]{4,8}$' then raise exception 'El PIN son de 4 a 8 números.'; end if;
  select * into fila from public.admin_acceso where user_id = auth.uid();
  if found and public.admin_entrar(coalesce(p_actual, '')) <> 'ok' then return 'incorrecto'; end if;
  insert into public.admin_acceso (user_id, pin_hash, vigente_hasta)
  values (auth.uid(), extensions.crypt(p_nuevo, extensions.gen_salt('bf')),
          now() + interval '30 minutes')
  on conflict (user_id) do update set pin_hash = excluded.pin_hash,
         vigente_hasta = excluded.vigente_hasta, intentos = 0, bloqueado_hasta = null;
  return 'ok';
end $$;

create or replace function admin_salir()
returns void language sql security definer set search_path = '' as $$
  update public.admin_acceso set vigente_hasta = null where user_id = auth.uid();
$$;

-- ------------------------------------------------- planes desde el panel ---
create or replace function admin_planes()
returns table (clave text, nombre text, funciones text[])
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform public.exigir_admin();
  return query
    select p.clave, p.nombre,
           coalesce(array_agg(pf.funcion order by pf.funcion)
                    filter (where pf.funcion is not null), '{}')
    from public.planes p
    left join public.plan_funciones pf on pf.plan = p.clave
    group by p.clave, p.nombre, p.orden
    order by p.orden;
end $$;

create or replace function admin_funciones()
returns table (clave text, nombre text, descripcion text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform public.exigir_admin();
  return query select f.clave, f.nombre, f.descripcion from public.funciones f order by f.nombre;
end $$;

create or replace function admin_poner_funcion(p_plan text, p_funcion text, p_activa boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_admin();
  if p_activa then
    insert into public.plan_funciones (plan, funcion) values (p_plan, p_funcion)
    on conflict do nothing;
  else
    delete from public.plan_funciones where plan = p_plan and funcion = p_funcion;
  end if;
end $$;

-- ------------------------------------------------------------- préstamos ---
do $$ begin create type direccion_prestamo as enum ('debo', 'me_deben');
exception when duplicate_object then null; end $$;

-- `pago` es el pago al mes pactado (o el mínimo). Sin él no hay calendario
-- ni avisos: solo el saldo. La regla vive en js/calc/prestamos.js.
create table if not exists prestamos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  direccion   direccion_prestamo not null,
  persona     text not null check (length(trim(persona)) > 0),
  concepto    text,
  monto_total numeric(14,2) not null check (monto_total > 0),
  pago        numeric(14,2) check (pago is null or pago > 0),
  num_pagos   int check (num_pagos is null or num_pagos between 1 and 600),
  primer_pago date,
  nota        text,
  created_at  timestamptz not null default now(),
  constraint prestamo_calendario check (pago is null or primer_pago is not null)
);

-- Los abonos son movimientos normales. Borrar el préstamo no borra el
-- dinero que ya se movió: sus abonos se quedan como movimientos sueltos.
alter table movimientos add column if not exists prestamo_id uuid
  references prestamos(id) on delete set null;
create index if not exists idx_mov_prestamo on movimientos (prestamo_id);

alter table prestamos enable row level security;
drop policy if exists "propio_prestamos" on prestamos;
create policy "propio_prestamos" on prestamos for all to authenticated
  using (user_id = auth.uid() and tiene_funcion('prestamos'))
  with check (user_id = auth.uid() and tiene_funcion('prestamos'));

-- ------------------------------------------------------------- permisos ---
-- Supabase da EXECUTE a anon en cada función nueva: aquí se le quita.
do $$
declare f text;
begin
  foreach f in array array['plan_de(uuid)', 'tiene_funcion(text)', 'mis_funciones()',
    'admin_vigente()', 'admin_entrar(text)', 'admin_poner_pin(text, text)', 'admin_salir()',
    'admin_planes()', 'admin_funciones()', 'admin_poner_funcion(text, text, boolean)']
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant  execute on function %s to authenticated', f);
  end loop;
end $$;
revoke execute on function funciones_de_usuario(uuid) from public, anon, authenticated;
grant  execute on function funciones_de_usuario(uuid) to service_role;
revoke execute on function plan_de(uuid) from authenticated;   -- solo la usan las de arriba

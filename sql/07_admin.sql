-- ============================================================================
--  Panel de administración. Requiere sql/02_negocio.sql (córrelo de nuevo
--  antes: trae sembrar_negocio_de). Idempotente: se puede volver a correr.
--
--  1. `perfiles.admin`         : quién ve el panel. Se enciende a mano (final).
--  2. `perfiles.premium_hasta` : último día de premium, inclusive. null = normal.
--  3. Funciones admin_*        : lo ÚNICO que puede ver a todos los usuarios y
--     cambiarles algo. Son security definer (corren como el dueño, por encima
--     de las políticas), así que cada una revisa primero que quien llama sea
--     admin. Ocultar el panel en la app no protege nada; esto sí.
-- ============================================================================

-- Ninguna de las dos entra en los permisos por columna de 02_negocio.sql:
-- el usuario las puede leer, pero no cambiar. Solo las funciones de abajo.
alter table perfiles add column if not exists admin         boolean not null default false;
alter table perfiles add column if not exists premium_hasta date;

-- ¿El usuario de esta sesión tiene premium vigente? Para las políticas de las
-- funciones premium que vengan, igual que es_negocio().
create or replace function es_premium()
returns boolean language sql stable security invoker as $$
  select exists (select 1 from perfiles p
                 where p.user_id = auth.uid() and p.premium_hasta >= current_date);
$$;
grant execute on function es_premium() to authenticated;

create or replace function exigir_admin()
returns void language plpgsql stable security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.perfiles p where p.user_id = auth.uid() and p.admin) then
    raise exception 'Solo el administrador puede hacer esto.';
  end if;
end $$;
revoke execute on function exigir_admin() from public, anon, authenticated;

-- ------------------------------------------------------------- la lista ---
-- Todos los usuarios, tengan fila en `perfiles` o no (sin fila = normal).
create or replace function admin_usuarios()
returns table (user_id uuid, email text, creado timestamptz, ultimo_acceso timestamptz,
               admin boolean, negocio boolean, premium_hasta date, bloqueado boolean)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform public.exigir_admin();
  return query
    select u.id, u.email::text, u.created_at, u.last_sign_in_at,
           coalesce(p.admin, false), coalesce(p.negocio, false), p.premium_hasta,
           coalesce(u.banned_until > now(), false)
    from auth.users u
    left join public.perfiles p on p.user_id = u.id
    order by u.created_at desc;
end $$;

-- -------------------------------------------------------------- premium ---
-- `p_hasta` null le quita el premium. El plazo (1 mes, 1 año, sin fin) lo
-- calcula la app con calc/usuarios.js, que lleva pruebas.
create or replace function admin_poner_premium(p_usuario uuid, p_hasta date)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_admin();
  insert into public.perfiles (user_id, premium_hasta) values (p_usuario, p_hasta)
  on conflict (user_id) do update set premium_hasta = excluded.premium_hasta;
end $$;

-- -------------------------------------------------------------- negocio ---
-- Al encenderlo le siembra sus categorías del negocio, si no las tiene.
-- Apagarlo no borra nada: sus operaciones quedan ahí, solo dejan de verse.
create or replace function admin_poner_negocio(p_usuario uuid, p_activo boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_admin();
  insert into public.perfiles (user_id, negocio) values (p_usuario, p_activo)
  on conflict (user_id) do update set negocio = excluded.negocio;
  if p_activo then perform public.sembrar_negocio_de(p_usuario); end if;
end $$;

-- ------------------------------------------------------------- bloqueo ----
-- Usa el bloqueo de Supabase Auth (`banned_until`): no puede iniciar sesión ni
-- renovar el token. Además se le cierran las sesiones abiertas. El token que
-- ya tenga en la mano sigue valiendo hasta que caduca (1 hora por defecto).
create or replace function admin_bloquear(p_usuario uuid, p_bloquear boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_admin();
  if p_usuario = auth.uid() then raise exception 'No puedes bloquearte a ti mismo.'; end if;

  update auth.users
     set banned_until = case when p_bloquear then timestamptz '2999-12-31' end
   where id = p_usuario;
  if p_bloquear then
    delete from auth.sessions       where user_id = p_usuario;
    delete from auth.refresh_tokens where user_id = p_usuario::text;
    -- Ni avisos push: si lo desbloqueas, los vuelve a activar desde la app.
    -- (to_regclass: sin sql/08_push.sql esta tabla todavía no existe.)
    if to_regclass('public.suscripciones_push') is not null then
      delete from public.suscripciones_push where user_id = p_usuario;
    end if;
  end if;
end $$;

-- Supabase da EXECUTE a anon en cada función nueva: aquí se le quita.
do $$
declare f text;
begin
  foreach f in array array['admin_usuarios()', 'admin_poner_premium(uuid, date)',
                           'admin_poner_negocio(uuid, boolean)', 'admin_bloquear(uuid, boolean)']
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant  execute on function %s to authenticated', f);
  end loop;
end $$;

-- ============================================================================
--  HACERTE ADMIN
--  Corre esto aparte, con TU uuid (lo sacas de: select id, email from auth.users)
-- ============================================================================
-- insert into perfiles (user_id, admin) values ('TU-UUID-AQUI', true)
--   on conflict (user_id) do update set admin = true;

-- ============================================================================
--  Notificaciones push. Idempotente: se puede volver a correr.
--
--  Cada dispositivo donde actives los avisos deja aquí su suscripción: la URL
--  del servicio de push (Apple, Google...) y las dos llaves con que la Edge
--  Function `avisar` cifra el mensaje. Sin ellas nadie más puede leerlo.
-- ============================================================================

create table if not exists suscripciones_push (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  dispositivo text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_suscripciones_push_usuario on suscripciones_push (user_id);

alter table suscripciones_push enable row level security;
drop policy if exists "suscripciones_push_propio" on suscripciones_push;
create policy "suscripciones_push_propio" on suscripciones_push for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Guardar pasa por aquí y no por un insert: si en este teléfono se entra con
-- otra cuenta, el endpoint ya existe con el usuario anterior y la política no
-- deja tocarlo. El endpoint solo lo conoce el navegador que se suscribió, así
-- que tenerlo prueba que el dispositivo es tuyo: la fila pasa a ti.
create or replace function guardar_suscripcion_push(
  p_endpoint text, p_p256dh text, p_auth text, p_dispositivo text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  insert into public.suscripciones_push (user_id, endpoint, p256dh, auth, dispositivo)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_dispositivo, 80))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        dispositivo = excluded.dispositivo, created_at = now();
end $$;

revoke execute on function guardar_suscripcion_push(text, text, text, text) from public, anon;
grant  execute on function guardar_suscripcion_push(text, text, text, text) to authenticated;

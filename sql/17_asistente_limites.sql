-- ============================================================================
--  Límites del asistente de tarjetas, contra el abuso. Requiere sql/15 y 16.
--  Idempotente.
--
--  Por usuario: 30 lecturas al mes (ya estaba) y 10 al día.
--  Para toda la app: 100 lecturas al día entre todos los usuarios.
--  El tamaño de cada documento lo limita la Edge Function (cuenta los tokens
--  antes de leer, sin gastar). El tope final es el límite de gasto en Claude
--  Console. Días y meses con la hora de El Salvador.
-- ============================================================================

create table if not exists uso_asistente_dia (
  user_id  uuid not null references auth.users(id) on delete cascade,
  dia      date not null,
  lecturas int  not null default 0 check (lecturas >= 0),
  primary key (user_id, dia)
);
create index if not exists idx_uso_asistente_dia on uso_asistente_dia (dia);
alter table uso_asistente_dia enable row level security;   -- sin políticas: solo la función

create or replace function usar_asistente_tarjetas()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  limite_mes    constant int := 30;
  limite_dia    constant int := 10;
  limite_global constant int := 100;
  usuario uuid := auth.uid();
  ahora timestamp := now() at time zone 'America/El_Salvador';
  hoy date := ahora::date;
  este_mes date := date_trunc('month', ahora)::date;
  del_mes int;
  del_dia int;
  de_todos int;
  no jsonb := jsonb_build_object('permitido', false, 'quedan_hoy', 0, 'quedan_mes', 0);
begin
  if usuario is null then return no || '{"motivo":"sin_sesion"}'; end if;
  if not public.tiene_funcion('asistente_tarjetas') then return no || '{"motivo":"sin_funcion"}'; end if;

  /* Uno a la vez para toda la app: así el tope global no se pasa con
     lecturas que llegan juntas. */
  perform pg_advisory_xact_lock(hashtext('usar_asistente_tarjetas'));

  select coalesce(sum(lecturas), 0) into de_todos from public.uso_asistente_dia where dia = hoy;
  select coalesce(max(lecturas), 0) into del_dia from public.uso_asistente_dia
   where user_id = usuario and dia = hoy;
  select coalesce(max(lecturas), 0) into del_mes from public.uso_asistente
   where user_id = usuario and mes = este_mes;

  if del_mes >= limite_mes then return no || '{"motivo":"sin_cupo"}'; end if;
  if del_dia >= limite_dia then return no || '{"motivo":"sin_cupo_dia"}'; end if;
  if de_todos >= limite_global then return no || '{"motivo":"sin_cupo_global"}'; end if;

  insert into public.uso_asistente (user_id, mes, lecturas) values (usuario, este_mes, 1)
  on conflict (user_id, mes) do update set lecturas = public.uso_asistente.lecturas + 1;
  insert into public.uso_asistente_dia (user_id, dia, lecturas) values (usuario, hoy, 1)
  on conflict (user_id, dia) do update set lecturas = public.uso_asistente_dia.lecturas + 1;

  return jsonb_build_object('permitido', true, 'motivo', null,
    'quedan_hoy', least(limite_dia - del_dia - 1, limite_mes - del_mes - 1),
    'quedan_mes', limite_mes - del_mes - 1);
end $$;

revoke all on function usar_asistente_tarjetas() from public, anon;
grant execute on function usar_asistente_tarjetas() to authenticated;

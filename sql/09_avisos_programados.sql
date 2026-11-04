-- ============================================================================
--  Avisos automáticos: el cierre del día a las 8 pm y el aviso al llegar algo
--  a Por confirmar. Requiere sql/03_bandeja.sql y sql/08_push.sql, y la Edge
--  Function `avisar` desplegada. Idempotente: se puede volver a correr.
--
--  La base no manda nada por sí misma: llama a la función por HTTP (pg_net)
--  con un secreto que solo conocen ella y la función.
-- ============================================================================

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Sin políticas a propósito: con RLS encendido y ninguna política, ni anon ni
-- authenticated leen nada. Solo la base misma y la llave de servicio.
create table if not exists config_privada (
  clave text primary key,
  valor text not null
);
alter table config_privada enable row level security;
revoke all on config_privada from anon, authenticated;

insert into config_privada (clave, valor) values
  ('avisos_secreto', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')),
  -- Cambia el ref si montas la app en otro proyecto.
  ('avisos_url', 'https://tifmifpphzufarjtckpt.supabase.co/functions/v1/avisar')
on conflict (clave) do nothing;

-- La única puerta hacia la función. pg_net encola la petición y sigue: si la
-- función tarda o falla, el insert que la disparó no se entera.
create or replace function pedir_aviso(cuerpo jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare destino text; secreto text;
begin
  select valor into destino from public.config_privada where clave = 'avisos_url';
  select valor into secreto from public.config_privada where clave = 'avisos_secreto';
  if destino is null or secreto is null then return; end if;
  perform net.http_post(
    url := destino, body := cuerpo, timeout_milliseconds := 60000,
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-avisos-secreto', secreto));
end $$;
revoke execute on function pedir_aviso(jsonb) from public, anon, authenticated;

-- ------------------------------------------------------- Por confirmar -----
-- Solo si ese usuario tiene algún dispositivo con avisos: si no, ni se llama.
create or replace function avisar_bandeja()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.suscripciones_push s where s.user_id = new.user_id) then
    perform public.pedir_aviso(jsonb_build_object(
      'accion', 'bandeja', 'user_id', new.user_id, 'origen', new.origen));
  end if;
  return new;
end $$;
revoke execute on function avisar_bandeja() from public, anon, authenticated;

drop trigger if exists avisar_bandeja on bandeja;
create trigger avisar_bandeja after insert on bandeja
  for each row execute function avisar_bandeja();

-- ------------------------------------------------------ cierre del día -----
-- pg_cron corre en UTC: las 02:00 UTC son las 8:00 pm en la Ciudad de México,
-- que no cambia de horario desde 2022. Volver a programarlo con el mismo
-- nombre lo reemplaza.
select cron.schedule('avisos-cierre-del-dia', '0 2 * * *',
  $$select public.pedir_aviso('{"accion": "resumen"}'::jsonb)$$);

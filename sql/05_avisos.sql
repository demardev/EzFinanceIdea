-- ============================================================================
--  Avisos del banco en la bandeja: el SMS llega tal cual y la app lo lee con
--  sus plantillas (js/calc/avisos/). Requiere sql/03_bandeja.sql.
--  Idempotente: se puede volver a correr.
--
--  La base no interpreta el texto: así, enseñarle un formato nuevo a la app
--  no exige tocar SQL. Lo que sí hace es no guardar dos veces el mismo aviso.
-- ============================================================================

alter table bandeja add column if not exists texto text;

-- Un aviso puede llegar sin monto legible (lo pone la app al leerlo).
alter table bandeja alter column monto drop not null;
do $$ begin
  alter table bandeja drop constraint if exists bandeja_monto_o_texto;
  alter table bandeja add constraint bandeja_monto_o_texto
    check (monto is not null or texto is not null);
  alter table bandeja drop constraint if exists bandeja_texto_largo;
  alter table bandeja add constraint bandeja_texto_largo
    check (texto is null or char_length(texto) <= 1000);
end $$;

-- El usuario de una clave del atajo, o error. La comparten las dos puertas.
create or replace function usuario_de_clave(clave text)
returns uuid language plpgsql stable security definer set search_path = public, pg_temp as $$
declare uid uuid;
begin
  select c.user_id into uid from claves_entrada c where c.hash = hash_de_clave(clave);
  if uid is null then
    raise exception 'Clave no válida.' using errcode = '28000';
  end if;
  return uid;
end $$;

revoke all on function usuario_de_clave(text) from public, anon, authenticated;

-- La puerta de los avisos: la misma clave que el atajo de Apple Pay, y como
-- aquella, solo puede AGREGAR a tu bandeja.
create or replace function recibir_aviso(clave text, texto text, origen text default 'sms')
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid    uuid := usuario_de_clave(clave);
  limpio text := left(trim(coalesce(texto, '')), 1000);
begin
  if limpio = '' then
    raise exception 'El aviso llegó vacío.' using errcode = '22023';
  end if;
  if origen not in ('sms', 'correo') then
    raise exception 'Origen no válido: %', left(origen, 20) using errcode = '22023';
  end if;
  if (select count(*) from bandeja b
      where b.user_id = uid and b.created_at > now() - interval '1 hour') >= 100 then
    raise exception 'Demasiados avisos en una hora.' using errcode = '54000';
  end if;
  -- Dos automatizaciones pueden atrapar el mismo SMS ("USD" y "Transfer365"):
  -- el texto trae fecha y hora, así que si ya está, es el mismo aviso.
  if exists (select 1 from bandeja b where b.user_id = uid and b.texto = limpio) then
    return;
  end if;
  insert into bandeja (user_id, origen, texto) values (uid, origen, limpio);
end $$;

revoke all on function recibir_aviso(text, text, text) from public;
grant execute on function recibir_aviso(text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';

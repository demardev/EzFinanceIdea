-- ============================================================================
--  Cuánto usa cada lectura del asistente de tarjetas: tokens de entrada y de
--  salida, sumados por usuario y mes. Con eso se sabe el costo real de cada
--  usuario premium (precios en docs/asistente-tarjetas.md). Requiere sql/15.
--  Idempotente.
-- ============================================================================

alter table uso_asistente add column if not exists tokens_entrada bigint not null default 0;
alter table uso_asistente add column if not exists tokens_salida  bigint not null default 0;

-- La llama `leer-estado` con el token del usuario, después de cada respuesta de
-- la IA. Solo suma a la fila de quien llama y del mes en curso (la que creó
-- usar_asistente_tarjetas()).
create or replace function registrar_tokens_asistente(p_entrada int, p_salida int)
returns void language plpgsql security definer set search_path = '' as $$
declare
  este_mes date := date_trunc('month', now() at time zone 'America/El_Salvador')::date;
begin
  if auth.uid() is null or p_entrada < 0 or p_salida < 0 then return; end if;
  update public.uso_asistente
     set tokens_entrada = tokens_entrada + p_entrada,
         tokens_salida  = tokens_salida + p_salida
   where user_id = auth.uid() and mes = este_mes;
end $$;

revoke all on function registrar_tokens_asistente(int, int) from public, anon;
grant execute on function registrar_tokens_asistente(int, int) to authenticated;

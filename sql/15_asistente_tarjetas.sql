-- ============================================================================
--  Asistente de tarjetas (premium): leer estados de cuenta con IA.
--  Requiere sql/11_planes_prestamos.sql. Idempotente.
--
--  La Edge Function `leer-estado` llama a la IA, que cuesta por cada lectura.
--  Antes de llamarla pregunta aquí, CON EL TOKEN DEL USUARIO, si puede:
--  que su plan tenga la función y que le quede cupo este mes. La restricción
--  vive en la base: ocultar el botón no protege nada.
-- ============================================================================

insert into funciones (clave, nombre, descripcion) values
  ('asistente_tarjetas', 'Asistente de tarjetas',
   'Lee tus estados de cuenta con IA y te ayuda a cuadrar la tarjeta con el banco.')
on conflict (clave) do update set nombre = excluded.nombre, descripcion = excluded.descripcion;
-- Solo la primera vez: después lo decide el panel.
insert into plan_funciones (plan, funcion)
select 'premium', 'asistente_tarjetas'
where not exists (select 1 from plan_funciones where funcion = 'asistente_tarjetas');

-- Lecturas por usuario y mes. Sin políticas: solo la función de abajo la toca.
create table if not exists uso_asistente (
  user_id  uuid not null references auth.users(id) on delete cascade,
  mes      date not null,
  lecturas int  not null default 0 check (lecturas >= 0),
  primary key (user_id, mes)
);
alter table uso_asistente enable row level security;

-- Cuenta una lectura si se puede. { permitido, motivo, quedan }.
create or replace function usar_asistente_tarjetas()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  limite constant int := 30;
  usuario uuid := auth.uid();
  este_mes date := date_trunc('month', now() at time zone 'America/El_Salvador')::date;
  usadas int;
begin
  if usuario is null then
    return jsonb_build_object('permitido', false, 'motivo', 'sin_sesion', 'quedan', 0);
  end if;
  if not public.tiene_funcion('asistente_tarjetas') then
    return jsonb_build_object('permitido', false, 'motivo', 'sin_funcion', 'quedan', 0);
  end if;

  insert into public.uso_asistente (user_id, mes, lecturas) values (usuario, este_mes, 0)
  on conflict (user_id, mes) do nothing;
  select lecturas into usadas from public.uso_asistente
   where user_id = usuario and mes = este_mes for update;
  if usadas >= limite then
    return jsonb_build_object('permitido', false, 'motivo', 'sin_cupo', 'quedan', 0);
  end if;

  update public.uso_asistente set lecturas = lecturas + 1
   where user_id = usuario and mes = este_mes;
  return jsonb_build_object('permitido', true, 'motivo', null, 'quedan', limite - usadas - 1);
end $$;

revoke all on function usar_asistente_tarjetas() from public, anon;
grant execute on function usar_asistente_tarjetas() to authenticated;

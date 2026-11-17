-- ============================================================================
--  Minicuotas: la cuota mensual y la comisión son dos cosas aparte. Idempotente.
--
--  Antes el interés iba O como comisión O metido en las cuotas. Ahora el banco
--  da las dos por separado: una comisión única (`interes`, la de siempre) y la
--  cuota mensual para el plazo elegido (`cuota_mensual`), que puede traer su
--  propio interés. Sin cuota, lo trasladado se reparte sin interés. La regla
--  vive en js/calc/minicuotas.js.
-- ============================================================================

alter table compras_cuotas add column if not exists cuota_mensual numeric(14,2);
do $$ begin
  alter table compras_cuotas drop constraint if exists compra_cuota_mensual_valida;
  alter table compras_cuotas add constraint compra_cuota_mensual_valida
    check (cuota_mensual is null or cuota_mensual > 0);
end $$;

-- Un traslado viejo con el interés metido en las cuotas pasa a cuota mensual.
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_name = 'compras_cuotas' and column_name = 'interes_en_cuotas') then
    update compras_cuotas
       set cuota_mensual = round((monto_total + interes) / num_cuotas, 2), interes = 0
     where interes_en_cuotas and interes > 0;
  end if;
end $$;

alter table compras_cuotas drop column if exists interes_en_cuotas;
alter table tarjetas drop constraint if exists tarjeta_minicuotas_interes_valido;
alter table tarjetas drop column if exists minicuotas_interes;

-- ============================================================================
--  Día en que el banco carga las cuotas de una compra a meses. Idempotente:
--  se puede volver a correr.
--
--  'compra'      el mismo día del mes que la compra (lo de siempre)
--  'antes_corte' un día antes de cada corte
--
--  Solo decide las fechas de las cuotas que se generen de aquí en adelante:
--  las compras ya registradas se quedan como están hasta que se editen.
--  La regla vive en js/calc/fecha-cuota.js.
-- ============================================================================

alter table tarjetas add column if not exists cargo_cuotas text not null default 'compra';
do $$ begin
  alter table tarjetas drop constraint if exists tarjeta_cargo_cuotas_valido;
  alter table tarjetas add constraint tarjeta_cargo_cuotas_valido
    check (cargo_cuotas in ('compra', 'antes_corte'));
end $$;

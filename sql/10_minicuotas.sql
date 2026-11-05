-- ============================================================================
--  Minicuotas: pasar compras ya hechas de la tarjeta a cuotas. Idempotente:
--  se puede volver a correr.
--
--  Un traslado es una fila de compras_cuotas con tipo 'minicuotas'. Sus cuotas
--  son movimientos como los de cualquier compra a meses. Las compras originales
--  NO se borran: llevan traslado_id y dejan de contar como deuda (ya la cubren
--  las cuotas). La regla vive en js/calc/minicuotas.js.
--
--  Cada banco cobra distinto, así que nada queda fijo: la tarjeta solo dice qué
--  valores vienen escritos en el formulario, y cada traslado guarda sus fechas.
-- ============================================================================

-- Si la tarjeta deja trasladar compras, y lo que suele hacer su banco.
alter table tarjetas add column if not exists minicuotas boolean not null default false;
-- Cuándo cae la primera cuota: 30 días después, en el corte abierto o en el siguiente.
alter table tarjetas add column if not exists minicuotas_primera text not null default 'dias_30';
-- Cómo cobra el interés: una comisión aparte, o metido en las cuotas.
alter table tarjetas add column if not exists minicuotas_interes text not null default 'comision';
do $$ begin
  alter table tarjetas drop constraint if exists tarjeta_minicuotas_primera_valido;
  alter table tarjetas add constraint tarjeta_minicuotas_primera_valido
    check (minicuotas_primera in ('dias_30', 'corte_abierto', 'corte_siguiente'));
  alter table tarjetas drop constraint if exists tarjeta_minicuotas_interes_valido;
  alter table tarjetas add constraint tarjeta_minicuotas_interes_valido
    check (minicuotas_interes in ('comision', 'en_cuotas'));
end $$;

-- El traslado. monto_total es la suma de las compras trasladadas; interes es
-- el monto que da el banco para ese plazo (nunca una tasa).
alter table compras_cuotas add column if not exists tipo text not null default 'msi';
alter table compras_cuotas add column if not exists interes numeric(14,2) not null default 0;
alter table compras_cuotas add column if not exists interes_en_cuotas boolean not null default false;
alter table compras_cuotas add column if not exists fecha_comision date;
alter table compras_cuotas add column if not exists fecha_primera_cuota date;
do $$ begin
  alter table compras_cuotas drop constraint if exists compra_tipo_valido;
  alter table compras_cuotas add constraint compra_tipo_valido
    check (tipo in ('msi', 'minicuotas'));
  alter table compras_cuotas drop constraint if exists compra_interes_valido;
  alter table compras_cuotas add constraint compra_interes_valido check (interes >= 0);
end $$;

-- En las compras originales y en las cuotas del traslado. Borrar el traslado
-- se lleva sus cuotas (por compra_id) y devuelve las originales a la deuda.
alter table movimientos add column if not exists traslado_id uuid
  references compras_cuotas(id) on delete set null;
create index if not exists idx_mov_traslado on movimientos (traslado_id);

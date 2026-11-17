-- ============================================================================
--  Reembolsos a la tarjeta. Idempotente.
--
--  Un ingreso puede entrar a una cuenta O a una tarjeta (nunca a las dos). En
--  la tarjeta es un reembolso: baja la deuda sin pasar por ninguna cuenta. La
--  regla de cómo se aplica vive en js/calc/deuda-tarjeta.js.
-- ============================================================================

alter table movimientos drop constraint if exists mov_origen_valido;
alter table movimientos add constraint mov_origen_valido check (
    (tipo = 'ingreso'       and (cuenta_id is not null) <> (tarjeta_id is not null))
 or (tipo = 'egreso'        and (cuenta_id is not null) <> (tarjeta_id is not null))
 or (tipo = 'transferencia' and cuenta_id is not null
                            and ((cuenta_destino_id is not null) <> (tarjeta_destino_id is not null)))
);

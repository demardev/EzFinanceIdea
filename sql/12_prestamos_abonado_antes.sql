-- ============================================================================
--  Préstamos: lo que ya se había pagado ANTES de anotarlo en la app.
--  No es un movimiento (ese dinero se movió antes y ya está en tus saldos),
--  pero cuenta como abonado: para lo que falta y para los atrasos. La regla
--  vive en js/calc/prestamos.js. Idempotente: se puede volver a correr.
-- ============================================================================

alter table prestamos add column if not exists abonado_antes numeric(14,2) not null default 0;

alter table prestamos drop constraint if exists prestamo_abonado_antes;
alter table prestamos add constraint prestamo_abonado_antes
  check (abonado_antes >= 0 and abonado_antes < monto_total);

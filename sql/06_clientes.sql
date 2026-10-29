-- ============================================================================
--  Clientes del negocio de pago de recibos. Requiere sql/02_negocio.sql.
--  Idempotente: se puede volver a correr.
--
--  Un cliente es opcional en cada operación. Sus movimientos generados lo
--  heredan para poder filtrar por él; como esos movimientos se regeneran
--  desde la operación, la app escribe los dos a la vez.
-- ============================================================================

create table if not exists clientes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre     text not null,
  archivado  boolean not null default false,
  created_at timestamptz not null default now()
);

do $$ begin
  alter table clientes drop constraint if exists clientes_nombre_valido;
  alter table clientes add constraint clientes_nombre_valido
    check (char_length(trim(nombre)) between 1 and 100);
end $$;

create index if not exists idx_clientes_usuario on clientes (user_id);

-- Igual que pagos_recibo: solo el dueño Y con la bandera encendida.
alter table clientes enable row level security;
drop policy if exists "clientes_propio" on clientes;
create policy "clientes_propio" on clientes for all to authenticated
  using      (user_id = auth.uid() and es_negocio())
  with check (user_id = auth.uid() and es_negocio());

-- Archivar es la forma normal de quitar uno; si aun así se borra, sus
-- operaciones y movimientos se quedan sin cliente, no se borran.
alter table pagos_recibo add column if not exists cliente_id uuid
  references clientes(id) on delete set null;
create index if not exists idx_pagos_cliente on pagos_recibo (cliente_id);

alter table movimientos add column if not exists cliente_id uuid
  references clientes(id) on delete set null;
create index if not exists idx_mov_cliente on movimientos (cliente_id);

notify pgrst, 'reload schema';

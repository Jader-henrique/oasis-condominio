-- =========================================================
-- Migration 019 — Contas: tipo (Receita / Gasto)
-- =========================================================

-- 1) Enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_conta_enum') then
    create type public.tipo_conta_enum as enum ('Receita','Gasto');
  end if;
end$$;

-- 2) Coluna na tabela contas (default Gasto - maioria das contas existentes)
alter table public.contas
  add column if not exists tipo_conta public.tipo_conta_enum not null default 'Gasto';

create index if not exists idx_contas_tipo on public.contas(tipo_conta);

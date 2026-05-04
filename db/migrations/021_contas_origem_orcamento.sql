-- =========================================================
-- Migration 021 — Contas: origem_orcamento
-- =========================================================

-- 1) Enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'origem_orcamento_enum') then
    create type public.origem_orcamento_enum as enum (
      'Orçamento do Condomínio',
      'Orçamento de Fornecedores'
    );
  end if;
end$$;

-- 2) Coluna (nullable — contas existentes ficam sem origem até serem editadas)
alter table public.contas
  add column if not exists origem_orcamento public.origem_orcamento_enum;

create index if not exists idx_contas_origem on public.contas(origem_orcamento);

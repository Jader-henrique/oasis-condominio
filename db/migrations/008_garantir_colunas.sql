-- =========================================================
-- Migration 008 — Garantir colunas em todas as tabelas
-- Idempotente. Pode ser executada várias vezes.
-- Cobre lacunas que podem ter ficado das migrações anteriores.
-- =========================================================

-- benfeitorias
alter table public.benfeitorias add column if not exists valor numeric(12,2);
alter table public.benfeitorias add column if not exists categoria_id bigint references public.categorias(id) on delete set null;
alter table public.benfeitorias add column if not exists previsto date;
alter table public.benfeitorias add column if not exists realizado date;

-- corretivas
alter table public.corretivas add column if not exists valor numeric(12,2);
alter table public.corretivas add column if not exists data_inicio date;
alter table public.corretivas add column if not exists data_fim date;

-- calendario (atividades do dia a dia)
alter table public.calendario add column if not exists valor numeric(12,2);
alter table public.calendario add column if not exists proxima_data date;
alter table public.calendario add column if not exists realizado_em timestamptz;
alter table public.calendario add column if not exists realizado_por text;
alter table public.calendario add column if not exists evidencia_url text;

-- diario
alter table public.diario add column if not exists evidencias_urls jsonb default '[]'::jsonb;
alter table public.diario add column if not exists item_tipo text;
alter table public.diario add column if not exists item_id bigint;

-- orcamentos
alter table public.orcamentos add column if not exists data_criacao timestamptz not null default now();
alter table public.orcamentos add column if not exists sem_orcamento boolean not null default false;
alter table public.orcamentos add column if not exists item_tipo text;
alter table public.orcamentos add column if not exists motivo_escolha text;

-- solicitacoes (caso ainda não exista)
create table if not exists public.solicitacoes (
  id bigint generated always as identity primary key,
  morador_id uuid,
  morador_nome text,
  texto text not null,
  anexos jsonb default '[]'::jsonb,
  status text not null default 'aberta' check (status in ('aberta','respondida','encerrada')),
  resposta text,
  respondida_por text,
  respondida_em timestamptz,
  criado_em timestamptz not null default now()
);

-- categorias (caso ainda não exista)
create table if not exists public.categorias (
  id bigint generated always as identity primary key,
  nome text not null unique,
  criado_em timestamptz not null default now()
);

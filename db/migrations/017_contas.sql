-- =========================================================
-- Migration 017 — Tabela de Contas (orçamentária / contábil)
-- =========================================================

-- 1) Enum de grupo orçamentário
do $$
begin
  if not exists (select 1 from pg_type where typname = 'grupo_orcamentario_enum') then
    create type public.grupo_orcamentario_enum as enum (
      'Atividades do Dia a Dia',
      'Intervenções Corretivas',
      'Benfeitorias'
    );
  end if;
end$$;

-- 2) Tabela de contas
create table if not exists public.contas (
  id                 bigint generated always as identity primary key,
  descricao          text not null,
  grupo_orcamentario public.grupo_orcamentario_enum not null,
  codigo_contabil    text,
  criado_em          timestamptz not null default now(),
  excluido_em        timestamptz
);

create index if not exists idx_contas_grupo on public.contas(grupo_orcamentario);
create index if not exists idx_contas_excluido on public.contas(excluido_em);

-- 3) RLS permissiva (mesmo padrão das outras tabelas)
alter table public.contas enable row level security;
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname='public' and tablename='contas' loop
    execute format('drop policy if exists %I on public.contas', r.policyname);
  end loop;
end$$;
create policy "contas_all" on public.contas
  for all to authenticated, anon using (true) with check (true);

-- 4) Vincular conta_id nas tabelas de origem
alter table public.benfeitorias add column if not exists conta_id bigint references public.contas(id) on delete set null;
alter table public.calendario   add column if not exists conta_id bigint references public.contas(id) on delete set null;
alter table public.corretivas   add column if not exists conta_id bigint references public.contas(id) on delete set null;

-- 5) Pré-popular algumas contas comuns (idempotente)
insert into public.contas (descricao, grupo_orcamentario, codigo_contabil) values
  ('Limpeza Geral',           'Atividades do Dia a Dia', '3.1.01.001'),
  ('Manutenção Preventiva',   'Atividades do Dia a Dia', '3.1.01.002'),
  ('Conservação de Áreas',    'Atividades do Dia a Dia', '3.1.01.003'),
  ('Reparos Elétricos',       'Intervenções Corretivas', '3.1.02.001'),
  ('Reparos Hidráulicos',     'Intervenções Corretivas', '3.1.02.002'),
  ('Reparos Estruturais',     'Intervenções Corretivas', '3.1.02.003'),
  ('Reformas',                'Benfeitorias',            '3.1.03.001'),
  ('Equipamentos / Aquisições','Benfeitorias',           '3.1.03.002'),
  ('Modernização',            'Benfeitorias',            '3.1.03.003')
on conflict do nothing;

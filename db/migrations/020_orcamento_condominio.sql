-- =========================================================
-- Migration 020 — Orçamento do Condomínio
-- Adiciona valor_previsto e valor_realizado em contas (planilha orçamentária)
-- + tabela orcamento_config (saldo inicial por ano)
-- + seed das 3 contas de Receita
-- =========================================================

-- 1) Valores na tabela de contas
alter table public.contas
  add column if not exists valor_previsto  numeric(14,2) not null default 0,
  add column if not exists valor_realizado numeric(14,2) not null default 0;

-- 2) Tabela de configuração do orçamento (saldo inicial por ano)
create table if not exists public.orcamento_config (
  id                       bigint generated always as identity primary key,
  ano                      int not null unique,
  saldo_inicial_previsto   numeric(14,2) not null default 0,
  saldo_inicial_realizado  numeric(14,2) not null default 0,
  criado_em                timestamptz not null default now()
);

alter table public.orcamento_config enable row level security;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname='public' and tablename='orcamento_config' loop
    execute format('drop policy if exists %I on public.orcamento_config', r.policyname);
  end loop;
end $$;
create policy "orcamento_config_all" on public.orcamento_config
  for all to authenticated, anon using (true) with check (true);

-- 3) Garantir um registro de config para o ano corrente
insert into public.orcamento_config (ano, saldo_inicial_previsto, saldo_inicial_realizado)
values (extract(year from now())::int, 0, 0)
on conflict (ano) do nothing;

-- 4) Seed das 3 contas de Receita
insert into public.contas (descricao, tipo_conta, grupo_orcamentario, codigo_contabil)
select 'Receitas Correntes', 'Receita'::public.tipo_conta_enum,
       'Atividades do Dia a Dia'::public.grupo_orcamentario_enum, '1.1.01'
where not exists (select 1 from public.contas
                  where descricao = 'Receitas Correntes' and tipo_conta = 'Receita' and excluido_em is null);

insert into public.contas (descricao, tipo_conta, grupo_orcamentario, codigo_contabil)
select 'Aplicações Financeiras', 'Receita'::public.tipo_conta_enum,
       'Atividades do Dia a Dia'::public.grupo_orcamentario_enum, '1.1.02'
where not exists (select 1 from public.contas
                  where descricao = 'Aplicações Financeiras' and tipo_conta = 'Receita' and excluido_em is null);

insert into public.contas (descricao, tipo_conta, grupo_orcamentario, codigo_contabil)
select 'Receitas Taxas Extras', 'Receita'::public.tipo_conta_enum,
       'Atividades do Dia a Dia'::public.grupo_orcamentario_enum, '1.1.03'
where not exists (select 1 from public.contas
                  where descricao = 'Receitas Taxas Extras' and tipo_conta = 'Receita' and excluido_em is null);

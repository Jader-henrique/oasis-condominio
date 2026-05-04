-- =========================================================
-- Migration 020 — Orçamento do Condomínio
-- =========================================================

-- 1) Tabela de cabeçalho do orçamento
create table if not exists public.orcamento_cond (
  id           bigint generated always as identity primary key,
  descricao    text not null,
  vigencia_de  date not null,   -- primeiro dia do mês inicial
  vigencia_ate date not null,   -- primeiro dia do mês final
  saldo_inicial numeric(14,2) not null default 0,
  status       text not null default 'Ativo' check (status in ('Ativo','Inativo')),
  criado_em    timestamptz not null default now(),
  excluido_em  timestamptz
);

create index if not exists idx_orcamento_cond_vigencia  on public.orcamento_cond(vigencia_de, vigencia_ate);
create index if not exists idx_orcamento_cond_excluido  on public.orcamento_cond(excluido_em);

-- 2) Itens do orçamento (contas vinculadas)
create table if not exists public.orcamento_cond_itens (
  id           bigint generated always as identity primary key,
  orcamento_id bigint not null references public.orcamento_cond(id),
  conta_id     bigint not null references public.contas(id),
  criado_em    timestamptz not null default now(),
  excluido_em  timestamptz
);

create index if not exists idx_orcamento_cond_itens_orc     on public.orcamento_cond_itens(orcamento_id);
create index if not exists idx_orcamento_cond_itens_excluido on public.orcamento_cond_itens(excluido_em);

-- 3) Valores mensais por item
create table if not exists public.orcamento_cond_valores (
  id              bigint generated always as identity primary key,
  item_id         bigint not null references public.orcamento_cond_itens(id),
  competencia     date not null,   -- sempre o primeiro dia do mês (ex: 2025-01-01)
  valor_previsto  numeric(14,2) not null default 0,
  valor_realizado numeric(14,2),   -- null até ser preenchido
  unique (item_id, competencia)
);

create index if not exists idx_orcamento_cond_valores_item on public.orcamento_cond_valores(item_id);

-- 4) RLS permissiva (mesmo padrão do projeto)
alter table public.orcamento_cond        enable row level security;
alter table public.orcamento_cond_itens  enable row level security;
alter table public.orcamento_cond_valores enable row level security;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname='public' and tablename='orcamento_cond' loop
    execute format('drop policy if exists %I on public.orcamento_cond', r.policyname);
  end loop;
end$$;
create policy "orcamento_cond_all" on public.orcamento_cond
  for all to authenticated, anon using (true) with check (true);

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname='public' and tablename='orcamento_cond_itens' loop
    execute format('drop policy if exists %I on public.orcamento_cond_itens', r.policyname);
  end loop;
end$$;
create policy "orcamento_cond_itens_all" on public.orcamento_cond_itens
  for all to authenticated, anon using (true) with check (true);

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname='public' and tablename='orcamento_cond_valores' loop
    execute format('drop policy if exists %I on public.orcamento_cond_valores', r.policyname);
  end loop;
end$$;
create policy "orcamento_cond_valores_all" on public.orcamento_cond_valores
  for all to authenticated, anon using (true) with check (true);

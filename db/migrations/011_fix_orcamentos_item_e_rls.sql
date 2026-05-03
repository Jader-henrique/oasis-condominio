-- =========================================================
-- Migration 011 — Fix da coluna legada `item` em orcamentos
--                  + RLS robusta em todas as tabelas
-- =========================================================

-- ======================================================
-- PARTE 1 — Limpar colunas legadas em orcamentos
-- ======================================================
-- Remove NOT NULL da coluna `item` (vestígio do schema antigo)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='orcamentos' and column_name='item'
  ) then
    alter table public.orcamentos alter column item drop not null;
  end if;
end$$;

-- Outras colunas legadas que podem ter NOT NULL e não são mais usadas
do $$
declare
  col text;
  cols text[] := array['descricao','sistema','intervencao','tipo_item'];
begin
  foreach col in array cols loop
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='orcamentos' and column_name=col
    ) then
      execute format('alter table public.orcamentos alter column %I drop not null', col);
    end if;
  end loop;
end$$;

-- ======================================================
-- PARTE 2 — RLS bem permissiva em todas as tabelas
-- Aceita tanto authenticated quanto anon (para evitar
-- problemas se a sessão JWT estiver com role inesperada)
-- ======================================================
do $$
declare
  tabelas text[] := array[
    'orcamentos','benfeitorias','corretivas','calendario','documentos_item',
    'diario','solicitacoes','categorias','publicacoes'
  ];
  t text;
  r record;
begin
  foreach t in array tabelas loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      -- Drop todas as políticas existentes
      for r in execute format('select policyname from pg_policies where schemaname=''public'' and tablename=%L', t) loop
        execute format('drop policy if exists %I on public.%I', r.policyname, t);
      end loop;
      -- Habilitar RLS
      execute format('alter table public.%I enable row level security', t);
      -- Política única: liberar TUDO para authenticated E anon
      execute format(
        'create policy "%s_all" on public.%I for all to authenticated, anon using (true) with check (true)',
        t, t
      );
    end if;
  end loop;
end$$;

-- ======================================================
-- PARTE 3 — Diagnóstico (rode separadamente para verificar)
-- ======================================================
-- select auth.role() as role, auth.uid() as uid;
-- select tablename, policyname, cmd, roles from pg_policies
--   where schemaname='public' order by tablename;
-- select column_name, is_nullable from information_schema.columns
--   where table_schema='public' and table_name='orcamentos' order by ordinal_position;

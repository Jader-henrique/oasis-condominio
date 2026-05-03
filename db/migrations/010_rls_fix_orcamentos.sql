-- =========================================================
-- Migration 010 — Fix definitivo de RLS para orcamentos
-- Remove TODAS as políticas existentes da tabela orcamentos e
-- recria políticas permissivas. Faz o mesmo para tabelas críticas.
-- =========================================================

-- 1) DIAGNÓSTICO — Liste isso para ver políticas atuais e role do usuário
-- select tablename, policyname, cmd, qual, with_check
-- from pg_policies where schemaname = 'public' and tablename = 'orcamentos';
-- select auth.role(), auth.uid();

-- 2) FIX — Drop todas as políticas de orcamentos e recria
do $$
declare
  r record;
begin
  for r in select policyname from pg_policies where schemaname='public' and tablename='orcamentos' loop
    execute format('drop policy if exists %I on public.orcamentos', r.policyname);
  end loop;
end$$;

alter table public.orcamentos enable row level security;

create policy "orcamentos_all_authenticated" on public.orcamentos
  for all
  to authenticated
  using (true)
  with check (true);

-- 3) Mesmo tratamento para outras tabelas críticas
do $$
declare
  tabelas text[] := array['benfeitorias','corretivas','calendario','documentos_item','diario','solicitacoes','categorias','publicacoes'];
  t text;
  r record;
begin
  foreach t in array tabelas loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      for r in execute format('select policyname from pg_policies where schemaname=''public'' and tablename=%L', t) loop
        execute format('drop policy if exists %I on public.%I', r.policyname, t);
      end loop;
      execute format('alter table public.%I enable row level security', t);
      execute format('create policy "%s_all_authenticated" on public.%I for all to authenticated using (true) with check (true)', t, t);
    end if;
  end loop;
end$$;

-- 4) Confirmação — após rodar, esse select deve mostrar 1 política por tabela
-- select tablename, policyname, cmd from pg_policies where schemaname='public' order by tablename;

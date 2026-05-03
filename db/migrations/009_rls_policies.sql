-- =========================================================
-- Migration 009 — Políticas RLS (Row Level Security)
-- Habilita RLS em todas as tabelas e cria políticas permissivas
-- para qualquer usuário autenticado (select/insert/update/delete).
-- Idempotente. Pode rodar várias vezes.
-- =========================================================

-- Função utilitária para criar conjunto padrão de políticas
do $$
declare
  tabelas text[] := array[
    'benfeitorias','corretivas','calendario','orcamentos','documentos_item',
    'diario','publicacoes','categorias','solicitacoes'
  ];
  t text;
begin
  foreach t in array tabelas loop
    -- Só processa se a tabela existir
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      execute format('alter table public.%I enable row level security', t);

      -- SELECT
      execute format('drop policy if exists "%s_select" on public.%I', t, t);
      execute format('create policy "%s_select" on public.%I for select using (auth.role() = ''authenticated'')', t, t);

      -- INSERT
      execute format('drop policy if exists "%s_insert" on public.%I', t, t);
      execute format('create policy "%s_insert" on public.%I for insert with check (auth.role() = ''authenticated'')', t, t);

      -- UPDATE
      execute format('drop policy if exists "%s_update" on public.%I', t, t);
      execute format('create policy "%s_update" on public.%I for update using (auth.role() = ''authenticated'')', t, t);

      -- DELETE
      execute format('drop policy if exists "%s_delete" on public.%I', t, t);
      execute format('create policy "%s_delete" on public.%I for delete using (auth.role() = ''authenticated'')', t, t);
    end if;
  end loop;
end$$;

-- Tabela de usuarios: select é necessário para o app carregar o perfil
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='usuarios') then
    alter table public.usuarios enable row level security;
    drop policy if exists "usuarios_select_self" on public.usuarios;
    create policy "usuarios_select_self" on public.usuarios for select using (auth.uid() = id or auth.role() = 'authenticated');
  end if;
end$$;

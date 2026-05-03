-- =========================================================
-- Migration 002 — Tabela de Categorias
-- Cria a tabela `categorias` com ID auto-incremento, pré-popula
-- com categorias comuns de manutenção predial e migra os
-- valores existentes em `benfeitorias.categoria` (texto livre)
-- para a nova relação `categoria_id`.
-- =========================================================

-- 1) Tabela categorias
create table if not exists public.categorias (
  id          bigint generated always as identity primary key,
  nome        text not null unique,
  criado_em   timestamptz not null default now()
);

-- Permissões / RLS (alinhadas ao padrão Supabase)
alter table public.categorias enable row level security;

-- Leitura para qualquer usuário autenticado
drop policy if exists "categorias_select" on public.categorias;
create policy "categorias_select" on public.categorias
  for select using (auth.role() = 'authenticated');

-- Inserção / atualização (poderá ser refinado para admin no futuro)
drop policy if exists "categorias_insert" on public.categorias;
create policy "categorias_insert" on public.categorias
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "categorias_update" on public.categorias;
create policy "categorias_update" on public.categorias
  for update using (auth.role() = 'authenticated');

-- 2) Pré-população com categorias comuns de manutenção predial
insert into public.categorias (nome) values
  ('Hidráulica'),
  ('Elétrica'),
  ('Estrutural'),
  ('Pintura'),
  ('Impermeabilização'),
  ('Fachada'),
  ('Cobertura / Telhado'),
  ('Reservatórios'),
  ('Elevadores'),
  ('Esquadrias'),
  ('Climatização'),
  ('Gás'),
  ('Combate a Incêndio'),
  ('Iluminação'),
  ('Segurança / CFTV'),
  ('Portaria / Interfonia'),
  ('Garagem'),
  ('Áreas Comuns'),
  ('Paisagismo / Jardinagem'),
  ('Limpeza'),
  ('Piscina'),
  ('Academia / Lazer'),
  ('Gerador'),
  ('Para-raios / SPDA'),
  ('Outros')
on conflict (nome) do nothing;

-- 3) Inserir categorias já existentes em benfeitorias (que ainda não estão na tabela)
insert into public.categorias (nome)
select distinct btrim(b.categoria)
from public.benfeitorias b
where b.categoria is not null
  and btrim(b.categoria) <> ''
  and not exists (
    select 1 from public.categorias c where lower(c.nome) = lower(btrim(b.categoria))
  );

-- 4) Adicionar a coluna categoria_id em benfeitorias
alter table public.benfeitorias
  add column if not exists categoria_id bigint references public.categorias(id) on delete set null;

-- 5) Migrar os valores de texto para a FK
update public.benfeitorias b
set categoria_id = c.id
from public.categorias c
where lower(btrim(b.categoria)) = lower(c.nome)
  and b.categoria_id is null;

-- 6) (Opcional) Índice para consultas
create index if not exists idx_benfeitorias_categoria_id on public.benfeitorias(categoria_id);

-- Observação: a coluna `categoria` (texto) foi mantida por segurança.
-- Após validar a migração em produção, ela pode ser removida com:
--   alter table public.benfeitorias drop column categoria;

-- =========================================================
-- Migration 007 — Módulos novos
-- 1) Solicitações de Morador (com respostas e anexos)
-- 2) Perfil "vistorias" (atualiza enum perfil)
-- 3) Orçamentos: garante data_criacao + fechamento sem orçamento
-- 4) Diário: campo evidencias_urls (jsonb array de fotos)
-- 5) Função utilitária para calcular próxima ocorrência
-- =========================================================

-- 1) Tabela de solicitações de morador
create table if not exists public.solicitacoes (
  id          bigint generated always as identity primary key,
  morador_id  uuid references public.usuarios(id) on delete set null,
  morador_nome text,
  texto       text not null,
  anexos      jsonb default '[]'::jsonb,            -- array de URLs de imagens
  status      text not null default 'aberta'        -- aberta | respondida | encerrada
              check (status in ('aberta','respondida','encerrada')),
  resposta    text,
  respondida_por text,
  respondida_em  timestamptz,
  criado_em   timestamptz not null default now()
);

alter table public.solicitacoes enable row level security;
drop policy if exists "solicitacoes_select" on public.solicitacoes;
create policy "solicitacoes_select" on public.solicitacoes for select using (auth.role() = 'authenticated');
drop policy if exists "solicitacoes_insert" on public.solicitacoes;
create policy "solicitacoes_insert" on public.solicitacoes for insert with check (auth.role() = 'authenticated');
drop policy if exists "solicitacoes_update" on public.solicitacoes;
create policy "solicitacoes_update" on public.solicitacoes for update using (auth.role() = 'authenticated');

-- 2) Perfil "vistorias" — adiciona ao constraint da tabela usuarios (caso seja CHECK)
--    Tentativa flexível: se for CHECK constraint, atualiza; se for enum, alter type
do $$
declare
  has_check boolean;
begin
  select exists(
    select 1 from information_schema.check_constraints
    where constraint_name like 'usuarios_perfil_check%'
  ) into has_check;
  if has_check then
    alter table public.usuarios drop constraint if exists usuarios_perfil_check;
    alter table public.usuarios
      add constraint usuarios_perfil_check
      check (perfil in ('admin','sindico','condomino','zelador','vistorias'));
  end if;
end$$;

-- 3) Orçamentos: garantir colunas necessárias
alter table public.orcamentos
  add column if not exists data_criacao timestamptz not null default now();

alter table public.orcamentos
  add column if not exists sem_orcamento boolean not null default false;

alter table public.orcamentos
  add column if not exists item_tipo text;  -- atividade | corretiva | benfeitoria

-- 4) Diário: suporte a múltiplas fotos
alter table public.diario
  add column if not exists evidencias_urls jsonb default '[]'::jsonb;

-- 5) Função utilitária: calcula próxima data baseada em frequência (em dias)
create or replace function public.proxima_data(base date, frequencia text)
returns date as $$
declare
  dias int;
begin
  if base is null then return null; end if;
  dias := case lower(coalesce(frequencia,''))
    when 'diário'      then 1
    when 'diaria'      then 1
    when 'semanal'     then 7
    when 'quinzenal'   then 15
    when 'mensal'      then 30
    when 'bimestral'   then 60
    when 'trimestral'  then 90
    when 'semestral'   then 180
    when 'anual'       then 365
    when 'a cada 2 anos' then 730
    when 'a cada 3 anos' then 1095
    when 'a cada 5 anos' then 1825
    else 0
  end;
  if dias = 0 then return null; end if;
  return base + (dias || ' days')::interval;
end;
$$ language plpgsql immutable;

-- 6) Garantir que calendario tem campo proxima_data (para alimentar calendário automaticamente)
alter table public.calendario
  add column if not exists proxima_data date;

-- =========================================================
-- Migration 003 — Enum Período
-- Converte a coluna `benfeitorias.periodo` (text livre)
-- em um tipo enum com valores fixos. Antes de converter,
-- normaliza os valores existentes para casar com o enum.
-- =========================================================

-- 1) Criar o tipo enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'periodo_enum') then
    create type public.periodo_enum as enum (
      'Diário',
      'Semanal',
      'Quinzenal',
      'Mensal',
      'Bimestral',
      'Trimestral',
      'Semestral',
      'Anual',
      'A Cada 2 Anos',
      'A Cada 3 Anos'
    );
  end if;
end$$;

-- 2) Normalizar valores existentes para o formato exato do enum.
--    Tudo que não casar é zerado (null) para não quebrar a conversão.
update public.benfeitorias
set periodo = case
  when periodo is null or btrim(periodo) = '' then null
  when lower(btrim(periodo)) in ('diário','diario','diariamente','daily','dia') then 'Diário'
  when lower(btrim(periodo)) in ('semanal','semana','semanalmente','weekly','7 dias') then 'Semanal'
  when lower(btrim(periodo)) in ('quinzenal','quinzena','15 dias','15dias') then 'Quinzenal'
  when lower(btrim(periodo)) in ('mensal','mês','mes','mensalmente','monthly','30 dias') then 'Mensal'
  when lower(btrim(periodo)) in ('bimestral','bimensal','2 meses','60 dias') then 'Bimestral'
  when lower(btrim(periodo)) in ('trimestral','3 meses','quarterly','90 dias') then 'Trimestral'
  when lower(btrim(periodo)) in ('semestral','6 meses','semianual','180 dias') then 'Semestral'
  when lower(btrim(periodo)) in ('anual','ano','1 ano','yearly','annually','12 meses','365 dias') then 'Anual'
  when lower(btrim(periodo)) in ('a cada 2 anos','bienal','biênio','bienio','2 anos','24 meses') then 'A Cada 2 Anos'
  when lower(btrim(periodo)) in ('a cada 3 anos','trienal','triênio','trienio','3 anos','36 meses') then 'A Cada 3 Anos'
  else null  -- valor não reconhecido vira NULL para preservar o cadastro
end;

-- 3) Converter a coluna para o tipo enum
alter table public.benfeitorias
  alter column periodo type public.periodo_enum
  using periodo::public.periodo_enum;

-- Observação: se quiser permitir só valores válidos do enum (proibir nulls),
-- rode: alter table public.benfeitorias alter column periodo set not null;

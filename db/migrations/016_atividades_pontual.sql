-- =========================================================
-- Migration 016 — Atividades do Dia a Dia: flag "pontual"
-- Quando true: sem frequência, sem próxima data prevista,
-- gera apenas UM evento no calendário (a partir da data de execução).
-- =========================================================

alter table public.calendario
  add column if not exists pontual boolean not null default false;

-- Marca como pontual qualquer atividade que já não tenha frequência
update public.calendario
   set pontual = true
 where (frequencia is null or btrim(frequencia) = '')
   and pontual = false;

-- =========================================================
-- Migration 018 — Atividades: separar Valor Previsto x Realizado
-- =========================================================

alter table public.calendario add column if not exists valor_previsto  numeric(12,2);
alter table public.calendario add column if not exists valor_realizado numeric(12,2);

-- Migrar valor antigo → valor_realizado
update public.calendario
   set valor_realizado = valor
 where valor is not null and valor_realizado is null;

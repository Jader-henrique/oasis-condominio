-- =========================================================
-- Migration 014 — Corretivas: separar Previsto x Realizado
-- - valor → valor_previsto + valor_realizado
-- - data_inicio → data_inicio_prevista + data_inicio_real
-- - empresa: passa a ser preenchida apenas via Mapa de Cotações
-- =========================================================

alter table public.corretivas add column if not exists valor_previsto       numeric(12,2);
alter table public.corretivas add column if not exists valor_realizado      numeric(12,2);
alter table public.corretivas add column if not exists data_inicio_prevista date;
alter table public.corretivas add column if not exists data_inicio_real     date;

-- Migrar dados existentes (não destrói a coluna antiga, fica como backup)
update public.corretivas
   set valor_realizado = valor
 where valor is not null and valor_realizado is null;

update public.corretivas
   set data_inicio_prevista = data_inicio
 where data_inicio is not null and data_inicio_prevista is null;

-- Observação:
--   `valor` e `data_inicio` antigos ficam como histórico. Após validar
--   em produção, podem ser removidos com:
--     alter table public.corretivas drop column valor;
--     alter table public.corretivas drop column data_inicio;

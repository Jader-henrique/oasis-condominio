-- =========================================================
-- Migration 015 — Benfeitorias: separar Previsto x Realizado
-- - valor → valor_previsto + valor_realizado
-- - data início_real (síndico preenche quando inicia)
-- - previsto (já existe) passa a representar "início previsto"
-- - realizado (já existe) preenchido apenas via App
-- =========================================================

alter table public.benfeitorias add column if not exists valor_previsto    numeric(12,2);
alter table public.benfeitorias add column if not exists valor_realizado   numeric(12,2);
alter table public.benfeitorias add column if not exists data_inicio_real  date;

-- Migrar valor existente como valor_realizado (assumindo que se foi cadastrado, é o valor pago)
update public.benfeitorias
   set valor_realizado = valor
 where valor is not null and valor_realizado is null;

-- Coluna `valor` antiga fica como backup. Para remover depois:
--   alter table public.benfeitorias drop column valor;

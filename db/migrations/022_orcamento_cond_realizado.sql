-- =========================================================
-- Migration 022 — Orçamento do Condomínio: valor realizado
-- Adiciona coluna valor_realizado em orcamento_cond_valores
-- para armazenar o realizado mensal das contas do orçamento.
-- =========================================================

alter table public.orcamento_cond_valores
  add column if not exists valor_realizado numeric(14,2) not null default 0;

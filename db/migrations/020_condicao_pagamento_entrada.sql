-- 020_condicao_pagamento_entrada.sql
-- Adiciona suporte a entrada (parcela à vista) nas condições de pagamento.
-- tem_entrada: flag booleano
-- percentual_entrada: percentual da parcela 0 (só Desproporcional com entrada)
-- Idempotente.

alter table condicao_pagamento
  add column if not exists tem_entrada        boolean  not null default false,
  add column if not exists percentual_entrada numeric;

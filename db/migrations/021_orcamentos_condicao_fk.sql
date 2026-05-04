-- 021_orcamentos_condicao_fk.sql
-- Substitui o campo texto condicao_pagamento por FK para a tabela condicao_pagamento.
-- 1. Adiciona coluna condicao_pagamento_id
-- 2. Limpa o conteúdo do campo texto antigo (mantém coluna, pode dropar depois)
-- Idempotente.

alter table orcamentos
  add column if not exists condicao_pagamento_id integer
    references condicao_pagamento(id) on delete set null;

-- Apaga os dados do campo texto antigo
update orcamentos set condicao_pagamento = null
  where condicao_pagamento is not null;

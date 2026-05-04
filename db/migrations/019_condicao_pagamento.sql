-- 019_condicao_pagamento.sql
-- Tabela de condições de pagamento com enum Proporcional/Desproporcional,
-- parcelas, intervalo e percentuais por parcela (Desproporcional).
-- Idempotente: seguro rodar mais de uma vez.

-- Enum
do $$ begin
  create type tipo_pagamento_enum as enum ('Proporcional', 'Desproporcional');
exception when duplicate_object then null;
end $$;

-- Tabela principal
create table if not exists condicao_pagamento (
  id            serial primary key,
  descricao     text not null,
  tipo          tipo_pagamento_enum not null default 'Proporcional',
  num_parcelas  integer not null check (num_parcelas > 0),
  intervalo     integer not null check (intervalo > 0),
  percentuais   jsonb,          -- array de decimais, preenchido apenas quando tipo='Desproporcional'
  excluido_em   timestamptz,
  criado_em     timestamptz default now()
);

-- RLS
alter table condicao_pagamento enable row level security;
drop policy if exists "condicao_pagamento_all" on condicao_pagamento;
create policy "condicao_pagamento_all" on condicao_pagamento
  for all to authenticated, anon using (true) with check (true);

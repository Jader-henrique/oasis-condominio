-- =========================================================
-- Migration 013 — Soft delete (deleção lógica)
-- Adiciona coluna `excluido_em` em benfeitorias, corretivas,
-- calendario (atividades do dia a dia) e orcamentos.
-- Registros não são apagados fisicamente — apenas marcados.
-- =========================================================

alter table public.benfeitorias add column if not exists excluido_em timestamptz;
alter table public.corretivas   add column if not exists excluido_em timestamptz;
alter table public.calendario   add column if not exists excluido_em timestamptz;
alter table public.orcamentos   add column if not exists excluido_em timestamptz;
alter table public.documentos_item add column if not exists excluido_em timestamptz;

-- Índices para performance dos filtros "WHERE excluido_em IS NULL"
create index if not exists idx_benfeitorias_excluido_em on public.benfeitorias(excluido_em);
create index if not exists idx_corretivas_excluido_em   on public.corretivas(excluido_em);
create index if not exists idx_calendario_excluido_em   on public.calendario(excluido_em);
create index if not exists idx_orcamentos_excluido_em   on public.orcamentos(excluido_em);

-- Função utilitária: ao excluir item de origem, cascata para orçamentos
create or replace function public.soft_delete_cascade_orcamentos(p_item_tipo text, p_item_id bigint)
returns void as $$
begin
  update public.orcamentos
     set excluido_em = now()
   where item_tipo = p_item_tipo
     and item_id = p_item_id
     and excluido_em is null;

  update public.documentos_item
     set excluido_em = now()
   where item_tipo = p_item_tipo
     and item_id = p_item_id
     and excluido_em is null;
end;
$$ language plpgsql;

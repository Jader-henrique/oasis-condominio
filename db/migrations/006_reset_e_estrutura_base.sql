-- =========================================================
-- Migration 006 — Reset de dados + estrutura base
-- 1) Limpa benfeitorias, corretivas e calendario (atividades_diarias)
-- 2) Adiciona valor (numeric) em benfeitorias = valor realizado/pago
-- 3) Cria tabela orcamentos com auto-increment + data_criacao
-- 4) Insere os 3 itens base: gerador, reforma elevador, vaselina corrimãos
-- 5) Cria categorias adicionais se necessário (Gerador)
-- =========================================================

-- 1) Garante categoria "Gerador" para o item de benfeitoria
insert into public.categorias (nome) values ('Gerador') on conflict (nome) do nothing;

-- 2) Limpeza de dados (zera os 3 cadastros principais)
--    Cuidado: também limpa orçamentos e documentos vinculados aos itens removidos
delete from public.documentos_item where item_tipo in ('benfeitoria','corretiva');
delete from public.orcamentos      where item_tipo in ('benfeitoria','corretiva');
delete from public.diario;
delete from public.benfeitorias;
delete from public.corretivas;
delete from public.calendario;

-- 3) Adiciona campo valor (realizado/pago) em benfeitorias
alter table public.benfeitorias
  add column if not exists valor numeric(12,2);

-- 4) Inserir os 3 itens base
--    Benfeitoria: Instalação de gerador 40 KVA — síndico
insert into public.benfeitorias (num, sistema, categoria_id, prioridade, periodo, responsavel_tipo, recorrencia)
select 1,
       'Instalação de gerador 40 KVA',
       (select id from public.categorias where nome = 'Gerador' limit 1),
       'BENFEITORIA',
       'Não Recorrente',
       'Síndico',
       'Não recorrente';

--    Corretiva: Reforma do elevador de serviços — síndico
insert into public.corretivas (num, item, prioridade, status, responsavel_tipo, recorrencia)
values (1, 'Reforma do elevador de serviços', 'URGENTE', 'pendente', 'Síndico', 'Não recorrente');

--    Atividade do Dia a Dia (tabela calendario): Corrimãos de inox — vaselina — zelador
insert into public.calendario (num, descricao, frequencia, mes, status, responsavel_tipo)
values (1, 'Corrimãos de inox — aplicação de vaselina', 'Mensal', '', 'nrealizado', 'Zeladoria');

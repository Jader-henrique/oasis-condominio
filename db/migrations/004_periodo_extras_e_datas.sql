-- =========================================================
-- Migration 004 — Novos valores do enum + conversão de datas
-- 1) Adiciona "A Cada 5 Anos" e "Não Recorrente" ao periodo_enum
-- 2) Converte as colunas `previsto` e `realizado` de text para date,
--    tentando parsear formatos comuns (YYYY-MM-DD, DD/MM/YYYY, DD/MM/YY)
--    e zerando o que não conseguir converter.
-- =========================================================

-- 1) Novos valores do enum (idempotente)
alter type public.periodo_enum add value if not exists 'A Cada 5 Anos';
alter type public.periodo_enum add value if not exists 'Não Recorrente';

-- 2) Conversão das colunas previsto e realizado para DATE
--    Etapa A — limpar strings vazias / espaços
update public.benfeitorias set previsto  = null where previsto  is not null and btrim(previsto)  = '';
update public.benfeitorias set realizado = null where realizado is not null and btrim(realizado) = '';

--    Etapa B — normalizar formatos brasileiros para ISO (YYYY-MM-DD)
update public.benfeitorias
set previsto = to_char(to_date(previsto, 'DD/MM/YYYY'), 'YYYY-MM-DD')
where previsto ~ '^\d{1,2}/\d{1,2}/\d{4}$';

update public.benfeitorias
set previsto = to_char(to_date(previsto, 'DD/MM/YY'), 'YYYY-MM-DD')
where previsto ~ '^\d{1,2}/\d{1,2}/\d{2}$';

update public.benfeitorias
set realizado = to_char(to_date(realizado, 'DD/MM/YYYY'), 'YYYY-MM-DD')
where realizado ~ '^\d{1,2}/\d{1,2}/\d{4}$';

update public.benfeitorias
set realizado = to_char(to_date(realizado, 'DD/MM/YY'), 'YYYY-MM-DD')
where realizado ~ '^\d{1,2}/\d{1,2}/\d{2}$';

--    Etapa C — qualquer valor que NÃO esteja em ISO (YYYY-MM-DD) vira NULL
update public.benfeitorias
set previsto = null
where previsto is not null
  and previsto !~ '^\d{4}-\d{1,2}-\d{1,2}$';

update public.benfeitorias
set realizado = null
where realizado is not null
  and realizado !~ '^\d{4}-\d{1,2}-\d{1,2}$';

--    Etapa D — alterar o tipo das colunas para DATE
alter table public.benfeitorias
  alter column previsto type date using previsto::date;

alter table public.benfeitorias
  alter column realizado type date using realizado::date;

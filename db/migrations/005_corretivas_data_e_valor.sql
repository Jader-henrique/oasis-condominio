-- =========================================================
-- Migration 005 — Corretivas: valor → numeric, datas → date
-- 1) Converte `valor` (text com formatação BRL) para numeric(12,2)
-- 2) Converte `data_inicio` e `data_fim` (text) para date
-- =========================================================

-- 1) Função utilitária para parsear strings BRL ("R$ 1.234,56", "1500,00", "1500.00", etc.)
create or replace function public.brl_to_numeric(s text) returns numeric as $$
declare
  cleaned text;
begin
  if s is null or btrim(s) = '' then return null; end if;
  -- remove R$, espaços e caracteres não numéricos exceto . , -
  cleaned := regexp_replace(s, '[^0-9,.\-]', '', 'g');
  -- formato BR (tem vírgula): remove pontos (milhar), troca vírgula por ponto (decimal)
  if cleaned like '%,%' then
    cleaned := replace(replace(cleaned, '.', ''), ',', '.');
  end if;
  if cleaned = '' then return null; end if;
  begin
    return cleaned::numeric;
  exception when others then
    return null;
  end;
end;
$$ language plpgsql immutable;

-- 2) Converter coluna valor para numeric(12,2)
alter table public.corretivas
  alter column valor type numeric(12,2)
  using public.brl_to_numeric(valor);

-- 3) Converter data_inicio e data_fim para DATE
--    Limpar strings vazias
update public.corretivas set data_inicio = null where data_inicio is not null and btrim(data_inicio) = '';
update public.corretivas set data_fim    = null where data_fim    is not null and btrim(data_fim)    = '';

--    Normalizar formatos brasileiros para ISO
update public.corretivas
set data_inicio = to_char(to_date(data_inicio, 'DD/MM/YYYY'), 'YYYY-MM-DD')
where data_inicio ~ '^\d{1,2}/\d{1,2}/\d{4}$';

update public.corretivas
set data_inicio = to_char(to_date(data_inicio, 'DD/MM/YY'), 'YYYY-MM-DD')
where data_inicio ~ '^\d{1,2}/\d{1,2}/\d{2}$';

update public.corretivas
set data_fim = to_char(to_date(data_fim, 'DD/MM/YYYY'), 'YYYY-MM-DD')
where data_fim ~ '^\d{1,2}/\d{1,2}/\d{4}$';

update public.corretivas
set data_fim = to_char(to_date(data_fim, 'DD/MM/YY'), 'YYYY-MM-DD')
where data_fim ~ '^\d{1,2}/\d{1,2}/\d{2}$';

--    Tudo que não estiver em ISO vira NULL
update public.corretivas set data_inicio = null
where data_inicio is not null and data_inicio !~ '^\d{4}-\d{1,2}-\d{1,2}$';

update public.corretivas set data_fim = null
where data_fim is not null and data_fim !~ '^\d{4}-\d{1,2}-\d{1,2}$';

--    Aplicar tipo DATE
alter table public.corretivas
  alter column data_inicio type date using data_inicio::date;

alter table public.corretivas
  alter column data_fim type date using data_fim::date;

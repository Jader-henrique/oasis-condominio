-- =========================================================
-- Migration 023 — Realizado: importação contábil + parcelas
-- =========================================================

-- 1) Rastrear origem dos lançamentos em orcamento_cond_valores
alter table public.orcamento_cond_valores
  add column if not exists fonte text default 'manual'
    check (fonte in ('manual','importacao_contabil','parcela_fornecedor')),
  add column if not exists orcamento_fornecedor_id uuid
    references public.orcamentos(id) on delete set null;

create index if not exists idx_ocv_orcamento_forn on public.orcamento_cond_valores(orcamento_fornecedor_id);
create index if not exists idx_ocv_fonte on public.orcamento_cond_valores(fonte);

-- 2) Unicidade para upsert (item_id, competencia)
create unique index if not exists ux_ocv_item_competencia
  on public.orcamento_cond_valores(item_id, competencia);

-- 3) RPC: lança parcelas no realizado conforme condição de pagamento
create or replace function public.lancar_parcelas_fornecedor(p_orcamento_id uuid)
returns void language plpgsql as $$
declare
  v_orc           record;
  v_cond          record;
  v_conta_id      bigint;
  v_item_id       bigint;
  v_data_base     date;
  v_valor_total   numeric(14,2);
  v_entrada       numeric(14,2) := 0;
  v_saldo         numeric(14,2);
  v_data_atual    date;
  v_competencia   date;
  v_idx           integer;
  v_parcela_valor numeric(14,2);
  v_perc          numeric;
  v_num_parcelas  integer;
  v_intervalo     integer := 30;
  v_tem_entrada   boolean := false;
  v_pct_entrada   numeric := 0;
  v_tipo_cond     text;
  v_percentuais   numeric[];
begin
  select * into v_orc from public.orcamentos
   where id = p_orcamento_id and selecionado = true and excluido_em is null;
  if not found then return; end if;

  v_valor_total := coalesce(v_orc.valor, 0);
  if v_valor_total <= 0 then return; end if;

  -- Limpa lançamentos anteriores deste orçamento
  delete from public.orcamento_cond_valores
   where orcamento_fornecedor_id = p_orcamento_id and fonte = 'parcela_fornecedor';

  -- Identifica conta_id a partir do item de origem
  v_conta_id := null;
  if v_orc.item_tipo = 'atividade' then
    select conta_id into v_conta_id from public.calendario where id = v_orc.item_id;
  elsif v_orc.item_tipo = 'corretiva' then
    select conta_id into v_conta_id from public.corretivas where id = v_orc.item_id;
  elsif v_orc.item_tipo = 'benfeitoria' then
    select conta_id into v_conta_id from public.benfeitorias where id = v_orc.item_id;
  end if;
  if v_conta_id is null then return; end if;

  -- Data base = data_fechamento (se válida) > data_criacao > hoje
  v_data_base := coalesce(
    case when v_orc.data_fechamento ~ '^\d{4}-\d{2}-\d{2}' then v_orc.data_fechamento::date end,
    v_orc.data_criacao::date,
    current_date
  );

  -- Localizar item do orçamento_cond que case com conta + cobertura da data
  select oci.id into v_item_id
    from public.orcamento_cond_itens oci
    join public.orcamento_cond oc on oc.id = oci.orcamento_id
   where oci.conta_id = v_conta_id
     and oc.excluido_em is null and oci.excluido_em is null
     and v_data_base >= oc.vigencia_de and v_data_base <= oc.vigencia_ate
   order by oc.vigencia_de desc limit 1;
  if v_item_id is null then return; end if;

  -- Carregar condição de pagamento (se existir)
  if v_orc.condicao_pagamento_id is not null then
    select c.tipo, coalesce(c.num_parcelas,0), coalesce(c.intervalo,30),
           coalesce(c.tem_entrada,false), coalesce(c.percentual_entrada,0), c.percentuais
      into v_tipo_cond, v_num_parcelas, v_intervalo, v_tem_entrada, v_pct_entrada, v_percentuais
      from public.condicao_pagamento c
     where c.id = v_orc.condicao_pagamento_id;
  end if;

  -- Calcular entrada
  if v_tem_entrada then
    v_entrada := round((v_valor_total * v_pct_entrada / 100)::numeric, 2);
  end if;
  v_saldo := v_valor_total - v_entrada;

  -- Lançar entrada na competência da data base
  if v_entrada > 0 or coalesce(v_num_parcelas,0) = 0 then
    declare v_vl numeric(14,2);
    begin
      v_vl := case when coalesce(v_num_parcelas,0) = 0 then v_valor_total else v_entrada end;
      v_competencia := date_trunc('month', v_data_base)::date;
      insert into public.orcamento_cond_valores
        (item_id, competencia, valor_previsto, valor_realizado, fonte, orcamento_fornecedor_id)
      values (v_item_id, v_competencia, 0, v_vl, 'parcela_fornecedor', p_orcamento_id)
      on conflict (item_id, competencia) do update
        set valor_realizado = public.orcamento_cond_valores.valor_realizado + excluded.valor_realizado,
            fonte = case when public.orcamento_cond_valores.fonte = 'importacao_contabil'
                      then 'importacao_contabil' else 'parcela_fornecedor' end,
            orcamento_fornecedor_id = coalesce(excluded.orcamento_fornecedor_id, public.orcamento_cond_valores.orcamento_fornecedor_id);
    end;
  end if;

  -- Lançar parcelas
  v_data_atual := v_data_base;
  v_idx := 1;
  while v_idx <= coalesce(v_num_parcelas, 0) loop
    v_data_atual := v_data_atual + (v_intervalo || ' days')::interval;
    v_competencia := date_trunc('month', v_data_atual)::date;

    if v_tipo_cond = 'Desproporcional' and v_percentuais is not null
       and array_length(v_percentuais, 1) >= v_idx then
      v_perc := (v_percentuais[v_idx])::numeric;
      v_parcela_valor := round((v_valor_total * v_perc / 100)::numeric, 2);
    else
      v_parcela_valor := round((v_saldo / nullif(v_num_parcelas,0))::numeric, 2);
    end if;

    if v_parcela_valor > 0 then
      insert into public.orcamento_cond_valores
        (item_id, competencia, valor_previsto, valor_realizado, fonte, orcamento_fornecedor_id)
      values (v_item_id, v_competencia, 0, v_parcela_valor, 'parcela_fornecedor', p_orcamento_id)
      on conflict (item_id, competencia) do update
        set valor_realizado = public.orcamento_cond_valores.valor_realizado + excluded.valor_realizado,
            fonte = case when public.orcamento_cond_valores.fonte = 'importacao_contabil'
                      then 'importacao_contabil' else 'parcela_fornecedor' end,
            orcamento_fornecedor_id = coalesce(excluded.orcamento_fornecedor_id, public.orcamento_cond_valores.orcamento_fornecedor_id);
    end if;
    v_idx := v_idx + 1;
  end loop;
end;
$$;

-- 4) RPC: estornar parcelas (limpa do realizado)
create or replace function public.estornar_parcelas_fornecedor(p_orcamento_id uuid)
returns void language plpgsql as $$
begin
  delete from public.orcamento_cond_valores
   where orcamento_fornecedor_id = p_orcamento_id
     and fonte = 'parcela_fornecedor';
end;
$$;

-- 5) RPC: importar lançamentos contábeis para o realizado
-- Recebe JSONB array com [{codigo_conta, competencia (YYYY-MM-DD), valor}]
-- Soma por (conta, competencia) e grava em orcamento_cond_valores com fonte='importacao_contabil'
create or replace function public.importar_lancamentos_contabeis(p_lancamentos jsonb)
returns table(codigo_conta text, competencia date, valor_total numeric, gravado boolean, motivo text)
language plpgsql as $$
declare
  r record;
  v_conta_id bigint;
  v_item_id  bigint;
begin
  for r in
    select x->>'codigo_conta' as cod,
           (x->>'competencia')::date as comp,
           (x->>'valor')::numeric as val
      from jsonb_array_elements(p_lancamentos) as x
  loop
    -- Busca conta pelo codigo_contabil
    select c.id into v_conta_id from public.contas c
     where c.codigo_contabil = r.cod and c.excluido_em is null limit 1;
    if v_conta_id is null then
      codigo_conta := r.cod; competencia := r.comp; valor_total := r.val;
      gravado := false; motivo := 'Conta não encontrada';
      return next; continue;
    end if;

    -- Busca item do orçamento_cond ativo nessa competência
    select oci.id into v_item_id
      from public.orcamento_cond_itens oci
      join public.orcamento_cond oc on oc.id = oci.orcamento_id
     where oci.conta_id = v_conta_id
       and oc.excluido_em is null and oci.excluido_em is null
       and r.comp >= oc.vigencia_de and r.comp <= oc.vigencia_ate
     order by oc.vigencia_de desc limit 1;
    if v_item_id is null then
      codigo_conta := r.cod; competencia := r.comp; valor_total := r.val;
      gravado := false; motivo := 'Conta sem item no orçamento ativo';
      return next; continue;
    end if;

    -- Upsert
    insert into public.orcamento_cond_valores
      (item_id, competencia, valor_previsto, valor_realizado, fonte)
    values (v_item_id, date_trunc('month', r.comp)::date, 0, abs(r.val), 'importacao_contabil')
    on conflict (item_id, competencia) do update
      set valor_realizado = excluded.valor_realizado,
          fonte = 'importacao_contabil';

    codigo_conta := r.cod; competencia := r.comp; valor_total := r.val;
    gravado := true; motivo := null;
    return next;
  end loop;
end;
$$;

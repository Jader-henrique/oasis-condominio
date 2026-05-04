import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { exportarParaExcel } from '../utils/excel'
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell
} from 'recharts'

// ─── Constantes ────────────────────────────────────────────────────────────────
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const GRUPOS = ['Atividades do Dia a Dia','Intervenções Corretivas','Benfeitorias']
const CORES_GRUPO = ['#0C447C','#A32D2D','#3C3489']
const DIAS_FREQ = {
  'Diário':1,'Semanal':7,'Quinzenal':15,'Mensal':30,
  'Bimestral':60,'Trimestral':90,'Semestral':180,'Anual':365,
  'A Cada 2 Anos':730,'A Cada 5 Anos':1825,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtMoeda(v) {
  if (v == null || v === '') return 'R$ 0,00'
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',','.'))
  return (isNaN(n) ? 0 : n).toLocaleString('pt-BR', { style:'currency', currency:'BRL' })
}
function fmtMoedaK(v) {
  const n = parseFloat(v) || 0
  if (Math.abs(n) >= 1000000) return `R$${(n/1000000).toFixed(1)}M`
  if (Math.abs(n) >= 1000) return `R$${(n/1000).toFixed(0)}k`
  return fmtMoeda(n)
}
function addDias(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r }

// ─── Componentes visuais ──────────────────────────────────────────────────────
function Secao({ titulo, cor, bg, children }) {
  return (
    <div style={{ background:bg, borderLeft:`3px solid ${cor}`, borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
      <div style={{ marginBottom:10, fontSize:12, color:cor, textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:600 }}>{titulo}</div>
      {children}
    </div>
  )
}

function MiniBar({ zelador, sindico, cor='var(--azul)' }) {
  const linhas = [
    { label:'Zelador', ...zelador },
    { label:'Síndico', ...sindico },
  ]
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8, minWidth:110, borderRight:'0.5px solid var(--borda)', paddingRight:12 }}>
      {linhas.map(d => {
        const total = d.total || 1
        return (
          <div key={d.label}>
            <div style={{ fontSize:10, color:'var(--texto-ter)', marginBottom:2, display:'flex', justifyContent:'space-between' }}>
              <span>{d.label}</span><span style={{fontWeight:600,color:cor}}>{d.total}</span>
            </div>
            <div style={{ display:'flex', height:7, borderRadius:4, overflow:'hidden', background:'#e8e8e8' }}>
              {d.real > 0 && <div style={{ width:`${(d.real/total)*100}%`, background:'var(--verde)', transition:'width 0.3s' }}/>}
              {d.pend > 0 && <div style={{ width:`${(d.pend/total)*100}%`, background:cor+'33', transition:'width 0.3s' }}/>}
            </div>
            <div style={{ fontSize:9, color:'var(--texto-ter)', marginTop:2 }}>
              <span style={{color:'var(--verde)'}}>{d.real} real.</span> · <span>{d.pend} pend.</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CardForn({ dados }) {
  return (
    <div style={{ background:'var(--amarelo-bg)', borderRadius:8, padding:'10px 12px', minWidth:170, border:'0.5px solid #e8c840' }}>
      <div style={{ fontSize:10, color:'#7a5c00', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>
        Orç. Fornecedores
      </div>
      {[
        { label:'Previstos Orçamento', val: dados.prevOrc },
        { label:'Provisionados',       val: dados.provisionados },
        { label:'Realizados',          val: dados.realizados },
      ].map(r => (
        <div key={r.label} style={{ marginBottom:5 }}>
          <div style={{ fontSize:10, color:'var(--texto-ter)' }}>{r.label}</div>
          <div style={{ fontSize:13, fontWeight:600, color: r.val > 0 ? 'var(--vermelho)' : 'var(--texto-ter)' }}>
            {r.val > 0 ? fmtMoeda(r.val) : '—'}
          </div>
        </div>
      ))}
    </div>
  )
}

function LinhaOrc({ label, valor, negativo=false, destaque=false, sub=false }) {
  const isPos = valor >= 0
  const cor = destaque
    ? (negativo ? '#7f1f1f' : isPos ? 'var(--verde)' : 'var(--vermelho)')
    : negativo ? '#7f1f1f' : sub ? 'var(--texto-ter)' : '#0d2b6b'
  const bg = destaque ? (negativo ? 'var(--vermelho-bg)' : isPos ? 'var(--verde-bg)' : 'var(--vermelho-bg)') : 'transparent'
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
      padding: destaque ? '5px 6px' : sub ? '1px 6px' : '2px 6px',
      borderRadius: destaque ? 6 : 0, background: bg, marginBottom: 2 }}>
      <span style={{ fontSize: sub ? 10 : 11, color: sub ? 'var(--texto-ter)' : 'var(--texto-sec)', fontWeight: destaque ? 700 : 400 }}>
        {label}
      </span>
      <span style={{ fontSize: destaque ? 14 : sub ? 11 : 12, fontWeight: destaque ? 700 : sub ? 400 : 500, color: cor }}>
        {negativo && valor > 0 ? '-' : ''}{fmtMoeda(valor)}
      </span>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Dashboard({ perfil }) {
  const [atividades,   setAtividades]   = useState([])
  const [corretivas,   setCorretivas]   = useState([])
  const [benfeitorias, setBenfeitorias] = useState([])
  const [orcamentos,   setOrcamentos]   = useState([])
  const [solicitacoes, setSolicitacoes] = useState([])
  const [orcCondList,  setOrcCondList]  = useState([])
  const [orcCondItens, setOrcCondItens] = useState([])
  const [orcCondValores, setOrcCondValores] = useState([])
  const [contasAll,    setContasAll]    = useState([])
  const [periodoIni, setPeriodoIni] = useState(`${new Date().getFullYear()}-01-01`)
  const [periodoFim, setPeriodoFim] = useState(`${new Date().getFullYear()}-12-31`)
  const hoje = new Date().toISOString().slice(0,10)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const [a, c, b, o, s, cond, contas] = await Promise.all([
      supabase.from('calendario').select('*').is('excluido_em', null),
      supabase.from('corretivas').select('*').is('excluido_em', null),
      supabase.from('benfeitorias').select('*').is('excluido_em', null),
      supabase.from('orcamentos').select('*').is('excluido_em', null),
      supabase.from('solicitacoes').select('*'),
      supabase.from('orcamento_cond').select('*').is('excluido_em',null).order('vigencia_de'),
      supabase.from('contas').select('*').is('excluido_em',null),
    ])
    setAtividades(a.data||[])
    setCorretivas(c.data||[])
    setBenfeitorias(b.data||[])
    setOrcamentos(o.data||[])
    setSolicitacoes(s.data||[])
    setOrcCondList(cond.data||[])
    setContasAll(contas.data||[])

    const condIds = (cond.data||[]).map(x => x.id)
    if (condIds.length > 0) {
      const { data: itens } = await supabase
        .from('orcamento_cond_itens')
        .select('*, conta:conta_id(id,descricao,tipo_conta,grupo_orcamentario,codigo_contabil,origem_orcamento)')
        .in('orcamento_id', condIds)
        .is('excluido_em', null)
      setOrcCondItens(itens||[])
      const itemIds = (itens||[]).map(i => i.id)
      if (itemIds.length > 0) {
        const { data: vals } = await supabase.from('orcamento_cond_valores').select('*').in('item_id', itemIds)
        setOrcCondValores(vals||[])
      }
    }
  }

  // ─── Filtros ──────────────────────────────────────────────────────────────────
  function dentroPeriodo(d) {
    if (!d) return false
    const s = String(d).slice(0,10)
    return s >= periodoIni && s <= periodoFim
  }
  function periodoMes(d) {
    if (!d) return false
    const m = String(d).slice(0,7)
    return m >= periodoIni.slice(0,7) && m <= periodoFim.slice(0,7)
  }

  // ─── Orçamento ativo para o período ──────────────────────────────────────────
  const orcAtivo = orcCondList.find(o => {
    const oDe = String(o.vigencia_de).slice(0,7)
    const oAte = String(o.vigencia_ate).slice(0,7)
    return oDe <= periodoFim.slice(0,7) && oAte >= periodoIni.slice(0,7)
  }) || orcCondList[orcCondList.length-1] || null

  const orcAtivItens = orcCondItens.filter(i => i.orcamento_id === orcAtivo?.id)

  function sumValorItem(itemId, campo) {
    return orcCondValores
      .filter(v => v.item_id === itemId && periodoMes(v.competencia))
      .reduce((s,v) => s + (parseFloat(v[campo])||0), 0)
  }

  // Ocorrências de um item no período (para contas Fornecedores)
  function ocorrsNoPeriodo(dataStr, frequencia, pontual) {
    if (!dataStr) return 0
    const ini = new Date(periodoIni)
    const fim = new Date(periodoFim + 'T23:59:59')
    const df = String(dataStr).length === 7 ? dataStr+'-01' : dataStr
    let cur = new Date(df)
    if (pontual || !frequencia || !DIAS_FREQ[frequencia]) {
      return (cur >= ini && cur <= fim) ? 1 : 0
    }
    const dias = DIAS_FREQ[frequencia]
    while (cur < ini) cur = addDias(cur, dias)
    let count = 0
    while (cur <= fim) { count++; cur = addDias(cur, dias) }
    return count
  }

  // Previsto total de uma conta (Fornecedores = calcula das fontes; Condomínio = do DB)
  function previstoForConta(item) {
    if (!item.conta) return 0
    if (item.conta.origem_orcamento === 'Orçamento de Fornecedores') {
      const cId = item.conta.id
      let v = 0
      for (const a of atividades.filter(x => x.conta_id === cId))
        v += (parseFloat(a.valor_previsto)||0) * ocorrsNoPeriodo(a.proxima_data, a.frequencia, a.pontual)
      for (const c of corretivas.filter(x => x.conta_id === cId))
        v += (parseFloat(c.valor_previsto)||0) * ocorrsNoPeriodo(c.data_inicio_prevista, c.recorrencia, null)
      for (const b of benfeitorias.filter(x => x.conta_id === cId))
        v += (parseFloat(b.valor_previsto)||0) * ocorrsNoPeriodo(b.previsto, b.recorrencia, null)
      return v
    }
    return sumValorItem(item.id, 'valor_previsto')
  }

  // ─── Totais previsto do orçamento ─────────────────────────────────────────────
  function calcPrevisto() {
    const byGrupo = {}; let receitas = 0; let gastos = 0
    const receitaContas = []
    for (const item of orcAtivItens) {
      const c = item.conta; if (!c) continue
      const val = previstoForConta(item)
      if (c.tipo_conta === 'Receita') {
        receitas += val
        receitaContas.push({ descricao: c.descricao, valor: val })
      } else {
        gastos += val
        byGrupo[c.grupo_orcamentario] = (byGrupo[c.grupo_orcamentario]||0) + val
      }
    }
    return { receitas, gastos, total: receitas - gastos, byGrupo, receitaContas }
  }

  // ─── Totais realizado das fontes (agrupado por tipo) ─────────────────────────
  function calcRealizado() {
    const contaMap = {}
    for (const c of contasAll) contaMap[c.id] = c
    const byGrupo = {}; let receitas = 0; let gastos = 0

    const proc = (rows, dataFn, okFn, valFn) => {
      for (const r of rows) {
        if (!r.conta_id) continue
        const conta = contaMap[r.conta_id]; if (!conta) continue
        if (!okFn(r)) continue
        const d = dataFn(r); if (!d || !dentroPeriodo(d)) continue
        const v = parseFloat(valFn(r))||0
        if (conta.tipo_conta === 'Receita') receitas += v
        else {
          gastos += v
          byGrupo[conta.grupo_orcamentario] = (byGrupo[conta.grupo_orcamentario]||0) + v
        }
      }
    }
    proc(atividades,   r => r.realizado_em?.slice(0,10), r => r.status==='realizado', r => r.valor_realizado||r.valor||0)
    proc(corretivas,   r => r.data_fim?.slice(0,10),     r => r.status==='realizado', r => r.valor_realizado||0)
    proc(benfeitorias, r => String(r.realizado||'').slice(0,10), r => !!r.realizado,  r => r.valor_realizado||0)
    return { receitas, gastos, total: receitas - gastos, byGrupo }
  }

  // ─── Card Fornecedores por seção ──────────────────────────────────────────────
  function calcFornCard(grupo, itemTipo) {
    // Previstos: todos os itens do grupo no orçamento (qualquer origem)
    const prevOrc = orcAtivItens
      .filter(i => i.conta?.grupo_orcamentario === grupo && i.conta?.tipo_conta === 'Gasto')
      .reduce((s, item) => s + previstoForConta(item), 0)

    // Provisionados: orçamentos (tabela orcamentos) selecionados no período
    const provisionados = orcamentos
      .filter(o => o.selecionado && !o.sem_orcamento && o.item_tipo === itemTipo && dentroPeriodo(o.data))
      .reduce((s, o) => s + (parseFloat(o.valor)||0), 0)

    // Realizados: valor_realizado armazenado em orcamento_cond_valores
    const realizados = orcAtivItens
      .filter(i => i.conta?.grupo_orcamentario === grupo && i.conta?.tipo_conta === 'Gasto')
      .reduce((s, item) => s + sumValorItem(item.id, 'valor_realizado'), 0)

    return { prevOrc, provisionados, realizados }
  }

  // ─── Responsável por período (com breakdown) ──────────────────────────────────
  function calcRespPeriodo(lista, dataFn, statusFn) {
    const noPer = lista.filter(i => dentroPeriodo(dataFn(i)))
    const zel   = noPer.filter(i => i.responsavel_tipo === 'Zeladoria')
    const sind  = noPer.filter(i => i.responsavel_tipo === 'Síndico')
    const prazOk = (i) => { const d = dataFn(i); return !!d && d >= hoje }
    return {
      total:         noPer.length,
      zeladorTotal:  zel.length,
      zeladorReal:   zel.filter(statusFn).length,
      zeladorPend:   zel.filter(i => !statusFn(i)).length,
      zeladorNoPrazo:zel.filter(i => !statusFn(i) && prazOk(i)).length,
      zeladorAtras:  zel.filter(i => !statusFn(i) && !prazOk(i)).length,
      sindicoTotal:  sind.length,
      sindicoReal:   sind.filter(statusFn).length,
      sindicoPend:   sind.filter(i => !statusFn(i)).length,
      sindicoNoPrazo:sind.filter(i => !statusFn(i) && prazOk(i)).length,
      sindicoAtras:  sind.filter(i => !statusFn(i) && !prazOk(i)).length,
    }
  }

  const respAt  = calcRespPeriodo(atividades,   i => i.proxima_data||i.realizado_em?.slice(0,10), i => i.status==='realizado')
  const respCor = calcRespPeriodo(corretivas,   i => i.data_inicio_prevista||i.data_inicio_real||i.data_fim, i => i.status==='realizado')
  const respBen = calcRespPeriodo(benfeitorias, i => i.previsto||i.data_inicio_real||i.realizado, i => !!i.realizado)

  // ─── Dados do gráfico mensal ──────────────────────────────────────────────────
  const dadosMes = MESES.map((nome, idx) => {
    const ano = new Date(periodoIni).getFullYear()
    const mesKey = `${ano}-${String(idx+1).padStart(2,'0')}`
    const filtroMes = d => {
      if (!d) return false
      const dt = new Date(d); return dt.getFullYear() === ano && dt.getMonth() === idx
    }
    // Realizados: orçamentos fornecedores fechados neste mês
    const valTotal = orcamentos
      .filter(o => o.selecionado && filtroMes(o.data))
      .reduce((s,o) => s + (parseFloat(o.valor)||0), 0)
    // Gastos previstos do orçamento do condomínio neste mês
    const orcGastosPrev = orcCondValores
      .filter(v => String(v.competencia||'').slice(0,7) === mesKey)
      .reduce((s,v) => {
        const item = orcAtivItens.find(i => i.id === v.item_id)
        if (!item || item.conta?.tipo_conta !== 'Gasto') return s
        return s + (parseFloat(v.valor_previsto)||0)
      }, 0)
    return { mes: nome, valTotal, orcGastosPrev }
  })

  // ─── Computed ─────────────────────────────────────────────────────────────────
  const previsto  = orcAtivo ? calcPrevisto()  : null
  const realizado = orcAtivo ? calcRealizado() : null
  const si = parseFloat(orcAtivo?.saldo_inicial) || 0
  const necPrev = previsto  ? si + previsto.receitas  - previsto.gastos  : 0
  const necReal = realizado ? si + realizado.receitas - realizado.gastos : 0

  const dadosPizzaOrc = GRUPOS.map((g, i) => ({
    name: g === 'Atividades do Dia a Dia' ? 'Atividades' : g === 'Intervenções Corretivas' ? 'Corretivas' : 'Benfeitorias',
    value: previsto?.byGrupo[g] || 0,
    cor: CORES_GRUPO[i],
  })).filter(d => d.value > 0)

  const fornAt  = orcAtivo ? calcFornCard('Atividades do Dia a Dia',   'atividade')   : { prevOrc:0, provisionados:0, realizados:0 }
  const fornCor = orcAtivo ? calcFornCard('Intervenções Corretivas', 'corretiva')   : { prevOrc:0, provisionados:0, realizados:0 }
  const fornBen = orcAtivo ? calcFornCard('Benfeitorias',            'benfeitoria') : { prevOrc:0, provisionados:0, realizados:0 }

  const solPend = solicitacoes.filter(s => s.status==='aberta').length
  const solResp = solicitacoes.filter(s => s.status==='respondida'||s.status==='encerrada').length

  // ─── Render helpers ───────────────────────────────────────────────────────────
  function SecaoItens({ cor, resp, forn }) {
    return (
      <div style={{ display:'grid', gridTemplateColumns:'auto 1fr auto', gap:14, alignItems:'start' }}>
        <MiniBar
          cor={cor}
          zelador={{ total:resp.zeladorTotal, real:resp.zeladorReal, pend:resp.zeladorPend }}
          sindico={{ total:resp.sindicoTotal, real:resp.sindicoReal, pend:resp.sindicoPend }}
        />
        <div>
          <div style={{ fontSize:32, fontWeight:600, color:cor, lineHeight:1 }}>{resp.total}</div>
          <div style={{ fontSize:11, color:'var(--texto-sec)', marginBottom:10 }}>itens no período</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:6 }}>
            {[
              { l:'No prazo',   v: resp.zeladorNoPrazo+resp.sindicoNoPrazo,  c:'var(--verde)' },
              { l:'Atrasadas',  v: resp.zeladorAtras+resp.sindicoAtras,       c:'var(--vermelho)' },
              { l:'Realizadas', v: resp.zeladorReal+resp.sindicoReal,          c: cor },
              { l:'Pendentes',  v: resp.zeladorPend+resp.sindicoPend,          c:'var(--texto-sec)' },
            ].map(s => (
              <div key={s.l} style={{ background:'rgba(255,255,255,0.6)', borderRadius:6, padding:'6px 8px' }}>
                <div style={{ fontSize:18, fontWeight:600, color:s.c }}>{s.v}</div>
                <div style={{ fontSize:10, color:'var(--texto-ter)' }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        <CardForn dados={forn}/>
      </div>
    )
  }

  // ─── JSX ─────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom:8 }}>
        <div className="page-title">Dashboard</div>
        <div className="page-sub">Visão geral consolidada — atividades, intervenções, benfeitorias e solicitações</div>
      </div>

      {/* Filtro de período */}
      <div className="card" style={{ marginBottom:14, display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap' }}>
        <div className="form-group" style={{ marginBottom:0 }}>
          <label>Período (início)</label>
          <input type="date" value={periodoIni} onChange={e => setPeriodoIni(e.target.value)}/>
        </div>
        <div className="form-group" style={{ marginBottom:0 }}>
          <label>Período (fim)</label>
          <input type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)}/>
        </div>
        {orcAtivo && (
          <div style={{ fontSize:11, color:'var(--texto-sec)', padding:'6px 10px', background:'var(--azul-bg)', borderRadius:6 }}>
            <i className="fa-solid fa-file-invoice-dollar" style={{ marginRight:6, color:'var(--azul)' }}></i>
            Orçamento: <strong>{orcAtivo.descricao}</strong>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          SEÇÃO 1 — ORÇAMENTO DO CONDOMÍNIO
         ══════════════════════════════════════════════════════════════════════════ */}
      <Secao titulo="Orçamento do Condomínio" cor="var(--azul)" bg="var(--azul-bg)">
        {!orcAtivo ? (
          <div style={{ textAlign:'center', color:'var(--texto-ter)', padding:24, fontSize:13 }}>
            <i className="fa-solid fa-file-invoice-dollar" style={{ fontSize:24, marginBottom:8, display:'block' }}></i>
            Nenhum orçamento ativo para o período selecionado
          </div>
        ) : (
          <>
            {/* Linha principal: Previsto | Realizado | Pizza */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:12, marginBottom:12 }}>

              {/* Previsto */}
              <div className="card" style={{ padding:12 }}>
                <div style={{ fontSize:11, color:'var(--azul)', fontWeight:700, textTransform:'uppercase', marginBottom:8, letterSpacing:'0.05em' }}>
                  <i className="fa-solid fa-chart-line" style={{ marginRight:6 }}></i>Previsto
                </div>
                <div style={{ fontSize:10, color:'var(--texto-ter)', fontWeight:600, textTransform:'uppercase', marginBottom:4 }}>Receitas</div>
                {(previsto.receitaContas||[]).map(c => (
                  <LinhaOrc key={c.descricao} label={c.descricao} valor={c.valor} sub/>
                ))}
                <LinhaOrc label="Total Receitas" valor={previsto.receitas} destaque/>
                <div style={{ height:8 }}/>
                <div style={{ fontSize:10, color:'var(--texto-ter)', fontWeight:600, textTransform:'uppercase', marginBottom:4 }}>Gastos</div>
                {GRUPOS.map(g => (previsto.byGrupo[g]||0) > 0
                  ? <LinhaOrc key={g} label={g} valor={previsto.byGrupo[g]} negativo sub/>
                  : null
                )}
                <LinhaOrc label="Total Gastos" valor={previsto.gastos} negativo destaque/>
                <div style={{ height:8 }}/>
                <LinhaOrc label="Resultado" valor={previsto.total} destaque/>
              </div>

              {/* Realizado */}
              <div className="card" style={{ padding:12 }}>
                <div style={{ fontSize:11, color:'var(--verde)', fontWeight:700, textTransform:'uppercase', marginBottom:8, letterSpacing:'0.05em' }}>
                  <i className="fa-solid fa-circle-check" style={{ marginRight:6 }}></i>Realizado
                </div>
                <div style={{ fontSize:10, color:'var(--texto-ter)', fontWeight:600, textTransform:'uppercase', marginBottom:4 }}>Receitas</div>
                <LinhaOrc label="Total Receitas" valor={realizado.receitas} destaque/>
                <div style={{ height:8 }}/>
                <div style={{ fontSize:10, color:'var(--texto-ter)', fontWeight:600, textTransform:'uppercase', marginBottom:4 }}>Gastos</div>
                {GRUPOS.map(g => (realizado.byGrupo[g]||0) > 0
                  ? <LinhaOrc key={g} label={g} valor={realizado.byGrupo[g]} negativo sub/>
                  : null
                )}
                <LinhaOrc label="Total Gastos" valor={realizado.gastos} negativo destaque/>
                <div style={{ height:8 }}/>
                <LinhaOrc label="Resultado" valor={realizado.total} destaque/>
              </div>

              {/* Pizza */}
              {dadosPizzaOrc.length > 0 && (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, minWidth:190 }}>
                  <div style={{ fontSize:10, color:'var(--texto-ter)', fontWeight:600, textTransform:'uppercase' }}>Gastos Previstos por Grupo</div>
                  <PieChart width={180} height={150}>
                    <Pie data={dadosPizzaOrc} dataKey="value" nameKey="name" outerRadius={65} innerRadius={28}>
                      {dadosPizzaOrc.map((entry,i) => <Cell key={i} fill={entry.cor}/>)}
                    </Pie>
                    <Tooltip formatter={v => fmtMoeda(v)}/>
                  </PieChart>
                  <div style={{ display:'flex', flexDirection:'column', gap:3, width:'100%' }}>
                    {dadosPizzaOrc.map((d,i) => (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:5, fontSize:10 }}>
                        <div style={{ width:8, height:8, borderRadius:2, background:d.cor, flexShrink:0 }}/>
                        <span style={{ color:'var(--texto-sec)', flex:1 }}>{d.name}</span>
                        <span style={{ color:'var(--texto-ter)', fontWeight:600 }}>{fmtMoedaK(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Necessidade de Caixa */}
            <div className="card" style={{ padding:12 }}>
              <div style={{ fontSize:11, color:'var(--lilas)', fontWeight:700, textTransform:'uppercase', marginBottom:10, letterSpacing:'0.05em' }}>
                <i className="fa-solid fa-wallet" style={{ marginRight:6 }}></i>Necessidade de Caixa
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ borderBottom:'0.5px solid var(--borda)' }}>
                    <th style={{ textAlign:'left', padding:'4px 8px', color:'var(--texto-ter)', fontSize:10, fontWeight:600, width:'40%' }}></th>
                    <th style={{ textAlign:'right', padding:'4px 8px', color:'var(--azul)', fontSize:10, fontWeight:600 }}>PREVISTO</th>
                    <th style={{ textAlign:'right', padding:'4px 8px', color:'var(--verde)', fontSize:10, fontWeight:600 }}>REALIZADO</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label:'Saldo Inicial', prev:si,               real:si,                neg:false, dest:false },
                    { label:'(+) Receitas',  prev:previsto.receitas, real:realizado.receitas, neg:false, dest:false },
                    { label:'(-) Gastos',    prev:previsto.gastos,   real:realizado.gastos,   neg:true,  dest:false },
                    { label:'Resultado',     prev:necPrev,           real:necReal,            neg:false, dest:true  },
                  ].map(r => {
                    const bgRow = r.dest ? (necPrev >= 0 ? 'var(--verde-bg)' : 'var(--vermelho-bg)') : 'transparent'
                    const corPrev = r.dest ? (necPrev>=0?'var(--verde)':'var(--vermelho)') : r.neg?'#7f1f1f':'#0d2b6b'
                    const corReal = r.dest ? (necReal>=0?'var(--verde)':'var(--vermelho)') : r.neg?'#7f1f1f':'#0d2b6b'
                    return (
                      <tr key={r.label} style={{ background:bgRow, fontWeight:r.dest?700:400 }}>
                        <td style={{ padding:'5px 8px', color:'var(--texto-sec)', borderRadius:r.dest?'6px 0 0 6px':0 }}>{r.label}</td>
                        <td style={{ padding:'5px 8px', textAlign:'right', color:corPrev, fontFamily:'monospace' }}>
                          {r.neg&&r.prev>0?'-':''}{fmtMoeda(r.prev)}
                        </td>
                        <td style={{ padding:'5px 8px', textAlign:'right', color:corReal, fontFamily:'monospace', borderRadius:r.dest?'0 6px 6px 0':0 }}>
                          {r.neg&&r.real>0?'-':''}{fmtMoeda(r.real)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Secao>

      {/* ══════════════════════════════════════════════════════════════════════════
          SEÇÃO 2 — ATIVIDADES DO DIA A DIA
         ══════════════════════════════════════════════════════════════════════════ */}
      <Secao titulo="Atividades do Dia a Dia" cor="var(--azul)" bg="var(--azul-bg)">
        <SecaoItens cor="var(--azul)" resp={respAt} forn={fornAt}/>
      </Secao>

      {/* ══════════════════════════════════════════════════════════════════════════
          SEÇÃO 3 — INTERVENÇÕES CORRETIVAS
         ══════════════════════════════════════════════════════════════════════════ */}
      <Secao titulo="Intervenções Corretivas" cor="var(--vermelho)" bg="var(--vermelho-bg)">
        <SecaoItens cor="var(--vermelho)" resp={respCor} forn={fornCor}/>
      </Secao>

      {/* ══════════════════════════════════════════════════════════════════════════
          SEÇÃO 4 — BENFEITORIAS
         ══════════════════════════════════════════════════════════════════════════ */}
      <Secao titulo="Benfeitorias" cor="var(--lilas)" bg="var(--lilas-bg)">
        <SecaoItens cor="var(--lilas)" resp={respBen} forn={fornBen}/>
      </Secao>

      {/* ══════════════════════════════════════════════════════════════════════════
          SEÇÃO 5 — SOLICITAÇÕES DE MORADOR
         ══════════════════════════════════════════════════════════════════════════ */}
      <Secao titulo="Solicitações de Morador" cor="var(--verde)" bg="var(--verde-bg)">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))', gap:10 }}>
          {[
            { titulo:'Recebidas',   valor:solicitacoes.length, cor:'var(--texto)' },
            { titulo:'Respondidas', valor:solResp,             cor:'var(--azul)' },
            { titulo:'Pendentes',   valor:solPend,             cor:'var(--vermelho)' },
          ].map(c => (
            <div key={c.titulo} className="card" style={{ padding:14 }}>
              <div style={{ fontSize:11, color:'var(--texto-ter)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{c.titulo}</div>
              <div style={{ fontSize:22, fontWeight:500, color:c.cor, marginTop:4 }}>{c.valor}</div>
            </div>
          ))}
        </div>
      </Secao>

      {/* ══════════════════════════════════════════════════════════════════════════
          GRÁFICO — Valores fechados x Gastos previstos orçamento
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="card card-verde" style={{ marginBottom:14, padding:16 }}>
        <div style={{ fontWeight:500, marginBottom:8 }}>
          Valores fechados por mês vs. Gastos previstos no orçamento
        </div>
        <div style={{ height:300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dadosMes}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0DDD6"/>
              <XAxis dataKey="mes" fontSize={11}/>
              <YAxis fontSize={11} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`}/>
              <Tooltip formatter={v => fmtMoeda(v)}/>
              <Legend wrapperStyle={{ fontSize:11 }}/>
              <Bar dataKey="valTotal" name="Realizados (total)" fill="#3B6D11" barSize={28}/>
              <Line type="monotone" dataKey="orcGastosPrev" name="Gastos Previstos (orçamento)" stroke="#0C447C" strokeWidth={2} dot={{ r:3 }}/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

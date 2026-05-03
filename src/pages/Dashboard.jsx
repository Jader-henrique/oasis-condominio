import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { exportarParaExcel } from '../utils/excel'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell
} from 'recharts'

const TIPOS = {
  atividade:   { label:'Atividade do Dia a Dia', cor:'#0C447C' },
  corretiva:   { label:'Intervenção Corretiva',  cor:'#A32D2D' },
  benfeitoria: { label:'Benfeitoria',             cor:'#3C3489' }
}
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function fmtMoeda(v) {
  if (v == null) return 'R$ 0,00'
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',','.'))
  return (isNaN(n) ? 0 : n).toLocaleString('pt-BR', { style:'currency', currency:'BRL' })
}



function Secao({ titulo, cor, bg, children }) {
  return (
    <div style={{
      background: bg,
      borderLeft: '3px solid ' + cor,
      borderRadius: 10,
      padding: '12px 14px',
      marginBottom: 14
    }}>
      <div style={{
        marginBottom: 10, fontSize: 12, color: cor,
        textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600
      }}>{titulo}</div>
      {children}
    </div>
  )
}

function CardSplit({ titulo, total, zelador, sindico, terceiro, cor='var(--azul)' }) {
  return (
    <div className="card" style={{padding:14, gridColumn:'span 2'}}>
      <div style={{fontSize:11, color:'var(--texto-ter)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6}}>{titulo}</div>
      <div style={{display:'flex', alignItems:'stretch', gap:12, minHeight:78}}>
        <div style={{flex:1, display:'flex', flexDirection:'column', justifyContent:'center'}}>
          <div style={{fontSize:42, fontWeight:600, color:cor, lineHeight:1}}>{total}</div>
          <div style={{fontSize:11, color:'var(--texto-sec)', marginTop:4}}>total</div>
        </div>
        <div style={{display:'flex', flexDirection:'column', justifyContent:'space-between', minWidth:110, borderLeft:'0.5px solid var(--borda)', paddingLeft:12}}>
          <div>
            <div style={{fontSize:10, color:'var(--texto-ter)', textTransform:'uppercase', letterSpacing:'0.05em'}}>Zelador</div>
            <div style={{fontSize:18, fontWeight:500, color:'var(--azul)'}}>{zelador}</div>
          </div>
          <div>
            <div style={{fontSize:10, color:'var(--texto-ter)', textTransform:'uppercase', letterSpacing:'0.05em'}}>Síndico</div>
            <div style={{fontSize:18, fontWeight:500, color:'var(--amarelo)'}}>{sindico}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CardStat({ titulo, valor, cor='var(--texto)', sub }) {
  return (
    <div className="card" style={{padding:14}}>
      <div style={{fontSize:11, color:'var(--texto-ter)', textTransform:'uppercase', letterSpacing:'0.05em'}}>{titulo}</div>
      <div style={{fontSize:22, fontWeight:500, color:cor, marginTop:4}}>{valor}</div>
      {sub && <div style={{fontSize:11, color:'var(--texto-sec)', marginTop:2}}>{sub}</div>}
    </div>
  )
}

export default function Dashboard({ perfil }) {
  const [atividades, setAtividades] = useState([])
  const [corretivas, setCorretivas] = useState([])
  const [benfeitorias, setBenfeitorias] = useState([])
  const [orcamentos, setOrcamentos] = useState([])
  const [solicitacoes, setSolicitacoes] = useState([])
  const [periodoIni, setPeriodoIni] = useState(`${new Date().getFullYear()}-01-01`)
  const [periodoFim, setPeriodoFim] = useState(`${new Date().getFullYear()}-12-31`)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const [a, c, b, o, s] = await Promise.all([
      supabase.from('calendario').select('*').is('excluido_em', null),
      supabase.from('corretivas').select('*').is('excluido_em', null),
      supabase.from('benfeitorias').select('*').is('excluido_em', null),
      supabase.from('orcamentos').select('*').is('excluido_em', null),
      supabase.from('solicitacoes').select('*'),
    ])
    setAtividades(a.data||[]); setCorretivas(c.data||[]); setBenfeitorias(b.data||[])
    setOrcamentos(o.data||[]); setSolicitacoes(s.data||[])
  }

  // Filtra por período
  function dentroPeriodo(d) {
    if (!d) return false
    const s = String(d).slice(0,10)
    return s >= periodoIni && s <= periodoFim
  }

  // ---- Cards por atividade
  const calcCards = (lista, dataFn, statusFn) => {
    const noPeriodo = lista.filter(i => dentroPeriodo(dataFn(i)))
    const realizados = noPeriodo.filter(statusFn)
    const pendentes = noPeriodo.filter(i => !statusFn(i))
    const valor = noPeriodo.reduce((s,i) => s + (parseFloat(i.valor)||0), 0)
    const hoje = new Date().toISOString().slice(0,10)
    const noPrazo  = pendentes.filter(i => { const dp = dataFn(i); return dp && dp >= hoje }).length
    const atrasados = pendentes.filter(i => { const dp = dataFn(i); return dp && dp < hoje }).length
    return { total:noPeriodo.length, realizados:realizados.length, pendentes:pendentes.length, valor, noPrazo, atrasados }
  }

  const cardsAt = calcCards(atividades,   i => i.proxima_data || i.realizado_em?.slice(0,10), i => i.status==='realizado')
  const cardsCor= calcCards(corretivas,   i => i.data_inicio || i.data_fim,                    i => i.status==='realizado')
  const cardsBen= calcCards(benfeitorias, i => i.previsto || i.realizado,                       i => !!i.realizado)

  // Contagens por responsável (sem filtro de período — total absoluto)
  function porResponsavel(lista) {
    return {
      total:    lista.length,
      zelador:  lista.filter(i => i.responsavel_tipo === 'Zeladoria').length,
      sindico:  lista.filter(i => i.responsavel_tipo === 'Síndico').length,
      terceiro: lista.filter(i => i.responsavel_tipo === 'Terceiro').length,
    }
  }
  const respAt  = porResponsavel(atividades)
  const respCor = porResponsavel(corretivas)
  const respBen = porResponsavel(benfeitorias)

  // Estatísticas de orçamentos
  const orcsAtivos       = orcamentos.filter(o => !o.dispensa)
  const orcsEmCotacao    = orcsAtivos.filter(o => !o.selecionado && !o.sem_orcamento)
  const orcsFechados     = orcsAtivos.filter(o => o.selecionado && !o.sem_orcamento)
  const orcsSemOrcamento = orcsAtivos.filter(o => o.sem_orcamento)
  const valorOrcsFechados = orcsFechados.reduce((s,o) => s + (parseFloat(o.valor)||0), 0)

  // ---- Gráfico combinado: por mês
  const dadosMes = MESES.map((nome, idx) => {
    const ano = new Date(periodoIni).getFullYear()
    const filtroMes = (d) => {
      if (!d) return false
      const dt = new Date(d)
      return dt.getFullYear() === ano && dt.getMonth() === idx
    }
    // Quantidades
    const qtdAt  = atividades.filter(i => filtroMes(i.proxima_data || i.realizado_em?.slice(0,10))).length
    const qtdCor = corretivas.filter(i => filtroMes(i.data_inicio || i.data_fim)).length
    const qtdBen = benfeitorias.filter(i => filtroMes(i.previsto || i.realizado)).length
    // Valores (apenas orçamentos fechados)
    const orcsFechadosMes = orcamentos.filter(o => o.selecionado && filtroMes(o.data))
    const valAt  = orcsFechadosMes.filter(o => o.item_tipo==='atividade').reduce((s,o) => s + (parseFloat(o.valor)||0), 0)
    const valCor = orcsFechadosMes.filter(o => o.item_tipo==='corretiva').reduce((s,o) => s + (parseFloat(o.valor)||0), 0)
    const valBen = orcsFechadosMes.filter(o => o.item_tipo==='benfeitoria').reduce((s,o) => s + (parseFloat(o.valor)||0), 0)
    return {
      mes: nome,
      qtdAt, qtdCor, qtdBen, qtdTotal: qtdAt + qtdCor + qtdBen,
      valAt, valCor, valBen, valTotal: valAt + valCor + valBen
    }
  })

  // ---- Pizza: total por tipo
  const dadosPizza = [
    { name:'Atividades',  value:atividades.length,   cor:TIPOS.atividade.cor },
    { name:'Corretivas',  value:corretivas.length,   cor:TIPOS.corretiva.cor },
    { name:'Benfeitorias',value:benfeitorias.length, cor:TIPOS.benfeitoria.cor },
  ]

  // Solicitações
  const solRecebidas = solicitacoes.length
  const solRespondidas = solicitacoes.filter(s => s.status==='respondida' || s.status==='encerrada').length
  const solPendentes = solicitacoes.filter(s => s.status==='aberta').length

  function exportarTudo() {
    const cards = [
      { Indicador:'Atividades — Total',      Valor:cardsAt.total },
      { Indicador:'Atividades — Realizadas', Valor:cardsAt.realizados },
      { Indicador:'Atividades — Pendentes',  Valor:cardsAt.pendentes },
      { Indicador:'Atividades — Valor (R$)', Valor:cardsAt.valor },
      { Indicador:'Atividades — No prazo',   Valor:cardsAt.noPrazo },
      { Indicador:'Atividades — Atrasadas',  Valor:cardsAt.atrasados },
      { Indicador:'Corretivas — Total',      Valor:cardsCor.total },
      { Indicador:'Corretivas — Realizadas', Valor:cardsCor.realizados },
      { Indicador:'Corretivas — Pendentes',  Valor:cardsCor.pendentes },
      { Indicador:'Corretivas — Valor (R$)', Valor:cardsCor.valor },
      { Indicador:'Corretivas — No prazo',   Valor:cardsCor.noPrazo },
      { Indicador:'Corretivas — Atrasadas',  Valor:cardsCor.atrasados },
      { Indicador:'Benfeitorias — Total',      Valor:cardsBen.total },
      { Indicador:'Benfeitorias — Realizadas', Valor:cardsBen.realizados },
      { Indicador:'Benfeitorias — Pendentes',  Valor:cardsBen.pendentes },
      { Indicador:'Benfeitorias — Valor (R$)', Valor:cardsBen.valor },
      { Indicador:'Solicitações Recebidas',  Valor:solRecebidas },
      { Indicador:'Solicitações Respondidas',Valor:solRespondidas },
      { Indicador:'Solicitações Pendentes',  Valor:solPendentes },
    ]
    exportarParaExcel(cards, `dashboard_${periodoIni}_a_${periodoFim}.xlsx`, 'Indicadores')
  }
  function exportarMensal() {
    exportarParaExcel(dadosMes, `dashboard_mensal.xlsx`, 'Mensal')
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,flexWrap:'wrap',marginBottom:8}}>
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">Visão geral consolidada — atividades, intervenções, benfeitorias e solicitações</div>
        </div>
        <button className="btn btn-sm" onClick={exportarTudo}>
          <i className="fa-solid fa-file-excel" style={{marginRight:6}}></i>Exportar indicadores
        </button>
      </div>

      <div className="card" style={{marginBottom:14, display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap'}}>
        <div className="form-group" style={{marginBottom:0}}>
          <label>Período (início)</label>
          <input type="date" value={periodoIni} onChange={e => setPeriodoIni(e.target.value)}/>
        </div>
        <div className="form-group" style={{marginBottom:0}}>
          <label>Período (fim)</label>
          <input type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)}/>
        </div>
      </div>

      {/* Cards por tipo */}
      <Secao titulo="Atividades do Dia a Dia" cor="var(--azul)" bg="var(--azul-bg)">
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:10}}>
          <CardSplit titulo="Atividades cadastradas" total={respAt.total} zelador={respAt.zelador} sindico={respAt.sindico} cor="var(--azul)"/>
          <CardStat titulo="Pendentes / Realizados (período)" valor={`${cardsAt.pendentes} / ${cardsAt.realizados}`}/>
          <CardStat titulo="Valor" valor={fmtMoeda(cardsAt.valor)} cor="var(--azul)"/>
          <CardStat titulo="No prazo" valor={cardsAt.noPrazo} cor="var(--verde)"/>
          <CardStat titulo="Atrasados" valor={cardsAt.atrasados} cor="var(--vermelho)"/>
        </div>
      </Secao>

      <Secao titulo="Intervenções Corretivas" cor="var(--vermelho)" bg="var(--vermelho-bg)">
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:10}}>
          <CardSplit titulo="Corretivas cadastradas" total={respCor.total} zelador={respCor.zelador} sindico={respCor.sindico} cor="var(--vermelho)"/>
          <CardStat titulo="Pendentes / Realizadas (período)" valor={`${cardsCor.pendentes} / ${cardsCor.realizados}`}/>
          <CardStat titulo="Valor" valor={fmtMoeda(cardsCor.valor)} cor="var(--vermelho)"/>
          <CardStat titulo="No prazo" valor={cardsCor.noPrazo} cor="var(--verde)"/>
          <CardStat titulo="Atrasadas" valor={cardsCor.atrasados} cor="var(--vermelho)"/>
        </div>
      </Secao>

      <Secao titulo="Benfeitorias" cor="var(--lilas)" bg="var(--lilas-bg)">
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:10}}>
          <CardSplit titulo="Benfeitorias cadastradas" total={respBen.total} zelador={respBen.zelador} sindico={respBen.sindico} cor="var(--lilas)"/>
          <CardStat titulo="Pendentes / Realizadas (período)" valor={`${cardsBen.pendentes} / ${cardsBen.realizados}`}/>
          <CardStat titulo="Valor" valor={fmtMoeda(cardsBen.valor)} cor="var(--lilas)"/>
          <CardStat titulo="No prazo" valor={cardsBen.noPrazo} cor="var(--verde)"/>
          <CardStat titulo="Atrasadas" valor={cardsBen.atrasados} cor="var(--vermelho)"/>
        </div>
      </Secao>

      <Secao titulo="Solicitações de Morador" cor="var(--verde)" bg="var(--verde-bg)">
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:10}}>
          <CardStat titulo="Recebidas"   valor={solRecebidas}/>
          <CardStat titulo="Respondidas" valor={solRespondidas} cor="var(--azul)"/>
          <CardStat titulo="Pendentes"   valor={solPendentes} cor="var(--vermelho)"/>
        </div>
      </Secao>

      <Secao titulo="Orçamentos" cor="var(--amarelo)" bg="var(--amarelo-bg)">
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:10}}>
          <CardStat titulo="Total cadastrados"   valor={orcamentos.length}/>
          <CardStat titulo="Em cotação"          valor={orcsEmCotacao.length}    cor="var(--amarelo)"/>
          <CardStat titulo="Negócios fechados"   valor={orcsFechados.length}     cor="var(--verde)"/>
          <CardStat titulo="Sem orçamento (emerg.)" valor={orcsSemOrcamento.length} cor="var(--vermelho)"/>
          <CardStat titulo="Valor total fechado" valor={fmtMoeda(valorOrcsFechados)} cor="var(--azul)"/>
        </div>
      </Secao>

      {/* Gráficos */}
      <div className="card card-azul" style={{marginBottom:14, padding:16}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
          <div style={{fontWeight:500}}>Quantidade por mês — combinado</div>
          <button className="btn btn-sm" onClick={exportarMensal}><i className="fa-solid fa-file-excel" style={{marginRight:6}}></i>Mensal</button>
        </div>
        <div style={{height:300}}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dadosMes}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0DDD6"/>
              <XAxis dataKey="mes" fontSize={11}/>
              <YAxis fontSize={11}/>
              <Tooltip/>
              <Legend wrapperStyle={{fontSize:11}}/>
              <Bar dataKey="qtdTotal" name="Total (somatória)" fill="#888780" barSize={28}/>
              <Line type="monotone" dataKey="qtdAt"  name="Atividades"   stroke={TIPOS.atividade.cor}   strokeWidth={2} dot={{r:3}}/>
              <Line type="monotone" dataKey="qtdCor" name="Corretivas"   stroke={TIPOS.corretiva.cor}   strokeWidth={2} dot={{r:3}}/>
              <Line type="monotone" dataKey="qtdBen" name="Benfeitorias" stroke={TIPOS.benfeitoria.cor} strokeWidth={2} dot={{r:3}}/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card card-verde" style={{marginBottom:14, padding:16}}>
        <div style={{fontWeight:500, marginBottom:8}}>Valores fechados (orçamentos selecionados) por mês</div>
        <div style={{height:300}}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dadosMes}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0DDD6"/>
              <XAxis dataKey="mes" fontSize={11}/>
              <YAxis fontSize={11} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`}/>
              <Tooltip formatter={v => fmtMoeda(v)}/>
              <Legend wrapperStyle={{fontSize:11}}/>
              <Bar dataKey="valTotal" name="Total (somatória)" fill="#3B6D11" barSize={28}/>
              <Line type="monotone" dataKey="valAt"  name="Atividades"   stroke={TIPOS.atividade.cor}   strokeWidth={2} dot={{r:3}}/>
              <Line type="monotone" dataKey="valCor" name="Corretivas"   stroke={TIPOS.corretiva.cor}   strokeWidth={2} dot={{r:3}}/>
              <Line type="monotone" dataKey="valBen" name="Benfeitorias" stroke={TIPOS.benfeitoria.cor} strokeWidth={2} dot={{r:3}}/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card card-lilas" style={{padding:16}}>
        <div style={{fontWeight:500, marginBottom:8}}>Distribuição por tipo de atividade</div>
        <div style={{height:300}}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={dadosPizza} dataKey="value" nameKey="name" outerRadius={100} label={({name,value}) => `${name}: ${value}`}>
                {dadosPizza.map((entry, i) => <Cell key={i} fill={entry.cor}/>)}
              </Pie>
              <Tooltip/>
              <Legend wrapperStyle={{fontSize:11}}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

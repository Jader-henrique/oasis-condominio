import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, BarChart
} from 'recharts'

const COR_AT  = '#0C447C'
const COR_COR = '#A32D2D'
const COR_BEN = '#3C3489'
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const DIAS_FREQ = {
  'Diário':1,'Semanal':7,'Quinzenal':15,'Mensal':30,
  'Bimestral':60,'Trimestral':90,'Semestral':180,'Anual':365,
  'A Cada 2 Anos':730,'A Cada 3 Anos':1095,'A Cada 5 Anos':1825,
}

function fmtMoeda(v) {
  if (v == null || v === '') return 'R$ 0,00'
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',','.'))
  return (isNaN(n) ? 0 : n).toLocaleString('pt-BR', { style:'currency', currency:'BRL' })
}
function dateParaMes(d) { return d ? String(d).slice(0,7) : '' }
function gerarMeses(de, ate) {
  if (!de || !ate) return []
  const res = []
  let [y,m] = de.split('-').map(Number)
  const [ey,em] = ate.split('-').map(Number)
  while (y < ey || (y===ey && m<=em)) {
    res.push(`${y}-${String(m).padStart(2,'0')}`)
    m++; if (m>12){m=1;y++}
  }
  return res
}
function addDias(d, n) { const r = new Date(d); r.setDate(r.getDate()+n); return r }

// Replica a lógica de gerarOcorrencias usada em OrcamentoCondominio.jsx
function gerarOcorrencias(dataStr, frequencia, pontual, mesIni, mesFim) {
  if (!dataStr) return []
  const periodoIni = new Date(mesIni + '-01')
  const periodoFim = new Date(mesFim + '-01'); periodoFim.setMonth(periodoFim.getMonth() + 1)
  const dataFull = String(dataStr).length === 7 ? dataStr + '-01' : dataStr
  let cur = new Date(dataFull)
  if (pontual || !frequencia || !DIAS_FREQ[frequencia]) {
    return (cur >= periodoIni && cur < periodoFim) ? [cur] : []
  }
  const dias = DIAS_FREQ[frequencia]
  while (cur < periodoIni) cur = addDias(cur, dias)
  const res = []
  while (cur < periodoFim) { res.push(new Date(cur)); cur = addDias(cur, dias) }
  return res
}

// =============================================================
// Cards reutilizáveis
// =============================================================
function CardNecessidadeCaixa({ saldoIni, receitasPrev, receitasReal, gastosPrev, gastosReal }) {
  const resultPrev = saldoIni + receitasPrev - gastosPrev
  const resultReal = saldoIni + receitasReal - gastosReal
  return (
    <div className="card" style={{padding:14}}>
      <div style={{borderTop:'3px solid var(--azul)', margin:'-14px -14px 10px', padding:'8px 14px', fontSize:11, fontWeight:600, color:'var(--azul)', textTransform:'uppercase', letterSpacing:'0.05em', background:'#fff'}}>
        Necessidade de Caixa
      </div>
      <table style={{width:'100%', fontSize:12}}>
        <thead>
          <tr><th></th><th style={{textAlign:'right',color:'var(--texto-sec)'}}>Previsto</th><th style={{textAlign:'right',color:'var(--texto-sec)'}}>Realizado</th></tr>
        </thead>
        <tbody>
          <tr><td>Saldo inicial</td><td style={{textAlign:'right'}}>{fmtMoeda(saldoIni)}</td><td style={{textAlign:'right'}}>{fmtMoeda(saldoIni)}</td></tr>
          <tr><td>Receitas</td><td style={{textAlign:'right',color:'var(--verde)'}}>{fmtMoeda(receitasPrev)}</td><td style={{textAlign:'right',color:'var(--verde)'}}>{fmtMoeda(receitasReal)}</td></tr>
          <tr><td>Gastos</td><td style={{textAlign:'right',color:'var(--vermelho)'}}>−{fmtMoeda(gastosPrev)}</td><td style={{textAlign:'right',color:'var(--vermelho)'}}>−{fmtMoeda(gastosReal)}</td></tr>
          <tr style={{borderTop:'2px solid var(--amarelo)'}}>
            <td style={{paddingTop:6,fontWeight:500}}>Resultado</td>
            <td style={{paddingTop:6,textAlign:'right',fontWeight:600,color: resultPrev>=0?'var(--verde)':'var(--vermelho)'}}>{fmtMoeda(resultPrev)}</td>
            <td style={{paddingTop:6,textAlign:'right',fontWeight:600,color: resultReal>=0?'var(--verde)':'var(--vermelho)'}}>{fmtMoeda(resultReal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function CardOrcamento({ titulo, receitas, gastosPorGrupo, corBorda='var(--azul)' }) {
  const totReceitas = receitas.reduce((s,r) => s + (parseFloat(r.valor)||0), 0)
  const totGastos   = (gastosPorGrupo['Atividades do Dia a Dia']||0) + (gastosPorGrupo['Intervenções Corretivas']||0) + (gastosPorGrupo['Benfeitorias']||0)
  const resultado   = totReceitas - totGastos
  return (
    <div className="card" style={{padding:14}}>
      <div style={{borderTop:'3px solid '+corBorda, margin:'-14px -14px 10px', padding:'8px 14px', fontSize:11, fontWeight:600, color:corBorda, textTransform:'uppercase', letterSpacing:'0.05em', background:'#fff'}}>
        {titulo}
      </div>
      <table style={{width:'100%', fontSize:12}}>
        <thead>
          <tr style={{background:'var(--azul)',color:'#fff'}}><th colSpan={2} style={{padding:'4px 6px',textAlign:'left',borderRadius:'4px 4px 0 0'}}>Receitas</th></tr>
        </thead>
        <tbody>
          <tr><td style={{paddingTop:4}}>Totais</td><td style={{textAlign:'right',fontWeight:600}}>{fmtMoeda(totReceitas)}</td></tr>
          {receitas.map((r,i) => (
            <tr key={i}><td style={{paddingLeft:14,color:'var(--texto-sec)'}}>{r.descricao}</td><td style={{textAlign:'right'}}>{fmtMoeda(r.valor)}</td></tr>
          ))}
        </tbody>
        <thead>
          <tr style={{background:'var(--vermelho)',color:'#fff'}}><th colSpan={2} style={{padding:'4px 6px',textAlign:'left',marginTop:6}}>Gastos</th></tr>
        </thead>
        <tbody>
          <tr><td style={{paddingTop:4}}>Totais</td><td style={{textAlign:'right',fontWeight:600,color:'var(--vermelho)'}}>−{fmtMoeda(totGastos)}</td></tr>
          <tr><td style={{paddingLeft:14,color:'var(--texto-sec)'}}>Atividades do Dia a Dia</td><td style={{textAlign:'right'}}>−{fmtMoeda(gastosPorGrupo['Atividades do Dia a Dia']||0)}</td></tr>
          <tr><td style={{paddingLeft:14,color:'var(--texto-sec)'}}>Intervenções Corretivas</td><td style={{textAlign:'right'}}>−{fmtMoeda(gastosPorGrupo['Intervenções Corretivas']||0)}</td></tr>
          <tr><td style={{paddingLeft:14,color:'var(--texto-sec)'}}>Benfeitorias</td><td style={{textAlign:'right'}}>−{fmtMoeda(gastosPorGrupo['Benfeitorias']||0)}</td></tr>
        </tbody>
        <tbody>
          <tr style={{borderTop:'2px solid var(--amarelo)'}}>
            <td style={{paddingTop:6,fontWeight:500}}>Resultado</td>
            <td style={{paddingTop:6,textAlign:'right',fontWeight:700,fontSize:14,color: resultado>=0?'var(--verde)':'var(--vermelho)'}}>
              {resultado<0?'−':''}{fmtMoeda(Math.abs(resultado))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function CardCadastradas({ titulo, total, zelador, sindico, statusLabels }) {
  return (
    <div className="card" style={{padding:14}}>
      <div style={{borderTop:'3px solid var(--azul)', margin:'-14px -14px 10px', padding:'8px 14px', fontSize:11, fontWeight:600, color:'var(--azul)', textTransform:'uppercase', letterSpacing:'0.05em', background:'#fff'}}>
        {titulo}
      </div>
      <div style={{display:'flex', alignItems:'flex-start', gap:14}}>
        <div style={{minWidth:80}}>
          <div style={{fontSize:36, fontWeight:700, color:'var(--azul)', lineHeight:1}}>{total}</div>
          <div style={{fontSize:11, color:'var(--texto-sec)', marginTop:2}}>Total</div>
        </div>
        <div style={{flex:1, fontSize:12}}>
          <table style={{width:'100%'}}>
            <thead>
              <tr style={{borderBottom:'1px solid var(--borda)'}}>
                <th style={{textAlign:'left',padding:'2px 4px',fontWeight:500,color:'var(--texto-sec)',fontSize:10}}>Resp.</th>
                <th style={{textAlign:'right',padding:'2px 4px',fontWeight:500,color:'var(--vermelho)',fontSize:10}}>{statusLabels[0]}</th>
                <th style={{textAlign:'right',padding:'2px 4px',fontWeight:500,color:'var(--verde)',fontSize:10}}>{statusLabels[1]}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{padding:'4px',color:'var(--azul)',fontWeight:500}}>Zelador</td>
                <td style={{textAlign:'right',padding:'4px',fontWeight:500}}>{zelador.s1}</td>
                <td style={{textAlign:'right',padding:'4px',fontWeight:500}}>{zelador.s2}</td>
              </tr>
              <tr>
                <td style={{padding:'4px',color:'var(--amarelo)',fontWeight:500}}>Síndico</td>
                <td style={{textAlign:'right',padding:'4px',fontWeight:500}}>{sindico.s1}</td>
                <td style={{textAlign:'right',padding:'4px',fontWeight:500}}>{sindico.s2}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function CardCronograma({ titulo, stats }) {
  return (
    <div className="card" style={{padding:14}}>
      <div style={{borderTop:'3px solid var(--azul)', margin:'-14px -14px 10px', padding:'8px 14px', fontSize:11, fontWeight:600, color:'var(--azul)', textTransform:'uppercase', letterSpacing:'0.05em', background:'#fff'}}>
        {titulo}
      </div>
      <div style={{display:'flex', alignItems:'flex-start', gap:14}}>
        <div style={{minWidth:80}}>
          <div style={{fontSize:36, fontWeight:700, color:'var(--azul)', lineHeight:1}}>{stats.total}</div>
          <div style={{fontSize:11, color:'var(--texto-sec)', marginTop:2}}>Total</div>
        </div>
        <div style={{flex:1, fontSize:12}}>
          <table style={{width:'100%'}}>
            <thead>
              <tr style={{borderBottom:'1px solid var(--borda)'}}>
                <th style={{textAlign:'left',padding:'2px 4px',fontWeight:500,color:'var(--texto-sec)',fontSize:10}}>Resp.</th>
                <th style={{textAlign:'right',padding:'2px 4px',fontWeight:500,color:'var(--azul)',fontSize:10}}>No Prazo</th>
                <th style={{textAlign:'right',padding:'2px 4px',fontWeight:500,color:'var(--vermelho)',fontSize:10}}>Atrasadas</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{padding:'4px',color:'var(--azul)',fontWeight:500}}>Zelador</td>
                <td style={{textAlign:'right',padding:'4px',fontWeight:500}}>{stats.zelador.crono_s1}</td>
                <td style={{textAlign:'right',padding:'4px',fontWeight:500}}>{stats.zelador.crono_s2}</td>
              </tr>
              <tr>
                <td style={{padding:'4px',color:'var(--amarelo)',fontWeight:500}}>Síndico</td>
                <td style={{textAlign:'right',padding:'4px',fontWeight:500}}>{stats.sindico.crono_s1}</td>
                <td style={{textAlign:'right',padding:'4px',fontWeight:500}}>{stats.sindico.crono_s2}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function SecaoCards({ titulo, cor, bg, stats, totalLabel }) {
  const dadosBar = [
    { name:'No Prazo',  value: stats.zelador.crono_s1 + stats.sindico.crono_s1 },
    { name:'Atrasadas', value: stats.zelador.crono_s2 + stats.sindico.crono_s2 },
  ]
  return (
    <div style={{background:bg, borderLeft:`3px solid ${cor}`, borderRadius:10, padding:'12px 14px', marginBottom:14}}>
      <div style={{fontSize:13, fontWeight:600, color:cor, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10}}>
        {titulo}
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 280px', gap:10, alignItems:'stretch'}}>
        <CardCadastradas titulo={totalLabel} total={stats.total} zelador={stats.zelador} sindico={stats.sindico} statusLabels={['Pendentes','Realizadas']}/>
        <CardCronograma titulo="Cronograma" stats={stats}/>
        <div className="card" style={{padding:14}}>
          <div style={{fontSize:11, fontWeight:600, color:cor, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6, textAlign:'center'}}>{titulo}</div>
          <div style={{height:140}}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosBar}>
                <XAxis dataKey="name" fontSize={11}/>
                <YAxis fontSize={10} allowDecimals={false}/>
                <Tooltip/>
                <Bar dataKey="value" name="Quantidade">
                  {dadosBar.map((e,i) => <Cell key={i} fill={i===0?'#0C447C':'#A32D2D'}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================
// Componente principal
// =============================================================
export default function Dashboard({ perfil }) {
  const [orcamentoCab, setOrcamentoCab] = useState(null)
  const [itens, setItens] = useState([])  // orcamento_cond_itens com conta join
  const [valoresMensais, setValoresMensais] = useState([])  // orcamento_cond_valores
  const [atividades, setAtividades] = useState([])
  const [corretivas, setCorretivas] = useState([])
  const [benfeitorias, setBenfeitorias] = useState([])
  const [orcamentos, setOrcamentos] = useState([])
  const [solicitacoes, setSolicitacoes] = useState([])
  const [periodoIni, setPeriodoIni] = useState(`${new Date().getFullYear()}-01-01`)
  const [periodoFim, setPeriodoFim] = useState(`${new Date().getFullYear()}-12-31`)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => { carregar() }, [periodoIni, periodoFim])

  async function carregar() {
    setCarregando(true)
    // Buscar tudo em paralelo
    const [a, c, b, o, s, orcResp] = await Promise.all([
      supabase.from('calendario').select('*').is('excluido_em', null),
      supabase.from('corretivas').select('*').is('excluido_em', null),
      supabase.from('benfeitorias').select('*').is('excluido_em', null),
      supabase.from('orcamentos').select('*').is('excluido_em', null),
      supabase.from('solicitacoes').select('*'),
      supabase.from('orcamento_cond').select('*').is('excluido_em', null).order('vigencia_de'),
    ])
    setAtividades(a.data||[]); setCorretivas(c.data||[]); setBenfeitorias(b.data||[])
    setOrcamentos(o.data||[]); setSolicitacoes(s.data||[])

    // Achar orçamento que cobre o período do filtro (ou o mais próximo)
    const orcs = orcResp.data || []
    const periodoIniDate = new Date(periodoIni+'T00:00:00')
    const periodoFimDate = new Date(periodoFim+'T23:59:59')
    let orcAtivo = orcs.find(oo => {
      const vigDe  = new Date(String(oo.vigencia_de).slice(0,10)+'T00:00:00')
      const vigAte = new Date(String(oo.vigencia_ate).slice(0,10)+'T23:59:59')
      return vigDe <= periodoFimDate && vigAte >= periodoIniDate
    })
    if (!orcAtivo && orcs.length) orcAtivo = orcs[orcs.length-1]
    setOrcamentoCab(orcAtivo || null)

    if (orcAtivo) {
      const { data: itensData } = await supabase.from('orcamento_cond_itens')
        .select('*, conta:conta_id(id,descricao,tipo_conta,grupo_orcamentario,codigo_contabil,origem_orcamento)')
        .eq('orcamento_id', orcAtivo.id).is('excluido_em', null)
      const itemList = itensData || []
      setItens(itemList)
      const itemIds = itemList.map(i => i.id)
      if (itemIds.length) {
        const { data: vData } = await supabase.from('orcamento_cond_valores')
          .select('*').in('item_id', itemIds)
        setValoresMensais(vData || [])
      } else {
        setValoresMensais([])
      }
    } else {
      setItens([]); setValoresMensais([])
    }
    setCarregando(false)
  }

  // Lista de meses dentro do filtro
  const mesesNoFiltro = gerarMeses(dateParaMes(periodoIni), dateParaMes(periodoFim))

  // ================ Cálculos do orçamento ================
  // Para cada item (conta vinculada ao orçamento ativo):
  //   - Se origem = 'Orçamento do Condomínio' → soma orcamento_cond_valores cujo competencia esteja em mesesNoFiltro
  //   - Se origem = 'Orçamento de Fornecedores' → calcula via gerarOcorrencias dos items das 3 tabelas
  function valorPrevistoPorItem(item) {
    const conta = item.conta
    if (!conta) return 0
    if (conta.origem_orcamento === 'Orçamento de Fornecedores') {
      // Calcula a partir dos items das 3 tabelas com aquele conta_id
      const proc = (rows, dataField, freqField, pontualField) => {
        let total = 0
        for (const row of (rows||[])) {
          if (row.conta_id !== conta.id) continue
          const v = parseFloat(row.valor_previsto) || 0
          if (!v) continue
          const ocorr = gerarOcorrencias(row[dataField], row[freqField], pontualField ? row[pontualField] : null,
                                         dateParaMes(periodoIni), dateParaMes(periodoFim))
          total += v * ocorr.length
        }
        return total
      }
      return proc(atividades,   'proxima_data',         'frequencia', 'pontual')
           + proc(corretivas,   'data_inicio_prevista', 'recorrencia', null)
           + proc(benfeitorias, 'previsto',             'recorrencia', null)
    }
    // Origem 'Orçamento do Condomínio' - somar valores mensais nos meses do filtro
    const valoresDoItem = valoresMensais.filter(v => v.item_id === item.id)
    let total = 0
    for (const v of valoresDoItem) {
      const mes = dateParaMes(v.competencia)
      if (mesesNoFiltro.includes(mes)) total += parseFloat(v.valor_previsto) || 0
    }
    return total
  }

  // Valor realizado: somar valor_realizado dos items das 3 fontes cujo realizado caiu no período
  function valorRealizadoGastoPorGrupo(grupo) {
    let total = 0
    const dentroPeriodo = (d) => {
      if (!d) return false
      const s = String(d).slice(0,10)
      return s >= periodoIni && s <= periodoFim
    }
    if (grupo === 'Atividades do Dia a Dia') {
      atividades.forEach(i => {
        if (dentroPeriodo(i.realizado_em?.slice(0,10) || i.proxima_data)) {
          total += parseFloat(i.valor_realizado || i.valor) || 0
        }
      })
    } else if (grupo === 'Intervenções Corretivas') {
      corretivas.forEach(i => {
        if (dentroPeriodo(i.data_fim || i.data_inicio_real || i.data_inicio_prevista)) {
          total += parseFloat(i.valor_realizado || i.valor) || 0
        }
      })
    } else if (grupo === 'Benfeitorias') {
      benfeitorias.forEach(i => {
        if (dentroPeriodo(i.realizado || i.data_inicio_real || i.previsto)) {
          total += parseFloat(i.valor_realizado || i.valor) || 0
        }
      })
    }
    return total
  }

  const itensReceita = itens.filter(it => it.conta?.tipo_conta === 'Receita')
  const itensGasto   = itens.filter(it => it.conta?.tipo_conta !== 'Receita')

  // Receitas previstas: por conta (lista) + total
  const receitasPrev = itensReceita.map(it => ({
    descricao: it.conta?.descricao || '—',
    valor: Math.abs(valorPrevistoPorItem(it))
  })).filter(r => r.valor > 0)
  const totReceitasPrev = receitasPrev.reduce((s,r) => s + r.valor, 0)

  // Gastos previstos por grupo
  const gastosPrevPorGrupo = { 'Atividades do Dia a Dia':0, 'Intervenções Corretivas':0, 'Benfeitorias':0 }
  itensGasto.forEach(it => {
    const g = it.conta?.grupo_orcamentario
    if (g in gastosPrevPorGrupo) gastosPrevPorGrupo[g] += Math.abs(valorPrevistoPorItem(it))
  })
  const totGastosPrev = Object.values(gastosPrevPorGrupo).reduce((s,v)=>s+v,0)

  // Realizado: por enquanto sem fonte para receitas — usa o mesmo do previsto se existir registro de pagamento
  // (no schema atual orcamento_cond_valores não tem valor_realizado). Receitas realizadas = 0 até definirmos a fonte.
  const receitasReal = itensReceita.map(it => ({ descricao: it.conta?.descricao || '—', valor: 0 }))
  const totReceitasReal = 0

  const gastosRealPorGrupo = {
    'Atividades do Dia a Dia': valorRealizadoGastoPorGrupo('Atividades do Dia a Dia'),
    'Intervenções Corretivas': valorRealizadoGastoPorGrupo('Intervenções Corretivas'),
    'Benfeitorias':            valorRealizadoGastoPorGrupo('Benfeitorias'),
  }
  const totGastosReal = Object.values(gastosRealPorGrupo).reduce((s,v)=>s+v,0)

  const saldoIni = parseFloat(orcamentoCab?.saldo_inicial) || 0

  // Pizza dos gastos previstos
  const dadosPizzaGastos = [
    { name:'Atividades do Dia a Dia', value:gastosPrevPorGrupo['Atividades do Dia a Dia'], cor:COR_AT },
    { name:'Intervenções Corretivas', value:gastosPrevPorGrupo['Intervenções Corretivas'], cor:COR_COR },
    { name:'Benfeitorias',            value:gastosPrevPorGrupo['Benfeitorias'],            cor:COR_BEN },
  ].filter(d => d.value > 0)

  // ================ Filtro de período aos items ================
  function dentroPeriodo(d) {
    if (!d) return false
    const s = String(d).slice(0,10)
    return s >= periodoIni && s <= periodoFim
  }
  const atividadesPer  = atividades.filter(i  => dentroPeriodo(i.proxima_data))
  const corretivasPer  = corretivas.filter(i  => dentroPeriodo(i.data_inicio_prevista || i.data_inicio_real))
  const benfeitoriasPer= benfeitorias.filter(i => dentroPeriodo(i.previsto || i.data_inicio_real))
  atividadesPer.forEach(i => i._dataPrev = i.proxima_data)
  corretivasPer.forEach(i => i._dataPrev = i.data_inicio_prevista || i.data_inicio_real)
  benfeitoriasPer.forEach(i => i._dataPrev = i.previsto || i.data_inicio_real)

  function calcSecao(lista, statusFn) {
    const total = lista.length
    const isZelador = i => i.responsavel_tipo === 'Zeladoria'
    const zList = lista.filter(isZelador)
    const sList = lista.filter(i => !isZelador(i))
    const hojeStr = new Date().toISOString().slice(0,10)
    const noPrazo = i => !statusFn(i) && i._dataPrev && i._dataPrev >= hojeStr
    const atrasada= i => !statusFn(i) && i._dataPrev && i._dataPrev <  hojeStr
    return {
      total,
      zelador: { total:zList.length, s1:zList.filter(i=>!statusFn(i)).length, s2:zList.filter(statusFn).length, crono_s1:zList.filter(noPrazo).length, crono_s2:zList.filter(atrasada).length },
      sindico: { total:sList.length, s1:sList.filter(i=>!statusFn(i)).length, s2:sList.filter(statusFn).length, crono_s1:sList.filter(noPrazo).length, crono_s2:sList.filter(atrasada).length }
    }
  }

  const sAt  = calcSecao(atividadesPer,   i => i.status==='realizado')
  const sCor = calcSecao(corretivasPer,   i => i.status==='realizado')
  const sBen = calcSecao(benfeitoriasPer, i => !!i.realizado)

  // Solicitações
  const solRecebidas   = solicitacoes.length
  const solRespondidas = solicitacoes.filter(s => s.status==='respondida' || s.status==='encerrada').length
  const solPendentes   = solicitacoes.filter(s => s.status==='aberta').length

  // ================ Gráfico mensal ================
  const dadosMes = MESES.map((nome, idx) => {
    const ano = new Date(periodoIni).getFullYear()
    const filtroMes = (d) => {
      if (!d) return false
      const dt = new Date(d)
      return dt.getFullYear() === ano && dt.getMonth() === idx
    }
    const realAt  = atividades.filter(i  => filtroMes(i.realizado_em?.slice(0,10) || i.proxima_data)).reduce((s,i)=>s+(parseFloat(i.valor_realizado||i.valor)||0),0)
    const realCor = corretivas.filter(i  => filtroMes(i.data_fim || i.data_inicio_real)).reduce((s,i)=>s+(parseFloat(i.valor_realizado||i.valor)||0),0)
    const realBen = benfeitorias.filter(i=> filtroMes(i.realizado || i.data_inicio_real)).reduce((s,i)=>s+(parseFloat(i.valor_realizado||i.valor)||0),0)
    return { mes:nome, previsto: totGastosPrev/12, realizado: realAt+realCor+realBen }
  })

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,flexWrap:'wrap',marginBottom:8}}>
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">Visão geral consolidada — atividades, intervenções, benfeitorias e solicitações</div>
        </div>
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
        {orcamentoCab && (
          <div style={{fontSize:12, color:'var(--texto-sec)', alignSelf:'center'}}>
            Orçamento ativo: <b>{orcamentoCab.descricao}</b> ({String(orcamentoCab.vigencia_de).slice(0,7)} → {String(orcamentoCab.vigencia_ate).slice(0,7)})
          </div>
        )}
      </div>

      {/* ============ ORÇAMENTO DO CONDOMÍNIO ============ */}
      <div style={{background:'#F4F6FA', borderLeft:'3px solid var(--azul)', borderRadius:10, padding:'14px', marginBottom:16}}>
        <div style={{fontSize:13, fontWeight:600, color:'var(--azul)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10}}>
          Orçamento do Condomínio
        </div>
        {!orcamentoCab && !carregando && (
          <div style={{padding:14, color:'var(--texto-ter)', textAlign:'center', fontSize:13}}>
            Nenhum orçamento ativo encontrado para o período selecionado. Cadastre um em <b>Orçamento do Condomínio</b> ou ajuste o filtro.
          </div>
        )}
        {orcamentoCab && (
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr)) 280px', gap:10}}>
            <CardNecessidadeCaixa
              saldoIni={saldoIni}
              receitasPrev={totReceitasPrev}
              receitasReal={totReceitasReal}
              gastosPrev={totGastosPrev}
              gastosReal={totGastosReal}
            />
            <CardOrcamento titulo="Previsto" receitas={receitasPrev} gastosPorGrupo={gastosPrevPorGrupo} corBorda="var(--azul)"/>
            <CardOrcamento titulo="Realizado" receitas={receitasReal} gastosPorGrupo={gastosRealPorGrupo} corBorda="var(--azul)"/>
            <div className="card" style={{padding:14, display:'flex', flexDirection:'column'}}>
              <div style={{fontSize:11, fontWeight:600, color:'var(--azul)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6, textAlign:'center'}}>
                Gastos Previstos (R$)
              </div>
              <div style={{flex:1, minHeight:200}}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dadosPizzaGastos} dataKey="value" nameKey="name" outerRadius={60}
                      label={({value}) => fmtMoeda(value)}>
                      {dadosPizzaGastos.map((e,i) => <Cell key={i} fill={e.cor}/>)}
                    </Pie>
                    <Tooltip formatter={v => fmtMoeda(v)}/>
                    <Legend wrapperStyle={{fontSize:9}} iconSize={8}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>

      <SecaoCards titulo="Atividades do Dia a Dia"  cor="var(--azul)"     bg="var(--azul-bg)"     stats={sAt}  totalLabel="Atividades cadastradas"/>
      <SecaoCards titulo="Intervenções Corretivas"  cor="var(--vermelho)" bg="var(--vermelho-bg)" stats={sCor} totalLabel="Corretivas Cadastradas"/>
      <SecaoCards titulo="Benfeitorias"             cor="var(--lilas)"    bg="var(--lilas-bg)"    stats={sBen} totalLabel="Benfeitorias Cadastradas"/>

      <div style={{background:'var(--verde-bg)', borderLeft:'3px solid var(--verde)', borderRadius:10, padding:'12px 14px', marginBottom:14}}>
        <div style={{fontSize:13, fontWeight:600, color:'var(--verde)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10}}>Solicitações de Morador</div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:10}}>
          <div className="card" style={{padding:14}}><div style={{fontSize:11, color:'var(--texto-ter)', textTransform:'uppercase'}}>Recebidas</div><div style={{fontSize:22, fontWeight:500, marginTop:4}}>{solRecebidas}</div></div>
          <div className="card" style={{padding:14}}><div style={{fontSize:11, color:'var(--texto-ter)', textTransform:'uppercase'}}>Respondidas</div><div style={{fontSize:22, fontWeight:500, marginTop:4, color:'var(--azul)'}}>{solRespondidas}</div></div>
          <div className="card" style={{padding:14}}><div style={{fontSize:11, color:'var(--texto-ter)', textTransform:'uppercase'}}>Pendentes</div><div style={{fontSize:22, fontWeight:500, marginTop:4, color:'var(--vermelho)'}}>{solPendentes}</div></div>
        </div>
      </div>

      <div style={{background:'var(--amarelo-bg)', borderLeft:'3px solid var(--amarelo)', borderRadius:10, padding:'12px 14px', marginBottom:14}}>
        <div style={{fontSize:13, fontWeight:600, color:'var(--amarelo)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10}}>Orçamentos de Fornecedores</div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:10}}>
          <div className="card" style={{padding:14}}><div style={{fontSize:11, color:'var(--texto-ter)', textTransform:'uppercase'}}>Total cadastrados</div><div style={{fontSize:22, fontWeight:500, marginTop:4}}>{orcamentos.length}</div></div>
          <div className="card" style={{padding:14}}><div style={{fontSize:11, color:'var(--texto-ter)', textTransform:'uppercase'}}>Em cotação</div><div style={{fontSize:22, fontWeight:500, marginTop:4, color:'var(--amarelo)'}}>{orcamentos.filter(o => !o.selecionado && !o.sem_orcamento && !o.dispensa).length}</div></div>
          <div className="card" style={{padding:14}}><div style={{fontSize:11, color:'var(--texto-ter)', textTransform:'uppercase'}}>Negócios fechados</div><div style={{fontSize:22, fontWeight:500, marginTop:4, color:'var(--verde)'}}>{orcamentos.filter(o => o.selecionado && !o.sem_orcamento).length}</div></div>
          <div className="card" style={{padding:14}}><div style={{fontSize:11, color:'var(--texto-ter)', textTransform:'uppercase'}}>Sem orçamento (emerg.)</div><div style={{fontSize:22, fontWeight:500, marginTop:4, color:'var(--vermelho)'}}>{orcamentos.filter(o => o.sem_orcamento).length}</div></div>
          <div className="card" style={{padding:14}}><div style={{fontSize:11, color:'var(--texto-ter)', textTransform:'uppercase'}}>Valor total fechado</div><div style={{fontSize:18, fontWeight:500, marginTop:4, color:'var(--azul)'}}>{fmtMoeda(orcamentos.filter(o => o.selecionado).reduce((s,o) => s + (parseFloat(o.valor)||0), 0))}</div></div>
        </div>
      </div>

      <div className="card card-verde" style={{padding:16}}>
        <div style={{fontWeight:500, marginBottom:8}}>Gastos por mês — Previsto x Realizado</div>
        <div style={{height:300}}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dadosMes}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0DDD6"/>
              <XAxis dataKey="mes" fontSize={11}/>
              <YAxis fontSize={11} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`}/>
              <Tooltip formatter={v => fmtMoeda(v)}/>
              <Legend wrapperStyle={{fontSize:11}}/>
              <Bar dataKey="realizado" name="Realizado (mensal)" fill="#3B6D11" barSize={28}/>
              <Line type="monotone" dataKey="previsto" name="Previsto (média mensal)" stroke="#0C447C" strokeWidth={2} dot={{r:3}}/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

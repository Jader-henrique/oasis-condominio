import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { exportarParaExcel } from '../utils/excel'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, BarChart
} from 'recharts'

const COR_AT  = '#0C447C'
const COR_COR = '#A32D2D'
const COR_BEN = '#3C3489'
const COR_RECEITA = '#3B6D11'
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function fmtMoeda(v) {
  if (v == null || v === '') return 'R$ 0,00'
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',','.'))
  return (isNaN(n) ? 0 : n).toLocaleString('pt-BR', { style:'currency', currency:'BRL' })
}
function digitsToNum(str) {
  const digits = String(str ?? '').replace(/\D/g, '')
  if (!digits) return null
  return parseInt(digits, 10) / 100
}
function moedaInputValue(v) {
  if (v == null || v === '') return ''
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',','.'))
  if (isNaN(n)) return ''
  return n.toLocaleString('pt-BR', { style:'currency', currency:'BRL', minimumFractionDigits:2 })
}

// =============================================================
// Cards do Orçamento do Condomínio
// =============================================================
function CardNecessidadeCaixa({ saldoIniPrev, saldoIniReal, receitasPrev, receitasReal, gastosPrev, gastosReal }) {
  const resultPrev = saldoIniPrev + receitasPrev - gastosPrev
  const resultReal = saldoIniReal + receitasReal - gastosReal
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
          <tr><td>Saldo inicial</td><td style={{textAlign:'right'}}>{fmtMoeda(saldoIniPrev)}</td><td style={{textAlign:'right'}}>{fmtMoeda(saldoIniReal)}</td></tr>
          <tr><td>Receitas</td><td style={{textAlign:'right',color:'var(--verde)'}}>{fmtMoeda(receitasPrev)}</td><td style={{textAlign:'right',color:'var(--verde)'}}>{fmtMoeda(receitasReal)}</td></tr>
          <tr><td>Gastos</td><td style={{textAlign:'right',color:'var(--vermelho)'}}>−{fmtMoeda(gastosPrev).replace('R$','R$')}</td><td style={{textAlign:'right',color:'var(--vermelho)'}}>−{fmtMoeda(gastosReal).replace('R$','R$')}</td></tr>
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

function CardOrcamento({ titulo, receitas, gastosPorGrupo, total, isPrevisto, corBorda='var(--azul)' }) {
  // receitas: [{descricao, valor}]
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

// =============================================================
// Cards das seções (Atividades, Corretivas, Benfeitorias)
// =============================================================
function CardCadastradas({ titulo, total, zelador, sindico, statusLabels }) {
  // statusLabels: ['Pendentes','Realizadas'] ou ['No Prazo','Atrasadas']
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

// =============================================================
// Componente principal
// =============================================================
export default function Dashboard({ perfil }) {
  const [atividades, setAtividades] = useState([])
  const [corretivas, setCorretivas] = useState([])
  const [benfeitorias, setBenfeitorias] = useState([])
  const [orcamentos, setOrcamentos] = useState([])
  const [solicitacoes, setSolicitacoes] = useState([])
  const [contas, setContas] = useState([])
  const [config, setConfig] = useState({ saldo_inicial_previsto:0, saldo_inicial_realizado:0 })
  const [periodoIni, setPeriodoIni] = useState(`${new Date().getFullYear()}-01-01`)
  const [periodoFim, setPeriodoFim] = useState(`${new Date().getFullYear()}-12-31`)
  const [editandoSaldo, setEditandoSaldo] = useState(false)
  const [formSaldo, setFormSaldo] = useState({ saldo_inicial_previsto:0, saldo_inicial_realizado:0 })

  useEffect(() => { carregar() }, [])
  useEffect(() => { carregarConfig() }, [periodoIni])

  async function carregar() {
    const [a, c, b, o, s, k] = await Promise.all([
      supabase.from('calendario').select('*').is('excluido_em', null),
      supabase.from('corretivas').select('*').is('excluido_em', null),
      supabase.from('benfeitorias').select('*').is('excluido_em', null),
      supabase.from('orcamentos').select('*').is('excluido_em', null),
      supabase.from('solicitacoes').select('*'),
      supabase.from('contas').select('*').is('excluido_em', null),
    ])
    setAtividades(a.data||[]); setCorretivas(c.data||[]); setBenfeitorias(b.data||[])
    setOrcamentos(o.data||[]); setSolicitacoes(s.data||[]); setContas(k.data||[])
  }

  async function carregarConfig() {
    const ano = new Date(periodoIni).getFullYear()
    const { data } = await supabase.from('orcamento_config').select('*').eq('ano', ano).maybeSingle()
    if (data) setConfig(data)
    else {
      // criar config para o ano se não existir
      const { data: novo } = await supabase.from('orcamento_config').insert([{ ano, saldo_inicial_previsto:0, saldo_inicial_realizado:0 }]).select().single()
      if (novo) setConfig(novo)
    }
  }

  async function salvarSaldo() {
    try {
      const { error } = await supabase.from('orcamento_config').update({
        saldo_inicial_previsto: formSaldo.saldo_inicial_previsto || 0,
        saldo_inicial_realizado: formSaldo.saldo_inicial_realizado || 0
      }).eq('id', config.id)
      if (error) throw error
      await carregarConfig()
      setEditandoSaldo(false)
    } catch (e) {
      alert('Erro: ' + e.message)
    }
  }

  // Filtro por período (data principal de cada item)
  function dentroPeriodo(d) {
    if (!d) return false
    const s = String(d).slice(0,10)
    return s >= periodoIni && s <= periodoFim
  }

  // ============ Aplicar filtro de período aos items ============
  const atividadesPer  = atividades.filter(i  => dentroPeriodo(i.proxima_data))
  const corretivasPer  = corretivas.filter(i  => dentroPeriodo(i.data_inicio_prevista || i.data_inicio_real))
  const benfeitoriasPer= benfeitorias.filter(i => dentroPeriodo(i.previsto || i.data_inicio_real))

  // ============ Cálculos por seção ============
  function calcSecao(lista, statusFn) {
    const total = lista.length
    const isZelador = i => i.responsavel_tipo === 'Zeladoria'
    const zeladorList = lista.filter(isZelador)
    const sindicoList = lista.filter(i => !isZelador(i))  // tudo que não é Zeladoria conta como Síndico (inclusive Terceiro)
    const hojeStr = new Date().toISOString().slice(0,10)
    const noPrazo = i => !statusFn(i) && (i._dataPrev) && i._dataPrev >= hojeStr
    const atrasada= i => !statusFn(i) && (i._dataPrev) && i._dataPrev <  hojeStr
    return {
      total,
      zelador: {
        total: zeladorList.length,
        s1: zeladorList.filter(i => !statusFn(i)).length,  // Pendentes
        s2: zeladorList.filter(i =>  statusFn(i)).length,  // Realizadas
        crono_s1: zeladorList.filter(noPrazo).length,
        crono_s2: zeladorList.filter(atrasada).length
      },
      sindico: {
        total: sindicoList.length,
        s1: sindicoList.filter(i => !statusFn(i)).length,
        s2: sindicoList.filter(i =>  statusFn(i)).length,
        crono_s1: sindicoList.filter(noPrazo).length,
        crono_s2: sindicoList.filter(atrasada).length
      }
    }
  }

  // Anotar dataPrev em cada item para o crono
  atividadesPer.forEach(i => i._dataPrev = i.proxima_data)
  corretivasPer.forEach(i => i._dataPrev = i.data_inicio_prevista || i.data_inicio_real)
  benfeitoriasPer.forEach(i => i._dataPrev = i.previsto || i.data_inicio_real)

  const sAt  = calcSecao(atividadesPer,   i => i.status==='realizado')
  const sCor = calcSecao(corretivasPer,   i => i.status==='realizado')
  const sBen = calcSecao(benfeitoriasPer, i => !!i.realizado)

  // ============ Orçamento do Condomínio ============
  const receitasContas = contas.filter(c => c.tipo_conta === 'Receita')
  const gastosContas   = contas.filter(c => c.tipo_conta !== 'Receita')

  const receitasPrev = receitasContas.map(c => ({ descricao:c.descricao, valor:Number(c.valor_previsto)||0 }))
  const receitasReal = receitasContas.map(c => ({ descricao:c.descricao, valor:Number(c.valor_realizado)||0 }))

  const gastosGrupoPrev = {}
  const gastosGrupoReal = {}
  for (const c of gastosContas) {
    const g = c.grupo_orcamentario
    gastosGrupoPrev[g] = (gastosGrupoPrev[g]||0) + (Number(c.valor_previsto)||0)
    gastosGrupoReal[g] = (gastosGrupoReal[g]||0) + (Number(c.valor_realizado)||0)
  }

  const totReceitasPrev = receitasPrev.reduce((s,r)=>s+r.valor,0)
  const totReceitasReal = receitasReal.reduce((s,r)=>s+r.valor,0)
  const totGastosPrev   = Object.values(gastosGrupoPrev).reduce((s,v)=>s+v,0)
  const totGastosReal   = Object.values(gastosGrupoReal).reduce((s,v)=>s+v,0)

  const dadosPizzaGastos = [
    { name:'Atividades do Dia a Dia', value:gastosGrupoPrev['Atividades do Dia a Dia']||0, cor:COR_AT },
    { name:'Intervenções Corretivas', value:gastosGrupoPrev['Intervenções Corretivas']||0, cor:COR_COR },
    { name:'Benfeitorias',            value:gastosGrupoPrev['Benfeitorias']||0,            cor:COR_BEN },
  ].filter(d => d.value > 0)

  // ============ Solicitações ============
  const solRecebidas   = solicitacoes.length
  const solRespondidas = solicitacoes.filter(s => s.status==='respondida' || s.status==='encerrada').length
  const solPendentes   = solicitacoes.filter(s => s.status==='aberta').length

  // ============ Gráfico mensal: gastos previstos (linha) vs realizados (colunas) ============
  const dadosMes = MESES.map((nome, idx) => {
    const ano = new Date(periodoIni).getFullYear()
    const filtroMes = (d) => {
      if (!d) return false
      const dt = new Date(d)
      return dt.getFullYear() === ano && dt.getMonth() === idx
    }
    // Realizado: somatório de valor_realizado dos 3 tipos cujo realizado caiu nesse mês
    const realAt  = atividades.filter(i => filtroMes(i.realizado_em?.slice(0,10) || i.proxima_data)).reduce((s,i) => s + (parseFloat(i.valor_realizado || i.valor)||0), 0)
    const realCor = corretivas.filter(i => filtroMes(i.data_fim || i.data_inicio_real)).reduce((s,i) => s + (parseFloat(i.valor_realizado || i.valor)||0), 0)
    const realBen = benfeitorias.filter(i => filtroMes(i.realizado || i.data_inicio_real)).reduce((s,i) => s + (parseFloat(i.valor_realizado || i.valor)||0), 0)
    return {
      mes: nome,
      previsto: totGastosPrev / 12,  // distribuído igualmente nos 12 meses
      realizado: realAt + realCor + realBen,
    }
  })

  // =====================================================================
  // RENDER
  // =====================================================================
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
        <button className="btn btn-sm" onClick={() => { setFormSaldo({ saldo_inicial_previsto:config.saldo_inicial_previsto, saldo_inicial_realizado:config.saldo_inicial_realizado }); setEditandoSaldo(true) }}>
          <i className="fa-solid fa-pen" style={{marginRight:6}}></i>Saldo inicial do ano
        </button>
      </div>

      {/* ============ ORÇAMENTO DO CONDOMÍNIO ============ */}
      <div style={{
        background:'#F4F6FA', borderLeft:'3px solid var(--azul)', borderRadius:10,
        padding:'14px', marginBottom:16
      }}>
        <div style={{fontSize:13, fontWeight:600, color:'var(--azul)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10}}>
          Orçamento do Condomínio
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr)) 280px', gap:10}}>
          <CardNecessidadeCaixa
            saldoIniPrev={Number(config.saldo_inicial_previsto)||0}
            saldoIniReal={Number(config.saldo_inicial_realizado)||0}
            receitasPrev={totReceitasPrev}
            receitasReal={totReceitasReal}
            gastosPrev={totGastosPrev}
            gastosReal={totGastosReal}
          />
          <CardOrcamento titulo="Previsto" receitas={receitasPrev} gastosPorGrupo={gastosGrupoPrev} corBorda="var(--azul)"/>
          <CardOrcamento titulo="Realizado" receitas={receitasReal} gastosPorGrupo={gastosGrupoReal} corBorda="var(--azul)"/>
          <div className="card" style={{padding:14, display:'flex', flexDirection:'column'}}>
            <div style={{fontSize:11, fontWeight:600, color:'var(--azul)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6, textAlign:'center'}}>
              Gastos Previstos (R$)
            </div>
            <div style={{flex:1, minHeight:200}}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dadosPizzaGastos} dataKey="value" nameKey="name" outerRadius={60} label={({value}) => fmtMoeda(value)}>
                    {dadosPizzaGastos.map((e,i) => <Cell key={i} fill={e.cor}/>)}
                  </Pie>
                  <Tooltip formatter={v => fmtMoeda(v)}/>
                  <Legend wrapperStyle={{fontSize:9}} iconSize={8}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ============ ATIVIDADES ============ */}
      <SecaoCards titulo="Atividades do Dia a Dia" cor="var(--azul)" bg="var(--azul-bg)" stats={sAt} totalLabel="Atividades cadastradas"/>

      {/* ============ CORRETIVAS ============ */}
      <SecaoCards titulo="Intervenções Corretivas" cor="var(--vermelho)" bg="var(--vermelho-bg)" stats={sCor} totalLabel="Corretivas Cadastradas"/>

      {/* ============ BENFEITORIAS ============ */}
      <SecaoCards titulo="Benfeitorias" cor="var(--lilas)" bg="var(--lilas-bg)" stats={sBen} totalLabel="Benfeitorias Cadastradas"/>

      {/* ============ SOLICITAÇÕES ============ */}
      <div style={{background:'var(--verde-bg)', borderLeft:'3px solid var(--verde)', borderRadius:10, padding:'12px 14px', marginBottom:14}}>
        <div style={{fontSize:13, fontWeight:600, color:'var(--verde)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10}}>
          Solicitações de Morador
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:10}}>
          <div className="card" style={{padding:14}}>
            <div style={{fontSize:11, color:'var(--texto-ter)', textTransform:'uppercase', letterSpacing:'0.05em'}}>Recebidas</div>
            <div style={{fontSize:22, fontWeight:500, marginTop:4}}>{solRecebidas}</div>
          </div>
          <div className="card" style={{padding:14}}>
            <div style={{fontSize:11, color:'var(--texto-ter)', textTransform:'uppercase', letterSpacing:'0.05em'}}>Respondidas</div>
            <div style={{fontSize:22, fontWeight:500, marginTop:4, color:'var(--azul)'}}>{solRespondidas}</div>
          </div>
          <div className="card" style={{padding:14}}>
            <div style={{fontSize:11, color:'var(--texto-ter)', textTransform:'uppercase', letterSpacing:'0.05em'}}>Pendentes</div>
            <div style={{fontSize:22, fontWeight:500, marginTop:4, color:'var(--vermelho)'}}>{solPendentes}</div>
          </div>
        </div>
      </div>

      {/* ============ ORÇAMENTOS DE FORNECEDORES ============ */}
      <div style={{background:'var(--amarelo-bg)', borderLeft:'3px solid var(--amarelo)', borderRadius:10, padding:'12px 14px', marginBottom:14}}>
        <div style={{fontSize:13, fontWeight:600, color:'var(--amarelo)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10}}>
          Orçamentos de Fornecedores
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:10}}>
          <div className="card" style={{padding:14}}>
            <div style={{fontSize:11, color:'var(--texto-ter)', textTransform:'uppercase'}}>Total cadastrados</div>
            <div style={{fontSize:22, fontWeight:500, marginTop:4}}>{orcamentos.length}</div>
          </div>
          <div className="card" style={{padding:14}}>
            <div style={{fontSize:11, color:'var(--texto-ter)', textTransform:'uppercase'}}>Em cotação</div>
            <div style={{fontSize:22, fontWeight:500, marginTop:4, color:'var(--amarelo)'}}>{orcamentos.filter(o => !o.selecionado && !o.sem_orcamento && !o.dispensa).length}</div>
          </div>
          <div className="card" style={{padding:14}}>
            <div style={{fontSize:11, color:'var(--texto-ter)', textTransform:'uppercase'}}>Negócios fechados</div>
            <div style={{fontSize:22, fontWeight:500, marginTop:4, color:'var(--verde)'}}>{orcamentos.filter(o => o.selecionado && !o.sem_orcamento).length}</div>
          </div>
          <div className="card" style={{padding:14}}>
            <div style={{fontSize:11, color:'var(--texto-ter)', textTransform:'uppercase'}}>Sem orçamento (emerg.)</div>
            <div style={{fontSize:22, fontWeight:500, marginTop:4, color:'var(--vermelho)'}}>{orcamentos.filter(o => o.sem_orcamento).length}</div>
          </div>
          <div className="card" style={{padding:14}}>
            <div style={{fontSize:11, color:'var(--texto-ter)', textTransform:'uppercase'}}>Valor total fechado</div>
            <div style={{fontSize:18, fontWeight:500, marginTop:4, color:'var(--azul)'}}>{fmtMoeda(orcamentos.filter(o => o.selecionado).reduce((s,o) => s + (parseFloat(o.valor)||0), 0))}</div>
          </div>
        </div>
      </div>

      {/* ============ GRÁFICO MENSAL ============ */}
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

      {/* Modal de saldo inicial */}
      {editandoSaldo && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setEditandoSaldo(false)}>
          <div className="modal">
            <h3>Saldo inicial do ano {new Date(periodoIni).getFullYear()}</h3>
            <div className="form-group">
              <label>Saldo inicial previsto (R$)</label>
              <input type="text" inputMode="numeric" placeholder="R$ 0,00"
                value={moedaInputValue(formSaldo.saldo_inicial_previsto)}
                onChange={e => setFormSaldo({...formSaldo, saldo_inicial_previsto: digitsToNum(e.target.value)})}/>
            </div>
            <div className="form-group">
              <label>Saldo inicial realizado (R$)</label>
              <input type="text" inputMode="numeric" placeholder="R$ 0,00"
                value={moedaInputValue(formSaldo.saldo_inicial_realizado)}
                onChange={e => setFormSaldo({...formSaldo, saldo_inicial_realizado: digitsToNum(e.target.value)})}/>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:12}}>
              <button className="btn" onClick={() => setEditandoSaldo(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarSaldo}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SecaoCards({ titulo, cor, bg, stats, totalLabel }) {
  const dadosBar = [
    { name:'No Prazo',  value: stats.zelador.crono_s1 + stats.sindico.crono_s1, cor:'var(--azul)' },
    { name:'Atrasadas', value: stats.zelador.crono_s2 + stats.sindico.crono_s2, cor:'var(--vermelho)' },
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
          <div style={{fontSize:11, fontWeight:600, color:cor, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6, textAlign:'center'}}>
            {titulo}
          </div>
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

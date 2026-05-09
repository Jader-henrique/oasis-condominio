import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { exportarParaExcel } from '../utils/excel'

const TIPOS = {
  atividade:   { label:'Atividade do Dia a Dia', cor:'var(--azul)',     bg:'var(--azul-bg)',     short:'A' },
  corretiva:   { label:'Intervenção Corretiva',  cor:'var(--vermelho)', bg:'var(--vermelho-bg)', short:'C' },
  benfeitoria: { label:'Benfeitoria',             cor:'var(--lilas)',    bg:'var(--lilas-bg)',    short:'B' }
}
const FREQS = ['Diário','Semanal','Quinzenal','Mensal','Bimestral','Trimestral','Semestral','Anual','A Cada 2 Anos','A Cada 3 Anos','A Cada 5 Anos']

const DIAS_FREQ = {
  'Diário':1,'Semanal':7,'Quinzenal':15,'Mensal':30,
  'Bimestral':60,'Trimestral':90,'Semestral':180,'Anual':365,
  'A Cada 2 Anos':730,'A Cada 3 Anos':1095,'A Cada 5 Anos':1825,
}
function _addDias(d, n) { const r = new Date(d); r.setDate(r.getDate()+n); return r }
// Gera ocorrências (Date[]) entre [periodoIni, periodoFim) a partir de uma data semente e frequência
function gerarOcorrencias(dataSemente, frequencia, pontual, periodoIni, periodoFim) {
  if (!dataSemente) return []
  const dataFull = String(dataSemente).length === 7 ? dataSemente + '-01' : dataSemente
  let cur = new Date(dataFull)
  if (pontual || !frequencia || !DIAS_FREQ[frequencia]) {
    return (cur >= periodoIni && cur <= periodoFim) ? [cur] : []
  }
  const dias = DIAS_FREQ[frequencia]
  // Avança até a primeira ocorrência dentro do período
  while (cur < periodoIni) cur = _addDias(cur, dias)
  // Recua se passou de periodoFim sem nenhuma ocorrência (não deveria, mas defensivo)
  const res = []
  let limite = 0
  while (cur <= periodoFim && limite < 5000) {
    res.push(new Date(cur))
    cur = _addDias(cur, dias)
    limite++
  }
  return res
}

function fmtData(d) {
  if (!d) return '—'
  const s = String(d).slice(0,10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const [y,m,day] = s.split('-')
  return `${day}/${m}/${y}`
}
function inicioSemana(d) {
  const dt = new Date(d); const dia = dt.getDay()
  dt.setDate(dt.getDate() - dia); dt.setHours(0,0,0,0)
  return dt
}
function fimSemana(d) { const dt = inicioSemana(d); dt.setDate(dt.getDate()+6); dt.setHours(23,59,59); return dt }
function inicioMes(d) { const dt = new Date(d); dt.setDate(1); dt.setHours(0,0,0,0); return dt }
function fimMes(d)    { const dt = new Date(d); dt.setMonth(dt.getMonth()+1, 0); dt.setHours(23,59,59); return dt }
function inicioAno(d) { const dt = new Date(d); dt.setMonth(0,1); dt.setHours(0,0,0,0); return dt }
function fimAno(d)    { const dt = new Date(d); dt.setMonth(11,31); dt.setHours(23,59,59); return dt }

export default function Calendario({ perfil }) {
  const [eventos, setEventos] = useState([])
  const [vista, setVista] = useState('mes')          // semana | mes | ano
  const [ref, setRef] = useState(new Date())          // data de referência
  const [filtroStatus, setFiltroStatus] = useState('pendentes')  // pendentes | executadas | todas (default sempre pendentes)
  const [filtroTipo, setFiltroTipo] = useState('Todos')
  const [filtroResp, setFiltroResp] = useState('Todos')
  const [filtroFreq, setFiltroFreq] = useState('Todos')
  const [filtroRec, setFiltroRec]   = useState('Todos')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const [a, c, b] = await Promise.all([
      supabase.from('calendario').select('*').is('excluido_em', null),
      supabase.from('corretivas').select('*').is('excluido_em', null),
      supabase.from('benfeitorias').select('*').is('excluido_em', null),
    ])
    const ev = []
    ;(a.data || []).forEach(i => ev.push({
      _tipo:'atividade', _id:i.id, _nome:i.descricao,
      _resp:i.responsavel_tipo, _freq:i.frequencia,
      _previsto: i.proxima_data, _realizado: i.status==='realizado' ? (i.realizado_em?.slice(0,10)) : null,
      _feita: i.status==='realizado',
      _recorrencia: i.pontual || !i.frequencia ? 'Pontual' : 'Recorrente',
      _pontual: !!i.pontual,
      _expandir: !i.pontual && !!i.frequencia   // sinaliza que essa atividade gera ocorrências múltiplas
    }))
    ;(c.data || []).forEach(i => ev.push({
      _tipo:'corretiva', _id:i.id, _nome:i.item,
      _resp:i.responsavel_tipo, _freq:null,
      _previsto: i.data_inicio, _realizado: i.data_fim,
      _feita: i.status==='realizado',
      _recorrencia: i.recorrencia
    }))
    ;(b.data || []).forEach(i => ev.push({
      _tipo:'benfeitoria', _id:i.id, _nome:i.sistema,
      _resp:i.responsavel_tipo, _freq:i.periodo,
      _previsto: i.previsto, _realizado: i.realizado,
      _feita: !!i.realizado,
      _recorrencia: i.recorrencia
    }))
    setEventos(ev)
  }

  // Range da vista atual
  const ini = vista==='semana' ? inicioSemana(ref) : vista==='mes' ? inicioMes(ref) : inicioAno(ref)
  const fim = vista==='semana' ? fimSemana(ref)    : vista==='mes' ? fimMes(ref)    : fimAno(ref)

  function dataDoEvento(e) { return e._ocorrencia || e._realizado || e._previsto }

  // Aplica filtros de tipo/responsável/freq/recorrência primeiro
  const eventosFiltradosBase = eventos.filter(e => {
    if (filtroTipo !== 'Todos' && e._tipo !== filtroTipo) return false
    if (filtroResp !== 'Todos' && e._resp !== filtroResp) return false
    if (filtroFreq !== 'Todos' && e._freq !== filtroFreq) return false
    if (filtroRec  !== 'Todos' && e._recorrencia !== filtroRec) return false
    return true
  })

  // Expande recorrências e aplica filtro de status + range
  const eventosFiltrados = []
  for (const e of eventosFiltradosBase) {
    if (e._tipo === 'atividade' && e._expandir && e._previsto && !e._feita) {
      // Gera múltiplas ocorrências dentro do range visível para atividades recorrentes pendentes
      const ocorr = gerarOcorrencias(e._previsto, e._freq, false, ini, fim)
      for (const dt of ocorr) {
        if (filtroStatus === 'executadas') continue  // ocorrências futuras não são executadas
        const dtIso = dt.toISOString().slice(0,10)
        eventosFiltrados.push({ ...e, _ocorrencia: dtIso })
      }
    } else {
      // Item pontual / corretiva / benfeitoria / atividade já realizada — único evento
      if (filtroStatus === 'pendentes'  && e._feita) continue
      if (filtroStatus === 'executadas' && !e._feita) continue
      const d = dataDoEvento(e)
      if (!d) continue
      const dt = new Date(d)
      if (dt < ini || dt > fim) continue
      eventosFiltrados.push(e)
    }
  }

  // Cards: No Prazo / Atrasadas (usa eventos expandidos do range visível)
  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const noPrazo   = eventosFiltrados.filter(e => !e._feita && new Date(dataDoEvento(e)) >= hoje).length
  const atrasadas = eventosFiltrados.filter(e => !e._feita && new Date(dataDoEvento(e)) <  hoje).length

  function navegar(delta) {
    const d = new Date(ref)
    if (vista === 'semana') d.setDate(d.getDate() + delta*7)
    if (vista === 'mes')    d.setMonth(d.getMonth() + delta)
    if (vista === 'ano')    d.setFullYear(d.getFullYear() + delta)
    setRef(d)
  }

  function tituloVista() {
    if (vista==='semana') return `Semana de ${ini.toLocaleDateString('pt-BR')} a ${fim.toLocaleDateString('pt-BR')}`
    if (vista==='mes') return ref.toLocaleDateString('pt-BR', { month:'long', year:'numeric' })
    return String(ref.getFullYear())
  }

  // Renderização das vistas
  function GridMes() {
    const primeiro = inicioMes(ref)
    const ultimoDia = fimMes(ref).getDate()
    const inicioGrid = inicioSemana(primeiro)
    const dias = []
    const totalCelulas = Math.ceil((ultimoDia + primeiro.getDay()) / 7) * 7
    for (let i = 0; i < totalCelulas; i++) {
      const d = new Date(inicioGrid); d.setDate(d.getDate() + i)
      dias.push(d)
    }
    return (
      <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:1, background:'var(--borda)', border:'0.5px solid var(--borda)', borderRadius:8, overflow:'hidden'}}>
        {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => (
          <div key={d} style={{background:'var(--cinza-bg)', padding:'8px 10px', fontSize:11, fontWeight:500, color:'var(--texto-sec)'}}>{d}</div>
        ))}
        {dias.map((d, idx) => {
          const isMes = d.getMonth() === ref.getMonth()
          const isHoje = d.toDateString() === new Date().toDateString()
          const evDia = eventosFiltrados.filter(e => {
            const ed = new Date(dataDoEvento(e))
            return ed.toDateString() === d.toDateString()
          })
          return (
            <div key={idx} style={{
              background: isMes ? 'var(--branco)' : 'var(--cinza-bg)',
              minHeight:80, padding:6,
              opacity: isMes ? 1 : 0.4
            }}>
              <div style={{
                fontSize:11, fontWeight: isHoje ? 600 : 400,
                color: isHoje ? 'var(--azul)' : 'var(--texto-sec)',
                background: isHoje ? 'var(--azul-bg)' : 'transparent',
                display:'inline-block', padding:'1px 6px', borderRadius:4, marginBottom:4
              }}>{d.getDate()}</div>
              {evDia.slice(0,3).map(e => (
                <div key={`${e._tipo}-${e._id}`} title={e._nome} style={{
                  background: TIPOS[e._tipo].bg, color: TIPOS[e._tipo].cor,
                  fontSize:10, padding:'2px 5px', borderRadius:3, marginBottom:2,
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                  textDecoration: e._feita ? 'line-through' : 'none'
                }}>
                  [{TIPOS[e._tipo].short}] {e._nome}
                </div>
              ))}
              {evDia.length > 3 && <div style={{fontSize:10, color:'var(--texto-ter)'}}>+{evDia.length-3} mais</div>}
            </div>
          )
        })}
      </div>
    )
  }

  function GridSemana() {
    const dias = []
    for (let i=0; i<7; i++) { const d = new Date(ini); d.setDate(d.getDate()+i); dias.push(d) }
    return (
      <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:6}}>
        {dias.map((d, idx) => {
          const isHoje = d.toDateString() === new Date().toDateString()
          const evDia = eventosFiltrados.filter(e => new Date(dataDoEvento(e)).toDateString() === d.toDateString())
          return (
            <div key={idx} className="card" style={{borderTopColor: isHoje?'var(--azul)':'var(--borda)', minHeight:200, padding:10}}>
              <div style={{fontSize:11, color:'var(--texto-ter)', textTransform:'uppercase'}}>{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d.getDay()]}</div>
              <div style={{fontSize:18, fontWeight:500, marginBottom:8, color: isHoje?'var(--azul)':'var(--texto)'}}>{d.getDate()}</div>
              {evDia.length === 0 && <div style={{fontSize:11, color:'var(--texto-ter)'}}>—</div>}
              {evDia.map(e => (
                <div key={`${e._tipo}-${e._id}`} style={{
                  background: TIPOS[e._tipo].bg, color: TIPOS[e._tipo].cor,
                  fontSize:11, padding:'4px 6px', borderRadius:4, marginBottom:4,
                  textDecoration: e._feita ? 'line-through' : 'none'
                }}>{e._nome}</div>
              ))}
            </div>
          )
        })}
      </div>
    )
  }

  function GridAno() {
    const meses = []
    for (let m=0; m<12; m++) {
      const dRef = new Date(ref.getFullYear(), m, 1)
      const evMes = eventosFiltrados.filter(e => {
        const ed = new Date(dataDoEvento(e))
        return ed.getFullYear() === dRef.getFullYear() && ed.getMonth() === m
      })
      meses.push({ data:dRef, eventos:evMes })
    }
    return (
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:10}}>
        {meses.map((m, idx) => (
          <div key={idx} className="card" style={{padding:12}}>
            <div style={{fontWeight:500, fontSize:13, marginBottom:8, textTransform:'capitalize'}}>
              {m.data.toLocaleDateString('pt-BR', { month:'long' })}
            </div>
            <div style={{fontSize:11, color:'var(--texto-sec)', marginBottom:6}}>{m.eventos.length} evento(s)</div>
            {m.eventos.slice(0,5).map(e => (
              <div key={`${e._tipo}-${e._id}`} style={{
                fontSize:11, padding:'3px 6px', borderRadius:3, marginBottom:3,
                background: TIPOS[e._tipo].bg, color: TIPOS[e._tipo].cor,
                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                textDecoration: e._feita ? 'line-through' : 'none'
              }}>{e._nome}</div>
            ))}
            {m.eventos.length > 5 && <div style={{fontSize:10, color:'var(--texto-ter)'}}>+{m.eventos.length-5} mais</div>}
          </div>
        ))}
      </div>
    )
  }

  function btnVista(v, l) {
    return <button onClick={() => setVista(v)} style={{
      padding:'6px 12px', fontSize:12, fontWeight: vista===v?500:400,
      background: vista===v?'var(--azul)':'var(--cinza-bg)',
      color: vista===v?'#fff':'var(--texto-sec)',
      border:'none', borderRadius:6, cursor:'pointer'
    }}>{l}</button>
  }
  function btnStatus(s, l) {
    return <button onClick={() => setFiltroStatus(s)} style={{
      padding:'6px 10px', fontSize:11, fontWeight: filtroStatus===s?500:400,
      background: filtroStatus===s?'var(--azul)':'var(--cinza-bg)',
      color: filtroStatus===s?'#fff':'var(--texto-sec)',
      border:'none', borderRadius:6, cursor:'pointer'
    }}>{l}</button>
  }
  function btnPequeno(ativo, onClick, label) {
    return <button onClick={onClick} style={{
      padding:'4px 8px', fontSize:10, fontWeight: ativo?500:400,
      background: ativo?'var(--azul)':'var(--cinza-bg)',
      color: ativo?'#fff':'var(--texto-sec)',
      border:'none', borderRadius:5, cursor:'pointer'
    }}>{label}</button>
  }

  function exportar() {
    const dados = eventosFiltrados.map(e => ({
      Tipo: TIPOS[e._tipo].label,
      Item: e._nome,
      Responsável: e._resp || '',
      Frequência: e._freq || '',
      Recorrência: e._recorrencia || '',
      Previsto: fmtData(e._previsto),
      Realizado: fmtData(e._realizado),
      Status: e._feita ? 'Realizado' : 'Pendente'
    }))
    exportarParaExcel(dados, `calendario_${vista}_${ref.toISOString().slice(0,10)}.xlsx`, 'Calendário')
  }

  return (
    <div>
      <div className="page-title">Calendário</div>
      <div className="page-sub">Atividades, corretivas e benfeitorias em uma visão consolidada</div>

      <div className="stat-grid">
        <div className="stat"><div className="stat-n">{eventosFiltrados.length}</div><div className="stat-l">Eventos no período</div></div>
        <div className="stat"><div className="stat-n" style={{color:'var(--verde)'}}>{noPrazo}</div><div className="stat-l">No prazo</div></div>
        <div className="stat"><div className="stat-n" style={{color:'var(--vermelho)'}}>{atrasadas}</div><div className="stat-l">Atrasadas</div></div>
        <div className="stat"><div className="stat-n" style={{color:'var(--azul)'}}>{eventos.filter(e => e._feita).length}</div><div className="stat-l">Total realizadas</div></div>
      </div>

      <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{display:'flex',gap:4}}>
          <button onClick={() => navegar(-1)} className="btn btn-sm"><i className="fa-solid fa-chevron-left"></i></button>
          <button onClick={() => setRef(new Date())} className="btn btn-sm">Hoje</button>
          <button onClick={() => navegar(1)} className="btn btn-sm"><i className="fa-solid fa-chevron-right"></i></button>
        </div>
        <div style={{fontSize:14,fontWeight:500,textTransform:'capitalize',flex:1}}>{tituloVista()}</div>
        <div style={{display:'flex',gap:4}}>
          {btnVista('semana','Semana')}
          {btnVista('mes','Mês')}
          {btnVista('ano','Ano')}
        </div>
        <button className="btn btn-sm" onClick={exportar}><i className="fa-solid fa-file-excel" style={{marginRight:6}}></i>Exportar</button>
      </div>

      <div style={{display:'flex',gap:6,marginBottom:8}}>
        {btnStatus('pendentes','Pendentes')}
        {btnStatus('executadas','Executadas')}
        {btnStatus('todas','Todas')}
      </div>

      <div style={{display:'flex',gap:12,marginBottom:14,flexWrap:'wrap',fontSize:11}}>
        <div>
          <div style={{color:'var(--texto-ter)',marginBottom:3}}>TIPO</div>
          <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
            {[['Todos','Todos'],['atividade','Atividades'],['corretiva','Corretivas'],['benfeitoria','Benfeitorias']].map(([v,l]) => (
              <span key={v}>{btnPequeno(filtroTipo===v, () => setFiltroTipo(v), l)}</span>
            ))}
          </div>
        </div>
        <div>
          <div style={{color:'var(--texto-ter)',marginBottom:3}}>RESPONSÁVEL</div>
          <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
            {['Todos','Zeladoria','Síndico','Terceiro'].map(v => (
              <span key={v}>{btnPequeno(filtroResp===v, () => setFiltroResp(v), v)}</span>
            ))}
          </div>
        </div>
        <div>
          <div style={{color:'var(--texto-ter)',marginBottom:3}}>FREQUÊNCIA</div>
          <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
            {['Todos',...FREQS].map(v => (
              <span key={v}>{btnPequeno(filtroFreq===v, () => setFiltroFreq(v), v)}</span>
            ))}
          </div>
        </div>
        <div>
          <div style={{color:'var(--texto-ter)',marginBottom:3}}>RECORRÊNCIA</div>
          <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
            {['Todos','Recorrente','Pontual','Não recorrente'].map(v => (
              <span key={v}>{btnPequeno(filtroRec===v, () => setFiltroRec(v), v)}</span>
            ))}
          </div>
        </div>
      </div>

      {vista==='semana' && <GridSemana/>}
      {vista==='mes'    && <GridMes/>}
      {vista==='ano'    && <GridAno/>}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { exportarParaExcel } from '../utils/excel'
import ViewModal from './ViewModal'

const TIPOS = [
  { value:'atividade',  label:'Atividade do Dia a Dia', tabela:'calendario',   campoNome:'descricao', prefixo:'A' },
  { value:'corretiva',  label:'Intervenção Corretiva',  tabela:'corretivas',   campoNome:'item',      prefixo:'C' },
  { value:'benfeitoria',label:'Benfeitoria',            tabela:'benfeitorias', campoNome:'sistema',   prefixo:'B' },
]

function fmtMoeda(v) {
  if (v === null || v === undefined || v === '') return '—'
  const num = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  if (isNaN(num)) return '—'
  return num.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })
}
function fmtData(d) {
  if (!d) return '—'
  const s = String(d).slice(0,10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const [y,m,day] = s.split('-')
  return `${day}/${m}/${y}`
}
function fmtDataHora(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' }) } catch { return '—' }
}
function digitsToNum(str) {
  const digits = String(str ?? '').replace(/\D/g, '')
  if (!digits) return null
  return parseInt(digits, 10) / 100
}
function moedaInputValue(v) {
  if (v === null || v === undefined || v === '') return ''
  const num = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  if (isNaN(num)) return ''
  return num.toLocaleString('pt-BR', { style:'currency', currency:'BRL', minimumFractionDigits:2 })
}

function ModalBuscaItem({ tipo, onSelect, onCancelar }) {
  const [busca, setBusca] = useState('')
  const [itens, setItens] = useState([])
  const tipoCfg = TIPOS.find(t => t.value === tipo)

  useEffect(() => { carregar() }, [tipo])
  async function carregar() {
    const { data } = await supabase.from(tipoCfg.tabela).select('*').is('excluido_em', null).order('num')
    setItens(data || [])
  }

  const filtrados = itens.filter(i => {
    const nome = String(i[tipoCfg.campoNome] || '').toLowerCase()
    const num  = String(i.num || '')
    return nome.includes(busca.toLowerCase()) || num.includes(busca)
  })

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onCancelar()}>
      <div className="modal" style={{width:520, maxWidth:'95vw'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <h3 style={{margin:0}}>Selecionar {tipoCfg.label.toLowerCase()}</h3>
          <button onClick={onCancelar} style={{background:'var(--cinza-bg)',border:'none',borderRadius:'50%',width:30,height:30,fontSize:18,cursor:'pointer'}}>×</button>
        </div>
        <input autoFocus placeholder="Pesquisar por nome ou número..." value={busca} onChange={e => setBusca(e.target.value)}
          style={{width:'100%', padding:'10px', borderRadius:8, border:'0.5px solid var(--borda)', marginBottom:8}}/>
        <div style={{maxHeight:340, overflowY:'auto', border:'0.5px solid var(--borda)', borderRadius:8}}>
          {filtrados.length === 0 && <div style={{padding:'16px',fontSize:12,color:'var(--texto-ter)',textAlign:'center'}}>Nenhum item encontrado</div>}
          {filtrados.map(i => (
            <div key={i.id} onClick={() => onSelect(i)}
              style={{padding:'12px 14px', fontSize:13, cursor:'pointer', borderBottom:'0.5px solid var(--borda)'}}
              onMouseEnter={e => e.currentTarget.style.background='var(--cinza-bg)'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}>
              <span style={{color:'var(--azul)', fontWeight:500, marginRight:8}}>[{tipoCfg.prefixo}{i.num}]</span>
              {i[tipoCfg.campoNome]}
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}

export default function Orcamentos({ perfil }) {
  const [orcamentos, setOrcamentos] = useState([])
  const [itensTodos, setItensTodos] = useState({ calendario:[], corretivas:[], benfeitorias:[] })
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [arquivo, setArquivo] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [buscandoItem, setBuscandoItem] = useState(false)
  const [showFiltros, setShowFiltros] = useState(false)
  const [filtros, setFiltros] = useState({ periodoIni:'', periodoFim:'', empresa:'', itemId:'', tipo:'' })
  const [verItem, setVerItem] = useState(null)
  const isAdmin = perfil?.perfil === 'admin' || perfil?.perfil === 'sindico'

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const [o, c, cor, b] = await Promise.all([
      supabase.from('orcamentos').select('*').is('excluido_em', null).order('data_criacao', { ascending:false }),
      supabase.from('calendario').select('id,num,descricao,valor').is('excluido_em', null),
      supabase.from('corretivas').select('id,num,item,valor').is('excluido_em', null),
      supabase.from('benfeitorias').select('id,num,sistema,valor').is('excluido_em', null),
    ])
    setOrcamentos(o.data || [])
    setItensTodos({ calendario: c.data || [], corretivas: cor.data || [], benfeitorias: b.data || [] })
  }

  function nomeItem(orc) {
    const cfg = TIPOS.find(t => t.value === orc.item_tipo)
    if (!cfg) return '—'
    const lista = itensTodos[cfg.tabela] || []
    const item = lista.find(i => i.id === orc.item_id)
    if (!item) return `[${cfg.prefixo}?] (item removido)`
    return `[${cfg.prefixo}${item.num}] ${item[cfg.campoNome]}`
  }
  function tipoLabel(t) { return TIPOS.find(x => x.value === t)?.label || t }

  function abrirNovo() {
    setForm({ item_tipo:'corretiva', item_id:null, item_nome:'', empresa:'', valor:null, data:null, prazo_entrega:'', condicao_pagamento:'', obs:'', sem_orcamento:false, dispensa:false })
    setArquivo(null)
    setModal('novo')
  }
  function abrirEditar(o) {
    setForm({ ...o, item_nome: nomeItem(o) })
    setArquivo(null); setModal('editar')
  }

  async function excluir(item) {
    if (!confirm('Excluir esse orçamento?')) return
    try {
      const r = await supabase.from('orcamentos').update({ excluido_em: new Date().toISOString() }).eq('id', item.id)
      if (r.error) throw r.error
      carregar()
    } catch (e) {
      alert('Erro ao excluir: ' + (e?.message || JSON.stringify(e)))
    }
  }

  async function salvar() {
    if (!form.item_id) { alert('Selecione o item vinculado'); return }
    if (!form.empresa) { alert('Informe a empresa'); return }
    setSalvando(true)
    try {
      let arquivo_url = form.arquivo_url || ''
      if (arquivo) {
        const ext = arquivo.name.split('.').pop()
        const path = `orcamentos/${Date.now()}.${ext}`
        const upRes = await supabase.storage.from('documentos').upload(path, arquivo)
        if (upRes.error) throw upRes.error
        const { data: u } = supabase.storage.from('documentos').getPublicUrl(path)
        arquivo_url = u.publicUrl
      }
      const { item_nome, ...rest } = form
      // Filtra strings vazias para evitar enviar campos invalidos
      const payload = { arquivo_url }
      Object.keys(rest).forEach(k => {
        const v = rest[k]
        if (v === undefined) return
        if (v === '' && !['empresa'].includes(k)) return
        payload[k] = v
      })
      let result
      if (modal === 'novo') {
        delete payload.id
        payload.data_criacao = new Date().toISOString()
        result = await supabase.from('orcamentos').insert([payload])
      } else {
        const { id, ...resto } = payload
        result = await supabase.from('orcamentos').update(resto).eq('id', id)
      }
      if (result.error) throw result.error
      setSalvando(false); setModal(null); carregar()
    } catch (e) {
      setSalvando(false)
      alert('Erro ao salvar: ' + (e?.message || JSON.stringify(e)))
    }
  }

  // Aplicar filtros
  const orcsFiltrados = orcamentos.filter(o => {
    if (filtros.periodoIni && o.data && o.data < filtros.periodoIni) return false
    if (filtros.periodoFim && o.data && o.data > filtros.periodoFim) return false
    if (filtros.empresa && !String(o.empresa||'').toLowerCase().includes(filtros.empresa.toLowerCase())) return false
    if (filtros.itemId && String(o.item_id) !== String(filtros.itemId)) return false
    if (filtros.tipo && o.item_tipo !== filtros.tipo) return false
    return true
  })

  // Cards
  const totalOrcs = orcsFiltrados.length
  const itensComOrc = new Set(orcsFiltrados.map(o => `${o.item_tipo}:${o.item_id}`))
  const itensTotalNaoFechados = []
  TIPOS.forEach(t => {
    const itens = itensTodos[t.tabela] || []
    itens.forEach(i => {
      const orcsItem = orcamentos.filter(o => o.item_tipo === t.value && o.item_id === i.id)
      const fechado = orcsItem.some(o => o.selecionado)
      if (!fechado) itensTotalNaoFechados.push(`${t.value}:${i.id}`)
    })
  })

  return (
    <div>
      <div className="page-title">Orçamentos</div>
      <div className="page-sub">Cotações vinculadas a atividades, intervenções corretivas e benfeitorias</div>

      <div className="stat-grid">
        <div className="stat"><div className="stat-n">{totalOrcs}</div><div className="stat-l">Orçamentos no filtro</div></div>
        <div className="stat"><div className="stat-n">{orcamentos.length}</div><div className="stat-l">Orçamentos cadastrados</div></div>
        <div className="stat"><div className="stat-n" style={{color:'var(--amarelo)'}}>{itensTotalNaoFechados.length}</div><div className="stat-l">Atividades pendentes de fechar</div></div>
        <div className="stat"><div className="stat-n" style={{color:'var(--verde)'}}>{orcamentos.filter(o => o.selecionado).length}</div><div className="stat-l">Negócios fechados</div></div>
      </div>

      <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
        {isAdmin && <button className="btn btn-success" onClick={abrirNovo}>+ Adicionar orçamento</button>}
        <button className="btn" onClick={() => setShowFiltros(s => !s)}>
          <i className="fa-solid fa-filter" style={{marginRight:6}}></i>
          {showFiltros ? 'Ocultar filtros' : 'Filtros'}
        </button>
        {(filtros.periodoIni || filtros.periodoFim || filtros.empresa || filtros.itemId || filtros.tipo) && (
          <button className="btn" onClick={() => setFiltros({periodoIni:'',periodoFim:'',empresa:'',itemId:'',tipo:''})}>Limpar filtros</button>
        )}
      </div>

      {showFiltros && (
        <div className="card" style={{marginBottom:14}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))',gap:8}}>
            <div className="form-group" style={{marginBottom:0}}>
              <label>Período (início)</label>
              <input type="date" value={filtros.periodoIni} onChange={e => setFiltros({...filtros, periodoIni:e.target.value})}/>
            </div>
            <div className="form-group" style={{marginBottom:0}}>
              <label>Período (fim)</label>
              <input type="date" value={filtros.periodoFim} onChange={e => setFiltros({...filtros, periodoFim:e.target.value})}/>
            </div>
            <div className="form-group" style={{marginBottom:0}}>
              <label>Empresa</label>
              <input value={filtros.empresa} onChange={e => setFiltros({...filtros, empresa:e.target.value})} placeholder="parte do nome..."/>
            </div>
            <div className="form-group" style={{marginBottom:0}}>
              <label>Tipo de atividade</label>
              <select value={filtros.tipo} onChange={e => setFiltros({...filtros, tipo:e.target.value})}>
                <option value="">Todos</option>
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="card card-amarelo" style={{padding:0,overflow:'hidden'}}>
        <table>
          <thead>
            <tr>
              <th>Tipo</th><th>Item vinculado</th><th>Empresa</th><th>Valor</th>
              <th>Data orçamento</th><th>Cadastrado em</th><th>Status</th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {orcsFiltrados.length === 0 && (
              <tr><td colSpan={isAdmin ? 8 : 7} style={{textAlign:'center',padding:24,color:'var(--texto-ter)'}}>Nenhum orçamento</td></tr>
            )}
            {orcsFiltrados.map(o => (
              <tr key={o.id} onDoubleClick={() => setVerItem(o)} style={{cursor:'pointer'}}>
                <td><span className="badge badge-baixa">{tipoLabel(o.item_tipo)}</span></td>
                <td style={{fontWeight:500, fontSize:12}}>{nomeItem(o)}</td>
                <td>{o.empresa||'—'}</td>
                <td style={{whiteSpace:'nowrap', fontWeight:500}}>{fmtMoeda(o.valor)}</td>
                <td>{fmtData(o.data)}</td>
                <td style={{fontSize:11,color:'var(--texto-sec)'}}>{fmtDataHora(o.data_criacao)}</td>
                <td>
                  {o.sem_orcamento && <span className="badge badge-urgente"><i className="fa-solid fa-bolt" style={{marginRight:3}}></i>Sem orçamento</span>}
                  {o.selecionado && !o.sem_orcamento && <span className="badge badge-realizado"><i className="fa-solid fa-check" style={{marginRight:3}}></i>Fechado</span>}
                  {!o.selecionado && !o.sem_orcamento && <span className="badge badge-pendente">Em cotação</span>}
                </td>
                {isAdmin && (
                  <td>
                    <button className="btn btn-sm" onClick={() => abrirEditar(o)}>Editar</button>
                    <button className="btn btn-sm btn-danger" title="Excluir" style={{marginLeft:4}} onClick={() => excluir(o)}>
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div className="modal">
            <h3>{modal==='novo' ? 'Novo orçamento' : 'Editar orçamento'}</h3>
            <div className="form-group">
              <label>Tipo de atividade vinculada</label>
              <select value={form.item_tipo||'corretiva'} onChange={e => setForm({...form, item_tipo:e.target.value, item_id:null, item_nome:''})}>
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Item vinculado</label>
              {form.item_id ? (
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  <div style={{flex:1, padding:'8px 10px', border:'0.5px solid var(--borda)', borderRadius:8, fontSize:13, background:'var(--cinza-bg)'}}>
                    {form.item_nome || nomeItem(form)}
                  </div>
                  <button type="button" className="btn btn-sm" onClick={() => setForm({...form, item_id:null, item_nome:''})}>Trocar</button>
                </div>
              ) : (
                <button type="button" className="btn" style={{width:'100%'}} onClick={() => setBuscandoItem(true)}>
                  <i className="fa-solid fa-magnifying-glass" style={{marginRight:6}}></i>Pesquisar item...
                </button>
              )}
            </div>
            <div className="form-group"><label>Empresa</label><input value={form.empresa||''} onChange={e => setForm({...form, empresa:e.target.value})}/></div>
            <div className="form-group">
              <label>Valor (R$)</label>
              <input type="text" inputMode="numeric" placeholder="R$ 0,00"
                value={moedaInputValue(form.valor)}
                onChange={e => setForm({...form, valor: digitsToNum(e.target.value)})}/>
            </div>
            <div className="form-group">
              <label>Data do orçamento</label>
              <input type="date" value={form.data || ''} onChange={e => setForm({...form, data:e.target.value || null})}/>
            </div>
            <div className="form-group"><label>Prazo de entrega</label><input value={form.prazo_entrega||''} onChange={e => setForm({...form, prazo_entrega:e.target.value})} placeholder="Ex: 15 dias úteis"/></div>
            <div className="form-group"><label>Condição de pagamento</label><input value={form.condicao_pagamento||''} onChange={e => setForm({...form, condicao_pagamento:e.target.value})} placeholder="Ex: 50%+50%"/></div>
            <div className="form-group"><label>Observações</label><textarea value={form.obs||''} onChange={e => setForm({...form, obs:e.target.value})}/></div>
            <div className="form-group"><label>Arquivo da proposta</label><input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setArquivo(e.target.files[0])}/></div>
            {modal==='editar' && form.data_criacao && (
              <div style={{fontSize:11, color:'var(--texto-ter)', marginBottom:12}}>
                Cadastrado em {fmtDataHora(form.data_criacao)}
              </div>
            )}
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:12}}>
              <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando?'Salvando...':'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {buscandoItem && (
        <ModalBuscaItem
          tipo={form.item_tipo}
          onSelect={item => {
            const cfg = TIPOS.find(t => t.value === form.item_tipo)
            setForm({...form, item_id: item.id, item_nome: `[${cfg.prefixo}${item.num}] ${item[cfg.campoNome]}`})
            setBuscandoItem(false)
          }}
          onCancelar={() => setBuscandoItem(false)}
        />
      )}

      {verItem && (
        <ViewModal
          titulo={verItem.empresa || '(orçamento)'}
          subtitulo={nomeItem(verItem)}
          corBorda="var(--amarelo)"
          onFechar={() => setVerItem(null)}
          onEditar={() => { abrirEditar(verItem); setVerItem(null) }}
          campos={[
            { label:'Tipo',                 valor:tipoLabel(verItem.item_tipo) },
            { label:'Item vinculado',       valor:nomeItem(verItem) },
            { label:'Empresa',              valor:verItem.empresa },
            { label:'Valor',                valor:verItem.valor, tipo:'moeda' },
            { label:'Data orçamento',       valor:verItem.data, tipo:'data' },
            { label:'Prazo de entrega',     valor:verItem.prazo_entrega },
            { label:'Condição pagamento',   valor:verItem.condicao_pagamento },
            { label:'Sem orçamento (emerg.)', valor:verItem.sem_orcamento, tipo:'bool' },
            { label:'Selecionado',          valor:verItem.selecionado, tipo:'bool' },
            { label:'Motivo da escolha',    valor:verItem.motivo_escolha, tipo:'longtext' },
            { label:'Observações',          valor:verItem.obs, tipo:'longtext' },
            { label:'Cadastrado em',        valor:verItem.data_criacao, tipo:'datahora' },
          ]}
        />
      )}
    </div>
  )
}

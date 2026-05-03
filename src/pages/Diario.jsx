import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { exportarParaExcel } from '../utils/excel'

const TIPOS = [
  { value:'atividade',  label:'Atividade do Dia a Dia', tabela:'calendario',   campoNome:'descricao', prefixo:'A' },
  { value:'corretiva',  label:'Intervenção Corretiva',  tabela:'corretivas',   campoNome:'item',      prefixo:'C' },
  { value:'benfeitoria',label:'Benfeitoria',            tabela:'benfeitorias', campoNome:'sistema',   prefixo:'B' },
]

const DIAS_FREQ = {
  'Diário':1, 'Semanal':7, 'Quinzenal':15, 'Mensal':30,
  'Bimestral':60, 'Trimestral':90, 'Semestral':180, 'Anual':365,
  'A Cada 2 Anos':730, 'A Cada 3 Anos':1095, 'A Cada 5 Anos':1825
}

function fmtData(d) {
  if (!d) return '—'
  const s = String(d).slice(0,10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const [y,m,day] = s.split('-')
  return `${day}/${m}/${y}`
}
function addDias(isoDate, dias) {
  const d = new Date(isoDate)
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0,10)
}

function ModalBuscaItem({ tipo, onSelect, onCancelar }) {
  const [busca, setBusca] = useState('')
  const [itens, setItens] = useState([])
  const cfg = TIPOS.find(t => t.value === tipo)
  useEffect(() => { (async () => {
    const { data } = await supabase.from(cfg.tabela).select('*').is('excluido_em', null).order('num')
    setItens(data || [])
  })() }, [tipo])
  const filtrados = itens.filter(i => {
    const nome = String(i[cfg.campoNome] || '').toLowerCase()
    return nome.includes(busca.toLowerCase()) || String(i.num||'').includes(busca)
  })
  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onCancelar()}>
      <div className="modal" style={{width:520, maxWidth:'95vw'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <h3 style={{margin:0}}>Selecionar {cfg.label.toLowerCase()}</h3>
          <button onClick={onCancelar} style={{background:'var(--cinza-bg)',border:'none',borderRadius:'50%',width:30,height:30,fontSize:18,cursor:'pointer'}}>×</button>
        </div>
        <input autoFocus placeholder="Pesquisar..." value={busca} onChange={e => setBusca(e.target.value)}
          style={{width:'100%', padding:'10px', borderRadius:8, border:'0.5px solid var(--borda)', marginBottom:8}}/>
        <div style={{maxHeight:340, overflowY:'auto', border:'0.5px solid var(--borda)', borderRadius:8}}>
          {filtrados.map(i => (
            <div key={i.id} onClick={() => onSelect(i)}
              style={{padding:'12px 14px', fontSize:13, cursor:'pointer', borderBottom:'0.5px solid var(--borda)'}}
              onMouseEnter={e => e.currentTarget.style.background='var(--cinza-bg)'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}>
              <span style={{color:'var(--azul)', fontWeight:500, marginRight:8}}>[{cfg.prefixo}{i.num}]</span>
              {i[cfg.campoNome]}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Diario({ perfil }) {
  const [itens, setItens] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [arquivos, setArquivos] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const isAdmin = perfil?.perfil === 'admin' || perfil?.perfil === 'sindico'
  const isZelador = perfil?.perfil === 'zelador'
  const isVistorias = perfil?.perfil === 'vistorias'
  const podeRegistrar = isAdmin || isZelador || isVistorias

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data } = await supabase.from('diario').select('*').order('criado_em', { ascending:false })
    setItens(data || [])
  }

  function abrirNovo() {
    setForm({ data: new Date().toISOString().slice(0,10), item_tipo:'atividade', item_id:null, item_nome:'', obs:'' })
    setArquivos([])
    setModal('novo')
  }
  function abrirEditar(item) {
    setForm({ ...item })
    setArquivos([])
    setModal('editar')
  }

  // Recalcula próxima ocorrência se item for recorrente
  async function recalcularProxima(itemTipo, itemId, dataExecucao) {
    if (itemTipo !== 'atividade') return  // só atividades têm frequencia explícita
    const { data: item } = await supabase.from('calendario').select('frequencia,pontual').eq('id', itemId).single()
    if (!item) return
    const updateAt = { status:'realizado', realizado_em: dataExecucao, realizado_por: perfil?.nome || '' }
    if (!item.pontual) {
      const dias = DIAS_FREQ[item.frequencia]
      if (dias) updateAt.proxima_data = addDias(dataExecucao, dias)
    }
    await supabase.from('calendario').update(updateAt).eq('id', itemId)
  }

  async function salvar() {
    if (!form.item_id) { alert('Selecione o item'); return }
    setSalvando(true)
    let evidencias_urls = form.evidencias_urls || []
    for (const arq of arquivos) {
      const ext = arq.name.split('.').pop()
      const path = `diario/${Date.now()}_${arq.name}`
      await supabase.storage.from('evidencias').upload(path, arq)
      const { data: u } = supabase.storage.from('evidencias').getPublicUrl(path)
      evidencias_urls = [...evidencias_urls, u.publicUrl]
    }
    const { item_nome, ...payload } = form
    payload.evidencias_urls = evidencias_urls
    payload.evidencia_url = evidencias_urls[0] || ''  // compat com schema antigo
    payload.empresa = perfil?.nome || ''
    payload.ref = String(form.item_id)
    payload.sistema = item_nome || ''
    if (modal === 'novo') await supabase.from('diario').insert([payload])
    else { const { id, ...resto } = payload; await supabase.from('diario').update(resto).eq('id', id) }
    // Recalcula próxima ocorrência
    await recalcularProxima(form.item_tipo, form.item_id, form.data)
    setSalvando(false); setModal(null); carregar()
  }

  return (
    <div>
      <div className="page-title">Diário de Manutenções</div>
      <div className="page-sub">Registro das execuções com evidências fotográficas</div>
      {podeRegistrar && <button className="btn btn-success" style={{marginBottom:12}} onClick={abrirNovo}>+ Registrar manutenção</button>}

      {itens.length === 0 && <div className="card" style={{textAlign:'center',color:'var(--texto-ter)'}}>Nenhum registro ainda</div>}

      {itens.map(d => {
        const fotos = (d.evidencias_urls && d.evidencias_urls.length) ? d.evidencias_urls : (d.evidencia_url ? [d.evidencia_url] : [])
        return (
          <div className="card card-verde" key={d.id}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8,gap:8}}>
              <div>
                <div style={{fontWeight:500,fontSize:13}}>{d.sistema || '(sem item)'}</div>
                <div style={{fontSize:11,color:'var(--texto-sec)',marginTop:3}}>
                  Por {d.empresa || '—'} · Item ref: {d.ref || '—'}
                </div>
              </div>
              <span style={{background:'var(--cinza-bg)',padding:'2px 8px',borderRadius:6,fontSize:11,whiteSpace:'nowrap'}}>{fmtData(d.data)}</span>
            </div>
            {d.obs && <div style={{marginTop:8,fontSize:12,color:'var(--texto-sec)'}}>{d.obs}</div>}
            {fotos.length > 0 && (
              <div style={{marginTop:8, display:'flex', gap:6, flexWrap:'wrap'}}>
                {fotos.map((u, idx) => (
                  <a key={idx} href={u} target="_blank" rel="noreferrer">
                    <img src={u} alt={`evid ${idx+1}`} style={{width:80, height:80, objectFit:'cover', borderRadius:6, border:'0.5px solid var(--borda)'}}/>
                  </a>
                ))}
              </div>
            )}
            {isAdmin && <div style={{marginTop:8}}><button className="btn btn-sm" onClick={() => abrirEditar(d)}>Editar</button></div>}
          </div>
        )
      })}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div className="modal">
            <h3>{modal==='novo' ? 'Novo registro' : 'Editar registro'}</h3>
            <div className="form-group">
              <label>Data</label>
              <input type="date" value={form.data ? String(form.data).slice(0,10) : ''} onChange={e => setForm({...form, data:e.target.value})}/>
            </div>
            <div className="form-group">
              <label>Tipo</label>
              <select value={form.item_tipo||'atividade'} onChange={e => setForm({...form, item_tipo:e.target.value, item_id:null, item_nome:''})}>
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Item</label>
              {form.item_id ? (
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  <div style={{flex:1, padding:'8px 10px', border:'0.5px solid var(--borda)', borderRadius:8, fontSize:13, background:'var(--cinza-bg)'}}>
                    {form.item_nome || form.sistema || '(item)'}
                  </div>
                  <button type="button" className="btn btn-sm" onClick={() => setForm({...form, item_id:null, item_nome:''})}>Trocar</button>
                </div>
              ) : (
                <button type="button" className="btn" style={{width:'100%'}} onClick={() => setBuscando(true)}>
                  <i className="fa-solid fa-magnifying-glass" style={{marginRight:6}}></i>Pesquisar item...
                </button>
              )}
            </div>
            <div className="form-group">
              <label>Observações</label>
              <textarea value={form.obs||''} onChange={e => setForm({...form, obs:e.target.value})} placeholder="O que foi feito, peças trocadas, condição..."/>
            </div>
            <div className="form-group">
              <label>Evidências (várias fotos)</label>
              <input type="file" accept="image/*" multiple onChange={e => setArquivos(Array.from(e.target.files))}/>
              {arquivos.length > 0 && <div style={{fontSize:11,color:'var(--texto-sec)',marginTop:4}}>{arquivos.length} arquivo(s) selecionado(s)</div>}
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:12}}>
              <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando?'Salvando...':'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {buscando && (
        <ModalBuscaItem tipo={form.item_tipo}
          onSelect={item => {
            const cfg = TIPOS.find(t => t.value === form.item_tipo)
            setForm({...form, item_id:item.id, item_nome:`[${cfg.prefixo}${item.num}] ${item[cfg.campoNome]}`})
            setBuscando(false)
          }}
          onCancelar={() => setBuscando(false)}/>
      )}
    </div>
  )
}

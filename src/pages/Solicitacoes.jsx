import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { exportarParaExcel } from '../utils/excel'

const STATUS_LABEL = { aberta:'Aberta', respondida:'Respondida', encerrada:'Encerrada' }
const STATUS_BADGE = { aberta:'pendente', respondida:'andamento', encerrada:'realizado' }

function fmtDataHora(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' }) } catch { return '—' }
}

export default function Solicitacoes({ perfil }) {
  const [itens, setItens] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [arquivos, setArquivos] = useState([])
  const [salvando, setSalvando] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState('todas')

  const isAdmin = perfil?.perfil === 'admin' || perfil?.perfil === 'sindico'
  const isMorador = perfil?.perfil === 'condomino' || (!isAdmin && perfil?.perfil !== 'zelador' && perfil?.perfil !== 'vistorias')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    let q = supabase.from('solicitacoes').select('*').order('criado_em', { ascending:false })
    if (isMorador) q = q.eq('morador_id', perfil?.id)
    const { data } = await q
    setItens(data || [])
  }

  function abrirNova() {
    setForm({ texto:'' })
    setArquivos([])
    setModal('nova')
  }
  function abrirResposta(item) {
    setForm({ ...item, resposta: item.resposta || '' })
    setModal('responder')
  }

  async function salvarNova() {
    if (!form.texto?.trim()) { alert('Escreva sua solicitação'); return }
    setSalvando(true)
    const anexos = []
    for (const arq of arquivos) {
      const path = `solicitacoes/${Date.now()}_${arq.name}`
      await supabase.storage.from('evidencias').upload(path, arq)
      const { data: u } = supabase.storage.from('evidencias').getPublicUrl(path)
      anexos.push(u.publicUrl)
    }
    await supabase.from('solicitacoes').insert([{
      morador_id: perfil?.id, morador_nome: perfil?.nome,
      texto: form.texto, anexos, status:'aberta'
    }])
    setSalvando(false); setModal(null); carregar()
  }

  async function salvarResposta() {
    setSalvando(true)
    await supabase.from('solicitacoes').update({
      resposta: form.resposta,
      status: 'respondida',
      respondida_por: perfil?.nome,
      respondida_em: new Date().toISOString()
    }).eq('id', form.id)
    setSalvando(false); setModal(null); carregar()
  }

  async function encerrar(id) {
    if (!confirm('Encerrar esta solicitação?')) return
    await supabase.from('solicitacoes').update({ status:'encerrada' }).eq('id', id)
    carregar()
  }

  const filtradas = itens.filter(i => filtroStatus === 'todas' || i.status === filtroStatus)
  const abertas = itens.filter(i => i.status === 'aberta').length
  const respondidas = itens.filter(i => i.status === 'respondida').length

  function exportar() {
    const dados = filtradas.map(s => ({
      Data: fmtDataHora(s.criado_em),
      Morador: s.morador_nome || '—',
      Solicitação: s.texto,
      Status: STATUS_LABEL[s.status],
      Resposta: s.resposta || '',
      'Respondida por': s.respondida_por || '',
      'Respondida em': fmtDataHora(s.respondida_em)
    }))
    exportarParaExcel(dados, `solicitacoes.xlsx`, 'Solicitações')
  }

  return (
    <div>
      <div className="page-title">Solicitações de Morador</div>
      <div className="page-sub">Canal de comunicação direto com a administração</div>

      <div className="stat-grid">
        <div className="stat"><div className="stat-n">{itens.length}</div><div className="stat-l">Total</div></div>
        <div className="stat"><div className="stat-n" style={{color:'var(--vermelho)'}}>{abertas}</div><div className="stat-l">Abertas</div></div>
        <div className="stat"><div className="stat-n" style={{color:'var(--azul)'}}>{respondidas}</div><div className="stat-l">Respondidas</div></div>
        <div className="stat"><div className="stat-n" style={{color:'var(--verde)'}}>{itens.filter(i=>i.status==='encerrada').length}</div><div className="stat-l">Encerradas</div></div>
      </div>

      <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
        <button className="btn btn-success" onClick={abrirNova}><i className="fa-solid fa-plus" style={{marginRight:6}}></i>Nova solicitação</button>
        <div style={{display:'flex',gap:4}}>
          {[['todas','Todas'],['aberta','Abertas'],['respondida','Respondidas'],['encerrada','Encerradas']].map(([v,l]) => (
            <button key={v} onClick={() => setFiltroStatus(v)} style={{
              padding:'5px 10px', borderRadius:6, fontSize:11,
              background: filtroStatus===v?'var(--azul)':'var(--cinza-bg)',
              color: filtroStatus===v?'#fff':'var(--texto-sec)',
              border:'none', cursor:'pointer'
            }}>{l}</button>
          ))}
        </div>
        <button className="btn btn-sm" onClick={exportar} style={{marginLeft:'auto'}}>
          <i className="fa-solid fa-file-excel" style={{marginRight:6}}></i>Exportar
        </button>
      </div>

      {filtradas.length === 0 && <div className="card" style={{textAlign:'center',color:'var(--texto-ter)'}}>Nenhuma solicitação</div>}

      {filtradas.map(s => (
        <div className={`card ${s.status==='aberta'?'card-vermelho':s.status==='respondida'?'card-azul':'card-verde'}`} key={s.id}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8,gap:8}}>
            <div>
              <div style={{fontWeight:500,fontSize:13}}>{s.morador_nome || '—'}</div>
              <div style={{fontSize:11,color:'var(--texto-sec)'}}>{fmtDataHora(s.criado_em)}</div>
            </div>
            <span className={`badge badge-${STATUS_BADGE[s.status]}`}>{STATUS_LABEL[s.status]}</span>
          </div>
          <div style={{fontSize:13, marginBottom:8, whiteSpace:'pre-wrap'}}>{s.texto}</div>
          {s.anexos && s.anexos.length > 0 && (
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
              {s.anexos.map((u,idx) => (
                <a key={idx} href={u} target="_blank" rel="noreferrer">
                  <img src={u} alt={`anexo ${idx+1}`} style={{width:60, height:60, objectFit:'cover', borderRadius:6, border:'0.5px solid var(--borda)'}}/>
                </a>
              ))}
            </div>
          )}
          {s.resposta && (
            <div style={{background:'var(--azul-bg)', borderLeft:'3px solid var(--azul)', padding:'8px 12px', borderRadius:'4px 8px 8px 4px', marginTop:8}}>
              <div style={{fontSize:11, color:'var(--azul)', fontWeight:500, marginBottom:4}}>
                <i className="fa-solid fa-reply" style={{marginRight:4}}></i>Resposta de {s.respondida_por} · {fmtDataHora(s.respondida_em)}
              </div>
              <div style={{fontSize:13, whiteSpace:'pre-wrap'}}>{s.resposta}</div>
            </div>
          )}
          {isAdmin && s.status !== 'encerrada' && (
            <div style={{display:'flex',gap:6, marginTop:10}}>
              <button className="btn btn-sm btn-primary" onClick={() => abrirResposta(s)}>
                <i className="fa-solid fa-reply" style={{marginRight:4}}></i>{s.resposta?'Editar resposta':'Responder'}
              </button>
              {s.status === 'respondida' && (
                <button className="btn btn-sm" onClick={() => encerrar(s.id)}>Encerrar</button>
              )}
            </div>
          )}
        </div>
      ))}

      {modal === 'nova' && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div className="modal">
            <h3>Nova solicitação</h3>
            <div className="form-group">
              <label>Sua mensagem para o síndico</label>
              <textarea value={form.texto||''} onChange={e => setForm({...form, texto:e.target.value})}
                style={{height:120}} placeholder="Descreva sua solicitação, dúvida ou sugestão..."/>
            </div>
            <div className="form-group">
              <label>Anexos (fotos)</label>
              <input type="file" accept="image/*" multiple onChange={e => setArquivos(Array.from(e.target.files))}/>
              {arquivos.length > 0 && <div style={{fontSize:11,color:'var(--texto-sec)',marginTop:4}}>{arquivos.length} arquivo(s) selecionado(s)</div>}
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:12}}>
              <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarNova} disabled={salvando}>{salvando?'Enviando...':'Enviar'}</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'responder' && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div className="modal">
            <h3>Responder solicitação</h3>
            <div style={{background:'var(--cinza-bg)', padding:'10px 14px', borderRadius:8, marginBottom:14, fontSize:12}}>
              <div style={{fontWeight:500,marginBottom:4}}>{form.morador_nome}</div>
              <div style={{whiteSpace:'pre-wrap'}}>{form.texto}</div>
            </div>
            <div className="form-group">
              <label>Sua resposta</label>
              <textarea value={form.resposta||''} onChange={e => setForm({...form, resposta:e.target.value})}
                style={{height:120}} autoFocus/>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:12}}>
              <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarResposta} disabled={salvando}>{salvando?'Salvando...':'Enviar resposta'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

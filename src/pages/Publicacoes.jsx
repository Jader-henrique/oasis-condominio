import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { exportarParaExcel } from '../utils/excel'
import ViewModal from './ViewModal'

const TIPOS = ['Ata','Projeto','Plano','Contrato','Comunicado','Outro']

function fmtData(d) {
  if (!d) return '—'
  const s = String(d).slice(0,10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const [y,m,day] = s.split('-')
  return `${day}/${m}/${y}`
}

export default function Publicacoes({ perfil }) {
  const [itens, setItens] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [arquivo, setArquivo] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [verItem, setVerItem] = useState(null)
  const isAdmin = perfil?.perfil === 'admin' || perfil?.perfil === 'sindico'

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data } = await supabase.from('publicacoes').select('*').order('criado_em', { ascending: false })
    setItens(data || [])
  }

  function abrirNovo() {
    setForm({ titulo:'', tipo:'Ata', data:new Date().toISOString().slice(0,10) })
    setArquivo(null)
    setModal('novo')
  }

  function abrirEditar(item) {
    setForm({ ...item })
    setArquivo(null)
    setModal('editar')
  }

  async function excluir(item) {
    if (!confirm(`Excluir publicação "${item.titulo}"?`)) return
    try {
      const r = await supabase.from('publicacoes').delete().eq('id', item.id)
      if (r.error) throw r.error
      carregar()
    } catch (e) {
      alert('Erro ao excluir: ' + (e?.message || JSON.stringify(e)))
    }
  }

  async function salvar() {
    if (!form.titulo) { alert('Informe o título'); return }
    setSalvando(true)
    try {
      let arquivo_url = form.arquivo_url || ''
      if (arquivo) {
        const ext = arquivo.name.split('.').pop()
        const path = `publicacoes/${Date.now()}.${ext}`
        const upRes = await supabase.storage.from('documentos').upload(path, arquivo)
        if (upRes.error) throw upRes.error
        const { data: u } = supabase.storage.from('documentos').getPublicUrl(path)
        arquivo_url = u.publicUrl
      }
      // Payload defensivo
      const payload = { arquivo_url }
      Object.keys(form).forEach(k => {
        const v = form[k]
        if (v === undefined) return
        if (v === '' && !['titulo'].includes(k)) return
        payload[k] = v
      })
      let result
      if (modal === 'novo') {
        delete payload.id
        result = await supabase.from('publicacoes').insert([payload])
      } else {
        const { id, ...resto } = payload
        result = await supabase.from('publicacoes').update(resto).eq('id', id)
      }
      if (result.error) throw result.error
      setSalvando(false); setModal(null); carregar()
    } catch (e) {
      setSalvando(false)
      alert('Erro ao salvar: ' + (e?.message || JSON.stringify(e)))
    }
  }

  function exportar() {
    const dados = itens.map(p => ({
      Título: p.titulo,
      Tipo: p.tipo,
      Data: fmtData(p.data),
      Arquivo: p.arquivo_url || ''
    }))
    exportarParaExcel(dados, 'publicacoes.xlsx', 'Publicações')
  }

  return (
    <div>
      <div className="page-title">Publicações</div>
      <div className="page-sub">Atas, aprovações, projetos e documentos do condomínio</div>

      <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
        {isAdmin && <button className="btn btn-success" onClick={abrirNovo}>+ Adicionar publicação</button>}
        <button className="btn btn-sm" onClick={exportar}><i className="fa-solid fa-file-excel" style={{marginRight:6}}></i>Exportar Excel</button>
      </div>

      {itens.length === 0 && <div className="card" style={{textAlign:'center',color:'var(--texto-ter)'}}>Nenhuma publicação</div>}

      {itens.map(p => (
        <div className="card card-azul" key={p.id} onDoubleClick={() => setVerItem(p)} style={{cursor:'pointer'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontWeight:500,fontSize:13}}>{p.titulo}</div>
              <div style={{fontSize:11,color:'var(--texto-sec)',marginTop:4}}>
                {fmtData(p.data)} ·{' '}
                <span style={{background:'var(--cinza-bg)',padding:'2px 6px',borderRadius:4,fontSize:10}}>{p.tipo}</span>
              </div>
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              {p.arquivo_url && (
                <a href={p.arquivo_url} target="_blank" rel="noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{fontSize:12,color:'var(--azul)'}}>
                  <i className="fa-solid fa-paperclip" style={{marginRight:4}}></i>Abrir
                </a>
              )}
              {isAdmin && <>
                <button className="btn btn-sm" onClick={e => { e.stopPropagation(); abrirEditar(p) }}>Editar</button>
                <button className="btn btn-sm btn-danger" title="Excluir" onClick={e => { e.stopPropagation(); excluir(p) }}>
                  <i className="fa-solid fa-trash"></i>
                </button>
              </>}
            </div>
          </div>
        </div>
      ))}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div className="modal">
            <h3>{modal==='novo' ? 'Nova publicação' : 'Editar publicação'}</h3>
            <div className="form-group"><label>Título</label><input value={form.titulo||''} onChange={e => setForm({...form,titulo:e.target.value})}/></div>
            <div className="form-group">
              <label>Tipo</label>
              <select value={form.tipo||'Ata'} onChange={e => setForm({...form,tipo:e.target.value})}>
                {TIPOS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Data</label>
              <input type="date" value={form.data ? String(form.data).slice(0,10) : ''} onChange={e => setForm({...form,data:e.target.value || null})}/>
            </div>
            <div className="form-group">
              <label>Arquivo (PDF, imagem, planilha, doc)</label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.docx" onChange={e => setArquivo(e.target.files[0])}/>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:12}}>
              <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando?'Salvando...':'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {verItem && (
        <ViewModal
          titulo={verItem.titulo}
          subtitulo={`Publicação · ${verItem.tipo}`}
          corBorda="var(--azul)"
          onFechar={() => setVerItem(null)}
          onEditar={isAdmin ? () => { abrirEditar(verItem); setVerItem(null) } : null}
          campos={[
            { label:'Título',  valor:verItem.titulo },
            { label:'Tipo',    valor:verItem.tipo },
            { label:'Data',    valor:verItem.data, tipo:'data' },
            { label:'Arquivo', valor:verItem.arquivo_url ? 'Anexado' : '—' },
            { label:'Cadastrado em', valor:verItem.criado_em, tipo:'datahora' },
          ]}
        />
      )}
    </div>
  )
}

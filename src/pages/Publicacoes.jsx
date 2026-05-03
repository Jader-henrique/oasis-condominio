import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const TIPOS = ['Ata','Projeto','Plano','Contrato','Comunicado','Outro']

export default function Publicacoes({ perfil }) {
  const [itens, setItens] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [arquivo, setArquivo] = useState(null)
  const isAdmin = perfil?.perfil === 'admin'

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data } = await supabase.from('publicacoes').select('*').order('criado_em', { ascending: false })
    setItens(data || [])
  }

  function abrirNovo() {
    setForm({ titulo:'', tipo:'Ata', data:'' })
    setArquivo(null)
    setModal('novo')
  }

  function abrirEditar(item) {
    setForm({ ...item })
    setArquivo(null)
    setModal('editar')
  }

  async function salvar() {
    let arquivo_url = form.arquivo_url || ''
    if (arquivo) {
      const ext = arquivo.name.split('.').pop()
      const path = `publicacoes/${Date.now()}.${ext}`
      await supabase.storage.from('documentos').upload(path, arquivo)
      const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path)
      arquivo_url = urlData.publicUrl
    }
    const payload = { ...form, arquivo_url }
    if (modal === 'novo') {
      await supabase.from('publicacoes').insert([payload])
    } else {
      const { id, ...resto } = payload
      await supabase.from('publicacoes').update(resto).eq('id', id)
    }
    setModal(null)
    carregar()
  }

  return (
    <div>
      <div className="page-title">Publicações</div>
      <div className="page-sub">Atas, aprovações, projetos e documentos do condomínio</div>
      {isAdmin && <button className="btn btn-success" style={{marginBottom:12}} onClick={abrirNovo}>+ Adicionar publicação</button>}

      {itens.map(p => (
        <div className="card card-azul" key={p.id}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontWeight:500,fontSize:13}}>{p.titulo}</div>
              <div style={{fontSize:11,color:'var(--texto-sec)',marginTop:4}}>
                {p.data} ·{' '}
                <span style={{background:'var(--cinza-bg)',padding:'2px 6px',borderRadius:4,fontSize:10}}>{p.tipo}</span>
              </div>
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              {p.arquivo_url && (
                <a href={p.arquivo_url} target="_blank" rel="noreferrer"
                  style={{fontSize:12,color:'var(--azul)'}}>
                  <i className="fa-solid fa-paperclip" style={{marginRight:4}}></i> Abrir
                </a>
              )}
              {isAdmin && <button className="btn btn-sm" onClick={() => abrirEditar(p)}>Editar</button>}
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
            <div className="form-group"><label>Data</label><input value={form.data||''} onChange={e => setForm({...form,data:e.target.value})}/></div>
            <div className="form-group">
              <label>Arquivo (PDF, imagem)</label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.docx" onChange={e => setArquivo(e.target.files[0])}/>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:12}}>
              <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvar}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
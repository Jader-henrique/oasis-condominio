import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

const TIPOS = {
  atividade:   { tabela:'calendario',   label:'Atividade',   campoNome:'descricao', cor:'var(--azul)' },
  corretiva:   { tabela:'corretivas',   label:'Corretiva',   campoNome:'item',      cor:'var(--vermelho)' },
  benfeitoria: { tabela:'benfeitorias', label:'Benfeitoria', campoNome:'sistema',   cor:'var(--lilas)' }
}

function hojeISO() { return new Date().toISOString().slice(0,10) }

export default function AppVistorias({ perfil }) {
  const [tarefas, setTarefas] = useState([])
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [arquivos, setArquivos] = useState([])
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const inputRef = useRef()

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const [a, c, b] = await Promise.all([
      supabase.from('calendario').select('*'),
      supabase.from('corretivas').select('*'),
      supabase.from('benfeitorias').select('*'),
    ])
    const lista = []
    ;(a.data || []).forEach(i => lista.push({ _origem:'atividade', _id:i.id, _nome:i.descricao, _resp:i.responsavel_tipo, _feita: i.status==='realizado', ...i }))
    ;(c.data || []).forEach(i => lista.push({ _origem:'corretiva', _id:i.id, _nome:i.item, _resp:i.responsavel_tipo, _feita: i.status==='realizado', ...i }))
    ;(b.data || []).forEach(i => lista.push({ _origem:'benfeitoria', _id:i.id, _nome:i.sistema, _resp:i.responsavel_tipo, _feita: !!i.realizado, ...i }))
    setTarefas(lista)
  }

  function abrirItem(t) {
    setForm({ ...t, obs:'', conformidade:'ok' })
    setArquivos([]); setSucesso(false); setModal('vistoria')
  }

  async function uploadFotos() {
    const urls = []
    for (const arq of arquivos) {
      const path = `vistorias/${Date.now()}_${arq.name}`
      await supabase.storage.from('evidencias').upload(path, arq)
      const { data: u } = supabase.storage.from('evidencias').getPublicUrl(path)
      urls.push(u.publicUrl)
    }
    return urls
  }

  async function registrarVistoria() {
    setSalvando(true)
    const urls = await uploadFotos()
    const obsCompleto = `[VISTORIA ${form.conformidade==='ok'?'Conforme':'NÃO conforme'}] ${form.obs||''}`.trim()
    await supabase.from('diario').insert([{
      data: hojeISO(), ref: String(form._id), sistema: `Vistoria — ${form._nome}`,
      empresa: perfil?.nome || 'Vistoria',
      obs: obsCompleto,
      evidencia_url: urls[0] || '', evidencias_urls: urls,
      item_tipo: form._origem, item_id: form._id
    }])
    setSalvando(false); setSucesso(true)
    setTimeout(() => { setModal(null); setSucesso(false) }, 1500)
  }

  const filtradas = tarefas.filter(t => filtroTipo === 'todos' || t._origem === filtroTipo)
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' })

  return (
    <div style={{maxWidth:480, margin:'0 auto', paddingBottom:80}}>
      <div style={{background:'var(--lilas)', color:'#fff', padding:'18px 20px 16px'}}>
        <div style={{fontSize:11, opacity:0.7, marginBottom:4, textTransform:'capitalize'}}>{hoje}</div>
        <div style={{fontSize:18, fontWeight:500}}>Vistorias — {perfil?.nome || 'Síndico'}</div>
        <div style={{fontSize:12, opacity:0.85, marginTop:4}}>Registre in-loco a checagem dos serviços</div>
      </div>

      <div style={{padding:'16px'}}>
        <div style={{display:'flex', gap:6, marginBottom:14, flexWrap:'wrap'}}>
          {[
            {v:'todos', l:'Todos'},
            {v:'atividade', l:'Atividades'},
            {v:'corretiva', l:'Corretivas'},
            {v:'benfeitoria', l:'Benfeitorias'},
          ].map(o => (
            <button key={o.v} onClick={() => setFiltroTipo(o.v)} style={{
              padding:'6px 12px', borderRadius:8, fontSize:12,
              background: filtroTipo===o.v ? 'var(--lilas)' : 'var(--cinza-bg)',
              color: filtroTipo===o.v ? '#fff' : 'var(--texto-sec)',
              border: 'none', cursor:'pointer'
            }}>{o.l}</button>
          ))}
        </div>

        {filtradas.length === 0 && <div style={{textAlign:'center', padding:40, color:'var(--texto-ter)'}}>Nenhum item</div>}

        {filtradas.map(t => {
          const cfg = TIPOS[t._origem]
          return (
            <div key={`${t._origem}-${t._id}`} onClick={() => abrirItem(t)} style={{
              background:'var(--branco)', border:'0.5px solid var(--borda)',
              borderTop: '3px solid ' + cfg.cor,
              borderRadius:12, padding:'13px 14px', marginBottom:8, cursor:'pointer'
            }}>
              <div style={{fontSize:10, color:cfg.cor, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:3, fontWeight:500}}>
                {cfg.label} · {t._resp || '—'}
              </div>
              <div style={{fontWeight:500, fontSize:13}}>{t._nome}</div>
              {t._feita && <div style={{fontSize:11, color:'var(--verde)', marginTop:3}}><i className="fa-solid fa-check" style={{marginRight:3}}></i>Já executado</div>}
            </div>
          )
        })}
      </div>

      {modal && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'flex-end', zIndex:300}}
          onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div style={{background:'var(--branco)', borderRadius:'20px 20px 0 0', padding:'24px 20px 32px', width:'100%', maxHeight:'92vh', overflowY:'auto'}}>
            {sucesso ? (
              <div style={{textAlign:'center', padding:'32px 0'}}>
                <div style={{width:64, height:64, borderRadius:'50%', background:'var(--lilas-bg)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px'}}>
                  <i className="fa-solid fa-clipboard-check" style={{color:'var(--lilas)', fontSize:28}}></i>
                </div>
                <div style={{fontSize:17, fontWeight:500, color:'var(--lilas)'}}>Vistoria registrada!</div>
              </div>
            ) : (
              <>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20}}>
                  <div style={{flex:1, paddingRight:12}}>
                    <div style={{fontSize:11, color:TIPOS[form._origem]?.cor, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:3, fontWeight:500}}>
                      {TIPOS[form._origem]?.label}
                    </div>
                    <div style={{fontWeight:500, fontSize:15}}>{form._nome}</div>
                  </div>
                  <button onClick={() => setModal(null)} style={{background:'var(--cinza-bg)', border:'none', borderRadius:'50%', width:32, height:32, fontSize:20, cursor:'pointer'}}>×</button>
                </div>

                <div className="form-group">
                  <label>Resultado da vistoria</label>
                  <div style={{display:'flex', gap:8}}>
                    <button type="button" onClick={() => setForm({...form, conformidade:'ok'})}
                      style={{flex:1, padding:'12px', borderRadius:10, fontSize:13, fontWeight:500,
                        background: form.conformidade==='ok' ? 'var(--verde)' : 'var(--cinza-bg)',
                        color: form.conformidade==='ok' ? '#fff' : 'var(--texto-sec)',
                        border:'none', cursor:'pointer'}}>
                      <i className="fa-solid fa-check" style={{marginRight:6}}></i>Conforme
                    </button>
                    <button type="button" onClick={() => setForm({...form, conformidade:'nok'})}
                      style={{flex:1, padding:'12px', borderRadius:10, fontSize:13, fontWeight:500,
                        background: form.conformidade==='nok' ? 'var(--vermelho)' : 'var(--cinza-bg)',
                        color: form.conformidade==='nok' ? '#fff' : 'var(--texto-sec)',
                        border:'none', cursor:'pointer'}}>
                      <i className="fa-solid fa-xmark" style={{marginRight:6}}></i>Não conforme
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Observações</label>
                  <textarea value={form.obs||''} onChange={e => setForm({...form, obs:e.target.value})} placeholder="Detalhes da vistoria..." style={{height:80}}/>
                </div>

                <div style={{marginBottom:16}}>
                  <label style={{display:'block', fontSize:12, color:'var(--texto-sec)', marginBottom:8}}>Fotos</label>
                  <div onClick={() => inputRef.current.click()}
                    style={{border:'1.5px dashed var(--borda)', borderRadius:10, padding:'22px', textAlign:'center', cursor:'pointer', background:'var(--cinza-bg)'}}>
                    <div style={{fontSize:32, marginBottom:6, color:'var(--texto-sec)'}}><i className="fa-solid fa-camera"></i></div>
                    <div style={{fontSize:13, color:'var(--texto-sec)'}}>
                      {arquivos.length > 0 ? `${arquivos.length} foto(s)` : 'Tirar/selecionar fotos'}
                    </div>
                  </div>
                  <input ref={inputRef} type="file" accept="image/*" multiple capture="environment" style={{display:'none'}} onChange={e => setArquivos(Array.from(e.target.files))}/>
                </div>

                <button onClick={registrarVistoria} disabled={salvando}
                  style={{width:'100%', padding:'15px', background: salvando ? 'var(--cinza)' : 'var(--lilas)', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:500, cursor: salvando?'default':'pointer'}}>
                  {salvando ? 'Salvando...' : 'Registrar vistoria'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

const TIPOS = {
  atividade:   { tabela:'calendario',   label:'Atividade',   campoNome:'descricao', cor:'var(--azul)' },
  corretiva:   { tabela:'corretivas',   label:'Corretiva',   campoNome:'item',      cor:'var(--vermelho)' },
  benfeitoria: { tabela:'benfeitorias', label:'Benfeitoria', campoNome:'sistema',   cor:'var(--lilas)' }
}

const DIAS_FREQ = {
  'Diário':1, 'Semanal':7, 'Quinzenal':15, 'Mensal':30,
  'Bimestral':60, 'Trimestral':90, 'Semestral':180, 'Anual':365,
  'A Cada 2 Anos':730, 'A Cada 3 Anos':1095, 'A Cada 5 Anos':1825
}

function hojeISO() { return new Date().toISOString().slice(0,10) }
function addDias(iso, dias) {
  const d = new Date(iso); d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0,10)
}

export default function AppZelador({ perfil }) {
  const [tarefas, setTarefas] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [arquivos, setArquivos] = useState([])
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const inputRef = useRef()

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const [a, c, b] = await Promise.all([
      supabase.from('calendario').select('*').eq('responsavel_tipo','Zeladoria').is('excluido_em', null),
      supabase.from('corretivas').select('*').eq('responsavel_tipo','Zeladoria').is('excluido_em', null),
      supabase.from('benfeitorias').select('*').eq('responsavel_tipo','Zeladoria').is('excluido_em', null),
    ])
    const lista = []
    ;(a.data || []).forEach(i => lista.push({ _origem:'atividade', _id:i.id, _nome:i.descricao, _data:i.proxima_data, _frequencia:i.frequencia, _feita: i.status==='realizado', ...i }))
    ;(c.data || []).forEach(i => lista.push({ _origem:'corretiva', _id:i.id, _nome:i.item, _data:i.data_inicio, _feita: i.status==='realizado', ...i }))
    ;(b.data || []).forEach(i => lista.push({ _origem:'benfeitoria', _id:i.id, _nome:i.sistema, _data:i.previsto, _feita: !!i.realizado, ...i }))
    setTarefas(lista)
  }

  function abrirTarefa(t) {
    setForm({ ...t, obs:'' })
    setArquivos([]); setSucesso(false); setModal('tarefa')
  }
  function abrirAvulso() {
    setForm({ _origem:null, _nome:'', obs:'' })
    setArquivos([]); setSucesso(false); setModal('avulso')
  }

  async function uploadFotos() {
    const urls = []
    for (const arq of arquivos) {
      const path = `diario/${Date.now()}_${arq.name}`
      await supabase.storage.from('evidencias').upload(path, arq)
      const { data: u } = supabase.storage.from('evidencias').getPublicUrl(path)
      urls.push(u.publicUrl)
    }
    return urls
  }

  async function marcarRealizado() {
    setSalvando(true)
    const urls = await uploadFotos()
    const hoje = hojeISO()
    // Atualiza item na tabela origem
    if (form._origem === 'atividade') {
      // Pontual não recalcula proxima_data
      const ehPontual = !!form.pontual
      const dias = ehPontual ? null : DIAS_FREQ[form._frequencia]
      const proxima = dias ? addDias(hoje, dias) : null
      const updateAt = {
        status:'realizado', realizado_em:new Date().toISOString(),
        realizado_por: perfil?.nome || 'Zelador',
        evidencia_url: urls[0] || form.evidencia_url || ''
      }
      if (!ehPontual) updateAt.proxima_data = proxima
      await supabase.from('calendario').update(updateAt).eq('id', form._id)
    } else if (form._origem === 'corretiva') {
      await supabase.from('corretivas').update({ status:'realizado', data_fim: hoje }).eq('id', form._id)
    } else if (form._origem === 'benfeitoria') {
      await supabase.from('benfeitorias').update({ realizado: hoje }).eq('id', form._id)
    }
    // Sempre alimenta o diário
    await supabase.from('diario').insert([{
      data: hoje, ref: String(form._id), sistema: form._nome,
      empresa: perfil?.nome || 'Zelador', obs: form.obs || '',
      evidencia_url: urls[0] || '', evidencias_urls: urls,
      item_tipo: form._origem, item_id: form._id
    }])
    setSalvando(false); setSucesso(true); carregar()
    setTimeout(() => { setModal(null); setSucesso(false) }, 1500)
  }

  async function registrarAvulso() {
    setSalvando(true)
    const urls = await uploadFotos()
    await supabase.from('diario').insert([{
      data: hojeISO(), ref: form._nome, sistema: form._nome,
      empresa: perfil?.nome || 'Zelador', obs: form.obs || '',
      evidencia_url: urls[0] || '', evidencias_urls: urls
    }])
    setSalvando(false); setSucesso(true)
    setTimeout(() => { setModal(null); setSucesso(false) }, 1500)
  }

  const pendentes = tarefas.filter(t => !t._feita)
  const feitas    = tarefas.filter(t =>  t._feita)
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' })

  function CardTarefa({ t }) {
    const cfg = TIPOS[t._origem]
    return (
      <div onClick={() => abrirTarefa(t)} style={{
        background: t._feita ? 'var(--verde-bg)' : 'var(--branco)',
        border: '0.5px solid ' + (t._feita ? '#97C459' : 'var(--borda)'),
        borderTop: '3px solid ' + (t._feita ? 'var(--verde)' : cfg.cor),
        borderRadius:12, padding:'13px 14px', marginBottom:8, cursor:'pointer',
        display:'flex', justifyContent:'space-between', alignItems:'center'
      }}>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:10, color:cfg.cor, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:3, fontWeight:500}}>{cfg.label}</div>
          <div style={{fontWeight:500, fontSize:13, color: t._feita ? 'var(--verde)' : 'var(--texto)'}}>{t._nome}</div>
          {t._frequencia && <div style={{fontSize:11, color:'var(--texto-sec)', marginTop:3}}>{t._frequencia}</div>}
        </div>
        <div style={{
          width:28, height:28, borderRadius:'50%', flexShrink:0, marginLeft:12,
          background: t._feita ? 'var(--verde)' : 'transparent',
          border: t._feita ? 'none' : '2px solid var(--borda)',
          display:'flex', alignItems:'center', justifyContent:'center'
        }}>
          {t._feita && <i className="fa-solid fa-check" style={{color:'#fff', fontSize:12}}></i>}
        </div>
      </div>
    )
  }

  return (
    <div style={{maxWidth:480, margin:'0 auto', paddingBottom:80}}>
      <div style={{background:'var(--azul)', color:'#fff', padding:'18px 20px 16px'}}>
        <div style={{fontSize:11, opacity:0.7, marginBottom:4, textTransform:'capitalize'}}>{hoje}</div>
        <div style={{fontSize:18, fontWeight:500}}>Olá, {perfil?.nome || 'Zelador'}</div>
        <div style={{display:'flex', gap:12, marginTop:14}}>
          <div style={{background:'rgba(255,255,255,0.15)', borderRadius:10, padding:'10px 14px', flex:1, textAlign:'center'}}>
            <div style={{fontSize:22, fontWeight:500}}>{pendentes.length}</div>
            <div style={{fontSize:11, opacity:0.8, marginTop:2}}>pendentes</div>
          </div>
          <div style={{background:'rgba(255,255,255,0.15)', borderRadius:10, padding:'10px 14px', flex:1, textAlign:'center'}}>
            <div style={{fontSize:22, fontWeight:500}}>{feitas.length}</div>
            <div style={{fontSize:11, opacity:0.8, marginTop:2}}>realizadas</div>
          </div>
        </div>
      </div>

      <div style={{padding:'16px'}}>
        {pendentes.length > 0 && (
          <>
            <div style={{fontSize:11, color:'var(--vermelho)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8, fontWeight:500}}>Pendentes ({pendentes.length})</div>
            {pendentes.map(t => <CardTarefa key={`${t._origem}-${t._id}`} t={t}/>)}
          </>
        )}
        {feitas.length > 0 && (
          <>
            <div style={{fontSize:11, color:'var(--verde)', textTransform:'uppercase', letterSpacing:'0.05em', margin:'14px 0 8px', fontWeight:500}}>Realizadas ({feitas.length})</div>
            {feitas.map(t => <CardTarefa key={`${t._origem}-${t._id}`} t={t}/>)}
          </>
        )}

        <div onClick={abrirAvulso} style={{border:'1.5px dashed var(--borda)', borderRadius:12, padding:'14px 16px', cursor:'pointer', textAlign:'center', marginTop:8}}>
          <div style={{fontWeight:500, fontSize:13}}>+ Registrar manutenção avulsa</div>
          <div style={{fontSize:11, color:'var(--texto-sec)', marginTop:2}}>Algo fora do calendário</div>
        </div>
      </div>

      {modal && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'flex-end', zIndex:300}}
          onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div style={{background:'var(--branco)', borderRadius:'20px 20px 0 0', padding:'24px 20px 32px', width:'100%', maxHeight:'92vh', overflowY:'auto'}}>
            {sucesso ? (
              <div style={{textAlign:'center', padding:'32px 0'}}>
                <div style={{width:64, height:64, borderRadius:'50%', background:'var(--verde-bg)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px'}}>
                  <i className="fa-solid fa-check" style={{color:'var(--verde)', fontSize:28}}></i>
                </div>
                <div style={{fontSize:17, fontWeight:500, color:'var(--verde)'}}>Registrado!</div>
              </div>
            ) : (
              <>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20}}>
                  <div style={{flex:1, paddingRight:12}}>
                    <div style={{fontWeight:500, fontSize:15}}>
                      {modal==='avulso' ? 'Registrar manutenção avulsa' : form._nome}
                    </div>
                    {modal==='tarefa' && form._origem && (
                      <div style={{fontSize:11, color:TIPOS[form._origem].cor, textTransform:'uppercase', letterSpacing:'0.05em', marginTop:3, fontWeight:500}}>
                        {TIPOS[form._origem].label}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setModal(null)} style={{background:'var(--cinza-bg)', border:'none', borderRadius:'50%', width:32, height:32, fontSize:20, cursor:'pointer'}}>×</button>
                </div>

                {modal==='avulso' && (
                  <div className="form-group">
                    <label>O que foi feito</label>
                    <input value={form._nome||''} onChange={e => setForm({...form, _nome:e.target.value})} placeholder="Descreva..."/>
                  </div>
                )}

                <div className="form-group">
                  <label>Observação</label>
                  <textarea value={form.obs||''} onChange={e => setForm({...form, obs:e.target.value})} placeholder="Detalhes..." style={{height:72}}/>
                </div>

                <div style={{marginBottom:16}}>
                  <label style={{display:'block', fontSize:12, color:'var(--texto-sec)', marginBottom:8}}>Fotos</label>
                  <div onClick={() => inputRef.current.click()}
                    style={{border:'1.5px dashed var(--borda)', borderRadius:10, padding:'22px', textAlign:'center', cursor:'pointer', background:'var(--cinza-bg)'}}>
                    <div style={{fontSize:32, marginBottom:6, color:'var(--texto-sec)'}}><i className="fa-solid fa-camera"></i></div>
                    <div style={{fontSize:13, color:'var(--texto-sec)'}}>
                      {arquivos.length > 0 ? `${arquivos.length} foto(s) selecionada(s)` : 'Toque para tirar/selecionar fotos'}
                    </div>
                  </div>
                  <input ref={inputRef} type="file" accept="image/*" multiple capture="environment" style={{display:'none'}} onChange={e => setArquivos(Array.from(e.target.files))}/>
                </div>

                <button onClick={modal==='avulso' ? registrarAvulso : marcarRealizado} disabled={salvando}
                  style={{width:'100%', padding:'15px', background: salvando ? 'var(--cinza)' : 'var(--verde)', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:500, cursor: salvando?'default':'pointer'}}>
                  {salvando ? 'Salvando...' : modal==='avulso' ? 'Registrar' : 'Marcar como realizado'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

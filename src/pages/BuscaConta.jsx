import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const GRUPOS = ['Atividades do Dia a Dia','Intervenções Corretivas','Benfeitorias']

/**
 * Modal de busca/criação de Contas.
 * Props:
 *   grupoFixo?: string — pré-filtra por grupo (ex: 'Benfeitorias')
 *   onSelect: (conta) => void
 *   onCancelar: () => void
 */
export default function BuscaConta({ grupoFixo, onSelect, onCancelar }) {
  const [contas, setContas] = useState([])
  const [busca, setBusca] = useState('')
  const [criando, setCriando] = useState(false)
  const [novaConta, setNovaConta] = useState({ descricao:'', grupo_orcamentario: grupoFixo || GRUPOS[0], codigo_contabil:'' })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    let q = supabase.from('contas').select('*').is('excluido_em', null).order('descricao')
    if (grupoFixo) q = q.eq('grupo_orcamentario', grupoFixo)
    const { data } = await q
    setContas(data || [])
  }

  const filtrados = contas.filter(c => {
    const k = busca.toLowerCase()
    return String(c.descricao||'').toLowerCase().includes(k) ||
           String(c.codigo_contabil||'').toLowerCase().includes(k)
  })

  async function salvarNova() {
    if (!novaConta.descricao.trim()) { alert('Informe a descrição'); return }
    setSalvando(true)
    try {
      const { data, error } = await supabase.from('contas').insert([novaConta]).select().single()
      if (error) throw error
      onSelect(data)
    } catch (e) {
      alert('Erro ao criar conta: ' + (e?.message || JSON.stringify(e)))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onCancelar()}>
      <div className="modal" style={{width:560, maxWidth:'95vw'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <h3 style={{margin:0}}>Selecionar conta {grupoFixo && <span style={{fontSize:11,color:'var(--texto-ter)',fontWeight:400}}>({grupoFixo})</span>}</h3>
          <button onClick={onCancelar} style={{background:'var(--cinza-bg)',border:'none',borderRadius:'50%',width:30,height:30,fontSize:18,cursor:'pointer'}}>×</button>
        </div>

        {!criando ? (
          <>
            <input autoFocus placeholder="Buscar por descrição ou código contábil..."
              value={busca} onChange={e => setBusca(e.target.value)}
              style={{width:'100%', padding:'10px', borderRadius:8, border:'0.5px solid var(--borda)', marginBottom:8}}/>

            <div style={{maxHeight:340, overflowY:'auto', border:'0.5px solid var(--borda)', borderRadius:8, marginBottom:10}}>
              {filtrados.length === 0 && (
                <div style={{padding:'16px', fontSize:12, color:'var(--texto-ter)', textAlign:'center'}}>Nenhuma conta encontrada</div>
              )}
              {filtrados.map(c => (
                <div key={c.id} onClick={() => onSelect(c)}
                  style={{padding:'10px 12px', fontSize:13, cursor:'pointer', borderBottom:'0.5px solid var(--borda)'}}
                  onMouseEnter={e => e.currentTarget.style.background='var(--cinza-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <div style={{display:'flex', justifyContent:'space-between', gap:8, alignItems:'center'}}>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:500}}>{c.descricao}</div>
                      <div style={{fontSize:10, color:'var(--texto-ter)', marginTop:2}}>
                        {c.grupo_orcamentario}{c.codigo_contabil ? ` · ${c.codigo_contabil}` : ''}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button className="btn btn-sm" onClick={() => setCriando(true)}>
              <i className="fa-solid fa-plus" style={{marginRight:6}}></i>Nova conta
            </button>
          </>
        ) : (
          <>
            <div style={{fontSize:13,fontWeight:500,marginBottom:10}}>Nova conta</div>
            <div className="form-group">
              <label>Descrição</label>
              <input autoFocus value={novaConta.descricao}
                onChange={e => setNovaConta({...novaConta, descricao:e.target.value})}/>
            </div>
            <div className="form-group">
              <label>Grupo orçamentário</label>
              <select value={novaConta.grupo_orcamentario}
                onChange={e => setNovaConta({...novaConta, grupo_orcamentario:e.target.value})}
                disabled={!!grupoFixo}
                style={grupoFixo ? {background:'var(--cinza-bg)',color:'var(--texto-sec)'} : undefined}>
                {GRUPOS.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Código contábil <span style={{fontSize:11,color:'var(--texto-ter)'}}>(opcional)</span></label>
              <input value={novaConta.codigo_contabil}
                onChange={e => setNovaConta({...novaConta, codigo_contabil:e.target.value})}
                placeholder="Ex: 3.1.01.001"/>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:12}}>
              <button className="btn" onClick={() => setCriando(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarNova} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar e selecionar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

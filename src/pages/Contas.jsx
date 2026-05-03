import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { exportarParaExcel } from '../utils/excel'
import ViewModal from './ViewModal'
import { useSort, SortableTh } from '../utils/useSort'

const GRUPOS = ['Atividades do Dia a Dia','Intervenções Corretivas','Benfeitorias']
const CORES_GRUPO = {
  'Atividades do Dia a Dia': { bg:'var(--azul-bg)', cor:'var(--azul)' },
  'Intervenções Corretivas': { bg:'var(--vermelho-bg)', cor:'var(--vermelho)' },
  'Benfeitorias':            { bg:'var(--lilas-bg)', cor:'var(--lilas)' },
}

function fmtDataHora(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' }) } catch { return '—' }
}

export default function Contas({ perfil }) {
  const [itens, setItens] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [verItem, setVerItem] = useState(null)
  const [filtroGrupo, setFiltroGrupo] = useState('Todos')
  const [busca, setBusca] = useState('')
  const isAdmin = perfil?.perfil === 'admin' || perfil?.perfil === 'sindico'
  const { sortBy, sortDir, onSort, ordenar } = useSort('descricao', 'asc')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data } = await supabase.from('contas').select('*').is('excluido_em', null).order('descricao')
    setItens(data || [])
  }

  function abrirNovo() {
    setForm({ descricao:'', grupo_orcamentario:GRUPOS[0], codigo_contabil:'' })
    setModal('novo')
  }
  function abrirEditar(item) {
    setForm({ ...item })
    setModal('editar')
  }
  async function salvar() {
    if (!form.descricao?.trim()) { alert('Informe a descrição'); return }
    if (!form.grupo_orcamentario) { alert('Selecione o grupo orçamentário'); return }
    try {
      const payload = {
        descricao: form.descricao.trim(),
        grupo_orcamentario: form.grupo_orcamentario,
        codigo_contabil: form.codigo_contabil?.trim() || null
      }
      let result
      if (modal === 'novo') {
        result = await supabase.from('contas').insert([payload])
      } else {
        result = await supabase.from('contas').update(payload).eq('id', form.id)
      }
      if (result.error) throw result.error
      setModal(null); carregar()
    } catch (e) {
      alert('Erro ao salvar: ' + (e?.message || JSON.stringify(e)))
    }
  }

  async function excluir(item) {
    if (!confirm(`Excluir conta "${item.descricao}"? Itens vinculados não serão afetados.`)) return
    try {
      const r = await supabase.from('contas').update({ excluido_em: new Date().toISOString() }).eq('id', item.id)
      if (r.error) throw r.error
      carregar()
    } catch (e) {
      alert('Erro ao excluir: ' + (e?.message || JSON.stringify(e)))
    }
  }

  const itensFiltrados = itens.filter(c => {
    if (filtroGrupo !== 'Todos' && c.grupo_orcamentario !== filtroGrupo) return false
    if (busca) {
      const k = busca.toLowerCase()
      const txt = (c.descricao||'') + ' ' + (c.codigo_contabil||'')
      if (!txt.toLowerCase().includes(k)) return false
    }
    return true
  })

  const total = itens.length
  const porGrupo = (g) => itens.filter(c => c.grupo_orcamentario === g).length

  function exportar() {
    const dados = itensFiltrados.map(c => ({
      ID: c.id,
      Descrição: c.descricao,
      'Grupo Orçamentário': c.grupo_orcamentario,
      'Código Contábil': c.codigo_contabil || '',
      'Cadastrada em': fmtDataHora(c.criado_em)
    }))
    exportarParaExcel(dados, 'contas.xlsx', 'Contas')
  }

  const btnFiltro = (ativo, onClick, label) => (
    <button onClick={onClick} style={{
      padding:'5px 10px', borderRadius:6, fontSize:11, cursor:'pointer', fontWeight: ativo?500:400,
      background: ativo?'var(--azul)':'var(--cinza-bg)',
      color: ativo?'#fff':'var(--texto-sec)',
      border: ativo?'none':'0.5px solid var(--borda)'
    }}>{label}</button>
  )

  return (
    <div>
      <div className="page-title">Contas</div>
      <div className="page-sub">Plano de contas orçamentário e contábil</div>

      <div className="stat-grid">
        <div className="stat"><div className="stat-n">{total}</div><div className="stat-l">Total</div></div>
        <div className="stat"><div className="stat-n" style={{color:'var(--azul)'}}>{porGrupo('Atividades do Dia a Dia')}</div><div className="stat-l">Atividades</div></div>
        <div className="stat"><div className="stat-n" style={{color:'var(--vermelho)'}}>{porGrupo('Intervenções Corretivas')}</div><div className="stat-l">Corretivas</div></div>
        <div className="stat"><div className="stat-n" style={{color:'var(--lilas)'}}>{porGrupo('Benfeitorias')}</div><div className="stat-l">Benfeitorias</div></div>
      </div>

      <div style={{display:'flex',gap:16,marginBottom:14,flexWrap:'wrap',alignItems:'flex-end'}}>
        <div>
          <div style={{fontSize:11, color:'var(--texto-ter)', marginBottom:5}}>GRUPO ORÇAMENTÁRIO</div>
          <div style={{display:'flex', gap:4, flexWrap:'wrap'}}>
            {['Todos',...GRUPOS].map(g => (
              <span key={g}>{btnFiltro(filtroGrupo===g, () => setFiltroGrupo(g), g)}</span>
            ))}
          </div>
        </div>
        <div className="form-group" style={{marginBottom:0,minWidth:200,flex:1}}>
          <label style={{fontSize:10,color:'var(--texto-ter)'}}>Buscar (descrição ou código)</label>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="palavra ou código..." style={{padding:'6px 8px'}}/>
        </div>
      </div>

      <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
        {isAdmin && <button className="btn btn-success" onClick={abrirNovo}><i className="fa-solid fa-plus" style={{marginRight:6}}></i>Nova conta</button>}
        <button className="btn btn-sm" onClick={exportar}><i className="fa-solid fa-file-excel" style={{marginRight:6}}></i>Exportar Excel</button>
      </div>

      <div style={{fontSize:12, color:'var(--texto-sec)', marginBottom:8}}>
        Exibindo {itensFiltrados.length} de {total} contas
      </div>

      <div className="card card-cinza" style={{padding:0,overflow:'hidden'}}>
        <table>
          <thead>
            <tr>
              <SortableTh col="id"                  label="ID"                 sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              <SortableTh col="descricao"           label="Descrição"          sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              <SortableTh col="grupo_orcamentario"  label="Grupo Orçamentário" sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              <SortableTh col="codigo_contabil"     label="Código Contábil"    sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              <SortableTh col="criado_em"           label="Cadastrada em"      sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {ordenar(itensFiltrados).map(c => {
              const cores = CORES_GRUPO[c.grupo_orcamentario] || { bg:'var(--cinza-bg)', cor:'var(--cinza)' }
              return (
                <tr key={c.id} onDoubleClick={() => setVerItem(c)} style={{cursor:'pointer'}}>
                  <td style={{color:'var(--texto-sec)',fontSize:12}}>{c.id}</td>
                  <td style={{fontWeight:500}}>{c.descricao}</td>
                  <td>
                    <span style={{fontSize:11, padding:'2px 7px', borderRadius:6, fontWeight:500,
                      background: cores.bg, color: cores.cor}}>{c.grupo_orcamentario}</span>
                  </td>
                  <td style={{fontFamily:'monospace',fontSize:12,color:'var(--texto-sec)'}}>{c.codigo_contabil || <span style={{color:'var(--texto-ter)'}}>—</span>}</td>
                  <td style={{fontSize:11,color:'var(--texto-sec)'}}>{fmtDataHora(c.criado_em)}</td>
                  {isAdmin && (
                    <td style={{display:'flex',gap:4}}>
                      <button className="btn btn-sm" onClick={e => { e.stopPropagation(); abrirEditar(c) }}>Editar</button>
                      <button className="btn btn-sm btn-danger" title="Excluir" onClick={e => { e.stopPropagation(); excluir(c) }}>
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div className="modal">
            <h3>{modal==='novo' ? 'Nova conta' : 'Editar conta'}</h3>
            {modal==='editar' && (
              <div className="form-group">
                <label>ID <span style={{color:'var(--texto-ter)',fontSize:11}}>(automático)</span></label>
                <input value={form.id||''} readOnly style={{background:'var(--cinza-bg)',color:'var(--texto-sec)',cursor:'not-allowed'}}/>
              </div>
            )}
            <div className="form-group">
              <label>Descrição</label>
              <input autoFocus value={form.descricao||''} onChange={e => setForm({...form,descricao:e.target.value})}/>
            </div>
            <div className="form-group">
              <label>Grupo orçamentário</label>
              <select value={form.grupo_orcamentario||GRUPOS[0]} onChange={e => setForm({...form,grupo_orcamentario:e.target.value})}>
                {GRUPOS.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Código contábil <span style={{color:'var(--texto-ter)',fontSize:11}}>(opcional)</span></label>
              <input value={form.codigo_contabil||''} onChange={e => setForm({...form,codigo_contabil:e.target.value})} placeholder="Ex: 3.1.01.001"/>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:12}}>
              <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvar}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {verItem && (
        <ViewModal
          titulo={verItem.descricao}
          subtitulo={`Conta · ID ${verItem.id}`}
          corBorda={CORES_GRUPO[verItem.grupo_orcamentario]?.cor || 'var(--cinza)'}
          onFechar={() => setVerItem(null)}
          onEditar={isAdmin ? () => { abrirEditar(verItem); setVerItem(null) } : null}
          campos={[
            { label:'ID',                  valor:verItem.id },
            { label:'Descrição',           valor:verItem.descricao },
            { label:'Grupo Orçamentário',  valor:verItem.grupo_orcamentario },
            { label:'Código Contábil',     valor:verItem.codigo_contabil },
            { label:'Cadastrada em',       valor:verItem.criado_em, tipo:'datahora' },
          ]}
        />
      )}
    </div>
  )
}

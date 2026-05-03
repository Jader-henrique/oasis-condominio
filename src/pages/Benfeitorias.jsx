import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { exportarParaExcel } from '../utils/excel'
import MapaCotacoes from './MapaCotacoes'
import ViewModal from './ViewModal'

const PRIOS = ['URGENTE','ATENÇÃO','PREVENTIVO','BAIXA','BENFEITORIA']
const BADGE = { URGENTE:'urgente', ATENÇÃO:'atencao', PREVENTIVO:'preventivo', BAIXA:'baixa', BENFEITORIA:'benfeitoria' }
const RESP_TIPOS = ['Zeladoria','Síndico','Terceiro']
const RECORRENCIAS = ['Recorrente','Não recorrente']
const PERIODOS = ['Diário','Semanal','Quinzenal','Mensal','Bimestral','Trimestral','Semestral','Anual','A Cada 2 Anos','A Cada 3 Anos','A Cada 5 Anos','Não Recorrente']

function fmtDataBR(d) {
  if (!d) return null
  const s = String(d).slice(0,10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const [y,m,day] = s.split('-')
  return `${day}/${m}/${y}`
}
function fmtMoeda(v) {
  if (v === null || v === undefined || v === '') return null
  const num = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  if (isNaN(num)) return null
  return num.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })
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

export default function Benfeitorias({ perfil }) {
  const [itens, setItens] = useState([])
  const [categorias, setCategorias] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [filtroResp, setFiltroResp] = useState('Todos')
  const [filtroRec, setFiltroRec] = useState('Todos')
  const [filtroPrio, setFiltroPrio] = useState('Todos')
  const [novaCat, setNovaCat] = useState('')
  const [adicionandoCat, setAdicionandoCat] = useState(false)
  const [cotacoesItem, setCotacoesItem] = useState(null)
  const [verItem, setVerItem] = useState(null)
  const isAdmin = perfil?.perfil === 'admin' || perfil?.perfil === 'sindico'

  useEffect(() => { carregar(); carregarCategorias() }, [])

  async function carregar() {
    const { data } = await supabase.from('benfeitorias').select('*').is('excluido_em', null).order('num')
    setItens(data || [])
  }
  async function carregarCategorias() {
    const { data } = await supabase.from('categorias').select('*').order('nome')
    setCategorias(data || [])
  }
  async function adicionarCategoria() {
    const nome = novaCat.trim()
    if (!nome) return
    const { data, error } = await supabase.from('categorias').insert([{ nome }]).select().single()
    if (error) { alert('Erro: ' + error.message); return }
    setCategorias(prev => [...prev, data].sort((a,b) => a.nome.localeCompare(b.nome)))
    setForm(f => ({ ...f, categoria_id: data.id }))
    setNovaCat(''); setAdicionandoCat(false)
  }
  function proximoNum() {
    if (!itens.length) return 1
    return Math.max(...itens.map(i => parseInt(i.num) || 0)) + 1
  }
  function abrirNovo() {
    setForm({ num: String(proximoNum()), sistema:'', categoria_id:null, prioridade:'BENFEITORIA', periodo:'Não Recorrente', responsavel:'', responsavel_tipo:'Síndico', recorrencia:'Não recorrente', previsto:null, realizado:null, valor:null, obs:'' })
    setNovaCat(''); setAdicionandoCat(false)
    setModal('novo')
  }
  function abrirEditar(item) {
    setForm({ ...item })
    setNovaCat(''); setAdicionandoCat(false)
    setModal('editar')
  }
  async function excluir(item) {
    if (!confirm(`Excluir "${item.sistema}"? Orçamentos vinculados também serão excluídos.`)) return
    try {
      const r1 = await supabase.from('benfeitorias').update({ excluido_em: new Date().toISOString() }).eq('id', item.id)
      if (r1.error) throw r1.error
      await supabase.rpc('soft_delete_cascade_orcamentos', { p_item_tipo:'benfeitoria', p_item_id:item.id })
      carregar()
    } catch (e) {
      alert('Erro ao excluir: ' + (e?.message || JSON.stringify(e)))
    }
  }

  async function salvar() {
    try {
      // remove campos legados / vazios
      const { categoria, ...rest } = form
      const payload = {}
      Object.keys(rest).forEach(k => {
        const v = rest[k]
        if (v === undefined) return
        if (v === '' && !['sistema','responsavel'].includes(k)) return
        payload[k] = v
      })
      let result
      if (modal === 'novo') {
        delete payload.id
        result = await supabase.from('benfeitorias').insert([payload])
      } else {
        const { id, ...resto } = payload
        result = await supabase.from('benfeitorias').update(resto).eq('id', id)
      }
      if (result.error) throw result.error
      setModal(null); carregar()
    } catch (e) {
      alert('Erro ao salvar: ' + (e?.message || JSON.stringify(e)))
    }
  }

  const itensFiltrados = itens.filter(i => {
    if (filtroResp !== 'Todos' && i.responsavel_tipo !== filtroResp) return false
    if (filtroRec  !== 'Todos' && i.recorrencia       !== filtroRec)  return false
    if (filtroPrio !== 'Todos' && i.prioridade        !== filtroPrio) return false
    return true
  })

  const total      = itens.length
  const realizados = itens.filter(i => i.realizado).length
  const pendentes  = total - realizados
  const valorTotal = itens.reduce((s,i) => s + (parseFloat(i.valor)||0), 0)

  const btnFiltro = (ativo, onClick, label) => (
    <button onClick={onClick} style={{
      padding:'5px 10px', borderRadius:6, fontSize:11, cursor:'pointer', fontWeight: ativo?500:400,
      background: ativo?'var(--azul)':'var(--cinza-bg)',
      color:      ativo?'#fff':'var(--texto-sec)',
      border:     ativo?'none':'0.5px solid var(--borda)'
    }}>{label}</button>
  )

  return (
    <div>
      <div className="page-title">Benfeitorias</div>
      <div className="page-sub">Investimentos e melhorias do prédio</div>

      <div className="stat-grid">
        <div className="stat"><div className="stat-n">{total}</div><div className="stat-l">Total</div></div>
        <div className="stat"><div className="stat-n" style={{color:'var(--amarelo)'}}>{pendentes}</div><div className="stat-l">Pendentes</div></div>
        <div className="stat"><div className="stat-n" style={{color:'var(--verde)'}}>{realizados}</div><div className="stat-l">Realizadas</div></div>
        <div className="stat"><div className="stat-n" style={{color:'var(--azul)',fontSize:18}}>{fmtMoeda(valorTotal) || 'R$ 0,00'}</div><div className="stat-l">Valor total</div></div>
      </div>

      <div style={{display:'flex', gap:16, marginBottom:14, flexWrap:'wrap'}}>
        <div>
          <div style={{fontSize:11, color:'var(--texto-ter)', marginBottom:5}}>RESPONSÁVEL</div>
          <div style={{display:'flex', gap:4}}>
            {['Todos','Zeladoria','Síndico','Terceiro'].map(r => (
              <span key={r}>{btnFiltro(filtroResp===r, () => setFiltroResp(r), r)}</span>
            ))}
          </div>
        </div>
        <div>
          <div style={{fontSize:11, color:'var(--texto-ter)', marginBottom:5}}>PRIORIDADE</div>
          <div style={{display:'flex', gap:4, flexWrap:'wrap'}}>
            {['Todos',...PRIOS].map(r => (
              <span key={r}>{btnFiltro(filtroPrio===r, () => setFiltroPrio(r), r)}</span>
            ))}
          </div>
        </div>
      </div>

      {isAdmin && <button className="btn btn-success" style={{marginBottom:12}} onClick={abrirNovo}>+ Adicionar benfeitoria</button>}

      <div style={{fontSize:12, color:'var(--texto-sec)', marginBottom:8}}>
        Exibindo {itensFiltrados.length} de {total} itens
      </div>

      <div className="card card-lilas" style={{padding:0,overflow:'hidden'}}>
        <table>
          <thead>
            <tr>
              <th>#</th><th>Sistema / Item</th><th>Categoria</th><th>Prioridade</th>
              <th>Responsável</th>
              <th>Previsto</th><th>Realizado</th><th>Valor</th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {itensFiltrados.map(i => {
              const cat = categorias.find(c => c.id === i.categoria_id)
              return (
                <tr key={i.id} onDoubleClick={() => setVerItem(i)} style={{cursor:'pointer'}}>
                  <td style={{color:'var(--texto-sec)'}}>{i.num}</td>
                  <td style={{fontWeight:500, maxWidth:200}}>{i.sistema}</td>
                  <td style={{fontSize:11,color:'var(--texto-sec)'}}>{cat?.nome || <span style={{color:'var(--texto-ter)'}}>—</span>}</td>
                  <td><span className={`badge badge-${BADGE[i.prioridade]||'baixa'}`}>{i.prioridade}</span></td>
                  <td>
                    <span style={{fontSize:11, padding:'2px 7px', borderRadius:6, fontWeight:500,
                      background: i.responsavel_tipo==='Zeladoria' ? 'var(--azul-bg)' : i.responsavel_tipo==='Síndico' ? 'var(--amarelo-bg)' : 'var(--cinza-bg)',
                      color: i.responsavel_tipo==='Zeladoria' ? 'var(--azul)' : i.responsavel_tipo==='Síndico' ? 'var(--amarelo)' : 'var(--cinza)'
                    }}>{i.responsavel_tipo||'—'}</span>
                  </td>
                  <td>{i.previsto ? fmtDataBR(i.previsto) : <span style={{color:'var(--texto-ter)'}}>—</span>}</td>
                  <td>{i.realizado ? <span style={{color:'var(--verde)',fontWeight:500}}>{fmtDataBR(i.realizado)}</span> : <span style={{color:'var(--texto-ter)'}}>—</span>}</td>
                  <td style={{whiteSpace:'nowrap',fontWeight:500}}>{i.valor != null ? fmtMoeda(i.valor) : <span style={{color:'var(--texto-ter)',fontWeight:400}}>—</span>}</td>
                  {isAdmin && (
                    <td style={{display:'flex',gap:4}}>
                      <button className="btn btn-sm" onClick={() => abrirEditar(i)}>Editar</button>
                      <button className="btn btn-sm" style={{background:'var(--azul-bg)',color:'var(--azul)',borderColor:'var(--azul)'}}
                        title="Mapa de cotações"
                        onClick={() => setCotacoesItem({ tipo:'benfeitoria', id:i.id, nome:i.sistema })}>
                        <i className="fa-solid fa-chart-column"></i>
                      </button>
                      <button className="btn btn-sm btn-danger" title="Excluir" onClick={() => excluir(i)}>
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
            <h3>{modal==='novo' ? 'Nova benfeitoria' : 'Editar benfeitoria'}</h3>
            <div className="form-group">
              <label>Número {modal==='novo' && <span style={{color:'var(--texto-ter)'}}>(automático)</span>}</label>
              <input value={form.num||''} readOnly style={{background:'var(--cinza-bg)',color:'var(--texto-sec)',cursor:'not-allowed'}}/>
            </div>
            <div className="form-group"><label>Sistema / Item</label><input value={form.sistema||''} onChange={e => setForm({...form,sistema:e.target.value})}/></div>
            <div className="form-group"><label>Responsável (detalhe)</label><input value={form.responsavel||''} onChange={e => setForm({...form,responsavel:e.target.value})}/></div>
            <div className="form-group">
              <label>Período</label>
              <select value={form.periodo||''} onChange={e => setForm({...form, periodo: e.target.value || null})}>
                <option value="">— selecione —</option>
                {PERIODOS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={{display:'flex',gap:8}}>
              <div className="form-group" style={{flex:1}}>
                <label>Previsto</label>
                <input type="date" value={form.previsto ? String(form.previsto).slice(0,10) : ''} onChange={e => setForm({...form, previsto: e.target.value || null})}/>
              </div>
              <div className="form-group" style={{flex:1}}>
                <label>Realizado</label>
                <input type="date" value={form.realizado ? String(form.realizado).slice(0,10) : ''} onChange={e => setForm({...form, realizado: e.target.value || null})}/>
              </div>
            </div>
            <div className="form-group">
              <label>Valor (R$) — realizado/pago</label>
              <input type="text" inputMode="numeric" placeholder="R$ 0,00"
                value={moedaInputValue(form.valor)}
                onChange={e => setForm({...form, valor: digitsToNum(e.target.value)})}/>
            </div>
            <div className="form-group">
              <label>Categoria</label>
              {!adicionandoCat ? (
                <div style={{display:'flex',gap:6}}>
                  <select style={{flex:1}} value={form.categoria_id ?? ''}
                    onChange={e => setForm({...form, categoria_id: e.target.value ? Number(e.target.value) : null})}>
                    <option value="">— selecione —</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                  <button type="button" className="btn btn-sm" onClick={() => setAdicionandoCat(true)} style={{whiteSpace:'nowrap'}}>
                    <i className="fa-solid fa-plus" style={{marginRight:4}}></i>Nova
                  </button>
                </div>
              ) : (
                <div style={{display:'flex',gap:6}}>
                  <input style={{flex:1}} autoFocus placeholder="Nome da nova categoria" value={novaCat}
                    onChange={e => setNovaCat(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), adicionarCategoria())}/>
                  <button type="button" className="btn btn-sm btn-success" onClick={adicionarCategoria} style={{whiteSpace:'nowrap'}}>Salvar</button>
                  <button type="button" className="btn btn-sm" onClick={() => { setAdicionandoCat(false); setNovaCat('') }} style={{whiteSpace:'nowrap'}}>Cancelar</button>
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Prioridade</label>
              <select value={form.prioridade||'BENFEITORIA'} onChange={e => setForm({...form,prioridade:e.target.value})}>
                {PRIOS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Responsável (tipo)</label>
              <select value={form.responsavel_tipo||'Síndico'} onChange={e => setForm({...form,responsavel_tipo:e.target.value})}>
                {RESP_TIPOS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Recorrência</label>
              <select value={form.recorrencia||'Não recorrente'} onChange={e => setForm({...form,recorrencia:e.target.value})}>
                {RECORRENCIAS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Observações</label>
              <textarea value={form.obs||''} onChange={e => setForm({...form,obs:e.target.value})}/>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:12}}>
              <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvar}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {cotacoesItem && (
        <MapaCotacoes
          tipo={cotacoesItem.tipo}
          itemId={cotacoesItem.id}
          itemNome={cotacoesItem.nome}
          tipoLabel="Benfeitoria"
          perfil={perfil}
          onFechar={() => { setCotacoesItem(null); carregar() }}
        />
      )}

      {verItem && (() => {
        const cat = categorias.find(c => c.id === verItem.categoria_id)
        return (
          <ViewModal
            titulo={verItem.sistema}
            subtitulo={`Benfeitoria · Item ${verItem.num}`}
            corBorda="var(--lilas)"
            onFechar={() => setVerItem(null)}
            onEditar={() => { abrirEditar(verItem); setVerItem(null) }}
            campos={[
              { label:'Número',         valor:verItem.num },
              { label:'Categoria',      valor:cat?.nome },
              { label:'Prioridade',     valor:verItem.prioridade },
              { label:'Período',        valor:verItem.periodo },
              { label:'Responsável',    valor:verItem.responsavel_tipo },
              { label:'Resp. detalhe',  valor:verItem.responsavel },
              { label:'Recorrência',    valor:verItem.recorrencia },
              { label:'Previsto',       valor:verItem.previsto, tipo:'data' },
              { label:'Realizado',      valor:verItem.realizado, tipo:'data' },
              { label:'Valor',          valor:verItem.valor, tipo:'moeda' },
              { label:'Observações',    valor:verItem.obs, tipo:'longtext' },
            ]}
          />
        )
      })()}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { exportarParaExcel } from '../utils/excel'
import MapaCotacoes from './MapaCotacoes'
import ViewModal from './ViewModal'
import BuscaConta from './BuscaConta'
import { useSort, SortableTh } from '../utils/useSort'

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

const inputBloqueadoStyle = {
  background:'var(--cinza-bg)', color:'var(--texto-sec)', cursor:'not-allowed'
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
  const [contas, setContas] = useState([])
  const [buscandoConta, setBuscandoConta] = useState(false)
  const [orcsFechados, setOrcsFechados] = useState({})
  const isAdmin = perfil?.perfil === 'admin' || perfil?.perfil === 'sindico'
  const { sortBy, sortDir, onSort, ordenar } = useSort('previsto', 'asc')

  useEffect(() => { carregar(); carregarCategorias(); carregarContas(); carregarOrcsFechados() }, [])

  async function carregarOrcsFechados() {
    const { data } = await supabase.from('orcamentos')
      .select('item_id, empresa, motivo_escolha, sem_orcamento, condicao:condicao_pagamento_id(descricao)')
      .eq('item_tipo', 'benfeitoria')
      .or('selecionado.eq.true,sem_orcamento.eq.true')
      .is('excluido_em', null)
    const map = {}
    for (const o of (data||[])) {
      map[o.item_id] = {
        empresa: o.empresa,
        motivo: o.motivo_escolha,
        condicao: o.condicao?.descricao || null,
        sem_orcamento: o.sem_orcamento
      }
    }
    setOrcsFechados(map)
  }

  async function carregarContas() {
    const { data } = await supabase.from('contas').select('*').is('excluido_em', null).order('descricao')
    setContas(data || [])
  }

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
    setForm({
      num: String(proximoNum()), sistema:'', categoria_id:null,
      prioridade:'BENFEITORIA', periodo:'Não Recorrente',
      responsavel_tipo:'Síndico', recorrencia:'Não recorrente',
      previsto:null, data_inicio_real:null, realizado:null, conta_id:null,
      valor_previsto:null, valor_realizado:null, obs:''
    })
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
      // Bloqueia edição direta de campos preenchidos pelo workflow
      const { categoria, valor, valor_realizado, realizado, responsavel, ...rest } = form
      const payload = {}
      Object.keys(rest).forEach(k => {
        const v = rest[k]
        if (v === undefined) return
        if (v === '' && !['sistema'].includes(k)) return
        payload[k] = v
      })
      // Em edição, preserva valores que vêm do workflow (sem permitir alteração)
      if (modal === 'editar') {
        if (valor_realizado !== undefined) payload.valor_realizado = valor_realizado
        if (realizado !== undefined)       payload.realizado = realizado
      } else {
        delete payload.id
      }
      let result
      if (modal === 'novo') {
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

  const contaSelecionada = contas.find(c => c.id === form.conta_id) || null

  const itensFiltrados = itens.filter(i => {
    if (filtroResp !== 'Todos' && i.responsavel_tipo !== filtroResp) return false
    if (filtroRec  !== 'Todos' && i.recorrencia       !== filtroRec)  return false
    if (filtroPrio !== 'Todos' && i.prioridade        !== filtroPrio) return false
    return true
  })

  const total      = itens.length
  const realizados = itens.filter(i => i.realizado).length
  const pendentes  = total - realizados
  const valorTotal = itens.reduce((s,i) => s + (parseFloat(i.valor_realizado || i.valor)||0), 0)

  const btnFiltro = (ativo, onClick, label) => (
    <button onClick={onClick} style={{
      padding:'5px 10px', borderRadius:6, fontSize:11, cursor:'pointer', fontWeight: ativo?500:400,
      background: ativo?'var(--azul)':'var(--cinza-bg)',
      color:      ativo?'#fff':'var(--texto-sec)',
      border:     ativo?'none':'0.5px solid var(--borda)'
    }}>{label}</button>
  )

  function exportar() {
    const dados = itensFiltrados.map(i => {
      const cat = categorias.find(c => c.id === i.categoria_id)
      return {
        Num: i.num, Sistema: i.sistema, Categoria: cat?.nome||'',
        Prioridade: i.prioridade, Período: i.periodo, Responsável: i.responsavel_tipo,
        'Valor Previsto':  i.valor_previsto,
        'Valor Realizado': i.valor_realizado || i.valor,
        'Início Previsto': fmtDataBR(i.previsto),
        'Início Real':     fmtDataBR(i.data_inicio_real),
        Realizado:         fmtDataBR(i.realizado),
      }
    })
    exportarParaExcel(dados, 'benfeitorias.xlsx', 'Benfeitorias')
  }

  return (
    <div>
      <div className="page-title">Benfeitorias</div>
      <div className="page-sub">Investimentos e melhorias do prédio</div>

      <div className="stat-grid">
        <div className="stat"><div className="stat-n">{total}</div><div className="stat-l">Total</div></div>
        <div className="stat"><div className="stat-n" style={{color:'var(--amarelo)'}}>{pendentes}</div><div className="stat-l">Pendentes</div></div>
        <div className="stat"><div className="stat-n" style={{color:'var(--verde)'}}>{realizados}</div><div className="stat-l">Realizadas</div></div>
        <div className="stat"><div className="stat-n" style={{color:'var(--azul)',fontSize:18}}>{fmtMoeda(valorTotal) || 'R$ 0,00'}</div><div className="stat-l">Valor realizado total</div></div>
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

      <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
        {isAdmin && <button className="btn btn-success" onClick={abrirNovo}>+ Adicionar benfeitoria</button>}
        <button className="btn btn-sm" onClick={exportar}><i className="fa-solid fa-file-excel" style={{marginRight:6}}></i>Exportar Excel</button>
      </div>

      <div style={{fontSize:12, color:'var(--texto-sec)', marginBottom:8}}>
        Exibindo {itensFiltrados.length} de {total} itens
      </div>

      <div className="card card-lilas" style={{padding:0,overflow:'hidden'}}>
        <table>
          <thead>
            <tr>
              <SortableTh col="num"              label="#"             sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              <SortableTh col="sistema"          label="Sistema / Item" sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              <SortableTh col="categoria_id"     label="Categoria"     sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              <SortableTh col="prioridade"       label="Prio"          sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              <SortableTh col="responsavel_tipo" label="Resp."         sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              <SortableTh col="valor_previsto"   label="Vlr Previsto"  sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              <SortableTh col="valor_realizado"  label="Vlr Realizado" sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              <SortableTh col="previsto"         label="Início Prev."  sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              <SortableTh col="data_inicio_real" label="Início Real"   sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              <SortableTh col="realizado"        label="Realizado"     sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {ordenar(itensFiltrados).map(i => {
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
                  <td style={{whiteSpace:'nowrap'}}>{i.valor_previsto != null ? fmtMoeda(i.valor_previsto) : <span style={{color:'var(--texto-ter)'}}>—</span>}</td>
                  <td style={{whiteSpace:'nowrap',fontWeight:500,color:'var(--verde)'}}>{(i.valor_realizado != null || i.valor != null) ? fmtMoeda(i.valor_realizado || i.valor) : <span style={{color:'var(--texto-ter)',fontWeight:400}}>—</span>}</td>
                  <td style={{whiteSpace:'nowrap'}}>{i.previsto ? fmtDataBR(i.previsto) : <span style={{color:'var(--texto-ter)'}}>—</span>}</td>
                  <td style={{whiteSpace:'nowrap'}}>{i.data_inicio_real ? fmtDataBR(i.data_inicio_real) : <span style={{color:'var(--texto-ter)'}}>—</span>}</td>
                  <td style={{whiteSpace:'nowrap'}}>{i.realizado ? <span style={{color:'var(--verde)',fontWeight:500}}>{fmtDataBR(i.realizado)}</span> : <span style={{color:'var(--texto-ter)'}}>—</span>}</td>
                  {isAdmin && (
                    <td style={{display:'flex',gap:4}}>
                      <button className="btn btn-sm" onClick={e => { e.stopPropagation(); abrirEditar(i) }}>Editar</button>
                      <button className="btn btn-sm" style={{background:'var(--azul-bg)',color:'var(--azul)',borderColor:'var(--azul)'}}
                        title="Mapa de cotações"
                        onClick={e => { e.stopPropagation(); setCotacoesItem({ tipo:'benfeitoria', id:i.id, nome:i.sistema }) }}>
                        <i className="fa-solid fa-chart-column"></i>
                      </button>
                      <button className="btn btn-sm btn-danger" title="Excluir" onClick={e => { e.stopPropagation(); excluir(i) }}>
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
          <div className="modal" style={{width:560, maxWidth:'95vw'}}>
            <h3>{modal==='novo' ? 'Nova benfeitoria' : 'Editar benfeitoria'}</h3>

            <div className="form-group">
              <label>Número {modal==='novo' && <span style={{color:'var(--texto-ter)'}}>(automático)</span>}</label>
              <input value={form.num||''} readOnly style={inputBloqueadoStyle}/>
            </div>

            <div className="form-group">
              <label>Sistema / Item</label>
              <input value={form.sistema||''} onChange={e => setForm({...form,sistema:e.target.value})}/>
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
              <label>Conta orçamentária / contábil</label>
              {form.conta_id ? (
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  <div style={{flex:1, padding:'8px 10px', border:'0.5px solid var(--borda)', borderRadius:8, fontSize:13, background:'var(--cinza-bg)'}}>
                    {contaSelecionada ? (<>
                      <div style={{fontWeight:500}}>{contaSelecionada.descricao}</div>
                      <div style={{fontSize:10,color:'var(--texto-ter)'}}>{contaSelecionada.grupo_orcamentario}{contaSelecionada.codigo_contabil ? ' · '+contaSelecionada.codigo_contabil : ''}</div>
                    </>) : <span style={{color:'var(--texto-ter)'}}>(conta selecionada)</span>}
                  </div>
                  <button type="button" className="btn btn-sm" onClick={() => setForm({...form, conta_id:null})}>Trocar</button>
                </div>
              ) : (
                <button type="button" className="btn" style={{width:'100%'}} onClick={() => setBuscandoConta(true)}>
                  <i className="fa-solid fa-magnifying-glass" style={{marginRight:6}}></i>Selecionar conta...
                </button>
              )}
            </div>

            <div className="form-group">
              <label>Período</label>
              <select value={form.periodo||''} onChange={e => setForm({...form, periodo: e.target.value || null})}>
                <option value="">— selecione —</option>
                {PERIODOS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div style={{display:'flex',gap:8}}>
              <div className="form-group" style={{flex:1}}>
                <label>Valor previsto</label>
                <input type="text" inputMode="numeric" placeholder="R$ 0,00"
                  value={moedaInputValue(form.valor_previsto)}
                  onChange={e => setForm({...form, valor_previsto: digitsToNum(e.target.value)})}/>
              </div>
              <div className="form-group" style={{flex:1}}>
                <label>Valor realizado <span style={{color:'var(--texto-ter)',fontSize:11}}>(via Mapa)</span></label>
                <input type="text" readOnly style={inputBloqueadoStyle}
                  value={moedaInputValue(form.valor_realizado || form.valor)} placeholder="—"/>
              </div>
            </div>

            <div style={{display:'flex',gap:8}}>
              <div className="form-group" style={{flex:1}}>
                <label>Início previsto</label>
                <input type="date" value={form.previsto ? String(form.previsto).slice(0,10) : ''}
                  onChange={e => setForm({...form, previsto: e.target.value || null})}/>
              </div>
              <div className="form-group" style={{flex:1}}>
                <label>Início real <span style={{color:'var(--texto-ter)',fontSize:11}}>(quando iniciar)</span></label>
                <input type="date" value={form.data_inicio_real ? String(form.data_inicio_real).slice(0,10) : ''}
                  onChange={e => setForm({...form, data_inicio_real: e.target.value || null})}/>
              </div>
              <div className="form-group" style={{flex:1}}>
                <label>Realizado <span style={{color:'var(--texto-ter)',fontSize:11}}>(via App)</span></label>
                <input type="date" readOnly style={inputBloqueadoStyle}
                  value={form.realizado ? String(form.realizado).slice(0,10) : ''}/>
              </div>
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

      {buscandoConta && (
        <BuscaConta grupoFixo="Benfeitorias"
          onSelect={c => { setForm({...form, conta_id: c.id}); setContas(prev => prev.find(p=>p.id===c.id)?prev:[...prev,c]); setBuscandoConta(false) }}
          onCancelar={() => setBuscandoConta(false)}/>
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
              { label:'Número',          valor:verItem.num },
              { label:'Categoria',       valor:cat?.nome },
              { label:'Prioridade',      valor:verItem.prioridade },
              { label:'Período',         valor:verItem.periodo },
              { label:'Responsável',     valor:verItem.responsavel_tipo },
              { label:'Recorrência',     valor:verItem.recorrencia },
              { label:'Valor previsto',  valor:verItem.valor_previsto, tipo:'moeda' },
              { label:'Valor realizado', valor:verItem.valor_realizado || verItem.valor, tipo:'moeda' },
              { label:'Empresa contratada',  valor:orcsFechados[verItem.id]?.empresa },
              { label:'Condição de pagamento', valor:orcsFechados[verItem.id]?.condicao },
              { label:'Motivo da escolha', valor: orcsFechados[verItem.id]?.sem_orcamento
                  ? `(SEM ORÇAMENTO PRÉVIO) ${orcsFechados[verItem.id]?.motivo || ''}`
                  : orcsFechados[verItem.id]?.motivo, tipo:'longtext' },
              { label:'Início previsto', valor:verItem.previsto, tipo:'data' },
              { label:'Início real',     valor:verItem.data_inicio_real, tipo:'data' },
              { label:'Realizado',       valor:verItem.realizado, tipo:'data' },
              { label:'Observações',     valor:verItem.obs, tipo:'longtext' },
            ]}
          />
        )
      })()}
    </div>
  )
}

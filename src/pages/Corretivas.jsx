import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { exportarParaExcel } from '../utils/excel'
import MapaCotacoes from './MapaCotacoes'
import ViewModal from './ViewModal'
import BuscaConta from './BuscaConta'
import { useSort, SortableTh } from '../utils/useSort'

const PRIOS = ['URGENTE','ATENÇÃO','PREVENTIVO','BAIXA']
const BADGE_P = { URGENTE:'urgente', ATENÇÃO:'atencao', PREVENTIVO:'preventivo', BAIXA:'baixa' }
const STATUS = ['pendente','andamento','realizado']
const STATUS_L = { pendente:'Pendente', andamento:'Em andamento', realizado:'Realizado' }
const RESP_TIPOS = ['Zeladoria','Síndico','Terceiro']
const RECORRENCIAS = ['Recorrente','Não recorrente']

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

export default function Corretivas({ perfil }) {
  const [itens, setItens] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [filtroResp, setFiltroResp] = useState('Todos')
  const [filtroRec, setFiltroRec] = useState('Todos')
  const [cotacoesItem, setCotacoesItem] = useState(null)
  const [verItem, setVerItem] = useState(null)
  const isAdmin = perfil?.perfil === 'admin' || perfil?.perfil === 'sindico'
  const { sortBy, sortDir, onSort, ordenar } = useSort('data_inicio_prevista', 'asc')
  const [contas, setContas] = useState([])
  const [buscandoConta, setBuscandoConta] = useState(false)
  const [orcsFechados, setOrcsFechados] = useState({})

  useEffect(() => { carregar(); carregarContas(); carregarOrcsFechados() }, [])

  async function carregarOrcsFechados() {
    const { data } = await supabase.from('orcamentos')
      .select('item_id, empresa, motivo_escolha, sem_orcamento, condicao:condicao_pagamento_id(descricao)')
      .eq('item_tipo', 'corretiva')
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
    const { data } = await supabase.from('corretivas').select('*').is('excluido_em', null).order('num')
    setItens(data || [])
  }
  function proximoNum() {
    if (!itens.length) return 1
    return Math.max(...itens.map(i => parseInt(i.num) || 0)) + 1
  }
  function abrirNovo() {
    setForm({
      num: String(proximoNum()), item:'', prioridade:'URGENTE', status:'pendente',
      responsavel_tipo:'Síndico', recorrencia:'Não recorrente',
      empresa:null, valor_previsto:null, valor_realizado:null,
      data_inicio_prevista:null, data_inicio_real:null, data_fim:null, conta_id:null, obs:''
    })
    setModal('novo')
  }
  function abrirEditar(item) { setForm({ ...item }); setModal('editar') }

  async function excluir(item) {
    if (!confirm(`Excluir "${item.item}"? Orçamentos vinculados também serão excluídos.`)) return
    try {
      const r1 = await supabase.from('corretivas').update({ excluido_em: new Date().toISOString() }).eq('id', item.id)
      if (r1.error) throw r1.error
      await supabase.rpc('soft_delete_cascade_orcamentos', { p_item_tipo:'corretiva', p_item_id:item.id })
      carregar()
    } catch (e) {
      alert('Erro ao excluir: ' + (e?.message || JSON.stringify(e)))
    }
  }


  function setarDataInicioReal(novaData) {
    if (!novaData) { setForm({...form, data_inicio_real: null}); return }
    // Regra: nunca pode ser maior que hoje
    const hojeStr = new Date().toISOString().slice(0,10)
    if (novaData > hojeStr) {
      alert('A data de início real não pode ser maior que a data atual.')
      return
    }
    // Regra: precisa de data_inicio_prevista
    if (!form.data_inicio_prevista) {
      const ok = confirm('Data de Início Prevista não foi preenchida, deseja utilizar a mesma data do realizado?')
      if (ok) {
        setForm({...form, data_inicio_prevista: novaData, data_inicio_real: novaData})
      } else {
        // reverte — mantém vazio
        setForm({...form, data_inicio_real: null})
      }
      return
    }
    setForm({...form, data_inicio_real: novaData})
  }

  async function salvar() {
    try {
      // Não permite editar empresa/valor_realizado/data_fim diretamente — esses são preenchidos via Mapa de Cotações ou App
      const { empresa, valor_realizado, data_fim, valor, data_inicio, ...rest } = form
      const payload = {}
      Object.keys(rest).forEach(k => {
        const v = rest[k]
        if (v === undefined) return
        if (v === '' && !['item'].includes(k)) return
        payload[k] = v
      })
      // Se for novo, NÃO envia campos preenchidos pelo workflow
      if (modal === 'novo') {
        delete payload.empresa
        delete payload.valor_realizado
        delete payload.data_fim
        delete payload.id
      } else {
        // Em edição, preserva os valores atuais (não permite alterar)
        if (empresa !== undefined)           payload.empresa = empresa
        if (valor_realizado !== undefined)   payload.valor_realizado = valor_realizado
        if (data_fim !== undefined)          payload.data_fim = data_fim
      }
      let result
      if (modal === 'novo') {
        result = await supabase.from('corretivas').insert([payload])
      } else {
        const { id, ...resto } = payload
        result = await supabase.from('corretivas').update(resto).eq('id', id)
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
    return true
  })

  const total = itens.length
  const concluidas = itens.filter(i => i.status==='realizado').length
  const andamento  = itens.filter(i => i.status==='andamento').length
  const pendentes  = itens.filter(i => i.status==='pendente').length

  const btnFiltro = (ativo, onClick, label) => (
    <button onClick={onClick} style={{
      padding:'5px 10px', borderRadius:6, fontSize:11, cursor:'pointer', fontWeight: ativo?500:400,
      background: ativo?'var(--azul)':'var(--cinza-bg)',
      color: ativo?'#fff':'var(--texto-sec)',
      border: ativo?'none':'0.5px solid var(--borda)'
    }}>{label}</button>
  )

  function exportar() {
    const dados = itensFiltrados.map(c => ({
      Num: c.num, Intervenção: c.item, Prioridade: c.prioridade, Status: STATUS_L[c.status]||c.status,
      Responsável: c.responsavel_tipo, Recorrência: c.recorrencia, Empresa: c.empresa||'',
      'Valor Previsto': c.valor_previsto, 'Valor Realizado': c.valor_realizado,
      'Início Previsto': fmtDataBR(c.data_inicio_prevista), 'Início Real': fmtDataBR(c.data_inicio_real),
      'Conclusão': fmtDataBR(c.data_fim)
    }))
    exportarParaExcel(dados, 'corretivas.xlsx', 'Corretivas')
  }

  return (
    <div>
      <div className="page-title">Intervenções Corretivas</div>
      <div className="page-sub">Reparos pontuais e contratações para correção de problemas</div>

      <div className="stat-grid">
        <div className="stat"><div className="stat-n">{total}</div><div className="stat-l">Total</div></div>
        <div className="stat"><div className="stat-n" style={{color:'var(--vermelho)'}}>{pendentes}</div><div className="stat-l">Pendentes</div></div>
        <div className="stat"><div className="stat-n" style={{color:'var(--azul)'}}>{andamento}</div><div className="stat-l">Em andamento</div></div>
        <div className="stat"><div className="stat-n" style={{color:'var(--verde)'}}>{concluidas}</div><div className="stat-l">Concluídas</div></div>
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
          <div style={{fontSize:11, color:'var(--texto-ter)', marginBottom:5}}>RECORRÊNCIA</div>
          <div style={{display:'flex', gap:4}}>
            {['Todos','Recorrente','Não recorrente'].map(r => (
              <span key={r}>{btnFiltro(filtroRec===r, () => setFiltroRec(r), r)}</span>
            ))}
          </div>
        </div>
      </div>

      <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
        {isAdmin && <button className="btn btn-success" onClick={abrirNovo}>+ Nova intervenção</button>}
        <button className="btn btn-sm" onClick={exportar}><i className="fa-solid fa-file-excel" style={{marginRight:6}}></i>Exportar Excel</button>
      </div>

      <div style={{fontSize:12, color:'var(--texto-sec)', marginBottom:8}}>
        Exibindo {itensFiltrados.length} de {itens.length} itens
      </div>

      <div className="card card-vermelho" style={{padding:0,overflow:'hidden'}}>
        <table>
          <thead>
            <tr>
              <SortableTh col="num"                  label="#"             sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              <SortableTh col="item"                 label="Intervenção"   sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              <SortableTh col="prioridade"           label="Prio"          sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              <SortableTh col="status"               label="Status"        sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              <SortableTh col="responsavel_tipo"     label="Resp."         sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              <SortableTh col="empresa"              label="Empresa"       sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              <SortableTh col="valor_previsto"       label="Vlr Previsto"  sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              <SortableTh col="valor_realizado"      label="Vlr Realizado" sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              <SortableTh col="data_inicio_prevista" label="Início Prev."  sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              <SortableTh col="data_inicio_real"     label="Início Real"   sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              <SortableTh col="data_fim"             label="Conclusão"     sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {ordenar(itensFiltrados).map(c => (
              <tr key={c.id} onDoubleClick={() => setVerItem(c)} style={{cursor:'pointer'}}>
                <td style={{color:'var(--texto-sec)'}}>{c.num}</td>
                <td style={{fontWeight:500, maxWidth:160}}>{c.item}</td>
                <td><span className={`badge badge-${BADGE_P[c.prioridade]||'baixa'}`}>{c.prioridade}</span></td>
                <td><span className={`badge badge-${c.status==='realizado'?'realizado':c.status==='andamento'?'andamento':'pendente'}`}>{STATUS_L[c.status]||c.status}</span></td>
                <td>
                  <span style={{fontSize:11, padding:'2px 7px', borderRadius:6, fontWeight:500,
                    background: c.responsavel_tipo==='Zeladoria' ? 'var(--azul-bg)' : c.responsavel_tipo==='Síndico' ? 'var(--amarelo-bg)' : 'var(--cinza-bg)',
                    color: c.responsavel_tipo==='Zeladoria' ? 'var(--azul)' : c.responsavel_tipo==='Síndico' ? 'var(--amarelo)' : 'var(--cinza)'
                  }}>{c.responsavel_tipo||'—'}</span>
                </td>
                <td style={{color:'var(--texto-sec)',fontSize:12}}>{c.empresa||<span style={{color:'var(--texto-ter)'}}>—</span>}</td>
                <td style={{whiteSpace:'nowrap'}}>{c.valor_previsto != null ? fmtMoeda(c.valor_previsto) : <span style={{color:'var(--texto-ter)'}}>—</span>}</td>
                <td style={{whiteSpace:'nowrap',fontWeight:500,color:'var(--verde)'}}>{c.valor_realizado != null ? fmtMoeda(c.valor_realizado) : <span style={{color:'var(--texto-ter)',fontWeight:400}}>—</span>}</td>
                <td style={{whiteSpace:'nowrap'}}>{c.data_inicio_prevista ? fmtDataBR(c.data_inicio_prevista) : <span style={{color:'var(--texto-ter)'}}>—</span>}</td>
                <td style={{whiteSpace:'nowrap'}}>{c.data_inicio_real ? fmtDataBR(c.data_inicio_real) : <span style={{color:'var(--texto-ter)'}}>—</span>}</td>
                <td style={{whiteSpace:'nowrap'}}>{c.data_fim ? <span style={{color:'var(--verde)',fontWeight:500}}>{fmtDataBR(c.data_fim)}</span> : <span style={{color:'var(--texto-ter)'}}>—</span>}</td>
                {isAdmin && (
                  <td style={{display:'flex',gap:4}}>
                    <button className="btn btn-sm" onClick={e => { e.stopPropagation(); abrirEditar(c) }}>Editar</button>
                    <button className="btn btn-sm" style={{background:'var(--azul-bg)',color:'var(--azul)',borderColor:'var(--azul)'}}
                      title="Mapa de cotações"
                      onClick={e => { e.stopPropagation(); setCotacoesItem({ tipo:'corretiva', id:c.id, nome:c.item }) }}>
                      <i className="fa-solid fa-chart-column"></i>
                    </button>
                    <button className="btn btn-sm btn-danger" title="Excluir" onClick={e => { e.stopPropagation(); excluir(c) }}>
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div className="modal" style={{width:560, maxWidth:'95vw'}}>
            <h3>{modal==='novo' ? 'Nova intervenção' : 'Editar intervenção'}</h3>

            <div className="form-group">
              <label>Número {modal==='novo' && <span style={{color:'var(--texto-ter)'}}>(automático)</span>}</label>
              <input value={form.num||''} readOnly style={inputBloqueadoStyle}/>
            </div>

            <div className="form-group">
              <label>Intervenção</label>
              <input value={form.item||''} onChange={e => setForm({...form,item:e.target.value})}/>
            </div>

            <div className="form-group">
              <label>Empresa contratada <span style={{color:'var(--texto-ter)',fontSize:11}}>(definida ao fechar negócio no Mapa de Cotações)</span></label>
              <input value={form.empresa||''} readOnly style={inputBloqueadoStyle}
                placeholder="— ainda sem empresa —"/>
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
                  value={moedaInputValue(form.valor_realizado)} placeholder="—"/>
              </div>
            </div>

            <div style={{display:'flex',gap:8}}>
              <div className="form-group" style={{flex:1}}>
                <label>Data início prevista</label>
                <input type="date"
                  value={form.data_inicio_prevista ? String(form.data_inicio_prevista).slice(0,10) : ''}
                  onChange={e => setForm({...form, data_inicio_prevista: e.target.value || null})}/>
              </div>
              <div className="form-group" style={{flex:1}}>
                <label>Data início real <span style={{color:'var(--texto-ter)',fontSize:11}}>(quando iniciar)</span></label>
                <input type="date"
                  max={new Date().toISOString().slice(0,10)}
                  value={form.data_inicio_real ? String(form.data_inicio_real).slice(0,10) : ''}
                  onChange={e => setarDataInicioReal(e.target.value)}/>
              </div>
              <div className="form-group" style={{flex:1}}>
                <label>Conclusão <span style={{color:'var(--texto-ter)',fontSize:11}}>(via App)</span></label>
                <input type="date" readOnly style={inputBloqueadoStyle}
                  value={form.data_fim ? String(form.data_fim).slice(0,10) : ''}/>
              </div>
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
              <label>Prioridade</label>
              <select value={form.prioridade||'URGENTE'} onChange={e => setForm({...form,prioridade:e.target.value})}>
                {PRIOS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status||'pendente'} onChange={e => setForm({...form,status:e.target.value})}>
                {STATUS.map(s => <option key={s} value={s}>{STATUS_L[s]}</option>)}
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
            <div className="form-group"><label>Observações</label><textarea value={form.obs||''} onChange={e => setForm({...form,obs:e.target.value})}/></div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:12}}>
              <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvar}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {buscandoConta && (
        <BuscaConta grupoFixo="Intervenções Corretivas"
          onSelect={c => { setForm({...form, conta_id: c.id}); setContas(prev => prev.find(p=>p.id===c.id)?prev:[...prev,c]); setBuscandoConta(false) }}
          onCancelar={() => setBuscandoConta(false)}/>
      )}

      {cotacoesItem && (
        <MapaCotacoes
          tipo={cotacoesItem.tipo}
          itemId={cotacoesItem.id}
          itemNome={cotacoesItem.nome}
          tipoLabel="Intervenção Corretiva"
          perfil={perfil}
          onFechar={() => { setCotacoesItem(null); carregar() }}
        />
      )}

      {verItem && (
        <ViewModal
          titulo={verItem.item}
          subtitulo={`Intervenção Corretiva · Item ${verItem.num}`}
          corBorda="var(--vermelho)"
          onFechar={() => setVerItem(null)}
          onEditar={() => { abrirEditar(verItem); setVerItem(null) }}
          campos={[
            { label:'Número',         valor:verItem.num },
            { label:'Prioridade',     valor:verItem.prioridade },
            { label:'Status',         valor:STATUS_L[verItem.status] || verItem.status },
            { label:'Responsável',    valor:verItem.responsavel_tipo },
            { label:'Recorrência',    valor:verItem.recorrencia },
            { label:'Empresa',        valor:verItem.empresa },
            { label:'Condição de pagamento', valor:orcsFechados[verItem.id]?.condicao },
            { label:'Motivo da escolha', valor: orcsFechados[verItem.id]?.sem_orcamento
                ? `(SEM ORÇAMENTO PRÉVIO) ${orcsFechados[verItem.id]?.motivo || ''}`
                : orcsFechados[verItem.id]?.motivo, tipo:'longtext' },
            { label:'Valor previsto', valor:verItem.valor_previsto, tipo:'moeda' },
            { label:'Valor realizado',valor:verItem.valor_realizado, tipo:'moeda' },
            { label:'Início previsto',valor:verItem.data_inicio_prevista, tipo:'data' },
            { label:'Início real',    valor:verItem.data_inicio_real, tipo:'data' },
            { label:'Conclusão',      valor:verItem.data_fim, tipo:'data' },
            { label:'Observações',    valor:verItem.obs, tipo:'longtext' },
          ]}
        />
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { exportarParaExcel } from '../utils/excel'
import MapaCotacoes from './MapaCotacoes'
import ViewModal from './ViewModal'

const FREQS = ['Diário','Semanal','Quinzenal','Mensal','Bimestral','Trimestral','Semestral','Anual','A Cada 2 Anos','A Cada 3 Anos','A Cada 5 Anos']
const RESP_TIPOS = ['Zeladoria','Síndico','Terceiro']

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

export default function AtividadesDiarias({ perfil }) {
  const [itens, setItens] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [arquivo, setArquivo] = useState(null)
  const [filtroResp, setFiltroResp] = useState('Todos')
  const [filtroFreq, setFiltroFreq] = useState('Todos')
  const [cotacoesItem, setCotacoesItem] = useState(null)
  const [verItem, setVerItem] = useState(null)
  const isAdmin = perfil?.perfil === 'admin' || perfil?.perfil === 'sindico'

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data } = await supabase.from('calendario').select('*').is('excluido_em', null).order('num')
    setItens(data || [])
  }
  function proximoNum() {
    if (!itens.length) return 1
    return Math.max(...itens.map(i => parseInt(i.num) || 0)) + 1
  }
  function abrirNovo() {
    setForm({ num:String(proximoNum()), descricao:'', frequencia:'Mensal', mes:'', status:'nrealizado', responsavel_tipo:'Zeladoria', valor:null, proxima_data:null })
    setArquivo(null); setModal('novo')
  }
  function abrirEditar(item) { setForm({ ...item }); setArquivo(null); setModal('editar') }

  async function excluir(item) {
    if (!confirm(`Excluir "${item.descricao}"? Orçamentos vinculados também serão excluídos.`)) return
    try {
      const r1 = await supabase.from('calendario').update({ excluido_em: new Date().toISOString() }).eq('id', item.id)
      if (r1.error) throw r1.error
      await supabase.rpc('soft_delete_cascade_orcamentos', { p_item_tipo:'atividade', p_item_id:item.id })
      carregar()
    } catch (e) {
      alert('Erro ao excluir: ' + (e?.message || JSON.stringify(e)))
    }
  }

  async function salvar() {
    try {
      let evidencia_url = form.evidencia_url || ''
      if (arquivo) {
        const ext = arquivo.name.split('.').pop()
        const path = `calendario/${Date.now()}.${ext}`
        const upRes = await supabase.storage.from('evidencias').upload(path, arquivo)
        if (upRes.error) throw upRes.error
        const { data: u } = supabase.storage.from('evidencias').getPublicUrl(path)
        evidencia_url = u.publicUrl
      }
      const realizado_em  = form.status === 'realizado' ? new Date().toISOString() : null
      const realizado_por = form.status === 'realizado' ? (perfil?.nome || '') : null
      // Monta payload removendo undefined e strings vazias para campos nullable
      const raw = { ...form, evidencia_url, realizado_em, realizado_por }
      const payload = {}
      Object.keys(raw).forEach(k => {
        const v = raw[k]
        if (v === undefined) return
        if (v === '' && k !== 'descricao') return  // string vazia vira "não envia"
        payload[k] = v
      })
      let result
      if (modal === 'novo') {
        delete payload.id
        result = await supabase.from('calendario').insert([payload])
      } else {
        const { id, ...resto } = payload
        result = await supabase.from('calendario').update(resto).eq('id', id)
      }
      if (result.error) throw result.error
      setModal(null); carregar()
    } catch (e) {
      alert('Erro ao salvar: ' + (e?.message || JSON.stringify(e)))
    }
  }

  const itensFiltrados = itens.filter(i => {
    if (filtroResp !== 'Todos' && i.responsavel_tipo !== filtroResp) return false
    if (filtroFreq !== 'Todos' && i.frequencia !== filtroFreq) return false
    return true
  })

  const realizados = itens.filter(i => i.status === 'realizado').length
  const pendentes = itens.length - realizados

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
      <div className="page-title">Atividades do Dia a Dia</div>
      <div className="page-sub">Tarefas recorrentes — limpeza, vistorias e rotinas de manutenção preventiva</div>

      <div className="stat-grid">
        <div className="stat"><div className="stat-n">{itens.length}</div><div className="stat-l">Total</div></div>
        <div className="stat"><div className="stat-n" style={{color:'var(--amarelo)'}}>{pendentes}</div><div className="stat-l">Pendentes</div></div>
        <div className="stat"><div className="stat-n" style={{color:'var(--verde)'}}>{realizados}</div><div className="stat-l">Realizados</div></div>
        <div className="stat"><div className="stat-n" style={{color:'var(--azul)'}}>{itens.filter(i=>i.responsavel_tipo==='Zeladoria').length}</div><div className="stat-l">Da zeladoria</div></div>
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
          <div style={{fontSize:11, color:'var(--texto-ter)', marginBottom:5}}>FREQUÊNCIA</div>
          <div style={{display:'flex', gap:4, flexWrap:'wrap'}}>
            {['Todos',...FREQS].map(f => (
              <span key={f}>{btnFiltro(filtroFreq===f, () => setFiltroFreq(f), f)}</span>
            ))}
          </div>
        </div>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>{isAdmin && <button className="btn btn-success" onClick={abrirNovo}>+ Adicionar atividade</button>}<button className="btn btn-sm" onClick={()=>exportarParaExcel(itensFiltrados.map(i=>({Num:i.num,Descrição:i.descricao,Frequência:i.frequencia,Responsável:i.responsavel_tipo,Status:i.status==="realizado"?"Realizado":"Pendente",Próxima:i.proxima_data,Valor:i.valor})),"atividades_dia_a_dia.xlsx","Atividades")}><i className="fa-solid fa-file-excel" style={{marginRight:6}}></i>Exportar Excel</button></div>

      <div style={{fontSize:12, color:'var(--texto-sec)', marginBottom:8}}>
        Exibindo {itensFiltrados.length} de {itens.length} itens
      </div>

      <div className="card card-azul" style={{padding:0,overflow:'hidden'}}>
        <table>
          <thead>
            <tr>
              <th>#</th><th>Descrição</th><th>Frequência</th>
              <th>Responsável</th><th>Status</th><th>Próxima</th><th>Valor</th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {itensFiltrados.map(c => (
              <tr key={c.id} onDoubleClick={() => setVerItem(c)} style={{cursor:'pointer'}}>
                <td style={{color:'var(--texto-sec)'}}>{c.num}</td>
                <td style={{fontWeight:500}}>{c.descricao}</td>
                <td>{c.frequencia}</td>
                <td>
                  <span style={{fontSize:11, padding:'2px 7px', borderRadius:6, fontWeight:500,
                    background: c.responsavel_tipo==='Zeladoria' ? 'var(--azul-bg)' : c.responsavel_tipo==='Síndico' ? 'var(--amarelo-bg)' : 'var(--cinza-bg)',
                    color: c.responsavel_tipo==='Zeladoria' ? 'var(--azul)' : c.responsavel_tipo==='Síndico' ? 'var(--amarelo)' : 'var(--cinza)'
                  }}>{c.responsavel_tipo||'—'}</span>
                </td>
                <td>
                  {c.status==='realizado'
                    ? <span className="badge badge-realizado"><i className="fa-solid fa-check" style={{marginRight:3}}></i>Realizado</span>
                    : <span className="badge badge-pendente">Pendente</span>}
                </td>
                <td>{c.proxima_data ? fmtDataBR(c.proxima_data) : <span style={{color:'var(--texto-ter)'}}>—</span>}</td>
                <td style={{whiteSpace:'nowrap',fontWeight:500}}>{c.valor != null ? fmtMoeda(c.valor) : <span style={{color:'var(--texto-ter)',fontWeight:400}}>—</span>}</td>
                {isAdmin && (
                  <td style={{display:'flex',gap:4}}>
                    <button className="btn btn-sm" onClick={() => abrirEditar(c)}>Editar</button>
                    <button className="btn btn-sm" style={{background:'var(--azul-bg)',color:'var(--azul)',borderColor:'var(--azul)'}}
                      title="Mapa de cotações"
                      onClick={() => setCotacoesItem({ tipo:'atividade', id:c.id, nome:c.descricao })}>
                      <i className="fa-solid fa-chart-column"></i>
                    </button>
                    <button className="btn btn-sm btn-danger" title="Excluir" onClick={() => excluir(c)}>
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
          <div className="modal">
            <h3>{modal==='novo' ? 'Nova atividade' : 'Editar atividade'}</h3>
            <div className="form-group">
              <label>Número {modal==='novo' && <span style={{color:'var(--texto-ter)'}}>(automático)</span>}</label>
              <input value={form.num||''} readOnly style={{background:'var(--cinza-bg)',color:'var(--texto-sec)',cursor:'not-allowed'}}/>
            </div>
            <div className="form-group"><label>Descrição</label><input value={form.descricao||''} onChange={e => setForm({...form,descricao:e.target.value})}/></div>
            <div className="form-group">
              <label>Frequência</label>
              <select value={form.frequencia||'Mensal'} onChange={e => setForm({...form,frequencia:e.target.value})}>
                {FREQS.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Próxima data prevista</label>
              <input type="date" value={form.proxima_data ? String(form.proxima_data).slice(0,10) : ''} onChange={e => setForm({...form, proxima_data: e.target.value || null})}/>
            </div>
            <div className="form-group">
              <label>Responsável (tipo)</label>
              <select value={form.responsavel_tipo||'Zeladoria'} onChange={e => setForm({...form,responsavel_tipo:e.target.value})}>
                {RESP_TIPOS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status||'nrealizado'} onChange={e => setForm({...form,status:e.target.value})}>
                <option value="nrealizado">Não realizado</option>
                <option value="realizado">Realizado</option>
              </select>
            </div>
            <div className="form-group"><label>Foto / evidência</label><input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={e => setArquivo(e.target.files[0])}/></div>
            {form.evidencia_url && <div style={{marginBottom:10}}><a href={form.evidencia_url} target="_blank" rel="noreferrer" style={{fontSize:12,color:'var(--azul)'}}><i className="fa-solid fa-camera" style={{marginRight:4}}></i>Ver evidência atual</a></div>}
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
          tipoLabel="Atividade do Dia a Dia"
          perfil={perfil}
          onFechar={() => { setCotacoesItem(null); carregar() }}
        />
      )}

      {verItem && (
        <ViewModal
          titulo={verItem.descricao}
          subtitulo={`Atividade do Dia a Dia · Item ${verItem.num}`}
          corBorda="var(--azul)"
          onFechar={() => setVerItem(null)}
          onEditar={() => { abrirEditar(verItem); setVerItem(null) }}
          campos={[
            { label:'Número',          valor:verItem.num },
            { label:'Frequência',      valor:verItem.frequencia },
            { label:'Mês',             valor:verItem.mes },
            { label:'Responsável',     valor:verItem.responsavel_tipo },
            { label:'Status',          valor:verItem.status==='realizado'?'Realizado':'Pendente' },
            { label:'Próxima data',    valor:verItem.proxima_data, tipo:'data' },
            { label:'Valor',           valor:verItem.valor, tipo:'moeda' },
            { label:'Realizado em',    valor:verItem.realizado_em, tipo:'datahora' },
            { label:'Realizado por',   valor:verItem.realizado_por },
          ]}
        />
      )}
    </div>
  )
}

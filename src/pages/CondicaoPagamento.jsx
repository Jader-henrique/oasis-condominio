import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { exportarParaExcel } from '../utils/excel'
import ViewModal from './ViewModal'
import { useSort, SortableTh } from '../utils/useSort'

const TIPOS = ['Proporcional', 'Desproporcional']

function Badge({ tipo }) {
  const c = tipo === 'Proporcional'
    ? { bg:'var(--azul-bg)', cor:'var(--azul)' }
    : { bg:'var(--lilas-bg)', cor:'var(--lilas)' }
  return (
    <span style={{ fontSize:11, padding:'2px 8px', borderRadius:6, fontWeight:500, background:c.bg, color:c.cor }}>
      {tipo}
    </span>
  )
}

function fmtPct(v) {
  const n = parseFloat(v)
  return isNaN(n) ? '0,00%' : n.toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 }) + '%'
}
function fmtDataHora(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' }) } catch { return '—' }
}

function PctInputs({ n, valores, onChange }) {
  const soma = valores.reduce((s, v) => s + (parseFloat(v)||0), 0)
  const ok = Math.abs(soma - 100) < 0.01
  return (
    <div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:4 }}>
        {Array.from({ length: n }, (_, i) => (
          <div key={i} style={{ minWidth:70 }}>
            <div style={{ fontSize:10, color:'var(--texto-ter)', marginBottom:2 }}>Parcela {i+1}</div>
            <input
              type="number" min="0" max="100" step="0.01"
              placeholder="0,00"
              value={valores[i] ?? ''}
              onChange={e => {
                const next = [...valores]
                next[i] = e.target.value === '' ? '' : parseFloat(e.target.value)
                onChange(next)
              }}
              style={{ width:70, padding:'5px 6px', fontSize:12 }}
            />
          </div>
        ))}
      </div>
      <div style={{
        fontSize:11, fontWeight:500,
        color: ok ? 'var(--verde)' : 'var(--vermelho)',
        marginTop:2
      }}>
        Soma: {fmtPct(soma)}{ok ? ' ✓ OK' : ' — deve ser 100%'}
      </div>
    </div>
  )
}

export default function CondicaoPagamento({ perfil }) {
  const [itens, setItens] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [pcts, setPcts] = useState([])
  const [verItem, setVerItem] = useState(null)
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('Todos')
  const isAdmin = perfil?.perfil === 'admin' || perfil?.perfil === 'sindico'
  const { sortBy, sortDir, onSort, ordenar } = useSort('id', 'asc')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data } = await supabase
      .from('condicao_pagamento')
      .select('*')
      .is('excluido_em', null)
      .order('id')
    setItens(data || [])
  }

  function novoForm() {
    return { descricao:'', tipo:'Proporcional', num_parcelas:1, intervalo:30 }
  }

  function abrirNovo() {
    const f = novoForm()
    setForm(f)
    setPcts([])
    setModal('novo')
  }
  function abrirEditar(item) {
    setForm({ ...item })
    setPcts(item.percentuais || [])
    setModal('editar')
  }

  function handleNumParcelas(val) {
    const n = parseInt(val, 10) || 1
    setForm(f => ({ ...f, num_parcelas: n }))
    setPcts(prev => {
      const next = [...prev]
      while (next.length < n) next.push('')
      return next.slice(0, n)
    })
  }

  async function salvar() {
    if (!form.descricao?.trim()) { alert('Informe a descrição'); return }
    const np = parseInt(form.num_parcelas, 10)
    const iv = parseInt(form.intervalo, 10)
    if (!np || np < 1) { alert('Nº de parcelas deve ser um inteiro positivo'); return }
    if (!iv || iv < 1) { alert('Intervalo deve ser um inteiro positivo'); return }

    let percentuais = null
    if (form.tipo === 'Desproporcional') {
      const vals = pcts.slice(0, np).map(v => parseFloat(v)||0)
      const soma = vals.reduce((s, v) => s + v, 0)
      if (Math.abs(soma - 100) > 0.01) {
        alert(`A soma dos percentuais deve ser 100%. Soma atual: ${soma.toFixed(2)}%`); return
      }
      percentuais = vals
    }

    try {
      const payload = {
        descricao:    form.descricao.trim(),
        tipo:         form.tipo,
        num_parcelas: np,
        intervalo:    iv,
        percentuais,
      }
      let result
      if (modal === 'novo') {
        result = await supabase.from('condicao_pagamento').insert([payload])
      } else {
        result = await supabase.from('condicao_pagamento').update(payload).eq('id', form.id)
      }
      if (result.error) throw result.error
      setModal(null); carregar()
    } catch (e) {
      alert('Erro ao salvar: ' + (e?.message || JSON.stringify(e)))
    }
  }

  async function excluir(item) {
    if (!confirm(`Excluir condição "${item.descricao}"?`)) return
    try {
      const r = await supabase
        .from('condicao_pagamento')
        .update({ excluido_em: new Date().toISOString() })
        .eq('id', item.id)
      if (r.error) throw r.error
      carregar()
    } catch (e) {
      alert('Erro ao excluir: ' + (e?.message || JSON.stringify(e)))
    }
  }

  const itensFiltrados = itens.filter(i => {
    if (filtroTipo !== 'Todos' && i.tipo !== filtroTipo) return false
    if (busca) {
      const k = busca.toLowerCase()
      if (!(i.descricao||'').toLowerCase().includes(k)) return false
    }
    return true
  })

  function exportar() {
    const dados = itensFiltrados.map(i => ({
      ID:           i.id,
      Descrição:    i.descricao,
      Tipo:         i.tipo,
      'Nº Parcelas':i.num_parcelas,
      Intervalo:    i.intervalo,
      Percentuais:  i.percentuais ? i.percentuais.map((v,j)=>`P${j+1}:${v}%`).join(' | ') : '',
      'Cadastrado em': fmtDataHora(i.criado_em),
    }))
    exportarParaExcel(dados, 'condicoes_pagamento.xlsx', 'Condições de Pagamento')
  }

  const btnFiltro = (ativo, onClick, label) => (
    <button onClick={onClick} style={{
      padding:'5px 10px', borderRadius:6, fontSize:11, cursor:'pointer', fontWeight: ativo?500:400,
      background: ativo?'var(--azul)':'var(--cinza-bg)',
      color: ativo?'#fff':'var(--texto-sec)',
      border: ativo?'none':'0.5px solid var(--borda)'
    }}>{label}</button>
  )

  const isDesprop = form.tipo === 'Desproporcional'
  const np = parseInt(form.num_parcelas, 10) || 1

  return (
    <div>
      <div className="page-title">Condições de Pagamento</div>
      <div className="page-sub">Parcelamentos e formas de pagamento com distribuição proporcional ou personalizada</div>

      <div className="stat-grid">
        <div className="stat"><div className="stat-n">{itens.length}</div><div className="stat-l">Total</div></div>
        <div className="stat">
          <div className="stat-n" style={{color:'var(--azul)'}}>{itens.filter(i=>i.tipo==='Proporcional').length}</div>
          <div className="stat-l">Proporcionais</div>
        </div>
        <div className="stat">
          <div className="stat-n" style={{color:'var(--lilas)'}}>{itens.filter(i=>i.tipo==='Desproporcional').length}</div>
          <div className="stat-l">Desproporcionais</div>
        </div>
      </div>

      <div style={{ display:'flex', gap:16, marginBottom:14, flexWrap:'wrap', alignItems:'flex-end' }}>
        <div>
          <div style={{ fontSize:11, color:'var(--texto-ter)', marginBottom:5 }}>TIPO</div>
          <div style={{ display:'flex', gap:4 }}>
            {['Todos',...TIPOS].map(t => (
              <span key={t}>{btnFiltro(filtroTipo===t, () => setFiltroTipo(t), t)}</span>
            ))}
          </div>
        </div>
        <div className="form-group" style={{ marginBottom:0, minWidth:200, flex:1 }}>
          <label style={{ fontSize:10, color:'var(--texto-ter)' }}>Buscar</label>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="descrição..." style={{ padding:'6px 8px' }}/>
        </div>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        {isAdmin && (
          <button className="btn btn-success" onClick={abrirNovo}>
            <i className="fa-solid fa-plus" style={{ marginRight:6 }}></i>Nova condição
          </button>
        )}
        <button className="btn btn-sm" onClick={exportar}>
          <i className="fa-solid fa-file-excel" style={{ marginRight:6 }}></i>Exportar Excel
        </button>
      </div>

      <div style={{ fontSize:12, color:'var(--texto-sec)', marginBottom:8 }}>
        Exibindo {itensFiltrados.length} de {itens.length} condições
      </div>

      <div className="card card-cinza" style={{ padding:0, overflow:'hidden' }}>
        <table>
          <thead>
            <tr>
              <SortableTh col="id"           label="ID"           sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              <SortableTh col="descricao"    label="Descrição"    sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              <SortableTh col="tipo"         label="Tipo"         sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              <SortableTh col="num_parcelas" label="Nº Parcelas"  sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              <SortableTh col="intervalo"    label="Intervalo"    sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              <th>Percentuais</th>
              <SortableTh col="criado_em"    label="Cadastrado em" sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {ordenar(itensFiltrados).map(item => (
              <tr key={item.id} onDoubleClick={() => setVerItem(item)} style={{ cursor:'pointer' }}>
                <td style={{ color:'var(--texto-sec)', fontSize:12 }}>{item.id}</td>
                <td style={{ fontWeight:500 }}>{item.descricao}</td>
                <td><Badge tipo={item.tipo}/></td>
                <td style={{ textAlign:'center', fontWeight:500 }}>{item.num_parcelas}</td>
                <td style={{ textAlign:'center', color:'var(--texto-sec)' }}>
                  {item.intervalo} {item.intervalo === 1 ? 'dia' : 'dias'}
                </td>
                <td>
                  {item.tipo === 'Desproporcional' && item.percentuais?.length > 0 ? (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                      {item.percentuais.map((p, i) => (
                        <span key={i} style={{ fontSize:10, padding:'1px 5px', borderRadius:4,
                          background:'var(--lilas-bg)', color:'var(--lilas)', fontWeight:500 }}>
                          P{i+1}: {fmtPct(p)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color:'var(--texto-ter)', fontSize:11 }}>
                      {item.tipo === 'Proporcional' ? `${(100/item.num_parcelas).toFixed(2)}% × ${item.num_parcelas}` : '—'}
                    </span>
                  )}
                </td>
                <td style={{ fontSize:11, color:'var(--texto-sec)', whiteSpace:'nowrap' }}>{fmtDataHora(item.criado_em)}</td>
                {isAdmin && (
                  <td style={{ display:'flex', gap:4 }}>
                    <button className="btn btn-sm" onClick={e => { e.stopPropagation(); abrirEditar(item) }}>Editar</button>
                    <button className="btn btn-sm btn-danger" title="Excluir" onClick={e => { e.stopPropagation(); excluir(item) }}>
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {itensFiltrados.length === 0 && (
              <tr><td colSpan={isAdmin?8:7} style={{ textAlign:'center', padding:24, color:'var(--texto-ter)' }}>
                Nenhuma condição de pagamento cadastrada.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth:520 }}>
            <h3>{modal==='novo' ? 'Nova condição de pagamento' : 'Editar condição de pagamento'}</h3>

            {modal==='editar' && (
              <div className="form-group">
                <label>ID <span style={{ color:'var(--texto-ter)', fontSize:11 }}>(automático)</span></label>
                <input value={form.id||''} readOnly style={{ background:'var(--cinza-bg)', color:'var(--texto-sec)', cursor:'not-allowed' }}/>
              </div>
            )}

            <div className="form-group">
              <label>Descrição</label>
              <input autoFocus value={form.descricao||''} onChange={e => setForm({...form,descricao:e.target.value})}
                placeholder="Ex: 30/60/90 dias"/>
            </div>

            <div className="form-group">
              <label>Tipo</label>
              <select value={form.tipo||'Proporcional'} onChange={e => {
                const t = e.target.value
                setForm(f => ({ ...f, tipo:t }))
                if (t === 'Desproporcional') {
                  const n = parseInt(form.num_parcelas,10) || 1
                  setPcts(prev => {
                    const next = [...prev]
                    while (next.length < n) next.push('')
                    return next.slice(0,n)
                  })
                }
              }}>
                {TIPOS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>

            <div style={{ display:'flex', gap:12 }}>
              <div className="form-group" style={{ flex:1 }}>
                <label>Nº de Parcelas</label>
                <input
                  type="number" min="1" step="1"
                  value={form.num_parcelas||''}
                  onChange={e => handleNumParcelas(e.target.value)}
                  placeholder="Ex: 3"
                />
              </div>
              <div className="form-group" style={{ flex:1 }}>
                <label>Intervalo <span style={{ color:'var(--texto-ter)', fontSize:11 }}>(dias)</span></label>
                <input
                  type="number" min="1" step="1"
                  value={form.intervalo||''}
                  onChange={e => setForm({...form, intervalo: parseInt(e.target.value,10)||''})}
                  placeholder="Ex: 30"
                />
              </div>
            </div>

            <div className="form-group" style={{ opacity: isDesprop ? 1 : 0.4, transition:'opacity 0.2s' }}>
              <label>
                Percentuais por parcela
                {!isDesprop && (
                  <span style={{ color:'var(--texto-ter)', fontSize:11, marginLeft:6 }}>(disponível apenas para Desproporcional)</span>
                )}
              </label>
              {isDesprop ? (
                <PctInputs n={np} valores={pcts} onChange={setPcts}/>
              ) : (
                <div style={{ fontSize:12, color:'var(--texto-ter)', padding:'8px 0' }}>
                  Proporcionais: {np} × {(100/np).toFixed(2)}% automaticamente
                </div>
              )}
            </div>

            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:12 }}>
              <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvar}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {verItem && (
        <ViewModal
          titulo={verItem.descricao}
          subtitulo={`Condição de Pagamento · ID ${verItem.id}`}
          corBorda={verItem.tipo==='Proporcional' ? 'var(--azul)' : 'var(--lilas)'}
          onFechar={() => setVerItem(null)}
          onEditar={isAdmin ? () => { abrirEditar(verItem); setVerItem(null) } : null}
          campos={[
            { label:'ID',           valor:verItem.id },
            { label:'Descrição',    valor:verItem.descricao },
            { label:'Tipo',         valor:verItem.tipo },
            { label:'Nº Parcelas',  valor:verItem.num_parcelas },
            { label:'Intervalo',    valor:`${verItem.intervalo} dias` },
            { label:'Percentuais',  valor: verItem.percentuais
                ? verItem.percentuais.map((p,i)=>`P${i+1}: ${fmtPct(p)}`).join(' | ')
                : `${(100/(verItem.num_parcelas||1)).toFixed(2)}% × ${verItem.num_parcelas} (proporcional)` },
            { label:'Cadastrado em', valor:verItem.criado_em, tipo:'datahora' },
          ]}
        />
      )}
    </div>
  )
}

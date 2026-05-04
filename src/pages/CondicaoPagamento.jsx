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

function Toggle({ ativo, onChange, label }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }} onClick={() => onChange(!ativo)}>
      <div style={{
        width:36, height:20, borderRadius:10, position:'relative', transition:'background 0.2s',
        background: ativo ? 'var(--verde)' : '#ccc', flexShrink:0
      }}>
        <div style={{
          position:'absolute', top:2, left: ativo ? 18 : 2,
          width:16, height:16, borderRadius:'50%', background:'#fff',
          transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.25)'
        }}/>
      </div>
      <span style={{ fontSize:13, color:'var(--texto-sec)', userSelect:'none' }}>{label}</span>
    </div>
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

// Inputs de percentual para P1..Pn. somaEsperada = quanto os Pn devem somar.
function PctInputs({ n, valores, onChange, somaEsperada = 100 }) {
  const soma = valores.reduce((s, v) => s + (parseFloat(v)||0), 0)
  const ok = Math.abs(soma - somaEsperada) < 0.01
  return (
    <div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:4 }}>
        {Array.from({ length: n }, (_, i) => (
          <div key={i} style={{ minWidth:72 }}>
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
              style={{ width:72, padding:'5px 6px', fontSize:12 }}
            />
          </div>
        ))}
      </div>
      <div style={{ fontSize:11, fontWeight:500, color: ok ? 'var(--verde)' : 'var(--vermelho)', marginTop:2 }}>
        Soma P1–P{n}: {fmtPct(soma)}
        {somaEsperada !== 100 && <span style={{ color:'var(--texto-ter)', fontWeight:400 }}> (esperado {fmtPct(somaEsperada)})</span>}
        {ok ? ' ✓ OK' : ` — faltam ${fmtPct(somaEsperada - soma)}`}
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

  function abrirNovo() {
    setForm({ descricao:'', tipo:'Proporcional', num_parcelas:1, intervalo:30, tem_entrada:false, percentual_entrada:'' })
    setPcts([])
    setModal('novo')
  }
  function abrirEditar(item) {
    setForm({
      ...item,
      tem_entrada: item.tem_entrada || false,
      percentual_entrada: item.percentual_entrada ?? '',
    })
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

  function handleTipoChange(t) {
    setForm(f => ({ ...f, tipo: t }))
    if (t === 'Desproporcional') {
      const n = parseInt(form.num_parcelas, 10) || 1
      setPcts(prev => {
        const next = [...prev]
        while (next.length < n) next.push('')
        return next.slice(0, n)
      })
    }
  }

  async function salvar() {
    if (!form.descricao?.trim()) { alert('Informe a descrição'); return }
    const np = parseInt(form.num_parcelas, 10)
    const iv = parseInt(form.intervalo, 10)
    if (!np || np < 1) { alert('Nº de parcelas deve ser um inteiro positivo'); return }
    if (!iv || iv < 1) { alert('Intervalo deve ser um inteiro positivo'); return }

    const temEntrada = !!form.tem_entrada
    let percentuais = null
    let percentual_entrada = null

    if (form.tipo === 'Desproporcional') {
      const pctEntrada = temEntrada ? (parseFloat(form.percentual_entrada) || 0) : 0
      if (temEntrada) {
        if (pctEntrada <= 0 || pctEntrada >= 100) {
          alert('Percentual de entrada deve ser maior que 0% e menor que 100%'); return
        }
        percentual_entrada = pctEntrada
      }
      const somaEsperadaParcelas = 100 - pctEntrada
      const vals = pcts.slice(0, np).map(v => parseFloat(v)||0)
      const soma = vals.reduce((s, v) => s + v, 0)
      if (Math.abs(soma - somaEsperadaParcelas) > 0.01) {
        const msg = temEntrada
          ? `A soma das parcelas P1–P${np} deve ser ${somaEsperadaParcelas.toFixed(2)}% (100% − entrada ${pctEntrada.toFixed(2)}%). Soma atual: ${soma.toFixed(2)}%`
          : `A soma dos percentuais deve ser 100%. Soma atual: ${soma.toFixed(2)}%`
        alert(msg); return
      }
      percentuais = vals
    }

    try {
      const payload = {
        descricao:          form.descricao.trim(),
        tipo:               form.tipo,
        num_parcelas:       np,
        intervalo:          iv,
        tem_entrada:        temEntrada,
        percentual_entrada: percentual_entrada,
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
    if (busca && !(i.descricao||'').toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  function exportar() {
    const dados = itensFiltrados.map(i => {
      const pctStr = i.tipo === 'Desproporcional' && i.percentuais
        ? [
            i.tem_entrada && i.percentual_entrada != null ? `P0(entrada):${i.percentual_entrada}%` : null,
            ...i.percentuais.map((v,j)=>`P${j+1}:${v}%`),
          ].filter(Boolean).join(' | ')
        : ''
      return {
        ID:             i.id,
        Descrição:      i.descricao,
        Tipo:           i.tipo,
        'Tem Entrada':  i.tem_entrada ? 'Sim' : 'Não',
        'Nº Parcelas':  i.num_parcelas,
        Intervalo:      i.intervalo,
        'Entrada (%)':  i.tem_entrada && i.percentual_entrada != null ? i.percentual_entrada : '',
        Percentuais:    pctStr,
        'Cadastrado em': fmtDataHora(i.criado_em),
      }
    })
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

  // Helpers derivados do form
  const isDesprop    = form.tipo === 'Desproporcional'
  const temEntrada   = !!form.tem_entrada
  const np           = parseInt(form.num_parcelas, 10) || 1
  const pctEntrada   = parseFloat(form.percentual_entrada) || 0
  const somaEsperada = isDesprop && temEntrada ? Math.max(0, 100 - pctEntrada) : 100

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
        <div className="stat">
          <div className="stat-n" style={{color:'var(--verde)'}}>{itens.filter(i=>i.tem_entrada).length}</div>
          <div className="stat-l">Com entrada</div>
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
              <th>Distribuição</th>
              <SortableTh col="criado_em"    label="Cadastrado em" sortBy={sortBy} sortDir={sortDir} onSort={onSort}/>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {ordenar(itensFiltrados).map(item => (
              <tr key={item.id} onDoubleClick={() => setVerItem(item)} style={{ cursor:'pointer' }}>
                <td style={{ color:'var(--texto-sec)', fontSize:12 }}>{item.id}</td>
                <td>
                  <div style={{ fontWeight:500 }}>{item.descricao}</div>
                  {item.tem_entrada && (
                    <span style={{ fontSize:10, padding:'1px 5px', borderRadius:4,
                      background:'var(--verde-bg)', color:'var(--verde)', fontWeight:500 }}>
                      com entrada
                    </span>
                  )}
                </td>
                <td><Badge tipo={item.tipo}/></td>
                <td style={{ textAlign:'center', fontWeight:500 }}>{item.num_parcelas}</td>
                <td style={{ textAlign:'center', color:'var(--texto-sec)' }}>
                  {item.intervalo} {item.intervalo === 1 ? 'dia' : 'dias'}
                </td>
                <td>
                  {item.tipo === 'Desproporcional' && item.percentuais?.length > 0 ? (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                      {item.tem_entrada && item.percentual_entrada != null && (
                        <span style={{ fontSize:10, padding:'1px 5px', borderRadius:4,
                          background:'var(--verde-bg)', color:'var(--verde)', fontWeight:500 }}>
                          P0 (entrada): {fmtPct(item.percentual_entrada)}
                        </span>
                      )}
                      {item.percentuais.map((p, i) => (
                        <span key={i} style={{ fontSize:10, padding:'1px 5px', borderRadius:4,
                          background:'var(--lilas-bg)', color:'var(--lilas)', fontWeight:500 }}>
                          P{i+1}: {fmtPct(p)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color:'var(--texto-ter)', fontSize:11 }}>
                      {item.tipo === 'Proporcional'
                        ? `${(100/item.num_parcelas).toFixed(2)}% × ${item.num_parcelas}${item.tem_entrada ? ' (entrada inclusa)' : ''}`
                        : '—'}
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

      {/* ── Modal de criação/edição ── */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth:540 }}>
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
                placeholder="Ex: Entrada + 3x 30 dias"/>
            </div>

            <div className="form-group">
              <label>Tipo</label>
              <select value={form.tipo||'Proporcional'} onChange={e => handleTipoChange(e.target.value)}>
                {TIPOS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>

            <div style={{ display:'flex', gap:12 }}>
              <div className="form-group" style={{ flex:1 }}>
                <label>Nº de Parcelas</label>
                <input type="number" min="1" step="1" value={form.num_parcelas||''} placeholder="Ex: 3"
                  onChange={e => handleNumParcelas(e.target.value)}/>
              </div>
              <div className="form-group" style={{ flex:1 }}>
                <label>Intervalo <span style={{ color:'var(--texto-ter)', fontSize:11 }}>(dias)</span></label>
                <input type="number" min="1" step="1" value={form.intervalo||''} placeholder="Ex: 30"
                  onChange={e => setForm({...form, intervalo: parseInt(e.target.value,10)||''})}/>
              </div>
            </div>

            {/* Toggle de entrada */}
            <div className="form-group">
              <Toggle
                ativo={temEntrada}
                onChange={v => setForm(f => ({ ...f, tem_entrada: v, percentual_entrada: v ? f.percentual_entrada : '' }))}
                label="Tem entrada (pagamento à vista)"
              />
            </div>

            {/* Percentual de entrada — só Desproporcional + tem_entrada */}
            {isDesprop && temEntrada && (
              <div className="form-group">
                <label>
                  Percentual de entrada — <strong>Parcela 0</strong>
                  <span style={{ color:'var(--texto-ter)', fontSize:11, marginLeft:6 }}>(%)</span>
                </label>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <input
                    type="number" min="0.01" max="99.99" step="0.01"
                    value={form.percentual_entrada ?? ''}
                    placeholder="Ex: 30,00"
                    onChange={e => setForm(f => ({ ...f, percentual_entrada: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
                    style={{ width:100 }}
                  />
                  {pctEntrada > 0 && (
                    <span style={{ fontSize:12, color:'var(--texto-sec)' }}>
                      → Parcelas P1–P{np} devem somar <strong>{fmtPct(100 - pctEntrada)}</strong>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Aviso Proporcional + entrada */}
            {!isDesprop && temEntrada && (
              <div style={{
                background:'var(--amarelo-bg)', border:'0.5px solid #e8c840',
                borderRadius:8, padding:'10px 12px', marginBottom:12, fontSize:12, color:'#7a5c00'
              }}>
                <i className="fa-solid fa-circle-info" style={{ marginRight:6 }}></i>
                Para pagamento proporcional com entrada, considere a parcela à vista
                no total de parcelas informado acima. Exemplo: entrada + 2 parcelas = <strong>3 parcelas</strong> no campo Nº de Parcelas.
              </div>
            )}

            {/* Percentuais P1..Pn — só Desproporcional */}
            <div className="form-group" style={{ opacity: isDesprop ? 1 : 0.4, transition:'opacity 0.2s' }}>
              <label>
                Percentuais por parcela
                {!isDesprop && <span style={{ color:'var(--texto-ter)', fontSize:11, marginLeft:6 }}>(disponível apenas para Desproporcional)</span>}
              </label>
              {isDesprop ? (
                <PctInputs n={np} valores={pcts} onChange={setPcts} somaEsperada={somaEsperada}/>
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

      {/* ── ViewModal ── */}
      {verItem && (
        <ViewModal
          titulo={verItem.descricao}
          subtitulo={`Condição de Pagamento · ID ${verItem.id}`}
          corBorda={verItem.tipo==='Proporcional' ? 'var(--azul)' : 'var(--lilas)'}
          onFechar={() => setVerItem(null)}
          onEditar={isAdmin ? () => { abrirEditar(verItem); setVerItem(null) } : null}
          campos={[
            { label:'ID',             valor: verItem.id },
            { label:'Descrição',      valor: verItem.descricao },
            { label:'Tipo',           valor: verItem.tipo },
            { label:'Tem entrada',    valor: verItem.tem_entrada ? 'Sim' : 'Não' },
            ...(verItem.tipo === 'Desproporcional' && verItem.tem_entrada && verItem.percentual_entrada != null
              ? [{ label:'Entrada (P0)', valor: fmtPct(verItem.percentual_entrada) }]
              : []),
            { label:'Nº Parcelas',    valor: verItem.num_parcelas },
            { label:'Intervalo',      valor: `${verItem.intervalo} dias` },
            { label:'Distribuição',   valor:
                verItem.tipo === 'Desproporcional' && verItem.percentuais
                  ? [
                      verItem.tem_entrada && verItem.percentual_entrada != null
                        ? `P0 (entrada): ${fmtPct(verItem.percentual_entrada)}`
                        : null,
                      ...verItem.percentuais.map((p,i) => `P${i+1}: ${fmtPct(p)}`),
                    ].filter(Boolean).join(' | ')
                  : `${(100/(verItem.num_parcelas||1)).toFixed(2)}% × ${verItem.num_parcelas}${verItem.tem_entrada ? ' (entrada inclusa no total)' : ''}` },
            { label:'Cadastrado em',  valor: verItem.criado_em, tipo:'datahora' },
          ]}
        />
      )}
    </div>
  )
}

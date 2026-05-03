import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

function fmtMoeda(v) {
  if (v === null || v === undefined || v === '') return '—'
  const num = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  if (isNaN(num)) return '—'
  return num.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })
}
function fmtDataBR(d) {
  if (!d) return '—'
  const s = String(d).slice(0,10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const [y,m,day] = s.split('-')
  return `${day}/${m}/${y}`
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

const TIPO_TABELA = { atividade:'calendario', corretiva:'corretivas', benfeitoria:'benfeitorias' }
const TIPO_CAMPO_VALOR = { atividade:'valor', corretiva:'valor', benfeitoria:'valor' }

export default function MapaCotacoes({ tipo, itemId, itemNome, tipoLabel, perfil, onFechar }) {
  const [orcs, setOrcs] = useState([])
  const [docs, setDocs] = useState([])
  const [novoOrc, setNovoOrc] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [fecharForm, setFecharForm] = useState(null)  // {orc, motivo}
  const isAdmin = perfil?.perfil === 'admin' || perfil?.perfil === 'sindico'

  useEffect(() => { carregar() }, [itemId, tipo])

  async function carregar() {
    const { data } = await supabase.from('orcamentos').select('*')
      .eq('item_tipo', tipo).eq('item_id', itemId).is('excluido_em', null).order('valor', { ascending:true })
    setOrcs(data || [])
    const { data: d } = await supabase.from('documentos_item').select('*')
      .eq('item_tipo', tipo).eq('item_id', itemId).order('criado_em', { ascending:false })
    setDocs(d || [])
  }

  const orcsAtivos = orcs.filter(o => !o.dispensa && !o.sem_orcamento)
  const dispensa = orcs.find(o => o.dispensa)
  const semOrc   = orcs.find(o => o.sem_orcamento)
  const selecionado = orcs.find(o => o.selecionado)
  const negocioFechado = !!selecionado || !!dispensa || !!semOrc
  const baratoId = orcsAtivos.length ? orcsAtivos.reduce((a,b) => (parseFloat(a.valor)||Infinity) < (parseFloat(b.valor)||Infinity) ? a : b).id : null

  function abrirNovoOrc() {
    setNovoOrc({ empresa:'', valor:null, data:null, prazo_entrega:'', condicao_pagamento:'', obs:'', arquivo:null })
  }
  async function salvarNovoOrc() {
    if (!novoOrc.empresa) { alert('Informe a empresa'); return }
    setSalvando(true)
    let arquivo_url = ''
    if (novoOrc.arquivo) {
      const ext = novoOrc.arquivo.name.split('.').pop()
      const path = `orcamentos/${Date.now()}.${ext}`
      await supabase.storage.from('documentos').upload(path, novoOrc.arquivo)
      const { data: u } = supabase.storage.from('documentos').getPublicUrl(path)
      arquivo_url = u.publicUrl
    }
    const payload = {
      item_tipo: tipo, item_id: itemId,
      empresa: novoOrc.empresa, valor: novoOrc.valor,
      data: novoOrc.data, prazo_entrega: novoOrc.prazo_entrega,
      condicao_pagamento: novoOrc.condicao_pagamento, obs: novoOrc.obs,
      arquivo_url, data_criacao: new Date().toISOString(),
      dispensa: false, sem_orcamento: false
    }
    await supabase.from('orcamentos').insert([payload])
    setSalvando(false); setNovoOrc(null); carregar()
  }

  async function fecharNegocio(orc, motivo) {
    setSalvando(true)
    await supabase.from('orcamentos').update({ selecionado:false, motivo_escolha:null }).eq('item_id', itemId).eq('item_tipo', tipo)
    await supabase.from('orcamentos').update({ selecionado:true, motivo_escolha:motivo, status:'realizado' }).eq('id', orc.id)
    const tabela = TIPO_TABELA[tipo]
    let update = {}
    if (tipo === 'corretiva') {
      // Para corretivas: preenche empresa, valor_realizado e marca em andamento
      update = {
        empresa: orc.empresa,
        valor_realizado: orc.valor,
        status: 'andamento'
      }
    } else if (tipo === 'benfeitoria') {
      // Para benfeitoria: preenche valor_realizado, NÃO sobrescreve previsto (que é início previsto definido na criação)
      update = { valor_realizado: orc.valor }
    } else {
      // atividade
      update = { valor_realizado: orc.valor }
    }
    await supabase.from(tabela).update(update).eq('id', itemId)
    setSalvando(false); setFecharForm(null); carregar()
  }

  async function fecharSemOrcamento() {
    const motivo = prompt('Motivo (situação emergencial):')
    if (!motivo) return
    setSalvando(true)
    await supabase.from('orcamentos').insert([{
      item_tipo: tipo, item_id: itemId,
      empresa:'(sem orçamento prévio)', valor:null,
      sem_orcamento:true, dispensa:false, selecionado:true,
      motivo_escolha: motivo, status:'realizado',
      data_criacao: new Date().toISOString()
    }])
    setSalvando(false); carregar()
  }

  async function estornar() {
    if (!confirm('Estornar fechamento do negócio? Os orçamentos voltam a ficar abertos.')) return
    setSalvando(true)
    await supabase.from('orcamentos').update({ selecionado:false, motivo_escolha:null, status:null })
      .eq('item_id', itemId).eq('item_tipo', tipo)
    await supabase.from('orcamentos').delete().eq('item_id', itemId).eq('item_tipo', tipo).eq('sem_orcamento', true)
    const tabela = TIPO_TABELA[tipo]
    let update = {}
    if (tipo === 'corretiva') {
      update = { empresa: null, valor_realizado: null, status: 'pendente' }
    } else if (tipo === 'benfeitoria') {
      update = { valor_realizado: null }
    } else {
      update = { valor_realizado: null }
    }
    await supabase.from(tabela).update(update).eq('id', itemId)
    setSalvando(false); carregar()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onFechar()}>
      <div className="modal" style={{width:760,maxWidth:'95vw'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16,gap:12}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:'var(--texto-ter)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:2}}>
              <i className="fa-solid fa-chart-column" style={{marginRight:6}}></i>Mapa de cotações · {tipoLabel}
            </div>
            <h3 style={{margin:0}}>{itemNome}</h3>
          </div>
          <button onClick={onFechar} style={{background:'var(--cinza-bg)',border:'none',borderRadius:'50%',width:32,height:32,fontSize:18,cursor:'pointer'}}>×</button>
        </div>

        {negocioFechado && (
          <div style={{
            background: semOrc ? 'var(--vermelho-bg)' : 'var(--verde-bg)',
            border: '0.5px solid ' + (semOrc ? 'var(--vermelho)' : '#97C459'),
            borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:12,
            color: semOrc ? 'var(--vermelho)' : 'var(--verde)', fontWeight:500,
            display:'flex', justifyContent:'space-between', alignItems:'center'
          }}>
            <span>
              {semOrc
                ? <><i className="fa-solid fa-triangle-exclamation" style={{marginRight:6}}></i>Negócio fechado SEM apresentação de orçamento — {semOrc.motivo_escolha}</>
                : <><i className="fa-solid fa-check" style={{marginRight:6}}></i>Negócio fechado: {selecionado?.empresa} — {fmtMoeda(selecionado?.valor)}</>
              }
            </span>
            {isAdmin && <button className="btn btn-sm" onClick={estornar} disabled={salvando}>Estornar</button>}
          </div>
        )}

        <div style={{overflowX:'auto', marginBottom:14}}>
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
            <thead>
              <tr>
                <th>Data</th><th>Empresa</th><th>Valor</th><th>Prazo</th>
                <th>Pagamento</th><th>Obs</th><th>Anexo</th>
                {isAdmin && !negocioFechado && <th></th>}
              </tr>
            </thead>
            <tbody>
              {orcsAtivos.length === 0 && (
                <tr><td colSpan={isAdmin && !negocioFechado ? 8 : 7} style={{textAlign:'center',padding:20,color:'var(--texto-ter)'}}>Nenhum orçamento ainda</td></tr>
              )}
              {orcsAtivos.map(o => {
                const ehBarato = o.id === baratoId
                const ehSel = o.selecionado
                return (
                  <tr key={o.id} style={{
                    background: ehSel ? 'var(--verde-bg)' : ehBarato ? 'var(--azul-bg)' : 'transparent',
                  }}>
                    <td>{fmtDataBR(o.data)}</td>
                    <td style={{fontWeight:500}}>
                      {o.empresa||'—'}
                      {ehBarato && !ehSel && <span style={{marginLeft:4,fontSize:10,background:'var(--azul)',color:'#fff',padding:'1px 5px',borderRadius:4}}><i className="fa-solid fa-medal" style={{marginRight:3}}></i>Menor preço</span>}
                      {ehSel && <span style={{marginLeft:4,fontSize:10,background:'var(--verde)',color:'#fff',padding:'1px 5px',borderRadius:4}}><i className="fa-solid fa-check" style={{marginRight:3}}></i>Fechado</span>}
                    </td>
                    <td style={{fontWeight:500, color: ehBarato?'var(--azul)':ehSel?'var(--verde)':'var(--texto)'}}>{fmtMoeda(o.valor)}</td>
                    <td>{o.prazo_entrega||'—'}</td>
                    <td>{o.condicao_pagamento||'—'}</td>
                    <td style={{maxWidth:120, color:'var(--texto-sec)'}}>{o.obs||'—'}</td>
                    <td>{o.arquivo_url ? <a href={o.arquivo_url} target="_blank" rel="noreferrer" style={{color:'var(--azul)'}}><i className="fa-solid fa-paperclip"></i></a> : '—'}</td>
                    {isAdmin && !negocioFechado && (
                      <td>
                        <button className="btn btn-sm btn-success" onClick={() => {
                          if (ehBarato) fecharNegocio(o, null)
                          else setFecharForm({ orc:o, motivo:'' })
                        }} disabled={salvando} title="Fechar negócio com este fornecedor">
                          <i className="fa-solid fa-handshake"></i>
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {fecharForm && (
          <div style={{background:'var(--amarelo-bg)',border:'0.5px solid var(--amarelo)',borderRadius:8,padding:14,marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:500,marginBottom:8,color:'var(--amarelo)'}}>
              <i className="fa-solid fa-triangle-exclamation" style={{marginRight:6}}></i>
              Fechar com {fecharForm.orc.empresa} ({fmtMoeda(fecharForm.orc.valor)}) — não é o menor preço
            </div>
            <div className="form-group" style={{marginBottom:8}}>
              <label>Motivo da escolha (obrigatório)</label>
              <textarea value={fecharForm.motivo} onChange={e => setFecharForm({...fecharForm, motivo:e.target.value})}
                style={{height:60}} placeholder="Justifique a escolha por uma proposta mais cara..."/>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn btn-sm" onClick={() => setFecharForm(null)}>Cancelar</button>
              <button className="btn btn-sm btn-primary" disabled={!fecharForm.motivo || salvando}
                onClick={() => fecharNegocio(fecharForm.orc, fecharForm.motivo)}>Confirmar fechamento</button>
            </div>
          </div>
        )}

        {isAdmin && !negocioFechado && (
          <div style={{display:'flex', gap:8, marginBottom:14, flexWrap:'wrap'}}>
            <button className="btn btn-success" onClick={abrirNovoOrc}>
              <i className="fa-solid fa-plus" style={{marginRight:6}}></i>Adicionar orçamento
            </button>
            <button className="btn" style={{background:'var(--vermelho-bg)',color:'var(--vermelho)',borderColor:'var(--vermelho)'}}
              onClick={fecharSemOrcamento} disabled={salvando}>
              <i className="fa-solid fa-bolt" style={{marginRight:6}}></i>Fechar sem orçamento (emergencial)
            </button>
          </div>
        )}

        {novoOrc && (
          <div style={{background:'var(--cinza-bg)',border:'0.5px solid var(--borda)',borderRadius:10,padding:14,marginBottom:14}}>
            <div style={{fontWeight:500,fontSize:13,marginBottom:10}}>Novo orçamento</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div className="form-group" style={{marginBottom:0}}>
                <label>Empresa</label>
                <input value={novoOrc.empresa} onChange={e => setNovoOrc({...novoOrc, empresa:e.target.value})}/>
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <label>Valor (R$)</label>
                <input type="text" inputMode="numeric" placeholder="R$ 0,00"
                  value={moedaInputValue(novoOrc.valor)}
                  onChange={e => setNovoOrc({...novoOrc, valor: digitsToNum(e.target.value)})}/>
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <label>Data do orçamento</label>
                <input type="date" value={novoOrc.data || ''} onChange={e => setNovoOrc({...novoOrc, data:e.target.value || null})}/>
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <label>Prazo de entrega</label>
                <input value={novoOrc.prazo_entrega} onChange={e => setNovoOrc({...novoOrc, prazo_entrega:e.target.value})} placeholder="Ex: 15 dias úteis"/>
              </div>
              <div className="form-group" style={{marginBottom:0,gridColumn:'1 / -1'}}>
                <label>Condição de pagamento</label>
                <input value={novoOrc.condicao_pagamento} onChange={e => setNovoOrc({...novoOrc, condicao_pagamento:e.target.value})} placeholder="Ex: 50% entrada + 50% na entrega"/>
              </div>
              <div className="form-group" style={{marginBottom:0,gridColumn:'1 / -1'}}>
                <label>Observações</label>
                <textarea value={novoOrc.obs} onChange={e => setNovoOrc({...novoOrc, obs:e.target.value})} style={{height:60}}/>
              </div>
              <div className="form-group" style={{marginBottom:0,gridColumn:'1 / -1'}}>
                <label>Arquivo da proposta</label>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setNovoOrc({...novoOrc, arquivo:e.target.files[0]})}/>
              </div>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:10}}>
              <button className="btn btn-sm" onClick={() => setNovoOrc(null)}>Cancelar</button>
              <button className="btn btn-sm btn-primary" onClick={salvarNovoOrc} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}

        {docs.length > 0 && (
          <div style={{borderTop:'0.5px solid var(--borda)', paddingTop:14}}>
            <div style={{fontSize:11,color:'var(--texto-ter)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8}}>Documentos vinculados</div>
            {docs.map(d => (
              <div key={d.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6,fontSize:12}}>
                <span>
                  <span style={{background:'var(--cinza-bg)',padding:'1px 6px',borderRadius:4,fontSize:10,marginRight:6}}>{d.tipo}</span>
                  {d.nome}
                </span>
                <a href={d.arquivo_url} target="_blank" rel="noreferrer" style={{color:'var(--azul)',fontSize:11}}>
                  <i className="fa-solid fa-paperclip" style={{marginRight:3}}></i>Abrir
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import * as XLSX from 'xlsx'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
function fmtMesLabel(yyyymm) {
  if (!yyyymm) return ''
  const [y, m] = yyyymm.split('-')
  return `${MESES_PT[parseInt(m,10)-1]}/${y.slice(2)}`
}
function fmtMesLabelFull(yyyymm) {
  if (!yyyymm) return ''
  const [y, m] = yyyymm.split('-')
  return `${MESES_PT[parseInt(m,10)-1]}/${y}`
}
function gerarMeses(de, ate) {
  if (!de || !ate) return []
  const res = []
  let [y,m] = de.split('-').map(Number)
  const [ey,em] = ate.split('-').map(Number)
  while (y < ey || (y===ey && m<=em)) {
    res.push(`${y}-${String(m).padStart(2,'0')}`)
    m++; if (m>12){m=1;y++}
  }
  return res
}
function dateParaMes(d) { return d ? String(d).slice(0,7) : '' }
function mesParaDate(m) { return m && m.length===7 ? m+'-01' : m }
function fmtMoeda(v) {
  if (v===null||v===undefined||v==='') return '—'
  const n = typeof v==='number'?v:parseFloat(String(v).replace(',','.'))
  if (isNaN(n)) return '—'
  return n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
}
function fmtMoedaCompact(v,tipo) {
  if (v===null||v===undefined) return ''
  const n = typeof v==='number'?v:parseFloat(String(v).replace(',','.'))
  if (isNaN(n)||n===0) return ''
  const abs = Math.abs(n)
  const str = abs.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
  return tipo==='Gasto' ? `-${str}` : str
}
function digitsToNum(str) {
  const d = String(str??'').replace(/\D/g,'')
  if (!d) return 0
  return parseInt(d,10)/100
}
function moedaInputValue(v) {
  if (!v&&v!==0) return ''
  const n = typeof v==='number'?v:parseFloat(String(v).replace(',','.'))
  if (isNaN(n)||n===0) return ''
  return n.toLocaleString('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2})
}
function fmtDataBR(d) {
  if (!d) return '—'
  return fmtMesLabelFull(String(d).slice(0,7))
}

// ─── ModalAddConta ─────────────────────────────────────────────────────────────
function ModalAddConta({ contas, jaAdicionadas, onSelect, onClose }) {
  const [busca, setBusca] = useState('')
  const disponiveis = contas
    .filter(c => !jaAdicionadas.has(c.id))
    .filter(c => !busca || (c.descricao||'').toLowerCase().includes(busca.toLowerCase())
              || (c.codigo_contabil||'').toLowerCase().includes(busca.toLowerCase()))

  const CORES_GRUPO = {
    'Atividades do Dia a Dia':{bg:'var(--azul-bg)',cor:'var(--azul)'},
    'Intervenções Corretivas':{bg:'var(--vermelho-bg)',cor:'var(--vermelho)'},
    'Benfeitorias':{bg:'var(--lilas-bg)',cor:'var(--lilas)'},
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:560}}>
        <h3>Selecionar Conta para o Orçamento</h3>
        <input autoFocus value={busca} onChange={e=>setBusca(e.target.value)}
          placeholder="Buscar por descrição ou código contábil..."
          style={{width:'100%',padding:'8px 10px',marginBottom:12,boxSizing:'border-box',borderRadius:6,border:'0.5px solid var(--borda)'}}/>
        <div style={{maxHeight:360,overflowY:'auto',border:'0.5px solid var(--borda)',borderRadius:6}}>
          {disponiveis.length===0 && (
            <div style={{padding:24,textAlign:'center',color:'var(--texto-sec)',fontSize:13}}>
              {busca?'Nenhuma conta encontrada':'Todas as contas disponíveis já foram adicionadas'}
            </div>
          )}
          {disponiveis.map(c=>{
            const gc=CORES_GRUPO[c.grupo_orcamentario]||{bg:'#eee',cor:'#666'}
            return (
              <div key={c.id} onClick={()=>onSelect(c)}
                style={{padding:'10px 14px',cursor:'pointer',borderBottom:'0.5px solid var(--borda)',
                  display:'flex',alignItems:'center',gap:10,transition:'background 0.1s'}}
                onMouseEnter={e=>e.currentTarget.style.background='var(--azul-bg)'}
                onMouseLeave={e=>e.currentTarget.style.background=''}>
                <span style={{fontSize:11,fontFamily:'monospace',color:'var(--texto-sec)',minWidth:75,flexShrink:0}}>
                  {c.codigo_contabil||'—'}
                </span>
                <span style={{flex:1,fontWeight:500,fontSize:13}}>{c.descricao}</span>
                <span style={{fontSize:10,padding:'2px 6px',borderRadius:4,fontWeight:600,flexShrink:0,
                  background:c.tipo_conta==='Receita'?'var(--verde-bg)':'var(--vermelho-bg)',
                  color:c.tipo_conta==='Receita'?'var(--verde)':'var(--vermelho)'}}>
                  {c.tipo_conta}
                </span>
                <span style={{fontSize:10,padding:'2px 6px',borderRadius:4,fontWeight:500,flexShrink:0,
                  background:gc.bg,color:gc.cor}}>{c.grupo_orcamentario}</span>
              </div>
            )
          })}
        </div>
        <div style={{display:'flex',justifyContent:'flex-end',marginTop:12}}>
          <button className="btn" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function OrcamentoCondominio({ perfil }) {
  const [view, setView] = useState('lista')
  const [orcamentos, setOrcamentos] = useState([])
  const [orcAtual, setOrcAtual] = useState(null)
  const [formHeader, setFormHeader] = useState({descricao:'',vigencia_de:'',vigencia_ate:'',saldo_inicial:0,status:'Ativo'})
  const [formItens, setFormItens] = useState([])
  const [deletedItemIds, setDeletedItemIds] = useState([])
  const [contas, setContas] = useState([])
  const [modalConta, setModalConta] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const replicouRef = useRef(new Set())
  const isAdmin = perfil?.perfil==='admin'||perfil?.perfil==='sindico'

  const meses = gerarMeses(dateParaMes(formHeader.vigencia_de), dateParaMes(formHeader.vigencia_ate))

  useEffect(()=>{ carregarLista() },[])

  async function carregarLista() {
    const {data} = await supabase.from('orcamento_cond').select('*').is('excluido_em',null).order('vigencia_de')
    setOrcamentos(data||[])
  }

  async function carregarContas() {
    const {data} = await supabase.from('contas').select('*').is('excluido_em',null).order('grupo_orcamentario').order('tipo_conta').order('descricao')
    setContas(data||[])
  }

  async function carregarDetalhe(orc) {
    setLoading(true)
    const {data:itensData} = await supabase
      .from('orcamento_cond_itens')
      .select('*, conta:conta_id(id,descricao,tipo_conta,grupo_orcamentario,codigo_contabil)')
      .eq('orcamento_id',orc.id).is('excluido_em',null).order('id')
    const itemIds=(itensData||[]).map(i=>i.id)
    let valoresData=[]
    if (itemIds.length>0) {
      const {data}=await supabase.from('orcamento_cond_valores').select('*').in('item_id',itemIds).order('competencia')
      valoresData=data||[]
    }
    const mesesOrc=gerarMeses(dateParaMes(orc.vigencia_de),dateParaMes(orc.vigencia_ate))
    const items=(itensData||[]).map(item=>{
      const vals={}
      mesesOrc.forEach(mes=>{
        const found=valoresData.find(v=>v.item_id===item.id&&dateParaMes(v.competencia)===mes)
        vals[mes]={dbValorId:found?.id||null,previsto:found?.valor_previsto??0,realizado:found?.valor_realizado??null}
      })
      return {tempId:`db_${item.id}`,dbId:item.id,conta:item.conta,valores:vals}
    })
    setFormItens(items)
    setDeletedItemIds([])
    replicouRef.current=new Set()
    setLoading(false)
  }

  function novoOrcamento() {
    setOrcAtual(null)
    setFormHeader({descricao:'',vigencia_de:'',vigencia_ate:'',saldo_inicial:0,status:'Ativo'})
    setFormItens([]);setDeletedItemIds([]);replicouRef.current=new Set()
    carregarContas();setView('form')
  }

  async function editarOrcamento(orc) {
    setOrcAtual(orc)
    setFormHeader({...orc,vigencia_de:dateParaMes(orc.vigencia_de),vigencia_ate:dateParaMes(orc.vigencia_ate),saldo_inicial:orc.saldo_inicial??0})
    await carregarDetalhe(orc);await carregarContas();setView('form')
  }

  async function verOrcamento(orc) {
    setOrcAtual(orc)
    setFormHeader({...orc,vigencia_de:dateParaMes(orc.vigencia_de),vigencia_ate:dateParaMes(orc.vigencia_ate),saldo_inicial:orc.saldo_inicial??0})
    await carregarDetalhe(orc);setView('view')
  }

  function validarContinuidade(vigDe, vigAte) {
    const outros=orcamentos.filter(o=>!orcAtual||o.id!==orcAtual.id)
    for (const o of outros) {
      const oDe=dateParaMes(o.vigencia_de), oAte=dateParaMes(o.vigencia_ate)
      if (vigDe<=oAte&&vigAte>=oDe)
        return `Período sobrepõe o orçamento "${o.descricao}" (${fmtMesLabel(oDe)} a ${fmtMesLabel(oAte)})`
    }
    // Verificar continuidade: novo orçamento deve iniciar após o último término
    const sorted=[...outros].sort((a,b)=>String(b.vigencia_ate).localeCompare(String(a.vigencia_ate)))
    if (sorted.length>0) {
      const ultimo=sorted[0]
      const ultimoAte=dateParaMes(ultimo.vigencia_ate)
      if (vigDe<=ultimoAte)
        return `O orçamento deve iniciar após ${fmtMesLabel(ultimoAte)} (fim do orçamento "${ultimo.descricao}")`
    }
    return null
  }

  async function salvar() {
    const {descricao,vigencia_de,vigencia_ate,saldo_inicial,status}=formHeader
    if (!descricao?.trim()){alert('Informe a descrição');return}
    if (!vigencia_de){alert('Informe a vigência de (mês inicial)');return}
    if (!vigencia_ate){alert('Informe a vigência até (mês final)');return}
    if (vigencia_de>vigencia_ate){alert('O mês inicial deve ser anterior ou igual ao mês final');return}
    const erroCont=validarContinuidade(vigencia_de,vigencia_ate)
    if (erroCont){alert('Atenção — continuidade obrigatória:\n'+erroCont);return}
    setSaving(true)
    try {
      const payload={
        descricao:descricao.trim(),
        vigencia_de:mesParaDate(vigencia_de),
        vigencia_ate:mesParaDate(vigencia_ate),
        saldo_inicial:saldo_inicial||0,
        status
      }
      let orcId
      if (orcAtual?.id) {
        const {error}=await supabase.from('orcamento_cond').update(payload).eq('id',orcAtual.id)
        if (error) throw error
        orcId=orcAtual.id
      } else {
        const {data,error}=await supabase.from('orcamento_cond').insert([payload]).select().single()
        if (error) throw error
        orcId=data.id
      }
      for (const dbId of deletedItemIds) {
        await supabase.from('orcamento_cond_itens').update({excluido_em:new Date().toISOString()}).eq('id',dbId)
      }
      for (const item of formItens) {
        let itemId=item.dbId
        if (!itemId) {
          const {data,error}=await supabase.from('orcamento_cond_itens').insert([{orcamento_id:orcId,conta_id:item.conta.id}]).select().single()
          if (error) throw error
          itemId=data.id
        }
        for (const [mes,val] of Object.entries(item.valores)) {
          const vp={item_id:itemId,competencia:mesParaDate(mes),valor_previsto:val.previsto||0,valor_realizado:val.realizado??null}
          if (val.dbValorId) {
            await supabase.from('orcamento_cond_valores').update(vp).eq('id',val.dbValorId)
          } else {
            await supabase.from('orcamento_cond_valores').upsert(vp,{onConflict:'item_id,competencia'})
          }
        }
      }
      await carregarLista();setView('lista')
    } catch(e){alert('Erro ao salvar: '+(e?.message||JSON.stringify(e)))}
    finally{setSaving(false)}
  }

  async function excluirOrcamento(orc) {
    if (!confirm(`Excluir o orçamento "${orc.descricao}"?`)) return
    await supabase.from('orcamento_cond').update({excluido_em:new Date().toISOString()}).eq('id',orc.id)
    carregarLista()
  }

  function adicionarConta(conta) {
    const vals={}
    meses.forEach(m=>{vals[m]={dbValorId:null,previsto:0,realizado:null}})
    setFormItens(prev=>[...prev,{tempId:`tmp_${Date.now()}_${Math.random()}`,dbId:null,conta,valores:vals}])
    setModalConta(false)
  }

  function removerItem(tempId) {
    const item=formItens.find(i=>i.tempId===tempId)
    if (item?.dbId) setDeletedItemIds(prev=>[...prev,item.dbId])
    setFormItens(prev=>prev.filter(i=>i.tempId!==tempId))
  }

  function updatePrevisto(tempId,mes,raw) {
    const num=digitsToNum(raw)
    setFormItens(prev=>prev.map(item=>{
      if(item.tempId!==tempId) return item
      return {...item,valores:{...item.valores,[mes]:{...item.valores[mes],previsto:num}}}
    }))
  }

  function handlePrevistoBlur(tempId,mes) {
    if (mes!==meses[0]) return
    const item=formItens.find(i=>i.tempId===tempId)
    if (!item) return
    const primeiro=item.valores[mes]?.previsto||0
    if (primeiro<=0) return
    if (replicouRef.current.has(tempId)) return
    const outrosTodos0=meses.slice(1).every(m=>!(item.valores[m]?.previsto))
    if (!outrosTodos0) return
    replicouRef.current.add(tempId)
    if (confirm('Deseja repetir este valor para todos os meses da vigência?')) {
      setFormItens(prev=>prev.map(it=>{
        if(it.tempId!==tempId) return it
        const novos={...it.valores}
        meses.forEach(m=>{novos[m]={...novos[m],previsto:primeiro}})
        return {...it,valores:novos}
      }))
    }
  }

  // ─── Computed para View ───────────────────────────────────────────────────────
  function computeView() {
    const saldoP={}, saldoR={}
    const si=parseFloat(formHeader.saldo_inicial)||0
    meses.forEach((mes,idx)=>{
      if(idx===0){saldoP[mes]=si;saldoR[mes]=si}
      else {
        const prev=meses[idx-1]
        const rP=formItens.filter(i=>i.conta.tipo_conta==='Receita').reduce((s,i)=>s+(i.valores[prev]?.previsto||0),0)
        const gP=formItens.filter(i=>i.conta.tipo_conta==='Gasto').reduce((s,i)=>s+(i.valores[prev]?.previsto||0),0)
        saldoP[mes]=saldoP[prev]+rP-gP
        const rR=formItens.filter(i=>i.conta.tipo_conta==='Receita').reduce((s,i)=>s+(i.valores[prev]?.realizado||0),0)
        const gR=formItens.filter(i=>i.conta.tipo_conta==='Gasto').reduce((s,i)=>s+(i.valores[prev]?.realizado||0),0)
        saldoR[mes]=saldoR[prev]+rR-gR
      }
    })
    const g1R=formItens.filter(i=>i.conta.grupo_orcamentario==='Atividades do Dia a Dia'&&i.conta.tipo_conta==='Receita')
    const g1G=formItens.filter(i=>i.conta.grupo_orcamentario==='Atividades do Dia a Dia'&&i.conta.tipo_conta==='Gasto')
    const g2R=formItens.filter(i=>['Intervenções Corretivas','Benfeitorias'].includes(i.conta.grupo_orcamentario)&&i.conta.tipo_conta==='Receita')
    const g2G=formItens.filter(i=>['Intervenções Corretivas','Benfeitorias'].includes(i.conta.grupo_orcamentario)&&i.conta.tipo_conta==='Gasto')
    const totalPrevisto=formItens.reduce((s,i)=>s+meses.reduce((ss,m)=>{
      const v=i.valores[m]?.previsto||0;return ss+(i.conta.tipo_conta==='Gasto'?-v:v)
    },0),0)
    const totalRealizado=formItens.reduce((s,i)=>s+meses.reduce((ss,m)=>{
      const v=i.valores[m]?.realizado||0;return ss+(i.conta.tipo_conta==='Gasto'?-v:v)
    },0),0)
    return {saldoP,saldoR,g1R,g1G,g2R,g2G,totalPrevisto,totalRealizado}
  }

  // ─── Excel export ─────────────────────────────────────────────────────────────
  function exportarExcel() {
    const header=['Cód','Descrição','Tipo','Grupo']
    meses.forEach(m=>{header.push(`Prev. ${fmtMesLabel(m)}`);header.push(`Real. ${fmtMesLabel(m)}`)})
    header.push('Acum. Previsto','Acum. Realizado')
    const rows=[header]
    formItens.forEach(item=>{
      const row=[item.conta.codigo_contabil||'',item.conta.descricao,item.conta.tipo_conta,item.conta.grupo_orcamentario]
      let acP=0,acR=0
      meses.forEach(m=>{
        const p=item.valores[m]?.previsto||0
        const r=item.valores[m]?.realizado||0
        const sig=item.conta.tipo_conta==='Gasto'?-1:1
        row.push(sig*p,sig*r)
        acP+=sig*p;acR+=sig*r
      })
      row.push(acP,acR)
      rows.push(row)
    })
    const ws=XLSX.utils.aoa_to_sheet(rows)
    const wb=XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb,ws,'Orçamento')
    XLSX.writeFile(wb,`orcamento_${(orcAtual?.descricao||'condominio').replace(/\s+/g,'_')}.xlsx`)
  }

  // ─── Estilos reutilizáveis ────────────────────────────────────────────────────
  const thBase={background:'#1e3a5f',color:'#fff',padding:'8px 10px',fontWeight:600,fontSize:11,
    whiteSpace:'nowrap',textAlign:'center',borderRight:'0.5px solid rgba(255,255,255,0.15)'}
  const tdBase={padding:'6px 8px',fontSize:12,borderBottom:'0.5px solid var(--borda)',
    borderRight:'0.5px solid var(--borda)',whiteSpace:'nowrap',textAlign:'right'}
  const stickyLeft=(left,w)=>({position:'sticky',left,zIndex:2,background:'inherit',width:w,minWidth:w,maxWidth:w})

  function renderItemRow(item,idx,editavel) {
    const isRec=item.conta.tipo_conta==='Receita'
    const corValor=isRec?'#0d2b6b':'#7f1f1f'
    const bg=idx%2===0?'#fff':'#f0f7ff'
    const acumP=meses.reduce((s,m)=>s+(item.valores[m]?.previsto||0),0)
    const acumR=meses.reduce((s,m)=>s+(item.valores[m]?.realizado||0),0)
    return (
      <tr key={item.tempId} style={{background:bg}}>
        <td style={{...tdBase,...stickyLeft(0,65),background:bg,textAlign:'left',color:'var(--texto-ter)',fontFamily:'monospace',fontSize:11}}>
          {item.conta.codigo_contabil||'—'}
        </td>
        <td style={{...tdBase,...stickyLeft(65,200),background:bg,textAlign:'left',fontWeight:500,fontSize:12}}>
          {item.conta.descricao}
        </td>
        <td style={{...tdBase,...stickyLeft(265,75),background:bg,textAlign:'center'}}>
          <span style={{fontSize:10,padding:'2px 5px',borderRadius:4,fontWeight:600,
            background:isRec?'var(--verde-bg)':'var(--vermelho-bg)',color:isRec?'var(--verde)':'var(--vermelho)'}}>
            {item.conta.tipo_conta}
          </span>
        </td>
        <td style={{...tdBase,textAlign:'left',fontSize:11,color:'var(--texto-sec)',minWidth:120}}>
          {item.conta.grupo_orcamentario}
        </td>
        {meses.map(mes=>{
          const v=item.valores[mes]
          const numP=v?.previsto||0
          if (editavel) {
            return (
              <td key={mes} style={{...tdBase,padding:0,minWidth:100}}>
                <input
                  value={moedaInputValue(numP)||''}
                  onChange={e=>updatePrevisto(item.tempId,mes,e.target.value)}
                  onBlur={()=>handlePrevistoBlur(item.tempId,mes)}
                  style={{width:'100%',border:'none',outline:'none',background:'transparent',
                    textAlign:'right',padding:'6px 8px',fontSize:12,color:corValor,
                    boxSizing:'border-box',fontFamily:'inherit'}}
                  placeholder="R$ 0,00"
                />
              </td>
            )
          } else {
            return (
              <td key={mes+'-p'} style={{...tdBase,color:corValor}}>
                {numP?fmtMoedaCompact(numP,item.conta.tipo_conta):''}
              </td>
            )
          }
        })}
        {!editavel && meses.map(mes=>{
          const numR=item.valores[mes]?.realizado
          return (
            <td key={mes+'-r'} style={{...tdBase,color:'var(--texto-sec)'}}>
              {numR!==null&&numR!==undefined?fmtMoedaCompact(numR,item.conta.tipo_conta):''}
            </td>
          )
        })}
        <td style={{...tdBase,color:corValor,fontWeight:600}}>
          {acumP?fmtMoedaCompact(acumP,item.conta.tipo_conta):''}
        </td>
        {!editavel && <td style={{...tdBase,color:'var(--texto-sec)',fontWeight:500}}>
          {acumR?fmtMoedaCompact(acumR,item.conta.tipo_conta):''}
        </td>}
        {editavel && (
          <td style={{...tdBase,textAlign:'center',minWidth:40}}>
            <button className="btn btn-sm btn-danger" onClick={()=>removerItem(item.tempId)} title="Remover">
              <i className="fa-solid fa-trash" style={{fontSize:11}}></i>
            </button>
          </td>
        )}
      </tr>
    )
  }

  function renderGrupoHeader(label,colTotal) {
    return (
      <tr>
        <td colSpan={colTotal} style={{background:'#1e3a5f',color:'#fff',fontWeight:700,
          fontSize:12,padding:'8px 14px',letterSpacing:'0.03em',position:'sticky',left:0,zIndex:1}}>
          {label}
        </td>
      </tr>
    )
  }

  function renderSubtituloTipo(label,isReceita) {
    const bg=isReceita?'#e6f4ea':'#fce8e8'
    const cor=isReceita?'var(--verde)':'var(--vermelho)'
    return (
      <tr>
        <td colSpan={999} style={{background:bg,color:cor,fontSize:11,fontWeight:600,
          padding:'4px 14px',borderBottom:'0.5px solid var(--borda)'}}>
          {label}
        </td>
      </tr>
    )
  }

  function renderSubtotalRow(label,saldoP,saldoR,receitasItens,gastosItens,editavel) {
    const bg='#dbeafe'
    return (
      <tr style={{background:bg,fontWeight:700}}>
        <td colSpan={4} style={{...tdBase,background:bg,position:'sticky',left:0,zIndex:2,
          textAlign:'left',fontSize:12,fontWeight:700,color:'#1e3a5f'}}>
          {label}
        </td>
        {meses.map(mes=>{
          const rP=receitasItens.reduce((s,i)=>s+(i.valores[mes]?.previsto||0),0)
          const gP=gastosItens.reduce((s,i)=>s+(i.valores[mes]?.previsto||0),0)
          const total=saldoP[mes]+rP-gP
          if(editavel) return <td key={mes} style={{...tdBase,background:bg,color:'#1e3a5f',fontWeight:700}}>{fmtMoeda(total)}</td>
          const rR=receitasItens.reduce((s,i)=>s+(i.valores[mes]?.realizado||0),0)
          const gR=gastosItens.reduce((s,i)=>s+(i.valores[mes]?.realizado||0),0)
          const totR=saldoR[mes]+rR-gR
          return [
            <td key={mes+'-p'} style={{...tdBase,background:bg,color:'#1e3a5f',fontWeight:700}}>{fmtMoeda(total)}</td>,
            <td key={mes+'-r'} style={{...tdBase,background:bg,color:'#555',fontWeight:700}}>{fmtMoeda(totR)}</td>
          ]
        })}
        <td style={{...tdBase,background:bg}}></td>
        {!editavel&&<td style={{...tdBase,background:bg}}></td>}
        {editavel&&<td style={{...tdBase,background:bg}}></td>}
      </tr>
    )
  }

  // ─── RENDER: Lista ─────────────────────────────────────────────────────────────
  if (view==='lista') return (
    <div>
      <div className="page-title">Orçamento do Condomínio</div>
      <div className="page-sub">Planejamento orçamentário anual por vigência</div>
      <div className="stat-grid">
        <div className="stat"><div className="stat-n">{orcamentos.length}</div><div className="stat-l">Total</div></div>
        <div className="stat"><div className="stat-n" style={{color:'var(--verde)'}}>{orcamentos.filter(o=>o.status==='Ativo').length}</div><div className="stat-l">Ativos</div></div>
        <div className="stat"><div className="stat-n" style={{color:'var(--texto-ter)'}}>{orcamentos.filter(o=>o.status==='Inativo').length}</div><div className="stat-l">Inativos</div></div>
      </div>
      {isAdmin&&<button className="btn btn-success" style={{marginBottom:16}} onClick={novoOrcamento}>
        <i className="fa-solid fa-plus" style={{marginRight:6}}></i>Novo Orçamento
      </button>}
      <div className="card card-cinza" style={{padding:0,overflow:'hidden'}}>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Descrição</th>
              <th>Vigência De</th>
              <th>Vigência Até</th>
              <th>Saldo Inicial</th>
              <th>Status</th>
              {isAdmin&&<th></th>}
            </tr>
          </thead>
          <tbody>
            {orcamentos.length===0&&(
              <tr><td colSpan={7} style={{textAlign:'center',padding:32,color:'var(--texto-ter)'}}>
                Nenhum orçamento cadastrado
              </td></tr>
            )}
            {orcamentos.map(o=>(
              <tr key={o.id} onDoubleClick={()=>verOrcamento(o)} style={{cursor:'pointer'}}
                title="Duplo clique para visualizar a planilha">
                <td style={{color:'var(--texto-sec)',fontSize:12}}>{o.id}</td>
                <td style={{fontWeight:500}}>{o.descricao}</td>
                <td>{fmtDataBR(o.vigencia_de)}</td>
                <td>{fmtDataBR(o.vigencia_ate)}</td>
                <td style={{textAlign:'right'}}>{fmtMoeda(o.saldo_inicial)}</td>
                <td>
                  <span style={{fontSize:11,padding:'2px 8px',borderRadius:6,fontWeight:600,
                    background:o.status==='Ativo'?'var(--verde-bg)':'var(--cinza-bg)',
                    color:o.status==='Ativo'?'var(--verde)':'var(--texto-ter)'}}>
                    {o.status}
                  </span>
                </td>
                {isAdmin&&(
                  <td style={{display:'flex',gap:4}}>
                    <button className="btn btn-sm" onClick={e=>{e.stopPropagation();editarOrcamento(o)}}>Editar</button>
                    <button className="btn btn-sm btn-danger" onClick={e=>{e.stopPropagation();excluirOrcamento(o)}}>
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  // ─── RENDER: Form ─────────────────────────────────────────────────────────────
  if (view==='form') {
    const jaAdicionadas=new Set(formItens.map(i=>i.conta.id))
    const colTotal=4+meses.length+2
    const {saldoP,saldoR,g1R,g1G,g2R,g2G}=computeView()

    return (
      <div>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
          <button className="btn" onClick={()=>setView('lista')}><i className="fa-solid fa-arrow-left" style={{marginRight:6}}></i>Voltar</button>
          <div className="page-title" style={{margin:0}}>{orcAtual?'Editar Orçamento':'Novo Orçamento'}</div>
        </div>

        {/* Cabeçalho */}
        <div className="card" style={{marginBottom:20}}>
          <div style={{fontWeight:600,fontSize:13,marginBottom:14,color:'var(--azul)'}}>
            <i className="fa-solid fa-file-invoice-dollar" style={{marginRight:8}}></i>Cabeçalho do Orçamento
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 160px 160px 180px 140px',gap:12,alignItems:'end'}}>
            <div className="form-group" style={{margin:0}}>
              <label>Descrição</label>
              <input value={formHeader.descricao} onChange={e=>setFormHeader({...formHeader,descricao:e.target.value})}
                placeholder="Ex: Orçamento 2025"/>
            </div>
            <div className="form-group" style={{margin:0}}>
              <label>Vigência De</label>
              <input type="month" value={formHeader.vigencia_de}
                onChange={e=>setFormHeader({...formHeader,vigencia_de:e.target.value})}/>
            </div>
            <div className="form-group" style={{margin:0}}>
              <label>Vigência Até</label>
              <input type="month" value={formHeader.vigencia_ate}
                onChange={e=>setFormHeader({...formHeader,vigencia_ate:e.target.value})}/>
            </div>
            <div className="form-group" style={{margin:0}}>
              <label>Saldo Inicial</label>
              <input value={moedaInputValue(formHeader.saldo_inicial)||''}
                onChange={e=>setFormHeader({...formHeader,saldo_inicial:digitsToNum(e.target.value)})}
                placeholder="R$ 0,00"/>
            </div>
            <div className="form-group" style={{margin:0}}>
              <label>Status</label>
              <select value={formHeader.status} onChange={e=>setFormHeader({...formHeader,status:e.target.value})}>
                <option>Ativo</option><option>Inativo</option>
              </select>
            </div>
          </div>
          {meses.length>0&&(
            <div style={{marginTop:10,fontSize:12,color:'var(--texto-sec)'}}>
              Vigência: {fmtMesLabel(meses[0])} a {fmtMesLabel(meses[meses.length-1])} ({meses.length} {meses.length===1?'mês':'meses'})
            </div>
          )}
        </div>

        {/* Botões */}
        <div style={{display:'flex',gap:8,marginBottom:16}}>
          {isAdmin&&<button className="btn btn-primary"
            onClick={()=>{if(!formHeader.vigencia_de||!formHeader.vigencia_ate){alert('Preencha a vigência antes de adicionar contas');return};setModalConta(true)}}>
            <i className="fa-solid fa-plus" style={{marginRight:6}}></i>Adicionar Conta ao Orçamento
          </button>}
          <button className="btn btn-success" onClick={salvar} disabled={saving}>
            <i className="fa-solid fa-floppy-disk" style={{marginRight:6}}></i>{saving?'Salvando...':'Salvar Orçamento'}
          </button>
          <button className="btn" onClick={()=>setView('lista')}>Cancelar</button>
        </div>

        {/* Planilha editável */}
        {meses.length===0&&(
          <div className="card" style={{textAlign:'center',color:'var(--texto-sec)',padding:40}}>
            <i className="fa-solid fa-calendar-days" style={{fontSize:28,marginBottom:12,display:'block',color:'var(--texto-ter)'}}></i>
            Preencha a vigência no cabeçalho para exibir a planilha orçamentária
          </div>
        )}
        {meses.length>0&&(
          <div className="card" style={{padding:0,overflow:'hidden'}}>
            <div style={{overflowX:'auto',overflowY:'auto',maxHeight:'65vh'}}>
              <table style={{borderCollapse:'collapse',tableLayout:'fixed',width:'max-content',minWidth:'100%'}}>
                <thead style={{position:'sticky',top:0,zIndex:5}}>
                  <tr>
                    <th style={{...thBase,...stickyLeft(0,65),zIndex:6,textAlign:'left'}}>Cód</th>
                    <th style={{...thBase,...stickyLeft(65,200),zIndex:6,textAlign:'left'}}>Descrição da Conta</th>
                    <th style={{...thBase,...stickyLeft(265,75),zIndex:6}}>Tipo</th>
                    <th style={{...thBase,minWidth:120,textAlign:'left'}}>Grupo</th>
                    {meses.map(m=><th key={m} style={{...thBase,minWidth:100}}>Prev. {fmtMesLabel(m)}</th>)}
                    <th style={{...thBase,minWidth:110}}>Acum. Previsto</th>
                    <th style={{...thBase,minWidth:60}}></th>
                  </tr>
                </thead>
                <tbody>
                  {formItens.length===0&&(
                    <tr><td colSpan={colTotal+2} style={{textAlign:'center',padding:32,color:'var(--texto-ter)',fontSize:13}}>
                      Nenhuma conta adicionada. Clique em "Adicionar Conta ao Orçamento".
                    </td></tr>
                  )}
                  {/* Grupo 1 */}
                  {(g1R.length>0||g1G.length>0)&&renderGrupoHeader('Atividades do Dia a Dia',colTotal+2)}
                  {g1R.length>0&&renderSubtituloTipo('↑ Receitas',true)}
                  {g1R.map((item,idx)=>renderItemRow(item,idx,true))}
                  {g1G.length>0&&renderSubtituloTipo('↓ Gastos',false)}
                  {g1G.map((item,idx)=>renderItemRow(item,idx,true))}
                  {(g1R.length>0||g1G.length>0)&&renderSubtotalRow('Subtotal — Atividades do Dia a Dia',saldoP,saldoR,g1R,g1G,true)}
                  {/* Grupo 2 */}
                  {(g2R.length>0||g2G.length>0)&&renderGrupoHeader('Intervenções Corretivas e Benfeitorias',colTotal+2)}
                  {g2R.length>0&&renderSubtituloTipo('↑ Receitas',true)}
                  {g2R.map((item,idx)=>renderItemRow(item,idx,true))}
                  {g2G.length>0&&renderSubtituloTipo('↓ Gastos',false)}
                  {g2G.map((item,idx)=>renderItemRow(item,idx,true))}
                  {(g2R.length>0||g2G.length>0)&&renderSubtotalRow('Subtotal — Intervenções Corretivas e Benfeitorias',saldoP,saldoR,g2R,g2G,true)}
                  {/* Itens sem grupo reconhecido */}
                  {formItens.filter(i=>!['Atividades do Dia a Dia','Intervenções Corretivas','Benfeitorias'].includes(i.conta.grupo_orcamentario)).map((item,idx)=>renderItemRow(item,idx,true))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {modalConta&&(
          <ModalAddConta contas={contas} jaAdicionadas={jaAdicionadas} onSelect={adicionarConta} onClose={()=>setModalConta(false)}/>
        )}
      </div>
    )
  }

  // ─── RENDER: View ─────────────────────────────────────────────────────────────
  if (view==='view') {
    if (loading) return <div style={{padding:40,textAlign:'center',color:'var(--texto-sec)'}}>Carregando...</div>
    const {saldoP,saldoR,g1R,g1G,g2R,g2G,totalPrevisto,totalRealizado}=computeView()
    const colTotal=4+meses.length*2+2

    const saldoInicialRow=(
      <tr style={{background:'#e8f0fe',fontWeight:600}}>
        <td colSpan={4} style={{...tdBase,position:'sticky',left:0,zIndex:2,background:'#e8f0fe',
          textAlign:'left',fontWeight:700,color:'#1e3a5f',fontSize:12}}>
          <i className="fa-solid fa-wallet" style={{marginRight:8}}></i>Saldo Inicial
        </td>
        {meses.map(mes=>[
          <td key={mes+'-p'} style={{...tdBase,background:'#e8f0fe',color:'#1e3a5f',fontWeight:700}}>
            {fmtMoeda(saldoP[mes])}
          </td>,
          <td key={mes+'-r'} style={{...tdBase,background:'#e8f0fe',color:'#555'}}>
            {fmtMoeda(saldoR[mes])}
          </td>
        ])}
        <td style={{...tdBase,background:'#e8f0fe'}}></td>
        <td style={{...tdBase,background:'#e8f0fe'}}></td>
      </tr>
    )

    return (
      <div>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16,flexWrap:'wrap'}}>
          <button className="btn" onClick={()=>setView('lista')}><i className="fa-solid fa-arrow-left" style={{marginRight:6}}></i>Voltar</button>
          <div style={{flex:1}}>
            <div className="page-title" style={{margin:0}}>{orcAtual?.descricao}</div>
            <div style={{fontSize:12,color:'var(--texto-sec)',marginTop:2}}>
              Vigência: {fmtMesLabel(meses[0])} a {fmtMesLabel(meses[meses.length-1])} · {meses.length} meses
            </div>
          </div>
          {isAdmin&&<button className="btn btn-sm" onClick={()=>editarOrcamento(orcAtual)}>
            <i className="fa-solid fa-pen" style={{marginRight:6}}></i>Editar
          </button>}
          <button className="btn btn-sm" onClick={exportarExcel}>
            <i className="fa-solid fa-file-excel" style={{marginRight:6}}></i>Exportar Excel
          </button>
        </div>

        {/* Cards de totais */}
        <div className="stat-grid" style={{marginBottom:20}}>
          <div className="stat">
            <div className="stat-n" style={{color:'var(--azul)',fontSize:18}}>{fmtMoeda(totalPrevisto)}</div>
            <div className="stat-l">Total Previsto (líquido)</div>
          </div>
          <div className="stat">
            <div className="stat-n" style={{color:'var(--verde)',fontSize:18}}>{fmtMoeda(totalRealizado)}</div>
            <div className="stat-l">Total Realizado (líquido)</div>
          </div>
          <div className="stat">
            <div className="stat-n">{formItens.length}</div>
            <div className="stat-l">Contas no Orçamento</div>
          </div>
          <div className="stat">
            <div className="stat-n" style={{color:'var(--lilas)'}}>{fmtMoeda(parseFloat(formHeader.saldo_inicial)||0)}</div>
            <div className="stat-l">Saldo Inicial</div>
          </div>
        </div>

        {/* Planilha leitura */}
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          <div style={{overflowX:'auto',overflowY:'auto',maxHeight:'70vh'}}>
            <table style={{borderCollapse:'collapse',tableLayout:'fixed',width:'max-content',minWidth:'100%'}}>
              <thead style={{position:'sticky',top:0,zIndex:5}}>
                <tr>
                  <th style={{...thBase,...stickyLeft(0,65),zIndex:6,textAlign:'left'}}>Cód</th>
                  <th style={{...thBase,...stickyLeft(65,200),zIndex:6,textAlign:'left'}}>Descrição da Conta</th>
                  <th style={{...thBase,...stickyLeft(265,75),zIndex:6}}>Tipo</th>
                  <th style={{...thBase,minWidth:120,textAlign:'left'}}>Grupo</th>
                  {meses.map(m=>(
                    <th key={m} colSpan={2} style={{...thBase,minWidth:180}}>
                      {fmtMesLabel(m)}
                    </th>
                  ))}
                  <th style={{...thBase,minWidth:110}}>Acum. Prev.</th>
                  <th style={{...thBase,minWidth:110}}>Acum. Real.</th>
                </tr>
                <tr>
                  <th style={{...thBase,background:'#16304e',fontSize:10,zIndex:6,...stickyLeft(0,65)}}></th>
                  <th style={{...thBase,background:'#16304e',fontSize:10,zIndex:6,...stickyLeft(65,200)}}></th>
                  <th style={{...thBase,background:'#16304e',fontSize:10,zIndex:6,...stickyLeft(265,75)}}></th>
                  <th style={{...thBase,background:'#16304e',fontSize:10,minWidth:120}}></th>
                  {meses.map(m=>[
                    <th key={m+'-ph'} style={{...thBase,background:'#16304e',fontSize:10,minWidth:90}}>Previsto</th>,
                    <th key={m+'-rh'} style={{...thBase,background:'#16304e',fontSize:10,minWidth:90}}>Realizado</th>
                  ])}
                  <th style={{...thBase,background:'#16304e',fontSize:10,minWidth:110}}></th>
                  <th style={{...thBase,background:'#16304e',fontSize:10,minWidth:110}}></th>
                </tr>
              </thead>
              <tbody>
                {saldoInicialRow}
                {/* Grupo 1 */}
                {(g1R.length>0||g1G.length>0)&&renderGrupoHeader('Atividades do Dia a Dia',colTotal)}
                {g1R.length>0&&renderSubtituloTipo('↑ Receitas',true)}
                {g1R.map((item,idx)=>renderItemRow(item,idx,false))}
                {g1G.length>0&&renderSubtituloTipo('↓ Gastos',false)}
                {g1G.map((item,idx)=>renderItemRow(item,idx,false))}
                {(g1R.length>0||g1G.length>0)&&renderSubtotalRow('Subtotal — Atividades do Dia a Dia',saldoP,saldoR,g1R,g1G,false)}
                {/* Grupo 2 */}
                {(g2R.length>0||g2G.length>0)&&renderGrupoHeader('Intervenções Corretivas e Benfeitorias',colTotal)}
                {g2R.length>0&&renderSubtituloTipo('↑ Receitas',true)}
                {g2R.map((item,idx)=>renderItemRow(item,idx,false))}
                {g2G.length>0&&renderSubtituloTipo('↓ Gastos',false)}
                {g2G.map((item,idx)=>renderItemRow(item,idx,false))}
                {(g2R.length>0||g2G.length>0)&&renderSubtotalRow('Subtotal — Intervenções Corretivas e Benfeitorias',saldoP,saldoR,g2R,g2G,false)}
                {formItens.length===0&&(
                  <tr><td colSpan={colTotal} style={{textAlign:'center',padding:40,color:'var(--texto-ter)',fontSize:13}}>
                    Nenhuma conta cadastrada neste orçamento
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  return null
}

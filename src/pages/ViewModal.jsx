function fmtData(d) {
  if (!d) return '—'
  const s = String(d).slice(0,10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const [y,m,day] = s.split('-')
  return `${day}/${m}/${y}`
}
function fmtDataHora(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' }) } catch { return '—' }
}
function fmtMoeda(v) {
  if (v === null || v === undefined || v === '') return '—'
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',','.'))
  if (isNaN(n)) return '—'
  return n.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })
}
function fmtValor(v, tipo) {
  if (v === null || v === undefined || v === '') return '—'
  if (tipo === 'data')      return fmtData(v)
  if (tipo === 'datahora')  return fmtDataHora(v)
  if (tipo === 'moeda')     return fmtMoeda(v)
  if (tipo === 'bool')      return v ? 'Sim' : 'Não'
  if (tipo === 'longtext')  return v
  return String(v)
}

/**
 * Modal de visualização (read-only) com lista de campos.
 *
 * Props:
 *   titulo: string — header do modal
 *   subtitulo: string opcional
 *   campos: array de { label, valor, tipo? } — tipo: 'texto' | 'data' | 'datahora' | 'moeda' | 'bool' | 'longtext'
 *   onFechar: () => void
 *   onEditar?: () => void — botão Editar opcional
 *   corBorda?: string — cor da barrinha de topo (ex: 'var(--azul)')
 */
export default function ViewModal({ titulo, subtitulo, campos, onFechar, onEditar, corBorda }) {
  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onFechar()}>
      <div className="modal" style={{width:560, maxWidth:'95vw', borderTop: corBorda ? `3px solid ${corBorda}` : undefined}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16,gap:12}}>
          <div style={{flex:1,minWidth:0}}>
            <h3 style={{margin:0, wordBreak:'break-word'}}>{titulo}</h3>
            {subtitulo && <div style={{fontSize:12, color:'var(--texto-sec)', marginTop:4}}>{subtitulo}</div>}
          </div>
          <button onClick={onFechar} style={{background:'var(--cinza-bg)',border:'none',borderRadius:'50%',width:32,height:32,fontSize:18,cursor:'pointer',flexShrink:0}}>×</button>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16}}>
          {campos.map((c, idx) => (
            <div key={idx} style={c.tipo === 'longtext' ? {gridColumn:'1 / -1'} : undefined}>
              <div style={{fontSize:10, color:'var(--texto-ter)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:3, fontWeight:500}}>
                {c.label}
              </div>
              <div style={{
                fontSize:13,
                color: (c.valor === null || c.valor === undefined || c.valor === '') ? 'var(--texto-ter)' : 'var(--texto)',
                whiteSpace: c.tipo === 'longtext' ? 'pre-wrap' : 'normal',
                wordBreak:'break-word'
              }}>
                {fmtValor(c.valor, c.tipo)}
              </div>
            </div>
          ))}
        </div>

        <div style={{display:'flex', gap:8, justifyContent:'flex-end', marginTop:12, borderTop:'0.5px solid var(--borda)', paddingTop:14}}>
          <button className="btn" onClick={onFechar}>Fechar</button>
          {onEditar && <button className="btn btn-primary" onClick={onEditar}><i className="fa-solid fa-pen" style={{marginRight:6}}></i>Editar</button>}
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { supabase } from '../supabase'
import Dashboard from './Dashboard'
import AtividadesDiarias from './AtividadesDiarias'
import Corretivas from './Corretivas'
import Benfeitorias from './Benfeitorias'
import Calendario from './Calendario'
import Orcamentos from './Orcamentos'
import Diario from './Diario'
import Publicacoes from './Publicacoes'
import Solicitacoes from './Solicitacoes'
import Contas from './Contas'
import AppZelador from './AppZelador'
import AppVistorias from './AppVistorias'

const MENU = [
  { id:'dashboard',    label:'Dashboard' },
  { id:'atividades',   label:'Atividades do Dia a Dia' },
  { id:'corretivas',   label:'Intervenções Corretivas' },
  { id:'benfeitorias', label:'Benfeitorias' },
  { id:'calendario',   label:'Calendário' },
  { id:'orcamentos',   label:'Orçamentos de Fornecedores' },
  { id:'contas',       label:'Contas' },
  { id:'diario',       label:'Diário de Manutenções' },
  { id:'solicitacoes', label:'Solicitações de Morador' },
  { id:'publicacoes',  label:'Publicações' },
]

export default function Layout({ perfil }) {
  // Sistema abre sempre pelo Dashboard
  const [pagina, setPagina] = useState('dashboard')
  const [modoVistorias, setModoVistorias] = useState(false)

  const PAGINAS = {
    dashboard:    <Dashboard perfil={perfil} />,
    atividades:   <AtividadesDiarias perfil={perfil} />,
    corretivas:   <Corretivas perfil={perfil} />,
    benfeitorias: <Benfeitorias perfil={perfil} />,
    calendario:   <Calendario perfil={perfil} />,
    orcamentos:   <Orcamentos perfil={perfil} />,
    contas:       <Contas perfil={perfil} />,
    diario:       <Diario perfil={perfil} />,
    solicitacoes: <Solicitacoes perfil={perfil} />,
    publicacoes:  <Publicacoes perfil={perfil} />,
  }

  const isAdmin    = perfil?.perfil === 'admin' || perfil?.perfil === 'sindico'
  const isZelador  = perfil?.perfil === 'zelador'
  const isVistorias= perfil?.perfil === 'vistorias'

  if (isZelador)   return <AppZelador perfil={perfil}/>
  if (isVistorias) return <AppVistorias perfil={perfil}/>

  // Síndico/Admin pode entrar no modo Vistorias temporariamente
  if (modoVistorias && isAdmin) return (
    <div>
      <div style={{position:'sticky', top:0, zIndex:50, background:'var(--lilas)', color:'#fff', padding:'8px 16px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div style={{fontSize:13, fontWeight:500}}>
          <i className="fa-solid fa-clipboard-check" style={{marginRight:8}}></i>Modo Vistorias
        </div>
        <button onClick={() => setModoVistorias(false)} style={{background:'rgba(255,255,255,0.2)', color:'#fff', border:'none', padding:'5px 12px', borderRadius:6, fontSize:12, cursor:'pointer'}}>
          <i className="fa-solid fa-arrow-left" style={{marginRight:6}}></i>Voltar à plataforma
        </button>
      </div>
      <AppVistorias perfil={perfil}/>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column' }}>
      <div style={{ background:'var(--azul)', color:'#fff', padding:'10px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:32, height:32, background:'rgba(255,255,255,0.15)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M3 17 Q7 11 12 13 Q17 15 21 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              <path d="M3 19 Q7 14 12 16 Q17 18 21 12" stroke="white" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.6"/>
              <rect x="10" y="4" width="4" height="10" rx="0.5" fill="white"/>
              <rect x="7" y="7" width="2.5" height="7" rx="0.5" fill="white" opacity="0.6"/>
              <rect x="14.5" y="5.5" width="2.5" height="8.5" rx="0.5" fill="white" opacity="0.6"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:400, letterSpacing:3 }}>OÁSIS</div>
            <div style={{ fontSize:8, opacity:0.6, letterSpacing:2 }}>EDIFÍCIO RESIDENCIAL</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:12, opacity:0.8 }}>
            {perfil?.nome || 'Usuário'} ·{' '}
            <span style={{ background:'rgba(255,255,255,0.2)', padding:'2px 8px', borderRadius:6, fontSize:11 }}>
              {perfil?.perfil === 'admin' ? 'Administrador' : perfil?.perfil === 'sindico' ? 'Síndico' : perfil?.perfil === 'zelador' ? 'Zelador' : perfil?.perfil === 'vistorias' ? 'Vistorias' : 'Condômino'}
            </span>
          </span>
          {isAdmin && (
            <button className="btn" style={{ background:'rgba(255,255,255,0.15)', color:'#fff', borderColor:'rgba(255,255,255,0.3)', fontSize:12, padding:'4px 10px' }}
              onClick={() => setModoVistorias(true)} title="Entrar no modo Vistorias (mobile)">
              <i className="fa-solid fa-clipboard-check" style={{marginRight:6}}></i>Vistorias
            </button>
          )}
          <button className="btn" style={{ background:'rgba(255,255,255,0.15)', color:'#fff', borderColor:'rgba(255,255,255,0.3)', fontSize:12, padding:'4px 10px' }}
            onClick={() => supabase.auth.signOut()}>
            Sair
          </button>
        </div>
      </div>

      <div style={{ display:'flex', flex:1 }}>
        <div style={{ width:200, background:'var(--branco)', borderRight:'0.5px solid var(--borda)', padding:'12px 0', flexShrink:0 }}>
          <div style={{ fontSize:10, color:'var(--texto-ter)', padding:'12px 16px 4px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Menu</div>
          {MENU.map(m => (
            <button key={m.id}
              onClick={() => setPagina(m.id)}
              style={{
                display:'block', width:'100%', padding:'9px 16px',
                fontSize:13, textAlign:'left', border:'none',
                borderLeft: pagina===m.id ? '3px solid var(--azul)' : '3px solid transparent',
                background: pagina===m.id ? 'var(--azul-bg)' : 'transparent',
                color: pagina===m.id ? 'var(--azul)' : 'var(--texto-sec)',
                fontWeight: pagina===m.id ? 500 : 400,
                cursor:'pointer', transition:'all 0.15s'
              }}>
              {m.label}
            </button>
          ))}
        </div>
        <div style={{ flex:1, padding:24, overflowY:'auto' }}>
          {PAGINAS[pagina]}
        </div>
      </div>
    </div>
  )
}

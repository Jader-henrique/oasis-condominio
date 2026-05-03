import { useState } from 'react'
import { supabase } from '../supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setCarregando(true)
    setErro('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) setErro('E-mail ou senha incorretos.')
    setCarregando(false)
  }

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'var(--fundo)' }}>
      <div style={{ background:'var(--branco)', border:'0.5px solid var(--borda)', borderRadius:16, padding:'2rem', width:340 }}>
        <div style={{ textAlign:'center', marginBottom:'1.5rem' }}>
          <div style={{ width:48, height:48, background:'var(--azul)', borderRadius:12, margin:'0 auto 12px', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 17 Q7 11 12 13 Q17 15 21 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              <path d="M3 19 Q7 14 12 16 Q17 18 21 12" stroke="white" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.6"/>
              <rect x="10" y="4" width="4" height="10" rx="0.5" fill="white"/>
              <rect x="7" y="7" width="2.5" height="7" rx="0.5" fill="white" opacity="0.6"/>
              <rect x="14.5" y="5.5" width="2.5" height="8.5" rx="0.5" fill="white" opacity="0.6"/>
            </svg>
          </div>
          <h2 style={{ fontSize:20, fontWeight:500 }}>Edifício Oásis</h2>
          <p style={{ fontSize:12, color:'var(--texto-sec)', marginTop:4 }}>Av. Boa Viagem, 4100 — Boa Viagem, Recife/PE</p>
        </div>
        <form onSubmit={entrar}>
          <div className="form-group">
            <label>E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required/>
          </div>
          <div className="form-group">
            <label>Senha</label>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••" required/>
          </div>
          {erro && <p style={{ color:'var(--vermelho)', fontSize:12, marginBottom:8 }}>{erro}</p>}
          <button className="btn btn-primary" style={{ width:'100%', marginTop:4 }} disabled={carregando}>
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
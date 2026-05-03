import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Login from './pages/Login'
import Layout from './pages/Layout'

export default function App() {
  const [sessao, setSessao] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessao(session)
      if (session) carregarPerfil(session.user.id)
      else setCarregando(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSessao(session)
      if (session) carregarPerfil(session.user.id)
      else { setPerfil(null); setCarregando(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function carregarPerfil(uid) {
    setCarregando(true)
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', uid)
      .single()

    if (error || !data) {
      await supabase.auth.signOut()
      setCarregando(false)
      return
    }

    setPerfil(data)
    setCarregando(false)
  }

  if (carregando) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--texto-sec)' }}>
      Carregando...
    </div>
  )

  if (!sessao) return <Login />
  if (!perfil) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ fontSize:13, color:'var(--texto-sec)' }}>
        Usuário não encontrado.{' '}
        <button style={{ color:'var(--azul)', background:'none', border:'none', cursor:'pointer' }}
          onClick={() => supabase.auth.signOut()}>
          Sair
        </button>
      </div>
    </div>
  )

  return <Layout perfil={perfil} />
}
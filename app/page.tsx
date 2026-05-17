'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Skip login if already authenticated
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace('/dashboard')
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError(error.message); return }
    router.replace('/dashboard')
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: 320, background: 'var(--surface)', borderRadius: 16, padding: '40px 32px', border: '1px solid var(--border)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text)' }}>UPSCAPE</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4, letterSpacing: '0.06em' }}>Field Designer</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {error && <p style={{ marginTop: 12, fontSize: 13, color: '#f87171', textAlign: 'center' }}>{error}</p>}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8,
  color: 'var(--text)', fontSize: 15, padding: '10px 14px', outline: 'none', width: '100%',
}

const btnStyle: React.CSSProperties = {
  background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff',
  fontSize: 15, fontWeight: 600, padding: '11px', cursor: 'pointer', marginTop: 4,
}

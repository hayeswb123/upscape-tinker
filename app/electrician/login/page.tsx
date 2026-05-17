'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ElectricianLogin() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password })
      if (loginErr) throw loginErr

      // Verify they have an electrician profile
      const { data: profile } = await supabase
        .from('electrician_profiles')
        .select('id')
        .maybeSingle()
      if (!profile) throw new Error('No electrician account found for this email.')

      router.push('/electrician/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white mb-2">Electrician Login</h1>
        <p className="text-gray-500 text-sm mb-6">Sign in to browse and bid on jobs.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#F4884A]"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#F4884A]"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-lg bg-[#F4884A] text-white font-medium hover:bg-[#e07030] disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="text-gray-500 text-sm mt-4 text-center">
          New here?{' '}
          <Link href="/electrician/signup" className="text-[#F4884A] hover:underline">Create account</Link>
        </p>
      </div>
    </div>
  )
}

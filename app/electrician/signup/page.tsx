'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ElectricianSignup() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '', name: '', company: '', license: '', phone: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data, error: signupErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      })
      if (signupErr) throw signupErr
      const userId = data.user?.id
      if (!userId) throw new Error('Signup failed')

      const { error: profileErr } = await supabase.from('electrician_profiles').insert({
        user_id: userId,
        name: form.name,
        company: form.company || null,
        license: form.license || null,
        phone: form.phone || null,
      })
      if (profileErr) throw profileErr

      router.push('/electrician/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  const field = (key: keyof typeof form, label: string, type = 'text', required = false) => (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}{required && ' *'}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        required={required}
        className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#F4884A]"
      />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-2">Electrician Sign Up</h1>
        <p className="text-gray-500 text-sm mb-6">Create an account to bid on landscape lighting jobs.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {field('name', 'Full name', 'text', true)}
          {field('email', 'Email', 'email', true)}
          {field('password', 'Password', 'password', true)}
          {field('company', 'Company name')}
          {field('license', 'License number')}
          {field('phone', 'Phone')}
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-lg bg-[#F4884A] text-white font-medium hover:bg-[#e07030] disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="text-gray-500 text-sm mt-4 text-center">
          Already have an account?{' '}
          <Link href="/electrician/login" className="text-[#F4884A] hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}

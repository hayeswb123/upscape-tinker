'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function NewProjectPage() {
  const router = useRouter()
  const [form, setForm] = useState({ address: '', name: '', homeowner: '', phone: '', email: '' })
  const [geocodeStatus, setGeocodeStatus] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [saving, setSaving] = useState(false)

  function setField(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function geocode(address: string) {
    if (!address.trim()) return
    setGeocodeStatus('Locating…')
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
    const data = await res.json()
    if (data?.length) {
      setCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) })
      setGeocodeStatus('✓ Located')
    } else {
      setGeocodeStatus('Address not found')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.address || !form.homeowner) return
    setSaving(true)
    const { data, error } = await supabase.from('projects').insert({
      name: form.name || form.homeowner,
      address: form.address,
      homeowner: form.homeowner,
      phone: form.phone,
      email: form.email,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      status: 'draft',
      selected_tier: 'premium',
      markers: [],
      wires: [],
      zones: [],
    }).select().single()
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    if (data) router.replace(`/projects/${data.id}/map`)
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100dvh' }}>
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={backBtn}>‹ Back</button>
        <span style={{ fontWeight: 600, fontSize: 15 }}>New Project</span>
      </header>

      <form onSubmit={handleSubmit} style={{ maxWidth: 480, margin: '0 auto', padding: '24px 20px' }}>
        <Section title="Property">
          <Field label="Address *">
            <input style={inputSt} placeholder="123 Oak Lane, Springfield IL" value={form.address}
              onChange={e => { setField('address', e.target.value); setGeocodeStatus('') }}
              onBlur={e => geocode(e.target.value)} required />
            {geocodeStatus && <div style={{ fontSize: 12, marginTop: 4, color: geocodeStatus.startsWith('✓') ? '#22c55e' : 'var(--muted)' }}>{geocodeStatus}</div>}
          </Field>
          <Field label="Project name">
            <input style={inputSt} placeholder="Smith Backyard — Spring 2026" value={form.name}
              onChange={e => setField('name', e.target.value)} />
          </Field>
        </Section>

        <Section title="Homeowner">
          <Field label="Full name *">
            <input style={inputSt} placeholder="Jane Smith" value={form.homeowner}
              onChange={e => setField('homeowner', e.target.value)}
              onBlur={() => { if (!form.name && form.homeowner) setField('name', form.homeowner) }}
              required />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Phone">
              <input style={inputSt} type="tel" placeholder="(217) 555-0100" value={form.phone} onChange={e => setField('phone', e.target.value)} />
            </Field>
            <Field label="Email">
              <input style={inputSt} type="email" placeholder="jane@example.com" value={form.email} onChange={e => setField('email', e.target.value)} />
            </Field>
          </div>
        </Section>

        <button type="submit" disabled={saving} style={{ ...btnSt, width: '100%', marginTop: 8 }}>
          {saving ? 'Creating…' : 'Open Map →'}
        </button>
      </form>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

const inputSt: React.CSSProperties = {
  width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
  color: 'var(--text)', fontSize: 15, padding: '10px 12px', outline: 'none',
}

const btnSt: React.CSSProperties = {
  background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#fff',
  fontSize: 15, fontWeight: 600, padding: 14, cursor: 'pointer',
}

const backBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 16, padding: 0,
}

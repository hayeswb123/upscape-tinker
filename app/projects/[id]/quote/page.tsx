'use client'
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Project } from '@/lib/supabase'
import { TIERS, calcQuote, type TierId } from '@/lib/catalog'

const fmt = (n: number) => '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })

export default function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    supabase.from('projects').select('*').eq('id', id).single().then(({ data }) => {
      if (data) setProject(data)
    })
  }, [id])

  async function selectTier(tier: TierId) {
    await supabase.from('projects').update({ selected_tier: tier }).eq('id', id)
    setProject(p => p ? { ...p, selected_tier: tier } : p)
  }

  async function sendQuote() {
    if (!project?.email) { alert('No homeowner email on file.'); return }
    setSending(true)
    const res = await fetch('/api/send-quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: id }),
    })
    setSending(false)
    if (res.ok) {
      setSent(true)
      await supabase.from('projects').update({ status: 'quoted' }).eq('id', id)
    } else {
      alert('Failed to send quote.')
    }
  }

  if (!project) return <div style={{ background: 'var(--bg)', height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>Loading…</div>

  const quote = calcQuote(project)
  const wireFeet = (project.wires || []).reduce((s, w) => s + (w.feet || 0), 0)

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100dvh' }}>
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 16px', height: 52, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push(`/projects/${id}/map`)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 20, cursor: 'pointer' }}>‹ Map</button>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Quote — {project.homeowner || project.name}</span>
      </header>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 100 }}>
        {(Object.keys(TIERS) as TierId[]).map(tierId => {
          const tier = TIERS[tierId]
          const q = quote[tierId]
          const selected = project.selected_tier === tierId

          return (
            <div
              key={tierId}
              onClick={() => selectTier(tierId)}
              style={{ background: 'var(--surface)', border: `2px solid ${selected ? tier.color : 'var(--border)'}`, borderRadius: 14, overflow: 'hidden', cursor: 'pointer', position: 'relative' }}
            >
              <div style={{ borderTop: `3px solid ${tier.color}`, padding: '14px 16px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 17, color: tier.color }}>{tier.label}</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{tier.tagline}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{tier.note}</div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>
                  {q.lines.map((l, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '7px 16px', color: 'var(--muted)' }}>
                        <div>{l.label}</div>
                        {l.sku && <div style={{ fontSize: 11, color: 'var(--muted)', opacity: 0.6, marginTop: 1 }}>
                          {l.url ? <a href={l.url} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{l.sku}</a> : l.sku}
                        </div>}
                      </td>
                      <td style={{ padding: '7px 4px', color: 'var(--muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div>×{l.qty}</div>
                        <div style={{ fontSize: 11, opacity: 0.6 }}>{fmt(l.unitPrice)} ea</div>
                      </td>
                      <td style={{ padding: '7px 16px', textAlign: 'right', fontWeight: 500, whiteSpace: 'nowrap' }}>{fmt(l.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}><span>Labor</span><span>{fmt(q.labor)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}><span>Wire ({wireFeet.toFixed(0)} ft)</span><span>{fmt(q.wire)}</span></div>
              </div>

              <div style={{ padding: '12px 16px', background: 'var(--surface2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 16 }}>Total</span>
                <span style={{ fontWeight: 700, fontSize: 20, color: tier.color }}>{fmt(q.total)}</span>
              </div>

              {selected && (
                <div style={{ position: 'absolute', top: 12, right: 12, background: tier.color, borderRadius: 6, fontSize: 11, fontWeight: 700, color: '#fff', padding: '3px 8px' }}>Selected</div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px 28px', background: 'rgba(15,15,15,0.95)', borderTop: '1px solid var(--border)', backdropFilter: 'blur(8px)' }}>
        {sent ? (
          <div style={{ textAlign: 'center', color: '#22c55e', fontWeight: 600, padding: 14 }}>✓ Quote sent to {project.email}</div>
        ) : (
          <button onClick={sendQuote} disabled={sending || !project.email} style={{ width: '100%', background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 700, padding: 14, cursor: project.email ? 'pointer' : 'not-allowed', opacity: project.email ? 1 : 0.5 }}>
            {sending ? 'Sending…' : project.email ? `Send Quote to ${project.homeowner}` : 'No homeowner email on file'}
          </button>
        )}
      </div>
    </div>
  )
}

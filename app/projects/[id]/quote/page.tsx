'use client'
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Project } from '@/lib/supabase'
import { TIERS, calcQuote, calcTotalWatts, recommendTransformer, type TierId } from '@/lib/catalog'

const DEADLINE_OPTIONS = [
  { label: '24 hours', hours: 24 },
  { label: '48 hours', hours: 48 },
  { label: '72 hours', hours: 72 },
]

const fmt = (n: number) => '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })

export default function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [bidDeadlineHours, setBidDeadlineHours] = useState(48)
  const [biddingJob, setBiddingJob] = useState<{ id: string } | null>(null)
  const [puttingToBid, setPuttingToBid] = useState(false)

  useEffect(() => {
    supabase.from('projects').select('*').eq('id', id).single().then(({ data }) => {
      if (data) setProject(data)
    })
    // Check if already put to bid
    supabase.from('bid_jobs').select('id,status').eq('project_id', id).eq('status', 'open').maybeSingle().then(({ data }) => {
      if (data) setBiddingJob(data)
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

  async function putToBid() {
    if (!project) return
    setPuttingToBid(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setPuttingToBid(false); return }
    const tier = project.selected_tier ?? 'mid'
    const laborCeiling = calcQuote(project)[tier].labor
    const deadline = new Date(Date.now() + bidDeadlineHours * 3600 * 1000).toISOString()
    const { data, error } = await supabase.from('bid_jobs').insert({
      project_id: id,
      owner_id: user.id,
      labor_ceiling: laborCeiling,
      deadline,
    }).select('id').single()
    if (!error && data) {
      await supabase.from('projects').update({ status: 'bidding' }).eq('id', id)
      setProject(p => p ? { ...p, status: 'bidding' } : p)
      setBiddingJob({ id: data.id })
    }
    setPuttingToBid(false)
  }

  if (!project) return <div style={{ background: 'var(--bg)', height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>Loading…</div>

  const quote = calcQuote(project)
  const wireFeet = (project.wires || []).reduce((s, w) => s + (w.feet || 0), 0)
  const fixtures = (project.markers || []).filter(m => m.type !== 'power')
  const totalWatts = calcTotalWatts(fixtures)
  const recXfmr = recommendTransformer(totalWatts)

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100dvh' }}>
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 16px', height: 52, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push(`/projects/${id}/map`)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 20, cursor: 'pointer' }}>‹ Map</button>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Quote — {project.homeowner || project.name}</span>
      </header>

      {fixtures.length > 0 && (
        <div style={{ margin: '12px 16px 0', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            <span style={{ fontWeight: 600, color: 'var(--fg)' }}>{fixtures.length} fixtures</span> · <span style={{ fontWeight: 600, color: 'var(--fg)' }}>{totalWatts}W</span> total load (incl. 20% buffer)
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right', flexShrink: 0 }}>
            Needs: <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{recXfmr.name}</span>
          </div>
        </div>
      )}

      <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, paddingBottom: 16, alignItems: 'start' }}>
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
              <div style={{ borderTop: `3px solid ${tier.color}`, padding: '12px 12px 8px' }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: tier.color }}>{tier.label}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{tier.tagline}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, opacity: 0.7 }}>{tier.note}</div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', fontSize: 12 }}>
                {q.lines.map((l, i) => (
                  <div key={i} style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.label.split('–')[0].trim()}</span>
                      <span style={{ fontWeight: 600, flexShrink: 0 }}>{fmt(l.total)}</span>
                    </div>
                    <div style={{ fontSize: 10, opacity: 0.5, marginTop: 1 }}>×{l.qty} · {fmt(l.unitPrice)} ea</div>
                  </div>
                ))}
              </div>

              <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Labor</span><span>{fmt(q.labor)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Wire</span><span>{fmt(q.wire)}</span></div>
              </div>

              <div style={{ padding: '10px 12px', background: 'var(--surface2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>Total</span>
                <span style={{ fontWeight: 700, fontSize: 17, color: tier.color }}>{fmt(q.total)}</span>
              </div>

              {selected && (
                <div style={{ position: 'absolute', top: 10, right: 10, background: tier.color, borderRadius: 5, fontSize: 10, fontWeight: 700, color: '#fff', padding: '2px 6px' }}>✓</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Put out to bid panel */}
      <div style={{ margin: '0 16px 120px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Put labor out to bid</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
          Licensed electricians will submit sealed bids. The lowest valid bid wins when the deadline expires.
          {project.selected_tier && (
            <> Labor ceiling: <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{fmt(calcQuote(project)[project.selected_tier].labor)}</span> ({project.selected_tier})</>
          )}
        </div>
        {biddingJob ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#22c55e' }}>
            <span>✓</span>
            <span>Job is live · <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, padding: 0 }}>View bids →</button></span>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={bidDeadlineHours}
              onChange={e => setBidDeadlineHours(Number(e.target.value))}
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--fg)', fontSize: 12, padding: '6px 8px', cursor: 'pointer' }}
            >
              {DEADLINE_OPTIONS.map(o => <option key={o.hours} value={o.hours}>{o.label}</option>)}
            </select>
            <button
              onClick={putToBid}
              disabled={puttingToBid}
              style={{ flex: 1, background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, padding: '7px 14px', cursor: 'pointer', opacity: puttingToBid ? 0.6 : 1 }}
            >
              {puttingToBid ? 'Publishing…' : 'Put out to bid'}
            </button>
          </div>
        )}
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

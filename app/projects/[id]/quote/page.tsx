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
  const [sendTiers, setSendTiers] = useState<TierId[]>(['premium'])
  const [bidDeadlineHours, setBidDeadlineHours] = useState(48)
  const [biddingJob, setBiddingJob] = useState<{ id: string } | null>(null)
  const [puttingToBid, setPuttingToBid] = useState(false)
  const [bidSentAnim, setBidSentAnim] = useState(false)

  useEffect(() => {
    supabase.from('projects').select('*').eq('id', id).single().then(({ data }) => {
      if (data) {
        setProject(data)
        setSendTiers([data.selected_tier || 'premium'])
      }
    })
    supabase.from('bid_jobs').select('id,status').eq('project_id', id).eq('status', 'open').maybeSingle().then(({ data }) => {
      if (data) setBiddingJob(data)
    })
  }, [id])

  async function selectTier(tier: TierId) {
    await supabase.from('projects').update({ selected_tier: tier }).eq('id', id)
    setProject(p => p ? { ...p, selected_tier: tier } : p)
  }

  function toggleSendTier(tier: TierId) {
    setSendTiers(prev =>
      prev.includes(tier) ? prev.filter(t => t !== tier) : [...prev, tier]
    )
  }

  async function sendQuote() {
    if (!project?.email) { alert('No homeowner email on file.'); return }
    if (sendTiers.length === 0) { alert('Select at least one tier to send.'); return }
    setSending(true)
    const res = await fetch('/api/send-quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: id, tiers: sendTiers }),
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
      setBidSentAnim(true)
      setTimeout(() => { setBidSentAnim(false); setBiddingJob({ id: data.id }) }, 2200)
    }
    setPuttingToBid(false)
  }

  if (!project) return (
    <div style={{ background: '#0f0f0f', height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
      Loading…
    </div>
  )

  const quote = calcQuote(project)
  const wireFeet = (project.wires || []).reduce((s, w) => s + (w.feet || 0), 0)
  const fixtures = (project.markers || []).filter(m => m.type !== 'power')
  const totalWatts = calcTotalWatts(fixtures)
  const recXfmr = recommendTransformer(totalWatts)

  // footer height: ~90px
  return (
    <div style={{ background: '#0f0f0f', height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* sticky header */}
      <header style={{ background: '#1a1a1a', borderBottom: '1px solid #2e2e2e', padding: '0 16px', height: 52, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={() => router.push(`/projects/${id}/map`)} style={{ background: 'none', border: 'none', color: '#F4884A', fontSize: 20, cursor: 'pointer' }}>‹ Map</button>
        <span style={{ fontWeight: 600, fontSize: 14, color: '#f0f0f0' }}>Quote — {project.homeowner || project.name}</span>
      </header>

      {/* scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>
        {fixtures.length > 0 && (
          <div style={{ margin: '12px 16px 0', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontSize: 12, color: '#888' }}>
              <span style={{ fontWeight: 600, color: '#f0f0f0' }}>{fixtures.length} fixtures</span> · <span style={{ fontWeight: 600, color: '#f0f0f0' }}>{totalWatts}W</span> total load (incl. 20% buffer)
            </div>
            <div style={{ fontSize: 11, color: '#888', textAlign: 'right', flexShrink: 0 }}>
              Needs: <span style={{ fontWeight: 600, color: '#F4884A' }}>{recXfmr.name}</span>
            </div>
          </div>
        )}

        {/* tier cards */}
        <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, alignItems: 'start' }}>
          {(Object.keys(TIERS) as TierId[]).map(tierId => {
            const tier = TIERS[tierId]
            const q = quote[tierId]

            return (
              <div
                key={tierId}
                style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: 14, overflow: 'hidden', position: 'relative' }}
              >
                <div style={{ borderTop: `3px solid ${tier.color}`, padding: '12px 12px 8px' }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: tier.color }}>{tier.label}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{tier.tagline}</div>
                  <div style={{ fontSize: 10, color: '#888', marginTop: 2, opacity: 0.7 }}>{tier.note}</div>
                </div>

                <div style={{ borderTop: '1px solid #2e2e2e', fontSize: 12 }}>
                  {q.lines.map((l, i) => (
                    <div key={i} style={{ padding: '6px 12px', borderBottom: '1px solid #2e2e2e', color: '#888' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.label.split('–')[0].trim()}</span>
                        <span style={{ fontWeight: 600, flexShrink: 0, color: '#f0f0f0' }}>{fmt(l.total)}</span>
                      </div>
                      <div style={{ fontSize: 10, opacity: 0.5, marginTop: 1 }}>×{l.qty} · {fmt(l.unitPrice)} ea</div>
                    </div>
                  ))}
                </div>

                <div style={{ padding: '8px 12px', borderTop: '1px solid #2e2e2e', fontSize: 12, color: '#888', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Labor</span><span>{fmt(q.labor)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Wire</span><span>{fmt(q.wire)}</span></div>
                </div>

                <div style={{ padding: '10px 12px', background: '#242424', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#f0f0f0' }}>Total</span>
                  <span style={{ fontWeight: 700, fontSize: 17, color: tier.color }}>{fmt(q.total)}</span>
                </div>

                </div>
            )
          })}
        </div>

        {/* Send options */}
        <div style={{ margin: '0 16px 12px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#f0f0f0', marginBottom: 8 }}>Send proposal</div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>Choose which tiers to include in the email:</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 0 }}>
            {(Object.keys(TIERS) as TierId[]).map(tierId => {
              const tier = TIERS[tierId]
              const checked = sendTiers.includes(tierId)
              return (
                <button
                  key={tierId}
                  onClick={() => toggleSendTier(tierId)}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: 9, border: `1.5px solid ${checked ? tier.color : '#2e2e2e'}`,
                    background: checked ? `${tier.color}18` : 'transparent',
                    color: checked ? tier.color : '#666', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    transition: 'all .15s',
                  }}
                >
                  {checked ? '✓ ' : ''}{tier.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Bid panel */}
        <div style={{ margin: '0 16px 16px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#f0f0f0', marginBottom: 4 }}>Put labor out to bid</div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
            Licensed electricians submit sealed bids. Lowest valid bid wins at deadline.
            {project.selected_tier && (
              <> Labor ceiling: <span style={{ color: '#f0f0f0', fontWeight: 600 }}>{fmt(calcQuote(project)[project.selected_tier].labor)}</span> ({project.selected_tier})</>
            )}
          </div>
          {bidSentAnim ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px 0', gap: 10 }}>
              <style>{`
                @keyframes bidCheckScale { 0%{transform:scale(0);opacity:0} 60%{transform:scale(1.25);opacity:1} 100%{transform:scale(1);opacity:1} }
                @keyframes bidRingPulse  { 0%{transform:scale(0.8);opacity:0.8} 100%{transform:scale(1.8);opacity:0} }
                @keyframes bidLabelUp   { 0%{opacity:0;transform:translateY(6px)} 100%{opacity:1;transform:translateY(0)} }
              `}</style>
              <div style={{ position: 'relative', width: 52, height: 52 }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid #22c55e', animation: 'bidRingPulse 1s ease-out forwards' }} />
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid #22c55e', animation: 'bidRingPulse 1s ease-out 0.3s forwards', opacity: 0 }} />
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', border: '2px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'bidCheckScale 0.4s cubic-bezier(.22,1,.36,1) forwards' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#22c55e', animation: 'bidLabelUp 0.4s ease 0.2s both' }}>Job published to bidding!</div>
            </div>
          ) : biddingJob ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#22c55e' }}>
              <span>✓ Job is live ·</span>
              <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: '#F4884A', cursor: 'pointer', fontSize: 13, padding: 0 }}>View bids →</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={bidDeadlineHours}
                onChange={e => setBidDeadlineHours(Number(e.target.value))}
                style={{ background: '#242424', border: '1px solid #2e2e2e', borderRadius: 8, color: '#f0f0f0', fontSize: 12, padding: '6px 8px', cursor: 'pointer' }}
              >
                {DEADLINE_OPTIONS.map(o => <option key={o.hours} value={o.hours}>{o.label}</option>)}
              </select>
              <button
                onClick={putToBid}
                disabled={puttingToBid}
                style={{ flex: 1, background: '#F4884A', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, padding: '7px 14px', cursor: 'pointer', opacity: puttingToBid ? 0.6 : 1 }}
              >
                {puttingToBid ? 'Publishing…' : 'Put out to bid'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* fixed footer */}
      <div style={{ flexShrink: 0, padding: '12px 16px 28px', background: 'rgba(15,15,15,0.97)', borderTop: '1px solid #2e2e2e', backdropFilter: 'blur(8px)' }}>
        {sent ? (
          <div style={{ textAlign: 'center', color: '#22c55e', fontWeight: 600, padding: 14 }}>
            ✓ Quote sent to {project.email}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ flex: 1, fontSize: 11, color: '#666' }}>
              Sending: {sendTiers.length === 0 ? <span style={{ color: '#ef4444' }}>none selected</span> : sendTiers.map(t => TIERS[t].label).join(' + ')}
            </div>
            <button
              onClick={sendQuote}
              disabled={sending || !project.email || sendTiers.length === 0}
              style={{ background: '#F4884A', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, padding: '12px 20px', cursor: (project.email && sendTiers.length > 0) ? 'pointer' : 'not-allowed', opacity: (project.email && sendTiers.length > 0) ? 1 : 0.5, whiteSpace: 'nowrap' }}
            >
              {sending ? 'Sending…' : project.email ? `Send to ${project.homeowner}` : 'No email on file'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

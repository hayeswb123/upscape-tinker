'use client'
import React, { useEffect, useState, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Project } from '@/lib/supabase'

const STATUS_LABEL: Record<string, string> = { draft: 'Draft', quoted: 'Quoted', approved: 'Approved', installed: 'Installed' }
const STATUS_COLOR: Record<string, string> = { draft: '#6b7280', quoted: '#F4884A', approved: '#22c55e', installed: '#a78bfa' }

function NoProjects({ clientName, address, router, L, muted }: { clientName: string; address: string; router: any; L: boolean; muted: string }) {
  const dust = React.useMemo(() => Array.from({ length: 8 }, (_, i) => ({
    id: i,
    left: 15 + (i * 43 + i * i * 9) % 70,
    top:  20 + (i * 59 + i * 7)     % 60,
    size: 1 + (i % 3) * 0.6,
    delay: (i * 1.3) % 9,
    dur:   10 + (i * 1.5) % 7,
    dx0: ((i * 19) % 36) - 18, dy0: ((i * 13) % 24) - 12,
    dx1: ((i * 27) % 36) - 18, dy1: ((i * 17) % 24) - 12,
    op: 0.06 + (i % 3) * 0.04,
  })), [])

  // glowing connection lines radiating from folder
  const lines = [
    { x1:'50%', y1:'50%', x2:'15%',  y2:'20%',  delay:0 },
    { x1:'50%', y1:'50%', x2:'85%',  y2:'25%',  delay:0.6 },
    { x1:'50%', y1:'50%', x2:'10%',  y2:'72%',  delay:1.2 },
    { x1:'50%', y1:'50%', x2:'90%',  y2:'68%',  delay:1.8 },
    { x1:'50%', y1:'50%', x2:'50%',  y2:'10%',  delay:0.9 },
  ]

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', paddingTop:40, paddingBottom:60, animation:'fadeUp .6s ease both' }}>

      {/* folder + connection lines + dust */}
      <div style={{ position:'relative', width:320, height:260, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:4 }}>

        {/* SVG connection lines */}
        <svg width="100%" height="100%" style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'visible' }}>
          {lines.map((l,i) => (
            <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke="rgba(244,136,74,0.5)" strokeWidth="1"
              strokeDasharray="4 6"
              style={{ animation:`linePulse 3s ease-in-out ${l.delay}s infinite` }} />
          ))}
          {/* small dots at line ends */}
          {lines.map((l,i) => (
            <circle key={i} cx={l.x2} cy={l.y2} r="2.5"
              fill="rgba(244,136,74,0.35)"
              style={{ animation:`linePulse 3s ease-in-out ${l.delay}s infinite` }} />
          ))}
        </svg>

        {/* dust */}
        {dust.map(p => (
          <div key={p.id} style={{
            position:'absolute', left:`${p.left}%`, top:`${p.top}%`,
            width:p.size, height:p.size, borderRadius:'50%',
            background:'rgba(244,155,70,1)', pointerEvents:'none',
            ['--dx0' as any]:`${p.dx0}px`, ['--dy0' as any]:`${p.dy0}px`,
            ['--dx1' as any]:`${p.dx1}px`, ['--dy1' as any]:`${p.dy1}px`,
            ['--op' as any]:p.op,
            animation:`dustFloat ${p.dur}s ease-in-out ${p.delay}s infinite`,
          }} />
        ))}

        {/* folder */}
        <div style={{ animation:'floatFolder 5s ease-in-out infinite', position:'relative', zIndex:1 }}>
          <img src="/empty-folder.png" alt="" style={{
            width:220, height:'auto', display:'block',
            mixBlendMode:'screen',
            WebkitMaskImage:'linear-gradient(to bottom, black 65%, transparent 100%)',
            maskImage:'linear-gradient(to bottom, black 65%, transparent 100%)',
          }} />
        </div>
      </div>

      <h2 style={{ margin:'0 0 8px', fontSize:20, fontWeight:700, letterSpacing:'-0.035em', color: L ? '#1a1714' : 'rgba(255,255,255,0.82)', textAlign:'center' }}>
        Create your first project
      </h2>
      <p style={{ margin:'0 0 28px', fontSize:12, color: muted, textAlign:'center', lineHeight:1.6, maxWidth:200 }}>
        Start designing the lighting system for {clientName}.
      </p>

      <button className="new-btn"
        onClick={() => router.push(`/projects/new?homeowner=${encodeURIComponent(clientName)}&address=${encodeURIComponent(address)}`)}
        style={{ background:'linear-gradient(135deg,#F4884A,#df6f28)', border:'none', borderRadius:11, color:'#fff', fontWeight:600, fontSize:13, padding:'12px 26px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:7, boxShadow:'0 0 24px rgba(244,136,74,0.28), 0 4px 14px rgba(0,0,0,0.35)', letterSpacing:'-0.01em' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
        New project
      </button>
    </div>
  )
}

function UpscapeMark({ size = 36 }: { size?: number }) {
  return <img src="/upscape-logo-mark.png" alt="Upscape" width={size} height={size} style={{ objectFit: 'contain', display: 'block' }} />
}

export default function ClientPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params)
  const router = useRouter()
  const clientName = decodeURIComponent(key)

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [L, setL] = useState(false)

  useEffect(() => {
    setL(localStorage.getItem('upscape_theme') === 'light')
    supabase
      .from('projects')
      .select('*')
      .eq('homeowner', clientName)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setProjects(data || [])
        setLoading(false)
      })
  }, [clientName])

  async function deleteProject(id: string) {
    setProjects(prev => prev.filter(p => p.id !== id))
    setConfirmDelete(null)
    await supabase.from('projects').delete().eq('id', id)
  }

  async function uploadImage(projectId: string, file: File) {
    setUploading(projectId)
    try {
      const ext  = file.name.split('.').pop()
      const path = `${projectId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('project-images').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('project-images').getPublicUrl(path)
      await supabase.from('projects').update({ cover_image: publicUrl }).eq('id', projectId)
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, cover_image: publicUrl } : p))
    } catch (e: any) {
      alert('Upload failed: ' + e.message)
    }
    setUploading(null)
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const initials = clientName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const address = projects[0]?.address || ''

  // ── color tokens ─────────────────────────────────────────
  const bg         = L ? '#ede9e3' : 'linear-gradient(145deg,#060504 0%,#0a0906 60%,#080604 100%)'
  const headerBg   = L ? 'rgba(255,255,255,0.85)' : 'rgba(8,7,6,0.7)'
  const headerBdr  = L ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.05)'
  const txt        = L ? '#1a1714' : 'rgba(255,255,255,0.9)'
  const muted      = L ? '#6b635c' : 'rgba(255,255,255,0.28)'
  const cardBg     = L ? '#ffffff' : 'rgba(255,255,255,0.025)'
  const cardBdr    = L ? '1px solid #e0dbd4' : '1px solid rgba(255,255,255,0.065)'
  const cardShadow = L ? '0 1px 4px rgba(0,0,0,0.07)' : '0 2px 14px rgba(0,0,0,.3)'
  const backBtn    = L
    ? { background:'rgba(0,0,0,0.05)', border:'1px solid rgba(0,0,0,0.1)', color:'rgba(0,0,0,0.5)' }
    : { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.45)' }
  const divider    = L ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.08)'
  const metaColor  = L ? '#8a837a' : 'rgba(255,255,255,0.22)'
  const dateColor  = L ? '#a09890' : 'rgba(255,255,255,0.15)'
  const arrowColor = L ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.22)'
  const trashColor = L ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.35)'
  const trashBtnBg = L ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.07)'
  const cancelBdr  = L ? '1px solid rgba(0,0,0,0.12)' : '1px solid rgba(255,255,255,0.08)'
  const cancelClr  = L ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.28)'

  return (
    <div style={{ background: bg, minHeight: '100dvh', color: txt }}>
      <style>{`
        @keyframes fadeUp      { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin        { to{transform:rotate(360deg)} }
        @keyframes floatFolder { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-3px)} }
        @keyframes dustFloat   { 0%{transform:translate(var(--dx0),var(--dy0));opacity:0} 15%{opacity:var(--op)} 85%{opacity:var(--op)} 100%{transform:translate(var(--dx1),var(--dy1));opacity:0} }
        @keyframes linePulse   { 0%,100%{opacity:.07} 50%{opacity:.18} }
        .client-dash-card { transition: transform .2s cubic-bezier(.22,1,.36,1), box-shadow .2s ease, border-color .2s ease; }
        .client-dash-card:hover { transform: translateY(-1px); }
        .upscape-light .client-dash-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1), 0 0 0 1.5px rgba(244,136,74,.4) !important; border-color: rgba(244,136,74,.35) !important; }
        .upscape-dark  .client-dash-card:hover { box-shadow: 0 6px 32px rgba(0,0,0,.55), 0 0 0 1px rgba(244,136,74,.16) !important; border-color: rgba(244,136,74,.2) !important; }
        .client-dash-card:hover .card-name-cl { ${L ? 'color:#1a1714 !important;' : 'color:rgba(255,255,255,.98) !important;'} }
        .card-arrow-cl { transition: transform .18s ease, opacity .18s ease; }
        .client-dash-card:hover .card-arrow-cl { transform: translateX(3px); opacity:.9 !important; }
        .new-btn { transition: box-shadow .2s ease, transform .18s ease; }
        .new-btn:hover { transform: translateY(-1px); box-shadow: 0 0 20px rgba(244,136,74,.35), 0 4px 14px rgba(0,0,0,.4) !important; }
      `}</style>

      <div className={L ? 'upscape-light' : 'upscape-dark'}>
        {/* header */}
        <header style={{ height: 56, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 14, background: headerBg, backdropFilter: 'blur(20px)', borderBottom: headerBdr, position: 'sticky', top: 0, zIndex: 10, boxShadow: L ? '0 1px 0 rgba(0,0,0,0.04)' : 'none' }}>
          <button onClick={() => router.push('/dashboard')}
            style={{ ...backBtn, borderRadius: 8, fontSize: 13, padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Clients
          </button>
          <div style={{ width: 1, height: 20, background: divider }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,rgba(244,136,74,0.2),rgba(244,136,74,0.07))', border: '1px solid rgba(244,136,74,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'rgba(244,136,74,0.9)', flexShrink: 0 }}>{initials}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.03em', color: txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clientName}</div>
              {address && <div style={{ fontSize: 11, color: muted, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{address}</div>}
            </div>
          </div>
          <button className="new-btn" onClick={() => router.push(`/projects/new?homeowner=${encodeURIComponent(clientName)}&address=${encodeURIComponent(address)}`)}
            style={{ background: 'linear-gradient(135deg,#F4884A,#df6f28)', border: 'none', borderRadius: 9, color: '#fff', fontWeight: 600, fontSize: 12, padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '-0.02em', boxShadow: '0 2px 10px rgba(244,136,74,0.25)', flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            New project
          </button>
        </header>

        {/* content */}
        <main style={{ maxWidth: 640, margin: '0 auto', padding: '28px 20px 60px', animation: 'fadeUp .3s ease both' }}>

          {loading && (
            <div style={{ textAlign: 'center', paddingTop: 60 }}>
              <div style={{ width: 24, height: 24, border: '2px solid rgba(244,136,74,0.25)', borderTopColor: '#F4884A', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 10px' }} />
              <p style={{ color: muted, fontSize: 12 }}>Loading…</p>
            </div>
          )}

          {!loading && projects.length === 0 && (
            <NoProjects clientName={clientName} address={address} router={router} L={L} muted={muted} />
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {projects.map((p, i) => {
              const fixtureCount = (p.markers || []).filter((m: any) => m.type !== 'power').length
              const wireCount    = (p.wires || []).length
              const zoneCount    = (p.zones || []).length
              const isHovered    = hoveredId === p.id
              const isUploading  = uploading === p.id
              const fileInputRef = React.createRef<HTMLInputElement>()
              return (
                <div key={p.id} className="client-dash-card"
                  onClick={() => router.push(`/projects/${p.id}/map`)}
                  onMouseEnter={() => setHoveredId(p.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{ background: isHovered ? (L ? '#f5f2ee' : 'rgba(22,19,14,0.98)') : cardBg, border: cardBdr, borderRadius: 13, padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 13, boxShadow: cardShadow, animation: 'fadeUp .3s ease both', animationDelay: `${i * .04}s`, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: 2.5, borderRadius: 2, background: STATUS_COLOR[p.status] || '#6b7280', opacity: .65 }} />

                  {/* thumbnail / upload zone */}
                  <div
                    onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
                    style={{ width: 52, height: 52, borderRadius: 10, background: 'rgba(244,136,74,0.06)', border: '1px solid rgba(244,136,74,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 7, overflow: 'hidden', position: 'relative', cursor: 'pointer' }}>
                    {p.cover_image
                      ? <img src={p.cover_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : isUploading
                        ? <div style={{ width: 18, height: 18, border: '2px solid rgba(244,136,74,0.25)', borderTopColor: '#F4884A', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                        : <UpscapeMark size={22} />
                    }
                    {!isUploading && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity .15s' }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '0')}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(p.id, f) }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="card-name-cl" style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.025em', color: txt, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'color .18s' }}>{p.name || p.address || 'Untitled project'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4 }}>
                      <span style={{ background: STATUS_COLOR[p.status] + '16', color: STATUS_COLOR[p.status], borderRadius: 5, fontSize: 10, fontWeight: 600, padding: '2px 6px', letterSpacing: '0.03em', textTransform: 'uppercase' }}>{STATUS_LABEL[p.status] || 'Draft'}</span>
                      <span style={{ color: metaColor, fontSize: 11 }}>{fixtureCount} fixture{fixtureCount !== 1 ? 's' : ''}{wireCount > 0 ? ` · ${wireCount}w` : ''}{zoneCount > 0 ? ` · ${zoneCount}z` : ''}</span>
                      <span style={{ color: dateColor, fontSize: 11, marginLeft: 'auto' }}>{fmt(p.created_at)}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                    {confirmDelete === p.id ? (
                      <>
                        <button onClick={e => { e.stopPropagation(); deleteProject(p.id) }} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.28)', borderRadius: 7, color: '#ef4444', fontSize: 11, fontWeight: 600, padding: '3px 9px', cursor: 'pointer' }}>Delete</button>
                        <button onClick={e => { e.stopPropagation(); setConfirmDelete(null) }} style={{ background: 'none', border: cancelBdr, borderRadius: 7, color: cancelClr, fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={e => { e.stopPropagation(); setConfirmDelete(p.id) }} style={{ background: trashBtnBg, border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke={trashColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 11v5M14 11v5" stroke={trashColor} strokeWidth="1.8" strokeLinecap="round"/></svg>
                        </button>
                        <span className="card-arrow-cl" style={{ color: arrowColor, fontSize: 17, lineHeight: 1, opacity: .45 }}>›</span>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Always-visible cinematic folder below projects */}
          {!loading && projects.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', paddingTop:56, paddingBottom:20, animation:'fadeUp .6s ease both', animationDelay:'.2s' }}>
              <div style={{ width:1, height:40, background:'linear-gradient(to bottom,rgba(255,255,255,0.06),transparent)', marginBottom:32 }} />
              <div style={{ animation:'floatFolder 5s ease-in-out infinite' }}>
                <img src="/empty-folder.png" alt="" style={{
                  width:180, height:'auto', display:'block',
                  mixBlendMode:'screen',
                  WebkitMaskImage:'linear-gradient(to bottom, black 60%, transparent 100%)',
                  maskImage:'linear-gradient(to bottom, black 60%, transparent 100%)',
                }} />
              </div>
              <p style={{ margin:'4px 0 0', fontSize:12, color:'rgba(255,255,255,0.14)', letterSpacing:'-0.01em' }}>Ready to add more?</p>
              <button onClick={() => router.push(`/projects/new?homeowner=${encodeURIComponent(clientName)}&address=${encodeURIComponent(address)}`)}
                style={{ marginTop:16, display:'flex', alignItems:'center', gap:6, padding:'9px 20px', borderRadius:9, background:'linear-gradient(135deg,#F4884A,#df6f28)', border:'none', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', letterSpacing:'-0.01em', boxShadow:'0 0 20px rgba(244,136,74,0.2), 0 4px 12px rgba(0,0,0,0.35)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                New project
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

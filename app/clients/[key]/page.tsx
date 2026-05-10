'use client'
import React, { useEffect, useState, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Project } from '@/lib/supabase'

const STATUS_LABEL: Record<string, string> = { draft: 'Draft', quoted: 'Quoted', approved: 'Approved', installed: 'Installed' }
const STATUS_COLOR: Record<string, string> = { draft: '#6b7280', quoted: '#F4884A', approved: '#22c55e', installed: '#a78bfa' }

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
  const [uploading, setUploading] = useState<string | null>(null) // project id being uploaded
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  useEffect(() => {
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

  return (
    <div style={{ background: 'linear-gradient(145deg,#060504 0%,#0a0906 60%,#080604 100%)', minHeight: '100dvh', color: '#fff' }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        .dash-card { transition: transform .2s cubic-bezier(.22,1,.36,1), box-shadow .2s ease, border-color .2s ease; }
        .dash-card:hover { transform: translateY(-1px); box-shadow: 0 6px 32px rgba(0,0,0,.55), 0 0 0 1px rgba(244,136,74,.16) !important; border-color: rgba(244,136,74,.2) !important; }
        .dash-card:hover .card-name { color: rgba(255,255,255,.98) !important; }
        .card-arrow { transition: transform .18s ease, opacity .18s ease; }
        .dash-card:hover .card-arrow { transform: translateX(3px); opacity:.9 !important; }
        .new-btn { transition: box-shadow .2s ease, transform .18s ease; }
        .new-btn:hover { transform: translateY(-1px); box-shadow: 0 0 20px rgba(244,136,74,.35), 0 4px 14px rgba(0,0,0,.4) !important; }
      `}</style>

      {/* header */}
      <header style={{ height: 56, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 14, background: 'rgba(8,7,6,0.7)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: 'rgba(255,255,255,0.45)', fontSize: 13, padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Clients
        </button>
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,rgba(244,136,74,0.2),rgba(244,136,74,0.07))', border: '1px solid rgba(244,136,74,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'rgba(244,136,74,0.9)', flexShrink: 0 }}>{initials}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clientName}</div>
            {address && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{address}</div>}
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
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>Loading…</p>
          </div>
        )}

        {!loading && projects.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 80 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(244,136,74,0.07)', border: '1px solid rgba(244,136,74,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(244,136,74,0.6)" strokeWidth="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.6)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>No projects yet</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.22)', margin: '0 0 24px' }}>Create the first project for {clientName}.</p>
            <button className="new-btn" onClick={() => router.push(`/projects/new?homeowner=${encodeURIComponent(clientName)}&address=${encodeURIComponent(address)}`)}
              style={{ background: 'linear-gradient(135deg,#F4884A,#df6f28)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 600, fontSize: 13, padding: '11px 22px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, boxShadow: '0 2px 12px rgba(244,136,74,0.3)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              New project
            </button>
          </div>
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
              <div key={p.id} className="dash-card"
                onClick={() => router.push(`/projects/${p.id}/map`)}
                onMouseEnter={() => setHoveredId(p.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{ background: isHovered ? 'rgba(22,19,14,0.98)' : 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.065)', borderRadius: 13, padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 13, boxShadow: '0 2px 14px rgba(0,0,0,.3)', animation: 'fadeUp .3s ease both', animationDelay: `${i * .04}s`, position: 'relative', overflow: 'hidden' }}>
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
                  {/* camera overlay on hover */}
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
                  <div className="card-name" style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.025em', color: 'rgba(255,255,255,0.86)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'color .18s' }}>{p.name || p.address || 'Untitled project'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4 }}>
                    <span style={{ background: STATUS_COLOR[p.status] + '16', color: STATUS_COLOR[p.status], borderRadius: 5, fontSize: 10, fontWeight: 600, padding: '2px 6px', letterSpacing: '0.03em', textTransform: 'uppercase' }}>{STATUS_LABEL[p.status] || 'Draft'}</span>
                    <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: 11 }}>{fixtureCount} fixture{fixtureCount !== 1 ? 's' : ''}{wireCount > 0 ? ` · ${wireCount}w` : ''}{zoneCount > 0 ? ` · ${zoneCount}z` : ''}</span>
                    <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11, marginLeft: 'auto' }}>{fmt(p.created_at)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                  {confirmDelete === p.id ? (
                    <>
                      <button onClick={e => { e.stopPropagation(); deleteProject(p.id) }} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.28)', borderRadius: 7, color: '#ef4444', fontSize: 11, fontWeight: 600, padding: '3px 9px', cursor: 'pointer' }}>Delete</button>
                      <button onClick={e => { e.stopPropagation(); setConfirmDelete(null) }} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, color: 'rgba(255,255,255,0.28)', fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={e => { e.stopPropagation(); setConfirmDelete(p.id) }} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 11v5M14 11v5" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round"/></svg>
                      </button>
                      <span className="card-arrow" style={{ color: 'rgba(255,255,255,0.22)', fontSize: 17, lineHeight: 1, opacity: .45 }}>›</span>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Project } from '@/lib/supabase'

const STATUS_LABEL: Record<string, string> = { draft: 'Draft', quoted: 'Quoted', approved: 'Approved', installed: 'Installed' }
const STATUS_COLOR: Record<string, string> = { draft: '#6b7280', quoted: '#3b82f6', approved: '#22c55e', installed: '#a78bfa' }

export default function DashboardPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  useEffect(() => { fetchProjects() }, [])

  async function fetchProjects() {
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
    setProjects(data || [])
    setLoading(false)
  }

  async function deleteProject(id: string) {
    setProjects(prev => prev.filter(p => p.id !== id))
    setConfirmDelete(null)
    await supabase.from('projects').delete().eq('id', id)
  }

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/')
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const draftCount     = projects.filter(p => p.status === 'draft').length
  const quotedCount    = projects.filter(p => p.status === 'quoted').length
  const approvedCount  = projects.filter(p => p.status === 'approved').length
  const installedCount = projects.filter(p => p.status === 'installed').length

  return (
    <div style={{ background: 'linear-gradient(160deg, #070707 0%, #0c0b09 60%, #0a0806 100%)', minHeight: '100dvh', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ambientPulse {
          0%, 100% { opacity: 0.18; }
          50%       { opacity: 0.28; }
        }
        .dash-card {
          transition: transform 0.22s cubic-bezier(0.22,1,0.36,1), box-shadow 0.22s ease, border-color 0.22s ease;
          animation: fadeUp 0.4s ease both;
        }
        .dash-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(244,136,74,0.18), 0 0 24px rgba(244,136,74,0.06) !important;
          border-color: rgba(244,136,74,0.22) !important;
        }
        .dash-card:hover .card-arrow { transform: translateX(3px); opacity: 0.8 !important; }
        .dash-card:hover .card-name  { color: rgba(255,255,255,0.98) !important; }
        .card-arrow { transition: transform 0.2s ease, opacity 0.2s ease; }
        .new-btn {
          transition: box-shadow 0.2s ease, transform 0.2s ease, background 0.2s ease;
        }
        .new-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 0 24px rgba(244,136,74,0.4), 0 4px 16px rgba(0,0,0,0.4) !important;
          background: linear-gradient(135deg, #f5a060, #e87030) !important;
        }
      `}</style>

      {/* ambient background glow */}
      <div style={{ position: 'fixed', top: -120, left: '50%', transform: 'translateX(-50%)', width: 600, height: 300, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(244,136,74,0.07) 0%, transparent 70%)', pointerEvents: 'none', animation: 'ambientPulse 6s ease-in-out infinite' }} />
      <div style={{ position: 'fixed', bottom: -60, right: -60, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(244,136,74,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* navbar */}
      <header style={{
        background: 'rgba(8,7,6,0.72)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.055)',
        padding: '0 20px', height: 54,
        display: 'flex', alignItems: 'center', gap: 14,
        position: 'sticky', top: 0, zIndex: 20,
        boxShadow: '0 1px 0 rgba(244,136,74,0.04), 0 4px 24px rgba(0,0,0,0.3)',
      }}>
        <img src="/upscape-logo.svg" alt="Upscape" style={{ height: 22, filter: 'invert(1)', opacity: 0.92 }} />
        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)', marginLeft: 4 }} />
        <span style={{ flex: 1 }} />
        <button onClick={logout} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 12, padding: '5px 12px', letterSpacing: '-0.01em', transition: 'color 0.15s, border-color 0.15s' }}>Sign out</button>
      </header>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '28px 20px 100px' }}>

        {/* hero row */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, animation: 'fadeUp 0.35s ease both' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.94)' }}>Projects</h1>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.28)', letterSpacing: '-0.01em' }}>{projects.length} total · {installedCount} installed</p>
          </div>
          <button
            className="new-btn"
            onClick={() => router.push('/projects/new')}
            style={{
              background: 'linear-gradient(135deg, #F4884A, #e07030)',
              border: 'none', borderRadius: 10,
              color: '#fff', fontWeight: 600, fontSize: 13,
              padding: '9px 18px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 7,
              letterSpacing: '-0.02em',
              boxShadow: '0 2px 12px rgba(244,136,74,0.28), 0 1px 0 rgba(255,255,255,0.12) inset',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            New project
          </button>
        </div>

        {/* stats strip */}
        {!loading && projects.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 24, animation: 'fadeUp 0.38s ease both' }}>
            {[
              { label: 'Draft',     count: draftCount,     color: '#6b7280' },
              { label: 'Quoted',    count: quotedCount,    color: '#3b82f6' },
              { label: 'Approved',  count: approvedCount,  color: '#22c55e' },
              { label: 'Installed', count: installedCount, color: '#a78bfa' },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.055)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.count > 0 ? s.color : 'rgba(255,255,255,0.15)', letterSpacing: '-0.04em' }}>{s.count}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginTop: 2, letterSpacing: '0.03em', textTransform: 'uppercase' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* loading */}
        {loading && (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ width: 28, height: 28, border: '2px solid rgba(244,136,74,0.3)', borderTopColor: '#F4884A', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Loading…</p>
          </div>
        )}

        {/* empty */}
        {!loading && projects.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 80, animation: 'fadeUp 0.4s ease both' }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(244,136,74,0.08)', border: '1px solid rgba(244,136,74,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(244,136,74,0.6)" strokeWidth="1.5"><path d="M12 3l9 18H3z"/><circle cx="12" cy="20" r="1" fill="rgba(244,136,74,0.6)" stroke="none"/></svg>
            </div>
            <p style={{ fontWeight: 600, color: 'rgba(255,255,255,0.7)', fontSize: 15, margin: '0 0 6px', letterSpacing: '-0.02em' }}>No projects yet</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.28)', margin: 0 }}>Tap New project above to get started</p>
          </div>
        )}

        {/* cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {projects.map((p, i) => {
            const fixtureCount = (p.markers || []).filter(m => m.type !== 'power').length
            const wireCount    = (p.wires || []).length
            const isHovered    = hoveredId === p.id

            return (
              <div
                key={p.id}
                className="dash-card"
                onClick={() => router.push(`/projects/${p.id}/map`)}
                onMouseEnter={() => setHoveredId(p.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  background: isHovered
                    ? 'linear-gradient(135deg, rgba(20,18,15,0.98) 0%, rgba(16,14,11,0.98) 100%)'
                    : 'rgba(255,255,255,0.027)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 14, padding: '16px 18px',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 14,
                  boxShadow: '0 2px 16px rgba(0,0,0,0.35)',
                  animationDelay: `${i * 0.05}s`,
                  position: 'relative', overflow: 'hidden',
                }}
              >
                {/* left accent bar */}
                <div style={{ position: 'absolute', left: 0, top: 12, bottom: 12, width: 2.5, borderRadius: 2, background: STATUS_COLOR[p.status] || '#6b7280', opacity: 0.7 }} />

                {/* fixture icon */}
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(244,136,74,0.08)', border: '1px solid rgba(244,136,74,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 6 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(244,136,74,0.7)" strokeWidth="1.6"><path d="M12 3l9 18H3z"/></svg>
                </div>

                {/* info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="card-name" style={{ fontWeight: 600, fontSize: 15, letterSpacing: '-0.025em', color: 'rgba(255,255,255,0.88)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'color 0.2s' }}>{p.homeowner || p.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.32)', fontSize: 12, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.01em' }}>{p.address}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <span style={{ background: STATUS_COLOR[p.status] + '18', color: STATUS_COLOR[p.status], borderRadius: 5, fontSize: 10, fontWeight: 600, padding: '2px 7px', letterSpacing: '0.03em', textTransform: 'uppercase' }}>{STATUS_LABEL[p.status] || 'Draft'}</span>
                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>{fixtureCount} fixture{fixtureCount !== 1 ? 's' : ''}{wireCount > 0 ? ` · ${wireCount} wire${wireCount !== 1 ? 's' : ''}` : ''}</span>
                    <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11, marginLeft: 'auto' }}>{fmt(p.created_at)}</span>
                  </div>
                </div>

                {/* right side */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {confirmDelete === p.id ? (
                    <>
                      <button onClick={e => { e.stopPropagation(); deleteProject(p.id) }} style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 7, color: '#ef4444', fontSize: 11, fontWeight: 600, padding: '4px 10px', cursor: 'pointer' }}>Delete</button>
                      <button onClick={e => { e.stopPropagation(); setConfirmDelete(null) }} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: 'rgba(255,255,255,0.3)', fontSize: 11, padding: '4px 8px', cursor: 'pointer' }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={e => { e.stopPropagation(); setConfirmDelete(p.id) }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.15)', fontSize: 15, cursor: 'pointer', padding: '4px', lineHeight: 1, transition: 'color 0.15s' }}>🗑</button>
                      <div className="card-arrow" style={{ color: 'rgba(255,255,255,0.25)', fontSize: 18, lineHeight: 1, opacity: 0.5 }}>›</div>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

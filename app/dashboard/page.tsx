'use client'
import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Project } from '@/lib/supabase'

const STATUS_LABEL: Record<string, string> = { draft: 'Draft', quoted: 'Quoted', approved: 'Approved', installed: 'Installed' }
const STATUS_COLOR: Record<string, string> = { draft: '#6b7280', quoted: '#F4884A', approved: '#22c55e', installed: '#a78bfa' }

function UpscapeMark({ size = 36 }: { size?: number }) {
  return <img src="/upscape-logo-mark.png" alt="Upscape" width={size} height={size} style={{ objectFit: 'contain', display: 'block' }} />
}

type Section = 'projects' | 'products' | 'settings'

const NAV = [
  {
    id: 'projects' as Section,
    label: 'Projects',
    icon: (active: boolean) => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.8 : 1.5}>
        <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    ),
  },
  {
    id: 'products' as Section,
    label: 'Products',
    icon: (active: boolean) => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.8 : 1.5}>
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
      </svg>
    ),
  },
  {
    id: 'settings' as Section,
    label: 'Settings',
    icon: (active: boolean) => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.8 : 1.5}>
        <path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
      </svg>
    ),
  },
]

export default function DashboardPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [section, setSection] = useState<Section>('projects')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const [lightMode, setLightMode] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('upscape_theme') === 'light' : false)

  function toggleTheme() {
    setLightMode(v => {
      const next = !v
      localStorage.setItem('upscape_theme', next ? 'light' : 'dark')
      return next
    })
  }

  const L = lightMode

  useEffect(() => {
    fetchProjects()
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email || ''))
  }, [])

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
  const initials = userEmail ? userEmail[0].toUpperCase() : 'U'
  const draftCount     = projects.filter(p => p.status === 'draft').length
  const quotedCount    = projects.filter(p => p.status === 'quoted').length
  const approvedCount  = projects.filter(p => p.status === 'approved').length
  const installedCount = projects.filter(p => p.status === 'installed').length

  return (
    <div className={L ? 'upscape-light' : 'upscape-dark'} style={{ display: 'flex', height: '100dvh', background: L ? '#f0ede7' : 'linear-gradient(145deg,#060504 0%,#0a0906 60%,#080604 100%)', overflow: 'hidden', transition: 'background .3s' }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        @keyframes ambientPulse { 0%,100%{opacity:.16} 50%{opacity:.26} }
        .nav-item { transition: background .18s ease, color .18s ease, box-shadow .18s ease; }
        .nav-item:hover { background: rgba(255,255,255,0.05) !important; }
        .dash-card { transition: transform .2s cubic-bezier(.22,1,.36,1), box-shadow .2s ease, border-color .2s ease; animation: fadeUp .35s ease both; }
        .dash-card:hover { transform: translateY(-1px); box-shadow: 0 6px 32px rgba(0,0,0,.55), 0 0 0 1px rgba(244,136,74,.16), 0 0 20px rgba(244,136,74,.05) !important; border-color: rgba(244,136,74,.2) !important; }
        .dash-card:hover .card-arrow { transform: translateX(3px); opacity: .9 !important; }
        .dash-card:hover .card-name  { color: rgba(255,255,255,.98) !important; }
        .card-arrow { transition: transform .18s ease, opacity .18s ease; }
        .new-btn { transition: box-shadow .2s ease, transform .18s ease; }
        .new-btn:hover { transform: translateY(-1px); box-shadow: 0 0 20px rgba(244,136,74,.35), 0 4px 14px rgba(0,0,0,.4) !important; }
        .sidebar-logo:hover { opacity: 1 !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.08); border-radius: 2px; }
        /* ── LIGHT MODE OVERRIDES ── */
        .upscape-light .nav-item:hover { background: rgba(0,0,0,0.06) !important; }
        .upscape-light .dash-card { background: rgba(255,255,255,0.85) !important; border-color: rgba(0,0,0,0.09) !important; }
        .upscape-light .dash-card:hover { box-shadow: 0 6px 24px rgba(0,0,0,.12), 0 0 0 1px rgba(244,136,74,.25) !important; border-color: rgba(244,136,74,.3) !important; }
        .upscape-light .dash-card:hover .card-name { color: rgba(0,0,0,.9) !important; }
        .upscape-light .card-name { color: rgba(0,0,0,.8) !important; }
      `}</style>

      {/* ambient glows */}
      <div style={{ position:'fixed',top:-80,left:60,width:340,height:200,borderRadius:'50%',background:'radial-gradient(ellipse,rgba(244,136,74,.07) 0%,transparent 70%)',pointerEvents:'none',animation:'ambientPulse 7s ease-in-out infinite' }} />
      <div style={{ position:'fixed',bottom:0,left:180,width:300,height:300,borderRadius:'50%',background:'radial-gradient(ellipse,rgba(244,136,74,.035) 0%,transparent 70%)',pointerEvents:'none' }} />

      {/* ── SIDEBAR ── */}
      <aside style={{
        width: 220, flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        background: L ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.022)',
        backdropFilter: 'blur(24px)',
        borderRight: L ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.055)',
        boxShadow: L ? '1px 0 0 rgba(0,0,0,0.04), 4px 0 16px rgba(0,0,0,.08)' : '1px 0 0 rgba(244,136,74,0.04), 4px 0 24px rgba(0,0,0,.25)',
        transition: 'background .3s, border-color .3s',
      }}>
        {/* logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: L ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.04)' }}>
          <img src="/upscape-logo.svg" alt="Upscape" className="sidebar-logo" style={{ height: 20, filter: L ? 'none' : 'invert(1)', opacity: .82, transition: 'opacity .2s, filter .3s' }} />
          <p style={{ margin: '5px 0 0', fontSize: 10, color: L ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.2)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Field Designer</p>
        </div>

        {/* nav */}
        <nav style={{ flex: 1, padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {NAV.map(item => {
            const active = section === item.id
            return (
              <button
                key={item.id}
                className="nav-item"
                onClick={() => setSection(item.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 9, border: 'none',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                  background: active ? 'rgba(244,136,74,0.1)' : 'transparent',
                  color: active ? (L ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.92)') : (L ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.38)'),
                  fontSize: 13, fontWeight: active ? 500 : 400,
                  letterSpacing: '-0.01em',
                  boxShadow: active ? '0 0 0 1px rgba(244,136,74,0.18) inset, 0 0 12px rgba(244,136,74,0.06)' : 'none',
                  position: 'relative',
                }}
              >
                {active && <div style={{ position:'absolute',left:0,top:'50%',transform:'translateY(-50%)',width:2.5,height:20,borderRadius:2,background:'rgba(244,136,74,0.8)',boxShadow:'0 0 8px rgba(244,136,74,0.5)' }} />}
                <span style={{ color: active ? 'rgba(244,136,74,0.9)' : 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{item.icon(active)}</span>
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* profile at bottom */}
        <div style={{ padding: '12px 10px 16px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 9, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#F4884A,#c0520a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0, boxShadow: '0 0 8px rgba(244,136,74,0.3)' }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.7)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail || 'Designer'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 4px #22c55e' }} />
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>Online</span>
              </div>
            </div>
            <button onClick={logout} title="Sign out" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', padding: 2, fontSize: 14, lineHeight: 1, flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN AREA ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* topbar */}
        <header style={{
          height: 54, flexShrink: 0,
          display: 'flex', alignItems: 'center',
          padding: '0 24px', gap: 14,
          background: L ? 'rgba(255,255,255,0.8)' : 'rgba(8,7,6,0.6)', backdropFilter: 'blur(20px)',
          borderBottom: L ? '1px solid rgba(0,0,0,0.07)' : '1px solid rgba(255,255,255,0.05)',
          boxShadow: '0 1px 0 rgba(244,136,74,0.04)',
          transition: 'background .3s',
        }}>
          {/* breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: L ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.22)', letterSpacing: '-0.01em' }}>Upscape</span>
            <span style={{ color: L ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.14)', fontSize: 12 }}>›</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: L ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)', letterSpacing: '-0.02em' }}>{NAV.find(n => n.id === section)?.label}</span>
          </div>

          <div style={{ flex: 1 }} />

          {/* notification bell */}
          <button style={{ width: 32, height: 32, borderRadius: 8, background: L ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)', border: L ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: L ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.35)', flexShrink: 0, transition: 'background .15s' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>
          </button>

          {/* avatar dropdown */}
          <AvatarMenu initials={initials} userEmail={userEmail} logout={logout} lightMode={L} />
        </header>

        {/* content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '28px 28px 60px' }}>
          {section === 'projects' && <ProjectsSection projects={projects} loading={loading} confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete} hoveredId={hoveredId} setHoveredId={setHoveredId} deleteProject={deleteProject} router={router} fmt={fmt} installedCount={installedCount} />}
          {section === 'products' && <ProductsSection />}
          {section === 'settings' && <SettingsSection userEmail={userEmail} logout={logout} lightMode={L} toggleTheme={toggleTheme} />}
        </main>
      </div>
    </div>
  )
}

// ── AVATAR MENU ───────────────────────────────────────
function AvatarMenu({ initials, userEmail, logout, lightMode }: { initials: string; userEmail: string; logout: () => void; lightMode?: boolean }) {
  const [open, setOpen] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px 5px 5px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#F4884A,#c0520a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', boxShadow: '0 0 6px rgba(244,136,74,0.25)' }}>{initials}</div>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', letterSpacing: '-0.01em', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Designer</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="M6 9l6 6 6-6"/></svg>
      </div>

      {open && (
        <>
          {/* panel */}
          <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 100, width: 240, background: lightMode ? '#ffffff' : '#0d0d0d', border: lightMode ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.09)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,.5)' }}>
            {/* header */}
            <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#F4884A,#c0520a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)', letterSpacing: '-0.02em' }}>UI Designer</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                  Online
                </div>
              </div>
              <button onClick={() => { logout(); setOpen(false) }} title="Sign out" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', padding: 4, borderRadius: 6, flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
              </button>
            </div>

            {/* account fields */}
            <div style={{ padding: '10px 16px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 2 }}>Account</div>

              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginBottom: 2 }}>Email</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail || '—'}</div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginBottom: 2 }}>Password</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', letterSpacing: showPass ? 'normal' : '0.1em' }}>{showPass ? '(stored securely)' : '••••••••'}</div>
                </div>
                <button onClick={() => setShowPass(v => !v)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
                  {showPass
                    ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>
                    : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                </button>
              </div>

              <button onClick={() => { logout(); setOpen(false) }}
                style={{ marginTop: 4, width: '100%', background: 'transparent', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: 'rgba(239,68,68,0.6)', fontSize: 12, fontWeight: 500, padding: '9px', cursor: 'pointer' }}>
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── PROJECTS ──────────────────────────────────────────
function ProjectsSection({ projects, loading, confirmDelete, setConfirmDelete, hoveredId, setHoveredId, deleteProject, router, fmt, installedCount }: any) {
  return (
    <div style={{ maxWidth: 640, animation: 'fadeUp .3s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.92)' }}>Projects</h1>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>{projects.length} total · {installedCount} installed</p>
        </div>
        <button className="new-btn" onClick={() => router.push('/projects/new')} style={{ background: 'linear-gradient(135deg,#F4884A,#df6f28)', border: 'none', borderRadius: 9, color: '#fff', fontWeight: 600, fontSize: 12, padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '-0.02em', boxShadow: '0 2px 10px rgba(244,136,74,0.25), 0 1px 0 rgba(255,255,255,0.1) inset', flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
          New project
        </button>
      </div>


      {loading && <div style={{ textAlign:'center',paddingTop:50 }}><div style={{ width:24,height:24,border:'2px solid rgba(244,136,74,0.25)',borderTopColor:'#F4884A',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto 10px' }} /><p style={{ color:'rgba(255,255,255,0.2)',fontSize:12 }}>Loading…</p></div>}

      {!loading && projects.length === 0 && (
        <div style={{ textAlign:'center',paddingTop:70,animation:'fadeUp .4s ease both' }}>
          <div style={{ width:56,height:56,borderRadius:14,background:'rgba(244,136,74,0.07)',border:'1px solid rgba(244,136,74,0.12)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px' }}>
            <UpscapeMark size={32} />
          </div>
          <p style={{ fontWeight:600,color:'rgba(255,255,255,0.65)',fontSize:14,margin:'0 0 5px',letterSpacing:'-0.02em' }}>No projects yet</p>
          <p style={{ fontSize:12,color:'rgba(255,255,255,0.25)',margin:0 }}>Click New project to get started</p>
        </div>
      )}

      <div style={{ display:'flex',flexDirection:'column',gap:7 }}>
        {projects.map((p: Project, i: number) => {
          const fixtureCount = (p.markers||[]).filter((m:any) => m.type!=='power').length
          const wireCount    = (p.wires||[]).length
          const zoneCount    = (p.zones||[]).length
          const isHovered    = hoveredId === p.id
          return (
            <div key={p.id} className="dash-card" onClick={() => router.push(`/projects/${p.id}/map`)} onMouseEnter={() => setHoveredId(p.id)} onMouseLeave={() => setHoveredId(null)}
              style={{ background:isHovered?'rgba(22,19,14,0.98)':'rgba(255,255,255,0.025)',border:'1px solid rgba(255,255,255,0.065)',borderRadius:13,padding:'14px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:13,boxShadow:'0 2px 14px rgba(0,0,0,.3)',animationDelay:`${i*.04}s`,position:'relative',overflow:'hidden' }}>
              <div style={{ position:'absolute',left:0,top:10,bottom:10,width:2.5,borderRadius:2,background:STATUS_COLOR[p.status]||'#6b7280',opacity:.65 }} />
              <div style={{ width:38,height:38,borderRadius:9,background:'rgba(244,136,74,0.06)',border:'1px solid rgba(244,136,74,0.09)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginLeft:7 }}>
                <UpscapeMark size={22} />
              </div>
              <div style={{ flex:1,minWidth:0 }}>
                <div className="card-name" style={{ fontWeight:600,fontSize:14,letterSpacing:'-0.025em',color:'rgba(255,255,255,0.86)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',transition:'color .18s' }}>{p.homeowner||p.name}</div>
                <div style={{ color:'rgba(255,255,255,0.28)',fontSize:12,marginTop:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',letterSpacing:'-0.01em' }}>{p.address}</div>
                <div style={{ display:'flex',alignItems:'center',gap:7,marginTop:5 }}>
                  <span style={{ background:STATUS_COLOR[p.status]+'16',color:STATUS_COLOR[p.status],borderRadius:5,fontSize:10,fontWeight:600,padding:'2px 6px',letterSpacing:'0.03em',textTransform:'uppercase' }}>{STATUS_LABEL[p.status]||'Draft'}</span>
                  <span style={{ color:'rgba(255,255,255,0.18)',fontSize:11 }}>{fixtureCount} fixture{fixtureCount!==1?'s':''}{wireCount>0?` · ${wireCount}w`:''}{zoneCount>0?` · ${zoneCount}z`:''}</span>
                  <span style={{ color:'rgba(255,255,255,0.13)',fontSize:11,marginLeft:'auto' }}>{fmt(p.created_at)}</span>
                </div>
              </div>
              <div style={{ display:'flex',alignItems:'center',gap:7,flexShrink:0 }}>
                {confirmDelete===p.id ? (
                  <>
                    <button onClick={e=>{e.stopPropagation();deleteProject(p.id)}} style={{ background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.28)',borderRadius:7,color:'#ef4444',fontSize:11,fontWeight:600,padding:'3px 9px',cursor:'pointer' }}>Delete</button>
                    <button onClick={e=>{e.stopPropagation();setConfirmDelete(null)}} style={{ background:'none',border:'1px solid rgba(255,255,255,0.08)',borderRadius:7,color:'rgba(255,255,255,0.28)',fontSize:11,padding:'3px 8px',cursor:'pointer' }}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button onClick={e=>{e.stopPropagation();setConfirmDelete(p.id)}} style={{ background:'rgba(255,255,255,0.07)',border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',padding:0,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M10 11v5M14 11v5" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                    </button>
                    <span className="card-arrow" style={{ color:'rgba(255,255,255,0.22)',fontSize:17,lineHeight:1,opacity:.45 }}>›</span>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── QUOTES ────────────────────────────────────────────
function QuotesSection({ projects, router, fmt }: any) {
  const quoted = projects.filter((p: Project) => ['quoted','approved'].includes(p.status))
  return (
    <div style={{ maxWidth: 640, animation: 'fadeUp .3s ease both' }}>
      <h1 style={{ margin:'0 0 6px',fontSize:22,fontWeight:700,letterSpacing:'-0.03em',color:'rgba(255,255,255,0.92)' }}>Quotes</h1>
      <p style={{ margin:'0 0 22px',fontSize:12,color:'rgba(255,255,255,0.25)' }}>Proposals, approvals, and pricing</p>
      {quoted.length === 0 ? (
        <Placeholder icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(244,136,74,0.5)" strokeWidth="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>} label="No quotes yet" sub="Projects you quote will appear here" />
      ) : (
        <div style={{ display:'flex',flexDirection:'column',gap:7 }}>
          {quoted.map((p: Project) => (
            <div key={p.id} onClick={() => router.push(`/projects/${p.id}/quote`)} style={{ background:'rgba(255,255,255,0.025)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:12,padding:'14px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:12,transition:'border-color .18s' }}>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontWeight:600,fontSize:14,color:'rgba(255,255,255,0.86)',letterSpacing:'-0.02em' }}>{p.homeowner||p.name}</div>
                <div style={{ fontSize:12,color:'rgba(255,255,255,0.28)',marginTop:2 }}>{p.address}</div>
              </div>
              <div style={{ display:'flex',alignItems:'center',gap:8,flexShrink:0 }}>
                <span style={{ background:STATUS_COLOR[p.status]+'18',color:STATUS_COLOR[p.status],fontSize:10,fontWeight:600,padding:'2px 7px',borderRadius:5,textTransform:'uppercase',letterSpacing:'0.03em' }}>{STATUS_LABEL[p.status]}</span>
                <span style={{ color:'rgba(255,255,255,0.18)',fontSize:12 }}>›</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── PRODUCTS ──────────────────────────────────────────
function ProductsSection() {
  const products = [
    { label: 'Uplight',      color: '#F4884A', img: 'https://www.amplighting.com/media/catalog/product/c/b/cb59530c-88f8-4893-8792-01f33d6aad55_cb59530c-88f8-4893-8792-01f33d6aad55.jpg',  brand: 'AMP Premium' },
    { label: 'Path Light',   color: '#F5C842', img: 'https://www.amplighting.com/media/catalog/product/a/h/aht-3309-bbz_002_jpg_1_3.jpg',                                               brand: 'AMP Premium' },
    { label: 'Flood Light',  color: '#EF4444', img: 'https://www.amplighting.com/media/catalog/product/e/c/ecopro-bbz_0006_pit_7733.png',                                               brand: 'AMP Premium' },
    { label: 'Well Light',   color: '#3B82F6', img: 'https://www.amplighting.com/media/catalog/product/d/9/d9caee05-0d88-4b77-8c2a-e2dfaa9c5e7b_d9caee05-0d88-4b77-8c2a-e2dfaa9c5e7b.jpg', brand: 'AMP Premium' },
    { label: 'Downlight',    color: '#8B5CF6', img: 'https://www.amplighting.com/media/catalog/product/a/f/afl-4010-b-bz_005_1.jpg',                                                    brand: 'AMP Premium' },
    { label: 'Step Light',   color: '#F97316', img: 'https://www.amplighting.com/media/catalog/product/v/a/val-1813-40-bbz_003_jpg_-_copy_2.jpg',                                       brand: 'AMP Premium' },
    { label: 'Transformer',  color: '#9CA3AF', img: 'https://www.amplighting.com/media/catalog/product/3/d/3d6e43e5-ad71-4fe6-ad90-65677e67f1fe_3d6e43e5-ad71-4fe6-ad90-65677e67f1fe.jpg', brand: 'AMP Premium' },
  ]

  return (
    <div style={{ maxWidth: 680, animation: 'fadeUp .3s ease both' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.92)' }}>Products</h1>
      <p style={{ margin: '0 0 22px', fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>Fixture catalog · AMP Lighting · Sunvie</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {products.map(p => (
          <div key={p.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', transition: 'border-color .18s, box-shadow .18s' }}>
            <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', position: 'relative' }}>
              <img
                src={p.img}
                alt={p.label}
                style={{ width: '85%', height: '85%', objectFit: 'contain' }}
                onError={e => { (e.target as HTMLImageElement).style.opacity = '0' }}
              />
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 24, background: 'linear-gradient(to top, rgba(15,15,15,0.25), transparent)' }} />
            </div>
            <div style={{ padding: '10px 12px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.82)', letterSpacing: '-0.02em' }}>{p.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>{p.brand}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── INSTALL ───────────────────────────────────────────
function InstallSection({ projects }: any) {
  const active = projects.filter((p: Project) => ['approved','draft'].includes(p.status))
  const tools = [
    { label:'Fixture Checklist',    icon:'☑', desc:'Track placement per zone' },
    { label:'Wire Run Calculator',  icon:'〰', desc:'Measure and plan cable runs' },
    { label:'Voltage Drop',         icon:'⚡', desc:'Load per zone, drop estimates' },
    { label:'Transformer Load',     icon:'◫', desc:'Wattage per transformer' },
    { label:'Zone Organization',    icon:'⬡', desc:'Group fixtures by area' },
    { label:'Nighttime Aiming',     icon:'◎', desc:'Beam focus and aim notes' },
    { label:'Technician Notes',     icon:'✎', desc:'Per-project install notes' },
    { label:'Install Report',       icon:'▤', desc:'Completed installation PDF' },
  ]
  return (
    <div style={{ maxWidth: 640, animation:'fadeUp .3s ease both' }}>
      <h1 style={{ margin:'0 0 6px',fontSize:22,fontWeight:700,letterSpacing:'-0.03em',color:'rgba(255,255,255,0.92)' }}>Install</h1>
      <p style={{ margin:'0 0 22px',fontSize:12,color:'rgba(255,255,255,0.25)' }}>Field tools for installation day</p>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,marginBottom:20 }}>
        {tools.map(t => (
          <div key={t.label} style={{ background:'rgba(255,255,255,0.025)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:12,padding:'14px 16px',cursor:'pointer',transition:'border-color .18s' }}>
            <div style={{ fontSize:20,marginBottom:8,opacity:.6 }}>{t.icon}</div>
            <div style={{ fontSize:13,fontWeight:500,color:'rgba(255,255,255,0.72)',letterSpacing:'-0.02em',marginBottom:3 }}>{t.label}</div>
            <div style={{ fontSize:11,color:'rgba(255,255,255,0.22)' }}>{t.desc}</div>
          </div>
        ))}
      </div>
      <div style={{ padding:'14px 18px',background:'rgba(244,136,74,0.05)',border:'1px solid rgba(244,136,74,0.1)',borderRadius:12 }}>
        <p style={{ margin:0,fontSize:12,color:'rgba(255,255,255,0.35)' }}>Install workflow tools are coming soon. {active.length > 0 ? `${active.length} project${active.length!==1?'s':''} ready for install.` : ''}</p>
      </div>
    </div>
  )
}

// ── SETTINGS ──────────────────────────────────────────
const ACCENT_OPTIONS = ['#F4884A','#3b82f6','#22c55e','#a855f7','#ec4899','#14b8a6']

function Toggle({ on, onToggle, color = '#F4884A' }: { on: boolean; onToggle: () => void; color?: string }) {
  return (
    <div onClick={onToggle} style={{ width:40,height:22,borderRadius:11,background:on?color:'rgba(255,255,255,0.1)',cursor:'pointer',position:'relative',transition:'background .2s',flexShrink:0 }}>
      <div style={{ position:'absolute',top:3,left:on?20:3,width:16,height:16,borderRadius:'50%',background:'#fff',transition:'left .2s',boxShadow:'0 1px 4px rgba(0,0,0,.3)' }} />
    </div>
  )
}

const MAP_STYLE_OPTIONS = [
  { id: 'satellite', label: 'Satellite', desc: 'Aerial night view' },
  { id: 'terrain',   label: 'Terrain',   desc: 'Topographic map' },
]

function SettingsSection({ userEmail, logout, lightMode, toggleTheme }: any) {
  const [accentColor, setAccentColor]   = useState(() => typeof window !== 'undefined' ? (localStorage.getItem('upscape_accent') || '#F4884A') : '#F4884A')
  const [mapStyle, setMapStyle]         = useState(() => typeof window !== 'undefined' ? (localStorage.getItem('upscape_map_style') || 'satellite') : 'satellite')
  const [daytime, setDaytime]           = useState(() => typeof window !== 'undefined' ? localStorage.getItem('upscape_map_day') === '1' : false)
  const [quoteAlerts, setQuoteAlerts]   = useState(true)
  const [projectUpdates, setProjectUpdates] = useState(true)
  const [gmailCount] = useState(0)

  function pickAccent(c: string) {
    setAccentColor(c)
    localStorage.setItem('upscape_accent', c)
  }
  function pickMapStyle(id: string) {
    setMapStyle(id)
    localStorage.setItem('upscape_map_style', id)
  }
  function toggleDay() {
    const next = !daytime
    setDaytime(next)
    localStorage.setItem('upscape_map_day', next ? '1' : '0')
  }

  const row = (label: string, right: React.ReactNode, sub?: string) => (
    <div style={{ padding:'13px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
      <div>
        <div style={{ fontSize:13, color:'rgba(255,255,255,0.72)', letterSpacing:'-0.01em' }}>{label}</div>
        {sub && <div style={{ fontSize:11, color:'rgba(255,255,255,0.25)', marginTop:2 }}>{sub}</div>}
      </div>
      {right}
    </div>
  )

  const card = (label: string, children: React.ReactNode) => (
    <div style={{ background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, overflow:'hidden' }}>
      <div style={{ padding:'9px 16px', fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.25)', letterSpacing:'0.08em', textTransform:'uppercase', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>{label}</div>
      {children}
    </div>
  )

  return (
    <div style={{ maxWidth:480, animation:'fadeUp .3s ease both' }}>
      <h1 style={{ margin:'0 0 6px', fontSize:22, fontWeight:700, letterSpacing:'-0.03em', color:'rgba(255,255,255,0.92)' }}>Settings</h1>
      <p style={{ margin:'0 0 22px', fontSize:12, color:'rgba(255,255,255,0.25)' }}>{userEmail}</p>

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

        {/* Map */}
        {card('Map', <>
          {/* style picker */}
          <div style={{ padding:'13px 16px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.72)', marginBottom:10 }}>Style</div>
            <div style={{ display:'flex', gap:8 }}>
              {MAP_STYLE_OPTIONS.map(opt => (
                <div key={opt.id} onClick={() => pickMapStyle(opt.id)}
                  style={{ flex:1, border:`1.5px solid ${mapStyle===opt.id ? accentColor : 'rgba(255,255,255,0.08)'}`, borderRadius:10, padding:'10px 12px', cursor:'pointer', background: mapStyle===opt.id ? `${accentColor}10` : 'rgba(255,255,255,0.02)', transition:'all .15s' }}>
                  <div style={{ fontSize:13, fontWeight:600, color: mapStyle===opt.id ? accentColor : 'rgba(255,255,255,0.6)' }}>{opt.label}</div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.25)', marginTop:2 }}>{opt.desc}</div>
                </div>
              ))}
            </div>
          </div>
          {row('Daytime color', <Toggle on={daytime} onToggle={toggleDay} color={accentColor} />, daytime ? 'Light satellite view' : 'Dark night view')}
        </>)}

        {/* Appearance */}
        {card('Appearance', <>
          {row('Appearance', (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)' }}>{lightMode ? 'Light' : 'Dark'}</span>
              <Toggle on={lightMode} onToggle={toggleTheme} color={accentColor} />
            </div>
          ), 'System appearance')}
          {row('Tool icon color', (
            <div style={{ display:'flex', gap:6 }}>
              {ACCENT_OPTIONS.map(c => (
                <div key={c} onClick={() => pickAccent(c)}
                  style={{ width:22, height:22, borderRadius:'50%', background:c, cursor:'pointer', outline: accentColor===c ? `2px solid ${c}` : 'none', outlineOffset:2.5, opacity: accentColor===c ? 1 : 0.45, transition:'opacity .15s,outline .15s' }} />
              ))}
            </div>
          ), 'Color of map tool icons')}
        </>)}

        {/* Notifications */}
        {card('Notifications', <>
          {row('Gmail', (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {gmailCount > 0
                ? <div style={{ background:'#ea4335', borderRadius:10, fontSize:11, fontWeight:700, color:'#fff', padding:'2px 7px' }}>{gmailCount > 99 ? '99+' : gmailCount}</div>
                : <span style={{ fontSize:11, color:'rgba(255,255,255,0.2)' }}>No new</span>}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="16" rx="2" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5"/><path d="M2 7l10 7 10-7" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5"/></svg>
            </div>
          ), 'Upscape-related emails')}
          {row('Quote alerts', <Toggle on={quoteAlerts} onToggle={() => setQuoteAlerts(v => !v)} color={accentColor} />, 'Notify when quote is opened')}
          {row('Project updates', <Toggle on={projectUpdates} onToggle={() => setProjectUpdates(v => !v)} color={accentColor} />, 'Status change reminders')}
        </>)}

      </div>

      <button onClick={logout} style={{ marginTop:16, width:'100%', background:'transparent', border:'1px solid rgba(239,68,68,0.2)', borderRadius:10, color:'rgba(239,68,68,0.6)', fontSize:13, fontWeight:500, padding:'11px', cursor:'pointer', letterSpacing:'-0.01em' }}>Sign out</button>
    </div>
  )
}

// ── PLACEHOLDER ───────────────────────────────────────
function Placeholder({ icon, label, sub }: { icon: React.ReactNode; label: string; sub: string }) {
  return (
    <div style={{ textAlign:'center',paddingTop:60 }}>
      <div style={{ width:52,height:52,borderRadius:13,background:'rgba(244,136,74,0.07)',border:'1px solid rgba(244,136,74,0.11)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px' }}>{icon}</div>
      <p style={{ fontWeight:600,color:'rgba(255,255,255,0.6)',fontSize:14,margin:'0 0 5px',letterSpacing:'-0.02em' }}>{label}</p>
      <p style={{ fontSize:12,color:'rgba(255,255,255,0.22)',margin:0 }}>{sub}</p>
    </div>
  )
}

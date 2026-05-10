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

  const [ambientGlow, setAmbientGlow] = useState(() => typeof window !== 'undefined' ? +(localStorage.getItem('upscape_glow') || 70) : 70)
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
    <div className={L ? 'upscape-light' : 'upscape-dark'} style={{ display: 'flex', height: '100dvh', background: L ? '#ede9e3' : 'linear-gradient(145deg,#060504 0%,#0a0906 60%,#080604 100%)', overflow: 'hidden', transition: 'background .3s' }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        @keyframes ambientPulse { 0%,100%{opacity:.16} 50%{opacity:.26} }
        @keyframes float { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-10px)} }
        @keyframes glowPulse { 0%,100%{opacity:.45;transform:scale(1)} 50%{opacity:.7;transform:scale(1.06)} }
        @keyframes drift1 { 0%{transform:translate(0,0) scale(1);opacity:.7} 50%{transform:translate(-8px,-18px) scale(.7);opacity:.3} 100%{transform:translate(4px,-34px) scale(.4);opacity:0} }
        @keyframes drift2 { 0%{transform:translate(0,0) scale(1);opacity:.6} 50%{transform:translate(12px,-14px) scale(.6);opacity:.25} 100%{transform:translate(-4px,-28px) scale(.3);opacity:0} }
        @keyframes drift3 { 0%{transform:translate(0,0) scale(1);opacity:.5} 50%{transform:translate(-6px,-20px) scale(.5);opacity:.2} 100%{transform:translate(8px,-32px) scale(.2);opacity:0} }
        @keyframes bgDrift { 0%,100%{transform:translate(0,0)} 33%{transform:translate(20px,-10px)} 66%{transform:translate(-12px,14px)} }
        @keyframes emptyFadeIn { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }

        /* ── DARK DEFAULTS ── */
        .nav-item { transition: background .18s ease, color .18s ease; }
        .nav-item:hover { background: rgba(255,255,255,0.05) !important; }
        .dash-card { transition: transform .2s cubic-bezier(.22,1,.36,1), box-shadow .2s ease, border-color .2s ease; animation: fadeUp .35s ease both; }
        .dash-card:hover { transform: translateY(-1px); box-shadow: 0 6px 32px rgba(0,0,0,.55), 0 0 0 1px rgba(244,136,74,.16) !important; border-color: rgba(244,136,74,.2) !important; }
        .dash-card:hover .card-arrow { transform: translateX(3px); opacity: .9 !important; }
        .dash-card:hover .card-name  { color: rgba(255,255,255,.98) !important; }
        .card-arrow { transition: transform .18s ease, opacity .18s ease; }
        .new-btn { transition: box-shadow .2s ease, transform .18s ease; }
        .new-btn:hover { transform: translateY(-1px); box-shadow: 0 0 20px rgba(244,136,74,.35), 0 4px 14px rgba(0,0,0,.4) !important; }
        .sidebar-logo:hover { opacity: 1 !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.08); border-radius: 2px; }

        /* ── LIGHT MODE — premium warm theme ── */

        /* catch-all: any element with a rgba(255,255,255,...) inline color becomes dark */
        .upscape-light * { color: inherit; }
        .upscape-light { color: #2a2420 !important; }

        /* typography */
        .upscape-light h1 { color: #1a1714 !important; }
        .upscape-light h2, .upscape-light h3 { color: #1a1714 !important; }
        .upscape-light p { color: #5c564f !important; }
        .upscape-light span { color: inherit !important; }
        .upscape-light div { color: inherit !important; }

        /* sidebar */
        .upscape-light .nav-item { color: #6b635c !important; font-weight: 400; }
        .upscape-light .nav-item:hover { background: rgba(0,0,0,0.05) !important; color: #2a2420 !important; }

        /* client/project cards */
        .upscape-light .dash-card,
        .upscape-light .client-header {
          background: #ffffff !important;
          border-color: #e0dbd4 !important;
          box-shadow: 0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04) !important;
        }
        .upscape-light .dash-card:hover,
        .upscape-light .client-header:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.1), 0 0 0 1.5px rgba(244,136,74,.4) !important;
          border-color: rgba(244,136,74,.35) !important;
        }
        .upscape-light .dash-card:hover .card-name,
        .upscape-light .client-header:hover .card-name { color: #1a1714 !important; }
        .upscape-light .card-name { color: #231f1c !important; }

        /* settings sections */
        .upscape-light .settings-block {
          background: #ffffff !important;
          border: 1px solid #ddd8d1 !important;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06) !important;
        }
        .upscape-light .settings-row {
          border-bottom-color: #ede9e3 !important;
        }
        .upscape-light .settings-label { color: #231f1c !important; font-weight: 500; }
        .upscape-light .settings-desc  { color: #8a837a !important; }

        /* topbar breadcrumb + misc text */
        .upscape-light header span { color: #5c564f !important; }
        .upscape-light header .breadcrumb-active { color: #1a1714 !important; }

        /* sidebar profile area */
        .upscape-light aside { color: #2a2420 !important; }

        /* products section */
        .upscape-light .product-card { background: #fff !important; border-color: #e0dbd4 !important; }
        .upscape-light .product-card div { color: #2a2420 !important; }

        /* status badges — keep their own color, just fix surrounding text */
        .upscape-light .dash-card > div > div:not(.card-name) { color: #6b635c !important; }

        /* override dark card hover text staying white */
        .upscape-light .dash-card:hover .card-name { color: #1a1714 !important; }

        /* scrollbar */
        .upscape-light ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); }

        /* new project button stays orange */
        .upscape-light .new-btn:hover { box-shadow: 0 0 20px rgba(244,136,74,.4), 0 4px 12px rgba(0,0,0,.15) !important; }
      `}</style>

      {/* ambient glows — scale with ambientGlow (0–100) */}
      <div style={{ position:'fixed',top:-80,left:60,width:340,height:200,borderRadius:'50%',background:`radial-gradient(ellipse,rgba(244,136,74,${(ambientGlow/100)*0.14}) 0%,transparent 70%)`,pointerEvents:'none',animation:'ambientPulse 7s ease-in-out infinite',transition:'opacity .4s' }} />
      <div style={{ position:'fixed',bottom:0,left:180,width:300,height:300,borderRadius:'50%',background:`radial-gradient(ellipse,rgba(244,136,74,${(ambientGlow/100)*0.07}) 0%,transparent 70%)`,pointerEvents:'none',transition:'opacity .4s' }} />

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
        <div style={{ padding: '18px 16px 14px', borderBottom: L ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <img src="/upscape-logo-mark.png" alt="" width={26} height={26} style={{ objectFit: 'contain', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', color: L ? 'rgba(0,0,0,0.82)' : 'rgba(255,255,255,0.88)', lineHeight: 1 }}>UPSCAPE</div>
              <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: L ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.22)', marginTop: 3 }}>Field Designer</div>
            </div>
          </div>
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
          {section === 'settings' && <SettingsSection userEmail={userEmail} logout={logout} lightMode={L} toggleTheme={toggleTheme} ambientGlow={ambientGlow} setAmbientGlow={(v: number) => { setAmbientGlow(v); localStorage.setItem('upscape_glow', String(v)) }} />}
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
          <div style={{ position: 'fixed', top: 62, right: 20, zIndex: 9999, width: 240, background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 16px 56px rgba(0,0,0,.95)', isolation: 'isolate', backdropFilter: 'none', WebkitBackdropFilter: 'none', opacity: 1 }}>
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
function ProjectsSection({ projects, loading, router, installedCount }: any) {
  // Group projects by client
  const clientMap = React.useMemo(() => {
    const map = new Map<string, { name: string; address: string; projects: Project[] }>()
    projects.forEach((p: Project) => {
      const key = (p.homeowner || p.address || p.name || 'Unknown').trim()
      if (!map.has(key)) map.set(key, { name: p.homeowner || p.name || 'Unknown', address: p.address || '', projects: [] })
      map.get(key)!.projects.push(p)
    })
    return map
  }, [projects])

  const clientCount = clientMap.size

  // ── CLIENTS LIST VIEW ─────────────────────────────
  return (
    <div style={{ maxWidth: 640, animation: 'fadeUp .3s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.92)' }}>Clients</h1>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>{clientCount} client{clientCount!==1?'s':''} · {projects.length} project{projects.length!==1?'s':''} · {installedCount} installed</p>
        </div>
        <button className="new-btn" onClick={() => router.push('/projects/new')} style={{ background: 'linear-gradient(135deg,#F4884A,#df6f28)', border: 'none', borderRadius: 9, color: '#fff', fontWeight: 600, fontSize: 12, padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '-0.02em', boxShadow: '0 2px 10px rgba(244,136,74,0.25), 0 1px 0 rgba(255,255,255,0.1) inset', flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
          New client
        </button>
      </div>

      {loading && <div style={{ textAlign:'center',paddingTop:50 }}><div style={{ width:24,height:24,border:'2px solid rgba(244,136,74,0.25)',borderTopColor:'#F4884A',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto 10px' }} /><p style={{ color:'rgba(255,255,255,0.2)',fontSize:12 }}>Loading…</p></div>}

      {!loading && projects.length === 0 && <EmptyState onNew={() => router.push('/projects/new')} />}

      <div style={{ display:'flex',flexDirection:'column',gap:7 }}>
        {Array.from(clientMap.entries()).map(([key, client], ci) => {
          const initials = client.name.split(' ').map((w:string)=>w[0]).slice(0,2).join('').toUpperCase()
          const allStatuses = [...new Set(client.projects.map((p:Project)=>p.status))]
          return (
            <div key={key} className="dash-card" onClick={()=>router.push(`/clients/${encodeURIComponent(key)}`)}
              style={{ background:'rgba(255,255,255,0.025)',border:'1px solid rgba(255,255,255,0.065)',borderRadius:13,padding:'14px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:13,boxShadow:'0 2px 14px rgba(0,0,0,.3)',animation:'fadeUp .3s ease both',animationDelay:`${ci*.05}s`,position:'relative',overflow:'hidden' }}>
              <div style={{ position:'absolute',left:0,top:10,bottom:10,width:2.5,borderRadius:2,background:STATUS_COLOR[client.projects[0].status]||'#6b7280',opacity:.65 }} />
              {/* initials avatar */}
              <div style={{ width:40,height:40,borderRadius:10,background:'linear-gradient(135deg,rgba(244,136,74,0.18),rgba(244,136,74,0.06))',border:'1px solid rgba(244,136,74,0.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:13,fontWeight:700,color:'rgba(244,136,74,0.9)',letterSpacing:'-0.02em',marginLeft:7 }}>{initials}</div>
              <div style={{ flex:1,minWidth:0 }}>
                <div className="card-name" style={{ fontWeight:600,fontSize:14,letterSpacing:'-0.025em',color:'rgba(255,255,255,0.88)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',transition:'color .18s' }}>{client.name}</div>
                <div style={{ color:'rgba(255,255,255,0.3)',fontSize:12,marginTop:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',letterSpacing:'-0.01em' }}>{client.address || 'No address on file'}</div>
              </div>
              <div style={{ display:'flex',alignItems:'center',gap:7,flexShrink:0 }}>
                {allStatuses.slice(0,2).map((s:string)=>(
                  <span key={s} style={{ background:STATUS_COLOR[s]+'16',color:STATUS_COLOR[s],borderRadius:5,fontSize:10,fontWeight:600,padding:'2px 6px',letterSpacing:'0.03em',textTransform:'uppercase' }}>{STATUS_LABEL[s]||s}</span>
                ))}
                <span style={{ fontSize:11,color:'rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.055)',borderRadius:6,padding:'2px 8px',fontWeight:500,flexShrink:0 }}>{client.projects.length} project{client.projects.length!==1?'s':''}</span>
                <span className="card-arrow" style={{ color:'rgba(255,255,255,0.22)',fontSize:17,lineHeight:1,opacity:.45 }}>›</span>
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

// ── EMPTY STATE ───────────────────────────────────────
function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div style={{ position:'fixed', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none', zIndex:0, overflow:'hidden' }}>

      {/* deep atmospheric radial — fills background */}
      <div style={{ position:'absolute', width:900, height:900, borderRadius:'50%', background:'radial-gradient(ellipse at 50% 55%, rgba(244,136,74,0.055) 0%, rgba(12,8,4,0.0) 65%)', top:'50%', left:'50%', transform:'translate(-50%,-50%)', pointerEvents:'none', animation:'bgDrift 20s ease-in-out infinite' }} />

      {/* volumetric floor glow */}
      <div style={{ position:'absolute', width:520, height:120, borderRadius:'50%', background:'radial-gradient(ellipse, rgba(244,136,74,0.18) 0%, transparent 70%)', bottom:'calc(50% - 110px)', left:'50%', transform:'translateX(-50%)', animation:'glowPulse 5s ease-in-out infinite', pointerEvents:'none', filter:'blur(8px)' }} />

      {/* secondary warm halo behind object */}
      <div style={{ position:'absolute', width:280, height:280, borderRadius:'50%', background:'radial-gradient(ellipse, rgba(244,136,74,0.08) 0%, transparent 70%)', top:'50%', left:'50%', transform:'translate(-50%, calc(-50% - 20px))', animation:'glowPulse 6s ease-in-out infinite', animationDelay:'1s', pointerEvents:'none' }} />

      {/* ember particles — varied opacities and sizes */}
      {([
        { x:-62, y: 14, d:'drift1', delay:'0s',   size:2.2, op:0.65 },
        { x: 70, y: 20, d:'drift2', delay:'1.1s', size:1.6, op:0.45 },
        { x:-28, y:-8,  d:'drift3', delay:'0.4s', size:3.0, op:0.7  },
        { x: 44, y: 6,  d:'drift1', delay:'2.0s', size:1.4, op:0.5  },
        { x:-80, y: 30, d:'drift2', delay:'3.2s', size:1.8, op:0.35 },
        { x: 86, y:-4,  d:'drift3', delay:'1.7s', size:2.4, op:0.55 },
        { x:-44, y: 38, d:'drift1', delay:'0.8s', size:1.2, op:0.3  },
        { x: 32, y: 42, d:'drift2', delay:'2.6s', size:2.0, op:0.6  },
        { x:-10, y: 16, d:'drift3', delay:'4.1s', size:1.5, op:0.4  },
        { x: 58, y: 32, d:'drift1', delay:'1.4s', size:1.0, op:0.25 },
      ] as {x:number,y:number,d:string,delay:string,size:number,op:number}[]).map((p,i) => (
        <div key={i} style={{ position:'absolute', top:'calc(50% + 50px)', left:'50%', marginLeft:p.x, marginTop:p.y, width:p.size, height:p.size, borderRadius:'50%', background:`rgba(244,136,74,${p.op})`, boxShadow:`0 0 ${p.size*2}px rgba(244,136,74,${p.op*0.8})`, animation:`${p.d} ${3.2+i*0.38}s ease-in infinite`, animationDelay:p.delay, pointerEvents:'none' }} />
      ))}

      {/* ── MAIN CONTENT ── */}
      <div style={{ position:'relative', display:'flex', flexDirection:'column', alignItems:'center', animation:'emptyFadeIn 1.1s cubic-bezier(.16,1,.3,1) both', pointerEvents:'auto' }}>

        {/* ── ARCHIVE OBJECT ── */}
        <div style={{ width:110, height:110, marginBottom:44, animation:'float 6s ease-in-out infinite', position:'relative' }}>

          {/* outer atmospheric ring */}
          <div style={{ position:'absolute', inset:-18, borderRadius:'50%', background:'radial-gradient(ellipse, rgba(244,136,74,0.06) 0%, transparent 70%)', animation:'glowPulse 4s ease-in-out infinite' }} />

          {/* main glass body */}
          <div style={{ position:'absolute', inset:0, borderRadius:22,
            background:'linear-gradient(145deg, rgba(244,136,74,0.09) 0%, rgba(244,136,74,0.03) 50%, rgba(10,6,2,0.4) 100%)',
            backdropFilter:'blur(20px)',
            border:'1px solid rgba(244,136,74,0.32)',
            boxShadow:`
              0 0 0 1px rgba(244,136,74,0.06) inset,
              0 1px 0 rgba(255,255,255,0.06) inset,
              0 0 40px rgba(244,136,74,0.14),
              0 0 80px rgba(244,136,74,0.06),
              0 28px 60px rgba(0,0,0,0.7)
            `
          }} />

          {/* top edge highlight */}
          <div style={{ position:'absolute', top:0, left:16, right:16, height:1, borderRadius:1, background:'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)' }} />

          {/* inner content — archive/folder geometry */}
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="56" height="50" viewBox="0 0 56 50" fill="none">
              {/* base platform */}
              <rect x="4" y="32" width="48" height="14" rx="3" fill="rgba(244,136,74,0.06)" stroke="rgba(244,136,74,0.5)" strokeWidth="0.8"/>
              {/* mid layer */}
              <rect x="9" y="20" width="38" height="14" rx="3" fill="rgba(244,136,74,0.05)" stroke="rgba(244,136,74,0.38)" strokeWidth="0.8"/>
              {/* top layer */}
              <rect x="14" y="8" width="28" height="14" rx="3" fill="rgba(244,136,74,0.07)" stroke="rgba(244,136,74,0.6)" strokeWidth="0.9"/>
              {/* top tab */}
              <path d="M14 8h8l2-4h8l2 4" stroke="rgba(244,136,74,0.5)" strokeWidth="0.8" fill="none"/>
              {/* scan line on top layer */}
              <line x1="18" y1="14" x2="38" y2="14" stroke="rgba(244,136,74,0.25)" strokeWidth="0.6"/>
              {/* small detail dots */}
              <circle cx="18" cy="12" r="1.2" fill="rgba(244,136,74,0.6)"/>
              <circle cx="38" cy="12" r="1.2" fill="rgba(244,136,74,0.3)"/>
              {/* bottom layer detail */}
              <line x1="10" y1="37" x2="46" y2="37" stroke="rgba(244,136,74,0.18)" strokeWidth="0.6"/>
              <circle cx="10" cy="39" r="1" fill="rgba(244,136,74,0.4)"/>
              <circle cx="46" cy="39" r="1" fill="rgba(244,136,74,0.4)"/>
            </svg>
          </div>

          {/* bottom shadow cast */}
          <div style={{ position:'absolute', bottom:-14, left:'50%', transform:'translateX(-50%)', width:70, height:12, borderRadius:'50%', background:'radial-gradient(ellipse, rgba(244,136,74,0.22) 0%, transparent 70%)', filter:'blur(4px)' }} />
        </div>

        {/* heading */}
        <h2 style={{ margin:'0 0 10px', fontSize:26, fontWeight:700, letterSpacing:'-0.04em', color:'rgba(255,255,255,0.85)', textAlign:'center', lineHeight:1.1 }}>No clients yet</h2>
        <p style={{ margin:'0 0 36px', fontSize:13, color:'rgba(255,255,255,0.25)', textAlign:'center', letterSpacing:'-0.01em', lineHeight:1.65, maxWidth:220 }}>Add your first client to begin designing their lighting system.</p>

        {/* CTA */}
        <button
          onClick={onNew}
          style={{ display:'flex', alignItems:'center', gap:8, padding:'11px 26px', borderRadius:11, background:'linear-gradient(135deg,#F4884A,#d96520)', border:'none', color:'#fff', fontSize:13, fontWeight:600, letterSpacing:'-0.01em', cursor:'pointer', boxShadow:'0 0 28px rgba(244,136,74,0.32), 0 4px 18px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.14) inset', transition:'transform .18s cubic-bezier(.22,1,.36,1), box-shadow .18s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-2px) scale(1.02)'; (e.currentTarget as HTMLElement).style.boxShadow='0 0 48px rgba(244,136,74,0.48), 0 8px 28px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.18) inset' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform='none'; (e.currentTarget as HTMLElement).style.boxShadow='0 0 28px rgba(244,136,74,0.32), 0 4px 18px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.14) inset' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
          New client
        </button>

        {/* grain texture overlay */}
        <svg style={{ position:'fixed', inset:0, width:'100%', height:'100%', pointerEvents:'none', opacity:.018, zIndex:-1 }} xmlns="http://www.w3.org/2000/svg">
          <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
      </div>
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
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div onClick={onToggle} style={{ width:44,height:24,borderRadius:12,background:on?'#F4884A':'rgba(255,255,255,0.12)',cursor:'pointer',position:'relative',transition:'background .2s',flexShrink:0,boxShadow:on?'0 0 12px rgba(244,136,74,0.4)':'none' }}>
      <div style={{ position:'absolute',top:3,left:on?22:3,width:18,height:18,borderRadius:'50%',background:'#fff',transition:'left .18s',boxShadow:'0 1px 5px rgba(0,0,0,.35)' }} />
    </div>
  )
}

function SettingsSection({ userEmail, logout, lightMode, toggleTheme, ambientGlow, setAmbientGlow }: any) {
  const [active, setActive]         = useState('general')
  const [mapStyle, setMapStyle]     = useState(() => typeof window !== 'undefined' ? (localStorage.getItem('upscape_map_style') || 'satellite') : 'satellite')
  const [mapTime, setMapTime]       = useState(() => typeof window !== 'undefined' ? (localStorage.getItem('upscape_map_time') || 'day') : 'day')
  const [animations, setAnimations] = useState(true)
  const [quoteAlerts, setQuoteAlerts]     = useState(true)
  const [projectUpdates, setProjectUpdates] = useState(true)
  const [gmailCount] = useState(0)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  function pickMapStyle(id: string) { setMapStyle(id); localStorage.setItem('upscape_map_style', id) }
  function pickMapTime(t: string) { setMapTime(t); localStorage.setItem('upscape_map_time', t) }

  function scrollTo(id: string) {
    setActive(id)
    document.getElementById('settings-'+id)?.scrollIntoView({ behavior:'smooth', block:'start' })
  }

  const TABS = [
    { id:'general', label:'General' },
    { id:'appearance', label:'Appearance' },
    { id:'notifications', label:'Notifications' },
  ]

  const L = lightMode
  const txt  = L ? '#1a1714' : 'rgba(255,255,255,0.82)'
  const muted = L ? '#6b635c' : 'rgba(255,255,255,0.35)'
  const border = L ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.05)'
  const cardBg = L ? '#ffffff' : 'rgba(255,255,255,0.028)'
  const cardBorder = L ? '#ddd8d1' : 'rgba(255,255,255,0.07)'
  const optBorder = (active: boolean, col='#F4884A') => active ? col : (L ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)')
  const optBg = (active: boolean) => active ? 'rgba(244,136,74,0.08)' : (L ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)')
  const tabBg = L ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.03)'
  const tabBorder = L ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'

  const T = (on: boolean, fn: ()=>void) => <Toggle on={on} onToggle={fn} />

  const row = (label: string, desc: string, right: React.ReactNode, last=false) => (
    <div className="settings-row" style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'15px 20px',borderBottom:last?'none':`1px solid ${border}`,gap:20 }}>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ fontSize:13,color:txt,fontWeight:500,letterSpacing:'-0.01em' }}>{label}</div>
        <div style={{ fontSize:11,color:muted,marginTop:2 }}>{desc}</div>
      </div>
      <div style={{ flexShrink:0 }}>{right}</div>
    </div>
  )

  const block = (id: string, title: string, children: React.ReactNode) => (
    <div id={'settings-'+id} style={{ marginBottom:28, scrollMarginTop:16 }}>
      <div style={{ fontSize:10,fontWeight:700,color:'#F4884A',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:10 }}>{title}</div>
      <div style={{ background:cardBg,border:`1px solid ${cardBorder}`,borderRadius:13,overflow:'hidden',boxShadow:L?'0 1px 4px rgba(0,0,0,0.06)':'none' }}>{children}</div>
    </div>
  )

  const mapIcons: Record<string,React.ReactNode> = {
    satellite: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="8" height="8" rx="1.5" fill="rgba(244,136,74,0.55)"/><rect x="14" y="2" width="8" height="8" rx="1.5" fill="rgba(244,136,74,0.3)"/><rect x="2" y="14" width="8" height="8" rx="1.5" fill="rgba(244,136,74,0.3)"/><rect x="14" y="14" width="8" height="8" rx="1.5" fill="rgba(244,136,74,0.55)"/></svg>,
    terrain:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M2 18L8 8l4 6 4-8 6 12H2z" fill={L?'rgba(0,0,0,0.12)':'rgba(255,255,255,0.15)'} stroke={L?'rgba(0,0,0,0.45)':'rgba(255,255,255,0.45)'} strokeWidth="1.3"/></svg>,
  }

  return (
    <div style={{ maxWidth:560, animation:'fadeUp .3s ease both' }}>

      {/* horizontal tab bar */}
      <div style={{ display:'flex', gap:2, marginBottom:24, background:tabBg, border:`1px solid ${tabBorder}`, borderRadius:10, padding:3 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => scrollTo(t.id)}
            style={{ flex:1, padding:'7px 12px', borderRadius:7, border:'none', background: active===t.id ? (L?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.08)') : 'transparent', color: active===t.id ? txt : muted, fontSize:12, fontWeight: active===t.id ? 600 : 400, cursor:'pointer', letterSpacing:'-0.01em', transition:'all .15s', position:'relative' }}>
            {t.label}
            {active===t.id && <div style={{ position:'absolute',bottom:2,left:'50%',transform:'translateX(-50%)',width:16,height:2,borderRadius:1,background:'#F4884A' }} />}
          </button>
        ))}
      </div>

      {/* scrollable content — all sections on one page */}
      <div ref={scrollRef} style={{ display:'flex', flexDirection:'column' }}>

        {block('general','General', <>
          <div style={{ padding:'15px 20px', borderBottom:`1px solid ${border}` }}>
            <div style={{ fontSize:13,color:txt,fontWeight:500,marginBottom:2 }}>Map style</div>
            <div style={{ fontSize:11,color:muted,marginBottom:12 }}>Choose how maps appear in the designer.</div>
            <div style={{ display:'flex', gap:10 }}>
              {[{id:'satellite',label:'Satellite',desc:'Aerial imagery'},{id:'terrain',label:'Terrain',desc:'Topographic map'}].map(opt => (
                <div key={opt.id} onClick={() => pickMapStyle(opt.id)}
                  style={{ flex:1,display:'flex',alignItems:'center',gap:10,padding:'12px 14px',borderRadius:10,border:`1.5px solid ${optBorder(mapStyle===opt.id)}`,background:optBg(mapStyle===opt.id),cursor:'pointer',transition:'all .15s' }}>
                  <div style={{ flexShrink:0 }}>{mapIcons[opt.id]}</div>
                  <div>
                    <div style={{ fontSize:13,fontWeight:600,color:mapStyle===opt.id?'#F4884A':txt,letterSpacing:'-0.01em' }}>{opt.label}</div>
                    <div style={{ fontSize:11,color:muted,marginTop:1 }}>{opt.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding:'15px 20px' }}>
            <div style={{ fontSize:13,color:txt,fontWeight:500,marginBottom:2 }}>Time of day</div>
            <div style={{ fontSize:11,color:muted,marginBottom:12 }}>Sets the lighting when you open a project.</div>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8 }}>
              {[
                { id:'dawn',  label:'Dawn',  sky:'linear-gradient(160deg,#1a0a2e,#6b2f7a,#e8836a)', dot:'#c97bd4' },
                { id:'day',   label:'Day',   sky:'linear-gradient(160deg,#1a3a6b,#4a8fd4,#f5d876)', dot:'#f5d876' },
                { id:'dusk',  label:'Dusk',  sky:'linear-gradient(160deg,#0d0a1a,#6b2510,#f4884a)', dot:'#f4884a' },
                { id:'night', label:'Night', sky:'linear-gradient(160deg,#020408,#060d1a,#0d1e35)', dot:'#3b82f6' },
              ].map(opt => (
                <div key={opt.id} onClick={() => pickMapTime(opt.id)}
                  style={{ borderRadius:10, border:`1.5px solid ${optBorder(mapTime===opt.id,opt.dot)}`, overflow:'hidden', cursor:'pointer', transition:'border-color .15s', background:mapTime===opt.id?(L?'rgba(0,0,0,0.03)':'rgba(255,255,255,0.04)'):'transparent' }}>
                  <div style={{ height:44, background:opt.sky }} />
                  <div style={{ padding:'7px 8px', display:'flex', alignItems:'center', gap:5, background:L?'#fff':'transparent' }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:opt.dot, flexShrink:0, boxShadow:mapTime===opt.id?`0 0 6px ${opt.dot}`:'none' }} />
                    <span style={{ fontSize:11, fontWeight: mapTime===opt.id?600:400, color: mapTime===opt.id?txt:muted, letterSpacing:'-0.01em' }}>{opt.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>)}

        {block('appearance','Appearance', <>
          {row('Dark / Light mode','Toggle between dark and light interface.',(
            <div style={{ display:'flex',alignItems:'center',gap:10 }}>
              <span style={{ fontSize:11,color:muted,minWidth:28 }}>{lightMode?'Light':'Dark'}</span>
              <Toggle on={lightMode} onToggle={toggleTheme} />
            </div>
          ))}
          {row('Ambient glow','Adjust the intensity of ambient glow.',(
            <div style={{ display:'flex',alignItems:'center',gap:10 }}>
              <input type="range" min={0} max={100} value={ambientGlow} onChange={e=>setAmbientGlow(+e.target.value)} style={{ width:110,accentColor:'#F4884A',cursor:'pointer' }} />
              <span style={{ fontSize:11,color:muted,minWidth:30,textAlign:'right' }}>{ambientGlow}%</span>
            </div>
          ))}
          {row('Animations','Enable interface animations and transitions.',T(animations,()=>setAnimations(v=>!v)),true)}
        </>)}

        {block('notifications','Notifications', <>
          {row('Quote alerts','Notify when a quote is opened.',T(quoteAlerts,()=>setQuoteAlerts(v=>!v)))}
          {row('Project updates','Receive project status change reminders.',T(projectUpdates,()=>setProjectUpdates(v=>!v)))}
          {row('Gmail','Upscape-related emails',
            gmailCount > 0
              ? <div style={{ background:'#ea4335',borderRadius:10,fontSize:11,fontWeight:700,color:'#fff',padding:'2px 8px' }}>{gmailCount>99?'99+':gmailCount}</div>
              : <span style={{ fontSize:11,color:muted }}>No new</span>,
            true
          )}
        </>)}

        <button onClick={logout} style={{ marginTop:4,alignSelf:'flex-start',background:'transparent',border:'1px solid rgba(239,68,68,0.18)',borderRadius:9,color:'rgba(239,68,68,0.55)',fontSize:12,fontWeight:500,padding:'9px 18px',cursor:'pointer' }}>Sign out</button>
      </div>
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

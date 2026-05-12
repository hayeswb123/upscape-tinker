'use client'
import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { supabase, type Project } from '@/lib/supabase'

const STATUS_LABEL: Record<string, string> = { draft: 'Draft', quoted: 'Quoted', approved: 'Approved', installed: 'Installed' }
const STATUS_COLOR: Record<string, string> = { draft: '#6b7280', quoted: '#F4884A', approved: '#22c55e', installed: '#a78bfa' }

function UpscapeMark({ size = 36 }: { size?: number }) {
  return <img src="/upscape-logo-mark.png" alt="Upscape" width={size} height={size} style={{ objectFit: 'contain', display: 'block' }} />
}

type Section = 'projects' | 'products' | 'gallery' | 'ai' | 'settings'

// Main nav items (top section)
const NAV_MAIN = [
  {
    id: 'projects' as Section,
    label: 'Projects',
    icon: (active: boolean) => (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.9 : 1.5}>
        <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    ),
  },
  {
    id: 'gallery' as Section,
    label: 'Gallery',
    icon: (active: boolean) => (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.9 : 1.5}>
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
      </svg>
    ),
  },
  {
    id: 'products' as Section,
    label: 'Products',
    icon: (active: boolean) => (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.9 : 1.5}>
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    ),
  },
  {
    id: 'ai' as Section,
    label: 'AI Assistant',
    icon: (active: boolean) => (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.9 : 1.5}>
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
    ),
  },
]

// Manage nav items (pinned bottom section)
const NAV_MANAGE = [
  {
    id: 'settings' as Section,
    label: 'Settings',
    icon: (active: boolean) => (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.9 : 1.5}>
        <path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
      </svg>
    ),
  },
]

// combined for breadcrumb lookup
const NAV = [...NAV_MAIN, ...NAV_MANAGE]

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

  async function deleteClient(clientName: string) {
    setProjects(prev => prev.filter(p => (p.homeowner || p.name || '').trim() !== clientName))
    await supabase.from('projects').delete().eq('homeowner', clientName)
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
        width: 196, flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        background: L ? 'rgba(255,255,255,0.6)' : 'rgba(12,10,8,0.55)',
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
        borderRight: L ? '1px solid rgba(0,0,0,0.07)' : '1px solid rgba(255,255,255,0.06)',
        boxShadow: L ? '1px 0 0 rgba(0,0,0,0.03), 4px 0 20px rgba(0,0,0,.07)' : '1px 0 0 rgba(244,136,74,0.05), 4px 0 28px rgba(0,0,0,.35)',
        transition: 'background .3s, border-color .3s',
      }}>
        {/* logo */}
        <div style={{ padding: '16px 14px 13px', borderBottom: L ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <img src="/upscape-logo-mark.png" alt="" width={24} height={24} style={{ objectFit: 'contain', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: L ? 'rgba(0,0,0,0.82)' : 'rgba(255,255,255,0.88)', lineHeight: 1 }}>UPSCAPE</div>
              <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: L ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.2)', marginTop: 3 }}>Field Designer</div>
            </div>
          </div>
        </div>

        {/* nav — flex column, main items grow, manage pinned at bottom */}
        <nav style={{ flex: 1, padding: '10px 8px 10px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {/* MAIN group */}
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: L ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.2)', padding: '2px 10px 6px' }}>Main</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {NAV_MAIN.map(item => {
              const active = section === item.id
              return (
                <button key={item.id} className="nav-item" onClick={() => setSection(item.id)} style={{ display:'flex',alignItems:'center',gap:9, padding:'8px 10px',borderRadius:8,border:'none',cursor:'pointer',textAlign:'left',width:'100%', background:active?'rgba(244,136,74,0.1)':'transparent', color:active?(L?'rgba(0,0,0,0.85)':'rgba(255,255,255,0.92)'):(L?'rgba(0,0,0,0.42)':'rgba(255,255,255,0.36)'), fontSize:12.5,fontWeight:active?500:400,letterSpacing:'-0.01em', boxShadow:active?'0 0 0 1px rgba(244,136,74,0.16) inset':'none',position:'relative' }}>
                  {active && <div style={{ position:'absolute',left:0,top:'50%',transform:'translateY(-50%)',width:2.5,height:18,borderRadius:2,background:'rgba(244,136,74,0.85)',boxShadow:'0 0 8px rgba(244,136,74,0.5)' }} />}
                  <span style={{ color:active?'rgba(244,136,74,0.9)':(L?'rgba(0,0,0,0.3)':'rgba(255,255,255,0.28)'),flexShrink:0 }}>{item.icon(active)}</span>
                  {item.label}
                </button>
              )
            })}
          </div>

          {/* spacer pushes MANAGE to bottom */}
          <div style={{ flex: 1 }} />

          {/* MANAGE group */}
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: L ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.2)', padding: '2px 10px 6px' }}>Manage</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {NAV_MANAGE.map(item => {
              const active = section === item.id
              return (
                <button key={item.id} className="nav-item" onClick={() => setSection(item.id)} style={{ display:'flex',alignItems:'center',gap:9, padding:'8px 10px',borderRadius:8,border:'none',cursor:'pointer',textAlign:'left',width:'100%', background:active?'rgba(244,136,74,0.1)':'transparent', color:active?(L?'rgba(0,0,0,0.85)':'rgba(255,255,255,0.92)'):(L?'rgba(0,0,0,0.42)':'rgba(255,255,255,0.36)'), fontSize:12.5,fontWeight:active?500:400,letterSpacing:'-0.01em', boxShadow:active?'0 0 0 1px rgba(244,136,74,0.16) inset':'none',position:'relative' }}>
                  {active && <div style={{ position:'absolute',left:0,top:'50%',transform:'translateY(-50%)',width:2.5,height:18,borderRadius:2,background:'rgba(244,136,74,0.85)',boxShadow:'0 0 8px rgba(244,136,74,0.5)' }} />}
                  <span style={{ color:active?'rgba(244,136,74,0.9)':(L?'rgba(0,0,0,0.3)':'rgba(255,255,255,0.28)'),flexShrink:0 }}>{item.icon(active)}</span>
                  {item.label}
                </button>
              )
            })}
          </div>
        </nav>

        {/* profile at bottom */}
        <div style={{ padding: '10px 8px 14px', borderTop: L ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.04)' }}>
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
          {section === 'projects' && <ProjectsSection projects={projects} loading={loading} confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete} hoveredId={hoveredId} setHoveredId={setHoveredId} deleteProject={deleteProject} deleteClient={deleteClient} router={router} fmt={fmt} installedCount={installedCount} />}
          {section === 'products' && <ProductsSection />}
          {section === 'gallery' && <GallerySection />}
          {section === 'ai' && <AISection />}
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
  const [mounted, setMounted] = useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => { setMounted(true) }, [])

  React.useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const panel = (
    <div style={{ position: 'fixed', top: 62, right: 20, zIndex: 99999, width: 240, borderRadius: 14, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.98), 0 0 0 1px rgba(255,255,255,0.08)' }}>
      {/* solid black background — no blur, no transparency */}
      <div style={{ background: '#111111', borderRadius: 14, overflow: 'hidden' }}>
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
    </div>
  )

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px 5px 5px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#F4884A,#c0520a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', boxShadow: '0 0 6px rgba(244,136,74,0.25)' }}>{initials}</div>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', letterSpacing: '-0.01em', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Designer</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="M6 9l6 6 6-6"/></svg>
      </div>
      {open && mounted && createPortal(panel, document.body)}
    </div>
  )
}

// ── PROJECTS ──────────────────────────────────────────
function ProjectsSection({ projects, loading, router, installedCount, deleteClient }: any) {
  const [confirmDeleteClient, setConfirmDeleteClient] = useState<string | null>(null)

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
              <div style={{ display:'flex',alignItems:'center',gap:7,flexShrink:0 }} onClick={e=>e.stopPropagation()}>
                {confirmDeleteClient === key ? (
                  <>
                    <span style={{ fontSize:11,color:'rgba(255,255,255,0.45)' }}>Delete all projects?</span>
                    <button onClick={()=>{ deleteClient(key); setConfirmDeleteClient(null) }}
                      style={{ background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.35)',color:'#ef4444',borderRadius:6,fontSize:11,fontWeight:600,padding:'3px 9px',cursor:'pointer' }}>Delete</button>
                    <button onClick={()=>setConfirmDeleteClient(null)}
                      style={{ background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.45)',borderRadius:6,fontSize:11,fontWeight:500,padding:'3px 9px',cursor:'pointer' }}>Cancel</button>
                  </>
                ) : (
                  <>
                    {allStatuses.slice(0,2).map((s:string)=>(
                      <span key={s} style={{ background:STATUS_COLOR[s]+'16',color:STATUS_COLOR[s],borderRadius:5,fontSize:10,fontWeight:600,padding:'2px 6px',letterSpacing:'0.03em',textTransform:'uppercase' }}>{STATUS_LABEL[s]||s}</span>
                    ))}
                    <span style={{ fontSize:11,color:'rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.055)',borderRadius:6,padding:'2px 8px',fontWeight:500,flexShrink:0 }}>{client.projects.length} project{client.projects.length!==1?'s':''}</span>
                    <button onClick={()=>setConfirmDeleteClient(key)} title="Delete client"
                      style={{ background:'none',border:'none',color:'rgba(255,255,255,0.18)',cursor:'pointer',padding:'3px 5px',borderRadius:6,display:'flex',alignItems:'center',transition:'color .15s' }}
                      onMouseEnter={e=>(e.currentTarget.style.color='#ef4444')} onMouseLeave={e=>(e.currentTarget.style.color='rgba(255,255,255,0.18)')}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                    </button>
                    <span className="card-arrow" style={{ color:'rgba(255,255,255,0.22)',fontSize:17,lineHeight:1,opacity:.45 }}>›</span>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Empty state — always shown below cards */}
      {!loading && <EmptyState onNew={() => router.push('/projects/new')} hasClients={clientCount > 0} />}
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
function EmptyState({ onNew, hasClients }: { onNew: () => void; hasClients?: boolean }) {
  return (
    <div style={{
      marginTop: hasClients ? 72 : 40,
      marginBottom: 40,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      animation: 'emptyFadeIn 1s cubic-bezier(.16,1,.3,1) both',
      animationDelay: hasClients ? '0.1s' : '0.3s',
      position: 'relative',
    }}>
      {/* separator line — only shown when cards above exist */}
      {hasClients && (
        <div style={{ width: '100%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)', marginBottom: 72 }} />
      )}

      {/* ambient glow behind image */}
      <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%, -54%)', width:380, height:280, borderRadius:'50%', background:'radial-gradient(ellipse, rgba(244,136,74,0.09) 0%, transparent 65%)', pointerEvents:'none', animation:'glowPulse 6s ease-in-out infinite' }} />

      {/* floor spotlight */}
      <div style={{ position:'absolute', top:'calc(50% + 20px)', left:'50%', transform:'translateX(-50%)', width:440, height:60, borderRadius:'50%', background:'radial-gradient(ellipse, rgba(244,136,74,0.18) 0%, transparent 70%)', filter:'blur(14px)', pointerEvents:'none', animation:'glowPulse 5s ease-in-out infinite', animationDelay:'1s' }} />

      {/* folder illustration */}
      <div style={{ animation:'float 7s ease-in-out infinite', position:'relative', marginBottom: 44 }}>
        {/* tight floor shadow under image */}
        <div style={{ position:'absolute', bottom:-16, left:'50%', transform:'translateX(-50%)', width:160, height:20, borderRadius:'50%', background:'radial-gradient(ellipse, rgba(244,136,74,0.3) 0%, transparent 70%)', filter:'blur(8px)' }} />
        <img
          src="/empty-folder.png"
          alt="No projects yet"
          style={{
            width: 200,
            height: 'auto',
            display: 'block',
            filter: 'drop-shadow(0 0 24px rgba(244,136,74,0.35)) drop-shadow(0 0 6px rgba(244,136,74,0.2))',
          }}
        />
      </div>

      {/* text */}
      <h2 style={{ margin:'0 0 10px', fontSize:24, fontWeight:700, letterSpacing:'-0.04em', color:'rgba(255,255,255,0.82)', textAlign:'center', lineHeight:1.1 }}>
        {hasClients ? 'Ready to add more?' : 'No clients yet'}
      </h2>
      <p style={{ margin:'0 0 32px', fontSize:13, color:'rgba(255,255,255,0.22)', textAlign:'center', letterSpacing:'-0.01em', lineHeight:1.7, maxWidth:240 }}>
        {hasClients
          ? 'Create a new client and start designing their landscape lighting.'
          : 'Add your first client to begin designing their lighting system.'}
      </p>

      {/* CTA */}
      <button
        onClick={onNew}
        style={{ display:'flex', alignItems:'center', gap:8, padding:'11px 26px', borderRadius:11, background:'linear-gradient(135deg,#F4884A,#d96520)', border:'none', color:'#fff', fontSize:13, fontWeight:600, letterSpacing:'-0.01em', cursor:'pointer', boxShadow:'0 0 28px rgba(244,136,74,0.3), 0 4px 18px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.14) inset', transition:'transform .18s cubic-bezier(.22,1,.36,1), box-shadow .18s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-2px) scale(1.02)'; (e.currentTarget as HTMLElement).style.boxShadow='0 0 48px rgba(244,136,74,0.45), 0 8px 28px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.18) inset' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform='none'; (e.currentTarget as HTMLElement).style.boxShadow='0 0 28px rgba(244,136,74,0.3), 0 4px 18px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.14) inset' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
        New client
      </button>
    </div>
  )
}

// ── PRODUCTS ──────────────────────────────────────────
type ProdEntry = { name: string; brand: 'AMP' | 'Sunvie'; img: string }
const PRODUCT_CATALOG: Record<string, ProdEntry[]> = {
  uplights: [
    { name: 'PinnaclePro MR16 Spotlight',       brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/c/b/cb59530c-88f8-4893-8792-01f33d6aad55_cb59530c-88f8-4893-8792-01f33d6aad55.jpg' },
    { name: 'G2 EcoPro MR16 Spotlight',          brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/e/c/ecopro-bbz_0006_pit_7733.png' },
    { name: 'ONE G2 ControlPro™ 300 Spotlight',  brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/a/a/aal-3000-4-bbz_013_jpg_1.jpg' },
    { name: 'ONE G2 ControlPro™ 500 Spotlight',  brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/a/a/aal-3001-4-bbz_010_jpg_1.jpg' },
    { name: 'G5 ControlPro™ RF Spotlight',       brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/g/5/g5_cw_hero_1.png' },
    { name: 'Nano LED Spotlight',                brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/n/a/nano.8_1.png' },
    { name: 'Mini PinnaclePro MR11 Spotlight',   brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/3/d/3d6e43e5-ad71-4fe6-ad90-65677e67f1fe_3d6e43e5-ad71-4fe6-ad90-65677e67f1fe.jpg' },
    { name: 'Waterproof LED Spotlights 4-Pack',  brand: 'Sunvie', img: 'https://www.sunvie.com/cdn/shop/files/6_2.jpg' },
    { name: '6W Anti-Glare Spotlights 8-Pack',   brand: 'Sunvie', img: 'https://www.sunvie.com/cdn/shop/files/1_a63910cb-1abc-491f-bd24-8558dc2317c3.jpg' },
    { name: '5" Solid Brass Spotlights 4-Pack',  brand: 'Sunvie', img: 'https://www.sunvie.com/cdn/shop/files/1_1_50bf3f20-0d39-44cd-b202-ff3b2fd76924.jpg' },
  ],
  pathway: [
    { name: 'MagnumPro™ Path Light',             brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/a/h/aht-3309-bbz_002_jpg_1_3.jpg' },
    { name: 'SummitPro™ Path Light',             brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/a/h/aht-3206-bbz_002_jpg.jpg' },
    { name: 'ConicaPro™ Path Light',             brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/i/m/image_34_.png' },
    { name: 'StetsonPro Path Light',             brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/9/i/9in-stetson-hero_1.png' },
    { name: 'Mini MagnumPro™ Path Light',        brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/m/i/mini_magnumpro_path_area_light_1_.png' },
    { name: 'Mini SummitPro™ Path Light',        brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/m/i/mini-pathlight_0008_color-balance-1-copy-8.png' },
    { name: 'NovellePro Wide Path Light',        brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/e/5/e5082a63-f831-48c8-9487-a5240d70d9a5_e5082a63-f831-48c8-9487-a5240d70d9a5_1_1.jpg' },
    { name: '3W Cast-Aluminum Path Lights',      brand: 'Sunvie', img: 'https://www.sunvie.com/cdn/shop/files/61qRXzkJiYL._AC_SL1500.jpg' },
    { name: 'Hollow Cuboid Path Lights',         brand: 'Sunvie', img: 'https://www.sunvie.com/cdn/shop/files/81l0q-eJUeL._AC_SL1500.jpg' },
    { name: 'Anti-Glare LED Path Lights 12-Pack',brand: 'Sunvie', img: 'https://www.sunvie.com/cdn/shop/files/1_cd00835a-95d8-47ba-a3f6-8557366691aa.jpg' },
    { name: 'Pathway Bollard Lights 12-Pack',    brand: 'Sunvie', img: 'https://www.sunvie.com/cdn/shop/files/2_9d946052-192e-4765-8be1-38bb231ea57d.jpg' },
    { name: '5W Waterproof Path Lights 4-Pack',  brand: 'Sunvie', img: 'https://www.sunvie.com/cdn/shop/files/9_1.jpg' },
  ],
  flood: [
    { name: 'DiffusePro Flood Light',            brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/0/6/06b29b82-5432-4824-b4a1-cc2744ff6642_06b29b82-5432-4824-b4a1-cc2744ff6642.jpg' },
    { name: 'ParamountPro LED Flood Light',      brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/a/f/afl-4012-4-b-bz_4__1.jpg' },
    { name: 'EquaPro Wall Wash',                 brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/v/a/val-1004-4-bbz_006_030819-3788x3389-602bee3_2_.jpg' },
    { name: '12W LED Flood w/ Yoke Mount',       brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/a/f/afl-4018-b-bz_1_.jpg' },
    { name: '27W LED Flood w/ Yoke Mount',       brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/v/f/vfl-4510-bbz-illuminated_1.jpg' },
    { name: 'G2 Nano LED Flood Light',           brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/n/a/nano_led_flood_light_1_.png' },
    { name: 'SpectrumPro R7S Flood Light',       brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/b/v/bvn-vfl-4007-bbz-illuminated-resized_1.png' },
    { name: 'StoutPro PAR36 Flood Light',        brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/v/f/vfl-4501-4-bbz_3__1.png' },
  ],
  downlights: [
    { name: 'PinnaclePro MR16 Downlight',        brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/d/3/d359f3f4-6721-4693-953a-a3eee3f9620f_d359f3f4-6721-4693-953a-a3eee3f9620f.jpg' },
    { name: 'ONE G2 ControlPro™ 200 Downlight',  brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/v/a/val-1813-40-bbz_003_jpg_-_copy_2.jpg' },
    { name: 'AviatorPro Downlight',              brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/f/2/f2808223-53e9-4b3b-a94c-b1eedf88d2e9_f2808223-53e9-4b3b-a94c-b1eedf88d2e9.jpg' },
    { name: 'G5 ControlPro™ RF Downlight',       brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/g/5/g5_cw_hero_1.png' },
    { name: 'PinnaclePro MR16 Black Downlight',  brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/u/n/untitled-1_0005_pit_8401.png' },
  ],
  well: [
    { name: 'HydraPro™ MR16 Well Light',         brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/0/0/00d06c8c-c6e7-45d1-822b-72c005271644_00d06c8c-c6e7-45d1-822b-72c005271644.jpg' },
    { name: 'HydraPro™ MR16 In-Grade Light',     brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/a/w/awl-5004-b-bz-illuminated.jpg' },
    { name: 'BurrowPro PAR36 Well Light',        brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/r/1/r1-awl-5000-guard_0007_pit_9117.png' },
    { name: 'HydraPro™ MR11 Well Light',         brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/a/w/awl-5005-4-b-bz-illuminated.jpg' },
    { name: 'Nano LED Well Light',               brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/n/a/nano-well-light_0003_pit_3167-3_1.png' },
    { name: 'Core Drill MR11 Well Light',        brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/c/o/core-well-light_0006__mg_4967_1.png' },
    { name: 'In-Ground Well Lights 12-Pack',     brand: 'Sunvie', img: 'https://www.sunvie.com/cdn/shop/files/1_8d11c97d-4374-42cd-b48e-f99b14c5e143.jpg' },
    { name: 'Shielded In-Ground Lights 12-Pack', brand: 'Sunvie', img: 'https://www.sunvie.com/cdn/shop/files/81JY2TXNeAL._AC_SL1500.jpg' },
    { name: '12W Waterproof Well Lights 10-Pack',brand: 'Sunvie', img: 'https://www.sunvie.com/cdn/shop/files/1_69f19edb-415f-4ff8-b641-5d6d57472fef.jpg' },
    { name: '5W Anti-Glare Well Lights 6-Pack',  brand: 'Sunvie', img: 'https://www.sunvie.com/cdn/shop/files/LowVoltage5WLEDAnti-GlareGroundLandscapeWellLights6PackMDWY-05-06C_1_1f45f200-1e04-4b1d-97a4-54cb9ddb9f43.jpg' },
  ],
  transformers: [
    { name: '150W Slim Line Transformer',        brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/1/2/12f23399-79d0-470a-9651-a7a0722223bf_12f23399-79d0-470a-9651-a7a0722223bf.jpg' },
    { name: '300W Slim Line Transformer',        brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/d/e/defa481b-6c99-400e-9b04-feec0a650d94_defa481b-6c99-400e-9b04-feec0a650d94.jpg' },
    { name: '300W Multi-Tap Transformer',        brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/0/9/09b87dfc-5d55-497f-9897-5ec35ce54bcd_09b87dfc-5d55-497f-9897-5ec35ce54bcd.jpg' },
    { name: '600W Multi-Tap Transformer',        brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/a/_/a.transformer.2.png' },
    { name: '900W Multi-Tap Transformer',        brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/4/c/4c1a4717-6680-4846-b8d8-f3eebfc4177b_4c1a4717-6680-4846-b8d8-f3eebfc4177b_1.jpg' },
    { name: '1200W Multi-Tap Transformer',       brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/1/2/1200-12-22.jpg' },
    { name: '50W Nano Clamp-Connect',            brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/1/x/1x1_amp_transformer-min_1.png' },
    { name: '100W Inline Power Converter',       brand: 'AMP',    img: 'https://www.amplighting.com/media/catalog/product/s/c/screen_shot_2023-03-27_at_2.11.45_pm.png' },
    { name: '60W Transformer w/ Timer & Photocell', brand: 'Sunvie', img: 'https://www.sunvie.com/cdn/shop/files/Low_Voltage_Landscape_Transformer_with_Timer_and_Photocell_Sensor-1.jpg' },
    { name: '120W Transformer w/ Timer & Photocell',brand: 'Sunvie', img: 'https://www.sunvie.com/cdn/shop/files/710eEqYWI9L._SL1500.jpg' },
    { name: '200W Transformer w/ Timer & Photocell',brand: 'Sunvie', img: 'https://www.sunvie.com/cdn/shop/files/200W_Low_Voltage_Landscape_Lighting_Transformer-1.jpg' },
    { name: '300W Transformer w/ Timer & Photocell',brand: 'Sunvie', img: 'https://www.sunvie.com/cdn/shop/files/300W_Low_Voltage_Landscape_Lighting_Transformer-1.jpg' },
    { name: '300W 3-Zone Independent Control',   brand: 'Sunvie', img: 'https://www.sunvie.com/cdn/shop/files/1_-1_d0b7da8c-3815-4785-9b15-d3bed72db5cf.jpg' },
    { name: '300W Waterproof Transformer',       brand: 'Sunvie', img: 'https://www.sunvie.com/cdn/shop/files/1_1497e56d-6a9d-4c1c-9ade-5b6d72a340e7.jpg' },
  ],
}

const CAT_TABS = [
  { id: 'uplights',     label: 'Uplights',     color: '#F4884A' },
  { id: 'pathway',      label: 'Pathway',      color: '#F5C842' },
  { id: 'flood',        label: 'Flood',        color: '#EF4444' },
  { id: 'downlights',   label: 'Downlights',   color: '#8B5CF6' },
  { id: 'well',         label: 'Well Lights',  color: '#3B82F6' },
  { id: 'transformers', label: 'Transformers', color: '#9CA3AF' },
]

function ProductsSection() {
  const [cat, setCat] = useState('uplights')
  const products = PRODUCT_CATALOG[cat] || []

  return (
    <div style={{ maxWidth: 760, animation: 'fadeUp .3s ease both' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: '0 0 3px', fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.92)' }}>Products</h1>
        <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>AMP Lighting · Sunvie — full fixture catalog</p>
      </div>

      {/* category tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {CAT_TABS.map(t => {
          const active = cat === t.id
          return (
            <button key={t.id} onClick={() => setCat(t.id)} style={{
              padding: '6px 14px', borderRadius: 8, border: active ? `1px solid ${t.color}40` : '1px solid rgba(255,255,255,0.07)',
              background: active ? `${t.color}14` : 'rgba(255,255,255,0.03)',
              color: active ? t.color : 'rgba(255,255,255,0.38)',
              fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer', letterSpacing: '-0.01em',
              transition: 'all .15s',
              boxShadow: active ? `0 0 12px ${t.color}20` : 'none',
            }}>
              {t.label}
              <span style={{ marginLeft: 5, fontSize: 10, opacity: .6 }}>{PRODUCT_CATALOG[t.id].length}</span>
            </button>
          )
        })}
      </div>

      {/* brand legend */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
        {(['AMP', 'Sunvie'] as const).map(b => (
          <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: b === 'AMP' ? '#F4884A' : '#22c55e', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{b === 'AMP' ? 'AMP Lighting' : 'Sunvie'}</span>
          </div>
        ))}
      </div>

      {/* product grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
        {products.map((p, i) => (
          <div key={i} className="product-card" style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
            transition: 'border-color .18s, box-shadow .18s, transform .18s',
            animation: 'fadeUp .25s ease both', animationDelay: `${i * 0.03}s`,
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(244,136,74,0.18)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(244,136,74,0.2)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)' }}
          >
            {/* image */}
            <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', position: 'relative', padding: 8 }}>
              <img
                src={p.img}
                alt={p.name}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </div>
            {/* info */}
            <div style={{ padding: '10px 11px 11px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.78)', letterSpacing: '-0.015em', lineHeight: 1.35, marginBottom: 6 }}>{p.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 7, height: 7, borderRadius: 2, background: p.brand === 'AMP' ? '#F4884A' : '#22c55e', flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.02em' }}>{p.brand === 'AMP' ? 'AMP Lighting' : 'Sunvie'}</span>
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

// ── GALLERY ───────────────────────────────────────────
const GALLERY_PHOTOS = [
  'IMG_4265.JPG','IMG_4271.JPG','IMG_4274.JPG','IMG_4275.JPG','IMG_4276.JPG',
  'IMG_4277.JPG','IMG_4278.JPG','IMG_4279.JPG','IMG_4280.JPG','IMG_4281.JPG',
  'IMG_4282.JPG','IMG_4283.JPG','IMG_4284.JPG','IMG_4285.JPG','IMG_4286.JPG',
  'IMG_4287.JPG','IMG_4288.JPG','IMG_4289.JPG','IMG_4290.JPG','IMG_4291.JPG',
]

function GallerySection() {
  const [lightbox, setLightbox] = useState<string | null>(null)

  return (
    <div style={{ maxWidth: 860, animation: 'fadeUp .3s ease both' }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ margin: '0 0 3px', fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.92)' }}>Gallery</h1>
        <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>{GALLERY_PHOTOS.length} installed projects · click to enlarge</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
        {GALLERY_PHOTOS.map((file, i) => (
          <div key={file} onClick={() => setLightbox(file)}
            style={{ aspectRatio: '4/3', borderRadius: 10, overflow: 'hidden', cursor: 'zoom-in', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', animation: 'fadeUp .3s ease both', animationDelay: `${i * 0.025}s`, transition: 'transform .2s, box-shadow .2s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 30px rgba(0,0,0,0.5), 0 0 0 1px rgba(244,136,74,0.2)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
          >
            <img src={`/gallery/${file}`} alt={`Project ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', backdropFilter: 'blur(8px)', animation: 'fadeUp .15s ease both' }}>
          <img src={`/gallery/${lightbox}`} alt="" onClick={e => e.stopPropagation()}
            style={{ maxWidth: '92vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 14, boxShadow: '0 30px 80px rgba(0,0,0,0.8)', cursor: 'default' }} />
          <button onClick={() => setLightbox(null)} style={{ position: 'fixed', top: 20, right: 24, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 18, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          {/* prev / next */}
          {(() => {
            const idx = GALLERY_PHOTOS.indexOf(lightbox)
            return (
              <>
                {idx > 0 && <button onClick={e => { e.stopPropagation(); setLightbox(GALLERY_PHOTOS[idx - 1]) }} style={{ position: 'fixed', left: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 22, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>}
                {idx < GALLERY_PHOTOS.length - 1 && <button onClick={e => { e.stopPropagation(); setLightbox(GALLERY_PHOTOS[idx + 1]) }} style={{ position: 'fixed', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 22, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>}
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}

// ── AI ASSISTANT ──────────────────────────────────────
const UPSCAPE_SYSTEM = `You are the Upscape AI assistant, built into the Upscape Field Designer app used by area managers in the field.

About Upscape:
Upscape is a national landscape lighting franchise founded by Hayes and Ross Bauer. Corporate owns the brand, technology, and supply chain. Area Managers (franchisees) buy exclusive territories for $100,000 and handle all local sales, design, and installer routing. Installers are licensed electricians who show up and follow color-coded flags — no quoting, no design decisions required from them.

How jobs work:
1. Area Manager visits property, opens the app, creates a project with the satellite map.
2. Manager drops icons on the map — uplights, path lights, power points, wire runs — which auto-build a live quote.
3. The system generates three quote tiers: Good (Sunvie), Better (VOLT), Best (AMP Lighting).
4. Homeowner approves and picks a tier. Equipment is ordered automatically.
5. Manager returns to place color-coded flags matching the map.
6. Installer follows the flags and installs.
7. Manager returns for a quality check and photos.

Product tiers:
- Good: Sunvie — budget, Amazon-sourced, solid entry-level fixtures
- Better: VOLT — mid-range, most popular, great weather resistance
- Best: AMP Lighting — premium, industry-leading warranty, highest output. Long-term acquisition target for Upscaped.

Franchise economics:
- $100k buy-in, 8% royalty on revenue, 2% national marketing fund, $400/mo tech fee
- Typical territory: 50 jobs/year × $6k avg = $300k revenue for franchisee
- Corporate collects ~$52,800/year per active franchise

You can answer questions about: job process, pricing quotes, product selection, how to use the app, franchise operations, equipment, troubleshooting installs, homeowner communication, and anything else related to running an Upscape territory.

Be concise, practical, and direct. You're talking to a field professional.`

type AIMessage = { role: 'user' | 'assistant'; content: string }

function AISection() {
  const [messages, setMessages] = useState<AIMessage[]>([
    { role: 'assistant', content: "Hey! I'm your Upscape AI — ask me anything about jobs, products, quotes, or running your territory." }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    const apiKey = process.env.NEXT_PUBLIC_ANTHROPIC_KEY || ''
    if (!apiKey || apiKey.startsWith('REPLACE')) {
      setMessages(prev => [...prev, { role: 'user', content: text }, { role: 'assistant', content: '⚠️ No API key set. Add NEXT_PUBLIC_ANTHROPIC_KEY to your .env.local file and redeploy.' }])
      setInput('')
      return
    }
    setInput('')
    const next: AIMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setLoading(true)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 600,
          system: UPSCAPE_SYSTEM,
          messages: next.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      const reply = data.content?.[0]?.text || 'Sorry, I had trouble responding. Try again.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Network error — check your connection and try again.' }])
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: 680, height: 'calc(100dvh - 140px)', display: 'flex', flexDirection: 'column', animation: 'fadeUp .3s ease both' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: '0 0 3px', fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.92)' }}>AI Assistant</h1>
        <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>Powered by Claude · knows Upscape inside and out</p>
      </div>

      {/* Message thread */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingRight: 4 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '80%',
              background: m.role === 'user'
                ? 'linear-gradient(135deg,#F4884A,#df6f28)'
                : 'rgba(255,255,255,0.055)',
              border: m.role === 'assistant' ? '1px solid rgba(255,255,255,0.08)' : 'none',
              borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              padding: '11px 15px',
              fontSize: 13,
              lineHeight: 1.6,
              color: m.role === 'user' ? '#fff' : 'rgba(255,255,255,0.82)',
              whiteSpace: 'pre-wrap',
            }}>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px 14px 14px 4px', padding: '11px 15px', display: 'flex', gap: 5, alignItems: 'center' }}>
              {[0,1,2].map(j => <div key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(244,136,74,0.6)', animation: `ambientPulse 1.2s ease-in-out ${j * 0.2}s infinite` }} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ marginTop: 16, display: 'flex', gap: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14, padding: '10px 12px', alignItems: 'flex-end' }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Ask anything about Upscape, products, jobs, quotes…"
          rows={1}
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', resize: 'none', color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 1.5, fontFamily: 'inherit', overflowY: 'hidden' }}
          onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px' }}
        />
        <button onClick={send} disabled={!input.trim() || loading} style={{ background: input.trim() ? 'linear-gradient(135deg,#F4884A,#df6f28)' : 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 9, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() ? 'pointer' : 'default', flexShrink: 0, transition: 'background .2s' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  )
}

// ── SETTINGS ──────────────────────────────────────────
function Toggle({ on, onToggle, glow = 70 }: { on: boolean; onToggle: () => void; glow?: number }) {
  const g = glow / 100
  return (
    <div onClick={onToggle} style={{ width:44,height:24,borderRadius:12,background:on?'#F4884A':'rgba(255,255,255,0.12)',cursor:'pointer',position:'relative',transition:'background .2s',flexShrink:0,boxShadow:on?`0 0 ${Math.round(14*g)}px rgba(244,136,74,${(0.45*g).toFixed(2)})`:'none' }}>
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

  const T = (on: boolean, fn: ()=>void) => <Toggle on={on} onToggle={fn} glow={ambientGlow} />

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
              <Toggle on={lightMode} onToggle={toggleTheme} glow={ambientGlow} />
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

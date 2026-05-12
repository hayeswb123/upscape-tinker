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
        <path d="M12 2a4 4 0 014 4v1h1a3 3 0 013 3v2a3 3 0 01-3 3h-1v1a4 4 0 01-4 4H8a4 4 0 01-4-4v-1H3a3 3 0 01-3-3V10a3 3 0 013-3h1V6a4 4 0 014-4h4z" strokeLinejoin="round"/>
        <circle cx="9" cy="11" r="1" fill="currentColor" stroke="none"/>
        <circle cx="15" cy="11" r="1" fill="currentColor" stroke="none"/>
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
        @keyframes shimmerMove { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }
        @keyframes genPulse    { 0%,100%{box-shadow:0 0 0 0 rgba(244,136,74,0),0 0 24px rgba(244,136,74,0.12)} 50%{box-shadow:0 0 0 4px rgba(244,136,74,0.08),0 0 40px rgba(244,136,74,0.22)} }
        @keyframes meshDrift   { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(12px,-8px) scale(1.04)} 66%{transform:translate(-8px,10px) scale(.97)} }
        @keyframes genFadeIn   { from{opacity:0;transform:scale(.97)} to{opacity:1;transform:scale(1)} }
        @keyframes fogDrift { 0%{transform:translateX(-18%) scaleY(1)} 50%{transform:translateX(18%) scaleY(1.07)} 100%{transform:translateX(-18%) scaleY(1)} }
        @keyframes floatFolder { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-3px)} }
        @keyframes folderGlow { 0%,100%{opacity:.55;transform:translateX(-50%) scaleX(1)} 50%{opacity:.8;transform:translateX(-50%) scaleX(1.12)} }
        @keyframes volRay { 0%,100%{opacity:.04} 50%{opacity:.09} }
        @keyframes grainAnim { 0%{transform:translate(0,0)} 25%{transform:translate(-2px,1px)} 50%{transform:translate(1px,-2px)} 75%{transform:translate(-1px,2px)} 100%{transform:translate(0,0)} }
        @keyframes dustFloat { 0%{transform:translate(var(--dx0),var(--dy0));opacity:0} 15%{opacity:var(--op)} 85%{opacity:var(--op)} 100%{transform:translate(var(--dx1),var(--dy1));opacity:0} }

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
        width: 160, flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        background: L ? 'rgba(255,255,255,0.62)' : 'rgba(12,10,8,0.55)',
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
        borderRight: L ? '1px solid rgba(0,0,0,0.07)' : '1px solid rgba(255,255,255,0.06)',
        boxShadow: L ? '1px 0 0 rgba(0,0,0,0.03), 4px 0 24px rgba(0,0,0,.07)' : '1px 0 0 rgba(244,136,74,0.05), 4px 0 32px rgba(0,0,0,.38)',
        transition: 'background .3s, border-color .3s',
      }}>
        {/* logo */}
        <div style={{ padding: '16px 12px 13px', borderBottom: L ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/upscape-logo-mark.png" alt="" width={24} height={24} style={{ objectFit: 'contain', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', color: L ? 'rgba(0,0,0,0.82)' : 'rgba(255,255,255,0.9)', lineHeight: 1 }}>UPSCAPE</div>
              <div style={{ fontSize: 8.5, fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', color: L ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.2)', marginTop: 3 }}>Field Designer</div>
            </div>
          </div>
        </div>

        {/* nav — flex column, main items grow, manage pinned at bottom */}
        <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {/* MAIN group */}
          <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: L ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.18)', padding: '0 10px 6px' }}>Main</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {NAV_MAIN.map(item => {
              const active = section === item.id
              return (
                <button key={item.id} className="nav-item" onClick={() => setSection(item.id)} style={{ display:'flex',alignItems:'center',gap:8, padding:'8px 10px',borderRadius:8,border:'none',cursor:'pointer',textAlign:'left',width:'100%', background:active?'rgba(244,136,74,0.1)':'transparent', color:active?(L?'rgba(0,0,0,0.85)':'rgba(255,255,255,0.92)'):(L?'rgba(0,0,0,0.4)':'rgba(255,255,255,0.36)'), fontSize:12,fontWeight:active?500:400,letterSpacing:'-0.01em', boxShadow:active?'0 0 0 1px rgba(244,136,74,0.14) inset':'none',position:'relative' }}>
                  {active && <div style={{ position:'absolute',left:0,top:'50%',transform:'translateY(-50%)',width:2.5,height:18,borderRadius:2,background:'rgba(244,136,74,0.85)',boxShadow:'0 0 8px rgba(244,136,74,0.5)' }} />}
                  <span style={{ color:active?'rgba(244,136,74,0.9)':(L?'rgba(0,0,0,0.28)':'rgba(255,255,255,0.26)'),flexShrink:0 }}>{item.icon(active)}</span>
                  {item.label}
                </button>
              )
            })}
          </div>

          {/* spacer pushes MANAGE to bottom */}
          <div style={{ flex: 1 }} />

          {/* MANAGE group */}
          <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: L ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.18)', padding: '0 10px 6px' }}>Manage</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {NAV_MANAGE.map(item => {
              const active = section === item.id
              return (
                <button key={item.id} className="nav-item" onClick={() => setSection(item.id)} style={{ display:'flex',alignItems:'center',gap:8, padding:'8px 10px',borderRadius:8,border:'none',cursor:'pointer',textAlign:'left',width:'100%', background:active?'rgba(244,136,74,0.1)':'transparent', color:active?(L?'rgba(0,0,0,0.85)':'rgba(255,255,255,0.92)'):(L?'rgba(0,0,0,0.4)':'rgba(255,255,255,0.36)'), fontSize:12,fontWeight:active?500:400,letterSpacing:'-0.01em', boxShadow:active?'0 0 0 1px rgba(244,136,74,0.14) inset':'none',position:'relative' }}>
                  {active && <div style={{ position:'absolute',left:0,top:'50%',transform:'translateY(-50%)',width:2.5,height:18,borderRadius:2,background:'rgba(244,136,74,0.85)',boxShadow:'0 0 8px rgba(244,136,74,0.5)' }} />}
                  <span style={{ color:active?'rgba(244,136,74,0.9)':(L?'rgba(0,0,0,0.28)':'rgba(255,255,255,0.26)'),flexShrink:0 }}>{item.icon(active)}</span>
                  {item.label}
                </button>
              )
            })}
          </div>
        </nav>

        {/* profile at bottom */}
        <div style={{ padding: '10px 8px 14px', borderTop: L ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, background: L ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)', border: L ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)', cursor: 'pointer' }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#F4884A,#c0520a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0, boxShadow: '0 0 8px rgba(244,136,74,0.3)' }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: L ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.65)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail || 'Designer'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 4px #22c55e' }} />
                <span style={{ fontSize: 9.5, color: L ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.22)' }}>Online</span>
              </div>
            </div>
            <button onClick={logout} title="Sign out" style={{ background: 'none', border: 'none', color: L ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.2)', cursor: 'pointer', padding: 2, fontSize: 14, lineHeight: 1, flexShrink: 0 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
            </button>
          </div>
          <a href="https://getupscaped.com" target="_blank" rel="noopener noreferrer"
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:4, padding:'6px 0 2px', textDecoration:'none', opacity:0.35, transition:'opacity .15s' }}
            onMouseEnter={e=>(e.currentTarget.style.opacity='0.7')}
            onMouseLeave={e=>(e.currentTarget.style.opacity='0.35')}>
            <span style={{ fontSize:10, color: L ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)', letterSpacing:'0.02em' }}>getupscaped.com</span>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={L ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)'} strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
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
        <main style={{ flex: 1, overflowY: 'auto', padding: '28px 32px 60px' }}>
          {section === 'projects' && <ProjectsSection projects={projects} loading={loading} confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete} hoveredId={hoveredId} setHoveredId={setHoveredId} deleteProject={deleteProject} deleteClient={deleteClient} router={router} fmt={fmt} installedCount={installedCount} />}
          {section === 'products' && <ProductsSection />}
          {section === 'gallery' && <GallerySection />}
          {section === 'ai' && <AISection projects={projects} />}
          {section === 'settings' && <SettingsSection userEmail={userEmail} logout={logout} lightMode={L} toggleTheme={toggleTheme} ambientGlow={ambientGlow} setAmbientGlow={(v: number) => { setAmbientGlow(v); localStorage.setItem('upscape_glow', String(v)) }}  />}
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
  const [hoveredId, setHoveredId]   = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

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

  return (
    <div style={{ maxWidth: 900, animation: 'fadeUp .3s ease both' }}>

      {/* header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28 }}>
        <div>
          <h1 style={{ margin:0, fontSize:20, fontWeight:700, letterSpacing:'-0.035em', color:'rgba(255,255,255,0.9)' }}>Clients</h1>
          <p style={{ margin:'3px 0 0', fontSize:11, color:'rgba(255,255,255,0.22)', letterSpacing:'-0.01em' }}>
            {clientCount} client{clientCount!==1?'s':''} · {projects.length} project{projects.length!==1?'s':''} · {installedCount} installed
          </p>
        </div>
        <button className="new-btn" onClick={() => router.push('/projects/new')}
          style={{ background:'linear-gradient(135deg,#F4884A,#df6f28)', border:'none', borderRadius:8, color:'#fff', fontWeight:600, fontSize:11, padding:'7px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:5, letterSpacing:'-0.01em', boxShadow:'0 0 18px rgba(244,136,74,0.28), 0 2px 8px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.1) inset', flexShrink:0 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
          New client
        </button>
      </div>

      {/* loading */}
      {loading && (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'20px 0', color:'rgba(255,255,255,0.2)', fontSize:12 }}>
          <div style={{ width:16,height:16,border:'1.5px solid rgba(244,136,74,0.2)',borderTopColor:'#F4884A',borderRadius:'50%',animation:'spin .8s linear infinite',flexShrink:0 }} />
          Loading…
        </div>
      )}

      {/* client cards */}
      {!loading && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {Array.from(clientMap.entries()).map(([key, client], ci) => {
            const isHov    = hoveredId === key
            const isDel    = confirmDel === key
            const initials = client.name.split(' ').map((w:string)=>w[0]).slice(0,2).join('').toUpperCase()
            const topStatus = client.projects[0]?.status || 'draft'
            const statusColor = STATUS_COLOR[topStatus] || '#6b7280'

            return (
              <div key={key}
                className="dash-card"
                onMouseEnter={() => setHoveredId(key)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => !isDel && router.push(`/clients/${encodeURIComponent(key)}`)}
                style={{
                  position: 'relative', overflow: 'hidden',
                  background: isHov ? 'rgba(255,255,255,0.038)' : 'rgba(255,255,255,0.022)',
                  border: `1px solid ${isHov ? 'rgba(244,136,74,0.2)' : 'rgba(255,255,255,0.065)'}`,
                  borderRadius: 14, padding: '16px 18px',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
                  boxShadow: isHov ? '0 0 0 1px rgba(244,136,74,0.08) inset, 0 8px 32px rgba(0,0,0,0.4), 0 0 40px rgba(244,136,74,0.06)' : '0 2px 14px rgba(0,0,0,0.28)',
                  transform: isHov ? 'translateY(-2px)' : 'translateY(0)',
                  transition: 'all .22s cubic-bezier(.4,0,.2,1)',
                  animation: 'fadeUp .3s ease both', animationDelay: `${ci * 0.06}s`,
                }}>

                {/* left status bar */}
                <div style={{ position:'absolute', left:0, top:12, bottom:12, width:3, borderRadius:2, background:statusColor, boxShadow:`0 0 8px ${statusColor}`, opacity: isHov ? 1 : 0.6, transition:'opacity .2s' }} />

                {/* initials avatar */}
                <div style={{
                  width:44, height:44, borderRadius:11, flexShrink:0, marginLeft:8,
                  background: isHov ? 'linear-gradient(135deg,rgba(244,136,74,0.28),rgba(244,136,74,0.1))' : 'linear-gradient(135deg,rgba(244,136,74,0.16),rgba(244,136,74,0.05))',
                  border: `1px solid ${isHov ? 'rgba(244,136,74,0.35)' : 'rgba(244,136,74,0.15)'}`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:13, fontWeight:700, color: isHov ? 'rgba(244,136,74,1)' : 'rgba(244,136,74,0.85)',
                  letterSpacing:'-0.02em', transition:'all .2s',
                  boxShadow: isHov ? '0 0 18px rgba(244,136,74,0.2)' : 'none',
                }}>{initials}</div>

                {/* info */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div className="card-name" style={{ fontWeight:600, fontSize:14, letterSpacing:'-0.025em', color: isHov ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.82)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', transition:'color .18s' }}>{client.name}</div>
                  <div style={{ color:'rgba(255,255,255,0.28)', fontSize:12, marginTop:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', letterSpacing:'-0.01em' }}>{client.address || 'No address on file'}</div>
                </div>

                {/* right actions */}
                <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }} onClick={e => e.stopPropagation()}>
                  {isDel ? (
                    <>
                      <span style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>Delete all?</span>
                      <button onClick={() => { deleteClient(key); setConfirmDel(null) }}
                        style={{ background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.35)', color:'#ef4444', borderRadius:6, fontSize:11, fontWeight:600, padding:'3px 10px', cursor:'pointer' }}>Delete</button>
                      <button onClick={() => setConfirmDel(null)}
                        style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.45)', borderRadius:6, fontSize:11, padding:'3px 10px', cursor:'pointer' }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize:10, fontWeight:700, color:statusColor, background:statusColor+'18', borderRadius:5, padding:'2px 7px', letterSpacing:'0.04em', textTransform:'uppercase', opacity: isHov ? 1 : 0.7, transition:'opacity .18s' }}>{STATUS_LABEL[topStatus]}</span>
                      <span style={{ fontSize:11, color:'rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.05)', borderRadius:5, padding:'2px 8px', fontWeight:500 }}>{client.projects.length} project{client.projects.length!==1?'s':''}</span>
                      <button onClick={() => setConfirmDel(key)} title="Delete client"
                        style={{ background:'none', border:'none', color:'rgba(255,255,255,0.15)', cursor:'pointer', padding:'4px 6px', borderRadius:6, display:'flex', alignItems:'center', transition:'color .15s', opacity: isHov ? 1 : 0, transform: isHov ? 'scale(1)' : 'scale(0.8)', transition2:'opacity .18s, transform .18s' } as any}
                        onMouseEnter={e=>(e.currentTarget.style.color='#ef4444')} onMouseLeave={e=>(e.currentTarget.style.color='rgba(255,255,255,0.15)')}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                      </button>
                      <span style={{ color:'rgba(255,255,255,0.2)', fontSize:16, opacity: isHov ? 0.7 : 0.3, transition:'opacity .18s, transform .18s', transform: isHov ? 'translateX(2px)' : 'translateX(0)' }}>›</span>
                    </>
                  )}
                </div>

                {/* cinematic hover glow sweep */}
                {isHov && (
                  <div style={{ position:'absolute', inset:0, background:'linear-gradient(105deg, transparent 40%, rgba(244,136,74,0.04) 60%, transparent 80%)', pointerEvents:'none', borderRadius:14 }} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* glowing folder — always shown below cards, fills remaining space */}
      {!loading && <EmptyState onNew={() => router.push('/projects/new')} hasClients={clientCount > 0} />}
    </div>
  )
}

// ── QUOTES ────────────────────────────────────────────
function QuotesSection({ projects, router, fmt }: any) {
  const quoted = projects.filter((p: Project) => ['quoted','approved'].includes(p.status))
  return (
    <div style={{ maxWidth: 900, animation: 'fadeUp .3s ease both' }}>
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

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      paddingTop: hasClients ? 60 : 40, paddingBottom: 60,
      animation: 'emptyFadeIn 1s cubic-bezier(.16,1,.3,1) both',
      animationDelay: hasClients ? '0.15s' : '0.3s',
      position: 'relative',
    }}>
      {hasClients && (
        <div style={{ width:'100%', height:1, background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.05),transparent)', marginBottom:64 }} />
      )}

      {/* Folder + subtle dust — overflow visible so particles can drift outside */}
      <div style={{ position:'relative', width:376, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:2 }}>

        {/* Dust particles — very faint, drift freely */}
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

        {/* Folder */}
        <div style={{ animation:'floatFolder 5s ease-in-out infinite', position:'relative', zIndex:1 }}>
          <img src="/empty-folder.png" alt="" style={{ width:376, height:'auto', display:'block', mixBlendMode:'screen', WebkitMaskImage:'linear-gradient(to bottom, black 60%, transparent 100%)', maskImage:'linear-gradient(to bottom, black 60%, transparent 100%)' }} />
        </div>
      </div>

      <h2 style={{ margin:'0 0 10px', fontSize:24, fontWeight:700, letterSpacing:'-0.04em', color:'rgba(255,255,255,0.82)', textAlign:'center', lineHeight:1.1 }}>
        {hasClients ? 'Ready to add more?' : 'No clients yet'}
      </h2>
      <p style={{ margin:'0 0 32px', fontSize:13, color:'rgba(255,255,255,0.22)', textAlign:'center', letterSpacing:'-0.01em', lineHeight:1.7, maxWidth:230 }}>
        {hasClients
          ? 'Create a new client and start designing their landscape lighting.'
          : 'Add your first client to begin designing their lighting system.'}
      </p>

      <button onClick={onNew}
        style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 28px', borderRadius:11, background:'linear-gradient(135deg,#F4884A,#d96520)', border:'none', color:'#fff', fontSize:13, fontWeight:600, letterSpacing:'-0.01em', cursor:'pointer', boxShadow:'0 0 28px rgba(244,136,74,0.3), 0 4px 18px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.14) inset', transition:'transform .18s cubic-bezier(.22,1,.36,1), box-shadow .18s' }}
        onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.transform='translateY(-2px) scale(1.02)';(e.currentTarget as HTMLElement).style.boxShadow='0 0 48px rgba(244,136,74,0.45),0 8px 28px rgba(0,0,0,0.45),0 1px 0 rgba(255,255,255,0.18) inset'}}
        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.transform='none';(e.currentTarget as HTMLElement).style.boxShadow='0 0 28px rgba(244,136,74,0.3),0 4px 18px rgba(0,0,0,0.4),0 1px 0 rgba(255,255,255,0.14) inset'}}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
        New client
      </button>

      {/* Feature row */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:0, marginTop:48, width:'100%', maxWidth:480 }}>
        {[
          {
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(244,136,74,0.7)" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
            title: 'Organize clients',
            desc: 'Keep every project in one place.',
          },
          {
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(244,136,74,0.7)" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>,
            title: 'Design beautifully',
            desc: 'Plan and visualize with precision.',
          },
          {
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(244,136,74,0.7)" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
            title: 'Deliver effortlessly',
            desc: 'Install with confidence every time.',
          },
        ].map((f, i) => (
          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'flex-start', padding:'0 20px', borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
            <div style={{ width:34, height:34, borderRadius:9, background:'rgba(244,136,74,0.08)', border:'1px solid rgba(244,136,74,0.12)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:10 }}>
              {f.icon}
            </div>
            <div style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.65)', marginBottom:4, letterSpacing:'-0.01em' }}>{f.title}</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.22)', lineHeight:1.5 }}>{f.desc}</div>
          </div>
        ))}
      </div>
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
    <div style={{ maxWidth: 1100, animation: 'fadeUp .3s ease both' }}>
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
    <div style={{ maxWidth: 900, animation:'fadeUp .3s ease both' }}>
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
    <div style={{ maxWidth: 1100, animation: 'fadeUp .3s ease both' }}>
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

// ── AI ASSISTANT (unified: chat + design vision) ──────
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
- Best: AMP Lighting — premium, industry-leading warranty, highest output.

Franchise economics:
- $100k buy-in, 8% royalty on revenue, 2% national marketing fund, $400/mo tech fee
- Typical territory: 50 jobs/year × $6k avg = $300k revenue for franchisee

You can answer questions about: job process, pricing quotes, product selection, how to use the app, franchise operations, equipment, troubleshooting installs, homeowner communication, lighting design guidance, fixture placement recommendations, zone planning, transformer sizing, wire runs, and anything else related to Upscape.

Be concise, practical, and direct. You're talking to a field professional.`

const DESIGN_PROMPT = `You are a professional Upscape landscape lighting designer analyzing a residential property photo.

Return ONLY valid JSON (no markdown fences, no extra text) in exactly this format:
{
  "zones": [
    {
      "id": "z1",
      "type": "uplight",
      "name": "Front oak tree",
      "description": "Multi-point uplighting showcases canopy structure",
      "x": 30,
      "y": 45,
      "radius": 14,
      "qty": 2,
      "wattage": 5
    }
  ],
  "summary": {
    "totalFixtures": 10,
    "totalWattage": 72,
    "transformerSize": "150W",
    "wireEstimate": "160–200 ft across 3 zones",
    "difficulty": "moderate",
    "designNotes": "Warm uplighting on the mature trees anchors the design. Pathway lights guide guests while the facade wash creates architectural presence after dark."
  }
}

Types allowed: uplight, path, flood, wall_wash, accent, step, patio, downlight
x and y are percentages (0–100) of image width/height for zone center placement.
radius is glow radius as % of image width (6–18 range).
Identify 5–9 zones. Be specific to what you actually see in the image.`

const DESIGN_STYLES = [
  { id: 'warm-luxury',    label: 'Warm Luxury',    desc: 'Rich amber tones, layered depth',    color: '#F4884A' },
  { id: 'modern-minimal', label: 'Modern Minimal', desc: 'Clean white accents, precise lines', color: '#94a3b8' },
  { id: 'soft-natural',   label: 'Soft Natural',   desc: 'Diffused moonlight, gentle glow',    color: '#86efac' },
  { id: 'high-contrast',  label: 'High Contrast',  desc: 'Bold shadows, dramatic uplighting',  color: '#c084fc' },
]
const ZONE_COLORS: Record<string,string> = {
  uplight:'#F4884A', path:'#fbbf24', flood:'#f87171',
  wall_wash:'#a78bfa', accent:'#fb923c', step:'#34d399',
  patio:'#60a5fa', downlight:'#e879f9',
}
const STYLE_FILTER: Record<string,string> = {
  'warm-luxury':    'brightness(0.18) sepia(0.3)',
  'modern-minimal': 'brightness(0.15) saturate(0.4)',
  'soft-natural':   'brightness(0.22) sepia(0.15)',
  'high-contrast':  'brightness(0.10) contrast(1.2)',
}
const STYLE_GLOW: Record<string,{color:string;opacity:number}> = {
  'warm-luxury':    { color: '#ff8c00', opacity: 0.85 },
  'modern-minimal': { color: '#e0f0ff', opacity: 0.55 },
  'soft-natural':   { color: '#ffe4a0', opacity: 0.60 },
  'high-contrast':  { color: '#ff6000', opacity: 0.95 },
}

type AIMessage    = { role: 'user' | 'assistant'; content: string; imageUrl?: string; attachPreview?: string }
type DesignZone   = { id:string; type:string; name:string; description:string; x:number; y:number; radius:number; qty:number; wattage:number }
type DesignSummary = { totalFixtures:number; totalWattage:number; transformerSize:string; wireEstimate:string; difficulty:string; designNotes:string }
type DesignAnalysis = { zones:DesignZone[]; summary:DesignSummary }


function AISection({ projects }: { projects: Project[] }) {
  return (
    <div style={{ maxWidth: 1100, height: 'calc(100dvh - 140px)', display: 'flex', flexDirection: 'column', animation: 'fadeUp .3s ease both' }}>
      <div style={{ marginBottom: 18, flexShrink: 0 }}>
        <h1 style={{ margin:'0 0 3px', fontSize:20, fontWeight:700, letterSpacing:'-0.035em', color:'rgba(255,255,255,0.9)' }}>AI Assistant</h1>
        <p style={{ margin:0, fontSize:11, color:'rgba(255,255,255,0.22)' }}>Powered by Claude · design guidance, lighting plans, project help</p>
      </div>
      <AIChatPane projects={projects} />
    </div>
  )
}

// ── CHAT PANE (with inline image attachment) ──────────
function AIChatPane({ projects }: { projects: Project[] }) {
  const [messages, setMessages] = useState<AIMessage[]>([
    { role: 'assistant', content: "Hey! I'm your Upscape AI — ask me anything about jobs, products, quotes, or lighting design. You can also attach a yard photo for a design analysis." }
  ])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [genStage, setGenStage] = useState('')
  const [pendingImg, setPendingImg] = useState<{ b64: string; mime: string; preview: string } | null>(null)
  const bottomRef = React.useRef<HTMLDivElement>(null)
  const fileRef   = React.useRef<HTMLInputElement>(null)

  const QUICK = [
    'How do I size a transformer?',
    'Best uplight for oak trees?',
    'How many path lights per 100ft?',
    'Troubleshoot a flickering zone',
    'Quote a front yard job',
  ]

  React.useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages])

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = e => {
      const src = e.target?.result as string
      const img = new Image()
      img.onload = () => {
        const MAX = 1024
        const scale = Math.min(1, MAX / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
        const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
        const full = canvas.toDataURL(mime)
        setPendingImg({ b64: full.split(',')[1], mime, preview: full })
      }
      img.src = src
    }
    reader.readAsDataURL(file)
  }

  async function send(text?: string) {
    const msg = (text || input).trim()
    if ((!msg && !pendingImg) || loading) return
    setInput('')
    setLoading(true)

    // ── IMAGE DROPPED → Claude describes yard → DALL-E visualizes lighting ──
    if (pendingImg) {
      const snap = pendingImg
      setPendingImg(null)
      const displayMsg = msg || 'Generate a lighting visualization for this yard'
      setMessages(prev => [...prev, { role:'user', content: displayMsg, attachPreview: snap.preview }])

      const claudeKey = process.env.NEXT_PUBLIC_ANTHROPIC_KEY || ''
      const openaiKey = process.env.NEXT_PUBLIC_OPENAI_KEY || ''

      try {
        setIsGenerating(true); setGenStage('Reading your yard…')
        // Step 1: Claude reads the photo and writes a DALL-E prompt
        const visionRes = await fetch('https://api.anthropic.com/v1/messages', {
          method:'POST',
          headers:{ 'Content-Type':'application/json','x-api-key':claudeKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true' },
          body: JSON.stringify({ model:'claude-haiku-4-5', max_tokens:300,
            messages:[{ role:'user', content:[
              { type:'image', source:{ type:'base64', media_type: snap.mime, data: snap.b64 } },
              { type:'text', text:`Describe this residential yard in 2-3 sentences for an image generation prompt. Focus on the architecture, trees, driveway, pathways, and garden features. Be specific about materials and layout. Then on a new line write: DALLE_PROMPT: [a photorealistic nighttime rendering of this exact yard with professional warm amber landscape lighting — uplights on trees, path lights along walkways, accent lights on architecture — cinematic, high-end residential, no people]${msg ? ` User note: ${msg}` : ''}` },
            ]}] }),
        })
        const visionData = await visionRes.json()
        const visionText: string = visionData.content?.[0]?.text || ''
        const promptIdx = visionText.indexOf('DALLE_PROMPT:')
        const promptMatch = promptIdx >= 0 ? [null, visionText.slice(promptIdx + 13).trim()] : null
        const dallePrompt = (promptMatch && promptMatch[1]) ? promptMatch[1].trim() : `Photorealistic nighttime rendering of a residential yard with professional warm amber landscape lighting — uplights on trees, path lights along walkways, accent lights on architecture. Cinematic, high-end residential photography.`

        // Step 2: DALL-E 3 generates the visualization
        setGenStage('Generating lighting visualization…')
        const imgRes = await fetch('https://api.openai.com/v1/images/generations', {
          method:'POST',
          headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${openaiKey}` },
          body: JSON.stringify({ model:'dall-e-3', prompt: dallePrompt, n:1, size:'1024x1024', quality:'standard' }),
        })
        const imgData = await imgRes.json()
        const imageUrl = imgData.data?.[0]?.url
        if (imageUrl) {
          setGenStage('Rendering…')
          setTimeout(() => {
            setIsGenerating(false); setGenStage('')
            setMessages(prev => [...prev, { role:'assistant', content:'Here\'s your lighting visualization:', imageUrl }])
          }, 400)
        } else {
          setIsGenerating(false); setGenStage('')
          setMessages(prev => [...prev, { role:'assistant', content:'Image generation failed — ' + (imgData.error?.message || 'unknown error') }])
        }
      } catch(e: any) {
        setIsGenerating(false); setGenStage('')
        setMessages(prev => [...prev, { role:'assistant', content:'Error: ' + e.message }])
      }
      setLoading(false)
      return
    }

    // ── TEXT ONLY → Claude ──────────────────────────────────────────────────
    const claudeKey = process.env.NEXT_PUBLIC_ANTHROPIC_KEY || ''
    if (!claudeKey || claudeKey.startsWith('REPLACE')) {
      setMessages(prev => [...prev, { role:'user', content: msg }, { role:'assistant', content:'⚠️ Add NEXT_PUBLIC_ANTHROPIC_KEY to use the AI assistant.' }])
      setLoading(false)
      return
    }
    const next: AIMessage[] = [...messages, { role:'user', content: msg }]
    setMessages(next)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{ 'Content-Type':'application/json','x-api-key':claudeKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true' },
        body: JSON.stringify({ model:'claude-haiku-4-5', max_tokens:900, system:UPSCAPE_SYSTEM, messages: next.map(m=>({ role:m.role, content:m.content })) }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role:'assistant', content: data.content?.[0]?.text || 'Sorry, try again.' }])
    } catch {
      setMessages(prev => [...prev, { role:'assistant', content:'Network error — check connection.' }])
    }
    setLoading(false)
  }

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>

      {/* thread */}
      <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:12, paddingRight:4, paddingBottom:4 }}>
        {messages.map((m,i) => (
          <div key={i} style={{ display:'flex', justifyContent: m.role==='user'?'flex-end':'flex-start', alignItems:'flex-end', gap:8 }}>
            {m.role === 'assistant' && (
              <div style={{ width:26, height:26, borderRadius:8, background:'rgba(244,136,74,0.1)', border:'1px solid rgba(244,136,74,0.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginBottom:2 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F4884A" strokeWidth="1.8"><path d="M12 2a4 4 0 014 4v1h1a3 3 0 013 3v2a3 3 0 01-3 3h-1v1a4 4 0 01-4 4H8a4 4 0 01-4-4v-1H3a3 3 0 01-3-3V10a3 3 0 013-3h1V6a4 4 0 014-4h4z" strokeLinejoin="round"/><circle cx="9" cy="11" r="1" fill="#F4884A" stroke="none"/><circle cx="15" cy="11" r="1" fill="#F4884A" stroke="none"/></svg>
              </div>
            )}
            <div style={{ maxWidth:'78%', background: m.role==='user'?'linear-gradient(135deg,#F4884A,#df6f28)':'rgba(255,255,255,0.05)', border: m.role==='assistant'?'1px solid rgba(255,255,255,0.08)':'none', borderRadius: m.role==='user'?'14px 14px 4px 14px':'14px 14px 14px 4px', padding: (m.imageUrl || m.attachPreview) ? '8px 8px 6px' : '11px 14px', fontSize:13, lineHeight:1.6, color: m.role==='user'?'#fff':'rgba(255,255,255,0.82)', whiteSpace:'pre-wrap', overflow:'hidden' }}>
                {/* user attached photo preview */}
                {m.attachPreview && (
                  <img src={m.attachPreview} alt="" style={{ display:'block', width:'100%', maxWidth:220, borderRadius:8, marginBottom: m.content ? 7 : 0, objectFit:'cover' }} />
                )}
                {m.content}
                {/* generated image with fade-in */}
                {m.imageUrl && <img src={m.imageUrl} alt="lighting visualization" style={{ display:'block', width:'100%', borderRadius:10, marginTop:8, border:'1px solid rgba(255,255,255,0.1)', animation:'genFadeIn .6s cubic-bezier(.16,1,.3,1) both' }} />}
              </div>
          </div>
        ))}
        {loading && !isGenerating && (
          <div style={{ display:'flex', justifyContent:'flex-start', alignItems:'flex-end', gap:8 }}>
            <div style={{ width:26, height:26, borderRadius:8, background:'rgba(244,136,74,0.1)', border:'1px solid rgba(244,136,74,0.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F4884A" strokeWidth="1.8"><path d="M12 2a4 4 0 014 4v1h1a3 3 0 013 3v2a3 3 0 01-3 3h-1v1a4 4 0 01-4 4H8a4 4 0 01-4-4v-1H3a3 3 0 01-3-3V10a3 3 0 013-3h1V6a4 4 0 014-4h4z" strokeLinejoin="round"/><circle cx="9" cy="11" r="1" fill="#F4884A" stroke="none"/><circle cx="15" cy="11" r="1" fill="#F4884A" stroke="none"/></svg>
            </div>
            <div style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'14px 14px 14px 4px', padding:'12px 16px', display:'flex', gap:5, alignItems:'center' }}>
              {[0,1,2].map(j=><div key={j} style={{ width:6,height:6,borderRadius:'50%',background:'rgba(244,136,74,0.6)',animation:`ambientPulse 1.2s ease-in-out ${j*.2}s infinite` }} />)}
            </div>
          </div>
        )}

        {/* ── CINEMATIC IMAGE GENERATION LOADER ── */}
        {isGenerating && (
          <div style={{ display:'flex', justifyContent:'flex-start', alignItems:'flex-end', gap:8 }}>
            <div style={{ width:26, height:26, borderRadius:8, background:'rgba(244,136,74,0.1)', border:'1px solid rgba(244,136,74,0.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F4884A" strokeWidth="1.8"><path d="M12 2a4 4 0 014 4v1h1a3 3 0 013 3v2a3 3 0 01-3 3h-1v1a4 4 0 01-4 4H8a4 4 0 01-4-4v-1H3a3 3 0 01-3-3V10a3 3 0 013-3h1V6a4 4 0 014-4h4z" strokeLinejoin="round"/><circle cx="9" cy="11" r="1" fill="#F4884A" stroke="none"/><circle cx="15" cy="11" r="1" fill="#F4884A" stroke="none"/></svg>
            </div>
            {/* canvas */}
            <div style={{ width:280, borderRadius:'14px 14px 14px 4px', overflow:'hidden', border:'1px solid rgba(244,136,74,0.15)', animation:'genPulse 2.4s ease-in-out infinite', background:'#0c0a08', position:'relative' }}>
              {/* mesh gradient bg */}
              <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 80% 60% at 30% 40%, rgba(244,136,74,0.12) 0%, transparent 65%), radial-gradient(ellipse 60% 50% at 70% 70%, rgba(180,60,10,0.09) 0%, transparent 60%)', animation:'meshDrift 6s ease-in-out infinite', pointerEvents:'none' }} />
              {/* shimmer sweep */}
              <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
                <div style={{ position:'absolute', top:0, bottom:0, width:'40%', background:'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)', animation:'shimmerMove 1.8s ease-in-out infinite' }} />
              </div>
              {/* fake image rows */}
              <div style={{ padding:'16px 16px 14px', display:'flex', flexDirection:'column', gap:8, position:'relative', zIndex:1 }}>
                <div style={{ height:110, borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.05)', overflow:'hidden', position:'relative' }}>
                  <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg, rgba(244,136,74,0.06), rgba(180,60,10,0.03), transparent)', animation:'meshDrift 8s ease-in-out infinite reverse' }} />
                  <div style={{ position:'absolute', inset:0, overflow:'hidden' }}>
                    <div style={{ position:'absolute', top:0, bottom:0, width:'60%', background:'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)', animation:'shimmerMove 2.2s ease-in-out .3s infinite' }} />
                  </div>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <div style={{ flex:1, height:6, borderRadius:4, background:'rgba(255,255,255,0.06)', overflow:'hidden', position:'relative' }}>
                    <div style={{ position:'absolute', inset:0, background:'linear-gradient(90deg, transparent, rgba(244,136,74,0.2), transparent)', animation:'shimmerMove 1.6s ease-in-out infinite' }} />
                  </div>
                  <div style={{ width:'30%', height:6, borderRadius:4, background:'rgba(255,255,255,0.04)' }} />
                </div>
                <div style={{ height:4, borderRadius:4, background:'rgba(255,255,255,0.04)', overflow:'hidden', position:'relative' }}>
                  <div style={{ position:'absolute', inset:0, background:'linear-gradient(90deg, transparent, rgba(244,136,74,0.15), transparent)', animation:'shimmerMove 1.4s ease-in-out .2s infinite' }} />
                </div>
              </div>
              {/* stage label */}
              <div style={{ padding:'0 16px 14px', display:'flex', alignItems:'center', gap:7, position:'relative', zIndex:1 }}>
                <div style={{ width:5, height:5, borderRadius:'50%', background:'#F4884A', animation:'ambientPulse 1s ease-in-out infinite', flexShrink:0 }} />
                <span style={{ fontSize:11, color:'rgba(244,136,74,0.7)', letterSpacing:'-0.01em', animation:'ambientPulse 2s ease-in-out infinite' }}>{genStage}</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* quick prompts */}
      {messages.length === 1 && (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', padding:'10px 0 12px', flexShrink:0 }}>
          {QUICK.map(q => (
            <button key={q} onClick={()=>send(q)} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, color:'rgba(255,255,255,0.45)', fontSize:11, padding:'6px 12px', cursor:'pointer', letterSpacing:'-0.01em', transition:'all .15s', fontFamily:'inherit' }}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor='rgba(244,136,74,0.3)';(e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.75)'}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='rgba(255,255,255,0.08)';(e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.45)'}}>
              {q}
            </button>
          ))}
        </div>
      )}

      {/* pending image preview */}
      {pendingImg && (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'rgba(244,136,74,0.06)', border:'1px solid rgba(244,136,74,0.15)', borderRadius:10, marginBottom:6, flexShrink:0 }}>
          <img src={pendingImg.preview} alt="" style={{ width:38, height:38, borderRadius:6, objectFit:'cover', flexShrink:0 }} />
          <span style={{ fontSize:11, color:'rgba(255,255,255,0.45)', flex:1 }}>Photo ready — add a note or send for analysis</span>
          <button onClick={()=>setPendingImg(null)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.25)', cursor:'pointer', fontSize:16, lineHeight:1, padding:'0 2px' }}>×</button>
        </div>
      )}

      {/* input bar */}
      <div style={{ display:'flex', gap:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.09)', borderRadius:14, padding:'10px 12px', alignItems:'flex-end', flexShrink:0 }}>
        <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f);e.target.value=''}} />
        <button onClick={()=>fileRef.current?.click()} title="Attach photo"
          style={{ width:32, height:32, borderRadius:8, background: pendingImg ? 'rgba(244,136,74,0.12)' : 'rgba(255,255,255,0.05)', border:`1px solid ${pendingImg?'rgba(244,136,74,0.3)':'rgba(255,255,255,0.08)'}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, transition:'all .15s' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={pendingImg?'#F4884A':'rgba(255,255,255,0.4)'} strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </button>
        <textarea value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()} }}
          placeholder="Ask about design, products, jobs, or attach a photo…"
          rows={1}
          style={{ flex:1, background:'none', border:'none', outline:'none', resize:'none', color:'rgba(255,255,255,0.82)', fontSize:13, lineHeight:1.5, fontFamily:'inherit', overflowY:'hidden', minHeight:22 }}
          onInput={e=>{ const t=e.currentTarget; t.style.height='auto'; t.style.height=Math.min(t.scrollHeight,120)+'px' }} />
        <button onClick={()=>send()} disabled={(!input.trim()&&!pendingImg)||loading} style={{ background:(input.trim()||pendingImg)?'linear-gradient(135deg,#F4884A,#df6f28)':'rgba(255,255,255,0.08)', border:'none', borderRadius:9, width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:(input.trim()||pendingImg)?'pointer':'default', flexShrink:0, transition:'background .2s' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  )
}

// ── DESIGN VISION PANE (removed — merged into chat) ───
function AIDesignPane({ projects }: { projects: Project[] }) { return null }
function _AIDesignPaneOld({ projects }: { projects: Project[] }) {
  const [imageUrl, setImageUrl]     = useState('')
  const [imageB64, setImageB64]     = useState('')
  const [imageMime, setImageMime]   = useState('image/jpeg')
  const [style, setStyle]           = useState('warm-luxury')
  const [analysis, setAnalysis]     = useState<DesignAnalysis|null>(null)
  const [activeZones, setActiveZones] = useState<Set<string>>(new Set())
  const [view, setView]             = useState<'before'|'after'>('after')
  const [analyzing, setAnalyzing]   = useState(false)
  const [statusMsg, setStatusMsg]   = useState('')
  const [error, setError]           = useState('')
  const [input, setInput]           = useState('')
  const [showSavePicker, setShowSavePicker] = useState(false)
  const [savedTo, setSavedTo]       = useState('')
  const fileRef   = React.useRef<HTMLInputElement>(null)
  const dropRef   = React.useRef<HTMLDivElement>(null)
  const bottomRef = React.useRef<HTMLDivElement>(null)

  const DESIGN_PROMPTS = [
    'Analyse the lighting zones',
    'Warm luxury style',
    'Modern minimal style',
    'Soft natural style',
    'High contrast dramatic',
  ]

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = e => {
      const result = e.target?.result as string
      const img = new Image()
      img.onload = () => {
        const MAX = 1024
        const scale = Math.min(1, MAX / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
        const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
        const b64Full = canvas.toDataURL(mime)
        setImageUrl(b64Full); setImageB64(b64Full.split(',')[1]); setImageMime(mime)
        setAnalysis(null); setError('')
      }
      img.src = result
    }
    reader.readAsDataURL(file)
  }

  async function analyze(promptOverride?: string) {
    if (!imageB64) return
    const key = process.env.NEXT_PUBLIC_ANTHROPIC_KEY || ''
    if (!key || key.startsWith('REPLACE')) { setError('Add NEXT_PUBLIC_ANTHROPIC_KEY to use Design Vision.'); return }

    // pick style from prompt if user typed/clicked a style keyword
    const txt = (promptOverride || input || '').toLowerCase()
    if (txt.includes('warm')) setStyle('warm-luxury')
    else if (txt.includes('minimal') || txt.includes('modern')) setStyle('modern-minimal')
    else if (txt.includes('natural') || txt.includes('soft')) setStyle('soft-natural')
    else if (txt.includes('contrast') || txt.includes('dramatic')) setStyle('high-contrast')

    setInput(''); setAnalyzing(true); setError('')
    const msgs = ['Reading your yard…','Identifying lighting zones…','Building your design…','Calculating fixtures…']
    let mi = 0; setStatusMsg(msgs[0])
    const interval = setInterval(()=>{ mi=(mi+1)%msgs.length; setStatusMsg(msgs[mi]) }, 1800)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{ 'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true' },
        body: JSON.stringify({ model:'claude-opus-4-5', max_tokens:1200,
          messages:[{ role:'user', content:[
            { type:'image', source:{ type:'base64', media_type:imageMime, data:imageB64 } },
            { type:'text', text: DESIGN_PROMPT + (promptOverride||input ? `\n\nUser note: ${promptOverride||input}` : '') },
          ]}],
        }),
      })
      const data = await res.json()
      let text = data.content?.[0]?.text || ''
      text = text.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim()
      const parsed: DesignAnalysis = JSON.parse(text)
      setAnalysis(parsed); setActiveZones(new Set(parsed.zones.map(z=>z.id))); setView('after')
    } catch(e:any) {
      setError('Analysis failed — '+(e.message||'unknown error'))
    } finally { clearInterval(interval); setAnalyzing(false) }
    setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:'smooth'}), 100)
  }

  function toggleZone(id: string) {
    setActiveZones(prev=>{ const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n })
  }

  const glow = STYLE_GLOW[style]

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>

      {/* scrollable results area */}
      <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:14, paddingRight:4, paddingBottom:4 }}>

        {/* photo drop zone — always visible, compact when image loaded */}
        <div ref={dropRef}
          onClick={()=>fileRef.current?.click()}
          onDragOver={e=>{e.preventDefault();if(dropRef.current)(dropRef.current as HTMLElement).style.borderColor='rgba(244,136,74,0.5)'}}
          onDragLeave={()=>{if(dropRef.current)(dropRef.current as HTMLElement).style.borderColor=imageUrl?'rgba(255,255,255,0.06)':'rgba(255,255,255,0.1)'}}
          onDrop={e=>{e.preventDefault();if(dropRef.current)(dropRef.current as HTMLElement).style.borderColor='rgba(255,255,255,0.06)';const f=e.dataTransfer.files[0];if(f)handleFile(f)}}
          style={{ position:'relative', borderRadius:14, border:`1.5px dashed ${imageUrl?'rgba(255,255,255,0.06)':'rgba(255,255,255,0.1)'}`, cursor:'pointer', overflow:'hidden', transition:'border-color .15s', flexShrink:0 }}>
          {imageUrl ? (
            <>
              <img src={imageUrl} style={{ width:'100%', maxHeight:320, objectFit:'cover', display:'block', filter:view==='after'?`${STYLE_FILTER[style]} saturate(1.1)`:'none', transition:'filter .4s ease' }} alt="" />
              {/* before/after */}
              <div style={{ position:'absolute', top:10, left:10, display:'flex', gap:2, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(12px)', borderRadius:8, padding:3 }}>
                {(['before','after'] as const).map(v=>(
                  <button key={v} onClick={e=>{e.stopPropagation();setView(v)}} style={{ padding:'4px 11px', borderRadius:6, border:'none', background:view===v?'rgba(244,136,74,0.25)':'transparent', color:view===v?'#F4884A':'rgba(255,255,255,0.4)', fontSize:11, fontWeight:600, cursor:'pointer', textTransform:'capitalize', transition:'all .15s' }}>{v}</button>
                ))}
              </div>
              {/* style dots */}
              <div style={{ position:'absolute', top:10, right:44, display:'flex', gap:5 }}>
                {DESIGN_STYLES.map(s=>(
                  <div key={s.id} onClick={e=>{e.stopPropagation();setStyle(s.id);if(analysis)setView('after')}} title={s.label}
                    style={{ width:13,height:13,borderRadius:'50%',background:s.color,cursor:'pointer',border:`2px solid ${style===s.id?'#fff':'transparent'}`,transition:'border .15s',boxShadow:style===s.id?`0 0 8px ${s.color}`:'none' }} />
                ))}
              </div>
              <button onClick={e=>{e.stopPropagation();fileRef.current?.click()}} style={{ position:'absolute', top:10, right:10, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(8px)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:7, color:'rgba(255,255,255,0.6)', fontSize:10, padding:'4px 8px', cursor:'pointer' }}>↑</button>
              {/* zone overlays */}
              {view==='after' && analysis && analysis.zones.filter(z=>activeZones.has(z.id)).map(z=>(
                <div key={z.id} style={{ position:'absolute', left:`${z.x}%`, top:`${z.y}%`, transform:'translate(-50%,-50%)', width:`${z.radius*2}%`, aspectRatio:'1', borderRadius:'50%', background:`radial-gradient(circle,${glow.color}${Math.round(glow.opacity*255).toString(16).padStart(2,'0')} 0%,${glow.color}33 45%,transparent 72%)`, pointerEvents:'none', mixBlendMode:'screen', filter:`blur(${z.radius*0.3}px)` }} />
              ))}
              {/* zone pins */}
              {view==='after' && analysis && analysis.zones.map(z=>{
                const c=ZONE_COLORS[z.type]||'#F4884A'; const on=activeZones.has(z.id)
                return (
                  <button key={z.id} onClick={e=>{e.stopPropagation();toggleZone(z.id)}} title={z.name}
                    style={{ position:'absolute', left:`${z.x}%`, top:`${z.y}%`, transform:'translate(-50%,-50%)', width:20,height:20,borderRadius:'50%',border:`1.5px solid ${on?c:'rgba(255,255,255,0.25)'}`,background:on?`${c}30`:'rgba(0,0,0,0.45)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)',transition:'all .15s',boxShadow:on?`0 0 10px ${c}60`:'none' }}>
                    <div style={{ width:5,height:5,borderRadius:'50%',background:on?c:'rgba(255,255,255,0.4)',transition:'background .15s' }} />
                  </button>
                )
              })}
            </>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, padding:'36px 20px' }}>
              <div style={{ width:44,height:44,borderRadius:12,background:'rgba(244,136,74,0.07)',border:'1px solid rgba(244,136,74,0.14)',display:'flex',alignItems:'center',justifyContent:'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(244,136,74,0.6)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              </div>
              <div style={{ fontSize:13,fontWeight:500,color:'rgba(255,255,255,0.45)',letterSpacing:'-0.01em' }}>Drop a yard photo to get started</div>
              <div style={{ fontSize:11,color:'rgba(255,255,255,0.18)' }}>JPG · PNG · HEIC</div>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f)}} />

        {/* analyzing spinner */}
        {analyzing && (
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12 }}>
            <div style={{ width:18,height:18,flexShrink:0,position:'relative' }}>
              <div style={{ position:'absolute',inset:0,borderRadius:'50%',border:'1.5px solid rgba(244,136,74,0.15)',borderTopColor:'#F4884A',animation:'spin .9s linear infinite' }} />
            </div>
            <span style={{ fontSize:12,color:'rgba(255,255,255,0.45)',animation:'ambientPulse 2s ease-in-out infinite' }}>{statusMsg}</span>
          </div>
        )}

        {/* results */}
        {analysis && !analyzing && (
          <>
            {/* design notes */}
            {analysis.summary.designNotes && (
              <div style={{ background:'rgba(244,136,74,0.05)',border:'1px solid rgba(244,136,74,0.12)',borderRadius:12,padding:'12px 15px' }}>
                <div style={{ fontSize:9,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(244,136,74,0.5)',marginBottom:5 }}>Design Notes</div>
                <div style={{ fontSize:12,color:'rgba(255,255,255,0.65)',lineHeight:1.65 }}>{analysis.summary.designNotes}</div>
              </div>
            )}
            {/* zones + metrics */}
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
              <div style={{ display:'flex',flexDirection:'column',gap:5 }}>
                <div style={{ fontSize:9,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(255,255,255,0.2)',marginBottom:2 }}>Zones</div>
                {analysis.zones.map(z=>{
                  const c=ZONE_COLORS[z.type]||'#F4884A'; const on=activeZones.has(z.id)
                  return (
                    <button key={z.id} onClick={()=>toggleZone(z.id)} style={{ display:'flex',alignItems:'flex-start',gap:9,padding:'9px 11px',background:on?'rgba(255,255,255,0.04)':'transparent',border:`1px solid ${on?'rgba(255,255,255,0.08)':'rgba(255,255,255,0.04)'}`,borderRadius:9,cursor:'pointer',textAlign:'left',transition:'all .12s' }}>
                      <div style={{ width:7,height:7,borderRadius:'50%',background:on?c:'rgba(255,255,255,0.18)',flexShrink:0,marginTop:3,boxShadow:on?`0 0 6px ${c}`:'none',transition:'all .12s' }} />
                      <div><div style={{ fontSize:11,fontWeight:600,color:on?'rgba(255,255,255,0.85)':'rgba(255,255,255,0.4)',letterSpacing:'-0.01em' }}>{z.name}</div><div style={{ fontSize:10,color:'rgba(255,255,255,0.22)',marginTop:1 }}>{z.qty} · {z.qty*z.wattage}W</div></div>
                    </button>
                  )
                })}
              </div>
              <div style={{ display:'flex',flexDirection:'column',gap:5 }}>
                <div style={{ fontSize:9,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(255,255,255,0.2)',marginBottom:2 }}>Summary</div>
                {[
                  {label:'Fixtures',    value:analysis.summary.totalFixtures},
                  {label:'Wattage',     value:`${analysis.summary.totalWattage}W`},
                  {label:'Transformer', value:analysis.summary.transformerSize},
                  {label:'Wire',        value:analysis.summary.wireEstimate},
                  {label:'Difficulty',  value:analysis.summary.difficulty},
                ].map(m=>(
                  <div key={m.label} style={{ background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:8,padding:'8px 11px',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                    <span style={{ fontSize:11,color:'rgba(255,255,255,0.28)' }}>{m.label}</span>
                    <span style={{ fontSize:12,fontWeight:600,color:'rgba(255,255,255,0.78)',letterSpacing:'-0.02em' }}>{m.value}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* save */}
            <div style={{ display:'flex',gap:8 }}>
              <button onClick={()=>{setAnalysis(null);setImageUrl('');setSavedTo('')}} style={{ flex:1,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.09)',borderRadius:10,color:'rgba(255,255,255,0.5)',fontSize:12,fontWeight:500,padding:10,cursor:'pointer' }}>New Photo</button>
              <button onClick={()=>setShowSavePicker(true)} style={{ flex:2,background:savedTo?'rgba(34,197,94,0.12)':'linear-gradient(135deg,#F4884A,#df6f28)',border:savedTo?'1px solid rgba(34,197,94,0.3)':'none',borderRadius:10,color:savedTo?'#22c55e':'#fff',fontSize:12,fontWeight:600,padding:10,cursor:'pointer',boxShadow:savedTo?'none':'0 0 16px rgba(244,136,74,0.25)',transition:'all .2s' }}>{savedTo?`✓ Saved to ${savedTo}`:'Save to Project'}</button>
            </div>
          </>
        )}

        {error && <div style={{ fontSize:12,color:'#f87171',background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.2)',borderRadius:8,padding:'10px 14px' }}>{error}</div>}
        <div ref={bottomRef} />
      </div>

      {/* prompt chips — shown when image loaded and no results yet */}
      {imageUrl && !analyzing && !analysis && (
        <div style={{ display:'flex',gap:6,flexWrap:'wrap',padding:'10px 0 12px',flexShrink:0 }}>
          {DESIGN_PROMPTS.map(q=>(
            <button key={q} onClick={()=>analyze(q)} style={{ background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:8,color:'rgba(255,255,255,0.45)',fontSize:11,padding:'6px 12px',cursor:'pointer',letterSpacing:'-0.01em',transition:'all .15s',fontFamily:'inherit' }}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor='rgba(244,136,74,0.3)';(e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.75)'}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='rgba(255,255,255,0.08)';(e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.45)'}}>
              {q}
            </button>
          ))}
        </div>
      )}

      {/* input bar */}
      <div style={{ display:'flex',gap:10,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.09)',borderRadius:14,padding:'10px 12px',alignItems:'flex-end',flexShrink:0 }}>
        {/* photo attach button */}
        <button onClick={()=>fileRef.current?.click()} title="Attach photo" style={{ width:34,height:34,borderRadius:9,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,transition:'border-color .15s' }}
          onMouseEnter={e=>(e.currentTarget.style.borderColor='rgba(244,136,74,0.3)')} onMouseLeave={e=>(e.currentTarget.style.borderColor='rgba(255,255,255,0.08)')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </button>
        <textarea value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(imageUrl)analyze()}}}
          placeholder={imageUrl?'Describe the style or ask for changes…':'Upload a photo first, then describe what you want'}
          rows={1}
          style={{ flex:1,background:'none',border:'none',outline:'none',resize:'none',color:'rgba(255,255,255,0.82)',fontSize:13,lineHeight:1.5,fontFamily:'inherit',overflowY:'hidden',minHeight:22 }}
          onInput={e=>{const t=e.currentTarget;t.style.height='auto';t.style.height=Math.min(t.scrollHeight,120)+'px'}} />
        <button onClick={()=>{if(imageUrl)analyze()}} disabled={!imageUrl||analyzing} style={{ background:imageUrl&&!analyzing?'linear-gradient(135deg,#F4884A,#df6f28)':'rgba(255,255,255,0.08)',border:'none',borderRadius:9,width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',cursor:imageUrl&&!analyzing?'pointer':'default',flexShrink:0,transition:'background .2s' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>

      {/* save picker */}
      {showSavePicker && createPortal(
        <div onClick={()=>setShowSavePicker(false)} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',backdropFilter:'blur(6px)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#1c1917',border:'1px solid rgba(255,255,255,0.08)',borderRadius:16,padding:24,width:'100%',maxWidth:400,maxHeight:'80vh',overflowY:'auto',boxShadow:'0 24px 60px rgba(0,0,0,0.6)' }}>
            <div style={{ fontWeight:700,fontSize:15,color:'rgba(255,255,255,0.9)',marginBottom:4 }}>Save to Project</div>
            <div style={{ fontSize:11,color:'rgba(255,255,255,0.3)',marginBottom:18 }}>Choose which project to attach this design to.</div>
            {projects.length===0&&<div style={{ fontSize:13,color:'rgba(255,255,255,0.3)',textAlign:'center',padding:'20px 0' }}>No projects yet.</div>}
            <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
              {projects.map(p=>{
                const label=p.homeowner||p.name||p.id
                return (
                  <button key={p.id} onClick={()=>{localStorage.setItem(`upscape_design_${p.id}`,JSON.stringify({style,analysis,imageUrl,savedAt:new Date().toISOString()}));setSavedTo(label);setShowSavePicker(false)}}
                    style={{ display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:10,cursor:'pointer',textAlign:'left',transition:'border-color .15s' }}
                    onMouseEnter={e=>(e.currentTarget.style.borderColor='rgba(244,136,74,0.4)')} onMouseLeave={e=>(e.currentTarget.style.borderColor='rgba(255,255,255,0.07)')}>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:12,fontWeight:600,color:'rgba(255,255,255,0.85)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{label}</div>
                      {p.address&&<div style={{ fontSize:10,color:'rgba(255,255,255,0.28)',marginTop:1 }}>{p.address}</div>}
                    </div>
                    <div style={{ marginLeft:'auto',fontSize:9,fontWeight:700,color:STATUS_COLOR[p.status]||'#6b7280',textTransform:'uppercase',letterSpacing:'0.06em',flexShrink:0 }}>{p.status}</div>
                  </button>
                )
              })}
            </div>
            <button onClick={()=>setShowSavePicker(false)} style={{ marginTop:14,width:'100%',background:'transparent',border:'1px solid rgba(255,255,255,0.07)',borderRadius:8,color:'rgba(255,255,255,0.3)',fontSize:12,padding:'9px',cursor:'pointer' }}>Cancel</button>
          </div>
        </div>,
        document.body
      )}
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
                {
                  id:'dawn', label:'Dawn', dot:'#c084fc',
                  skyGrad:'linear-gradient(180deg,#1a0a2e 0%,#3d1f5c 35%,#7b3f6e 65%,#c47a8a 85%,#e8a87c 100%)',
                  mtFill:'#150820cc',
                  icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><line x1="4" y1="17" x2="20" y2="17" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.6"/><path d="M12 17 A5 5 0 0 1 7 17" stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round"/><path d="M12 17 A5 5 0 0 0 17 17" stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round"/><line x1="12" y1="9" x2="12" y2="7" stroke="white" strokeWidth="1.4" strokeLinecap="round"/><line x1="7.8" y1="11.2" x2="6.4" y2="9.8" stroke="white" strokeWidth="1.2" strokeLinecap="round"/><line x1="16.2" y1="11.2" x2="17.6" y2="9.8" stroke="white" strokeWidth="1.2" strokeLinecap="round"/></svg>,
                },
                {
                  id:'day', label:'Day', dot:'#fde047',
                  skyGrad:'linear-gradient(180deg,#0d3b6e 0%,#1565c0 30%,#1e88e5 60%,#64b5f6 85%,#bbdefb 100%)',
                  mtFill:'#0a2540cc',
                  icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="11" r="4" stroke="white" strokeWidth="1.4"/><line x1="12" y1="3" x2="12" y2="5" stroke="white" strokeWidth="1.4" strokeLinecap="round"/><line x1="12" y1="17" x2="12" y2="19" stroke="white" strokeWidth="1.4" strokeLinecap="round"/><line x1="4" y1="11" x2="6" y2="11" stroke="white" strokeWidth="1.4" strokeLinecap="round"/><line x1="18" y1="11" x2="20" y2="11" stroke="white" strokeWidth="1.4" strokeLinecap="round"/><line x1="6.3" y1="5.3" x2="7.7" y2="6.7" stroke="white" strokeWidth="1.2" strokeLinecap="round"/><line x1="17.7" y1="5.3" x2="16.3" y2="6.7" stroke="white" strokeWidth="1.2" strokeLinecap="round"/></svg>,
                },
                {
                  id:'dusk', label:'Dusk', dot:'#fb923c',
                  skyGrad:'linear-gradient(180deg,#1a0a00 0%,#5c2200 25%,#b84400 50%,#e8720a 72%,#f5a623 88%,#fdd87a 100%)',
                  mtFill:'#150800cc',
                  icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><line x1="4" y1="17" x2="20" y2="17" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.6"/><path d="M12 17 A4.5 4.5 0 0 1 7.5 17" stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round"/><path d="M12 17 A4.5 4.5 0 0 0 16.5 17" stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round"/><line x1="4.5" y1="14" x2="6" y2="14" stroke="white" strokeWidth="1.2" strokeLinecap="round"/><line x1="18" y1="14" x2="19.5" y2="14" stroke="white" strokeWidth="1.2" strokeLinecap="round"/></svg>,
                },
                {
                  id:'night', label:'Night', dot:'#60a5fa',
                  skyGrad:'linear-gradient(180deg,#000005 0%,#050a1a 30%,#0a1535 60%,#0f1f4a 80%,#162454 100%)',
                  mtFill:'#03060fcc',
                  icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 13.5A8.5 8.5 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5z" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><circle cx="17.5" cy="5.5" r="0.8" fill="white"/><circle cx="20" cy="9" r="0.55" fill="white"/></svg>,
                },
              ].map(opt => {
                const isActive = mapTime === opt.id
                return (
                  <div key={opt.id} onClick={() => pickMapTime(opt.id)} style={{
                    borderRadius:11, overflow:'hidden', cursor:'pointer', position:'relative',
                    outline: isActive ? `2px solid ${opt.dot}` : '2px solid transparent',
                    outlineOffset:'-2px',
                    boxShadow: isActive ? `0 0 12px ${opt.dot}55` : 'none',
                    transition:'outline-color .18s,box-shadow .18s',
                  }}>
                    {/* sky */}
                    <div style={{ height:72, background:opt.skyGrad, position:'relative' }}>
                      {/* icon */}
                      <div style={{ position:'absolute',top:10,left:0,right:0,display:'flex',alignItems:'center',justifyContent:'center',filter:'drop-shadow(0 1px 3px rgba(0,0,0,0.7))' }}>
                        {opt.icon}
                      </div>
                      {/* mountains */}
                      <div style={{ position:'absolute',bottom:12,left:0,right:0 }}>
                        <svg width="100%" height="22" viewBox="0 0 80 22" preserveAspectRatio="none">
                          <path d="M0 22 L0 14 L10 7 L18 12 L26 4 L34 10 L42 2 L50 9 L58 5 L66 11 L74 7 L80 12 L80 22 Z" fill={opt.mtFill}/>
                        </svg>
                      </div>
                      {/* bottom fade for label */}
                      <div style={{ position:'absolute',bottom:0,left:0,right:0,height:18,background:'linear-gradient(0deg,rgba(0,0,0,0.65) 0%,transparent 100%)' }} />
                      {/* checkmark */}
                      {isActive && (
                        <div style={{ position:'absolute',top:5,right:5,width:15,height:15,borderRadius:'50%',background:opt.dot,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 1px 4px rgba(0,0,0,0.4)' }}>
                          <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      )}
                    </div>
                    {/* label row */}
                    <div style={{ padding:'6px 8px',display:'flex',alignItems:'center',gap:5,background:L?'#fff':'rgba(10,10,14,0.85)' }}>
                      <div style={{ width:6,height:6,borderRadius:'50%',background:opt.dot,flexShrink:0,boxShadow:isActive?`0 0 6px ${opt.dot}`:'none' }} />
                      <span style={{ fontSize:11,fontWeight:isActive?600:400,color:isActive?txt:muted,letterSpacing:'-0.01em' }}>{opt.label}</span>
                    </div>
                  </div>
                )
              })}
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

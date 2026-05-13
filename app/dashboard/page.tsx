'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Project } from '@/lib/supabase'

const STATUS_LABEL: Record<string, string> = { draft: 'Draft', quoted: 'Quoted', approved: 'Approved', installed: 'Installed' }
const STATUS_COLOR: Record<string, string> = { draft: '#6b7280', quoted: '#3b82f6', approved: '#22c55e', installed: '#a78bfa' }
const STATUS_OPTS = ['all', 'draft', 'quoted', 'approved', 'installed'] as const

export default function DashboardPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_OPTS[number]>('all')

  useEffect(() => {
    fetchProjects()
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return projects.filter(p => {
      const matchStatus = statusFilter === 'all' || p.status === statusFilter
      const matchSearch = !q || (p.homeowner || '').toLowerCase().includes(q) || (p.address || '').toLowerCase().includes(q) || (p.name || '').toLowerCase().includes(q)
      return matchStatus && matchSearch
    })
  }, [projects, search, statusFilter])

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100dvh' }}>
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontWeight: 700, letterSpacing: '0.1em', fontSize: 16 }}>UPSCAPE</span>
        <span style={{ flex: 1 }} />
        <button onClick={logout} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13 }}>Sign out</button>
      </header>

      <div style={{ padding: '20px 20px 10px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Projects</h1>
        <span style={{ background: 'var(--surface2)', borderRadius: 20, fontSize: 12, fontWeight: 600, padding: '2px 10px', color: 'var(--muted)' }}>{filtered.length}</span>
        <span style={{ flex: 1 }} />
        <button
          onClick={() => router.push('/projects/new')}
          style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, fontSize: 14, padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> New
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '0 20px 10px' }}>
        <div style={{ position: 'relative' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search homeowner, address…"
            style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text)', fontSize: 14, padding: '9px 12px 9px 32px', outline: 'none' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 2 }}>✕</button>
          )}
        </div>
      </div>

      {/* Status filter chips */}
      <div style={{ padding: '0 20px 14px', display: 'flex', gap: 7, overflowX: 'auto' }}>
        {STATUS_OPTS.map(s => {
          const active = statusFilter === s
          const color = s === 'all' ? 'var(--accent)' : STATUS_COLOR[s]
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 20, border: `1px solid ${active ? color : 'var(--border)'}`, background: active ? color + '22' : 'var(--surface)', color: active ? color : 'var(--muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s' }}
            >
              {s === 'all' ? 'All' : STATUS_LABEL[s]}
            </button>
          )
        })}
      </div>

      <div style={{ padding: '0 20px 80px' }}>
        {loading && <p style={{ color: 'var(--muted)', textAlign: 'center', paddingTop: 40 }}>Loading…</p>}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 60, color: 'var(--muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✦</div>
            <p style={{ fontWeight: 600, color: 'var(--text)' }}>{projects.length === 0 ? 'No projects yet' : 'No matches'}</p>
            <p style={{ fontSize: 14 }}>{projects.length === 0 ? 'Tap New above to start your first project' : 'Try a different search or filter'}</p>
          </div>
        )}
        {filtered.map(p => {
          const fixtureCount = (p.markers || []).filter(m => m.type !== 'power').length
          return (
            <div
              key={p.id}
              onClick={() => router.push(`/projects/${p.id}/map`)}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px', marginBottom: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.homeowner || p.name}</div>
                <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.address}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>{fixtureCount} fixture{fixtureCount !== 1 ? 's' : ''} · {fmt(p.created_at)}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                <span style={{ background: STATUS_COLOR[p.status] + '22', color: STATUS_COLOR[p.status], borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '3px 8px' }}>{STATUS_LABEL[p.status] || 'Draft'}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {confirmDelete === p.id ? (
                    <>
                      <button
                        onClick={e => { e.stopPropagation(); deleteProject(p.id) }}
                        style={{ background: '#ef444422', border: '1px solid #ef4444', borderRadius: 6, color: '#ef4444', fontSize: 12, fontWeight: 600, padding: '3px 10px', cursor: 'pointer' }}
                      >Delete</button>
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDelete(null) }}
                        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--muted)', fontSize: 12, padding: '3px 8px', cursor: 'pointer' }}
                      >Cancel</button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDelete(p.id) }}
                        style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 17, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
                      >🗑</button>
                      <span style={{ color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>›</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { supabase, type Project, type Marker, type Wire, type Zone } from '@/lib/supabase'
import { FIXTURES, type FixtureType } from '@/lib/catalog'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

const TOOLS = [
  { id: 'uplight', label: 'Uplight', icon: UpIcon    },
  { id: 'path',    label: 'Path',    icon: PathIcon   },
  { id: 'flood',   label: 'Flood',   icon: FloodIcon  },
  { id: 'well',    label: 'Well',    icon: WellIcon   },
  { id: 'power',   label: 'Power',   icon: PowerIcon  },
  { id: 'wire',    label: 'Wire',    icon: WireIcon   },
  { id: 'select',  label: 'Select',  icon: SelectIcon },
] as const

type ToolId = typeof TOOLS[number]['id']

const FIXTURE_COLORS: Record<string, string> = {
  uplight: '#F4884A', path: '#F5C842', flood: '#EF4444',
  well: '#3B82F6', power: '#9CA3AF',
}

function markerEl(type: string) {
  const color = FIXTURE_COLORS[type] || '#F4884A'
  // Outer div: Mapbox owns the transform on this element — never touch it
  const el = document.createElement('div')
  el.style.cssText = `width:34px;height:34px;cursor:pointer;`

  // Inner div: we animate this one only
  const inner = document.createElement('div')
  inner.style.cssText = `
    width:34px;height:34px;border-radius:50%;
    background:${color};border:2.5px solid rgba(255,255,255,0.9);
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 0 0 3px ${color}44, 0 3px 10px rgba(0,0,0,0.6);
    transition:transform 0.15s;
  `
  inner.innerHTML = markerSVG(type)
  el.appendChild(inner)

  el.addEventListener('mouseenter', () => { inner.style.transform = 'scale(1.2)' })
  el.addEventListener('mouseleave', () => { inner.style.transform = 'scale(1)' })
  return el
}

function markerSVG(type: string) {
  const svgs: Record<string, string> = {
    uplight:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2l8 18H4z"/></svg>`,
    path:      `<svg width="12" height="12" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3" fill="${FIXTURE_COLORS.path}22"/></svg>`,
    flood:     `<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 3l10 18H2z"/><path d="M12 8l6 11H6z" fill="rgba(255,255,255,0.3)"/></svg>`,
    well:      `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4" fill="white"/></svg>`,
    downlight: `<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 22l8-18H4z"/></svg>`,
    hardscape: `<svg width="12" height="12" viewBox="0 0 24 24" fill="white"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`,
    power:     `<svg width="13" height="13" viewBox="0 0 24 24" fill="white"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
  }
  return svgs[type] || svgs.uplight
}

function addTerrain(map: mapboxgl.Map) {
  if (!map.getSource('mapbox-dem')) {
    map.addSource('mapbox-dem', {
      type: 'raster-dem',
      url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
      tileSize: 512,
      maxzoom: 14,
    })
  }
  map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 })
  map.setFog({ color: '#0f0f0f', 'high-color': '#1a1a2e', 'horizon-blend': 0.04 })
}

export default function MapClient({ projectId }: { projectId: string }) {
  const router = useRouter()
  const mapDiv = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map())
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [tool, setTool] = useState<ToolId>('select')
  const [night, setNight] = useState(false)
  const [popup, setPopup] = useState<Marker | null>(null)
  const [wirePoints, setWirePoints] = useState<[number, number][]>([])
  const wireRef = useRef<[number, number][]>([])

  useEffect(() => { wireRef.current = wirePoints }, [wirePoints])

  // Ghost cursor — scoped to the Mapbox canvas element only
  useEffect(() => {
    const isFixture = tool !== 'select' && tool !== 'wire'
    if (!isFixture) { setGhostPos(null); return }

    // Use the canvas directly so UI overlays (toolbar, topbar) never trigger it
    function getCanvas() { return mapDiv.current?.querySelector('canvas') as HTMLCanvasElement | null }

    function onMove(e: MouseEvent) {
      setGhostPos({ x: e.clientX, y: e.clientY })
    }
    function onLeave() { setGhostPos(null) }

    const canvas = getCanvas()
    if (canvas) {
      canvas.addEventListener('mousemove', onMove)
      canvas.addEventListener('mouseleave', onLeave)
    }

    return () => {
      const c = getCanvas()
      if (c) {
        c.removeEventListener('mousemove', onMove)
        c.removeEventListener('mouseleave', onLeave)
      }
      setGhostPos(null)
    }
  }, [tool])

  const loadProject = useCallback(async () => {
    const { data } = await supabase.from('projects').select('*').eq('id', projectId).single()
    if (!data) { router.replace('/dashboard'); return }
    setProject(data)
    return data as Project
  }, [projectId])

  useEffect(() => {
    loadProject().then(p => {
      if (!p || !mapDiv.current) return
      const map = new mapboxgl.Map({
        container: mapDiv.current,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: p.lng && p.lat ? [p.lng, p.lat] : [-73.9857, 40.7484],
        zoom: p.lng ? 18.5 : 13,
        pitch: 45,
        bearing: -10,
      })
      mapRef.current = map

      map.on('error', (e) => {
        console.error('Mapbox error:', e)
        if (e.error?.message?.includes('401') || e.error?.message?.includes('Unauthorized')) {
          setMapError('Invalid Mapbox token. Check NEXT_PUBLIC_MAPBOX_TOKEN in Vercel environment variables.')
        }
      })

      map.on('load', () => {
        addTerrain(map)

        map.addSource('wires', { type: 'geojson', data: wiresToGeoJSON(p.wires || []) })
        map.addLayer({ id: 'wires-line', type: 'line', source: 'wires', paint: { 'line-color': '#facc15', 'line-width': 2.5, 'line-dasharray': [5, 3] } })

        // Live wire preview while drawing
        map.addSource('wire-preview', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({ id: 'wire-preview-line', type: 'line', source: 'wire-preview', paint: { 'line-color': '#facc15', 'line-width': 2, 'line-opacity': 0.6, 'line-dasharray': [3, 2] } })

        map.addSource('zones', { type: 'geojson', data: zonesToGeoJSON(p.zones || []) })
        map.addLayer({ id: 'zones-fill', type: 'fill', source: 'zones', paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.12 } })
        map.addLayer({ id: 'zones-line', type: 'line', source: 'zones', paint: { 'line-color': '#3b82f6', 'line-width': 1.5 } })

        for (const m of p.markers || []) addMarkerToMap(map, m)

        // Update wire preview on mousemove
        map.on('mousemove', e => {
          const currentTool = (window as any).__upscapeTool as ToolId
          if (currentTool !== 'wire') {
            ;(map.getSource('wire-preview') as mapboxgl.GeoJSONSource)?.setData({ type: 'FeatureCollection', features: [] })
            return
          }
          const pts = wireRef.current
          if (pts.length === 0) return
          const cursor: [number, number] = [e.lngLat.lng, e.lngLat.lat]
          const previewPts = [...pts, cursor]
          ;(map.getSource('wire-preview') as mapboxgl.GeoJSONSource)?.setData({
            type: 'FeatureCollection',
            features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: previewPts }, properties: {} }],
          })
        })

        map.on('click', e => {
          const currentTool = (window as any).__upscapeTool as ToolId
          if (!currentTool || currentTool === 'select') return
          if (currentTool === 'wire') {
            const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat]
            const next = [...wireRef.current, pt]
            wireRef.current = next
            setWirePoints([...next])
            return
          }
          placeMarker(map, currentTool as FixtureType, e.lngLat.lat, e.lngLat.lng)
        })
      })
    })
    return () => { mapRef.current?.remove() }
  }, [])

  function addMarkerToMap(map: mapboxgl.Map, m: Marker) {
    const el = markerEl(m.type)
    const mb = new mapboxgl.Marker({ element: el, draggable: true })
      .setLngLat([m.lng, m.lat])
      .addTo(map)

    el.addEventListener('click', (e) => { e.stopPropagation(); setPopup({ ...m }) })

    mb.on('dragend', async () => {
      const ll = mb.getLngLat()
      const { data: proj } = await supabase.from('projects').select('markers').eq('id', projectId).single()
      if (!proj) return
      const markers = (proj.markers as Marker[]).map(x => x.id === m.id ? { ...x, lat: ll.lat, lng: ll.lng } : x)
      await supabase.from('projects').update({ markers }).eq('id', projectId)
      m.lat = ll.lat; m.lng = ll.lng
    })

    markersRef.current.set(m.id, mb)
  }

  function placeMarker(map: mapboxgl.Map, type: FixtureType, lat: number, lng: number) {
    const id = crypto.randomUUID()
    const marker: Marker = { id, type, lat, lng, qty: 1, label: '', notes: '' }
    // Instant: add to map and state immediately
    addMarkerToMap(map, marker)
    setProject(p => {
      if (!p) return p
      const markers = [...p.markers, marker]
      // Persist in background — no await
      supabase.from('projects').update({ markers }).eq('id', projectId)
      return { ...p, markers }
    })
  }

  async function finishWire() {
    const pts = wireRef.current
    if (pts.length < 2) { setWirePoints([]); wireRef.current = []; return }
    const feet = calcWireFeet(pts)
    const wire: Wire = { id: crypto.randomUUID(), points: pts, feet }
    const { data: proj } = await supabase.from('projects').select('wires').eq('id', projectId).single()
    if (!proj) return
    const wires = [...(proj.wires as Wire[]), wire]
    await supabase.from('projects').update({ wires }).eq('id', projectId)
    ;(mapRef.current!.getSource('wires') as mapboxgl.GeoJSONSource).setData(wiresToGeoJSON(wires))
    setWirePoints([]); wireRef.current = []
    setProject(p => p ? { ...p, wires } : p)
  }

  async function savePopup(updated: Marker) {
    const { data: proj } = await supabase.from('projects').select('markers').eq('id', projectId).single()
    if (!proj) return
    const markers = (proj.markers as Marker[]).map(m => m.id === updated.id ? updated : m)
    await supabase.from('projects').update({ markers }).eq('id', projectId)
    setProject(p => p ? { ...p, markers } : p)
    setPopup(null)
  }

  async function deleteMarker(id: string) {
    markersRef.current.get(id)?.remove()
    markersRef.current.delete(id)
    const { data: proj } = await supabase.from('projects').select('markers').eq('id', projectId).single()
    if (!proj) return
    const markers = (proj.markers as Marker[]).filter(m => m.id !== id)
    await supabase.from('projects').update({ markers }).eq('id', projectId)
    setProject(p => p ? { ...p, markers } : p)
    setPopup(null)
  }

  function setToolAndSync(t: ToolId) {
    setTool(t)
    ;(window as any).__upscapeTool = t
    if (t !== 'wire') { setWirePoints([]); wireRef.current = [] }
  }

  useEffect(() => { (window as any).__upscapeTool = tool }, [tool])

  function toggleNight() {
    const map = mapRef.current
    if (!map) return
    const next = !night
    setNight(next)
    map.setStyle(next ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/satellite-streets-v12')
    map.once('style.load', () => {
      addTerrain(map)
      const p = project
      if (!p) return
      map.addSource('wires', { type: 'geojson', data: wiresToGeoJSON(p.wires || []) })
      map.addLayer({ id: 'wires-line', type: 'line', source: 'wires', paint: { 'line-color': '#facc15', 'line-width': 2.5, 'line-dasharray': [5, 3] } })
      map.addSource('zones', { type: 'geojson', data: zonesToGeoJSON(p.zones || []) })
      map.addLayer({ id: 'zones-fill', type: 'fill', source: 'zones', paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.12 } })
      map.addLayer({ id: 'zones-line', type: 'line', source: 'zones', paint: { 'line-color': '#3b82f6', 'line-width': 1.5 } })
      markersRef.current.forEach(mb => mb.addTo(map))
    })
  }


  const ghostColor = FIXTURE_COLORS[tool] || '#F4884A'

  return (
    <div style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden' }}>
      <div ref={mapDiv} style={{ position: 'absolute', inset: 0 }} />

      {/* loading overlay — shown until project loads, sits above map */}
      {!project && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: '#888' }}>
            <div style={{ width: 36, height: 36, border: '3px solid #F4884A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            Loading…
          </div>
        </div>
      )}

      {/* ghost cursor overlay — lives outside the Mapbox container */}
      {ghostPos && tool !== 'select' && tool !== 'wire' && (
        <div style={{
          position: 'fixed', pointerEvents: 'none', zIndex: 15,
          left: ghostPos.x, top: ghostPos.y,
          transform: 'translate(-50%, -50%)',
        }}>
          <style>{`
            @keyframes ghost-pulse {
              0%, 100% { box-shadow: 0 0 0 4px ${ghostColor}22, 0 0 16px ${ghostColor}44; }
              50%       { box-shadow: 0 0 0 12px ${ghostColor}11, 0 0 28px ${ghostColor}66; }
            }
          `}</style>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: `${ghostColor}22`,
            border: `2px dashed ${ghostColor}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'ghost-pulse 1s ease-in-out infinite',
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: ghostColor, border: '2.5px solid rgba(255,255,255,0.85)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
            }} dangerouslySetInnerHTML={{ __html: markerSVG(tool) }} />
          </div>
        </div>
      )}

      {/* map error overlay */}
      {mapError && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ textAlign: 'center', color: '#f0f0f0', maxWidth: 340 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Map failed to load</p>
            <p style={{ color: '#888', fontSize: 13, lineHeight: 1.6 }}>{mapError}</p>
          </div>
        </div>
      )}

      {/* topbar */}
      <header style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0) 100%)',
        padding: '14px 16px 32px 12px',
        display: 'flex', alignItems: 'flex-start', gap: 8,
      }}>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg) } }
          .upscape-back:hover { opacity: 1 !important; transform: translateY(-1px); }
          .upscape-back { transition: opacity 0.2s, transform 0.2s; }
          .upscape-night:hover { opacity: 1 !important; }
          .upscape-night { transition: opacity 0.2s; }
          .upscape-quote:hover { background: #b8864a !important; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.4) !important; }
          .upscape-quote { transition: background 0.2s, transform 0.2s, box-shadow 0.2s; }
          .upscape-tool:hover { opacity: 1 !important; transform: translateY(-1px); }
        `}</style>
        <button className="upscape-back" onClick={() => router.push('/dashboard')} style={{
          opacity: 0.55, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(12px)',
          border: 'none', borderRadius: 8, color: '#fff', fontSize: 17,
          cursor: 'pointer', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
        }}>‹</button>
        <div style={{
          flex: 1, minWidth: 0, background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(14px)',
          borderRadius: 8, padding: '7px 13px',
          boxShadow: '0 2px 16px rgba(0,0,0,0.25)',
        }}>
          <div style={{ fontWeight: 500, fontSize: 13, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'rgba(255,255,255,0.92)' }}>{project?.homeowner || project?.name}</div>
          <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 10, letterSpacing: '0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{project?.address}</div>
        </div>
        <button className="upscape-night" onClick={toggleNight} style={{
          opacity: night ? 0.9 : 0.45, background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(12px)',
          border: 'none', borderRadius: 8, color: night ? '#e8c97a' : 'rgba(255,255,255,0.8)',
          fontSize: 15, cursor: 'pointer', width: 34, height: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
        }}>☽</button>
        <button className="upscape-quote" onClick={() => router.push(`/projects/${projectId}/quote`)} style={{
          background: '#9a7040', border: 'none', borderRadius: 8,
          color: 'rgba(255,255,255,0.92)', fontWeight: 500, fontSize: 12,
          letterSpacing: '-0.01em', padding: '0 13px', height: 34,
          cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
          boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
        }}>Quote →</button>
      </header>

      {/* wire banner */}
      {tool === 'wire' && (
        <div style={{
          position: 'absolute', top: 62, left: 16, zIndex: 20,
          background: 'rgba(8,8,8,0.82)', backdropFilter: 'blur(16px)',
          borderRadius: 8, padding: '8px 14px',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}>
          <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '-0.01em', color: 'rgba(255,255,255,0.55)' }}>
            {wirePoints.length < 2 ? 'tap to place wire points' : `${wirePoints.length} pts · ${calcWireFeet(wirePoints).toFixed(0)} ft`}
          </span>
          <button onClick={finishWire} style={{ background: '#9a7040', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 500, padding: '5px 11px', cursor: 'pointer', letterSpacing: '-0.01em' }}>Done</button>
          <button onClick={() => { setWirePoints([]); wireRef.current = []; setToolAndSync('select') }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 11, padding: '5px 4px', cursor: 'pointer' }}>cancel</button>
        </div>
      )}

      {/* toolbar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
        background: 'linear-gradient(0deg, rgba(0,0,0,0.86) 0%, rgba(0,0,0,0) 100%)',
        paddingBottom: 'env(safe-area-inset-bottom, 6px)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, padding: '18px 16px 8px' }}>
          {TOOLS.map(t => {
            const isActive = tool === t.id
            const color = FIXTURE_COLORS[t.id] || '#666'
            const Icon = t.icon
            return (
              <button
                key={t.id}
                className="upscape-tool"
                onClick={() => setToolAndSync(t.id)}
                style={{
                  flex: 1, maxWidth: 52,
                  opacity: isActive ? 1 : 0.38,
                  background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                  backdropFilter: isActive ? 'blur(12px)' : 'none',
                  border: 'none',
                  borderRadius: 8, padding: '8px 2px 6px',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  boxShadow: isActive ? `0 0 12px ${color}33` : 'none',
                  transition: 'opacity 0.15s, transform 0.15s, background 0.15s',
                }}
              >
                <div style={{ color: isActive ? color : 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20 }}>
                  <Icon />
                </div>
                <span style={{ fontSize: 9, fontWeight: 500, color: isActive ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.55)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* marker popup */}
      {popup && <MarkerPopup marker={popup} onChange={setPopup} onSave={savePopup} onDelete={deleteMarker} />}
    </div>
  )
}

function MarkerPopup({ marker, onChange, onSave, onDelete }: {
  marker: Marker
  onChange: (m: Marker) => void
  onSave: (m: Marker) => void
  onDelete: (id: string) => void
}) {
  const color = FIXTURE_COLORS[marker.type] || '#9a7040'
  const fix = FIXTURES[marker.type as FixtureType]

  return (
    <div style={{
      position: 'absolute', bottom: 96, left: 14, right: 14, zIndex: 30,
      background: 'rgba(12,12,12,0.96)', backdropFilter: 'blur(24px)',
      borderRadius: 12,
      boxShadow: '0 12px 48px rgba(0,0,0,0.65), 0 1px 0 rgba(255,255,255,0.06) inset',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '13px 16px 11px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          dangerouslySetInnerHTML={{ __html: markerSVG(marker.type) }} />
        <span style={{ fontWeight: 500, fontSize: 13, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.88)' }}>{fix?.label || marker.type}</span>
        <button onClick={() => onSave(marker)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4, transition: 'color 0.15s' }}>✕</button>
      </div>
      <div style={{ padding: '13px 16px', display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <label style={labelSt}>Qty</label>
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: 7, overflow: 'hidden' }}>
            <button onClick={() => onChange({ ...marker, qty: Math.max(1, marker.qty - 1) })} style={{ width: 36, height: 34, background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 18, cursor: 'pointer' }}>−</button>
            <span style={{ fontSize: 15, fontWeight: 500, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.9)', minWidth: 28, textAlign: 'center' }}>{marker.qty}</span>
            <button onClick={() => onChange({ ...marker, qty: marker.qty + 1 })} style={{ width: 36, height: 34, background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 18, cursor: 'pointer' }}>+</button>
          </div>
        </div>
        <div>
          <label style={labelSt}>Label</label>
          <input style={inputSt} value={marker.label} onChange={e => onChange({ ...marker, label: e.target.value })} placeholder="e.g. Front oak tree" />
        </div>
        <div>
          <label style={labelSt}>Notes</label>
          <textarea style={{ ...inputSt, resize: 'none', height: 52 }} value={marker.notes} onChange={e => onChange({ ...marker, notes: e.target.value })} placeholder="Beam angle, color temp…" />
        </div>
      </div>
      <div style={{ padding: '0 16px 14px', display: 'flex', gap: 8 }}>
        <button onClick={() => onDelete(marker.id)} style={{ flex: 1, background: 'transparent', border: 'none', borderRadius: 8, color: 'rgba(239,68,68,0.6)', fontSize: 12, fontWeight: 500, padding: 11, cursor: 'pointer', letterSpacing: '-0.01em' }}>Remove</button>
        <button onClick={() => onSave(marker)} style={{ flex: 2, background: '#9a7040', border: 'none', borderRadius: 8, color: 'rgba(255,255,255,0.92)', fontSize: 12, fontWeight: 500, letterSpacing: '-0.01em', padding: 11, cursor: 'pointer' }}>Save</button>
      </div>
    </div>
  )
}

// SVG icon components
function UpIcon()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l9 18H3z"/></svg> }
function PathIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2"/></svg> }
function FloodIcon()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l10 20H2z"/><path d="M12 9l6 13H6z" fill="rgba(0,0,0,0.2)"/></svg> }
function WellIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/></svg> }
function PowerIcon()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> }
function WireIcon()   { return <svg width="18" height="16" viewBox="0 0 24 16" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 2"><path d="M2 8h20"/></svg> }
function SelectIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M4 2l16 10-8 2-4 8z"/></svg> }

// helpers
function wiresToGeoJSON(wires: Wire[]) {
  return { type: 'FeatureCollection' as const, features: wires.map(w => ({ type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: w.points }, properties: {} })) }
}
function zonesToGeoJSON(zones: Zone[]) {
  return { type: 'FeatureCollection' as const, features: zones.map(z => ({ type: 'Feature' as const, geometry: { type: 'Polygon' as const, coordinates: [z.points] }, properties: {} })) }
}
function calcWireFeet(pts: [number, number][]) {
  let feet = 0
  for (let i = 1; i < pts.length; i++) {
    const [lng1, lat1] = pts[i - 1], [lng2, lat2] = pts[i]
    const R = 20902231
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
    feet += 2 * R * Math.asin(Math.sqrt(a))
  }
  return feet
}

const labelSt: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }
const inputSt: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 7, color: 'rgba(255,255,255,0.88)', fontSize: 13, letterSpacing: '-0.01em', padding: '9px 11px', outline: 'none' }

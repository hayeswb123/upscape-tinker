'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { supabase, type Project, type Marker, type Wire, type Zone } from '@/lib/supabase'
import { FIXTURES, TIERS, calcQuote, type FixtureType } from '@/lib/catalog'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

const TOOLS = [
  { id: 'uplight', label: 'Uplight', icon: UpIcon    },
  { id: 'path',    label: 'Path',    icon: PathIcon   },
  { id: 'flood',   label: 'Flood',   icon: FloodIcon  },
  { id: 'well',    label: 'Well',    icon: WellIcon   },
  { id: 'power',   label: 'Power',   icon: PowerIcon  },
  { id: 'wire',    label: 'Wire',    icon: WireIcon   },
  { id: 'zone',    label: 'Zone',    icon: ZoneIcon   },
  { id: 'select',  label: 'Select',  icon: SelectIcon },
] as const

type ToolId = typeof TOOLS[number]['id']

const FIXTURE_COLORS: Record<string, string> = {
  uplight: '#F4884A', path: '#F5C842', flood: '#EF4444',
  well: '#3B82F6', power: '#9CA3AF',
}

function markerEl(type: string) {
  const color = FIXTURE_COLORS[type] || '#F4884A'
  const el = document.createElement('div')
  el.style.cssText = `width:34px;height:34px;cursor:pointer;`
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
  const [night, setNight] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('upscape-night') === '1'
  })
  const [terrain3d, setTerrain3d] = useState(true)
  const [popup, setPopup] = useState<Marker | null>(null)
  const [wirePoints, setWirePoints] = useState<[number, number][]>([])
  const wireRef = useRef<[number, number][]>([])
  const [zonePoints, setZonePoints] = useState<[number, number][]>([])
  const zoneRef = useRef<[number, number][]>([])
  const [zoneName, setZoneName] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => { wireRef.current = wirePoints }, [wirePoints])
  useEffect(() => { zoneRef.current = zonePoints }, [zonePoints])

  // Ghost cursor — scoped to the Mapbox canvas element only
  useEffect(() => {
    const isFixture = tool !== 'select' && tool !== 'wire' && tool !== 'zone'
    if (!isFixture) { setGhostPos(null); return }
    function getCanvas() { return mapDiv.current?.querySelector('canvas') as HTMLCanvasElement | null }
    function onMove(e: MouseEvent) { setGhostPos({ x: e.clientX, y: e.clientY }) }
    function onLeave() { setGhostPos(null) }
    const canvas = getCanvas()
    if (canvas) { canvas.addEventListener('mousemove', onMove); canvas.addEventListener('mouseleave', onLeave) }
    return () => {
      const c = getCanvas()
      if (c) { c.removeEventListener('mousemove', onMove); c.removeEventListener('mouseleave', onLeave) }
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
        style: {
          version: 8,
          sources: {
            'arcgis': {
              type: 'raster',
              tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
              tileSize: 256,
              attribution: '© Esri, Maxar, Earthstar Geographics',
            },
          },
          layers: [{ id: 'arcgis-layer', type: 'raster', source: 'arcgis' }],
          glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}',
        },
        center: p.lng && p.lat ? [p.lng, p.lat] : [-73.9857, 40.7484],
        zoom: p.lng ? 18.5 : 13,
        pitch: 45,
        bearing: -10,
        antialias: true,
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

        map.addSource('wire-preview', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({ id: 'wire-preview-line', type: 'line', source: 'wire-preview', paint: { 'line-color': '#facc15', 'line-width': 2, 'line-opacity': 0.6, 'line-dasharray': [3, 2] } })

        map.addSource('zones', { type: 'geojson', data: zonesToGeoJSON(p.zones || []) })
        map.addLayer({ id: 'zones-fill', type: 'fill', source: 'zones', paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.12 } })
        map.addLayer({ id: 'zones-line', type: 'line', source: 'zones', paint: { 'line-color': '#3b82f6', 'line-width': 1.5 } })

        // Zone drawing preview
        map.addSource('zone-preview', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({ id: 'zone-preview-fill', type: 'fill', source: 'zone-preview', paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.18 } })
        map.addLayer({ id: 'zone-preview-line', type: 'line', source: 'zone-preview', paint: { 'line-color': '#93c5fd', 'line-width': 2, 'line-dasharray': [3, 2] } })

        // Zone labels at polygon centroids
        map.addSource('zone-labels', { type: 'geojson', data: zonesToLabelGeoJSON(p.zones || []) })
        map.addLayer({
          id: 'zone-labels-text', type: 'symbol', source: 'zone-labels',
          layout: { 'text-field': ['get', 'label'], 'text-size': 12, 'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'], 'text-allow-overlap': false },
          paint: { 'text-color': '#93c5fd', 'text-halo-color': 'rgba(0,0,0,0.75)', 'text-halo-width': 2 },
        })

        for (const m of p.markers || []) addMarkerToMap(map, m)

        map.on('mousemove', e => {
          const currentTool = (window as any).__upscapeTool as ToolId

          // Wire preview
          if (currentTool !== 'wire' && currentTool !== 'zone') {
            ;(map.getSource('wire-preview') as mapboxgl.GeoJSONSource)?.setData({ type: 'FeatureCollection', features: [] })
          }
          if (currentTool === 'wire') {
            const pts = wireRef.current
            if (pts.length === 0) return
            const cursor: [number, number] = [e.lngLat.lng, e.lngLat.lat]
            ;(map.getSource('wire-preview') as mapboxgl.GeoJSONSource)?.setData({
              type: 'FeatureCollection',
              features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [...pts, cursor] }, properties: {} }],
            })
          }

          // Zone preview
          if (currentTool === 'zone') {
            const pts = zoneRef.current
            if (pts.length === 0) return
            const cursor: [number, number] = [e.lngLat.lng, e.lngLat.lat]
            const ring = [...pts, cursor, pts[0]]
            ;(map.getSource('zone-preview') as mapboxgl.GeoJSONSource)?.setData({
              type: 'FeatureCollection',
              features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} }],
            })
          } else {
            ;(map.getSource('zone-preview') as mapboxgl.GeoJSONSource)?.setData({ type: 'FeatureCollection', features: [] })
          }
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
          if (currentTool === 'zone') {
            const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat]
            const next = [...zoneRef.current, pt]
            zoneRef.current = next
            setZonePoints([...next])
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
    addMarkerToMap(map, marker)
    setProject(p => {
      if (!p) return p
      const markers = [...p.markers, marker]
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

  async function finishZone() {
    const pts = zoneRef.current
    if (pts.length < 3) { setZonePoints([]); zoneRef.current = []; return }
    const zone: Zone = { id: crypto.randomUUID(), label: zoneName.trim() || 'Zone', points: pts }
    const { data: proj } = await supabase.from('projects').select('zones').eq('id', projectId).single()
    if (!proj) return
    const zones = [...(proj.zones as Zone[]), zone]
    await supabase.from('projects').update({ zones }).eq('id', projectId)
    ;(mapRef.current!.getSource('zones') as mapboxgl.GeoJSONSource).setData(zonesToGeoJSON(zones))
    ;(mapRef.current!.getSource('zone-labels') as mapboxgl.GeoJSONSource).setData(zonesToLabelGeoJSON(zones))
    ;(mapRef.current!.getSource('zone-preview') as mapboxgl.GeoJSONSource).setData({ type: 'FeatureCollection', features: [] })
    setZonePoints([]); zoneRef.current = []; setZoneName('')
    setProject(p => p ? { ...p, zones } : p)
    setToolAndSync('select')
  }

  async function savePopup(updated: Marker) {
    const typeChanged = popup && updated.type !== popup.type
    if (typeChanged && mapRef.current) {
      const old = markersRef.current.get(updated.id)
      if (old) { old.remove(); markersRef.current.delete(updated.id) }
      addMarkerToMap(mapRef.current, updated)
    }
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
    if (t !== 'zone') { setZonePoints([]); zoneRef.current = [] }
  }

  useEffect(() => { (window as any).__upscapeTool = tool }, [tool])

  function toggle3D() {
    const map = mapRef.current
    if (!map) return
    const next = !terrain3d
    setTerrain3d(next)
    if (next) {
      addTerrain(map)
      map.easeTo({ pitch: 45, bearing: -10, duration: 600 })
    } else {
      map.setTerrain(null as any)
      map.easeTo({ pitch: 0, bearing: 0, duration: 600 })
    }
  }

  function toggleNight() {
    const map = mapRef.current
    if (!map) return
    const next = !night
    setNight(next)
    localStorage.setItem('upscape-night', next ? '1' : '0')
    const arcgisStyle: mapboxgl.StyleSpecification = {
      version: 8,
      sources: { arcgis: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 } },
      layers: [{ id: 'arcgis-layer', type: 'raster', source: 'arcgis', paint: next ? { 'raster-brightness-max': 0.3, 'raster-saturation': -0.8 } : {} }],
      glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}',
    }
    map.setStyle(arcgisStyle)
    map.once('style.load', () => {
      addTerrain(map)
      const p = project
      if (!p) return
      map.addSource('wires', { type: 'geojson', data: wiresToGeoJSON(p.wires || []) })
      map.addLayer({ id: 'wires-line', type: 'line', source: 'wires', paint: { 'line-color': '#facc15', 'line-width': 2.5, 'line-dasharray': [5, 3] } })
      map.addSource('zones', { type: 'geojson', data: zonesToGeoJSON(p.zones || []) })
      map.addLayer({ id: 'zones-fill', type: 'fill', source: 'zones', paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.12 } })
      map.addLayer({ id: 'zones-line', type: 'line', source: 'zones', paint: { 'line-color': '#3b82f6', 'line-width': 1.5 } })
      map.addSource('zone-preview', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'zone-preview-fill', type: 'fill', source: 'zone-preview', paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.18 } })
      map.addLayer({ id: 'zone-preview-line', type: 'line', source: 'zone-preview', paint: { 'line-color': '#93c5fd', 'line-width': 2, 'line-dasharray': [3, 2] } })
      map.addSource('zone-labels', { type: 'geojson', data: zonesToLabelGeoJSON(p.zones || []) })
      map.addLayer({
        id: 'zone-labels-text', type: 'symbol', source: 'zone-labels',
        layout: { 'text-field': ['get', 'label'], 'text-size': 12, 'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'], 'text-allow-overlap': false },
        paint: { 'text-color': '#93c5fd', 'text-halo-color': 'rgba(0,0,0,0.75)', 'text-halo-width': 2 },
      })
      map.addSource('wire-preview', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'wire-preview-line', type: 'line', source: 'wire-preview', paint: { 'line-color': '#facc15', 'line-width': 2, 'line-opacity': 0.6, 'line-dasharray': [3, 2] } })
      markersRef.current.forEach(mb => mb.addTo(map))
    })
  }

  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) return (
    <div style={{ background: '#0f0f0f', height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', color: '#f0f0f0', maxWidth: 340 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Mapbox token missing</p>
        <p style={{ color: '#888', fontSize: 13, lineHeight: 1.5 }}>Add <code style={{ background: '#222', padding: '1px 6px', borderRadius: 4 }}>NEXT_PUBLIC_MAPBOX_TOKEN</code> to your Vercel environment variables, then redeploy.</p>
      </div>
    </div>
  )

  if (!project) return (
    <div style={{ background: '#0f0f0f', height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#888' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #F4884A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        Loading…
      </div>
    </div>
  )

  const ghostColor = FIXTURE_COLORS[tool] || '#F4884A'

  // Live running total for selected tier
  const liveQuote = (() => {
    if (!project || project.markers.length === 0) return null
    const q = calcQuote(project)
    const tier = project.selected_tier || 'premium'
    return q[tier]?.total ?? null
  })()

  // Zone fixture membership (point-in-polygon)
  const zoneFixtureCounts = project.zones?.map(zone => {
    const count = project.markers.filter(m => m.type !== 'power' && pointInPolygon([m.lng, m.lat], zone.points)).length
    return { zone, count }
  }) ?? []

  return (
    <div style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden' }}>
      <div ref={mapDiv} style={{ position: 'absolute', inset: 0 }} />

      {/* ghost cursor overlay */}
      {ghostPos && tool !== 'select' && tool !== 'wire' && tool !== 'zone' && (
        <div style={{ position: 'fixed', pointerEvents: 'none', zIndex: 15, left: ghostPos.x, top: ghostPos.y, transform: 'translate(-50%, -50%)' }}>
          <style>{`
            @keyframes ghost-pulse {
              0%, 100% { box-shadow: 0 0 0 4px ${ghostColor}22, 0 0 16px ${ghostColor}44; }
              50%       { box-shadow: 0 0 0 12px ${ghostColor}11, 0 0 28px ${ghostColor}66; }
            }
          `}</style>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${ghostColor}22`, border: `2px dashed ${ghostColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'ghost-pulse 1s ease-in-out infinite' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: ghostColor, border: '2.5px solid rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }} dangerouslySetInnerHTML={{ __html: markerSVG(tool) }} />
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
        background: 'linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%)',
        padding: '12px 14px 28px',
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <button onClick={() => router.push('/dashboard')} style={topBtn}>‹</button>
        <button
          onClick={() => setSettingsOpen(true)}
          style={{ flex: 1, minWidth: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', textAlign: 'left' }}
        >
          <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#fff' }}>{project.homeowner || project.name}</div>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{project.address}</div>
        </button>
        <button onClick={toggle3D} style={{ ...topBtn, border: `1px solid ${terrain3d ? '#F4884A' : 'rgba(255,255,255,0.12)'}`, color: terrain3d ? '#F4884A' : 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700 }}>3D</button>
        <button onClick={toggleNight} style={{ ...topBtn, border: `1px solid ${night ? '#facc15' : 'rgba(255,255,255,0.12)'}`, color: night ? '#facc15' : 'rgba(255,255,255,0.6)', fontSize: 16 }}>☽</button>
        <button onClick={() => router.push(`/projects/${projectId}/quote`)} style={{ background: '#F4884A', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 13, padding: '0 14px', height: 36, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>Quote →</button>
      </header>

      {/* live running total chip */}
      {liveQuote !== null && (
        <div style={{ position: 'absolute', top: 64, right: 14, zIndex: 20, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', border: '1px solid rgba(244,136,74,0.35)', borderRadius: 10, padding: '5px 12px', pointerEvents: 'none' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>{(project.selected_tier || 'premium').toUpperCase()}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#F4884A' }}>${liveQuote.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
        </div>
      )}

      {/* zone legend (when zones exist) */}
      {zoneFixtureCounts.length > 0 && tool !== 'zone' && (
        <div style={{ position: 'absolute', top: liveQuote !== null ? 116 : 64, right: 14, zIndex: 20, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', border: '1px solid rgba(59,130,246,0.35)', borderRadius: 10, padding: '8px 12px', minWidth: 120 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Zones</div>
          {zoneFixtureCounts.map(({ zone, count }) => (
            <div key={zone.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#93c5fd', fontWeight: 600 }}>{zone.label || 'Zone'}</span>
              </div>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{count} fix</span>
            </div>
          ))}
        </div>
      )}

      {/* wire banner */}
      {tool === 'wire' && (
        <div style={{ position: 'absolute', top: 64, left: '50%', transform: 'translateX(-50%)', zIndex: 20, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(250,204,21,0.3)', borderRadius: 12, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
            {wirePoints.length < 2 ? '⚡ Tap to add wire points' : `${wirePoints.length} pts · ${calcWireFeet(wirePoints).toFixed(0)} ft`}
          </span>
          <button onClick={finishWire} style={bannerBtn}>Done</button>
          <button onClick={() => { setWirePoints([]); wireRef.current = []; setToolAndSync('select') }} style={bannerCancelBtn}>Cancel</button>
        </div>
      )}

      {/* zone drawing banner */}
      {tool === 'zone' && (
        <div style={{ position: 'absolute', top: 64, left: '50%', transform: 'translateX(-50%)', zIndex: 20, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(59,130,246,0.4)', borderRadius: 12, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>
            {zonePoints.length < 3 ? `◻ Click to add points (${zonePoints.length})` : `${zonePoints.length} pts`}
          </span>
          <input
            value={zoneName}
            onChange={e => setZoneName(e.target.value)}
            placeholder="Zone name…"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 7, color: '#fff', fontSize: 12, padding: '5px 9px', outline: 'none', width: 100 }}
          />
          <button onClick={finishZone} disabled={zonePoints.length < 3} style={{ ...bannerBtn, opacity: zonePoints.length < 3 ? 0.45 : 1 }}>Done</button>
          <button onClick={() => { setZonePoints([]); zoneRef.current = []; setToolAndSync('select') }} style={bannerCancelBtn}>Cancel</button>
        </div>
      )}

      {/* toolbar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
        background: 'linear-gradient(0deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.0) 100%)',
        paddingBottom: 'env(safe-area-inset-bottom, 8px)',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${TOOLS.length}, 1fr)`, gap: 5, padding: '16px 8px 10px' }}>
          {TOOLS.map(t => {
            const isActive = tool === t.id
            const color = FIXTURE_COLORS[t.id] || (t.id === 'zone' ? '#3b82f6' : '#888')
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setToolAndSync(t.id)}
                style={{
                  width: '100%',
                  background: isActive ? color : 'rgba(20,20,20,0.85)',
                  backdropFilter: 'blur(8px)',
                  border: `1px solid ${isActive ? color : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 14, padding: '10px 4px 8px',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                  boxShadow: isActive ? `0 0 16px ${color}66` : 'none',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ color: isActive ? '#fff' : color, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22 }}>
                  <Icon />
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: isActive ? '#fff' : 'rgba(255,255,255,0.5)', letterSpacing: '0.03em' }}>{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* marker popup */}
      {popup && <MarkerPopup marker={popup} onChange={setPopup} onSave={savePopup} onDelete={deleteMarker} />}

      {/* project settings sheet */}
      {settingsOpen && (
        <ProjectSettingsSheet
          project={project}
          projectId={projectId}
          onClose={() => setSettingsOpen(false)}
          onSaved={(updated) => setProject(p => p ? { ...p, ...updated } : p)}
        />
      )}
    </div>
  )
}

// ── Project Settings Sheet ────────────────────────────────────────────────────

function ProjectSettingsSheet({ project, projectId, onClose, onSaved }: {
  project: Project
  projectId: string
  onClose: () => void
  onSaved: (updates: Partial<Project>) => void
}) {
  const [form, setForm] = useState({
    homeowner: project.homeowner || '',
    address: project.address || '',
    phone: project.phone || '',
    email: project.email || '',
    name: project.name || '',
    status: project.status || 'draft',
  })
  const [saving, setSaving] = useState(false)

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function save() {
    setSaving(true)
    await supabase.from('projects').update(form).eq('id', projectId)
    setSaving(false)
    onSaved(form)
    onClose()
  }

  const STATUS_OPTS = [
    { value: 'draft', label: 'Draft', color: '#6b7280' },
    { value: 'quoted', label: 'Quoted', color: '#3b82f6' },
    { value: 'approved', label: 'Approved', color: '#22c55e' },
    { value: 'installed', label: 'Installed', color: '#a78bfa' },
  ]

  return (
    <>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.5)' }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: '#111', borderRadius: '20px 20px 0 0', border: '1px solid rgba(255,255,255,0.08)',
        padding: '20px 16px', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
        maxHeight: '80dvh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>Project Settings</span>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SheetField label="Homeowner">
            <input style={sheetInput} value={form.homeowner} onChange={e => set('homeowner', e.target.value)} placeholder="Jane Smith" />
          </SheetField>
          <SheetField label="Address">
            <input style={sheetInput} value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Oak Lane" />
          </SheetField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <SheetField label="Phone">
              <input style={sheetInput} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(217) 555-0100" />
            </SheetField>
            <SheetField label="Email">
              <input style={sheetInput} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jane@example.com" />
            </SheetField>
          </div>
          <SheetField label="Project name">
            <input style={sheetInput} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Smith Backyard" />
          </SheetField>
          <SheetField label="Status">
            <div style={{ display: 'flex', gap: 8 }}>
              {STATUS_OPTS.map(s => (
                <button
                  key={s.value}
                  onClick={() => set('status', s.value)}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: `1px solid ${form.status === s.value ? s.color : 'rgba(255,255,255,0.1)'}`, background: form.status === s.value ? s.color + '22' : 'rgba(255,255,255,0.04)', color: form.status === s.value ? s.color : 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </SheetField>
        </div>

        <button onClick={save} disabled={saving} style={{ width: '100%', marginTop: 20, background: '#F4884A', border: 'none', borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 700, padding: 14, cursor: 'pointer' }}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </>
  )
}

function SheetField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</label>
      {children}
    </div>
  )
}

// ── Marker Popup ──────────────────────────────────────────────────────────────

function MarkerPopup({ marker, onChange, onSave, onDelete }: {
  marker: Marker
  onChange: (m: Marker) => void
  onSave: (m: Marker) => void
  onDelete: (id: string) => void
}) {
  const color = FIXTURE_COLORS[marker.type] || '#F4884A'
  const fix = FIXTURES[marker.type as FixtureType]

  const FIXTURE_TYPES: Array<{ id: FixtureType; label: string }> = [
    { id: 'uplight', label: 'Up' },
    { id: 'path', label: 'Path' },
    { id: 'flood', label: 'Flood' },
    { id: 'well', label: 'Well' },
    { id: 'downlight', label: 'Down' },
    { id: 'hardscape', label: 'Step' },
    { id: 'power', label: 'PWR' },
  ]

  return (
    <div style={{ position: 'absolute', bottom: 110, left: 12, right: 12, zIndex: 30, background: 'rgba(18,18,18,0.97)', backdropFilter: 'blur(20px)', border: `1px solid ${color}44`, borderRadius: 18, boxShadow: `0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px ${color}22`, overflow: 'hidden' }}>
      <div style={{ background: `linear-gradient(135deg, ${color}22 0%, transparent 60%)`, padding: '14px 16px 12px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          dangerouslySetInnerHTML={{ __html: markerSVG(marker.type) }} />
        <span style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>{fix?.label || marker.type}</span>
        <button onClick={() => onSave(marker)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
      </div>

      {/* Fixture type selector */}
      <div style={{ padding: '10px 16px 0', display: 'flex', gap: 6 }}>
        {FIXTURE_TYPES.map(ft => {
          const ftColor = FIXTURE_COLORS[ft.id] || '#9CA3AF'
          const active = marker.type === ft.id
          return (
            <button
              key={ft.id}
              onClick={() => onChange({ ...marker, type: ft.id })}
              style={{ flex: 1, padding: '5px 0', borderRadius: 7, border: `1px solid ${active ? ftColor : 'rgba(255,255,255,0.1)'}`, background: active ? ftColor + '33' : 'rgba(255,255,255,0.04)', color: active ? ftColor : 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: 700, cursor: 'pointer', transition: 'all 0.12s' }}
            >
              {ft.label}
            </button>
          )
        })}
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {fix && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {(['budget', 'mid', 'premium'] as const).map(t => (
              <div key={t} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '7px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>{TIERS[t].label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: TIERS[t].color }}>${fix.tiers[t].price}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>{fix.tiers[t].name}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <label style={labelSt}>Qty</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: 'rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
            <button onClick={() => onChange({ ...marker, qty: Math.max(1, marker.qty - 1) })} style={{ width: 38, height: 38, background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>−</button>
            <span style={{ fontSize: 17, fontWeight: 700, color, minWidth: 30, textAlign: 'center' }}>{marker.qty}</span>
            <button onClick={() => onChange({ ...marker, qty: marker.qty + 1 })} style={{ width: 38, height: 38, background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>+</button>
          </div>
        </div>
        <div>
          <label style={labelSt}>Label</label>
          <input style={inputSt} value={marker.label} onChange={e => onChange({ ...marker, label: e.target.value })} placeholder="e.g. Front oak tree" />
        </div>
        <div>
          <label style={labelSt}>Notes</label>
          <textarea style={{ ...inputSt, resize: 'none', height: 56 }} value={marker.notes} onChange={e => onChange({ ...marker, notes: e.target.value })} placeholder="Beam angle, color temp…" />
        </div>
      </div>
      <div style={{ padding: '0 16px 16px', display: 'flex', gap: 8 }}>
        <button onClick={() => onDelete(marker.id)} style={{ flex: 1, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, color: '#f87171', fontSize: 13, fontWeight: 600, padding: 11, cursor: 'pointer' }}>Delete</button>
        <button onClick={() => onSave(marker)} style={{ flex: 2, background: color, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, padding: 11, cursor: 'pointer' }}>Save</button>
      </div>
    </div>
  )
}

// ── SVG icon components ───────────────────────────────────────────────────────
function UpIcon()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l9 18H3z"/></svg> }
function PathIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2"/></svg> }
function FloodIcon()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l10 20H2z"/><path d="M12 9l6 13H6z" fill="rgba(0,0,0,0.2)"/></svg> }
function WellIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/></svg> }
function PowerIcon()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> }
function WireIcon()   { return <svg width="18" height="16" viewBox="0 0 24 16" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 2"><path d="M2 8h20"/></svg> }
function ZoneIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="3" strokeDasharray="4 2"/></svg> }
function SelectIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M4 2l16 10-8 2-4 8z"/></svg> }

// ── Helpers ───────────────────────────────────────────────────────────────────
function wiresToGeoJSON(wires: Wire[]) {
  return { type: 'FeatureCollection' as const, features: wires.map(w => ({ type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: w.points }, properties: {} })) }
}
function zonesToGeoJSON(zones: Zone[]) {
  return { type: 'FeatureCollection' as const, features: zones.map(z => ({ type: 'Feature' as const, geometry: { type: 'Polygon' as const, coordinates: [z.points] }, properties: {} })) }
}
function zonesToLabelGeoJSON(zones: Zone[]) {
  return {
    type: 'FeatureCollection' as const,
    features: zones.map(z => {
      const lngs = z.points.map(p => p[0])
      const lats = z.points.map(p => p[1])
      const cx = lngs.reduce((a, b) => a + b, 0) / lngs.length
      const cy = lats.reduce((a, b) => a + b, 0) / lats.length
      return { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [cx, cy] }, properties: { label: z.label || 'Zone' } }
    }),
  }
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
function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j]
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) inside = !inside
  }
  return inside
}

const labelSt: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }
const inputSt: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 14, padding: '9px 12px', outline: 'none' }
const sheetInput: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 14, padding: '9px 12px', outline: 'none' }
const topBtn: React.CSSProperties = { background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: 'rgba(255,255,255,0.6)', fontSize: 18, cursor: 'pointer', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
const bannerBtn: React.CSSProperties = { background: '#F4884A', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 700, padding: '5px 12px', cursor: 'pointer' }
const bannerCancelBtn: React.CSSProperties = { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 7, color: 'rgba(255,255,255,0.6)', fontSize: 12, padding: '5px 12px', cursor: 'pointer' }

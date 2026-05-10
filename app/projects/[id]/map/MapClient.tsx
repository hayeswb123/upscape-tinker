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
  { id: 'zone',    label: 'Zone',    icon: ZoneIcon   },
  { id: 'select',  label: 'Select',  icon: SelectIcon },
] as const

const ZONE_COLORS = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#a855f7','#06b6d4','#f97316','#ec4899']

type ToolId = typeof TOOLS[number]['id']

const FIXTURE_COLORS: Record<string, string> = {
  uplight: '#F4884A', path: '#F5C842', flood: '#EF4444',
  well: '#3B82F6', power: '#9CA3AF',
}

function markerEl(type: string) {
  const color = FIXTURE_COLORS[type] || '#F4884A'
  // Outer div: Mapbox owns the transform on this element — never touch it
  const el = document.createElement('div')
  el.style.cssText = `width:22px;height:22px;cursor:pointer;`

  // Inner div: we animate this one only
  const inner = document.createElement('div')
  inner.style.cssText = `
    width:22px;height:22px;border-radius:50%;
    background:${color};border:2px solid rgba(255,255,255,0.9);
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 0 0 2px ${color}44, 0 2px 6px rgba(0,0,0,0.6);
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

const WIRE_NODE_CSS = ``

function wireNodeEl(_isNewest: boolean) {
  const el = document.createElement('div')
  el.style.cssText = `
    width:10px;height:10px;border-radius:50%;
    background:#e8a030;border:2px solid rgba(255,255,255,0.85);
    box-shadow:0 0 6px #e8a03099;
    cursor:crosshair;
  `
  return el
}

function add3DBuildings(map: mapboxgl.Map) {
  if (map.getLayer('3d-buildings')) return
  map.addLayer({
    id: '3d-buildings',
    source: 'composite',
    'source-layer': 'building',
    filter: ['==', 'extrude', 'true'],
    type: 'fill-extrusion',
    minzoom: 14,
    paint: {
      'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'height'], 0, '#e8e0d4', 50, '#d4ccc0', 100, '#c0b8ac'],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': ['get', 'min_height'],
      'fill-extrusion-opacity': 0.85,
    },
  })
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
  type MapMode = 'sat-day' | 'sat-night' | '3d-dawn' | '3d-day' | '3d-dusk' | '3d-night'
  const [mapMode, setMapMode] = useState<MapMode>('sat-day')
  const [popup, setPopup] = useState<Marker | null>(null)
  const [wirePopup, setWirePopup] = useState<{ id: string; feet: number } | null>(null)
  const [wirePoints, setWirePoints] = useState<[number, number][]>([])
  const wireRef = useRef<[number, number][]>([])
  const wireMarkersRef = useRef<mapboxgl.Marker[]>([])
  const projectRef = useRef<Project | null>(null)
  const [zonePoints, setZonePoints] = useState<[number, number][]>([])
  const zoneRef = useRef<[number, number][]>([])
  const zoneMarkersRef = useRef<mapboxgl.Marker[]>([])
  const [zoneColor, setZoneColor] = useState(ZONE_COLORS[0])
  const zoneColorRef = useRef(ZONE_COLORS[0])
  const [zonePopup, setZonePopup] = useState<Zone | null>(null)

  useEffect(() => { wireRef.current = wirePoints }, [wirePoints])
  useEffect(() => { projectRef.current = project }, [project])
  useEffect(() => { zoneRef.current = zonePoints }, [zonePoints])
  useEffect(() => { zoneColorRef.current = zoneColor }, [zoneColor])

  // Ghost cursor — scoped to the Mapbox canvas element only
  useEffect(() => {
    const isFixture = tool !== 'select' && tool !== 'wire' && tool !== 'zone'
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
        style: 'mapbox://styles/mapbox/standard-satellite',
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
        ;(map as any).setConfigProperty('basemap', 'lightPreset', 'day')

        map.addSource('wires', { type: 'geojson', data: wiresToGeoJSON(p.wires || []) })
        map.addLayer({ id: 'wires-glow', type: 'line', source: 'wires', paint: { 'line-color': '#ffb830', 'line-width': 14, 'line-opacity': 0.5, 'line-blur': 6 } })
        map.addLayer({ id: 'wires-line', type: 'line', source: 'wires', paint: { 'line-color': '#ffe580', 'line-width': 3.5, 'line-opacity': 1 } })
        // Wide invisible hit layer for easy finger tapping on iPad
        map.addLayer({ id: 'wires-hit', type: 'line', source: 'wires', paint: { 'line-color': 'transparent', 'line-width': 44, 'line-opacity': 0 } })

        // Live wire preview while drawing
        map.addSource('wire-preview', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({ id: 'wire-preview-line', type: 'line', source: 'wire-preview', paint: { 'line-color': '#e8a030', 'line-width': 1.5, 'line-opacity': 0.45, 'line-dasharray': [5, 4] } })

        map.addSource('zones', { type: 'geojson', data: zonesToGeoJSON(p.zones || []) })
        map.addLayer({ id: 'zones-fill', type: 'fill', source: 'zones', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.15 } })
        map.addLayer({ id: 'zones-line', type: 'line', source: 'zones', paint: { 'line-color': ['get', 'color'], 'line-width': 2 } })
        map.addLayer({ id: 'zones-hit', type: 'fill', source: 'zones', paint: { 'fill-color': 'transparent', 'fill-opacity': 0 } })

        map.addSource('zone-preview', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({ id: 'zone-preview-line', type: 'line', source: 'zone-preview', paint: { 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-opacity': 0.6, 'line-dasharray': [4, 3] } })
        map.addLayer({ id: 'zone-preview-fill', type: 'fill', source: 'zone-preview', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.08 } })

        for (const m of p.markers || []) addMarkerToMap(map, m)

        // Update wire + zone preview on mousemove
        map.on('mousemove', e => {
          const currentTool = (window as any).__upscapeTool as ToolId
          if (currentTool !== 'wire') {
            ;(map.getSource('wire-preview') as mapboxgl.GeoJSONSource)?.setData({ type: 'FeatureCollection', features: [] })
          } else {
            const pts = wireRef.current
            if (pts.length > 0) {
              const cursor: [number, number] = [e.lngLat.lng, e.lngLat.lat]
              ;(map.getSource('wire-preview') as mapboxgl.GeoJSONSource)?.setData({
                type: 'FeatureCollection',
                features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [...pts, cursor] }, properties: {} }],
              })
            }
          }
          if (currentTool !== 'zone') {
            ;(map.getSource('zone-preview') as mapboxgl.GeoJSONSource)?.setData({ type: 'FeatureCollection', features: [] })
          } else {
            const pts = zoneRef.current
            const color = zoneColorRef.current
            if (pts.length > 0) {
              const cursor: [number, number] = [e.lngLat.lng, e.lngLat.lat]
              const ring = [...pts, cursor, pts[0]]
              ;(map.getSource('zone-preview') as mapboxgl.GeoJSONSource)?.setData({
                type: 'FeatureCollection',
                features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: { color } }],
              })
            }
          }
        })

        map.on('mousemove', e => {
          const currentTool = (window as any).__upscapeTool as ToolId
          if (!currentTool || currentTool === 'select') {
            const hit = map.queryRenderedFeatures(e.point, { layers: ['wires-hit'] })
            map.getCanvas().style.cursor = hit.length > 0 ? 'pointer' : ''
          }
        })

        map.on('click', e => {
          const currentTool = (window as any).__upscapeTool as ToolId
          // In select mode, check for wire/zone clicks
          if (!currentTool || currentTool === 'select') {
            const wireFeatures = map.queryRenderedFeatures(e.point, { layers: ['wires-hit'] })
            if (wireFeatures.length > 0) {
              const wireId = wireFeatures[0].properties?.wireId as string
              const wireData = projectRef.current?.wires?.find((w: Wire) => w.id === wireId)
              if (wireId && wireData) setWirePopup({ id: wireId, feet: wireData.feet })
              return
            }
            const zoneFeatures = map.queryRenderedFeatures(e.point, { layers: ['zones-hit'] })
            if (zoneFeatures.length > 0) {
              const zoneId = zoneFeatures[0].properties?.zoneId as string
              const zoneData = projectRef.current?.zones?.find((z: Zone) => z.id === zoneId)
              if (zoneData) setZonePopup({ ...zoneData })
            }
            return
          }
          if (currentTool === 'zone') {
            const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat]
            const next = [...zoneRef.current, pt]
            zoneRef.current = next
            setZonePoints([...next])
            const el = document.createElement('div')
            el.style.cssText = `width:8px;height:8px;border-radius:50%;background:${zoneColorRef.current};border:1.5px solid rgba(255,255,255,0.8);`
            const node = new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat(pt).addTo(map)
            zoneMarkersRef.current.push(node)
            return
          }
          if (currentTool === 'wire') {
            const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat]
            const next = [...wireRef.current, pt]
            wireRef.current = next
            setWirePoints([...next])
            // dim previous newest node
            const prev = wireMarkersRef.current[wireMarkersRef.current.length - 1]
            if (prev) {
              const inner = prev.getElement().querySelector('div:last-child') as HTMLElement
              if (inner) { inner.style.animation = 'none'; inner.style.boxShadow = '0 0 0 2px #c8882288, 0 0 6px #c8882244' }
            }
            // add new glowing node
            const marker = new mapboxgl.Marker({ element: wireNodeEl(true), anchor: 'center' })
              .setLngLat(pt).addTo(map)
            wireMarkersRef.current.push(marker)
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
    const mb = new mapboxgl.Marker({ element: el, draggable: true, anchor: 'center' })
      .setLngLat([m.lng, m.lat])
      .addTo(map)

    el.addEventListener('click', (e) => {
      e.stopPropagation()
      const currentTool = (window as any).__upscapeTool as ToolId
      if (currentTool === 'wire') {
        const ll = mb.getLngLat()
        const pt: [number, number] = [ll.lng, ll.lat]
        const next = [...wireRef.current, pt]
        wireRef.current = next
        setWirePoints([...next])
        const node = new mapboxgl.Marker({ element: wireNodeEl(true), anchor: 'center' })
          .setLngLat(pt).addTo(map)
        wireMarkersRef.current.push(node)
        return
      }
      const current = projectRef.current?.markers.find(x => x.id === m.id) ?? m
      setPopup({ ...current })
    })

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

  async function placeMarker(map: mapboxgl.Map, type: FixtureType, lat: number, lng: number) {
    const id = crypto.randomUUID()
    const marker: Marker = { id, type, lat, lng, qty: 1, label: '', notes: '' }
    addMarkerToMap(map, marker)
    setProject(p => p ? { ...p, markers: [...p.markers, marker] } : p)
    // Fetch latest then append to avoid race conditions with rapid placement
    const { data: proj } = await supabase.from('projects').select('markers').eq('id', projectId).single()
    if (!proj) return
    const markers = [...(proj.markers as Marker[] || []).filter((m: Marker) => m.id !== id), marker]
    await supabase.from('projects').update({ markers }).eq('id', projectId)
  }

  function clearWireMarkers() {
    wireMarkersRef.current.forEach(m => m.remove())
    wireMarkersRef.current = []
  }

  function clearZoneMarkers() {
    zoneMarkersRef.current.forEach(m => m.remove())
    zoneMarkersRef.current = []
  }

  async function finishZone() {
    const pts = zoneRef.current
    clearZoneMarkers()
    ;(mapRef.current?.getSource('zone-preview') as mapboxgl.GeoJSONSource)?.setData({ type: 'FeatureCollection', features: [] })
    if (pts.length < 3) { setZonePoints([]); zoneRef.current = []; return }
    const closed = [...pts, pts[0]]
    const zone: Zone = { id: crypto.randomUUID(), label: '', color: zoneColorRef.current, points: closed }
    const { data: proj } = await supabase.from('projects').select('zones').eq('id', projectId).single()
    if (!proj) return
    const zones = [...(proj.zones as Zone[] || []), zone]
    await supabase.from('projects').update({ zones }).eq('id', projectId)
    ;(mapRef.current?.getSource('zones') as mapboxgl.GeoJSONSource)?.setData(zonesToGeoJSON(zones))
    setProject(p => p ? { ...p, zones } : p)
    setZonePoints([]); zoneRef.current = []
  }

  async function deleteZone(id: string) {
    const { data: proj } = await supabase.from('projects').select('zones').eq('id', projectId).single()
    if (!proj) return
    const zones = (proj.zones as Zone[]).filter(z => z.id !== id)
    await supabase.from('projects').update({ zones }).eq('id', projectId)
    ;(mapRef.current?.getSource('zones') as mapboxgl.GeoJSONSource)?.setData(zonesToGeoJSON(zones))
    setProject(p => p ? { ...p, zones } : p)
    setZonePopup(null)
  }

  async function saveZone(updated: Zone) {
    const { data: proj } = await supabase.from('projects').select('zones').eq('id', projectId).single()
    if (!proj) return
    const zones = (proj.zones as Zone[]).map(z => z.id === updated.id ? updated : z)
    await supabase.from('projects').update({ zones }).eq('id', projectId)
    ;(mapRef.current?.getSource('zones') as mapboxgl.GeoJSONSource)?.setData(zonesToGeoJSON(zones))
    setProject(p => p ? { ...p, zones } : p)
    setZonePopup(null)
  }

  async function finishWire() {
    const pts = wireRef.current
    clearWireMarkers()
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

  async function deleteWire(id: string) {
    const { data: proj } = await supabase.from('projects').select('wires').eq('id', projectId).single()
    if (!proj) return
    const wires = (proj.wires as Wire[]).filter(w => w.id !== id)
    await supabase.from('projects').update({ wires }).eq('id', projectId)
    ;(mapRef.current?.getSource('wires') as mapboxgl.GeoJSONSource)?.setData(wiresToGeoJSON(wires))
    setProject(p => p ? { ...p, wires } : p)
    setWirePopup(null)
  }

  function setToolAndSync(t: ToolId) {
    setTool(t)
    ;(window as any).__upscapeTool = t
    if (t !== 'wire') { clearWireMarkers(); setWirePoints([]); wireRef.current = [] }
    if (t !== 'zone') {
      clearZoneMarkers(); setZonePoints([]); zoneRef.current = []
      ;(mapRef.current?.getSource('zone-preview') as mapboxgl.GeoJSONSource)?.setData({ type: 'FeatureCollection', features: [] })
    }
    const draggable = t !== 'wire' && t !== 'zone'
    markersRef.current.forEach(mb => mb.setDraggable(draggable))
    const canvas = mapRef.current?.getCanvas()
    if (canvas) canvas.style.cursor = (t === 'wire' || t === 'zone') ? 'crosshair' : ''
  }

  useEffect(() => { (window as any).__upscapeTool = tool }, [tool])

  const TERRAIN_STYLE = 'mapbox://styles/hayesb123/cmoyv06sv001801qweuh6hjob'
  const SAT_STYLE = 'mapbox://styles/mapbox/standard-satellite'
  const MAP_STYLES: Record<string, string> = {
    'sat-day':   SAT_STYLE,
    'sat-night': SAT_STYLE,
    '3d-day':    TERRAIN_STYLE,
    '3d-dawn':   TERRAIN_STYLE,
    '3d-dusk':   TERRAIN_STYLE,
    '3d-night':  TERRAIN_STYLE,
  }
  const LIGHT_PRESETS: Record<string, string> = {
    'sat-day': 'day', 'sat-night': 'night',
    '3d-day': 'day', '3d-dawn': 'dawn', '3d-dusk': 'dusk', '3d-night': 'night',
  }
  const SAT_CYCLE  = ['sat-day', 'sat-night'] as const
  const D3_CYCLE   = ['3d-dawn', '3d-day', '3d-dusk', '3d-night'] as const
  // map a time-of-day to its closest equivalent in each mode
  const TIME_RANK: Record<string, number> = { 'sat-day':0,'sat-night':2,'3d-dawn':0,'3d-day':1,'3d-dusk':2,'3d-night':3 }

  function switchMode(mode: MapMode) {
    const map = mapRef.current
    if (!map) return
    const prevStyle = MAP_STYLES[mapMode]
    const nextStyle = MAP_STYLES[mode]
    setMapMode(mode)
    if (nextStyle !== prevStyle) {
      map.setStyle(nextStyle)
      map.once('style.load', () => {
        if (mode === 'sat-day' || mode === 'sat-night') addTerrain(map)
        if (LIGHT_PRESETS[mode]) (map as any).setConfigProperty('basemap', 'lightPreset', LIGHT_PRESETS[mode])
        const p = project
        if (!p) return
        map.addSource('wires', { type: 'geojson', data: wiresToGeoJSON(p.wires || []) })
        map.addLayer({ id: 'wires-glow', type: 'line', source: 'wires', paint: { 'line-color': '#ffb830', 'line-width': 14, 'line-opacity': 0.5, 'line-blur': 6 } })
        map.addLayer({ id: 'wires-line', type: 'line', source: 'wires', paint: { 'line-color': '#ffe580', 'line-width': 3.5, 'line-opacity': 1 } })
        // Wide invisible hit layer for easy finger tapping on iPad
        map.addLayer({ id: 'wires-hit', type: 'line', source: 'wires', paint: { 'line-color': 'transparent', 'line-width': 44, 'line-opacity': 0 } })
        map.addSource('wire-preview', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({ id: 'wire-preview-line', type: 'line', source: 'wire-preview', paint: { 'line-color': '#e8a030', 'line-width': 1.5, 'line-opacity': 0.45, 'line-dasharray': [5, 4] } })
        map.addSource('zones', { type: 'geojson', data: zonesToGeoJSON(p.zones || []) })
        map.addLayer({ id: 'zones-fill', type: 'fill', source: 'zones', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.15 } })
        map.addLayer({ id: 'zones-line', type: 'line', source: 'zones', paint: { 'line-color': ['get', 'color'], 'line-width': 2 } })
        map.addLayer({ id: 'zones-hit', type: 'fill', source: 'zones', paint: { 'fill-color': 'transparent', 'fill-opacity': 0 } })
        map.addSource('zone-preview', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({ id: 'zone-preview-line', type: 'line', source: 'zone-preview', paint: { 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-opacity': 0.6, 'line-dasharray': [4, 3] } })
        map.addLayer({ id: 'zone-preview-fill', type: 'fill', source: 'zone-preview', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.08 } })
        markersRef.current.forEach(mb => mb.addTo(map))
      })
    } else {
      if (LIGHT_PRESETS[mode]) (map as any).setConfigProperty('basemap', 'lightPreset', LIGHT_PRESETS[mode])
    }
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
          ${WIRE_NODE_CSS}
          .upscape-back:hover { opacity: 1 !important; transform: translateY(-1px); }
          .upscape-back { transition: opacity 0.2s, transform 0.2s; }
          .upscape-night:hover { opacity: 1 !important; }
          .upscape-night { transition: opacity 0.2s; }
          .upscape-quote:hover { background: #e07030 !important; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.4) !important; }
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
        {/* map mode switcher */}
        <div style={{ display: 'flex', gap: 3, background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(12px)', borderRadius: 8, padding: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.3)', flexShrink: 0 }}>
          {/* satellite */}
          {([
            { key: 'sat', icon: '◉' },
            { key: '3d',  icon: '⬡' },
          ] as const).map(({ key, icon }) => {
            const isSat = !mapMode.startsWith('3d')
            const isActive = key === 'sat' ? isSat : !isSat
            const timeLabels: Record<string, string> = { 'sat-day':'Day','sat-night':'Night','3d-dawn':'Dawn','3d-day':'Day','3d-dusk':'Dusk','3d-night':'Night' }
            const label = `${key === 'sat' ? 'Satellite' : '3D'} · ${timeLabels[mapMode]}`
            return (
              <button key={key} title={label}
                onClick={() => {
                  if (key === 'sat') {
                    if (isSat) {
                      // already sat — cycle day/night
                      switchMode(mapMode === 'sat-day' ? 'sat-night' : 'sat-day')
                    } else {
                      // switch from 3D to sat, match time
                      const rank = TIME_RANK[mapMode]
                      switchMode(rank >= 2 ? 'sat-night' : 'sat-day')
                    }
                  } else {
                    if (isSat) {
                      // switch to 3D, match time of day
                      const rank = TIME_RANK[mapMode]
                      switchMode(rank === 0 ? '3d-dawn' : rank === 1 ? '3d-day' : rank === 2 ? '3d-dusk' : '3d-night')
                    } else {
                      // already 3D — cycle to next time
                      const idx = D3_CYCLE.indexOf(mapMode as typeof D3_CYCLE[number])
                      switchMode(D3_CYCLE[(idx + 1) % D3_CYCLE.length])
                    }
                  }
                }}
                style={{
                  background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                  border: 'none', borderRadius: 6,
                  color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
                  fontSize: 14, cursor: 'pointer', width: 28, height: 28,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
              >{icon}</button>
            )
          })}
        </div>
        <button className="upscape-quote" onClick={() => router.push(`/projects/${projectId}/quote`)} style={{
          background: '#F4884A', border: 'none', borderRadius: 8,
          color: 'rgba(255,255,255,0.92)', fontWeight: 500, fontSize: 12,
          letterSpacing: '-0.01em', padding: '0 13px', height: 34,
          cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
          boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
        }}>Quote →</button>
      </header>

      {/* locate button */}
      {project?.lat && project?.lng && (
        <button
          onClick={() => mapRef.current?.flyTo({ center: [project.lng!, project.lat!], zoom: 18.5, pitch: 45, duration: 1200 })}
          style={{
            position: 'absolute', bottom: 90, left: 16, zIndex: 20,
            background: 'rgba(12,12,12,0.82)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
            color: '#fff', cursor: 'pointer',
            width: 40, height: 40,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
          }}
          title="Zoom to property"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
            <path d="M12 8a4 4 0 100 8 4 4 0 000-8z" strokeOpacity="0.3"/>
          </svg>
        </button>
      )}

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
          <button onClick={finishWire} style={{ background: '#F4884A', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 500, padding: '5px 11px', cursor: 'pointer', letterSpacing: '-0.01em' }}>Done</button>
          <button onClick={() => { clearWireMarkers(); setWirePoints([]); wireRef.current = []; setToolAndSync('select') }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 11, padding: '5px 4px', cursor: 'pointer' }}>cancel</button>
        </div>
      )}

      {/* zone banner */}
      {tool === 'zone' && (
        <div style={{
          position: 'absolute', top: 62, left: 16, zIndex: 20,
          background: 'rgba(8,8,8,0.82)', backdropFilter: 'blur(16px)',
          borderRadius: 8, padding: '8px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {ZONE_COLORS.map(c => (
              <button key={c} onClick={() => { setZoneColor(c); zoneColorRef.current = c }} style={{
                width: 16, height: 16, borderRadius: '50%', background: c, border: `2px solid ${c === zoneColor ? '#fff' : 'transparent'}`,
                cursor: 'pointer', padding: 0, flexShrink: 0,
              }} />
            ))}
          </div>
          <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.45)', letterSpacing: '-0.01em' }}>
            {zonePoints.length < 3 ? 'tap to draw zone' : `${zonePoints.length} pts`}
          </span>
          <button onClick={finishZone} disabled={zonePoints.length < 3} style={{ background: zonePoints.length >= 3 ? '#F4884A' : 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 500, padding: '5px 11px', cursor: zonePoints.length >= 3 ? 'pointer' : 'default', letterSpacing: '-0.01em' }}>Done</button>
          <button onClick={() => { clearZoneMarkers(); setZonePoints([]); zoneRef.current = []; setToolAndSync('select') }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 11, padding: '5px 4px', cursor: 'pointer' }}>cancel</button>
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

      {/* wire popup */}
      {wirePopup && (
        <div style={{ position: 'absolute', bottom: 96, left: 14, right: 14, zIndex: 30, background: 'rgba(12,12,12,0.96)', backdropFilter: 'blur(24px)', borderRadius: 12, boxShadow: '0 12px 48px rgba(0,0,0,0.65)', overflow: 'hidden' }}>
          <div style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ color: '#e8a030', fontSize: 16, lineHeight: 1 }}>—</div>
            <span style={{ fontWeight: 500, fontSize: 13, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.88)' }}>Wire · {wirePopup.feet.toFixed(0)} ft</span>
            <button onClick={() => setWirePopup(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', fontSize: 18, padding: 4 }}>✕</button>
          </div>
          <div style={{ padding: '0 16px 14px', display: 'flex', gap: 8 }}>
            <button onClick={() => deleteWire(wirePopup.id)} style={{ flex: 1, background: 'transparent', border: 'none', borderRadius: 8, color: 'rgba(239,68,68,0.7)', fontSize: 12, fontWeight: 500, padding: 11, cursor: 'pointer' }}>Remove wire</button>
          </div>
        </div>
      )}

      {/* zone popup */}
      {zonePopup && (
        <div style={{ position: 'absolute', bottom: 96, left: 14, right: 14, zIndex: 30, background: 'rgba(12,12,12,0.96)', backdropFilter: 'blur(24px)', borderRadius: 12, boxShadow: '0 12px 48px rgba(0,0,0,0.65)', overflow: 'hidden' }}>
          <div style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: zonePopup.color, flexShrink: 0 }} />
            <span style={{ fontWeight: 500, fontSize: 13, color: 'rgba(255,255,255,0.88)' }}>Zone</span>
            <button onClick={() => setZonePopup(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', fontSize: 18, padding: 4 }}>✕</button>
          </div>
          <div style={{ padding: '12px 16px' }}>
            <label style={labelSt}>Label</label>
            <input style={inputSt} value={zonePopup.label} onChange={e => setZonePopup({ ...zonePopup, label: e.target.value })} placeholder="e.g. Front yard, Pool area…" />
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              {ZONE_COLORS.map(c => (
                <button key={c} onClick={() => setZonePopup({ ...zonePopup, color: c })} style={{
                  width: 20, height: 20, borderRadius: '50%', background: c, border: `2px solid ${c === zonePopup.color ? '#fff' : 'transparent'}`,
                  cursor: 'pointer', padding: 0,
                }} />
              ))}
            </div>
          </div>
          <div style={{ padding: '0 16px 14px', display: 'flex', gap: 8 }}>
            <button onClick={() => deleteZone(zonePopup.id)} style={{ flex: 1, background: 'transparent', border: 'none', borderRadius: 8, color: 'rgba(239,68,68,0.7)', fontSize: 12, fontWeight: 500, padding: 11, cursor: 'pointer' }}>Remove zone</button>
            <button onClick={() => saveZone(zonePopup)} style={{ flex: 2, background: '#F4884A', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 500, padding: 11, cursor: 'pointer' }}>Save</button>
          </div>
        </div>
      )}

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
  const color = FIXTURE_COLORS[marker.type] || '#F4884A'
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
        <button onClick={() => onSave(marker)} style={{ flex: 2, background: '#F4884A', border: 'none', borderRadius: 8, color: 'rgba(255,255,255,0.92)', fontSize: 12, fontWeight: 500, letterSpacing: '-0.01em', padding: 11, cursor: 'pointer' }}>Save</button>
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
function ZoneIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="3,18 8,4 16,8 21,16 12,21"/></svg> }
function SelectIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M4 2l16 10-8 2-4 8z"/></svg> }

// helpers
function wiresToGeoJSON(wires: Wire[]) {
  return { type: 'FeatureCollection' as const, features: wires.map(w => ({ type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: w.points }, properties: { wireId: w.id, feet: w.feet } })) }
}
function zonesToGeoJSON(zones: Zone[]) {
  return { type: 'FeatureCollection' as const, features: zones.map(z => ({ type: 'Feature' as const, geometry: { type: 'Polygon' as const, coordinates: [z.points] }, properties: { zoneId: z.id, color: z.color || '#3b82f6', label: z.label } })) }
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

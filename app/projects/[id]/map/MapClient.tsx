'use client'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { supabase, type Project, type Marker, type Wire, type Zone } from '@/lib/supabase'
import { FIXTURES, TIERS, TIERS as _TIERS, calcQuote, calcTotalWatts, recommendTransformer, type FixtureType } from '@/lib/catalog'

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
  el.style.cssText = `width:22px;height:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;`

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
    uplight:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path transform="translate(0,-2)" d="M12 2l8 18H4z"/></svg>`,
    path:      `<svg width="12" height="12" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3" fill="${FIXTURE_COLORS.path}22"/></svg>`,
    flood:     `<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path transform="translate(0,-3)" d="M12 3l10 18H2z"/><path transform="translate(0,-3)" d="M12 8l6 11H6z" fill="rgba(255,255,255,0.3)"/></svg>`,
    well:      `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4" fill="white"/></svg>`,
    downlight: `<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path transform="translate(0,2)" d="M12 22l8-18H4z"/></svg>`,
    hardscape: `<svg width="12" height="12" viewBox="0 0 24 24" fill="white"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`,
    power:     `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><path d="M12 2v8"/><path d="M8.56 4.69a9 9 0 1 0 6.88 0"/></svg>`,
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
  const [hoveredTool, setHoveredTool] = useState<string | null>(null)
  const [accentColor] = useState(() => typeof window !== 'undefined' ? (localStorage.getItem('upscape_accent') || '#F4884A') : '#F4884A')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false)

  // Fixture photo thumbnails — loaded from localStorage, live-updated via storage events
  const FIXTURE_TOOL_IDS = ['uplight', 'path', 'flood', 'well', 'power']
  const loadFixturePhotos = () => {
    if (typeof window === 'undefined') return {}
    return Object.fromEntries(
      FIXTURE_TOOL_IDS.map(id => [id, localStorage.getItem(`upscape_fx_photo_${id}`) || ''])
    )
  }
  const [fixturePhotos, setFixturePhotos] = useState<Record<string, string>>(loadFixturePhotos)
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key?.startsWith('upscape_fx_photo_')) setFixturePhotos(loadFixturePhotos())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const [mapStyle, setMapStyle] = useState<'satellite'|'terrain'>(() => {
    if (typeof window === 'undefined') return 'satellite'
    return (localStorage.getItem('upscape_map_style') || 'satellite') as 'satellite'|'terrain'
  })
  const [timeOfDay, setTimeOfDay] = useState<'dawn'|'day'|'dusk'|'night'>(() => {
    if (typeof window === 'undefined') return 'night'
    return (localStorage.getItem('upscape_map_time') || 'day') as 'dawn'|'day'|'dusk'|'night'
  })
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

  // Ghost cursor — scoped to the Mapbox canvas element only.
  useEffect(() => {
    const isFixture = tool !== 'select' && tool !== 'wire' && tool !== 'zone'
    if (!isFixture) { setGhostPos(null); return }

    function getCanvas() { return mapDiv.current?.querySelector('canvas') as HTMLCanvasElement | null }

    function onMove(e: MouseEvent) {
      const container = mapDiv.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const scaleX = rect.width  / (container.offsetWidth  || rect.width)
      const scaleY = rect.height / (container.offsetHeight || rect.height)
      const x = (e.clientX - rect.left) / scaleX
      const y = (e.clientY - rect.top)  / scaleY
      setGhostPos({ x, y })
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
      const _initStyle = localStorage.getItem('upscape_map_style') || 'satellite'
      const _initTime  = localStorage.getItem('upscape_map_time')  || 'day'
      const _initMapboxStyle = _initStyle === 'terrain'
        ? 'mapbox://styles/mapbox/standard'
        : 'mapbox://styles/mapbox/standard-satellite'
      const _initPreset = (['dawn','day','dusk','night'].includes(_initTime) ? _initTime : 'night')

      const map = new mapboxgl.Map({
        container: mapDiv.current,
        style: _initMapboxStyle,
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
        ;(map as any).setConfigProperty('basemap', 'lightPreset', _initPreset)

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

        // Zone labels at polygon centroids
        map.addSource('zone-labels', { type: 'geojson', data: zonesToLabelGeoJSON(p.zones || []) })
        map.addLayer({
          id: 'zone-labels-text', type: 'symbol', source: 'zone-labels',
          layout: { 'text-field': ['get', 'label'], 'text-size': 12, 'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'], 'text-allow-overlap': false },
          paint: { 'text-color': '#93c5fd', 'text-halo-color': 'rgba(0,0,0,0.75)', 'text-halo-width': 2 },
        })

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
    ;(mapRef.current?.getSource('zone-labels') as mapboxgl.GeoJSONSource)?.setData(zonesToLabelGeoJSON(zones))
    setProject(p => p ? { ...p, zones } : p)
    setZonePoints([]); zoneRef.current = []
  }

  async function deleteZone(id: string) {
    const { data: proj } = await supabase.from('projects').select('zones').eq('id', projectId).single()
    if (!proj) return
    const zones = (proj.zones as Zone[]).filter(z => z.id !== id)
    await supabase.from('projects').update({ zones }).eq('id', projectId)
    ;(mapRef.current?.getSource('zones') as mapboxgl.GeoJSONSource)?.setData(zonesToGeoJSON(zones))
    ;(mapRef.current?.getSource('zone-labels') as mapboxgl.GeoJSONSource)?.setData(zonesToLabelGeoJSON(zones))
    setProject(p => p ? { ...p, zones } : p)
    setZonePopup(null)
  }

  async function saveZone(updated: Zone) {
    const { data: proj } = await supabase.from('projects').select('zones').eq('id', projectId).single()
    if (!proj) return
    const zones = (proj.zones as Zone[]).map(z => z.id === updated.id ? updated : z)
    await supabase.from('projects').update({ zones }).eq('id', projectId)
    ;(mapRef.current?.getSource('zones') as mapboxgl.GeoJSONSource)?.setData(zonesToGeoJSON(zones))
    ;(mapRef.current?.getSource('zone-labels') as mapboxgl.GeoJSONSource)?.setData(zonesToLabelGeoJSON(zones))
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
    // Re-render map marker when type changes
    if (popup && updated.type !== popup.type && mapRef.current) {
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

  const TERRAIN_STYLE = 'mapbox://styles/mapbox/standard'
  const SAT_STYLE = 'mapbox://styles/mapbox/standard-satellite'

  function applyMapView(newStyle: 'satellite'|'terrain', newTime: 'dawn'|'day'|'dusk'|'night') {
    const map = mapRef.current
    if (!map) return
    const newMapboxStyle = newStyle === 'terrain' ? TERRAIN_STYLE : SAT_STYLE
    const curMapboxStyle = mapStyle === 'terrain' ? TERRAIN_STYLE : SAT_STYLE
    setMapStyle(newStyle)
    setTimeOfDay(newTime)
    localStorage.setItem('upscape_map_style', newStyle)
    localStorage.setItem('upscape_map_time', newTime)
    if (newMapboxStyle !== curMapboxStyle) {
      map.setStyle(newMapboxStyle)
      map.once('style.load', () => {
        addTerrain(map)
        ;(map as any).setConfigProperty('basemap', 'lightPreset', newTime)
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
        map.addSource('zone-labels', { type: 'geojson', data: zonesToLabelGeoJSON(p.zones || []) })
        map.addLayer({
          id: 'zone-labels-text', type: 'symbol', source: 'zone-labels',
          layout: { 'text-field': ['get', 'label'], 'text-size': 12, 'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'], 'text-allow-overlap': false },
          paint: { 'text-color': '#93c5fd', 'text-halo-color': 'rgba(0,0,0,0.75)', 'text-halo-width': 2 },
        })
        markersRef.current.forEach(mb => mb.addTo(map))
      })
    } else {
      ;(map as any).setConfigProperty('basemap', 'lightPreset', newTime)
    }
  }

  const ghostColor = FIXTURE_COLORS[tool] || '#F4884A'

  // Live running total chip
  const liveQuote = useMemo(() => {
    if (!project || (project.markers || []).length === 0) return null
    const q = calcQuote(project)
    const tier = ((project as any).selected_tier || 'premium') as 'budget' | 'mid' | 'premium'
    return q[tier]?.total ?? null
  }, [project])

  // Wattage summary
  const wattageInfo = useMemo(() => {
    if (!project) return null
    const fixtures = (project.markers || []).filter(m => m.type !== 'power')
    if (fixtures.length === 0) return null
    const totalW = calcTotalWatts(fixtures)
    const xfmr = recommendTransformer(totalW)
    return { totalW, xfmr }
  }, [project])

  // Zone fixture membership — each fixture binds to its nearest zone by centroid distance
  const zoneFixtureCounts = useMemo(() => {
    if (!project) return []
    const zones = project.zones || []
    if (zones.length === 0) return []
    const fixtures = (project.markers || []).filter(m => m.type !== 'power')
    const counts: Record<string, number> = {}
    zones.forEach(z => { counts[z.id] = 0 })
    fixtures.forEach(m => {
      const pt: [number, number] = [m.lng, m.lat]
      // Find all zones that contain this fixture
      const containing = zones.filter(z => pointInPolygon(pt, z.points))
      if (containing.length === 1) {
        counts[containing[0].id]++
      } else if (containing.length > 1) {
        // Inside multiple overlapping zones — assign to the smallest one (fewest points = most specific)
        const smallest = containing.reduce((a, b) => a.points.length <= b.points.length ? a : b)
        counts[smallest.id]++
      } else {
        // Outside all zones — assign to nearest zone by centroid
        let nearestId = zones[0].id
        let nearestDist = Infinity
        zones.forEach(z => {
          const cx = z.points.reduce((s, p) => s + p[0], 0) / z.points.length
          const cy = z.points.reduce((s, p) => s + p[1], 0) / z.points.length
          const d = Math.hypot(m.lng - cx, m.lat - cy)
          if (d < nearestDist) { nearestDist = d; nearestId = z.id }
        })
        counts[nearestId]++
      }
    })
    return zones.map(zone => ({ zone, count: counts[zone.id] }))
  }, [project])

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

      {/* ghost cursor overlay — absolute within the map container */}
      {ghostPos && tool !== 'select' && tool !== 'wire' && (
        <div style={{
          position: 'absolute', pointerEvents: 'none', zIndex: 15,
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
          @keyframes ringPulse {
            0%, 100% { box-shadow: 0 0 0 2px #F4884A88, 0 0 14px #F4884A44; }
            50%       { box-shadow: 0 0 0 4px #F4884A44, 0 0 28px #F4884A66; }
          }
          @keyframes toolPop {
            0%   { transform: scale(0.88); opacity: 0; }
            60%  { transform: scale(1.06); }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes timeGlowDawn {
            0%,100% { box-shadow: 0 0 10px #c084fc44 inset, 0 0 6px #c084fc22; }
            50%     { box-shadow: 0 0 20px #c084fc66 inset, 0 0 14px #c084fc44; }
          }
          @keyframes timeGlowDay {
            0%,100% { box-shadow: 0 0 10px #fde04744 inset, 0 0 6px #fde04722; }
            50%     { box-shadow: 0 0 20px #fde04766 inset, 0 0 14px #fde04744; }
          }
          @keyframes timeGlowDusk {
            0%,100% { box-shadow: 0 0 10px #fb923c44 inset, 0 0 6px #fb923c22; }
            50%     { box-shadow: 0 0 20px #fb923c66 inset, 0 0 14px #fb923c44; }
          }
          @keyframes timeGlowNight {
            0%,100% { box-shadow: 0 0 10px #60a5fa44 inset, 0 0 6px #60a5fa22; }
            50%     { box-shadow: 0 0 20px #60a5fa66 inset, 0 0 14px #60a5fa44; }
          }
          ${WIRE_NODE_CSS}
          .upscape-back:hover { opacity: 1 !important; transform: translateY(-1px); }
          .upscape-back { transition: opacity 0.2s, transform 0.2s; }
          .upscape-night:hover { opacity: 1 !important; }
          .upscape-night { transition: opacity 0.2s; }
          .upscape-quote:hover { background: #e07030 !important; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.4) !important; }
          .upscape-quote { transition: background 0.2s, transform 0.2s, box-shadow 0.2s; }
          .upscape-tool { transition: opacity 0.18s, transform 0.18s; }
          .upscape-tool:hover { opacity: 1 !important; transform: scale(1.06) translateY(-1px) !important; }
          .upscape-tool-active { transform: scale(1.08) !important; }
          .upscape-style-btn:hover { opacity: 1 !important; }
          .upscape-time-btn { transition: background 0.25s, border-color 0.25s, transform 0.15s; }
          .upscape-time-btn:hover { transform: translateY(-1px); }
          @media (hover: hover) {
            .fx-tooltip { display: none; }
            .upscape-tool:hover .fx-tooltip { display: flex; }
          }
        `}</style>
        <button className="upscape-back" onClick={() => router.push('/dashboard')} style={{
          opacity: 0.55, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(12px)',
          border: 'none', borderRadius: 8, color: '#fff', fontSize: 17,
          cursor: 'pointer', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
        }}>‹</button>

        {/* Project name chip — clickable to open project settings */}
        <button
          onClick={() => setProjectSettingsOpen(true)}
          style={{
            flex: 1, minWidth: 0, background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(14px)',
            borderRadius: 8, padding: '7px 13px',
            boxShadow: '0 2px 16px rgba(0,0,0,0.25)',
            border: 'none', cursor: 'pointer', textAlign: 'left',
          }}
        >
          <div style={{ fontWeight: 500, fontSize: 13, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'rgba(255,255,255,0.92)' }}>{project?.homeowner || project?.name}</div>
          <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 10, letterSpacing: '0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{project?.address}</div>
        </button>

        {/* Map settings button */}
        <button
          onClick={() => setSettingsOpen(v => !v)}
          title="Map settings"
          style={{
            background: settingsOpen ? 'rgba(244,136,74,0.18)' : 'rgba(0,0,0,0.42)',
            backdropFilter: 'blur(12px)',
            border: settingsOpen ? '1.5px solid rgba(244,136,74,0.5)' : '1.5px solid transparent',
            borderRadius: 8, color: settingsOpen ? '#F4884A' : 'rgba(255,255,255,0.6)',
            cursor: 'pointer', width: 34, height: 34, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
            transition: 'all 0.18s',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
        <button className="upscape-quote" onClick={() => router.push(`/projects/${projectId}/quote`)} style={{
          background: '#F4884A', border: 'none', borderRadius: 8,
          color: 'rgba(255,255,255,0.92)', fontWeight: 500, fontSize: 12,
          letterSpacing: '-0.01em', padding: '0 13px', height: 34,
          cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
          boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
        }}>Quote →</button>
      </header>


      {/* Zone fixture count legend panel */}
      {zoneFixtureCounts.length > 0 && tool !== 'zone' && (
        <div style={{ position: 'absolute', top: 64, right: 14, zIndex: 20, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', border: '1px solid rgba(59,130,246,0.35)', borderRadius: 10, padding: '8px 12px', minWidth: 120 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Zones</div>
          {zoneFixtureCounts.map(({ zone, count }) => (
            <div key={zone.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: zone.color || '#3b82f6', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{zone.label || 'Zone'}</span>
              </div>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{count} fix</span>
            </div>
          ))}
        </div>
      )}

      {/* Wattage + transformer recommendation chip */}
      {wattageInfo && (
        <div style={{ position: 'absolute', top: zoneFixtureCounts.length > 0 && tool !== 'zone' ? (64 + zoneFixtureCounts.length * 28 + 40) : 64, right: 14, zIndex: 20, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', border: '1px solid rgba(156,163,175,0.35)', borderRadius: 10, padding: '8px 12px', minWidth: 140 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Load</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{wattageInfo.totalW}W total</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>→ {wattageInfo.xfmr.name.replace(' Transformer', '').replace(' Slim Line', '').replace(' Multi-tap', '')}</div>
        </div>
      )}

      {/* Map Settings panel */}
      {settingsOpen && (() => {
        // Mountain silhouette path — used in every card
        const MtnPath = ({ fill }: { fill: string }) => (
          <svg width="100%" height="28" viewBox="0 0 80 28" preserveAspectRatio="none" style={{ display: 'block' }}>
            <path d="M0 28 L0 18 L10 10 L18 16 L26 6 L34 14 L42 4 L50 12 L58 8 L66 15 L74 11 L80 16 L80 28 Z" fill={fill}/>
          </svg>
        )

        const times = [
          {
            id: 'dawn' as const,
            label: 'Dawn',
            skyGrad: 'linear-gradient(180deg, #1a0a2e 0%, #3d1f5c 35%, #7b3f6e 65%, #c47a8a 85%, #e8a87c 100%)',
            mtFill: '#150820cc',
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <line x1="4" y1="17" x2="20" y2="17" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.6"/>
                <path d="M12 17 A5 5 0 0 1 7 17" stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
                <path d="M12 17 A5 5 0 0 0 17 17" stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
                <line x1="12" y1="9" x2="12" y2="7" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
                <line x1="7.8" y1="11.2" x2="6.4" y2="9.8" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
                <line x1="16.2" y1="11.2" x2="17.6" y2="9.8" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
                <line x1="5.5" y1="15" x2="3.5" y2="15" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
                <line x1="18.5" y1="15" x2="20.5" y2="15" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            ),
          },
          {
            id: 'day' as const,
            label: 'Day',
            skyGrad: 'linear-gradient(180deg, #0d3b6e 0%, #1565c0 30%, #1e88e5 60%, #64b5f6 85%, #bbdefb 100%)',
            mtFill: '#0a2540cc',
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="11" r="4" stroke="white" strokeWidth="1.4"/>
                <line x1="12" y1="3" x2="12" y2="5" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
                <line x1="12" y1="17" x2="12" y2="19" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
                <line x1="4" y1="11" x2="6" y2="11" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
                <line x1="18" y1="11" x2="20" y2="11" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
                <line x1="6.3" y1="5.3" x2="7.7" y2="6.7" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
                <line x1="16.3" y1="15.3" x2="17.7" y2="16.7" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
                <line x1="17.7" y1="5.3" x2="16.3" y2="6.7" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
                <line x1="7.7" y1="15.3" x2="6.3" y2="16.7" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            ),
          },
          {
            id: 'dusk' as const,
            label: 'Dusk',
            skyGrad: 'linear-gradient(180deg, #1a0a00 0%, #5c2200 25%, #b84400 50%, #e8720a 72%, #f5a623 88%, #fdd87a 100%)',
            mtFill: '#150800cc',
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <line x1="4" y1="17" x2="20" y2="17" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.6"/>
                <path d="M12 17 A4.5 4.5 0 0 1 7.5 17" stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
                <path d="M12 17 A4.5 4.5 0 0 0 16.5 17" stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
                <line x1="4.5" y1="14" x2="6" y2="14" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
                <line x1="18" y1="14" x2="19.5" y2="14" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
                <line x1="6.8" y1="11.5" x2="7.9" y2="12.6" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
                <line x1="17.2" y1="11.5" x2="16.1" y2="12.6" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            ),
          },
          {
            id: 'night' as const,
            label: 'Night',
            skyGrad: 'linear-gradient(180deg, #000005 0%, #050a1a 30%, #0a1535 60%, #0f1f4a 80%, #162454 100%)',
            mtFill: '#03060fcc',
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M20 13.5A8.5 8.5 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5z" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="17.5" cy="5.5" r="0.8" fill="white"/>
                <circle cx="20" cy="9" r="0.55" fill="white"/>
                <circle cx="15" cy="3.5" r="0.55" fill="white"/>
              </svg>
            ),
          },
        ]

        return (
          <>
            {/* Tap-outside backdrop */}
            <div onClick={() => setSettingsOpen(false)} style={{ position: 'absolute', inset: 0, zIndex: 19 }} />

            {/* Settings panel */}
            <div style={{
              position: 'absolute', top: 58, right: 16, zIndex: 20,
              background: 'rgba(10,10,14,0.92)', backdropFilter: 'blur(20px)',
              borderRadius: 18, padding: '14px 14px 12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.07) inset',
              minWidth: 320,
            }}>

              {/* Map Style row */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 7 }}>Map Style</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {([{ id: 'satellite' as const, icon: '◉', label: 'Satellite' }, { id: 'terrain' as const, icon: '⬡', label: 'Terrain' }]).map(opt => {
                    const isActive = mapStyle === opt.id
                    return (
                      <button key={opt.id} onClick={() => applyMapView(opt.id, timeOfDay)} style={{
                        flex: 1, height: 34, border: 'none', borderRadius: 9,
                        background: isActive ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
                        outline: isActive ? '1.5px solid rgba(255,255,255,0.25)' : '1.5px solid transparent',
                        color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
                        fontSize: 12, fontWeight: 500, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        transition: 'all 0.18s',
                      }}>
                        <span style={{ fontSize: 14 }}>{opt.icon}</span>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 12 }} />

              {/* Time of Day row */}
              <div>
                <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 7 }}>Time of Day</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {times.map(t => {
                    const isActive = timeOfDay === t.id
                    return (
                      <button
                        key={t.id}
                        className="upscape-time-btn"
                        onClick={() => { applyMapView(mapStyle, t.id); setSettingsOpen(false) }}
                        style={{
                          flex: 1, height: 64, padding: 0, border: 'none', borderRadius: 11,
                          cursor: 'pointer', position: 'relative', overflow: 'hidden',
                          outline: isActive ? '2px solid #F4884A' : '2px solid transparent',
                          outlineOffset: '-2px',
                          boxShadow: isActive ? '0 0 12px rgba(244,136,74,0.45)' : 'none',
                          transition: 'outline-color 0.2s, box-shadow 0.2s, transform 0.15s',
                        }}
                      >
                        <div style={{ position: 'absolute', inset: 0, background: t.skyGrad }} />
                        <div style={{
                          position: 'absolute', top: 7, left: 0, right: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.7))',
                        }}>{t.icon}</div>
                        <div style={{ position: 'absolute', bottom: 14, left: 0, right: 0 }}>
                          <MtnPath fill={t.mtFill} />
                        </div>
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 22, background: 'linear-gradient(0deg, rgba(0,0,0,0.72) 0%, transparent 100%)' }} />
                        <span style={{
                          position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center',
                          fontSize: 8.5, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
                          color: 'rgba(255,255,255,0.88)', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))',
                        }}>{t.label}</span>
                        {isActive && (
                          <div style={{
                            position: 'absolute', top: 4, right: 4,
                            width: 15, height: 15, borderRadius: '50%',
                            background: '#F4884A',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                          }}>
                            <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                              <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </>
        )
      })()}

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
          <button onClick={finishWire} style={bannerBtn}>Done</button>
          <button onClick={() => { clearWireMarkers(); setWirePoints([]); wireRef.current = []; setToolAndSync('select') }} style={bannerCancelBtn}>cancel</button>
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
          <button onClick={finishZone} disabled={zonePoints.length < 3} style={{ ...bannerBtn, background: zonePoints.length >= 3 ? '#F4884A' : 'rgba(255,255,255,0.1)', cursor: zonePoints.length >= 3 ? 'pointer' : 'default' }}>Done</button>
          <button onClick={() => { clearZoneMarkers(); setZonePoints([]); zoneRef.current = []; setToolAndSync('select') }} style={bannerCancelBtn}>cancel</button>
        </div>
      )}

      {/* toolbar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
        background: 'linear-gradient(0deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 60%, rgba(0,0,0,0) 100%)',
        paddingBottom: 'env(safe-area-inset-bottom, 6px)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 2, padding: '20px 12px 10px' }}>
          {TOOLS.map(t => {
            const isActive = tool === t.id
            const Icon = t.icon

            return (
              <button
                key={t.id}
                className={`upscape-tool${isActive ? ' upscape-tool-active' : ''}`}
                onClick={() => setToolAndSync(t.id)}
                style={{
                  flex: 1, maxWidth: 56,
                  opacity: isActive ? 1 : 0.42,
                  background: 'none',
                  border: 'none',
                  borderRadius: 10, padding: '6px 2px 6px',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                  position: 'relative',
                }}
              >

                {/* Icon area — always SVG, never photo */}
                <div style={{ position: 'relative', width: 36, height: 36 }}>
                  {isActive && (
                    <div style={{
                      position: 'absolute', inset: -3, borderRadius: '50%',
                      animation: 'ringPulse 1.6s ease-in-out infinite',
                      pointerEvents: 'none',
                    }} />
                  )}
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: isActive ? `${accentColor}20` : 'rgba(255,255,255,0.07)',
                    border: isActive ? `1.5px solid ${accentColor}66` : '1.5px solid rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: isActive ? `0 0 14px ${accentColor}44` : '0 2px 8px rgba(0,0,0,0.4)',
                    transition: 'background 0.18s, border-color 0.18s, box-shadow 0.18s',
                  }}>
                    <div style={{ color: isActive ? accentColor : 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon />
                    </div>
                  </div>
                </div>

                <span style={{
                  fontSize: 9, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase',
                  color: isActive ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)',
                  transition: 'color 0.18s',
                }}>{t.label}</span>
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

      {/* Project settings sheet */}
      {projectSettingsOpen && project && (
        <ProjectSettingsSheet
          project={project}
          projectId={projectId}
          onClose={() => setProjectSettingsOpen(false)}
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
    phone: (project as any).phone || '',
    email: (project as any).email || '',
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load current photo for this fixture type
  const [photo, setPhoto] = useState(() =>
    typeof window !== 'undefined' ? (localStorage.getItem(`upscape_fx_photo_${marker.type}`) || '') : ''
  )

  function handlePhotoUpload(file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      const url = e.target?.result as string
      localStorage.setItem(`upscape_fx_photo_${marker.type}`, url)
      setPhoto(url)
      window.dispatchEvent(new StorageEvent('storage', { key: `upscape_fx_photo_${marker.type}`, newValue: url }))
    }
    reader.readAsDataURL(file)
  }

  function clearPhoto() {
    localStorage.removeItem(`upscape_fx_photo_${marker.type}`)
    setPhoto('')
    window.dispatchEvent(new StorageEvent('storage', { key: `upscape_fx_photo_${marker.type}`, newValue: null }))
  }

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
    <div style={{
      position: 'absolute', bottom: 96, left: 14, right: 14, zIndex: 30,
      background: 'rgba(12,12,12,0.96)', backdropFilter: 'blur(24px)',
      borderRadius: 12,
      boxShadow: '0 12px 48px rgba(0,0,0,0.65), 0 1px 0 rgba(255,255,255,0.06) inset',
      overflow: 'hidden',
    }}>
      {/* header */}
      <div style={{ padding: '13px 16px 11px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          dangerouslySetInnerHTML={{ __html: markerSVG(marker.type) }} />
        <span style={{ fontWeight: 500, fontSize: 13, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.88)' }}>{fix?.label || marker.type}</span>
        <button onClick={() => onSave(marker)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4, transition: 'color 0.15s' }}>✕</button>
      </div>

      {/* Fixture type selector row */}
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

      <div style={{ padding: '13px 16px', display: 'flex', flexDirection: 'column', gap: 11 }}>

        {/* Photo row */}
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); e.target.value = '' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Thumbnail / upload trigger */}
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: 44, height: 44, borderRadius: 10, flexShrink: 0,
              overflow: 'hidden', cursor: 'pointer', position: 'relative',
              background: photo ? 'transparent' : 'rgba(255,255,255,0.05)',
              border: photo ? `1.5px solid ${color}55` : '1.5px dashed rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: photo ? `0 0 10px ${color}33` : 'none',
              transition: 'border-color .15s, box-shadow .15s',
            }}
          >
            {photo ? (
              <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.88)' }} />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            )}
          </div>

          {/* Label / actions */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
              Fixture Photo
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 500, padding: '4px 10px', cursor: 'pointer', letterSpacing: '-0.01em' }}
              >
                {photo ? 'Replace' : 'Upload'}
              </button>
              {photo && (
                <button
                  onClick={clearPhoto}
                  style={{ background: 'none', border: 'none', color: 'rgba(239,68,68,0.5)', fontSize: 11, cursor: 'pointer', padding: 0 }}
                >
                  Remove
                </button>
              )}
              {photo && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>applies to all {fix?.label || marker.type}s</span>}
            </div>
          </div>
        </div>

        {/* Qty */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <label style={labelSt}>Qty</label>
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: 7, overflow: 'hidden' }}>
            <button onClick={() => onChange({ ...marker, qty: Math.max(1, marker.qty - 1) })} style={{ width: 36, height: 34, background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 18, cursor: 'pointer' }}>−</button>
            <span style={{ fontSize: 15, fontWeight: 500, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.9)', minWidth: 28, textAlign: 'center' }}>{marker.qty}</span>
            <button onClick={() => onChange({ ...marker, qty: marker.qty + 1 })} style={{ width: 36, height: 34, background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 18, cursor: 'pointer' }}>+</button>
          </div>
        </div>

        {/* Label */}
        <div>
          <label style={labelSt}>Label</label>
          <input style={inputSt} value={marker.label} onChange={e => onChange({ ...marker, label: e.target.value })} placeholder="e.g. Front oak tree" />
        </div>

        {/* Notes */}
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
function UpIcon()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l9 16H3z"/></svg> }
function PathIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2"/></svg> }
function FloodIcon()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l10 18H2z"/><path d="M12 9l5.5 10H6.5z" fill="rgba(0,0,0,0.22)"/></svg> }
function WellIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/></svg> }
function PowerIcon()  { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2v8"/><path d="M8.56 4.69a9 9 0 1 0 6.88 0"/></svg> }
function WireIcon()   { return <svg width="18" height="16" viewBox="0 0 24 16" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 2"><path d="M2 8h20"/></svg> }
function ZoneIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12,3 20,9 17,20 7,20 4,9"/></svg> }
function SelectIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M4 2l16 10-8 2-4 8z"/></svg> }

// helpers
function wiresToGeoJSON(wires: Wire[]) {
  return { type: 'FeatureCollection' as const, features: wires.map(w => ({ type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: w.points }, properties: { wireId: w.id, feet: w.feet } })) }
}
function zonesToGeoJSON(zones: Zone[]) {
  return { type: 'FeatureCollection' as const, features: zones.map(z => ({ type: 'Feature' as const, geometry: { type: 'Polygon' as const, coordinates: [z.points] }, properties: { zoneId: z.id, color: z.color || '#3b82f6', label: z.label } })) }
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

const labelSt: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }
const inputSt: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 7, color: 'rgba(255,255,255,0.88)', fontSize: 13, letterSpacing: '-0.01em', padding: '9px 11px', outline: 'none' }
const sheetInput: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 14, padding: '9px 12px', outline: 'none' }
const topBtn: React.CSSProperties = { background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: 'rgba(255,255,255,0.6)', fontSize: 18, cursor: 'pointer', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
const bannerBtn: React.CSSProperties = { background: '#F4884A', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 700, padding: '5px 12px', cursor: 'pointer' }
const bannerCancelBtn: React.CSSProperties = { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 7, color: 'rgba(255,255,255,0.6)', fontSize: 12, padding: '5px 12px', cursor: 'pointer' }

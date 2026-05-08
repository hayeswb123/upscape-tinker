import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jusgscanbgeglqtolcov.supabase.co'
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1c2dzY2FuYmdlZ2xxdG9sY292Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNjgxNjUsImV4cCI6MjA5Mzg0NDE2NX0.V4NYUY3kykjc9t0mjnsjHIuHDiXokusFlUI_EEpJ6KI'

export const supabase = createClient(url, anon)

export type Project = {
  id: string
  user_id: string
  name: string
  address: string
  homeowner: string
  phone: string
  email: string
  lat: number | null
  lng: number | null
  status: 'draft' | 'quoted' | 'approved' | 'installed'
  selected_tier: 'budget' | 'mid' | 'premium'
  markers: Marker[]
  wires: Wire[]
  zones: Zone[]
  created_at: string
}

export type Marker = {
  id: string
  type: 'uplight' | 'path' | 'flood' | 'well' | 'downlight' | 'hardscape' | 'power'
  lat: number
  lng: number
  qty: number
  label: string
  notes: string
}

export type Wire = {
  id: string
  points: [number, number][]
  feet: number
}

export type Zone = {
  id: string
  label: string
  points: [number, number][]
}

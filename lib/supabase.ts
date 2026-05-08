import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

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

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://staaborqwrjsbapzkpuv.supabase.co'
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0YWFib3Jxd3Jqc2JhcHprcHV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNDIzNTUsImV4cCI6MjA5MzkxODM1NX0.fjBUQDzmfZ_Vs0kL_jqYe7zci6QLEg3TtHkozUs3O2I'

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
  status: 'draft' | 'quoted' | 'approved' | 'installed' | 'bidding'
  selected_tier: 'budget' | 'mid' | 'premium'
  markers: Marker[]
  wires: Wire[]
  zones: Zone[]
  cover_image: string | null
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
  color: string
  points: [number, number][]
  pointSets?: [number, number][][]  // multiple polygons merged into one zone
}

export type ElectricianProfile = {
  id: string
  user_id: string
  name: string
  company: string | null
  license: string | null
  phone: string | null
  bio: string | null
  verified: boolean
  created_at: string
}

export type BidJob = {
  id: string
  project_id: string
  owner_id: string
  labor_ceiling: number
  deadline: string
  status: 'open' | 'closed' | 'awarded'
  winner_id: string | null
  created_at: string
}

export type Bid = {
  id: string
  job_id: string
  electrician_id: string
  amount: number
  submitted_at: string
}

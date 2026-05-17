'use client'
import { useEffect, useState } from 'react'
import { supabase, BidJob, Bid, ElectricianProfile } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type JobWithBid = Omit<BidJob, 'labor_ceiling'> & {
  project_name?: string
  project_address?: string
  my_bid?: number
}

function Countdown({ deadline }: { deadline: string }) {
  const [remaining, setRemaining] = useState('')
  useEffect(() => {
    function update() {
      const diff = new Date(deadline).getTime() - Date.now()
      if (diff <= 0) { setRemaining('Closed'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setRemaining(`${h}h ${m}m left`)
    }
    update()
    const t = setInterval(update, 30000)
    return () => clearInterval(t)
  }, [deadline])
  return <span className={remaining === 'Closed' ? 'text-gray-500' : 'text-yellow-400'}>{remaining}</span>
}

export default function ElectricianDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<ElectricianProfile | null>(null)
  const [jobs, setJobs] = useState<JobWithBid[]>([])
  const [myBids, setMyBids] = useState<Bid[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/electrician/login'); return }

      const { data: prof } = await supabase
        .from('electrician_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!prof) { router.push('/electrician/signup'); return }
      setProfile(prof)

      // Load open jobs (no labor_ceiling exposed)
      const { data: jobRows } = await supabase
        .from('bid_jobs')
        .select('id,project_id,owner_id,deadline,status,winner_id,created_at')
        .eq('status', 'open')
        .order('deadline', { ascending: true })

      // Load own bids
      const { data: bidRows } = await supabase
        .from('bids')
        .select('*')
        .eq('electrician_id', prof.id)

      const bids: Bid[] = bidRows || []
      setMyBids(bids)

      // Enrich with project info
      const enriched: JobWithBid[] = await Promise.all((jobRows || []).map(async j => {
        const { data: proj } = await supabase
          .from('projects')
          .select('name,address')
          .eq('id', j.project_id)
          .maybeSingle()
        const myBid = bids.find(b => b.job_id === j.id)
        return {
          ...j,
          project_name: proj?.name,
          project_address: proj?.address,
          my_bid: myBid?.amount,
        }
      }))
      setJobs(enriched)
      setLoading(false)
    }
    load()
  }, [router])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/electrician/login')
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
      <p className="text-gray-500">Loading…</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      <header className="border-b border-[#1e1e1e] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-lg">Electrician Dashboard</h1>
          <p className="text-gray-500 text-sm">{profile?.name}{profile?.company ? ` · ${profile.company}` : ''}</p>
        </div>
        <button onClick={signOut} className="text-sm text-gray-400 hover:text-white">Sign out</button>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <h2 className="text-lg font-semibold mb-4">Open Jobs</h2>
        {jobs.length === 0 ? (
          <p className="text-gray-500">No open jobs right now. Check back soon.</p>
        ) : (
          <div className="space-y-3">
            {jobs.map(job => (
              <div key={job.id} className="bg-[#141414] border border-[#222] rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium truncate">{job.project_name || 'Untitled project'}</p>
                  <p className="text-gray-500 text-sm truncate">{job.project_address}</p>
                  <p className="text-xs mt-1"><Countdown deadline={job.deadline} /></p>
                </div>
                <div className="text-right shrink-0">
                  {job.my_bid != null && (
                    <p className="text-sm text-green-400 mb-1">Your bid: ${job.my_bid.toLocaleString()}</p>
                  )}
                  <Link
                    href={`/bid/${job.id}`}
                    className="inline-block px-4 py-1.5 rounded-lg bg-[#F4884A] text-sm font-medium hover:bg-[#e07030] transition-colors"
                  >
                    {job.my_bid != null ? 'Update bid' : 'Place bid'}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {myBids.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-semibold mb-4">My Bid History</h2>
            <div className="space-y-2">
              {myBids.map(b => (
                <div key={b.id} className="bg-[#141414] border border-[#222] rounded-lg px-4 py-3 flex justify-between text-sm">
                  <span className="text-gray-400">{new Date(b.submitted_at).toLocaleDateString()}</span>
                  <span>${b.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

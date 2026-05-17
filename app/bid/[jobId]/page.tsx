'use client'
import { use, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

function Countdown({ deadline }: { deadline: string }) {
  const [remaining, setRemaining] = useState('')
  useEffect(() => {
    function update() {
      const diff = new Date(deadline).getTime() - Date.now()
      if (diff <= 0) { setRemaining('Deadline passed'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setRemaining(`${h}h ${m}m remaining`)
    }
    update()
    const t = setInterval(update, 30000)
    return () => clearInterval(t)
  }, [deadline])
  return <span>{remaining}</span>
}

export default function BidPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params)
  const router = useRouter()
  const [job, setJob] = useState<{
    id: string; deadline: string; labor_ceiling: number; status: string;
    project_name?: string; project_address?: string; fixture_count?: number
  } | null>(null)
  const [electricianId, setElectricianId] = useState<string | null>(null)
  const [existingBid, setExistingBid] = useState<number | null>(null)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/electrician/login'); return }

      const { data: prof } = await supabase
        .from('electrician_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!prof) { router.push('/electrician/signup'); return }
      setElectricianId(prof.id)

      const { data: jobRow } = await supabase
        .from('bid_jobs')
        .select('id,deadline,labor_ceiling,status,project_id')
        .eq('id', jobId)
        .maybeSingle()
      if (!jobRow) { router.push('/electrician/dashboard'); return }

      const { data: proj } = await supabase
        .from('projects')
        .select('name,address,markers')
        .eq('id', jobRow.project_id)
        .maybeSingle()

      const fixtureCount = (proj?.markers || []).filter((m: { type: string }) => m.type !== 'power').reduce((s: number, m: { qty?: number }) => s + (m.qty || 1), 0)

      setJob({
        ...jobRow,
        project_name: proj?.name,
        project_address: proj?.address,
        fixture_count: fixtureCount,
      })

      const { data: bid } = await supabase
        .from('bids')
        .select('amount')
        .eq('job_id', jobId)
        .eq('electrician_id', prof.id)
        .maybeSingle()
      if (bid) {
        setExistingBid(bid.amount)
        setAmount(String(bid.amount))
      }

      setLoading(false)
    }
    load()
  }, [jobId, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!job || !electricianId) return
    setError('')
    const num = parseFloat(amount)
    if (isNaN(num) || num <= 0) { setError('Enter a valid dollar amount.'); return }
    if (num > job.labor_ceiling) { setError('Price too expensive for this job.'); return }

    setSubmitting(true)
    try {
      const { error: upsertErr } = await supabase.from('bids').upsert(
        { job_id: jobId, electrician_id: electricianId, amount: num, submitted_at: new Date().toISOString() },
        { onConflict: 'job_id,electrician_id' }
      )
      if (upsertErr) throw upsertErr
      setSuccess(true)
      setExistingBid(num)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit bid')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
      <p className="text-gray-500">Loading…</p>
    </div>
  )
  if (!job) return null

  const isClosed = job.status !== 'open' || new Date(job.deadline) <= new Date()

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      <header className="border-b border-[#1e1e1e] px-6 py-4">
        <button onClick={() => router.push('/electrician/dashboard')} className="text-gray-400 hover:text-white text-sm mb-3">← Back</button>
        <h1 className="text-xl font-bold">{job.project_name || 'Untitled project'}</h1>
        <p className="text-gray-500 text-sm">{job.project_address}</p>
      </header>

      <main className="max-w-lg mx-auto px-6 py-8">
        <div className="bg-[#141414] border border-[#222] rounded-xl p-5 mb-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Fixtures</span>
            <span>{job.fixture_count ?? '—'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Deadline</span>
            <span className="text-yellow-400"><Countdown deadline={job.deadline} /></span>
          </div>
          {existingBid != null && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Your current bid</span>
              <span className="text-green-400">${existingBid.toLocaleString()}</span>
            </div>
          )}
        </div>

        {isClosed ? (
          <p className="text-gray-500 text-center py-8">This job is no longer accepting bids.</p>
        ) : success ? (
          <div className="text-center py-8">
            <p className="text-green-400 text-lg font-semibold mb-2">Bid submitted!</p>
            <p className="text-gray-500 text-sm mb-6">You can update your bid any time before the deadline.</p>
            <button
              onClick={() => { setSuccess(false) }}
              className="px-4 py-2 rounded-lg border border-[#333] text-sm hover:border-[#555] transition-colors"
            >
              Update bid
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Your bid (labor only)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg pl-8 pr-3 py-2 text-white focus:outline-none focus:border-[#F4884A]"
                />
              </div>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 rounded-lg bg-[#F4884A] text-white font-medium hover:bg-[#e07030] disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Submitting…' : existingBid != null ? 'Update bid' : 'Submit bid'}
            </button>
          </form>
        )}
      </main>
    </div>
  )
}

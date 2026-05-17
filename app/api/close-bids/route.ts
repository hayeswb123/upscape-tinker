import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  const { jobId } = await req.json()
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })

  const { data: job } = await supabase
    .from('bid_jobs')
    .select('id,project_id,deadline,status')
    .eq('id', jobId)
    .maybeSingle()

  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (job.status !== 'open') return NextResponse.json({ message: 'Already closed' })
  if (new Date(job.deadline) > new Date()) return NextResponse.json({ error: 'Deadline not yet reached' }, { status: 400 })

  const { data: bids } = await supabase
    .from('bids')
    .select('electrician_id,amount')
    .eq('job_id', jobId)
    .order('amount', { ascending: true })

  if (!bids || bids.length === 0) {
    await supabase.from('bid_jobs').update({ status: 'closed' }).eq('id', jobId)
    return NextResponse.json({ message: 'Closed with no bids' })
  }

  const winner = bids[0]
  await supabase.from('bid_jobs').update({ status: 'awarded', winner_id: winner.electrician_id }).eq('id', jobId)
  await supabase.from('projects').update({ status: 'approved' }).eq('id', job.project_id)

  return NextResponse.json({ winner_electrician_id: winner.electrician_id, amount: winner.amount })
}

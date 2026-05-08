import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { TIERS, calcQuote } from '@/lib/catalog'

export async function POST(req: NextRequest) {
  const { projectId } = await req.json()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!project.email) return NextResponse.json({ error: 'No email' }, { status: 400 })

  const tierId = project.selected_tier || 'premium'
  const tier = TIERS[tierId as keyof typeof TIERS]
  const quote = calcQuote(project)
  const q = quote[tierId as keyof typeof quote]
  const fmt = (n: number) => '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })

  const lineRows = q.lines.map(l => `
    <tr>
      <td style="padding:8px 16px;border-bottom:1px solid #2e2e2e;color:#ccc">${l.label}</td>
      <td style="padding:8px 4px;border-bottom:1px solid #2e2e2e;color:#888;text-align:right">×${l.qty}</td>
      <td style="padding:8px 16px;border-bottom:1px solid #2e2e2e;text-align:right;font-weight:600">${fmt(l.total)}</td>
    </tr>
  `).join('')

  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="background:#0f0f0f;color:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;margin:0;padding:32px 16px">
  <div style="max-width:520px;margin:0 auto">
    <div style="text-align:center;margin-bottom:32px">
      <div style="font-size:22px;font-weight:700;letter-spacing:0.12em">UPSCAPE</div>
      <div style="font-size:13px;color:#888;margin-top:4px">Landscape Lighting Proposal</div>
      <div style="font-size:15px;color:#ccc;margin-top:8px">${project.address}</div>
    </div>

    <div style="background:#1a1a1a;border-radius:14px;overflow:hidden;border-top:3px solid ${tier.color}">
      <div style="padding:16px">
        <span style="font-weight:700;font-size:18px;color:${tier.color}">${tier.label}</span>
        <span style="font-size:13px;color:#888;margin-left:8px">${tier.tagline}</span>
        <div style="font-size:11px;color:#888;margin-top:2px">${tier.note}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tbody>${lineRows}</tbody>
      </table>
      <div style="padding:12px 16px;background:#242424;display:flex;justify-content:space-between;font-size:13px;color:#888">
        <span>Labor</span><span>${fmt(q.labor)}</span>
      </div>
      <div style="padding:14px 16px;background:#1a1a1a;display:flex;justify-content:space-between;align-items:center">
        <span style="font-weight:700;font-size:16px">Total</span>
        <span style="font-weight:700;font-size:22px;color:${tier.color}">${fmt(q.total)}</span>
      </div>
    </div>

    <p style="text-align:center;color:#888;font-size:13px;margin-top:24px">Questions? Reply to this email or call your Upscape designer.</p>
  </div>
</body></html>`

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: project.email, name: project.homeowner }] }],
      from: { email: process.env.SENDGRID_FROM || 'notifications@getupscaped.com', name: 'Upscape Lighting' },
      subject: `Your Landscape Lighting Proposal — ${project.address}`,
      content: [{ type: 'text/html', value: html }],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: text }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

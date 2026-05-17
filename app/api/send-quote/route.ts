import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { TIERS, calcQuote, type TierId } from '@/lib/catalog'

const fmt = (n: number) => '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })

function tierBlock(tierId: TierId, project: any) {
  const tier = TIERS[tierId]
  const q = calcQuote(project)[tierId]

  const lineRows = q.lines.map(l => `
    <tr>
      <td style="padding:8px 16px;border-bottom:1px solid #2e2e2e">
        <div style="color:#ccc;font-size:14px">${l.label}</div>
        ${l.sku ? `<div style="font-size:11px;color:#555;margin-top:2px">${l.url ? `<a href="${l.url}" style="color:#F4884A;text-decoration:none">${l.sku}</a>` : l.sku}</div>` : ''}
      </td>
      <td style="padding:8px 4px;border-bottom:1px solid #2e2e2e;color:#666;text-align:right;white-space:nowrap;font-size:13px">
        ×${l.qty}<br><span style="font-size:11px;color:#555">${fmt(l.unitPrice)} ea</span>
      </td>
      <td style="padding:8px 16px;border-bottom:1px solid #2e2e2e;text-align:right;font-weight:600;white-space:nowrap;color:#eee">${fmt(l.total)}</td>
    </tr>
  `).join('')

  return `
    <div style="background:#1a1a1a;border-radius:14px;overflow:hidden;border-top:3px solid ${tier.color};margin-bottom:24px">
      <div style="padding:16px 16px 10px">
        <span style="font-weight:700;font-size:18px;color:${tier.color}">${tier.label}</span>
        <span style="font-size:13px;color:#888;margin-left:8px">${tier.tagline}</span>
        <div style="font-size:11px;color:#666;margin-top:3px">${tier.note}</div>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <tbody>${lineRows}</tbody>
      </table>
      <div style="padding:8px 16px;background:#222;display:flex;justify-content:space-between;font-size:13px;color:#888;border-top:1px solid #2e2e2e">
        <span>Labor</span><span>${fmt(q.labor)}</span>
      </div>
      <div style="padding:8px 16px;background:#222;display:flex;justify-content:space-between;font-size:13px;color:#888;border-top:1px solid #2e2e2e">
        <span>Wire (${Math.round((project.wires||[]).reduce((s:number,w:any)=>s+(w.feet||0),0))} ft)</span><span>${fmt(q.wire)}</span>
      </div>
      <div style="padding:14px 16px;background:#1a1a1a;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #2e2e2e">
        <span style="font-weight:700;font-size:15px;color:#eee">Total</span>
        <span style="font-weight:700;font-size:22px;color:${tier.color}">${fmt(q.total)}</span>
      </div>
    </div>
  `
}

export async function POST(req: NextRequest) {
  const { projectId, tiers } = await req.json()
  const tierList: TierId[] = (tiers && tiers.length > 0) ? tiers : ['premium']

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!project.email) return NextResponse.json({ error: 'No email' }, { status: 400 })

  const tierCount = tierList.length
  const subjectSuffix = tierCount === 1
    ? `${TIERS[tierList[0]].label} Package`
    : `${tierCount} Options`

  const tierBlocks = tierList.map(t => tierBlock(t, project)).join('')

  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="background:#0f0f0f;color:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;margin:0;padding:32px 16px">
  <div style="max-width:560px;margin:0 auto">
    <div style="text-align:center;margin-bottom:28px">
      <div style="font-size:22px;font-weight:700;letter-spacing:0.12em;color:#fff">UPSCAPE</div>
      <div style="font-size:13px;color:#666;margin-top:4px">Landscape Lighting Proposal</div>
      <div style="font-size:15px;color:#ccc;margin-top:6px">${project.address}</div>
      ${project.homeowner ? `<div style="font-size:13px;color:#888;margin-top:2px">Prepared for ${project.homeowner}</div>` : ''}
    </div>

    ${tierCount > 1 ? `<p style="font-size:13px;color:#888;margin:0 0 20px;text-align:center">We've prepared ${tierCount} options for your review. Each includes all fixtures, professional installation labor, and wiring.</p>` : ''}

    ${tierBlocks}

    <div style="background:#1a1a1a;border-radius:12px;padding:16px;margin-bottom:24px;border:1px solid #2e2e2e">
      <div style="font-weight:600;font-size:13px;color:#ccc;margin-bottom:10px">What's included</div>
      <div style="display:grid;gap:6px">
        ${[
          ['🔧', 'Professional installation by a licensed technician'],
          ['💡', 'All fixtures, transformers, and connectors'],
          ['🔌', 'Low-voltage wiring and zone setup'],
          ['✅', 'Post-install walkthrough and timer programming'],
        ].map(([icon, text]) => `
          <div style="display:flex;align-items:flex-start;gap:10px;font-size:13px;color:#888">
            <span style="font-size:15px">${icon}</span>
            <span>${text}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <p style="text-align:center;color:#666;font-size:12px;margin-top:16px">Questions? Reply to this email or call your Upscape designer.</p>
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
      subject: `Your Landscape Lighting Proposal — ${subjectSuffix}`,
      content: [{ type: 'text/html', value: html }],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: text }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export const TIERS = {
  budget:  { id: 'budget',  label: 'Sunvie',  tagline: 'Budget pick',   color: '#64B5F6', note: 'Chinese import · 1-yr warranty' },
  mid:     { id: 'mid',     label: 'VOLT',    tagline: 'Best value',    color: '#81C784', note: 'American brand · 3-yr warranty' },
  premium: { id: 'premium', label: 'AMP',     tagline: 'Gold standard', color: '#F4884A', note: 'All brass · Lifetime warranty'  },
} as const

export type TierId = keyof typeof TIERS

export const FIXTURES = {
  uplight:    { label: 'Uplight',    color: '#F4884A', laborEach: 45, tiers: { budget: { name: 'MR16 Spotlight',       sku: 'SV-SPOT-MR16',  price: 18.99 }, mid: { name: 'Luminator MR16 Spot',  sku: 'VL-MR16-36',    price: 39.99 }, premium: { name: 'PinnaclePro MR16',     sku: 'AAL-1017-B-BZ', price: 55.99 } } },
  path:       { label: 'Path',       color: '#F5C842', laborEach: 40, tiers: { budget: { name: 'Low Path Bollard',     sku: 'SV-PATH-01',    price: 14.99 }, mid: { name: 'Bollard Path Light',   sku: 'VL-PATH-01',    price: 34.99 }, premium: { name: 'MagnumPro Path',       sku: 'AAR-3516-B-BZ', price: 74.99 } } },
  flood:      { label: 'Flood',      color: '#EF4444', laborEach: 50, tiers: { budget: { name: 'Area Flood',           sku: 'SV-FLOOD-01',   price: 24.99 }, mid: { name: 'PAR36 Flood',          sku: 'VL-FLOOD-01',   price: 48.99 }, premium: { name: 'ParamountPro Flood',   sku: 'AFL-4013-B-BZ', price: 94.99 } } },
  well:       { label: 'Well',       color: '#3B82F6', laborEach: 55, tiers: { budget: { name: 'In-Grade Spot',        sku: 'SV-WELL-01',    price: 22.99 }, mid: { name: 'In-Grade MR16',        sku: 'VL-WELL-01',    price: 42.99 }, premium: { name: 'HydraPro In-Grade',    sku: 'AWL-5004-B-BZ', price: 65.99 } } },
  downlight:  { label: 'Down',       color: '#8B5CF6', laborEach: 55, tiers: { budget: { name: 'Downlight',            sku: 'SV-DOWN-01',    price: 19.99 }, mid: { name: 'Downlight',            sku: 'VL-DOWN-01',    price: 44.99 }, premium: { name: 'DiffusePro Flood',     sku: 'AFL-4010-B-BZ', price: 59.99 } } },
  hardscape:  { label: 'Step',       color: '#F97316', laborEach: 40, tiers: { budget: { name: 'Step Light',           sku: 'SV-HARD-01',    price: 18.99 }, mid: { name: 'Hardscape Light',      sku: 'VL-HARD-01',    price: 36.99 }, premium: { name: 'DescentPro Hardscape', sku: 'AHS-7004-B-BZ', price: 49.99 } } },
  power:      { label: 'Power',      color: '#9CA3AF', laborEach: 60, tiers: { budget: { name: '150W Transformer',     sku: 'VL-TR-150',     price: 89.99 }, mid: { name: '300W Transformer',     sku: 'VL-TR-300',     price: 149.99 }, premium: { name: '600W Pro Transformer', sku: 'VL-TR-600',     price: 229.99 } } },
} as const

export type FixtureType = keyof typeof FIXTURES

const WIRE_COST_PER_FOOT = 0.45

export function calcQuote(project: { markers: Array<{ type: string; qty: number }>; wires: Array<{ feet: number }> }) {
  const wireFeet = project.wires.reduce((s, w) => s + (w.feet || 0), 0)

  return (Object.keys(TIERS) as TierId[]).reduce((acc, tierId) => {
    const lines: { label: string; qty: number; total: number }[] = []
    let fixtures = 0, labor = 0

    for (const m of project.markers) {
      const type = m.type as FixtureType
      if (type === 'power') continue
      const fix = FIXTURES[type]
      if (!fix) continue
      const tier = fix.tiers[tierId]
      const qty = m.qty || 1
      const total = tier.price * qty
      lines.push({ label: `${fix.label} – ${tier.name}`, qty, total })
      fixtures += total
      labor += fix.laborEach * qty
    }

    const powerMarkers = project.markers.filter(m => m.type === 'power')
    if (powerMarkers.length > 0) {
      const t = FIXTURES.power.tiers[tierId]
      const qty = powerMarkers.reduce((s, m) => s + (m.qty || 1), 0)
      const total = t.price * qty
      lines.push({ label: `Transformer – ${t.name}`, qty, total })
      fixtures += total
      labor += FIXTURES.power.laborEach * qty
    }

    const wire = wireFeet * WIRE_COST_PER_FOOT
    acc[tierId] = { lines, fixtures, labor, wire, total: fixtures + labor + wire }
    return acc
  }, {} as Record<TierId, { lines: { label: string; qty: number; total: number }[]; fixtures: number; labor: number; wire: number; total: number }>)
}

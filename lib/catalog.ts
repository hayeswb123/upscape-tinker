export const TIERS = {
  budget:  { id: 'budget',  label: 'Sunvie',      tagline: 'Budget pick',    color: '#64B5F6', note: 'Chinese import · 1-yr warranty'    },
  mid:     { id: 'mid',     label: 'AMP Standard', tagline: 'Best value',     color: '#81C784', note: 'All brass · 3-yr warranty'          },
  premium: { id: 'premium', label: 'AMP Premium',  tagline: 'Gold standard',  color: '#F4884A', note: 'All brass · Lifetime warranty'      },
} as const

export type TierId = keyof typeof TIERS

export const FIXTURES = {
  uplight: {
    label: 'Uplight', color: '#F4884A', laborEach: 45,
    tiers: {
      budget:  { name: 'SUNVIE 12W Spotlight',        sku: 'B07FYF9XCC',      price: 7.00,  url: 'https://www.amazon.com/dp/B07FYF9XCC' },
      mid:     { name: 'Luminator MR16 Spot',         sku: 'VL-MR16-36',      price: 39.99, url: '' },
      premium: { name: 'PinnaclePro MR16 Spotlight',  sku: 'AAL-1017-B-BZ',   price: 55.99, url: 'https://www.amplighting.com/pinnaclepro-mr16-spotlight-lamp-ready' },
    },
  },
  path: {
    label: 'Path', color: '#F5C842', laborEach: 40,
    tiers: {
      budget:  { name: 'SUNVIE 3W Bollard Path',      sku: 'B0CJ4HXMZX',      price: 13.33, url: 'https://www.amazon.com/dp/B0CJ4HXMZX' },
      mid:     { name: 'Bollard Path Light',           sku: 'VL-PATH-01',      price: 34.99, url: '' },
      premium: { name: 'MagnumPro Path & Area Light',  sku: 'AAR-3516-B-BZ',   price: 74.99, url: 'https://www.amplighting.com/magnumpro-brass-path-area-light-lamp-ready' },
    },
  },
  flood: {
    label: 'Flood', color: '#EF4444', laborEach: 50,
    tiers: {
      budget:  { name: 'SUNVIE 12W Flood Spot',        sku: 'B07ZKH3YSV',      price: 8.00,  url: 'https://www.amazon.com/dp/B07ZKH3YSV' },
      mid:     { name: 'PAR36 Flood',                  sku: 'VL-FLOOD-01',     price: 48.99, url: '' },
      premium: { name: 'ParamountPro LED Flood',        sku: 'AFL-4013-B-BZ',   price: 94.99, url: 'https://www.amplighting.com/paramountpro-led-flood-light-constant-output' },
    },
  },
  well: {
    label: 'Well', color: '#3B82F6', laborEach: 55,
    tiers: {
      budget:  { name: 'SUNVIE 12W In-Ground Well',    sku: 'B09B74KVMP',      price: 9.17,  url: 'https://www.amazon.com/dp/B09B74KVMP' },
      mid:     { name: 'In-Grade MR16',                sku: 'VL-WELL-01',      price: 42.99, url: '' },
      premium: { name: 'HydraPro MR16 In-Grade',       sku: 'AWL-5004-B-BZ',   price: 65.99, url: 'https://www.amplighting.com/hydrapro-mr16-in-grade-light' },
    },
  },
  downlight: {
    label: 'Down', color: '#8B5CF6', laborEach: 55,
    tiers: {
      budget:  { name: 'SUNVIE 12W Downlight',          sku: 'B07M5QJM3Z',      price: 10.00, url: 'https://www.amazon.com/dp/B07M5QJM3Z' },
      mid:     { name: 'Downlight',                     sku: 'VL-DOWN-01',      price: 44.99, url: '' },
      premium: { name: 'DiffusePro Flood Light',         sku: 'AFL-4010-B-BZ',   price: 59.99, url: 'https://www.amplighting.com/diffusepro-flood-light-lamp-ready' },
    },
  },
  hardscape: {
    label: 'Step', color: '#F97316', laborEach: 40,
    tiers: {
      budget:  { name: 'SUNVIE 5W Step Light',          sku: 'B09F6N9MPJ',      price: 9.75,  url: 'https://www.amazon.com/dp/B09F6N9MPJ' },
      mid:     { name: 'Hardscape Light',               sku: 'VL-HARD-01',      price: 36.99, url: '' },
      premium: { name: 'DescentPro Hardscape Light',     sku: 'AHS-7004-B-BZ',   price: 49.99, url: 'https://www.amplighting.com/descentpro-hardscape-light' },
    },
  },
  power: {
    label: 'Power', color: '#9CA3AF', laborEach: 60,
    tiers: {
      budget:  { name: 'SUNVIE 120W Transformer',       sku: 'B0DBH8SR83',      price: 64.99, url: 'https://www.amazon.com/dp/B0DBH8SR83' },
      mid:     { name: 'SUNVIE 300W Transformer',       sku: 'B0B7XH7SW5',      price: 99.99, url: 'https://www.amazon.com/dp/B0B7XH7SW5' },
      // AMP transformer is selected dynamically by wattage in calcQuote
      premium: { name: '300W Slim Line Transformer',    sku: 'ATR-300SL-SS-R1-BUNDLE', price: 209.99, url: 'https://www.amplighting.com/300-watt-slim-line-led-transformer' },
    },
  },
} as const

export type FixtureType = keyof typeof FIXTURES

// AMP transformer tiers by wattage load
const AMP_TRANSFORMERS = [
  { maxW: 100,  name: '100W Slim Line Transformer', sku: 'ATR-100SL-SS-R1-BUNDLE',    price: 134.99, url: 'https://www.amplighting.com/100-watt-slim-line-led-transformer' },
  { maxW: 150,  name: '150W Slim Line Transformer', sku: 'ATR-150SL-SS-R1-BUNDLE',    price: 179.99, url: 'https://www.amplighting.com/150-watt-slim-line-led-transformer' },
  { maxW: 300,  name: '300W Slim Line Transformer', sku: 'ATR-300SL-SS-R1-BUNDLE',    price: 209.99, url: 'https://www.amplighting.com/300-watt-slim-line-led-transformer' },
  { maxW: 600,  name: '600W Multi-tap Transformer', sku: 'BDL-ATR-600-SS-J1',         price: 249.99, url: 'https://www.amplighting.com/600w-multi-tap-low-voltage-transformer' },
  { maxW: 900,  name: '900W Multi-tap Transformer', sku: 'BDL-VTR-900P-SS',           price: 549.99, url: 'https://www.amplighting.com/pro-900-watt-12v-22v-multi-tap-transformer' },
  { maxW: 9999, name: '1200W Multi-tap Transformer', sku: 'VTR-1200',                 price: 699.99, url: 'https://www.amplighting.com/low-voltage-multitap-transformer-outdoor-lighting-1200' },
]

// Estimated wattage per fixture type (typical 5W MR16 LEDs)
const FIXTURE_WATTS: Record<string, number> = {
  uplight: 5, path: 3, flood: 7, well: 5, downlight: 5, hardscape: 3,
}

const WIRE_COST_PER_FOOT = 0.44 // based on AMP 12/2 cable: $109.99/250ft

export function calcQuote(project: { markers: Array<{ type: string; qty: number }>; wires: Array<{ feet: number }> }) {
  const wireFeet = (project.wires || []).reduce((s, w) => s + (w.feet || 0), 0)

  // Estimate total wattage for transformer sizing
  const totalWatts = (project.markers || []).reduce((s, m) => {
    const w = FIXTURE_WATTS[m.type] || 0
    return s + w * (m.qty || 1)
  }, 0)

  return (Object.keys(TIERS) as TierId[]).reduce((acc, tierId) => {
    const lines: { label: string; qty: number; unitPrice: number; total: number; sku: string; url: string }[] = []
    let fixtures = 0, labor = 0

    for (const m of (project.markers || [])) {
      const type = m.type as FixtureType
      if (type === 'power') continue
      const fix = FIXTURES[type]
      if (!fix) continue
      const tier = fix.tiers[tierId]
      const qty = m.qty || 1
      const unitPrice = tier.price
      const total = unitPrice * qty
      lines.push({ label: `${fix.label} – ${tier.name}`, qty, unitPrice, total, sku: tier.sku, url: tier.url })
      fixtures += total
      labor += fix.laborEach * qty
    }

    // Transformer: auto-size by wattage for AMP, fixed for others
    const powerMarkers = (project.markers || []).filter(m => m.type === 'power')
    const numTransformers = powerMarkers.reduce((s, m) => s + (m.qty || 1), 0) || 1

    if (tierId === 'premium') {
      const xfmr = AMP_TRANSFORMERS.find(t => t.maxW >= totalWatts / numTransformers) || AMP_TRANSFORMERS[AMP_TRANSFORMERS.length - 1]
      const total = xfmr.price * numTransformers
      lines.push({ label: `Transformer – ${xfmr.name}`, qty: numTransformers, unitPrice: xfmr.price, total, sku: xfmr.sku, url: xfmr.url })
      fixtures += total
      labor += FIXTURES.power.laborEach * numTransformers
    } else {
      const t = FIXTURES.power.tiers[tierId]
      const qty = numTransformers
      const total = t.price * qty
      lines.push({ label: `Transformer – ${t.name}`, qty, unitPrice: t.price, total, sku: t.sku, url: t.url })
      fixtures += total
      labor += FIXTURES.power.laborEach * qty
    }

    const wire = wireFeet * WIRE_COST_PER_FOOT
    acc[tierId] = { lines, fixtures, labor, wire, total: fixtures + labor + wire, totalWatts }
    return acc
  }, {} as Record<TierId, { lines: { label: string; qty: number; unitPrice: number; total: number; sku: string; url: string }[]; fixtures: number; labor: number; wire: number; total: number; totalWatts: number }>)
}

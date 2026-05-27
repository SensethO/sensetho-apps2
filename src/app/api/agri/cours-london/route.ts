/**
 * GET /api/agri/cours-london
 *
 * Retourne les cours des futures sur les bourses de Londres (ICE Futures Europe)
 * pour le cacao et le café robusta.
 *
 * Sources :
 *   - Stooq.com (gratuit, sans clé API, CSV)
 *   - Cacao Londres : cca.f  (USD/tonne, ICE Futures Europe)
 *   - Café Robusta  : rca.f  (USD/tonne, ICE Futures Europe)
 *
 * Retourne les 30 derniers jours de cotations + données résumées.
 * Fallback mock si Stooq indisponible.
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

interface PriceEntry {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface CommodityPrices {
  symbol: string
  name: string
  exchange: string
  currency: string
  unit: string
  prices: PriceEntry[]
  last_close: number | null
  change_pct: number | null   // variation % sur 5 jours
  mock: boolean
}

function parseStooqCsv(csv: string): PriceEntry[] {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return []
  // Header: Date,Open,High,Low,Close,Volume
  const entries: PriceEntry[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    if (cols.length < 5) continue
    const [date, open, high, low, close, volume] = cols
    if (!date || date === 'N/D') continue
    entries.push({
      date: date.trim(),
      open: parseFloat(open) || 0,
      high: parseFloat(high) || 0,
      low: parseFloat(low) || 0,
      close: parseFloat(close) || 0,
      volume: parseInt(volume ?? '0', 10) || 0,
    })
  }
  return entries.sort((a, b) => a.date.localeCompare(b.date)).slice(-30)
}

async function fetchStooq(symbol: string): Promise<PriceEntry[]> {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 60) // 60 jours pour avoir 30 jours ouvrés

  const d1 = from.toISOString().slice(0, 10).replace(/-/g, '')
  const d2 = to.toISOString().slice(0, 10).replace(/-/g, '')

  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&d1=${d1}&d2=${d2}&i=d`
  const res = await fetch(url, {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(8000),
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })

  if (!res.ok) throw new Error(`Stooq HTTP ${res.status}`)
  const csv = await res.text()
  const entries = parseStooqCsv(csv)
  if (entries.length === 0) throw new Error('Stooq: no data')
  return entries
}

function generateMockPrices(basePrice: number): PriceEntry[] {
  const entries: PriceEntry[] = []
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    if (d.getDay() === 0 || d.getDay() === 6) continue
    const date = d.toISOString().slice(0, 10)
    const drift = (Math.random() - 0.48) * basePrice * 0.015
    const open = +(basePrice + drift * i * 0.05).toFixed(0)
    const high = +(open * (1 + Math.random() * 0.01)).toFixed(0)
    const low = +(open * (1 - Math.random() * 0.01)).toFixed(0)
    const close = +(low + Math.random() * (high - low)).toFixed(0)
    entries.push({ date, open, high, low, close, volume: Math.round(3000 + Math.random() * 10000) })
  }
  return entries
}

function computeChangePct(prices: PriceEntry[]): number | null {
  if (prices.length < 6) return null
  const last = prices[prices.length - 1].close
  const prev = prices[prices.length - 6].close
  if (!prev) return null
  return +((last - prev) / prev * 100).toFixed(2)
}

export async function GET() {
  const results: { cacao: CommodityPrices; cafe: CommodityPrices } = {
    cacao: {
      symbol: 'cca.f',
      name: 'Cacao Londres',
      exchange: 'ICE Futures Europe',
      currency: 'USD',
      unit: 'USD/tonne',
      prices: [],
      last_close: null,
      change_pct: null,
      mock: false,
    },
    cafe: {
      symbol: 'rca.f',
      name: 'Café Robusta Londres',
      exchange: 'ICE Futures Europe',
      currency: 'USD',
      unit: 'USD/tonne',
      prices: [],
      last_close: null,
      change_pct: null,
      mock: false,
    },
  }

  // Cacao Londres
  try {
    const prices = await fetchStooq('cca.f')
    results.cacao.prices = prices
    results.cacao.last_close = prices.length > 0 ? prices[prices.length - 1].close : null
    results.cacao.change_pct = computeChangePct(prices)
  } catch {
    const prices = generateMockPrices(3800)
    results.cacao.prices = prices
    results.cacao.last_close = prices[prices.length - 1]?.close ?? null
    results.cacao.change_pct = computeChangePct(prices)
    results.cacao.mock = true
  }

  // Café Robusta Londres
  try {
    const prices = await fetchStooq('rca.f')
    results.cafe.prices = prices
    results.cafe.last_close = prices.length > 0 ? prices[prices.length - 1].close : null
    results.cafe.change_pct = computeChangePct(prices)
  } catch {
    const prices = generateMockPrices(2100)
    results.cafe.prices = prices
    results.cafe.last_close = prices[prices.length - 1]?.close ?? null
    results.cafe.change_pct = computeChangePct(prices)
    results.cafe.mock = true
  }

  const headers = new Headers()
  headers.set('Cache-Control', 'public, max-age=3600')

  return NextResponse.json(results, { headers })
}

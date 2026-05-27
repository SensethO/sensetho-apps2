/**
 * GET /api/agri/marches
 * Proxy vers Alpha Vantage pour les prix des matières premières agricoles.
 *
 * Query params:
 *   - produit : "cacao" | "cafe"
 *
 * Mapping produit → symbole :
 *   cacao → CC=F (Cocoa Futures)
 *   cafe  → KC=F (Coffee C Futures)
 *
 * Cache 1h (revalidate côté fetch + Cache-Control header).
 * Si ALPHA_VANTAGE_API_KEY absent → données mock avec mock: true.
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const AV_BASE = 'https://www.alphavantage.co/query'

type ProduitKey = 'cacao' | 'cafe'

const SYMBOL_MAP: Record<ProduitKey, string> = {
  cacao: 'CC=F',
  cafe: 'KC=F',
}

interface PriceEntry {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

function generateMockPrices(produit: ProduitKey): PriceEntry[] {
  // Prix de référence réalistes (USD/tonne pour cacao, cents USD/livre pour café)
  const basePrices: Record<ProduitKey, number> = {
    cacao: 3200,
    cafe: 185,
  }
  const base = basePrices[produit]
  const entries: PriceEntry[] = []
  const now = new Date()

  for (let i = 29; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    // Sauter week-ends
    if (date.getDay() === 0 || date.getDay() === 6) continue

    const dateStr = date.toISOString().split('T')[0]
    const variation = (Math.random() - 0.48) * base * 0.02
    const open = +(base + variation * i * 0.1).toFixed(2)
    const high = +(open * (1 + Math.random() * 0.015)).toFixed(2)
    const low = +(open * (1 - Math.random() * 0.015)).toFixed(2)
    const close = +(low + Math.random() * (high - low)).toFixed(2)
    const volume = Math.round(5000 + Math.random() * 20000)

    entries.push({ date: dateStr, open, high, low, close, volume })
  }

  return entries
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const produit = (searchParams.get('produit') ?? 'cacao').toLowerCase() as ProduitKey

    if (!SYMBOL_MAP[produit]) {
      return NextResponse.json(
        {
          error: `Produit "${produit}" non supporté. Valeurs acceptées : ${Object.keys(SYMBOL_MAP).join(', ')}`,
        },
        { status: 400 }
      )
    }

    const symbol = SYMBOL_MAP[produit]
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY

    if (!apiKey) {
      const mockPrices = generateMockPrices(produit)
      return NextResponse.json({
        produit,
        symbol,
        prices: mockPrices,
        mock: true,
        _info: 'ALPHA_VANTAGE_API_KEY non configurée — données simulées',
      })
    }

    const url = `${AV_BASE}?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}&outputsize=compact`
    const res = await fetch(url, {
      next: { revalidate: 3600 },
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: `Alpha Vantage API error: ${res.status}` },
        { status: res.status }
      )
    }

    const data = await res.json()

    // Alpha Vantage retourne une note d'information si la clé est invalide ou le quota dépassé
    if (data.Note || data.Information) {
      const mockPrices = generateMockPrices(produit)
      return NextResponse.json({
        produit,
        symbol,
        prices: mockPrices,
        mock: true,
        _info: data.Note ?? data.Information,
      })
    }

    const timeSeries: Record<string, Record<string, string>> =
      data['Time Series (Daily)'] ?? {}

    const prices: PriceEntry[] = Object.entries(timeSeries)
      .slice(0, 30)
      .map(([date, values]) => ({
        date,
        open: parseFloat(values['1. open'] ?? '0'),
        high: parseFloat(values['2. high'] ?? '0'),
        low: parseFloat(values['3. low'] ?? '0'),
        close: parseFloat(values['4. close'] ?? '0'),
        volume: parseInt(values['5. volume'] ?? '0', 10),
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const headers = new Headers()
    headers.set('Cache-Control', 'public, max-age=3600')

    return NextResponse.json({ produit, symbol, prices, mock: false }, { headers })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}

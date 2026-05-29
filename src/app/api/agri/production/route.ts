/**
 * GET /api/agri/production?commodity=cacao|cafe
 *
 * Retourne les données de production mondiale (FAOSTAT) pour le cacao ou le café.
 * - cacao → item 656 (Cocoa beans), élément 5510 (Production, tonnes)
 * - cafe  → item 661 (Coffee, green), élément 5510 (Production, tonnes)
 *
 * Utilise l'API FAOSTAT (fenixservices.fao.org). Fallback statique si indisponible.
 * Cache 24h.
 */
// Cache ISR 24h : les données FAOSTAT sont stables sur la journée.
// On supprime force-dynamic pour que Vercel serve la réponse depuis son cache
// plutôt que d'appeler l'API FAO (Rome) à chaque visite.
export const revalidate = 86400

import { NextResponse } from 'next/server'

const FAOSTAT_BASE = 'https://fenixservices.fao.org/faostat/api/v1'

type Commodity = 'cacao' | 'cafe'

const ITEM_CODES: Record<Commodity, string> = {
  cacao: '656', // Cocoa beans
  cafe: '661',  // Coffee, green
}

const LABELS: Record<Commodity, string> = {
  cacao: 'Cacao (fèves)',
  cafe: 'Café (vert)',
}

const UNITS: Record<Commodity, string> = {
  cacao: 'tonnes',
  cafe: 'tonnes',
}

interface ProductionRow {
  year: number
  production_t: number
  country_count?: number
}

// Données de fallback basées sur FAOSTAT (aggregat mondial, Production)
const FALLBACK_DATA: Record<Commodity, ProductionRow[]> = {
  cacao: [
    { year: 2010, production_t: 4_174_400 },
    { year: 2011, production_t: 4_351_800 },
    { year: 2012, production_t: 4_586_100 },
    { year: 2013, production_t: 4_427_000 },
    { year: 2014, production_t: 4_488_000 },
    { year: 2015, production_t: 4_282_810 },
    { year: 2016, production_t: 4_734_398 },
    { year: 2017, production_t: 4_999_803 },
    { year: 2018, production_t: 5_321_405 },
    { year: 2019, production_t: 5_640_649 },
    { year: 2020, production_t: 5_591_040 },
    { year: 2021, production_t: 5_719_344 },
    { year: 2022, production_t: 5_962_100 },
    { year: 2023, production_t: 4_836_900 }, // baisse due sécheresse Côte d'Ivoire/Ghana
  ],
  cafe: [
    { year: 2010, production_t: 8_322_300 },
    { year: 2011, production_t: 8_476_100 },
    { year: 2012, production_t: 8_718_900 },
    { year: 2013, production_t: 8_965_300 },
    { year: 2014, production_t: 9_050_700 },
    { year: 2015, production_t: 8_965_490 },
    { year: 2016, production_t: 9_264_843 },
    { year: 2017, production_t: 9_519_843 },
    { year: 2018, production_t: 10_155_450 },
    { year: 2019, production_t: 10_449_043 },
    { year: 2020, production_t: 10_158_040 },
    { year: 2021, production_t: 10_698_000 },
    { year: 2022, production_t: 11_185_000 },
    { year: 2023, production_t: 10_920_000 },
  ],
}

// Top producteurs (pour info, données 2022 approx.)
const TOP_PRODUCERS: Record<Commodity, { country: string; share_pct: number }[]> = {
  cacao: [
    { country: 'Côte d\'Ivoire', share_pct: 40 },
    { country: 'Ghana', share_pct: 17 },
    { country: 'Indonésie', share_pct: 11 },
    { country: 'Équateur', share_pct: 7 },
    { country: 'Cameroun', share_pct: 5 },
    { country: 'Nigéria', share_pct: 5 },
    { country: 'Autres', share_pct: 15 },
  ],
  cafe: [
    { country: 'Brésil', share_pct: 37 },
    { country: 'Viêt Nam', share_pct: 17 },
    { country: 'Colombie', share_pct: 8 },
    { country: 'Indonésie', share_pct: 6 },
    { country: 'Éthiopie', share_pct: 5 },
    { country: 'Honduras', share_pct: 4 },
    { country: 'Autres', share_pct: 23 },
  ],
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const commodity = (searchParams.get('commodity') ?? 'cacao').toLowerCase() as Commodity

    if (!ITEM_CODES[commodity]) {
      return NextResponse.json(
        { error: `Commodity "${commodity}" non supportée. Valeurs: cacao, cafe` },
        { status: 400 }
      )
    }

    const itemCode = ITEM_CODES[commodity]

    // Essayer l'API FAOSTAT pour les données mondiales
    let rows: ProductionRow[] = []
    let source = 'faostat'

    try {
      // Agrégat mondial: area=5707, element=5510 (Production qty)
      const url = `${FAOSTAT_BASE}/data/QCL?area=5707&item=${itemCode}&element=5510&lang=en&output_type=objects`
      const res = await fetch(url, {
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(4000), // 4s max, fallback statique si dépassé
      })

      if (res.ok) {
        const json = await res.json() as { data?: { Year: number; Value: number }[] }
        const data = json.data ?? []
        if (data.length > 0) {
          rows = data
            .filter(d => d.Year >= 2010 && d.Value > 0)
            .map(d => ({ year: d.Year, production_t: Math.round(d.Value) }))
            .sort((a, b) => a.year - b.year)
        }
      }
    } catch {
      // API indisponible
    }

    // Fallback si pas de données
    if (rows.length === 0) {
      rows = FALLBACK_DATA[commodity]
      source = 'fallback'
    }

    const headers = new Headers()
    headers.set('Cache-Control', 'public, max-age=86400')

    return NextResponse.json({
      commodity,
      label: LABELS[commodity],
      unit: UNITS[commodity],
      rows,
      top_producers: TOP_PRODUCERS[commodity],
      source,
      updated_at: new Date().toISOString(),
    }, { headers })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}

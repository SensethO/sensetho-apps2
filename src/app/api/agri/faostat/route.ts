/**
 * GET /api/agri/faostat
 * Proxy vers l'API FAOSTAT pour les données agricoles.
 *
 * Query params:
 *   - type=crops       → liste des cultures agricoles (filtrées pour l'Afrique)
 *   - type=countries   → liste des pays FAOSTAT
 *
 * Cache 24h (revalidate côté fetch + Cache-Control header).
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const FAOSTAT_BASE = 'https://fenixservices.fao.org/faostat/api/v1'

// Codes d'items FAOSTAT pertinents pour l'Afrique (café, cacao, épices, cultures vivrières…)
const AFRICA_RELEVANT_CODES = new Set([
  '661',  // Coffee, green
  '662',  // Coffee, roasted
  '656',  // Cocoa beans
  '671',  // Tea
  '677',  // Vanilla
  '692',  // Pepper (Piper spp.), raw
  '693',  // Chillies and peppers, dry
  '695',  // Cinnamon (canella), raw
  '698',  // Nutmeg, mace, cardamoms, raw
  '702',  // Ginger, raw
  '720',  // Cloves
  '723',  // Anise, badian, fennel, coriander
  '101',  // Wheat
  '103',  // Rice, paddy
  '108',  // Maize (corn)
  '117',  // Sorghum
  '118',  // Millet
  '122',  // Cassava, fresh
  '125',  // Sweet potatoes
  '137',  // Yams
  '2514', // Plantains and others
  '216',  // Sugar cane
  '223',  // Soybeans
  '234',  // Groundnuts, excluding shelled
  '254',  // Sunflower seed
  '260',  // Sesame seed
  '278',  // Cashew nuts, in shell
  '289',  // Coconuts, in shell
  '292',  // Oil palm fruit
  '331',  // Bananas
  '339',  // Oranges
  '358',  // Mangoes, guavas and mangosteens
  '366',  // Avocados
  '414',  // Tomatoes
  '430',  // Onions and shallots, green
  '446',  // Beans, dry
  '463',  // Lentils, dry
  '495',  // Cotton seed
  '498',  // Sisal
  '800',  // Rubber natural, dry weight
])

interface FAOCountry {
  code: string
  label: string
}

interface FAOItem {
  code: string
  label: string
}

interface SimplifiedItem {
  code: string
  name: string
}

// ── Fallback statique ────────────────────────────────────────────────────────
// Utilisé quand l'API FAOSTAT est indisponible (ex: erreur 521 Cloudflare).
// Couvre les cultures africaines les plus importantes.
const FALLBACK_CROPS: SimplifiedItem[] = [
  { code: '2514', name: 'Bananas and plantains' },
  { code: '656',  name: 'Cocoa beans' },
  { code: '661',  name: 'Coffee, green' },
  { code: '695',  name: 'Cinnamon (canella), raw' },
  { code: '278',  name: 'Cashew nuts, in shell' },
  { code: '289',  name: 'Coconuts, in shell' },
  { code: '108',  name: 'Maize (corn)' },
  { code: '234',  name: 'Groundnuts, excluding shelled' },
  { code: '702',  name: 'Ginger, raw' },
  { code: '216',  name: 'Sugar cane' },
  { code: '117',  name: 'Sorghum' },
  { code: '118',  name: 'Millet' },
  { code: '103',  name: 'Rice, paddy' },
  { code: '101',  name: 'Wheat' },
  { code: '122',  name: 'Cassava, fresh' },
  { code: '125',  name: 'Sweet potatoes' },
  { code: '137',  name: 'Yams' },
  { code: '292',  name: 'Oil palm fruit' },
  { code: '800',  name: 'Rubber natural, dry weight' },
  { code: '495',  name: 'Cotton seed' },
  { code: '223',  name: 'Soybeans' },
  { code: '254',  name: 'Sunflower seed' },
  { code: '260',  name: 'Sesame seed' },
  { code: '671',  name: 'Tea' },
  { code: '677',  name: 'Vanilla' },
  { code: '692',  name: 'Pepper (Piper spp.), raw' },
  { code: '693',  name: 'Chillies and peppers, dry' },
  { code: '698',  name: 'Nutmeg, mace, cardamoms, raw' },
  { code: '720',  name: 'Cloves' },
  { code: '723',  name: 'Anise, badian, fennel, coriander' },
  { code: '331',  name: 'Bananas' },
  { code: '339',  name: 'Oranges' },
  { code: '358',  name: 'Mangoes, guavas and mangosteens' },
  { code: '366',  name: 'Avocados' },
  { code: '414',  name: 'Tomatoes' },
  { code: '430',  name: 'Onions and shallots, green' },
  { code: '446',  name: 'Beans, dry' },
  { code: '463',  name: 'Lentils, dry' },
  { code: '498',  name: 'Sisal' },
].sort((a, b) => a.name.localeCompare(b.name))

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') ?? 'crops'

    if (type === 'crops') {
      try {
        const res = await fetch(`${FAOSTAT_BASE}/items/QCL/F?lang=en`, {
          next: { revalidate: 86400 },
          signal: AbortSignal.timeout(8000), // timeout 8s
        })

        if (res.ok) {
          const json = await res.json()
          const items: FAOItem[] = json?.data ?? []

          const filtered: SimplifiedItem[] = items
            .filter((item: FAOItem) => AFRICA_RELEVANT_CODES.has(item.code))
            .map((item: FAOItem) => ({ code: item.code, name: item.label }))
            .sort((a, b) => a.name.localeCompare(b.name))

          if (filtered.length > 0) {
            const headers = new Headers()
            headers.set('Cache-Control', 'public, max-age=86400')
            return NextResponse.json({ type: 'crops', data: filtered }, { headers })
          }
        }
      } catch {
        // API indisponible → fallback statique ci-dessous
      }

      // Fallback : API FAO down ou liste vide
      const headers = new Headers()
      headers.set('Cache-Control', 'public, max-age=3600')
      return NextResponse.json({ type: 'crops', data: FALLBACK_CROPS, fallback: true }, { headers })
    }

    if (type === 'countries') {
      const res = await fetch(`${FAOSTAT_BASE}/definitions/types/area?lang=en`, {
        next: { revalidate: 86400 },
      })

      if (!res.ok) {
        return NextResponse.json(
          { error: `FAOSTAT countries API error: ${res.status}` },
          { status: res.status }
        )
      }

      const json = await res.json()
      const areas: FAOCountry[] = json?.data ?? []

      // Filtrer les continents/régions (codes numériques courts), ne garder que les pays
      const countries: SimplifiedItem[] = areas
        .filter((a: FAOCountry) => a.code && a.label)
        .map((a: FAOCountry) => ({ code: a.code, name: a.label }))
        .sort((a, b) => a.name.localeCompare(b.name))

      const headers = new Headers()
      headers.set('Cache-Control', 'public, max-age=86400')

      return NextResponse.json({ type: 'countries', data: countries }, { headers })
    }

    return NextResponse.json(
      { error: `Type inconnu : "${type}". Valeurs acceptées : crops, countries` },
      { status: 400 }
    )
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}

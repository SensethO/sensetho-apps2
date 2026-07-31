import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp } from '@/lib/sharepointMulti'
import { bboxOf } from '@/lib/eudr/sentinel'
import { guard } from '../../traces/_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Calque « routes et habitations » issu d'OpenStreetMap (via Overpass), à superposer aux
 * images satellite. Chargé **à la demande** (jamais automatiquement) : Overpass est un
 * service communautaire gratuit qu'il faut ménager.
 *
 * Données © les contributeurs OpenStreetMap (ODbL) — l'attribution est affichée dans l'UI.
 */

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]
const UA = 'sensetho-apps2/1.0 (EUDR due diligence; contact: info@monheure.fr)'

/** Filtre adapté à l'étendue : plus la vue est large, plus on se limite aux axes lisibles. */
function queryFor(bbox: number[], km: number): { q: string; buildings: boolean } {
  const [minx, miny, maxx, maxy] = bbox
  const bb = `${miny},${minx},${maxy},${maxx}` // Overpass : sud,ouest,nord,est
  if (km <= 3) {
    // Vue parcelle : tout est lisible et le volume reste faible.
    return { q: `[out:json][timeout:50];(way["highway"](${bb});way["building"](${bb}););out geom;`, buildings: true }
  }
  if (km <= 15) {
    const re = 'motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|track'
    return { q: `[out:json][timeout:50];(way["highway"~"^(${re})$"](${bb});way["building"](${bb}););out geom;`, buildings: true }
  }
  // Vue large : uniquement les axes structurants ; les bâtiments seraient des points invisibles.
  const re = 'motorway|trunk|primary|secondary|tertiary'
  return { q: `[out:json][timeout:50];(way["highway"~"^(${re})$"](${bb}););out geom;`, buildings: false }
}

type Pt = { lat: number; lon: number }
/** Arrondi à 5 décimales (~1 m) + suppression des points consécutifs identiques. */
function simplify(geom: Pt[]): number[][] {
  const out: number[][] = []
  for (const p of geom) {
    const x = +p.lon.toFixed(5), y = +p.lat.toFixed(5)
    const last = out[out.length - 1]
    if (!last || last[0] !== x || last[1] !== y) out.push([x, y])
  }
  return out
}

async function overpass(q: string): Promise<{ elements?: Array<{ tags?: Record<string, string>; geometry?: Pt[] }> }> {
  let lastErr = ''
  for (const ep of ENDPOINTS) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        body: 'data=' + encodeURIComponent(q),
        signal: AbortSignal.timeout(45_000),
      })
      const text = await res.text()
      if (!res.ok) { lastErr = `HTTP ${res.status}`; continue }
      return JSON.parse(text)
    } catch (e) { lastErr = String((e as Error).message ?? e) }
  }
  throw new Error(`OpenStreetMap indisponible (${lastErr})`)
}

/** GET ?org_id&attachmentId&plot= → { bbox, roads, buildings } en lon/lat. */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const orgId = sp.get('org_id')
    const auth = await guard(orgId)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const attachmentId = sp.get('attachmentId')
    if (!attachmentId) return NextResponse.json({ error: 'attachmentId requis' }, { status: 400 })
    const plot = sp.get('plot') != null ? Number(sp.get('plot')) : undefined

    const { data: row } = await createAdminClient()
      .from('eudr_attachments').select('sharepoint_item_id').eq('id', attachmentId).eq('org_id', orgId!).maybeSingle()
    if (!row) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
    const meta = await spGraphForApp('eudr-fournisseurs', `/items/${row.sharepoint_item_id}`)
    if (!meta.ok) return NextResponse.json({ error: 'Fichier SharePoint introuvable' }, { status: 404 })
    const item = await meta.json() as Record<string, unknown>
    const url = item['@microsoft.graph.downloadUrl'] as string | undefined
    if (!url) return NextResponse.json({ error: 'URL indisponible' }, { status: 404 })
    const geojson = JSON.parse(Buffer.from(await (await fetch(url)).arrayBuffer()).toString('utf-8'))

    const bbox = bboxOf(geojson, plot)  // même emprise que l'image
    const km = (bbox[2] - bbox[0]) * 111.32 * Math.cos((bbox[1] * Math.PI) / 180)
    const { q } = queryFor(bbox, km)

    const data = await overpass(q)
    const els = data.elements ?? []
    const roads = els.filter(e => e.tags?.highway && e.geometry).map(e => simplify(e.geometry!))
    const buildings = els.filter(e => e.tags?.building && e.geometry).map(e => simplify(e.geometry!))

    return NextResponse.json(
      { bbox, roads, buildings, scaleKm: Math.round(km) },
      // Les données OSM évoluent lentement : on autorise un cache navigateur d'un jour.
      { headers: { 'Cache-Control': 'private, max-age=86400' } },
    )
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message ?? err) }, { status: 502 })
  }
}

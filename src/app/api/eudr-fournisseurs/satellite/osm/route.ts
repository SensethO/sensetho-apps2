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
  // Les localités (place) sont toujours demandées : ce sont elles qui portent les noms.
  const places = `node["place"~"^(city|town|village|hamlet)$"](${bb});`
  if (km <= 3) {
    // Vue parcelle : tout est lisible et le volume reste faible.
    return { q: `[out:json][timeout:50];(way["highway"](${bb});way["building"](${bb});${places});out geom;`, buildings: true }
  }
  if (km <= 15) {
    const re = 'motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|track'
    return { q: `[out:json][timeout:50];(way["highway"~"^(${re})$"](${bb});way["building"](${bb});${places});out geom;`, buildings: true }
  }
  // Vue large : uniquement les axes structurants ; les bâtiments seraient des points invisibles.
  const re = 'motorway|trunk|primary|secondary|tertiary'
  return { q: `[out:json][timeout:50];(way["highway"~"^(${re})$"](${bb});${places});out geom;`, buildings: false }
}

type Pt = { lat: number; lon: number }

const R_EARTH = 6371
const rad = (d: number) => (d * Math.PI) / 180
/** Distance orthodromique en km. */
function distKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = rad(bLat - aLat), dLon = rad(bLon - aLon)
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2
  return 2 * R_EARTH * Math.asin(Math.sqrt(x))
}
const CARDINALS = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest']
function bearingLabel(aLat: number, aLon: number, bLat: number, bLon: number): string {
  const y = Math.sin(rad(bLon - aLon)) * Math.cos(rad(bLat))
  const x = Math.cos(rad(aLat)) * Math.sin(rad(bLat)) - Math.sin(rad(aLat)) * Math.cos(rad(bLat)) * Math.cos(rad(bLon - aLon))
  const deg = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
  return CARDINALS[Math.round(deg / 45) % 8]
}

/** Pays et région via Nominatim (1 requête, usage modéré conformément à leur politique). */
async function reverseGeocode(lat: number, lon: number): Promise<{ country: string | null; countryCode: string | null; region: string | null }> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=8&accept-language=fr`,
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12_000) },
    )
    if (!res.ok) return { country: null, countryCode: null, region: null }
    const j = await res.json() as { address?: Record<string, string> }
    const a = j.address ?? {}
    return { country: a.country ?? null, countryCode: (a.country_code ?? '').toUpperCase() || null, region: a.state ?? a.region ?? a.county ?? null }
  } catch { return { country: null, countryCode: null, region: null } }
}

/** Ville influente la plus proche : d'abord les « city », sinon les bourgs de + de 50 000 hab. */
async function nearestCity(lat: number, lon: number) {
  const q = `[out:json][timeout:40];(node["place"~"^(city|town)$"](around:60000,${lat},${lon}););out body;`
  try {
    const data = await overpass(q)
    const places = (data.elements ?? [])
      .filter(e => e.tags?.name && typeof e.lat === 'number' && typeof e.lon === 'number')
      .map(e => ({
        name: e.tags!.name, type: e.tags!.place,
        population: Number(e.tags!.population ?? 0) || null,
        km: +distKm(lat, lon, e.lat!, e.lon!).toFixed(1),
        direction: bearingLabel(lat, lon, e.lat!, e.lon!),
      }))
    if (!places.length) return null
    const influential = places.filter(p => p.type === 'city' || (p.population ?? 0) >= 50_000)
    return (influential.length ? influential : places).sort((a, b) => a.km - b.km)[0]
  } catch { return null }
}
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

interface OverpassEl { tags?: Record<string, string>; geometry?: Pt[]; lat?: number; lon?: number }
async function overpass(q: string): Promise<{ elements?: OverpassEl[] }> {
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

/** GET ?org_id&attachmentId&plot= → { bbox, roads, buildings, places, context } en lon/lat. */
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

    const cLon = (bbox[0] + bbox[2]) / 2, cLat = (bbox[1] + bbox[3]) / 2

    // Les trois appels sont indépendants : on les mène de front pour tenir dans maxDuration.
    const [data, city, geo] = await Promise.all([
      overpass(q),
      nearestCity(cLat, cLon),
      reverseGeocode(cLat, cLon),
    ])
    const els = data.elements ?? []
    const roads = els.filter(e => e.tags?.highway && e.geometry)
      .map(e => ({ pts: simplify(e.geometry!), name: e.tags!.name ?? null }))
    const buildings = els.filter(e => e.tags?.building && e.geometry).map(e => simplify(e.geometry!))
    const places = els.filter(e => e.tags?.place && e.tags.name && typeof e.lat === 'number')
      .map(e => ({
        lon: +e.lon!.toFixed(5), lat: +e.lat!.toFixed(5),
        name: e.tags!.name, type: e.tags!.place,
      }))

    return NextResponse.json(
      {
        bbox, roads, buildings, places, scaleKm: Math.round(km),
        context: { country: geo.country, countryCode: geo.countryCode, region: geo.region, nearestCity: city },
      },
      // Les données OSM évoluent lentement : on autorise un cache navigateur d'un jour.
      { headers: { 'Cache-Control': 'private, max-age=86400' } },
    )
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message ?? err) }, { status: 502 })
  }
}

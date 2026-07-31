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

/**
 * UNE seule requête Overpass pour tout : voies, bâtiments, localités du cadre et villes
 * influentes alentour. Deux requêtes concurrentes pouvaient dépasser le maxDuration de la
 * fonction avant même d'avoir essayé le serveur de repli — d'où les « OpenStreetMap
 * indisponible » observés. Le filtre s'adapte à l'étendue : plus la vue est large, plus on
 * se limite aux axes lisibles.
 */
function queryFor(bbox: number[], km: number, cLat: number, cLon: number): string {
  const [minx, miny, maxx, maxy] = bbox
  const bb = `${miny},${minx},${maxy},${maxx}` // Overpass : sud,ouest,nord,est
  // Localités du cadre : ce sont elles qui portent les noms affichés sur l'image. Comme pour
  // les voies, plus la vue est large, moins on descend dans la hiérarchie — sinon les
  // étiquettes se recouvrent et la carte devient illisible.
  const placesOf = (re: string) => `node["place"~"^(${re})$"](${bb});`
  // Villes influentes bien au-delà du cadre : c'est le repère qui situe une parcelle isolée.
  const cities = `node["place"~"^(city|town)$"](around:${NEAR_RADIUS_M},${cLat},${cLon});`
  const head = '[out:json][timeout:25]'
  if (km <= 3) {
    // Vue parcelle : tout est lisible et le volume reste faible.
    return `${head};(way["highway"](${bb});way["building"](${bb});${placesOf('city|town|village|hamlet')}${cities});out geom;`
  }
  if (km <= 15) {
    const re = 'motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|track'
    return `${head};(way["highway"~"^(${re})$"](${bb});way["building"](${bb});${placesOf('city|town|village')}${cities});out geom;`
  }
  // Vue large : uniquement les axes structurants ; les bâtiments seraient des points invisibles.
  const re = 'motorway|trunk|primary|secondary|tertiary'
  return `${head};(way["highway"~"^(${re})$"](${bb});${placesOf('city|town')}${cities});out geom;`
}
const NEAR_RADIUS_M = 60_000

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

interface Near { name: string; type: string; population: number | null; km: number; direction: string; source: 'osm' | 'nominatim' }
interface Geo { country: string | null; countryCode: string | null; region: string | null; place: Near | null }

/** Cache mémoire du contexte (arrondi ~1 km) : une instance chaude ne réinterroge pas Nominatim. */
const geoCache = new Map<string, Geo>()

async function nominatim(lat: number, lon: number, zoom: number) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=${zoom}&extratags=1&accept-language=fr`,
    { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10_000) },
  )
  if (!res.ok) throw new Error(`Nominatim ${res.status}`)
  return await res.json() as {
    name?: string; addresstype?: string; lat?: string; lon?: string
    address?: Record<string, string>; extratags?: Record<string, string>
  }
}

/**
 * Pays, région et localité la plus proche via Nominatim. Contrairement à Overpass — service
 * communautaire régulièrement saturé — Nominatim répond en ~100 ms, ce qui en fait le socle
 * fiable du repère géographique ; Overpass ne fait que l'affiner quand il répond.
 * Deux appels séquentiels (zoom 8 = région, zoom 12 = localité), conformément à leur
 * politique d'un appel par seconde.
 */
async function reverseGeocode(lat: number, lon: number): Promise<Geo> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`
  const cached = geoCache.get(key)
  if (cached) return cached

  const out: Geo = { country: null, countryCode: null, region: null, place: null }
  try {
    const a = (await nominatim(lat, lon, 8)).address ?? {}
    out.country = a.country ?? null
    out.countryCode = (a.country_code ?? '').toUpperCase() || null
    out.region = a.state ?? a.region ?? a.county ?? null
  } catch { /* le repère reste partiel plutôt qu'absent */ }
  try {
    const j = await nominatim(lat, lon, 12)
    const pLat = Number(j.lat), pLon = Number(j.lon)
    if (j.name && Number.isFinite(pLat) && Number.isFinite(pLon)) {
      out.place = {
        name: j.name, type: j.addresstype ?? 'place',
        population: Number(j.extratags?.population ?? 0) || null,
        km: +distKm(lat, lon, pLat, pLon).toFixed(1),
        direction: bearingLabel(lat, lon, pLat, pLon),
        source: 'nominatim',
      }
    }
  } catch { /* idem */ }

  if (out.country || out.place) geoCache.set(key, out)
  return out
}

/**
 * Ville influente la plus proche : d'abord les « city » ou les bourgs de plus de 50 000
 * habitants, à défaut le bourg le plus proche. Un hameau à 800 m ne situe pas une parcelle.
 */
function pickInfluential(cands: Near[]): Near | null {
  if (!cands.length) return null
  const influential = cands.filter(p => p.type === 'city' || (p.population ?? 0) >= 50_000)
  return (influential.length ? influential : cands).sort((a, b) => a.km - b.km)[0]
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
        // 12 s par serveur. Overpass sain répond en ~2 s ; saturé, il met 60 à 90 s. Mieux
        // vaut renoncer vite et afficher le repère pays/ville que faire patienter pour rien.
        signal: AbortSignal.timeout(12_000),
      })
      const text = await res.text()
      if (!res.ok) { lastErr = `HTTP ${res.status}`; continue }
      return JSON.parse(text)
    } catch (e) { lastErr = String((e as Error).message ?? e) }
  }
  throw new Error(lastErr)
}

/** Cause courte et lisible : l'UI compose la phrase, la route ne fournit que le motif. */
function shortCause(e: string): string {
  if (/abort|timeout|timed out/i.test(e)) return 'délai dépassé'
  if (/\b(429|502|503|504)\b/.test(e)) return 'serveur saturé'
  if (/\b(4\d\d|5\d\d)\b/.test(e)) return `réponse ${e.match(/\b[45]\d\d\b/)![0]}`
  return e
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
    const cLon = (bbox[0] + bbox[2]) / 2, cLat = (bbox[1] + bbox[3]) / 2

    // Overpass et Nominatim sont indépendants : menés de front, et surtout tolérants à
    // l'échec l'un de l'autre. Si Overpass sature, on rend quand même le repère pays.
    const [osmRes, geo] = await Promise.all([
      overpass(queryFor(bbox, km, cLat, cLon)).catch(e => ({ error: String((e as Error).message ?? e) })),
      reverseGeocode(cLat, cLon),
    ])
    const warning = 'error' in osmRes ? shortCause(osmRes.error) : null
    const els = ('elements' in osmRes ? osmRes.elements : []) ?? []

    const roads = els.filter(e => e.tags?.highway && e.geometry)
      .map(e => ({ pts: simplify(e.geometry!), name: e.tags!.name ?? null }))
    const buildings = els.filter(e => e.tags?.building && e.geometry).map(e => simplify(e.geometry!))

    const placeNodes = els.filter(e => e.tags?.place && e.tags.name && typeof e.lat === 'number' && typeof e.lon === 'number')
    // Les nœuds du cadre servent d'étiquettes ; ceux du rayon élargi (villes et bourgs)
    // servent à désigner la ville influente — les deux jeux arrivent dans la même réponse.
    const places = placeNodes
      .filter(e => e.lon! >= bbox[0] && e.lon! <= bbox[2] && e.lat! >= bbox[1] && e.lat! <= bbox[3])
      .map(e => ({ lon: +e.lon!.toFixed(5), lat: +e.lat!.toFixed(5), name: e.tags!.name, type: e.tags!.place }))
    // Overpass qualifie mieux la ville (population, statut) quand il répond ; sinon la
    // localité vue par Nominatim tient le rôle de repère. Le champ `source` permet à l'UI
    // de nommer honnêtement ce qu'elle affiche.
    const nearestCity = pickInfluential(
      placeNodes.filter(e => e.tags!.place === 'city' || e.tags!.place === 'town').map(e => ({
        name: e.tags!.name, type: e.tags!.place,
        population: Number(e.tags!.population ?? 0) || null,
        km: +distKm(cLat, cLon, e.lat!, e.lon!).toFixed(1),
        direction: bearingLabel(cLat, cLon, e.lat!, e.lon!),
        source: 'osm' as const,
      })),
    ) ?? geo.place

    return NextResponse.json(
      {
        bbox, roads, buildings, places, warning, scaleKm: Math.round(km),
        context: { country: geo.country, countryCode: geo.countryCode, region: geo.region, nearestCity },
      },
      // Les données OSM évoluent lentement : on autorise un cache navigateur d'un jour.
      // Une réponse dégradée (Overpass en échec) ne doit pas, elle, être mémorisée.
      { headers: { 'Cache-Control': warning ? 'no-store' : 'private, max-age=86400' } },
    )
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message ?? err) }, { status: 502 })
  }
}

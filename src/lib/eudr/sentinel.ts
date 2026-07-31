// Imagerie Sentinel-2 via Copernicus Data Space (Sentinel Hub).
// Jeton OAuth (client_credentials) mis en cache mémoire ; images true-color rendues
// par l'API Process. Le secret reste côté serveur (jamais exposé au navigateur).

const TOKEN_URL = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token'
const PROCESS_URL = 'https://sh.dataspace.copernicus.eu/api/v1/process'

let cachedToken: { value: string; expiresAt: number } | null = null

async function getToken(): Promise<string> {
  const id = process.env.SENTINEL_CLIENT_ID, secret = process.env.SENTINEL_CLIENT_SECRET
  if (!id || !secret) throw new Error('Identifiants Sentinel Hub non configurés (SENTINEL_CLIENT_ID / SENTINEL_CLIENT_SECRET).')
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value
  const res = await fetch(TOKEN_URL, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
  })
  const j = await res.json() as { access_token?: string; expires_in?: number; error_description?: string }
  if (!j.access_token) throw new Error(`Auth Sentinel Hub échouée : ${j.error_description ?? res.status}`)
  cachedToken = { value: j.access_token, expiresAt: Date.now() + (j.expires_in ?? 1800) * 1000 }
  return j.access_token
}

type BBox = [number, number, number, number]

/**
 * BBox [minLon,minLat,maxLon,maxLat] d'un GeoJSON (ou d'une seule parcelle), avec marge.
 * La bbox est rendue **carrée** (on élargit le côté le plus court autour du centre) : les
 * vignettes étant carrées, cela évite que l'image et les contours soient écrasés quand les
 * parcelles s'étendent beaucoup plus en longitude qu'en latitude.
 */
export function bboxOf(geojson: { features?: Array<{ geometry?: { coordinates?: unknown } }> }, plotIndex?: number, pad = 0.0015): BBox {
  const feats = geojson.features ?? []
  const targets = (plotIndex != null && feats[plotIndex]) ? [feats[plotIndex]] : feats
  let minx = 180, miny = 90, maxx = -180, maxy = -90
  const walk = (a: unknown): void => {
    if (Array.isArray(a) && typeof a[0] === 'number') {
      const [x, y] = a as number[]; minx = Math.min(minx, x); miny = Math.min(miny, y); maxx = Math.max(maxx, x); maxy = Math.max(maxy, y)
    } else if (Array.isArray(a)) a.forEach(walk)
  }
  targets.forEach(f => walk(f.geometry?.coordinates))
  if (minx > maxx) return [-180, -90, 180, 90]

  minx -= pad; miny -= pad; maxx += pad; maxy += pad
  const w = maxx - minx, h = maxy - miny
  const side = Math.max(w, h)
  const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2
  return [cx - side / 2, cy - side / 2, cx + side / 2, cy + side / 2]
}

const TRUE_COLOR = '//VERSION=3\nfunction setup(){return{input:["B02","B03","B04"],output:{bands:3}}}\nfunction evaluatePixel(s){return[2.5*s.B04,2.5*s.B03,2.5*s.B02]}'

/**
 * Résolution adaptée à l'étendue : Sentinel-2 capte à 10 m/pixel, inutile de demander
 * plus fin (on ne ferait qu'alourdir l'image sans gagner de détail). On vise ~10 m/pixel,
 * borné entre 512 px (confort d'affichage sur les petites parcelles) et 1024 px (poids).
 */
function sizeForBbox(bbox: BBox): number {
  const [minx, miny, maxx] = bbox
  const meters = (maxx - minx) * 111_320 * Math.cos((miny * Math.PI) / 180)
  return Math.min(1024, Math.max(512, Math.round(meters / 10)))
}

/**
 * Rend une image Sentinel-2 true-color (PNG) pour une bbox et une période (mosaïque moins
 * nuageuse). Sans `size`, la résolution est choisie selon l'étendue (cf. sizeForBbox).
 */
export async function fetchSentinelImage(bbox: BBox, from: string, to: string, size = 0): Promise<Buffer> {
  if (!size) size = sizeForBbox(bbox)
  const token = await getToken()
  const body = {
    input: {
      bounds: { bbox, properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' } },
      data: [{ type: 'sentinel-2-l2a', dataFilter: { timeRange: { from, to }, maxCloudCoverage: 40 }, mosaickingOrder: 'leastCC' }],
    },
    output: { width: size, height: size, responses: [{ identifier: 'default', format: { type: 'image/png' } }] },
    evalscript: TRUE_COLOR,
  }
  const res = await fetch(PROCESS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'image/png' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Sentinel Hub Process ${res.status} : ${(await res.text()).slice(0, 200)}`)
  return Buffer.from(await res.arrayBuffer())
}

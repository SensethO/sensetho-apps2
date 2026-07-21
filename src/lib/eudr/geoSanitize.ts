// Nettoyage GeoJSON pour EUDR TRACES V3.
// La spec géo EUDR n'accepte, par « production place », qu'un **Point** ou un
// **Polygon** — jamais un MultiPolygon, ni un polygone à trous. TRACES, sinon,
// aplatit les anneaux et croit voir une auto-intersection d'anneau
// (« Ring Self-intersection »), ou refuse « Polygon with holes ».
//
// Pipeline (dépôt réel accepté par TRACES acceptance, UUID retourné) :
//   1. cleanCoords — retire les sommets dupliqués / colinéaires,
//   2. MultiPolygon → éclaté en autant de features Polygon (1 par sous-polygone),
//   3. chaque Polygon ne garde que son anneau extérieur (suppression des trous),
//   4. arrondi des coordonnées à 6 décimales (~0,11 m) + dédoublonnage consécutif.
// Le point (4) est CRUCIAL : les fichiers terrain ont des coordonnées à ~15 décimales
// avec des grappes de points quasi-coïncidents (< 0,1 m). TRACES arrondit à sa grille
// interne → ces points fusionnent et forment une auto-intersection d'anneau
// (« Ring Self-intersection ») que ni JTS.isValid ni turf ne détectent en amont.
// En arrondissant nous-mêmes avant l'envoi, la micro-boucle disparaît.
// ⚠️ Retirer un trou / arrondir modifie légèrement la surface déclarée — d'où le rapport.
import { cleanCoords, simplify, area } from '@turf/turf'

const DECIMALS = 6 // ~0,11 m : précision largement suffisante pour des parcelles, et acceptée par TRACES.
// Simplification Douglas-Peucker appliquée aux anneaux trop denses (sur-échantillonnage GPS).
// ~0,3 m : imperceptible sur des parcelles de plusieurs ha (écart de surface < 0,1 %),
// mais divise par ~50 le nombre de points des tracés les plus lourds.
const SIMPLIFY_TOLERANCE = 0.000003
const SIMPLIFY_MIN_POINTS = 80 // on ne simplifie que les anneaux au-delà de ce nombre de sommets.
const HOLE_ALERT_PCT = 1 // alerte si un trou retiré réintègre plus de 1 % de la parcelle.

/** Alerte de conformité : parcelle dont un trou retiré modifie sensiblement la surface. */
export interface HoleAlert { name: string; plotHa: number; addedHa: number; pct: number }

export interface SanitizeReport {
  featuresBefore: number
  featuresAfter: number
  holesRemoved: number         // anneaux intérieurs supprimés
  multiPolygonsSplit: number   // MultiPolygon éclatés en Polygons
  coordinatesRounded: boolean  // arrondi à DECIMALS décimales appliqué
  pointsBefore: number         // total de sommets avant simplification
  pointsAfter: number          // total de sommets après simplification/arrondi
  areaBeforeHa: number         // surface déclarée d'origine (trous déduits)
  areaAfterHa: number          // surface envoyée (trous réintégrés + simplifiée/arrondie)
  holeAlerts: HoleAlert[]      // parcelles où le retrait d'un trou dépasse le seuil
  changed: boolean
}

type Ring = number[][]
type Geometry = { type: string; coordinates?: unknown }
type Feature = { type: 'Feature'; geometry: Geometry | null; properties?: unknown }

/** Surface (m²) d'un polygone défini par ses anneaux (turf déduit les trous). */
function polyArea(rings: Ring[]): number {
  try { return area({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: rings } } as never) } catch { return 0 }
}

/** Nom lisible d'une parcelle depuis ses propriétés (pour les alertes). */
function featureName(properties: unknown): string {
  const p = (properties ?? {}) as Record<string, unknown>
  return String(p.Name ?? p.name ?? p.Plot_id ?? p.plot_id ?? p.id ?? '') || '(sans nom)'
}

/** Simplifie (Douglas-Peucker) un anneau trop dense, en préservant sa fermeture. */
function simplifyRing(ring: Ring): Ring {
  if (ring.length <= SIMPLIFY_MIN_POINTS) return ring
  try {
    const s = simplify({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } } as never,
      { tolerance: SIMPLIFY_TOLERANCE, highQuality: true, mutate: false }) as { geometry: { coordinates: Ring[] } }
    const out = s.geometry?.coordinates?.[0]
    return Array.isArray(out) && out.length >= 4 ? out : ring
  } catch { return ring }
}

/** Arrondit un anneau à DECIMALS décimales, retire les doublons consécutifs, referme l'anneau. */
function roundRing(ring: Ring): Ring {
  const r = ring.map(c => [Number(c[0].toFixed(DECIMALS)), Number(c[1].toFixed(DECIMALS))])
  const out: Ring = r.length ? [r[0]] : []
  for (let i = 1; i < r.length; i++) {
    const last = out[out.length - 1]
    if (r[i][0] !== last[0] || r[i][1] !== last[1]) out.push(r[i])
  }
  if (out.length >= 3 && (out[0][0] !== out[out.length - 1][0] || out[0][1] !== out[out.length - 1][1])) out.push(out[0])
  // Si l'arrondi a trop dégradé l'anneau (< 4 points), on garde l'anneau d'origine.
  return out.length >= 4 ? out : ring
}

/** Construit un feature Polygon à partir de ses anneaux, en ne gardant que l'extérieur (arrondi). */
function polygonFeature(rings: Ring[], properties: unknown, report: SanitizeReport): Feature {
  const originalArea = polyArea(rings)          // surface d'origine (trous déduits)
  const exteriorArea = polyArea([rings[0]])     // surface sans les trous
  if (rings.length > 1) {
    report.holesRemoved += rings.length - 1
    const added = exteriorArea - originalArea   // surface réintégrée par le retrait des trous
    if (exteriorArea > 0 && (added / exteriorArea) * 100 > HOLE_ALERT_PCT) {
      report.holeAlerts.push({
        name: featureName(properties),
        plotHa: +(exteriorArea / 10000).toFixed(3),
        addedHa: +(added / 10000).toFixed(3),
        pct: +((added / exteriorArea) * 100).toFixed(1),
      })
    }
  }
  report.coordinatesRounded = true
  report.pointsBefore += rings[0].length
  const ring = roundRing(simplifyRing(rings[0]))
  report.pointsAfter += ring.length
  report.areaBeforeHa += originalArea / 10000
  report.areaAfterHa += polyArea([ring]) / 10000
  return { type: 'Feature', properties, geometry: { type: 'Polygon', coordinates: [ring] } }
}

/** Nettoie + éclate un feature polygonal → 1..n features Polygon simples, sans trou. */
function sanitizeFeature(feat: Feature, report: SanitizeReport): Feature[] {
  let f: Feature = feat
  try { f = { type: 'Feature', properties: feat.properties, geometry: (cleanCoords(feat as never) as { geometry: Geometry }).geometry } } catch { /* garde l'original */ }
  const g = f.geometry
  if (!g) return [feat]
  if (g.type === 'Polygon') {
    const rings = g.coordinates as Ring[]
    if (rings.length > 1) report.changed = true
    return [polygonFeature(rings, feat.properties, report)]
  }
  if (g.type === 'MultiPolygon') {
    const polys = g.coordinates as Ring[][]
    if (polys.length > 1) { report.multiPolygonsSplit += 1; report.changed = true }
    return polys.map(poly => {
      if (poly.length > 1) report.changed = true
      return polygonFeature(poly, feat.properties, report)
    })
  }
  return [f] // Point / autre : inchangé
}

/**
 * Nettoie un GeoJSON (chaîne JSON ou objet) sans muter l'entrée.
 * Renvoie une FeatureCollection acceptée par TRACES + un rapport de ce qui a changé.
 */
export function sanitizeGeojson(input: unknown): { geojson: unknown; report: SanitizeReport } {
  const report: SanitizeReport = { featuresBefore: 0, featuresAfter: 0, holesRemoved: 0, multiPolygonsSplit: 0, coordinatesRounded: false, pointsBefore: 0, pointsAfter: 0, areaBeforeHa: 0, areaAfterHa: 0, holeAlerts: [], changed: false }
  let data: unknown
  try {
    data = typeof input === 'string' ? JSON.parse(input) : JSON.parse(JSON.stringify(input))
  } catch {
    return { geojson: input, report } // pas du JSON exploitable : on ne touche à rien
  }

  const root = data as { type?: string; features?: Feature[] }
  let features: Feature[]
  if (root.type === 'FeatureCollection' && Array.isArray(root.features)) features = root.features
  else if (root.type === 'Feature') features = [root as Feature]
  else if (root.type && 'coordinates' in (data as object)) features = [{ type: 'Feature', geometry: data as Geometry, properties: {} }]
  else return { geojson: input, report }

  report.featuresBefore = features.length
  const out: Feature[] = []
  for (const f of features) {
    const g = f.geometry
    if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) { out.push(f); continue }
    out.push(...sanitizeFeature(f, report))
  }
  report.featuresAfter = out.length
  report.areaBeforeHa = +report.areaBeforeHa.toFixed(3)
  report.areaAfterHa = +report.areaAfterHa.toFixed(3)
  return { geojson: { type: 'FeatureCollection', features: out }, report }
}

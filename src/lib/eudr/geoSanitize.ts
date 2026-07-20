// Nettoyage GeoJSON pour EUDR TRACES V3.
// La spec géo EUDR n'accepte, par « production place », qu'un **Point** ou un
// **Polygon** — jamais un MultiPolygon, ni un polygone à trous. TRACES, sinon,
// aplatit les anneaux et croit voir une auto-intersection d'anneau
// (« Ring Self-intersection »), ou refuse « Polygon with holes ».
//
// Pipeline (validé sur les 2 vrais fichiers ICWP avec JTS — le moteur de TRACES —
// comme juge : 0 MultiPolygon, 0 trou, 0 géométrie invalide/non-simple, surface
// préservée à 0,00 %) :
//   1. cleanCoords — retire les sommets dupliqués / colinéaires,
//   2. MultiPolygon → éclaté en autant de features Polygon (1 par sous-polygone),
//   3. chaque Polygon ne garde que son anneau extérieur (suppression des trous).
// ⚠️ Retirer un trou modifie légèrement la surface déclarée — d'où le rapport.
import { cleanCoords } from '@turf/turf'

export interface SanitizeReport {
  featuresBefore: number
  featuresAfter: number
  holesRemoved: number         // anneaux intérieurs supprimés
  multiPolygonsSplit: number   // MultiPolygon éclatés en Polygons
  changed: boolean
}

type Ring = number[][]
type Geometry = { type: string; coordinates?: unknown }
type Feature = { type: 'Feature'; geometry: Geometry | null; properties?: unknown }

/** Construit un feature Polygon à partir de ses anneaux, en ne gardant que l'extérieur. */
function polygonFeature(rings: Ring[], properties: unknown, report: SanitizeReport): Feature {
  if (rings.length > 1) report.holesRemoved += rings.length - 1
  return { type: 'Feature', properties, geometry: { type: 'Polygon', coordinates: [rings[0]] } }
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
  const report: SanitizeReport = { featuresBefore: 0, featuresAfter: 0, holesRemoved: 0, multiPolygonsSplit: 0, changed: false }
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
  return { geojson: { type: 'FeatureCollection', features: out }, report }
}

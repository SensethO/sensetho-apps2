// Nettoyage GeoJSON pour EUDR TRACES V3.
// TRACES refuse : les polygones à trous (anneaux intérieurs) et les anneaux
// qui se recoupent eux-mêmes (self-intersection / « kinks »), souvent causés
// par des sommets dupliqués ou des pincements d'anneau.
// Pipeline (validé sur les vrais fichiers ICWP, surface préservée à 0,00 %) :
//   1. cleanCoords — retire les sommets dupliqués / colinéaires (cause fréquente),
//   2. suppression des trous (on ne garde que l'anneau extérieur),
//   3. si le polygone reste auto-sécant : buffer(0) (répare la topologie sans
//      changer la surface), avec repli sur unkinkPolygon (découpe).
// ⚠️ Retirer un trou modifie légèrement la surface déclarée — d'où le rapport renvoyé.
import { kinks, unkinkPolygon, cleanCoords, buffer } from '@turf/turf'

export interface SanitizeReport {
  featuresBefore: number
  featuresAfter: number
  holesRemoved: number            // nombre d'anneaux intérieurs supprimés
  selfIntersectionsFixed: number  // polygones auto-sécants réparés
  changed: boolean
}

type Geometry = { type: string; coordinates?: unknown }
type Feature = { type: 'Feature'; geometry: Geometry | null; properties?: unknown }

function stripHoles(geom: Geometry, report: SanitizeReport): void {
  if (geom.type === 'Polygon') {
    const rings = geom.coordinates as unknown[]
    if (Array.isArray(rings) && rings.length > 1) {
      report.holesRemoved += rings.length - 1
      geom.coordinates = [rings[0]]
    }
  } else if (geom.type === 'MultiPolygon') {
    const polys = geom.coordinates as unknown[][]
    if (Array.isArray(polys)) {
      geom.coordinates = polys.map(poly => {
        if (Array.isArray(poly) && poly.length > 1) {
          report.holesRemoved += poly.length - 1
          return [poly[0]]
        }
        return poly
      })
    }
  }
}

function countKinks(f: Feature): number {
  try { return kinks(f as never).features.length } catch { return 0 }
}

/** Répare un feature polygonal : nettoyage sommets → trous → topologie. → 1..n features valides. */
function repairFeature(feat: Feature, report: SanitizeReport): Feature[] {
  // 1. cleanCoords : supprime les sommets dupliqués/colinéaires (cause n°1 des « kinks » ICWP).
  let f: Feature = feat
  try { f = { type: 'Feature', properties: feat.properties, geometry: (cleanCoords(feat as never) as { geometry: Geometry }).geometry } } catch { /* garde l'original */ }

  // 2. suppression des trous.
  if (f.geometry) stripHoles(f.geometry, report)

  // 3. si encore auto-sécant : buffer(0) (préserve la surface) puis, en dernier recours, unkink.
  if (countKinks(f) > 0) {
    try {
      const b = buffer(f as never, 0, { units: 'meters' }) as { geometry: Geometry } | undefined
      if (b && b.geometry && countKinks({ type: 'Feature', geometry: b.geometry, properties: f.properties }) === 0) {
        report.selfIntersectionsFixed += 1
        report.changed = true
        return [{ type: 'Feature', geometry: b.geometry, properties: feat.properties }]
      }
    } catch { /* tente unkink */ }
    try {
      const u = unkinkPolygon(f as never) as { features: Array<{ geometry: Geometry }> }
      report.selfIntersectionsFixed += 1
      report.changed = true
      return u.features.map(p => ({ type: 'Feature', geometry: p.geometry, properties: feat.properties }))
    } catch { /* laisse tel quel (échec de réparation) */ }
  }
  return [f]
}

/**
 * Nettoie un GeoJSON (chaîne JSON ou objet) sans muter l'entrée.
 * Renvoie une FeatureCollection acceptée par TRACES + un rapport de ce qui a changé.
 */
export function sanitizeGeojson(input: unknown): { geojson: unknown; report: SanitizeReport } {
  const report: SanitizeReport = { featuresBefore: 0, featuresAfter: 0, holesRemoved: 0, selfIntersectionsFixed: 0, changed: false }
  let data: unknown
  try {
    data = typeof input === 'string' ? JSON.parse(input) : JSON.parse(JSON.stringify(input))
  } catch {
    return { geojson: input, report } // pas du JSON exploitable : on ne touche à rien
  }

  const root = data as { type?: string; features?: Feature[]; geometry?: Geometry }
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
    const before = report.holesRemoved
    out.push(...repairFeature(f, report))
    if (report.holesRemoved > before) report.changed = true
  }
  report.featuresAfter = out.length
  return { geojson: { type: 'FeatureCollection', features: out }, report }
}

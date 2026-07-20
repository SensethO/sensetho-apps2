// Nettoyage GeoJSON pour EUDR TRACES V3.
// TRACES refuse : les polygones à trous (anneaux intérieurs) et les anneaux
// qui se recoupent eux-mêmes (self-intersection / « kinks »).
// Ce module produit une géométrie acceptée :
//   1. suppression des trous (on ne garde que l'anneau extérieur de chaque polygone),
//   2. réparation des auto-intersections via turf.unkinkPolygon (découpe en polygones valides).
// ⚠️ Retirer un trou modifie légèrement la surface déclarée — d'où le rapport renvoyé.
import { kinks, unkinkPolygon } from '@turf/turf'

export interface SanitizeReport {
  featuresBefore: number
  featuresAfter: number
  holesRemoved: number       // nombre d'anneaux intérieurs supprimés
  polygonsUnkinked: number   // polygones réparés (auto-intersection)
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

/** Réparation d'un feature polygonal auto-sécant → 1..n features valides. */
function unkinkFeature(f: Feature, report: SanitizeReport): Feature[] {
  try {
    const k = kinks(f as never)
    if (!k.features || k.features.length === 0) return [f]
    const fixed = unkinkPolygon(f as never)
    report.polygonsUnkinked += 1
    report.changed = true
    return (fixed.features as unknown as Array<{ geometry: Geometry }>).map(p => ({
      type: 'Feature', geometry: p.geometry, properties: f.properties,
    }))
  } catch {
    return [f] // en cas d'échec de la détection/réparation, on laisse tel quel
  }
}

/**
 * Nettoie un GeoJSON (chaîne JSON ou objet) sans muter l'entrée.
 * Renvoie une FeatureCollection acceptée par TRACES + un rapport de ce qui a changé.
 */
export function sanitizeGeojson(input: unknown): { geojson: unknown; report: SanitizeReport } {
  const report: SanitizeReport = { featuresBefore: 0, featuresAfter: 0, holesRemoved: 0, polygonsUnkinked: 0, changed: false }
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
    stripHoles(g, report)
    if (report.holesRemoved > before) report.changed = true
    out.push(...unkinkFeature(f, report))
  }
  report.featuresAfter = out.length
  return { geojson: { type: 'FeatureCollection', features: out }, report }
}

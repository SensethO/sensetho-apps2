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
import { cleanCoords } from '@turf/turf'

const DECIMALS = 6 // ~0,11 m : précision largement suffisante pour des parcelles, et acceptée par TRACES.

export interface SanitizeReport {
  featuresBefore: number
  featuresAfter: number
  holesRemoved: number         // anneaux intérieurs supprimés
  multiPolygonsSplit: number   // MultiPolygon éclatés en Polygons
  coordinatesRounded: boolean  // arrondi à DECIMALS décimales appliqué
  changed: boolean
}

type Ring = number[][]
type Geometry = { type: string; coordinates?: unknown }
type Feature = { type: 'Feature'; geometry: Geometry | null; properties?: unknown }

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
  if (rings.length > 1) report.holesRemoved += rings.length - 1
  report.coordinatesRounded = true
  return { type: 'Feature', properties, geometry: { type: 'Polygon', coordinates: [roundRing(rings[0])] } }
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
  const report: SanitizeReport = { featuresBefore: 0, featuresAfter: 0, holesRemoved: 0, multiPolygonsSplit: 0, coordinatesRounded: false, changed: false }
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

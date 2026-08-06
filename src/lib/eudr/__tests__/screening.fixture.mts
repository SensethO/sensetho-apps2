// Jeu d'essai du moteur de tri : chaque parcelle déclenche un défaut précis.
// Un contrôle qui ne se déclenche pas sur un cas fabriqué pour lui est un
// contrôle qui ne se déclenchera pas non plus en production.
import { trierGeojson } from '../screening'

// Carré d'environ 300 m de côté autour d'un point, en Côte d'Ivoire.
function carre(cx: number, cy: number, d = 0.0015): number[][] {
  // Le decalage de 0,000003 garantit une 6e decimale non nulle : sans lui le
  // jeu d'essai declencherait lui-meme le controle de precision.
  const q = (v: number) => +(v + 0.000003).toFixed(6)
  return [[cx - d, cy - d], [cx + d, cy - d], [cx + d, cy + d], [cx - d, cy + d], [cx - d, cy - d]]
    .map(([x, y]) => [q(x), q(y)])
}
const poly = (anneaux: number[][][]) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: anneaux } })

const cas: Array<{ nom: string; attendu: string; feature: unknown }> = [
  { nom: 'parcelle saine', attendu: '', feature: poly([carre(-6.7317, 7.4288)]) },

  { nom: 'précision à 3 décimales', attendu: 'PRECISION_INSUFFISANTE',
    feature: poly([carre(-6.700, 7.500).map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)])]) },

  { nom: 'contour non refermé', attendu: 'ANNEAU_NON_FERME',
    feature: poly([carre(-6.650, 7.550).slice(0, 4)]) },

  { nom: 'noeud papillon (auto-intersection)', attendu: 'AUTO_INTERSECTION',
    feature: poly([[[-6.600001, 7.600001], [-6.598001, 7.602001], [-6.600001, 7.602001], [-6.598001, 7.600001], [-6.600001, 7.600001]]]) },

  { nom: 'sommets dupliqués', attendu: 'SOMMETS_DUPLIQUES',
    // Le meme sommet repete deux fois de suite, sans deformer le contour.
    feature: (() => { const a = carre(-6.550, 7.650); return poly([[a[0], a[0], ...a.slice(1)]]) })() },

  { nom: 'trou intérieur', attendu: 'TROUS',
    feature: poly([carre(-6.500, 7.700), carre(-6.500, 7.700, 0.0004)]) },

  { nom: 'coordonnées inversées (hors pays)', attendu: 'HORS_PAYS',
    feature: poly([carre(7.400000, -6.700000)]) },

  { nom: 'point pour 12 ha déclarés', attendu: 'POLYGONE_REQUIS',
    feature: { type: 'Feature', geometry: { type: 'Point', coordinates: [-6.450000, 7.750000] } } },

  { nom: 'géométrie absente', attendu: 'GEOMETRIE_ABSENTE',
    feature: { type: 'Feature', geometry: null } },

  // Les deux suivantes se recouvrent volontairement.
  { nom: 'recouvrement A', attendu: 'RECOUVREMENT', feature: poly([carre(-6.400, 7.800)]) },
  { nom: 'recouvrement B', attendu: 'RECOUVREMENT', feature: poly([carre(-6.399, 7.800)]) },

  // Les deux suivantes sont strictement identiques.
  { nom: 'doublon A', attendu: 'POLYGONE_DUPLIQUE', feature: poly([carre(-6.300, 7.900)]) },
  { nom: 'doublon B', attendu: 'POLYGONE_DUPLIQUE', feature: poly([carre(-6.300, 7.900)]) },

  { nom: 'surface démesurée', attendu: 'SURFACE_IMPLAUSIBLE',
    feature: poly([carre(-6.200, 8.000, 0.05)]) },
]

const surfacesDeclarees = cas.map((c, i) => (i === 7 ? 12 : null))

const rapport = trierGeojson(
  { type: 'FeatureCollection', features: cas.map(c => c.feature) },
  { paysDeclare: 'CI', surfacesDeclarees, surfaceMaxPlausibleHa: 100 },
)

console.log(`\nParcelles : ${rapport.nbParcelles}  |  surface totale : ${rapport.surfaceTotaleHa} ha`)
console.log(`Exploitable : ${rapport.exploitable ? 'oui' : 'NON — constats bloquants'}\n`)

const codesLeves = new Set(rapport.constats.map(c => c.code))
for (const c of rapport.constats) {
  const noms = c.parcelles.map(i => cas[i]?.nom ?? `#${i}`).join(', ')
  console.log(`  [${c.gravite.toUpperCase().padEnd(10)}] ${c.code.padEnd(24)} ${c.libelle}`)
  if (noms) console.log(`${' '.repeat(15)}→ ${noms}`)
}

console.log('\n--- vérification : chaque défaut fabriqué est-il détecté ? ---')
let manques = 0
for (const c of cas) {
  if (!c.attendu) continue
  const ok = codesLeves.has(c.attendu)
  if (!ok) manques++
  console.log(`  ${ok ? 'OK  ' : 'RATÉ'}  ${c.nom.padEnd(34)} attendait ${c.attendu}`)
}
console.log(manques ? `\n${manques} contrôle(s) inopérant(s).` : '\nTous les défauts fabriqués sont détectés.')

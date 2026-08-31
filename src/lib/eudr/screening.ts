// Tri automatique des fichiers de géolocalisation EUDR.
//
// Ce module ne prouve rien. Il écarte vite les fichiers inexploitables et
// signale les incohérences qui justifient une demande de révision au
// fournisseur, avant d'engager les frais d'une expertise satellite externe.
// La preuve de non-déforestation reste du ressort de l'expert ; les constats
// produits ici sont des indices de qualité documentaire.

export type Gravite = 'bloquant' | 'alerte' | 'information'

export interface Constat {
  code: string
  gravite: Gravite
  libelle: string
  /** Index des parcelles concernées dans le fichier, vide si le constat porte sur l'ensemble. */
  parcelles: number[]
  detail?: string
}

export interface OptionsTri {
  /** Code pays ISO 3166-1 alpha-2 déclaré pour le lot. */
  paysDeclare?: string
  /** Surfaces déclarées par le fournisseur, en hectares, dans l'ordre des parcelles. */
  surfacesDeclarees?: (number | null)[]
  /** Surface maximale plausible pour une exploitation familiale, en hectares. */
  surfaceMaxPlausibleHa?: number
}

/** Données d'une parcelle destinées au référentiel, hors géométrie complète. */
export interface FicheParcelle {
  featureIndex: number
  plotRef: string | null
  producerName: string | null
  commodity: string | null
  country: string | null
  geometryType: string
  declaredAreaHa: number | null
  computedAreaHa: number
  centroidLon: number | null
  centroidLat: number | null
  bbox: [number, number, number, number] | null
  /** Empreinte du contour : détecte un contour identique entre deux fichiers. */
  geomHash: string | null
  surveyDate: string | null
  surveySource: string | null
}

export interface RapportTri {
  lisible: boolean
  nbParcelles: number
  surfaceTotaleHa: number
  constats: Constat[]
  /** Vrai si aucun constat bloquant : le fichier peut partir en expertise. */
  exploitable: boolean
  /** Une fiche par parcelle, prête à verser au référentiel. */
  fiches: FicheParcelle[]
}

// Emprises grossières des pays d'approvisionnement. Elles ne remplacent pas un
// test point-dans-polygone : elles attrapent l'erreur grossière — coordonnées
// inversées, signe manquant, parcelle sur un autre continent.
const EMPRISES: Record<string, [number, number, number, number]> = {
  CI: [-8.60, 4.35, -2.49, 10.74],   // Côte d'Ivoire
  GH: [-3.26, 4.74, 1.20, 11.17],    // Ghana
  NG: [2.67, 4.27, 14.68, 13.89],    // Nigeria
  KE: [33.91, -4.68, 41.91, 5.51],   // Kenya
  CM: [8.49, 1.65, 16.19, 13.08],    // Cameroun
  EC: [-81.08, -5.01, -75.19, 1.44], // Équateur
  PE: [-81.33, -18.35, -68.65, -0.04], // Pérou
  BR: [-73.99, -33.75, -34.79, 5.27],  // Brésil
}

/**
 * Le pays est saisi en clair dans la fiche fournisseur — « Cote d'Ivoire », et
 * non « CI ». Sans cette table, la recherche d'emprise échouait silencieusement
 * et le contrôle de localisation ne s'exécutait jamais.
 */
const CODES_PAYS: Record<string, string> = {
  'cotedivoire': 'CI', 'cotedlvoire': 'CI', 'ivorycoast': 'CI', 'ci': 'CI',
  'ghana': 'GH', 'gh': 'GH',
  'nigeria': 'NG', 'ng': 'NG',
  'kenya': 'KE', 'ke': 'KE',
  'cameroun': 'CM', 'cameroon': 'CM', 'cm': 'CM',
  'equateur': 'EC', 'ecuador': 'EC', 'ec': 'EC',
  'perou': 'PE', 'peru': 'PE', 'pe': 'PE',
  'bresil': 'BR', 'brazil': 'BR', 'br': 'BR',
}

/** Normalise un pays saisi librement vers son code ISO, ou null. */
function codePays(saisie: string | undefined): string | null {
  if (!saisie) return null
  const cle = saisie.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z]/g, '')
  return CODES_PAYS[cle] ?? null
}

// Exporté : le référentiel des parcelles applique le même seuil que le tri,
// une règle de droit ne pouvant pas exister en deux exemplaires divergents.
export const SEUIL_POLYGONE_HA = 4      // au-delà, le polygone est obligatoire (art. 9)
// Plancher de recouvrement : en deçà, contiguïté ou imprécision de numérisation.
const SEUIL_RECOUVREMENT_HA = 0.01
const DECIMALES_MINIMUM = 6      // précision exigée (art. 9)
const R_TERRE_M = 6_378_137

type Anneau = number[][]
interface Parcelle {
  index: number
  type: 'Polygon' | 'MultiPolygon' | 'Point' | 'autre'
  anneaux: Anneau[]        // anneaux extérieurs uniquement
  trous: number            // nombre d'anneaux intérieurs
  point?: [number, number]
  aireHa: number
  bbox: [number, number, number, number]
}

/** Aire géodésique d'un anneau, en hectares (excès sphérique). */
function aireAnneauHa(anneau: Anneau): number {
  if (anneau.length < 4) return 0
  const rad = (d: number) => (d * Math.PI) / 180
  let somme = 0
  for (let i = 0; i < anneau.length - 1; i++) {
    const [x1, y1] = anneau[i]
    const [x2, y2] = anneau[i + 1]
    somme += (rad(x2) - rad(x1)) * (2 + Math.sin(rad(y1)) + Math.sin(rad(y2)))
  }
  return Math.abs((somme * R_TERRE_M * R_TERRE_M) / 2) / 10_000
}

function bboxDe(points: number[][]): [number, number, number, number] {
  let minx = 180, miny = 90, maxx = -180, maxy = -90
  for (const [x, y] of points) {
    if (x < minx) minx = x; if (x > maxx) maxx = x
    if (y < miny) miny = y; if (y > maxy) maxy = y
  }
  return [minx, miny, maxx, maxy]
}

const seChevauchent = (a: [number, number, number, number], b: [number, number, number, number]) =>
  a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3]

/**
 * Nombre de décimales de la partie fractionnaire.
 *
 * ⚠️ Ne jamais tester cette valeur coordonnée par coordonnée pour juger de la
 * précision : JavaScript supprime les zéros de fin, si bien qu'une coordonnée
 * légitime à -6,731700 redevient -6,7317 et paraît tronquée. Le contrôle se
 * fait sur le maximum observé dans tout le fichier — des données réellement
 * arrondies au millième n'auront nulle part plus de trois décimales, alors
 * qu'un relevé GPS en produira six ou davantage sur la quasi-totalité des
 * points.
 */
function decimales(n: number): number {
  const s = String(n)
  const i = s.indexOf('.')
  return i < 0 ? 0 : Math.min(s.length - i - 1, 15)
}

/** Deux segments se croisent-ils ailleurs qu'à leurs extrémités ? */
function segmentsSeCroisent(p1: number[], p2: number[], p3: number[], p4: number[]): boolean {
  const d = (a: number[], b: number[], c: number[]) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

function anneauSAutoIntersecte(anneau: Anneau): boolean {
  const n = anneau.length - 1
  // Au-delà de quelques centaines de sommets le test quadratique coûte cher ;
  // les fichiers EUDR sont simplifiés bien en deçà.
  if (n > 600) return false
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue // segments adjacents par fermeture
      if (segmentsSeCroisent(anneau[i], anneau[i + 1], anneau[j], anneau[j + 1])) return true
    }
  }
  return false
}

/** Un point est-il dans un anneau ? (lancer de rayon) */
function pointDansAnneau(x: number, y: number, anneau: Anneau): boolean {
  let dedans = false
  for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i++) {
    const [xi, yi] = anneau[i], [xj, yj] = anneau[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans
  }
  return dedans
}

/**
 * Surface commune à deux anneaux, en hectares, par échantillonnage régulier.
 *
 * ⚠️ Ne jamais conclure au recouvrement depuis l'appartenance d'un sommet à
 * l'autre anneau : deux parcelles voisines partagent une limite, et un sommet
 * posé dessus fait basculer le lancer de rayon. Mesuré sur un fichier réel, ce
 * raccourci déclarait un recouvrement entre deux parcelles dont l'intersection
 * valait 0,0000 ha. La contiguïté est la norme en cacao — un test qui la
 * confond avec la superposition rejette des fichiers valides.
 */
function surfaceCommuneHa(a: Anneau, b: Anneau): number {
  const [ax0, ay0, ax1, ay1] = bboxDe(a)
  const [bx0, by0, bx1, by1] = bboxDe(b)
  const x0 = Math.max(ax0, bx0), y0 = Math.max(ay0, by0)
  const x1 = Math.min(ax1, bx1), y1 = Math.min(ay1, by1)
  if (x1 <= x0 || y1 <= y0) return 0

  const N = 120 // 14 400 tests par paire candidate : suffisant à l'échelle d'une parcelle
  let dedans = 0
  for (let i = 0; i < N; i++) {
    const x = x0 + ((i + 0.5) / N) * (x1 - x0)
    for (let j = 0; j < N; j++) {
      const y = y0 + ((j + 0.5) / N) * (y1 - y0)
      if (pointDansAnneau(x, y, a) && pointDansAnneau(x, y, b)) dedans++
    }
  }
  if (!dedans) return 0
  const haParDegreCarre = (111_320 ** 2 * Math.cos((y0 * Math.PI) / 180)) / 10_000
  return (dedans / (N * N)) * (x1 - x0) * (y1 - y0) * haParDegreCarre
}

/** Empreinte d'un anneau, pour détecter les polygones identiques. */
function empreinte(anneau: Anneau): string {
  return anneau.map(([x, y]) => `${x.toFixed(5)},${y.toFixed(5)}`).sort().join(';')
}

function extraire(features: unknown[]): Parcelle[] {
  return features.map((f, index) => {
    const g = (f as { geometry?: { type?: string; coordinates?: unknown } })?.geometry
    const type = g?.type
    const vide: Parcelle = { index, type: 'autre', anneaux: [], trous: 0, aireHa: 0, bbox: [0, 0, 0, 0] }
    if (!g || !Array.isArray(g.coordinates)) return vide

    if (type === 'Point') {
      const [x, y] = g.coordinates as number[]
      if (typeof x !== 'number' || typeof y !== 'number') return vide
      return { index, type: 'Point', anneaux: [], trous: 0, point: [x, y], aireHa: 0, bbox: [x, y, x, y] }
    }
    // GeoJSON : un Polygon porte des anneaux, un MultiPolygon porte des polygones.
    // On ramène les deux à une liste de polygones, chacun étant une liste d'anneaux.
    const polys: Anneau[][] = type === 'Polygon'
      ? [g.coordinates as Anneau[]]
      : type === 'MultiPolygon' ? (g.coordinates as Anneau[][]) : []
    if (!polys.length) return vide

    const anneaux = polys.map(p => p[0]).filter(Array.isArray)
    const trous = polys.reduce((n, p) => n + Math.max(0, p.length - 1), 0)
    const aireHa = anneaux.reduce((s, a) => s + aireAnneauHa(a), 0)
    return {
      index, type: type as 'Polygon' | 'MultiPolygon', anneaux, trous, aireHa,
      bbox: bboxDe(anneaux.flat()),
    }
  })
}

/** Première valeur non vide parmi une liste de clés, insensible à la casse. */
function propriete(props: Record<string, unknown>, cles: string[]): string | null {
  const index = new Map(Object.keys(props).map(k => [k.toLowerCase().replace(/[\s_-]/g, ''), k]))
  for (const cle of cles) {
    const reel = index.get(cle.toLowerCase().replace(/[\s_-]/g, ''))
    const v = reel ? props[reel] : undefined
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return null
}

/**
 * Fiche destinée au référentiel. La géométrie complète n'y figure pas : le
 * fichier source reste sur SharePoint et fait foi. Seules les valeurs dérivées
 * nécessaires aux contrôles sont retenues.
 */
function ficheDe(p: Parcelle, feature: unknown, options: OptionsTri): FicheParcelle {
  const props = ((feature as { properties?: Record<string, unknown> })?.properties ?? {}) as Record<string, unknown>
  const sommets = p.point ? [p.point as number[]] : p.anneaux.flat()
  const centroide = sommets.length
    ? sommets.reduce((a, [x, y]) => [a[0] + x / sommets.length, a[1] + y / sommets.length], [0, 0])
    : null
  const declaree = options.surfacesDeclarees?.[p.index]
    ?? (propriete(props, ['area', 'superficie', 'surface', 'areaha', 'surfaceha']) !== null
      ? Number(propriete(props, ['area', 'superficie', 'surface', 'areaha', 'surfaceha'])) || null
      : null)

  return {
    featureIndex: p.index,
    plotRef: propriete(props, ['plotid', 'plotref', 'id', 'parcelle', 'refparcelle', 'code']),
    producerName: propriete(props, ['producer', 'producteur', 'farmer', 'exploitant', 'name', 'nom']),
    commodity: propriete(props, ['commodity', 'culture', 'crop', 'produit']),
    country: propriete(props, ['country', 'pays', 'countrycode']) ?? options.paysDeclare ?? null,
    geometryType: p.type,
    declaredAreaHa: declaree,
    computedAreaHa: +p.aireHa.toFixed(4),
    centroidLon: centroide ? +centroide[0].toFixed(6) : null,
    centroidLat: centroide ? +centroide[1].toFixed(6) : null,
    bbox: p.anneaux.length || p.point ? p.bbox : null,
    // Empreinte du premier anneau : suffit à repérer un contour recopié.
    geomHash: p.anneaux.length ? empreinte(p.anneaux[0]).slice(0, 200) : null,
    surveyDate: propriete(props, ['surveydate', 'datereleve', 'date', 'collectiondate']),
    surveySource: propriete(props, ['surveysource', 'sourcereleve', 'source', 'method', 'methode']),
  }
}

/**
 * Passe l'ensemble des contrôles automatiques sur un fichier de géolocalisation.
 * Le fichier est réputé exploitable en l'absence de constat bloquant.
 */
export function trierGeojson(brut: unknown, options: OptionsTri = {}): RapportTri {
  const constats: Constat[] = []
  const ajouter = (code: string, gravite: Gravite, libelle: string, parcelles: number[] = [], detail?: string) =>
    constats.push({ code, gravite, libelle, parcelles, detail })

  // — Structure du fichier
  const fc = brut as { type?: string; features?: unknown[]; crs?: { properties?: { name?: string } } } | null
  if (!fc || typeof fc !== 'object' || !Array.isArray(fc.features)) {
    ajouter('FICHIER_ILLISIBLE', 'bloquant', 'Le fichier n’est pas une collection GeoJSON exploitable.')
    return { lisible: false, nbParcelles: 0, surfaceTotaleHa: 0, constats, exploitable: false, fiches: [] }
  }
  if (fc.type !== 'FeatureCollection') {
    ajouter('TYPE_INATTENDU', 'alerte', `Type racine « ${fc.type ?? 'absent'} » au lieu de FeatureCollection.`)
  }
  if (!fc.features.length) {
    ajouter('AUCUNE_PARCELLE', 'bloquant', 'Le fichier ne contient aucune parcelle.')
    return { lisible: true, nbParcelles: 0, surfaceTotaleHa: 0, constats, exploitable: false, fiches: [] }
  }

  // Un CRS déclaré autre que WGS84 fausserait toutes les surfaces.
  const crs = fc.crs?.properties?.name
  if (crs && !/CRS84|4326/i.test(crs)) {
    ajouter('CRS_NON_WGS84', 'bloquant', `Système de coordonnées déclaré « ${crs} » au lieu de WGS84 (EPSG:4326).`)
  }

  // Note de traçabilité embarquée par notre correction automatique : on la ré-émet
  // en constat « information » à chaque tri, pour qu'elle reste visible sur le dossier.
  const corr = (fc as { sensetho_correction?: { pourquoi?: string; comment?: string; avertissements?: string[]; date?: string } }).sensetho_correction
  if (corr && typeof corr === 'object') {
    const date = corr.date ? new Date(corr.date).toLocaleString('fr-FR') : ''
    ajouter('CORRECTION_SYSTEME', 'information',
      `Fichier modifié automatiquement par le système Sens'ethO${date ? ` le ${date}` : ''}.`,
      [],
      [corr.pourquoi ? `Pourquoi : ${corr.pourquoi}` : '', corr.comment ? `Comment : ${corr.comment}` : '', ...(corr.avertissements ?? [])].filter(Boolean).join(' '))
  }

  const parcelles = extraire(fc.features)
  const surfaceMax = options.surfaceMaxPlausibleHa ?? 100

  // — Contrôles parcelle par parcelle
  const sansGeometrie: number[] = [], precisionFaible: number[] = [], pointsImprecis: number[] = [], nonFermes: number[] = []
  const autoIntersect: number[] = [], dupliquesSommets: number[] = [], avecTrous: number[] = []
  const horsPays: number[] = [], pointTropGrand: number[] = [], minuscules: number[] = []
  const enormes: number[] = [], ecartSurface: number[] = []

  const iso = codePays(options.paysDeclare)
  const emprise = iso ? EMPRISES[iso] : undefined
  let decimalesMax = 0

  for (const p of parcelles) {
    if (p.type === 'autre' || (!p.anneaux.length && !p.point)) { sansGeometrie.push(p.index); continue }

    const sommets = p.point ? [p.point as number[]] : p.anneaux.flat()

    // Maximum par parcelle, jamais par coordonnée : un relevé à six décimales
    // produit forcément un sommet dont la sixième n'est pas nulle, alors qu'une
    // coordonnée isolée peut légitimement finir par des zéros.
    let maxParcelle = 0
    for (const [x, y] of sommets) {
      maxParcelle = Math.max(maxParcelle, decimales(x), decimales(y))
    }
    decimalesMax = Math.max(decimalesMax, maxParcelle)
    // Le raisonnement ci-dessus tient sur un polygone — dix coordonnées ou plus,
    // la probabilité qu'elles finissent toutes par un zéro est nulle. Sur un
    // point unique elle vaut 1 %, ce qui produirait des rejets injustifiés :
    // les points sont donc jugés plus loin, sur la précision globale du fichier.
    if (maxParcelle < DECIMALES_MINIMUM) {
      if (p.type === 'Point') pointsImprecis.push(p.index)
      else precisionFaible.push(p.index)
    }
    if (sommets.some(([x, y]) => Math.abs(x) > 180 || Math.abs(y) > 90)) {
      ajouter('COORDONNEES_INVALIDES', 'bloquant', 'Coordonnées hors des bornes terrestres.', [p.index])
    }
    if (emprise && sommets.some(([x, y]) =>
      x < emprise[0] || x > emprise[2] || y < emprise[1] || y > emprise[3])) {
      horsPays.push(p.index)
    }

    for (const a of p.anneaux) {
      const [x0, y0] = a[0], [xn, yn] = a[a.length - 1]
      if (x0 !== xn || y0 !== yn) { nonFermes.push(p.index); break }
    }
    if (p.anneaux.some(a => a.some((s, i) => i > 0 && s[0] === a[i - 1][0] && s[1] === a[i - 1][1]))) {
      dupliquesSommets.push(p.index)
    }
    if (p.anneaux.some(anneauSAutoIntersecte)) autoIntersect.push(p.index)
    if (p.trous > 0) avecTrous.push(p.index)

    const declaree = options.surfacesDeclarees?.[p.index] ?? null
    if (p.type === 'Point' && declaree != null && declaree > SEUIL_POLYGONE_HA) {
      pointTropGrand.push(p.index)
    }
    if (p.aireHa > 0 && p.aireHa < 0.01) minuscules.push(p.index)
    if (p.aireHa > surfaceMax) enormes.push(p.index)
    if (declaree != null && declaree > 0 && p.aireHa > 0) {
      const ecart = Math.abs(p.aireHa - declaree) / declaree
      if (ecart > 0.20) ecartSurface.push(p.index)
    }
  }

  if (sansGeometrie.length) ajouter('GEOMETRIE_ABSENTE', 'bloquant', 'Parcelles sans géométrie exploitable.', sansGeometrie)
  // Un point n'est mis en cause que si tout le fichier est grossier : si des
  // polygones voisins portent six décimales, la source est fiable et le point
  // se termine simplement par des zéros.
  if (pointsImprecis.length && decimalesMax < DECIMALES_MINIMUM) {
    precisionFaible.push(...pointsImprecis)
  }
  if (precisionFaible.length) {
    const pire = Math.min(...precisionFaible.map(i => {
      const s = parcelles[i].point ? [parcelles[i].point as number[]] : parcelles[i].anneaux.flat()
      return Math.max(...s.flatMap(([x, y]) => [decimales(x), decimales(y)]))
    }))
    ajouter('PRECISION_INSUFFISANTE', 'bloquant',
      `Coordonnées arrondies : ${DECIMALES_MINIMUM} décimales exigées par l’article 9.`,
      precisionFaible, `Au pire ${pire} décimales, soit environ ${Math.round(111_000 / 10 ** pire)} m d’incertitude au sol.`)
  }
  if (nonFermes.length) ajouter('ANNEAU_NON_FERME', 'bloquant', 'Contour non refermé sur son point de départ.', nonFermes)
  if (autoIntersect.length) ajouter('AUTO_INTERSECTION', 'bloquant', 'Le contour se croise lui-même : TRACES rejettera la géométrie.', autoIntersect)
  if (dupliquesSommets.length) ajouter('SOMMETS_DUPLIQUES', 'alerte', 'Sommets consécutifs identiques.', dupliquesSommets)
  if (avecTrous.length) ajouter('TROUS', 'alerte', 'Anneaux intérieurs : à justifier, ou à retirer avant dépôt.', avecTrous)
  if (horsPays.length) ajouter('HORS_PAYS', 'bloquant', `Parcelles hors de l’emprise de ${options.paysDeclare} (${iso}). Coordonnées inversées ou pays erroné.`, horsPays)
  if (pointTropGrand.length) ajouter('POLYGONE_REQUIS', 'bloquant', `Point déclaré pour une surface supérieure à ${SEUIL_POLYGONE_HA} ha : l’article 9 impose un polygone.`, pointTropGrand)
  if (minuscules.length) ajouter('SURFACE_MINUSCULE', 'alerte', 'Surface inférieure à 0,01 ha : saisie probablement erronée.', minuscules)
  if (enormes.length) ajouter('SURFACE_IMPLAUSIBLE', 'alerte', `Surface supérieure à ${surfaceMax} ha pour une exploitation familiale.`, enormes)
  if (ecartSurface.length) ajouter('ECART_SURFACE', 'alerte', 'Écart supérieur à 20 % entre surface calculée et surface déclarée.', ecartSurface)

  // — Contrôles croisés entre parcelles
  const recouvrements: string[] = []
  const recouvrementsIdx: number[] = []
  const doublons = new Map<string, number[]>()
  for (const p of parcelles) {
    for (const a of p.anneaux) {
      const e = empreinte(a)
      doublons.set(e, [...(doublons.get(e) ?? []), p.index])
    }
  }
  for (const [, idx] of doublons) {
    if (new Set(idx).size > 1) {
      ajouter('POLYGONE_DUPLIQUE', 'bloquant',
        'Contour strictement identique déclaré sur plusieurs parcelles.', [...new Set(idx)])
    }
  }

  // Pré-filtre par boîte englobante : à moins de 1000 parcelles, le coût reste
  // négligeable, et seules les paires retenues sont mesurées finement.
  for (let i = 0; i < parcelles.length; i++) {
    for (let j = i + 1; j < parcelles.length; j++) {
      const a = parcelles[i], b = parcelles[j]
      if (!a.anneaux.length || !b.anneaux.length) continue
      if (!seChevauchent(a.bbox, b.bbox)) continue

      let commune = 0
      for (const ra of a.anneaux) for (const rb of b.anneaux) commune += surfaceCommuneHa(ra, rb)
      // Tolérance : au-dessous, on est dans la contiguïté ou l'imprécision de
      // numérisation, pas dans la double déclaration d'une même terre.
      const seuil = Math.max(SEUIL_RECOUVREMENT_HA, 0.01 * Math.min(a.aireHa, b.aireHa))
      if (commune > seuil) {
        recouvrements.push(`${a.index + 1}/${b.index + 1} (${commune.toFixed(3)} ha)`)
        recouvrementsIdx.push(a.index, b.index)
      }
    }
  }
  if (recouvrements.length) {
    ajouter('RECOUVREMENT', 'bloquant',
      'Parcelles qui se superposent : une même terre est déclarée deux fois.',
      [...new Set(recouvrementsIdx)],
      `Surfaces communes mesurées — ${recouvrements.slice(0, 20).join(' ; ')}`)
  }

  const surfaceTotaleHa = parcelles.reduce((s, p) => s + p.aireHa, 0)
  const fiches = parcelles.map((p, i) => ficheDe(p, (fc.features as unknown[])[i], options))

  return {
    lisible: true,
    nbParcelles: parcelles.length,
    surfaceTotaleHa: +surfaceTotaleHa.toFixed(4),
    constats,
    exploitable: !constats.some(c => c.gravite === 'bloquant'),
    fiches,
  }
}

'use client'

import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react'

// Détection de perturbation du couvert (Whisp / Open Foris) par document GeoJSON.
//
// ⚠️ Vocabulaire : Whisp détecte un CHANGEMENT du couvert, pas une déforestation au
// sens EUDR. Ce panneau ne rend donc aucun verdict de « risque » : il désigne des
// SIGNAUX À INSTRUIRE, que l'utilisateur qualifie ensuite lui-même (table
// eudr_signal_qualifications). Une comparaison du 31/08/2026 avec un prestataire de
// télédétection spécialisé, sur le même jeu de 24 parcelles ivoiriennes, a donné
// 2 parcelles « à risque élevé » côté Whisp et 0 ha de déforestation côté expert :
// l'écart tient à la nature de la donnée, pas à une erreur de l'un ou de l'autre.

interface Plot {
  plotId: string; area: number | null; unit: string | null
  riskPcrop: string | null; riskAcrop: string | null; riskTimber: string | null
  disturbanceAfter2020: boolean; treecover2020: boolean; commodities: boolean; primary2020: boolean
}
interface Analysis {
  id: string; attachment_id: string; source_name: string | null; analyzed_at: string; analyzed_by: string | null
  overall_risk: 'low' | 'high' | 'unknown'; plot_count: number
  summary: { high: number; low: number; disturbedAfter2020: number } | null
  plots: Plot[] | null
}
interface Att { id: string; name: string; entity_type: string | null; entity_id: string | null; created_at: string }

/**
 * Versions d'un même fichier de géolocalisation (« X.geojson » / « X (corrigé).geojson »).
 *
 * L'analyse de couvert est clé par attachement seul : elle ne suit donc PAS la
 * correction. Une parcelle versée depuis la version corrigée apparaîtrait « non
 * analysée » alors que l'original l'a été. On ne reporte surtout pas le résultat —
 * la correction a modifié les géométries, un calcul Whisp fait sur l'original ne
 * vaut plus — on se contente de le dire, et de mettre l'analyse en avant.
 */
interface EtatVersion {
  attachmentId: string; nom: string | null
  version: 'en_etat' | 'corrigee'; libelleVersion: string
  autreVersionId: string | null; autreVersionNom: string | null
  autreVersionRole: 'fichier_initial' | 'version_corrigee' | null
  auPerimetre: boolean; autreAuPerimetre: boolean
  colonneOrigineDisponible: boolean
}

/** Résultat d'une reprise de conclusions d'une version vers l'autre. */
interface Reprise {
  reprises: number
  candidates: number
  appariees: { plotIdSource: string; plotIdCible: string; mode: 'plot_id' | 'rang' }[]
  nonAppariables: { plotIdSource: string; motif: string }[]
  dejaInstruites: string[]
  error?: string
}

/** Conclusion d'instruction consignée pour une parcelle signalée. */
interface Qual {
  attachment_id: string; plot_id: string; statut: Statut
  commentaire: string | null; source: string | null
  qualified_at: string | null; qualified_by: string | null
}
type Statut =
  | 'a_instruire' | 'deforestation_confirmee'
  | 'ecartee_deja_en_production' | 'ecartee_repousse_ou_naturel' | 'ecartee_expertise_externe'

/**
 * `actif` = le signal compte encore comme à traiter. Une parcelle écartée sort des
 * compteurs : c'est tout l'intérêt de l'instruction.
 */
const STATUTS: { v: Statut; label: string; court: string; actif: boolean }[] = [
  { v: 'a_instruire', label: 'À instruire (défaut)', court: '🟠 À instruire', actif: true },
  { v: 'deforestation_confirmee', label: 'Déforestation confirmée', court: '🔴 Déforestation confirmée', actif: true },
  { v: 'ecartee_deja_en_production', label: 'Écartée : parcelle déjà en production', court: '✅ Écartée — déjà en production', actif: false },
  { v: 'ecartee_repousse_ou_naturel', label: 'Écartée : repousse ou événement naturel', court: '✅ Écartée — repousse ou événement naturel', actif: false },
  { v: 'ecartee_expertise_externe', label: 'Écartée : expertise externe négative', court: '✅ Écartée — expertise externe négative', actif: false },
]
const statutInfo = (s?: Statut | null) => STATUTS.find(x => x.v === s) ?? STATUTS[0]

const card = 'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 p-5 space-y-4'
const btn = 'px-3 py-1.5 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50'
const field = 'w-full text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-gray-800 dark:text-gray-200'

const AMBER = 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
const RED = 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
const GREEN = 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
const GRAY = 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'

/** Whisp n'a pas de niveau intermédiaire : « high » veut dire « quelque chose est détecté ». */
const isHigh = (r?: string | null) => (r ?? '').trim().toLowerCase() === 'high'
const signalBadge = (r?: string | null) => {
  const v = (r ?? '').trim().toLowerCase()
  if (v === 'high') return AMBER
  if (v === 'low') return GRAY
  return GRAY
}
const signalCell = (r?: string | null) => {
  const v = (r ?? '').trim().toLowerCase()
  if (v === 'high') return 'Signal'
  if (v === 'low') return 'Aucun'
  return '—'
}
/** Une parcelle est « signalée » dès qu'un indicateur Whisp remonte quelque chose. */
const isSignalled = (p: Plot) =>
  p.disturbanceAfter2020 || isHigh(p.riskPcrop) || isHigh(p.riskAcrop) || isHigh(p.riskTimber)

/**
 * Vignette satellite : charge l'image via fetch pour pouvoir afficher le motif exact
 * en cas d'échec (une <img> classique ne montrerait qu'un cadre vide).
 */
/** Contours des parcelles à superposer, exprimés dans la même bbox que l'image. */
interface Overlay { bbox: number[]; rings: number[][][] }
/** Calque OpenStreetMap : routes (lignes) et bâtiments (polygones), même bbox. */
interface OsmRoad { pts: number[][]; name: string | null }
interface OsmPlace { lon: number; lat: number; name: string; type: string }
interface OsmCity { name: string; type: string; population: number | null; km: number; direction: string; source: 'osm' | 'nominatim' }
interface OsmContext { country: string | null; countryCode: string | null; region: string | null; nearestCity: OsmCity | null }
interface OsmLayer {
  bbox: number[]; roads: OsmRoad[]; buildings: number[][][]
  places: OsmPlace[]; context: OsmContext; scaleKm: number; warning?: string | null
}

/**
 * Jeton de version des cartes, à incrémenter dès que le cadrage, la résolution ou la forme
 * des réponses change. Images, contours et calques sont mis en cache jusqu'à 7 jours : sans
 * ce jeton, un cadrage modifié ne serait visible qu'à l'expiration.
 */
const MAP_V = 5

/**
 * Mémoire des calques, hors du composant pour survivre au démontage (fermer puis rouvrir
 * la vue satellite ne redemande rien), et recopiée dans sessionStorage pour survivre à un
 * rechargement de page. Les images, elles, sont mises en cache par le navigateur grâce aux
 * en-têtes Cache-Control des routes : rien à stocker ici.
 */
const OSM_TTL_MS = 24 * 3600 * 1000
function makeStore<T>(prefix: string) {
  const mem = new Map<string, { at: number; v: T }>()
  return {
    get(key: string): T | null {
      const hit = mem.get(key) ?? readSession<T>(prefix + key)
      if (!hit || Date.now() - hit.at > OSM_TTL_MS) return null
      mem.set(key, hit)
      return hit.v
    },
    set(key: string, v: T) {
      const rec = { at: Date.now(), v }
      mem.set(key, rec)
      try { sessionStorage.setItem(prefix + key, JSON.stringify(rec)) } catch { /* quota ou mode privé : la mémoire suffit */ }
    },
  }
}
function readSession<T>(k: string): { at: number; v: T } | null {
  try { const s = sessionStorage.getItem(k); return s ? JSON.parse(s) as { at: number; v: T } : null } catch { return null }
}
const osmStore = makeStore<OsmLayer>(`eudr.osm.v${MAP_V}.`)
const geomStore = makeStore<Overlay>(`eudr.geom.v${MAP_V}.`)

/**
 * Trace les contours des parcelles au-dessus de l'image. L'API Sentinel Hub étire la bbox
 * sur toute la vignette : une projection linéaire lon/lat → % suffit donc à caler le tracé
 * (d'où preserveAspectRatio="none").
 */
function PlotOutlines({ overlay }: { overlay: Overlay }) {
  const [minx, miny, maxx, maxy] = overlay.bbox
  const w = maxx - minx, h = maxy - miny
  if (!(w > 0 && h > 0)) return null
  const px = (lon: number) => (lon - minx) / w * 100
  const py = (lat: number) => (maxy - lat) / h * 100

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
      {overlay.rings.map((ring, i) => {
        const xs = ring.map(([lon]) => px(lon)), ys = ring.map(([, lat]) => py(lat))
        const minX = Math.min(...xs), maxX = Math.max(...xs)
        const minY = Math.min(...ys), maxY = Math.max(...ys)
        // Vue d'ensemble : une parcelle de quelques hectares ne fait que 1-2 px sur une
        // emprise de dizaines de km. On la matérialise alors par un cercle repère.
        const tiny = (maxX - minX) < 2.5 && (maxY - minY) < 2.5
        if (tiny) {
          return (
            <circle key={i} cx={(minX + maxX) / 2} cy={(minY + maxY) / 2} r={1.6}
              fill="rgba(250, 204, 21, 0.35)" stroke="#facc15" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
          )
        }
        return (
          <polygon
            key={i}
            points={ring.map(([lon, lat]) => `${px(lon).toFixed(3)},${py(lat).toFixed(3)}`).join(' ')}
            fill="rgba(250, 204, 21, 0.13)"
            stroke="#facc15"
            strokeWidth="0.45"
            vectorEffect="non-scaling-stroke"
          />
        )
      })}
    </svg>
  )
}

/** Zoom/déplacement partagé par les deux vignettes, pour comparer toujours la même zone. */
interface View { s: number; x: number; y: number }
const VIEW_RESET: View = { s: 1, x: 0, y: 0 }

/**
 * Zoom maximal : déduit de la finesse réelle de l'image plutôt que fixé arbitrairement, de
 * sorte qu'une vue d'ensemble puisse descendre à l'échelle au sol d'une vue parcelle.
 * Douze pixels d'écran par pixel source suffisent à cette parité quelle que soit la largeur
 * du cadre : une vue d'ensemble (2048 px sur 44,8 km) atteint ×52 dans un cadre de 470 px
 * et ×35 dans un cadre de 700 px, soit 1,8 m par pixel d'écran dans les deux cas — l'échelle
 * d'une vue parcelle à ×1. Une vue parcelle (512 px) reste au plancher de ×10, comme avant.
 *
 * L'image restera visiblement grossie à ce niveau : la source d'une vue large vaut 21,9 m
 * par pixel, aucun zoom ne crée du détail qui n'a pas été capté.
 */
const SCREEN_PX_PER_SOURCE_PX = 12
const MIN_MAX_ZOOM = 10, ABS_MAX_ZOOM = 60

/** Routes, habitations et toponymes OpenStreetMap, projetés dans la même bbox que l'image. */
function OsmOutlines({ osm, zoom }: { osm: OsmLayer; zoom: number }) {
  const [minx, miny, maxx, maxy] = osm.bbox
  const w = maxx - minx, h = maxy - miny
  if (!(w > 0 && h > 0)) return null
  const px = (lon: number) => (lon - minx) / w * 100
  const py = (lat: number) => (maxy - lat) / h * 100
  const pts = (line: number[][]) => line.map(([lon, lat]) => `${px(lon).toFixed(3)},${py(lat).toFixed(3)}`).join(' ')

  // Les libellés compensent le zoom du conteneur : ils gardent une taille constante à l'écran.
  const fs = Math.max(0.3, 2.2 / zoom)

  // Un nom de route n'est écrit qu'une fois, sur son tronçon le plus long, et seulement
  // s'il occupe assez de place à l'échelle courante — sinon la carte devient illisible.
  const byName = new Map<string, { x: number; y: number; len: number }>()
  for (const r of osm.roads) {
    if (!r.name || r.pts.length < 2) continue
    let len = 0
    for (let i = 1; i < r.pts.length; i++) {
      len += Math.hypot(px(r.pts[i][0]) - px(r.pts[i - 1][0]), py(r.pts[i][1]) - py(r.pts[i - 1][1]))
    }
    const prev = byName.get(r.name)
    if (prev && prev.len >= len) continue
    const m = r.pts[Math.floor(r.pts.length / 2)]
    byName.set(r.name, { x: px(m[0]), y: py(m[1]), len })
  }
  const roadLabels = [...byName].filter(([, v]) => v.len * zoom > 20)

  const halo = { stroke: 'rgba(0,0,0,0.85)', strokeWidth: fs * 0.32, paintOrder: 'stroke' as const, strokeLinejoin: 'round' as const }

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
      {/* Liseré sombre sous le trait clair : les routes restent lisibles sur fond végétal. */}
      {osm.roads.map((r, i) => <polyline key={`u${i}`} points={pts(r.pts)} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth="2.4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />)}
      {osm.roads.map((r, i) => <polyline key={`r${i}`} points={pts(r.pts)} fill="none" stroke="#fb923c" strokeWidth="1.1" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />)}
      {osm.buildings.map((b, i) => <polygon key={`b${i}`} points={pts(b)} fill="rgba(248,113,113,0.55)" stroke="#fecaca" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />)}

      {roadLabels.map(([name, v]) => (
        <text key={`rl${name}`} x={v.x} y={v.y} fontSize={fs} fill="#fed7aa" textAnchor="middle" {...halo}>{name}</text>
      ))}

      {osm.places.map((p, i) => {
        // Les villes et bourgs priment visuellement sur les hameaux.
        const major = p.type === 'city' || p.type === 'town'
        return (
          <g key={`p${i}`}>
            <circle cx={px(p.lon)} cy={py(p.lat)} r={fs * (major ? 0.32 : 0.22)} fill="#fff" stroke="rgba(0,0,0,0.8)" strokeWidth={fs * 0.12} />
            <text x={px(p.lon)} y={py(p.lat) - fs * 0.55} fontSize={fs * (major ? 1.15 : 0.9)} fill="#ffffff"
              textAnchor="middle" fontWeight={major ? 700 : 400} {...halo}>{p.name}</text>
          </g>
        )
      })}
    </svg>
  )
}

function SatImage({ url, label, overlay, osm, view, onView }: {
  url: string; label: string; overlay?: Overlay | null; osm?: OsmLayer | null
  view: View; onView: (v: View | ((prev: View) => View)) => void
}) {
  const [st, setSt] = useState<{ loading: boolean; src?: string; error?: string }>({ loading: true })
  // Verrou : une URL donnée n'est téléchargée qu'UNE fois, quels que soient les rendus.
  // Sans ce garde-fou, une URL instable (ex. horodatage recalculé à chaque rendu) relance
  // l'effet en boucle — ce qui a provoqué 344 000 requêtes en 5 min le 31/07/2026.
  const fetchedRef = useRef<string | null>(null)

  useEffect(() => {
    if (fetchedRef.current === url) return
    fetchedRef.current = url
    let alive = true
    const ctrl = new AbortController()
    let objectUrl: string | undefined
    setSt({ loading: true })
    ;(async () => {
      try {
        const r = await fetch(url, { signal: ctrl.signal })
        if (!r.ok) {
          let msg = `HTTP ${r.status}`
          try { const j = await r.json(); if (j?.error) msg = String(j.error) } catch { /* corps non JSON */ }
          if (alive) setSt({ loading: false, error: msg })
          return
        }
        const blob = await r.blob()
        objectUrl = URL.createObjectURL(blob)
        if (alive) setSt({ loading: false, src: objectUrl })
      } catch (e) {
        if (alive && (e as Error).name !== 'AbortError') setSt({ loading: false, error: String((e as Error).message ?? e) })
      }
    })()
    return () => { alive = false; ctrl.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [url])

  // ── Zoom (molette) et déplacement (glisser) ──────────────────────────────
  const boxRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ px: number; py: number; x: number; y: number } | null>(null)
  // Largeur native de l'image reçue : c'est elle qui fixe jusqu'où le zoom reste utile.
  const naturalRef = useRef(0)

  const maxZoomFor = (box: number) => {
    if (!naturalRef.current || !box) return MIN_MAX_ZOOM
    return Math.min(ABS_MAX_ZOOM, Math.max(MIN_MAX_ZOOM, (naturalRef.current / box) * SCREEN_PX_PER_SOURCE_PX))
  }

  // Recadre pour que l'image couvre toujours le cadre (pas de bande vide).
  const clamp = (v: View, size: number): View => {
    const s = Math.min(maxZoomFor(size), Math.max(1, v.s))
    const limit = size * (s - 1)
    return { s, x: Math.min(0, Math.max(-limit, v.x)), y: Math.min(0, Math.max(-limit, v.y)) }
  }

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    // Écouteur natif non passif : indispensable pour empêcher le défilement de la page.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const cx = e.clientX - r.left, cy = e.clientY - r.top
      onView(prev => {
        const s = Math.min(maxZoomFor(r.width), Math.max(1, prev.s * (e.deltaY < 0 ? 1.25 : 1 / 1.25)))
        const k = s / prev.s
        return clamp({ s, x: cx - (cx - prev.x) * k, y: cy - (cy - prev.y) * k }, r.width)
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onView])

  const onPointerDown = (e: React.PointerEvent) => {
    if (view.s <= 1) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    dragRef.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d || !boxRef.current) return
    const size = boxRef.current.getBoundingClientRect().width
    onView(prev => clamp({ ...prev, x: d.x + (e.clientX - d.px), y: d.y + (e.clientY - d.py) }, size))
  }
  const endDrag = () => { dragRef.current = null }

  return (
    <figure className="m-0">
      <div
        ref={boxRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onDoubleClick={() => onView(VIEW_RESET)}
        style={{ cursor: view.s > 1 ? (dragRef.current ? 'grabbing' : 'grab') : 'zoom-in', touchAction: 'none' }}
        className="relative w-full aspect-square rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 overflow-hidden flex items-center justify-center">
        {st.loading && <span className="text-xs text-gray-400">Chargement de l’image satellite…</span>}
        {st.error && <span className="text-xs text-red-600 dark:text-red-400 px-3 text-center break-words">❌ {st.error}</span>}
        {st.src && (
          // Image et contours dans le MÊME conteneur transformé : ils restent solidaires.
          <div
            className="absolute inset-0 origin-top-left"
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` }}
          >
            <img src={st.src} alt={`Sentinel-2 ${label}`} className="w-full h-full object-cover select-none" draggable={false}
              onLoad={e => { naturalRef.current = e.currentTarget.naturalWidth }} />
            {osm && <OsmOutlines osm={osm} zoom={view.s} />}
            {overlay && <PlotOutlines overlay={overlay} />}
          </div>
        )}
        {/* Repère géographique : hors du conteneur transformé, il reste lisible quel que soit le zoom. */}
        {st.src && osm?.context && (osm.context.country || osm.context.nearestCity) && (
          <div className="absolute top-1 left-1 max-w-[85%] text-[10px] leading-tight px-1.5 py-1 rounded bg-black/55 text-white pointer-events-none">
            {osm.context.country && (
              <div>📍 {osm.context.country}{osm.context.region ? ` — ${osm.context.region}` : ''}</div>
            )}
            {osm.context.nearestCity && (
              <div>
                🏙️ {osm.context.nearestCity.name} à {osm.context.nearestCity.km} km ({osm.context.nearestCity.direction})
              </div>
            )}
          </div>
        )}
        {st.src && view.s > 1 && (
          <span className="absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-black/55 text-white pointer-events-none">
            ×{view.s.toFixed(1)}
          </span>
        )}
      </div>
      <figcaption className="text-xs text-center text-gray-500 dark:text-gray-400 mt-1">{label}</figcaption>
    </figure>
  )
}

export default function EudrDeforestationPanel({ orgId, canWrite }: { orgId: string; canWrite: boolean }) {
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [atts, setAtts] = useState<Att[]>([])
  const [quals, setQuals] = useState<Qual[]>([])
  const [versions, setVersions] = useState<Record<string, EtatVersion>>({})
  // Compte rendu de la dernière reprise de conclusions, par fichier cible.
  const [reprise, setReprise] = useState<Record<string, Reprise>>({})
  const [repriseBusy, setRepriseBusy] = useState<string | null>(null)
  // La migration de qualification peut ne pas être appliquée : on le dit au lieu de laisser
  // croire que l'enregistrement a fonctionné.
  const [qualOn, setQualOn] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [sat, setSat] = useState<string | null>(null)
  const [satPlot, setSatPlot] = useState<number | null>(null) // null = toute l'emprise
  const satUrl = (attId: string, from: string, to: string, plot: number | null) =>
    `/api/eudr-fournisseurs/satellite?org_id=${orgId}&attachmentId=${attId}&from=${from}&to=${to}${plot != null ? `&plot=${plot}` : ''}&v=${MAP_V}`
  // ⚠️ Borne de fin FIXE (jour courant, calculé une seule fois). Un `new Date()` évalué à
  // chaque rendu changeait l'URL en continu et relançait le téléchargement en boucle.
  const nowIso = useMemo(() => `${new Date().toISOString().slice(0, 10)}T23:59:59Z`, [])

  // Zoom/déplacement PARTAGÉ par les deux vignettes : on compare toujours la même zone.
  const [view, setView] = useState<View>(VIEW_RESET)
  useEffect(() => { setView(VIEW_RESET) }, [sat, satPlot]) // nouvelle vue = zoom réinitialisé

  // Calque OpenStreetMap, actif par défaut : les noms de voies, de localités et le repère
  // pays/ville sont ce qui permet de situer une parcelle. Il n'est demandé qu'à l'ouverture
  // d'une vue satellite, jamais au chargement de la page, et le résultat est mémorisé.
  const [osmOn, setOsmOn] = useState(true)
  const [osm, setOsm] = useState<OsmLayer | null>(null)
  const [osmBusy, setOsmBusy] = useState(false)
  const [osmMsg, setOsmMsg] = useState<string | null>(null)

  const osmNote = (j: OsmLayer) =>
    j.warning ? `OpenStreetMap n’a pas répondu : ${j.warning}. Routes et noms indisponibles pour l’instant ; le repère pays et ville reste affiché.`
      : j.roads.length + j.buildings.length + j.places.length === 0 ? 'Aucune route ni habitation cartographiée dans cette zone.'
        : null

  useEffect(() => {
    if (!osmOn || !sat) { setOsm(null); setOsmMsg(null); return }
    const key = `${sat}|${satPlot ?? ''}`
    const hit = osmStore.get(key)
    if (hit) { setOsm(hit); setOsmMsg(osmNote(hit)); return }
    let alive = true
    setOsmBusy(true); setOsmMsg(null); setOsm(null)
    // `v` : la réponse est mise en cache 24 h côté navigateur ; incrémenter ce jeton à chaque
    // changement de forme du JSON évite qu'une ancienne réponse mette la superposition en défaut.
    fetch(`/api/eudr-fournisseurs/satellite/osm?org_id=${orgId}&attachmentId=${sat}${satPlot != null ? `&plot=${satPlot}` : ''}&v=${MAP_V}`)
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`); return j })
      .then((j: OsmLayer) => {
        if (!alive) return
        // Une réponse dégradée n'est pas mémorisée : le prochain affichage doit retenter.
        if (!j.warning) osmStore.set(key, j)
        setOsm(j)
        setOsmMsg(osmNote(j))
      })
      .catch(e => { if (alive) setOsmMsg(String((e as Error).message ?? e)) })
      .finally(() => { if (alive) setOsmBusy(false) })
    return () => { alive = false }
  }, [osmOn, sat, satPlot, orgId])

  // Contours des parcelles à superposer aux images (une requête par document/parcelle).
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const overlayKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (!sat) { setOverlay(null); overlayKeyRef.current = null; return }
    const key = `${sat}|${satPlot ?? ''}`
    if (overlayKeyRef.current === key) return   // même verrou anti-boucle que SatImage
    overlayKeyRef.current = key
    const hit = geomStore.get(key)
    if (hit) { setOverlay(hit); return }
    let alive = true
    setOverlay(null)
    fetch(`/api/eudr-fournisseurs/satellite/geometry?org_id=${orgId}&attachmentId=${sat}${satPlot != null ? `&plot=${satPlot}` : ''}&v=${MAP_V}`)
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (alive && j?.bbox && j?.rings) { geomStore.set(key, j as Overlay); setOverlay(j as Overlay) } })
      .catch(() => { /* la superposition est un confort : on n'alerte pas */ })
    return () => { alive = false }
  }, [sat, satPlot, orgId])

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/eudr-fournisseurs/deforestation?org_id=${orgId}`)
      const j = await r.json()
      if (r.ok) {
        setAnalyses(j.data ?? []); setAtts(j.attachments ?? [])
        setQuals(j.qualifications ?? []); setQualOn(j.qualificationsDisponibles !== false)
        setVersions(j.versions ?? {})
      }
    } catch { /* ignore */ }
  }, [orgId])
  useEffect(() => { load() }, [load])

  const byAtt = (id: string) => analyses.find(a => a.attachment_id === id)

  const qualMap = useMemo(() => {
    const m = new Map<string, Qual>()
    for (const q of quals) m.set(`${q.attachment_id}|${q.plot_id}`, q)
    return m
  }, [quals])
  const qualOf = useCallback((attId: string, plotId: string) => qualMap.get(`${attId}|${plotId}`) ?? null, [qualMap])

  /**
   * Conclusions réellement instruites par fichier. Une ligne « à instruire » sans
   * commentaire ni source ne conclut rien : la compter gonflerait l'offre de reprise.
   */
  const conclusionsPar = useMemo(() => {
    const m = new Map<string, number>()
    for (const q of quals) {
      if (!(q.statut !== 'a_instruire' || q.commentaire?.trim() || q.source?.trim())) continue
      m.set(q.attachment_id, (m.get(q.attachment_id) ?? 0) + 1)
    }
    return m
  }, [quals])

  /**
   * État d'un fichier APRÈS instruction : ce n'est pas un verdict de risque mais le
   * décompte des signaux qui restent à traiter. Une parcelle écartée n'y figure plus.
   */
  const fileState = useCallback((a: Analysis | undefined) => {
    if (!a) return { texte: '⚪ Non analysé', cls: GRAY }
    const plots = a.plots ?? []
    if (plots.length === 0) return { texte: '⚪ Non analysé', cls: GRAY }
    const signalled = plots.filter(isSignalled)
    let confirmees = 0, aInstruire = 0, ecartees = 0
    for (const p of signalled) {
      const st = qualOf(a.attachment_id, p.plotId)?.statut ?? 'a_instruire'
      if (st === 'deforestation_confirmee') confirmees++
      else if (st === 'a_instruire') aInstruire++
      else ecartees++
    }
    if (confirmees > 0) return { texte: `🔴 ${confirmees} parcelle(s) en déforestation confirmée`, cls: RED }
    if (aInstruire > 0) return { texte: `🟠 ${aInstruire} parcelle(s) à instruire`, cls: AMBER }
    if (ecartees > 0) return { texte: `✅ ${ecartees} signal(aux) écarté(s)`, cls: GREEN }
    return { texte: '✅ Aucun signal', cls: GREEN }
  }, [qualOf])

  // Éditeur de qualification ouvert : clé `attachmentId|plotId`.
  const [editKey, setEditKey] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ statut: Statut; commentaire: string; source: string }>(
    { statut: 'a_instruire', commentaire: '', source: '' })
  const [saving, setSaving] = useState(false)

  function openEditor(attId: string, plotId: string) {
    const key = `${attId}|${plotId}`
    if (editKey === key) { setEditKey(null); return }
    const q = qualOf(attId, plotId)
    setDraft({ statut: q?.statut ?? 'a_instruire', commentaire: q?.commentaire ?? '', source: q?.source ?? '' })
    setEditKey(key)
  }

  async function saveQual(attId: string, plotId: string) {
    setSaving(true); setError(null)
    try {
      const r = await fetch('/api/eudr-fournisseurs/deforestation', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, attachmentId: attId, plotId, ...draft }),
      })
      const j = await r.json()
      if (!r.ok) { setError(j.error ?? 'Échec de l’enregistrement'); return }
      // Remplacement local immédiat : les compteurs se recalculent sans attendre le rechargement.
      setQuals(prev => [...prev.filter(q => !(q.attachment_id === attId && q.plot_id === plotId)), j.data as Qual])
      setEditKey(null)
    } catch (e) { setError(String((e as Error).message ?? e)) }
    finally { setSaving(false) }
  }

  /**
   * Reprise EXPLICITE des conclusions d'instruction de l'autre version.
   *
   * Jamais automatique : une conclusion humaine garde sa valeur documentaire quand
   * le contour est nettoyé, mais c'est à l'opérateur de dire qu'elle vaut encore
   * pour la géométrie corrigée. La reprise est tracée dans le champ « Source ».
   */
  async function reprendreConclusions(sourceId: string, cibleId: string, nb: number, roleSource: string) {
    const ok = window.confirm(
      `Reprendre ${nb} conclusion(s) instruite(s) sur ${roleSource} vers ce fichier ?\n\n`
      + 'La correction a modifié les géométries (trous retirés, contours refermés, auto-intersections '
      + 'résolues). Une conclusion reste un fait établi sur le terrain, mais il vous appartient de '
      + 'vérifier qu’elle vaut encore pour les contours corrigés.\n\n'
      + 'Chaque conclusion reprise portera la mention de sa provenance dans le champ « Source ». '
      + 'Les conclusions déjà instruites sur ce fichier ne sont pas écrasées ; les parcelles non '
      + 'appariables sont signalées, jamais rattachées au hasard.',
    )
    if (!ok) return
    setRepriseBusy(cibleId); setError(null)
    try {
      const r = await fetch('/api/eudr-fournisseurs/deforestation/reprise', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, sourceAttachmentId: sourceId, cibleAttachmentId: cibleId }),
      })
      const j = await r.json()
      if (!r.ok) { setError(j.error ?? 'Échec de la reprise'); return }
      setReprise(prev => ({ ...prev, [cibleId]: j as Reprise }))
      await load()
    } catch (e) { setError(String((e as Error).message ?? e)) }
    finally { setRepriseBusy(null) }
  }

  async function analyze(att: Att) {
    setBusy(att.id); setError(null)
    try {
      const r = await fetch(`/api/eudr-fournisseurs/deforestation`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, attachmentId: att.id, entity_type: att.entity_type, entity_id: att.entity_id }),
      })
      const j = await r.json()
      if (r.ok) { await load(); setOpen(att.id) }
      else setError(j.error ?? 'Échec de l’analyse')
    } catch (e) { setError(String((e as Error).message ?? e)) }
    finally { setBusy(null) }
  }

  const fmt = (s: string | null) => { if (!s) return '—'; const d = new Date(s); return isNaN(+d) ? s : d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) }

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
        🌳 Détection de <strong>perturbation du couvert</strong> via <strong>Whisp</strong> (FAO / Open Foris) : pour chaque parcelle GeoJSON, présence d’une perturbation <strong>après le 31/12/2020</strong> (date-butoir EUDR).
      </div>

      {/* Ce qu'un signal veut dire — et ce qu'il ne veut pas dire. Sans cet encart, un
          simple changement de couvert se lit comme une déforestation avérée. */}
      <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-900 dark:text-amber-200 space-y-2">
        <p className="m-0 font-semibold">⚠️ Ce que dit — et ne dit pas — un signal</p>
        <p className="m-0">
          Whisp détecte un <strong>changement du couvert</strong>, pas une déforestation. Un signal peut correspondre
          à une récolte, à une repousse, à un événement naturel (feu, chablis, sécheresse) ou à une parcelle
          <strong> déjà en production avant la date-butoir</strong>.
        </p>
        <p className="m-0">
          Qualifier une déforestation au sens EUDR suppose de connaître la <strong>nature du couvert d’origine</strong>
          {' '}— forêt primaire, forêt dégradée, repousse, culture — ce qu’établit une expertise spécialisée en
          télédétection, pas un indicateur de changement.
        </p>
        <p className="m-0">
          Ce tri sert donc à <strong>cibler les parcelles à instruire</strong>, jamais à conclure. Consignez la
          conclusion parcelle par parcelle dans la colonne « Instruction » : les parcelles écartées sortent des
          compteurs.
        </p>
      </div>

      {!qualOn && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          ⚠️ Qualification des signaux indisponible : la migration <code>20260831_eudr_signal_qualification</code> n’est pas appliquée en base.
        </p>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">❌ {error}</p>}

      <div className={card}>
        <h3 className="font-semibold text-gray-900 dark:text-white">Documents GeoJSON de l’organisation</h3>
        {atts.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Aucun document GeoJSON. Ajoutez-en via les fournisseurs/contrats.</p>
        ) : (
          <div className="space-y-2">
            {atts.map(att => {
              const a = byAtt(att.id)
              // Ce que l'autre version du même fichier apporte au diagnostic.
              const v = versions[att.id] ?? null
              const autreId = v?.autreVersionId ?? null
              const autreAnalyse = autreId ? byAtt(autreId) : undefined
              const autreNom = v?.autreVersionNom ?? null
              const roleAutre = v?.autreVersionRole === 'fichier_initial' ? 'le fichier initial'
                : v?.autreVersionRole === 'version_corrigee' ? 'la version corrigée' : 'l’autre version'
              // Analyse manquante ici alors que l'autre version a été analysée :
              // on le SIGNALE, on ne reporte rien — les géométries ont changé.
              const analyseAttendue = !a && !!autreAnalyse
              // Analyse affichée sur une version qui n'est plus celle du référentiel.
              const horsPerimetre = !!a && !!v && !v.auPerimetre && v.autreAuPerimetre
              const conclusionsAutre = autreId ? (conclusionsPar.get(autreId) ?? 0) : 0
              const repriseOffrable = !!a && !!autreId && conclusionsAutre > 0 && canWrite && qualOn
              const cr = reprise[att.id] ?? null
              return (
                <div key={att.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-800 dark:text-gray-200 truncate">📄 {att.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {a ? `Analysé le ${fmt(a.analyzed_at)}${a.analyzed_by ? ' · ' + a.analyzed_by : ''} · ${a.plot_count} parcelle(s)` : 'Pas encore analysé'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {a && (() => { const s = fileState(a); return <span className={`text-xs px-2 py-1 rounded-full ${s.cls}`}>{s.texte}</span> })()}
                      {a && <button className="text-xs text-gray-500 hover:underline" onClick={() => setOpen(open === att.id ? null : att.id)}>{open === att.id ? 'Masquer' : 'Détail'}</button>}
                      <button className="text-xs text-blue-600 dark:text-blue-400 hover:underline" onClick={() => { setSat(sat === att.id ? null : att.id); setSatPlot(null) }}>{sat === att.id ? 'Masquer satellite' : '🛰️ Satellite'}</button>
                      {canWrite && <button className={`${btn}${analyseAttendue ? ' ring-2 ring-amber-400 dark:ring-amber-500' : ''}`} onClick={() => analyze(att)} disabled={busy === att.id}>{busy === att.id ? 'Analyse…' : (a ? 'Ré-analyser' : 'Analyser')}</button>}
                    </div>
                  </div>

                  {/* Ce que l'autre version du même fichier change — sans jamais reporter son analyse. */}
                  {analyseAttendue && (
                    <p className="mt-2 text-xs rounded-lg px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200">
                      ⚠️ {roleAutre.charAt(0).toUpperCase() + roleAutre.slice(1)}
                      {autreNom ? <> (<span className="font-medium">{autreNom}</span>)</> : null}
                      {' '}a été analysé le {fmt(autreAnalyse?.analyzed_at ?? null)}. La correction a modifié les
                      géométries (trous retirés, contours refermés, auto-intersections résolues) : ce résultat ne
                      vaut pas pour cette version. <strong>Relancez l’analyse sur ce fichier.</strong>
                    </p>
                  )}
                  {horsPerimetre && (
                    <p className="mt-2 text-xs rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
                      ℹ️ L’analyse affichée porte sur <strong>{v?.libelleVersion?.toLowerCase()}</strong> de ce fichier,
                      qui ne porte plus le périmètre courant du référentiel : c’est {roleAutre}
                      {autreNom ? <> (<span className="font-medium">{autreNom}</span>)</> : null} qui le porte depuis
                      le dernier versement.
                    </p>
                  )}
                  {repriseOffrable && autreId && (
                    <div className="mt-2 text-xs rounded-lg px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 space-y-1">
                      <p className="m-0">
                        {conclusionsAutre} conclusion(s) d’instruction ont été consignées sur {roleAutre}
                        {autreNom ? <> (<span className="font-medium">{autreNom}</span>)</> : null}. Une conclusion
                        humaine reste un fait établi sur le terrain : elle peut être reprise ici, à condition de
                        vérifier qu’elle vaut encore pour les géométries corrigées.
                      </p>
                      <button
                        className="text-xs font-medium text-blue-700 dark:text-blue-300 hover:underline disabled:opacity-50"
                        disabled={repriseBusy === att.id}
                        onClick={() => reprendreConclusions(autreId, att.id, conclusionsAutre, roleAutre)}>
                        {repriseBusy === att.id ? 'Reprise…' : `Reprendre les ${conclusionsAutre} conclusion(s) instruites sur ${roleAutre}`}
                      </button>
                    </div>
                  )}
                  {cr && (
                    <div className="mt-2 text-xs rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 space-y-1">
                      <p className="m-0">
                        {cr.reprises} conclusion(s) reprise(s) sur {cr.candidates} — chacune porte la mention de sa
                        provenance dans « Source ». À vérifier parcelle par parcelle.
                        {cr.dejaInstruites.length > 0 && <> {cr.dejaInstruites.length} parcelle(s) déjà instruites ici n’ont pas été écrasées.</>}
                        {cr.appariees.some(x => x.mode === 'rang') && <> {cr.appariees.filter(x => x.mode === 'rang').length} appariement(s) faits par rang, faute d’identifiant commun.</>}
                      </p>
                      {cr.nonAppariables.length > 0 && (
                        <div>
                          <p className="m-0 font-medium text-amber-700 dark:text-amber-400">
                            {cr.nonAppariables.length} conclusion(s) non reprises, faute d’appariement fiable :
                          </p>
                          <ul className="m-0 pl-4 list-disc">
                            {cr.nonAppariables.slice(0, 8).map(x => (
                              <li key={x.plotIdSource}>Parcelle {x.plotIdSource} — {x.motif}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  {sat === att.id && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400 m-0">
                          🛰️ Sentinel‑2 (Copernicus), vraie couleur — mosaïque la moins nuageuse. État forestier <strong>2020</strong> (date‑butoir EUDR) vs <strong>aujourd’hui</strong>.
                          {overlay && <> <span className="inline-block w-3 h-2 align-middle rounded-sm" style={{ background: 'rgba(250,204,21,0.25)', border: '1px solid #facc15' }} /> contour des parcelles déclarées.</>}
                          {' '}<span className="text-gray-400">Molette pour zoomer, glisser pour déplacer — les deux images bougent ensemble (double-clic : réinitialiser).</span>
                          {osm && <>
                            {' '}<span className="inline-block w-3 h-0.5 align-middle" style={{ background: '#fb923c' }} /> routes,{' '}
                            <span className="inline-block w-2 h-2 align-middle rounded-sm" style={{ background: 'rgba(248,113,113,0.7)' }} /> habitations, noms des voies et localités —{' '}
                            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">© contributeurs OpenStreetMap</a>
                            {osm.scaleKm > 15 && <span className="text-gray-400"> (axes principaux seulement à cette échelle)</span>}
                            {osm.context?.nearestCity && (
                              <> {' '}{osm.context.nearestCity.source === 'osm' ? 'Ville influente la plus proche' : 'Localité la plus proche'} :{' '}
                                <strong>{osm.context.nearestCity.name}</strong>
                                {osm.context.nearestCity.population ? ` (~${osm.context.nearestCity.population.toLocaleString('fr-FR')} hab.)` : ''}
                                {' '}à {osm.context.nearestCity.km} km vers le {osm.context.nearestCity.direction}.
                              </>
                            )}
                          </>}
                        </p>
                        {osmMsg && <p className="text-xs text-amber-600 dark:text-amber-400 m-0">⚠️ {osmMsg}</p>}
                        {a?.plots?.length ? (
                          <select className="text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1"
                            value={satPlot ?? ''} onChange={e => setSatPlot(e.target.value === '' ? null : Number(e.target.value))}>
                            <option value="">Toute l’emprise</option>
                            {a.plots.map((p, i) => <option key={i} value={i}>Parcelle {p.plotId}</option>)}
                          </select>
                        ) : null}
                        <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                          <input type="checkbox" checked={osmOn} onChange={e => setOsmOn(e.target.checked)} />
                          🛣️ Routes et habitations
                          {osmBusy && <span className="text-gray-400">(chargement…)</span>}
                        </label>
                        {view.s > 1 && (
                          <button className="text-xs text-gray-500 hover:underline" onClick={() => setView(VIEW_RESET)}>
                            Réinitialiser le zoom
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[{ y: '2020', from: '2020-01-01T00:00:00Z', to: '2020-12-31T23:59:59Z' }, { y: 'Récente', from: '2024-06-01T00:00:00Z', to: nowIso }].map(p => (
                          <SatImage key={p.y} url={satUrl(att.id, p.from, p.to, satPlot)} label={p.y} overlay={overlay} osm={osm} view={view} onView={setView} />
                        ))}
                      </div>
                    </div>
                  )}
                  {a && open === att.id && a.plots && (
                    <div className="mt-3 overflow-x-auto">
                      {(() => {
                        const plots = a.plots ?? []
                        const signalled = plots.filter(isSignalled)
                        const actifs = signalled.filter(p => statutInfo(qualOf(att.id, p.plotId)?.statut).actif)
                        const ecartes = signalled.length - actifs.length
                        const perturb = actifs.filter(p => p.disturbanceAfter2020).length
                        return (
                          <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                            {actifs.length > 0
                              ? <span className="text-amber-700 dark:text-amber-400">🟠 {actifs.length} parcelle(s) à instruire sur {plots.length}, dont {perturb} avec perturbation du couvert après 2020.</span>
                              : signalled.length > 0
                                ? <span className="text-green-700 dark:text-green-400">✅ Aucun signal actif — les {signalled.length} signal(aux) détecté(s) ont été écartés à l’instruction.</span>
                                : <span className="text-green-700 dark:text-green-400">✅ Aucun signal — aucune perturbation du couvert détectée après 2020.</span>}
                            {actifs.length > 0 && ecartes > 0 && <span className="text-gray-500 dark:text-gray-400"> ({ecartes} déjà écarté(s).)</span>}
                          </p>
                        )
                      })()}
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                        Cliquez sur une ligne pour situer la parcelle sur l’image satellite (recliquez pour revenir à l’ensemble).
                        Un signal n’est pas une déforestation : utilisez « Instruire » pour consigner votre conclusion.
                      </p>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                            <th className="py-1 pr-3">Parcelle</th><th className="py-1 pr-3">Surface</th>
                            <th className="py-1 pr-3">Perturbation &gt; 2020</th>
                            <th className="py-1 pr-3">Signal cultures pérennes</th><th className="py-1 pr-3">Signal cultures annuelles</th><th className="py-1 pr-3">Signal bois</th>
                            <th className="py-1 pr-3">Instruction</th>
                          </tr>
                        </thead>
                        <tbody>
                          {a.plots.map((p, i) => {
                            const q = qualOf(att.id, p.plotId)
                            const info = statutInfo(q?.statut)
                            const signalled = isSignalled(p)
                            const key = `${att.id}|${p.plotId}`
                            return (
                            <Fragment key={i}>
                            <tr

                              onClick={() => { setSat(att.id); setSatPlot(satPlot === i ? null : i) }}
                              title="Cliquer pour voir cette parcelle sur l’image satellite"
                              className={`border-b border-gray-100 dark:border-gray-800 cursor-pointer transition-colors ${
                                sat === att.id && satPlot === i
                                  ? 'bg-amber-50 dark:bg-amber-900/20'
                                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'}`}
                            >
                              <td className="py-1 pr-3">
                                {sat === att.id && satPlot === i && <span className="mr-1">🛰️</span>}
                                {p.plotId}
                              </td>
                              <td className="py-1 pr-3">{p.area != null ? `${p.area.toFixed(2)} ${p.unit ?? 'ha'}` : '—'}</td>
                              <td className="py-1 pr-3">{p.disturbanceAfter2020 ? <span className="text-amber-700 dark:text-amber-400 font-medium">Oui</span> : <span className="text-gray-500 dark:text-gray-400">Non</span>}</td>
                              <td className="py-1 pr-3"><span className={`text-xs px-1.5 py-0.5 rounded-full ${signalBadge(p.riskPcrop)}`}>{signalCell(p.riskPcrop)}</span></td>
                              <td className="py-1 pr-3"><span className={`text-xs px-1.5 py-0.5 rounded-full ${signalBadge(p.riskAcrop)}`}>{signalCell(p.riskAcrop)}</span></td>
                              <td className="py-1 pr-3"><span className={`text-xs px-1.5 py-0.5 rounded-full ${signalBadge(p.riskTimber)}`}>{signalCell(p.riskTimber)}</span></td>
                              {/* La qualification n'a de sens que sur une parcelle signalée. */}
                              <td className="py-1 pr-3" onClick={e => e.stopPropagation()}>
                                {!signalled ? <span className="text-gray-400 dark:text-gray-500">—</span> : (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs">{info.court}</span>
                                    {canWrite && qualOn && (
                                      <button className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                        onClick={() => openEditor(att.id, p.plotId)}>
                                        {editKey === key ? 'Fermer' : 'Instruire'}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                            {signalled && editKey === key && (
                              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60">
                                <td colSpan={7} className="py-3 px-2">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-3xl">
                                    <label className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
                                      <span>Conclusion de l’instruction</span>
                                      <select className={field} value={draft.statut}
                                        onChange={e => setDraft(d => ({ ...d, statut: e.target.value as Statut }))}>
                                        {STATUTS.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
                                      </select>
                                    </label>
                                    <label className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
                                      <span>Source (prestataire, rapport…)</span>
                                      <input className={field} value={draft.source} placeholder="ex. expertise télédétection — nom du prestataire"
                                        onChange={e => setDraft(d => ({ ...d, source: e.target.value }))} />
                                    </label>
                                    <label className="text-xs text-gray-600 dark:text-gray-300 space-y-1 sm:col-span-2">
                                      <span>Commentaire</span>
                                      <textarea className={field} rows={2} value={draft.commentaire}
                                        placeholder="Ce qui fonde la conclusion : nature du couvert d’origine, date de mise en production, référence du rapport…"
                                        onChange={e => setDraft(d => ({ ...d, commentaire: e.target.value }))} />
                                    </label>
                                  </div>
                                  <div className="flex items-center gap-3 mt-2">
                                    <button className={btn} disabled={saving} onClick={() => saveQual(att.id, p.plotId)}>
                                      {saving ? 'Enregistrement…' : 'Enregistrer'}
                                    </button>
                                    <button className="text-xs text-gray-500 hover:underline" onClick={() => setEditKey(null)}>Annuler</button>
                                    {q?.qualified_at && (
                                      <span className="text-xs text-gray-400 dark:text-gray-500">
                                        Dernière instruction : {fmt(q.qualified_at)}{q.qualified_by ? ' · ' + q.qualified_by : ''}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                            </Fragment>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

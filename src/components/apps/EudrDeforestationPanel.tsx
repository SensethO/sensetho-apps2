'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'

// Analyse de risque déforestation EUDR (via Whisp / Open Foris) par document GeoJSON.
// Pour chaque parcelle : perturbation après le 31/12/2020 + verdict de risque (cultures / bois).

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

const card = 'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 p-5 space-y-4'
const btn = 'px-3 py-1.5 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50'
const riskBadge = (r?: string | null) => {
  const v = (r ?? '').toLowerCase()
  if (v === 'high') return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
  if (v === 'low') return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
  return 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'
}
const riskLabel = (r?: string | null) => ({ high: '🔴 Risque élevé', low: '🟢 Risque faible' } as Record<string, string>)[(r ?? '').toLowerCase()] ?? '⚪ Non analysé'

/**
 * Vignette satellite : charge l'image via fetch pour pouvoir afficher le motif exact
 * en cas d'échec (une <img> classique ne montrerait qu'un cadre vide).
 */
/** Contours des parcelles à superposer, exprimés dans la même bbox que l'image. */
interface Overlay { bbox: number[]; rings: number[][][] }
/** Calque OpenStreetMap : routes (lignes) et bâtiments (polygones), même bbox. */
interface OsmRoad { pts: number[][]; name: string | null }
interface OsmPlace { lon: number; lat: number; name: string; type: string }
interface OsmCity { name: string; type: string; population: number | null; km: number; direction: string }
interface OsmContext { country: string | null; countryCode: string | null; region: string | null; nearestCity: OsmCity | null }
interface OsmLayer {
  bbox: number[]; roads: OsmRoad[]; buildings: number[][][]
  places: OsmPlace[]; context: OsmContext; scaleKm: number
}

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
const MAX_ZOOM = 10

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

  // Recadre pour que l'image couvre toujours le cadre (pas de bande vide).
  const clamp = (v: View, size: number): View => {
    const s = Math.min(MAX_ZOOM, Math.max(1, v.s))
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
        const s = Math.min(MAX_ZOOM, Math.max(1, prev.s * (e.deltaY < 0 ? 1.25 : 1 / 1.25)))
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
            <img src={st.src} alt={`Sentinel-2 ${label}`} className="w-full h-full object-cover select-none" draggable={false} />
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
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [sat, setSat] = useState<string | null>(null)
  const [satPlot, setSatPlot] = useState<number | null>(null) // null = toute l'emprise
  const satUrl = (attId: string, from: string, to: string, plot: number | null) =>
    `/api/eudr-fournisseurs/satellite?org_id=${orgId}&attachmentId=${attId}&from=${from}&to=${to}${plot != null ? `&plot=${plot}` : ''}`
  // ⚠️ Borne de fin FIXE (jour courant, calculé une seule fois). Un `new Date()` évalué à
  // chaque rendu changeait l'URL en continu et relançait le téléchargement en boucle.
  const nowIso = useMemo(() => `${new Date().toISOString().slice(0, 10)}T23:59:59Z`, [])

  // Zoom/déplacement PARTAGÉ par les deux vignettes : on compare toujours la même zone.
  const [view, setView] = useState<View>(VIEW_RESET)
  useEffect(() => { setView(VIEW_RESET) }, [sat, satPlot]) // nouvelle vue = zoom réinitialisé

  // Calque OpenStreetMap — chargé UNIQUEMENT sur demande (Overpass est un service gratuit
  // qu'il faut ménager), puis mémorisé par emprise pour ne jamais le redemander deux fois.
  const [osmOn, setOsmOn] = useState(false)
  const [osm, setOsm] = useState<OsmLayer | null>(null)
  const [osmBusy, setOsmBusy] = useState(false)
  const [osmMsg, setOsmMsg] = useState<string | null>(null)
  const osmCache = useRef<Map<string, OsmLayer>>(new Map())

  useEffect(() => {
    if (!osmOn || !sat) { setOsm(null); setOsmMsg(null); return }
    const key = `${sat}|${satPlot ?? ''}`
    const hit = osmCache.current.get(key)
    if (hit) { setOsm(hit); setOsmMsg(hit.roads.length + hit.buildings.length === 0 ? 'Aucune route ni habitation cartographiée dans cette zone.' : null); return }
    let alive = true
    setOsmBusy(true); setOsmMsg(null); setOsm(null)
    // `v` : la réponse est mise en cache 24 h côté navigateur ; incrémenter ce jeton à chaque
    // changement de forme du JSON évite qu'une ancienne réponse mette la superposition en défaut.
    fetch(`/api/eudr-fournisseurs/satellite/osm?org_id=${orgId}&attachmentId=${sat}${satPlot != null ? `&plot=${satPlot}` : ''}&v=2`)
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`); return j })
      .then((j: OsmLayer) => {
        if (!alive) return
        osmCache.current.set(key, j)
        setOsm(j)
        if (j.roads.length + j.buildings.length === 0) setOsmMsg('Aucune route ni habitation cartographiée dans cette zone.')
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
    let alive = true
    setOverlay(null)
    fetch(`/api/eudr-fournisseurs/satellite/geometry?org_id=${orgId}&attachmentId=${sat}${satPlot != null ? `&plot=${satPlot}` : ''}`)
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (alive && j?.bbox && j?.rings) setOverlay(j as Overlay) })
      .catch(() => { /* la superposition est un confort : on n'alerte pas */ })
    return () => { alive = false }
  }, [sat, satPlot, orgId])

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/eudr-fournisseurs/deforestation?org_id=${orgId}`)
      const j = await r.json()
      if (r.ok) { setAnalyses(j.data ?? []); setAtts(j.attachments ?? []) }
    } catch { /* ignore */ }
  }, [orgId])
  useEffect(() => { load() }, [load])

  const byAtt = (id: string) => analyses.find(a => a.attachment_id === id)

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
        🌳 Analyse de risque déforestation via <strong>Whisp</strong> (FAO / Open Foris) : pour chaque parcelle GeoJSON, détection d’une perturbation <strong>après le 31/12/2020</strong> (date-butoir EUDR) et verdict de risque. Indicatif — complète votre évaluation, ne la remplace pas juridiquement.
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">❌ {error}</p>}

      <div className={card}>
        <h3 className="font-semibold text-gray-900 dark:text-white">Documents GeoJSON de l’organisation</h3>
        {atts.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Aucun document GeoJSON. Ajoutez-en via les fournisseurs/contrats.</p>
        ) : (
          <div className="space-y-2">
            {atts.map(att => {
              const a = byAtt(att.id)
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
                      {a && <span className={`text-xs px-2 py-1 rounded-full ${riskBadge(a.overall_risk)}`}>{riskLabel(a.overall_risk)}</span>}
                      {a && <button className="text-xs text-gray-500 hover:underline" onClick={() => setOpen(open === att.id ? null : att.id)}>{open === att.id ? 'Masquer' : 'Détail'}</button>}
                      <button className="text-xs text-blue-600 dark:text-blue-400 hover:underline" onClick={() => { setSat(sat === att.id ? null : att.id); setSatPlot(null) }}>{sat === att.id ? 'Masquer satellite' : '🛰️ Satellite'}</button>
                      {canWrite && <button className={btn} onClick={() => analyze(att)} disabled={busy === att.id}>{busy === att.id ? 'Analyse…' : (a ? 'Ré-analyser' : 'Analyser')}</button>}
                    </div>
                  </div>
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
                              <> {' '}Ville influente la plus proche : <strong>{osm.context.nearestCity.name}</strong>
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
                      {a.summary && (
                        <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                          {a.summary.high > 0
                            ? <span className="text-red-600 dark:text-red-400">⚠️ {a.summary.high} parcelle(s) à risque élevé, dont {a.summary.disturbedAfter2020} avec perturbation après 2020.</span>
                            : <span className="text-green-700 dark:text-green-400">✓ Toutes les parcelles à risque faible, aucune perturbation détectée après 2020.</span>}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                        Cliquez sur une ligne pour situer la parcelle sur l’image satellite (recliquez pour revenir à l’ensemble).
                      </p>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                            <th className="py-1 pr-3">Parcelle</th><th className="py-1 pr-3">Surface</th>
                            <th className="py-1 pr-3">Perturbation &gt; 2020</th>
                            <th className="py-1 pr-3">Cultures pérennes</th><th className="py-1 pr-3">Cultures annuelles</th><th className="py-1 pr-3">Bois</th>
                          </tr>
                        </thead>
                        <tbody>
                          {a.plots.map((p, i) => (
                            <tr
                              key={i}
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
                              <td className="py-1 pr-3">{p.disturbanceAfter2020 ? <span className="text-red-600 dark:text-red-400 font-medium">Oui</span> : <span className="text-green-700 dark:text-green-400">Non</span>}</td>
                              <td className="py-1 pr-3"><span className={`text-xs px-1.5 py-0.5 rounded-full ${riskBadge(p.riskPcrop)}`}>{p.riskPcrop ?? '—'}</span></td>
                              <td className="py-1 pr-3"><span className={`text-xs px-1.5 py-0.5 rounded-full ${riskBadge(p.riskAcrop)}`}>{p.riskAcrop ?? '—'}</span></td>
                              <td className="py-1 pr-3"><span className={`text-xs px-1.5 py-0.5 rounded-full ${riskBadge(p.riskTimber)}`}>{p.riskTimber ?? '—'}</span></td>
                            </tr>
                          ))}
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

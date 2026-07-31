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

function SatImage({ url, label, overlay }: { url: string; label: string; overlay?: Overlay | null }) {
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

  return (
    <figure className="m-0">
      <div className="relative w-full aspect-square rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 overflow-hidden flex items-center justify-center">
        {st.loading && <span className="text-xs text-gray-400">Chargement de l’image satellite…</span>}
        {st.error && <span className="text-xs text-red-600 dark:text-red-400 px-3 text-center break-words">❌ {st.error}</span>}
        {st.src && <img src={st.src} alt={`Sentinel-2 ${label}`} className="w-full h-full object-cover" />}
        {st.src && overlay && <PlotOutlines overlay={overlay} />}
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
                        </p>
                        {a?.plots?.length ? (
                          <select className="text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1"
                            value={satPlot ?? ''} onChange={e => setSatPlot(e.target.value === '' ? null : Number(e.target.value))}>
                            <option value="">Toute l’emprise</option>
                            {a.plots.map((p, i) => <option key={i} value={i}>Parcelle {p.plotId}</option>)}
                          </select>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[{ y: '2020', from: '2020-01-01T00:00:00Z', to: '2020-12-31T23:59:59Z' }, { y: 'Récente', from: '2024-06-01T00:00:00Z', to: nowIso }].map(p => (
                          <SatImage key={p.y} url={satUrl(att.id, p.from, p.to, satPlot)} label={p.y} overlay={overlay} />
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

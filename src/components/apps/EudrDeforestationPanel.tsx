'use client'

import { useState, useEffect, useCallback } from 'react'

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

export default function EudrDeforestationPanel({ orgId, canWrite }: { orgId: string; canWrite: boolean }) {
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [atts, setAtts] = useState<Att[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [sat, setSat] = useState<string | null>(null)
  const satUrl = (attId: string, from: string, to: string) =>
    `/api/eudr-fournisseurs/satellite?org_id=${orgId}&attachmentId=${attId}&from=${from}&to=${to}`
  const nowIso = new Date().toISOString()

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
                      <button className="text-xs text-blue-600 dark:text-blue-400 hover:underline" onClick={() => setSat(sat === att.id ? null : att.id)}>{sat === att.id ? 'Masquer satellite' : '🛰️ Satellite'}</button>
                      {canWrite && <button className={btn} onClick={() => analyze(att)} disabled={busy === att.id}>{busy === att.id ? 'Analyse…' : (a ? 'Ré-analyser' : 'Analyser')}</button>}
                    </div>
                  </div>
                  {sat === att.id && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">🛰️ Sentinel‑2 (Copernicus), vraie couleur — mosaïque la moins nuageuse de chaque période. Compare l’état forestier <strong>2020</strong> (date‑butoir EUDR) et <strong>aujourd’hui</strong>.</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[{ y: '2020', from: '2020-01-01T00:00:00Z', to: '2020-12-31T23:59:59Z' }, { y: 'Récente', from: '2024-06-01T00:00:00Z', to: nowIso }].map(p => (
                          <figure key={p.y} className="m-0">
                            <img src={satUrl(att.id, p.from, p.to)} alt={`Sentinel-2 ${p.y}`} loading="lazy"
                              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 aspect-square object-cover" />
                            <figcaption className="text-xs text-center text-gray-500 dark:text-gray-400 mt-1">{p.y}</figcaption>
                          </figure>
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
                            <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                              <td className="py-1 pr-3">{p.plotId}</td>
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

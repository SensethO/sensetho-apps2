'use client'

import { useState, useEffect, useCallback } from 'react'
import type { RseContext } from '@/components/rse/RseAppShell'
import Icon from '@/components/ui/Icon'

const inputCls = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500'
const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'
const cardCls = 'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 p-5 space-y-4'
const btnPrimary = 'px-3 py-2 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50'
const btnGhost = 'px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-50'

type Tab = 'connexion' | 'risque' | 'parcelles' | 'juridictions'
type SatEnv = 'production' | 'mock'

function Json({ value }: { value: unknown }) {
  return (
    <pre className="max-h-96 overflow-auto rounded-lg bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 p-3 text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
      {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
    </pre>
  )
}

export default function SynchroSatelligenceApp({ ctx }: { ctx: RseContext }) {
  const orgId = ctx.org?.id ?? null
  const [tab, setTab] = useState<Tab>('connexion')

  // ── Connexion ──────────────────────────────────────────────────────────────
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [environment, setEnvironment] = useState<SatEnv>('production')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [token, setToken] = useState('')
  const [savingCred, setSavingCred] = useState(false)
  const [credMsg, setCredMsg] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [testRes, setTestRes] = useState<{ ok: boolean; text: string; data?: unknown } | null>(null)

  const loadStatus = useCallback(async () => {
    if (!orgId) return
    setCredMsg(null)
    try {
      const r = await fetch(`/api/synchro-satelligence/credentials?org_id=${orgId}`)
      const j = await r.json()
      setConfigured(!!j.configured)
      if (j.info) { setEnvironment(j.info.environment ?? 'production'); setUpdatedAt(j.info.updatedAt ?? null) }
      else { setUpdatedAt(null) }
    } catch { setConfigured(false) }
  }, [orgId])

  useEffect(() => { loadStatus() }, [loadStatus])

  async function saveCred() {
    if (!orgId || !token.trim()) return
    setSavingCred(true); setCredMsg(null)
    try {
      const r = await fetch('/api/synchro-satelligence/credentials', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, token: token.trim(), environment }),
      })
      const j = await r.json()
      if (r.ok && j.ok) { setCredMsg('Token enregistré (chiffré).'); setToken(''); loadStatus() }
      else setCredMsg('Échec : ' + (j.error ?? r.status))
    } catch (e) { setCredMsg('Erreur : ' + String((e as Error).message ?? e)) }
    finally { setSavingCred(false) }
  }

  async function deleteCred() {
    if (!orgId) return
    setSavingCred(true); setCredMsg(null)
    try {
      await fetch(`/api/synchro-satelligence/credentials?org_id=${orgId}`, { method: 'DELETE' })
      setTestRes(null); loadStatus()
    } finally { setSavingCred(false) }
  }

  async function testConnection() {
    if (!orgId) return
    setTesting(true); setTestRes(null)
    try {
      const r = await fetch(`/api/synchro-satelligence/test?org_id=${orgId}`)
      const j = await r.json()
      if (j.ok) setTestRes({ ok: true, text: 'Connexion OK — projets récupérés.', data: j.projects })
      else setTestRes({ ok: false, text: `Échec (HTTP ${j.status ?? '—'}) : ${j.error ?? 'inconnu'}` })
    } catch (e) { setTestRes({ ok: false, text: 'Erreur : ' + String((e as Error).message ?? e) }) }
    finally { setTesting(false) }
  }

  // ── Risque à la volée ────────────────────────────────────────────────────────
  const [geometry, setGeometry] = useState('')
  const [riskLoading, setRiskLoading] = useState(false)
  const [riskRes, setRiskRes] = useState<{ ok: boolean; text?: string; data?: unknown } | null>(null)

  async function runRisk() {
    if (!orgId || !geometry.trim()) return
    setRiskLoading(true); setRiskRes(null)
    try {
      const r = await fetch('/api/synchro-satelligence/risk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, geometry: geometry.trim() }),
      })
      const j = await r.json()
      if (j.ok) setRiskRes({ ok: true, data: j.result })
      else setRiskRes({ ok: false, text: `Échec (HTTP ${j.status ?? '—'}) : ${j.error ?? 'inconnu'}`, data: j.data })
    } catch (e) { setRiskRes({ ok: false, text: 'Erreur : ' + String((e as Error).message ?? e) }) }
    finally { setRiskLoading(false) }
  }

  // ── Parcelles ────────────────────────────────────────────────────────────────
  const [plotId, setPlotId] = useState('')
  const [plotsLoading, setPlotsLoading] = useState(false)
  const [plotsRes, setPlotsRes] = useState<{ ok: boolean; text?: string; data?: unknown } | null>(null)

  async function loadPlots() {
    if (!orgId) return
    setPlotsLoading(true); setPlotsRes(null)
    try {
      const q = plotId.trim() ? `&id=${encodeURIComponent(plotId.trim())}` : ''
      const r = await fetch(`/api/synchro-satelligence/plots?org_id=${orgId}${q}`)
      const j = await r.json()
      if (j.ok) setPlotsRes({ ok: true, data: j.plot ?? j.plots })
      else setPlotsRes({ ok: false, text: `Échec (HTTP ${j.status ?? '—'}) : ${j.error ?? 'inconnu'}` })
    } catch (e) { setPlotsRes({ ok: false, text: 'Erreur : ' + String((e as Error).message ?? e) }) }
    finally { setPlotsLoading(false) }
  }

  // ── Juridictions ──────────────────────────────────────────────────────────────
  const [jurCountry, setJurCountry] = useState('')
  const [jurLoading, setJurLoading] = useState(false)
  const [jurRes, setJurRes] = useState<{ ok: boolean; text?: string; data?: unknown } | null>(null)

  async function loadJurisdictions() {
    if (!orgId) return
    setJurLoading(true); setJurRes(null)
    try {
      const q = jurCountry.trim() ? `&country=${encodeURIComponent(jurCountry.trim())}` : ''
      const r = await fetch(`/api/synchro-satelligence/jurisdictions?org_id=${orgId}${q}`)
      const j = await r.json()
      if (j.ok) setJurRes({ ok: true, data: j.jurisdictions })
      else setJurRes({ ok: false, text: `Échec (HTTP ${j.status ?? '—'}) : ${j.error ?? 'inconnu'}` })
    } catch (e) { setJurRes({ ok: false, text: 'Erreur : ' + String((e as Error).message ?? e) }) }
    finally { setJurLoading(false) }
  }

  if (!orgId) {
    return (
      <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
        Sélectionnez une organisation dans le panneau de gauche pour configurer la synchronisation Satelligence.
      </div>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'connexion', label: 'Connexion' },
    { id: 'risque', label: 'Risque à la volée' },
    { id: 'parcelles', label: 'Parcelles' },
    { id: 'juridictions', label: 'Juridictions' },
  ]

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm text-blue-800 dark:text-blue-300 flex items-start gap-2">
        <Icon name="satellite" size={18} />
        <span>
          Interconnexion avec la plateforme <strong>Satelligence</strong> (données &amp; risque de déforestation) via son API.
          La donnée déforestation vient de Satelligence ; la DDS et le dépôt TRACES restent gérés dans le SI T&amp;S.
          Le token API est stocké chiffré, par organisation, et n&apos;est jamais renvoyé au navigateur.
        </span>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${tab === t.id ? 'bg-green-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'connexion' && (
        <div className={cardCls}>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">État :</span>
            {configured === null ? <span className="text-gray-400">…</span>
              : configured ? <span className="text-green-600 dark:text-green-400 font-medium">Configuré ({environment}){updatedAt ? ` — ${new Date(updatedAt).toLocaleDateString('fr-FR')}` : ''}</span>
                : <span className="text-gray-500">Non configuré</span>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls}>Token API Satelligence (Bearer)</label>
              <input className={inputCls} type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="••••••••••••••••" autoComplete="off" />
              <p className="mt-1 text-xs text-gray-400">Fourni par Satelligence (support@satelligence.com). Rattaché au projet actif du compte.</p>
            </div>
            <div>
              <label className={labelCls}>Environnement</label>
              <select className={inputCls} value={environment} onChange={e => setEnvironment(e.target.value as SatEnv)}>
                <option value="production">Production (api.satelligence.com)</option>
                <option value="mock">Mock (docs — tests)</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={btnPrimary} disabled={savingCred || !token.trim()} onClick={saveCred}>Enregistrer le token</button>
            <button className={btnGhost} disabled={testing || !configured} onClick={testConnection}>{testing ? 'Test…' : 'Tester la connexion'}</button>
            {configured && <button className={btnGhost} disabled={savingCred} onClick={deleteCred}>Supprimer</button>}
          </div>
          {credMsg && <p className="text-sm text-gray-600 dark:text-gray-300">{credMsg}</p>}
          {testRes && (
            <div className={`text-sm ${testRes.ok ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {testRes.text}
              {testRes.data !== undefined && <div className="mt-2"><Json value={testRes.data} /></div>}
            </div>
          )}
        </div>
      )}

      {tab === 'risque' && (
        <div className={cardCls}>
          <p className="text-sm text-gray-600 dark:text-gray-300">Analyse « à la volée » d&apos;une géométrie (POST /get-risk-info) — aucune donnée stockée chez Satelligence. Collez une géométrie GeoJSON (Polygon / MultiPolygon / Point).</p>
          <textarea className={`${inputCls} font-mono`} rows={8} value={geometry} onChange={e => setGeometry(e.target.value)} placeholder='{"type":"Polygon","coordinates":[[[ -3.9, 5.3 ], … ]]}' />
          <button className={btnPrimary} disabled={riskLoading || !geometry.trim() || !configured} onClick={runRisk}>{riskLoading ? 'Analyse…' : 'Analyser le risque'}</button>
          {!configured && <p className="text-xs text-amber-600">Configurez d&apos;abord le token dans l&apos;onglet Connexion.</p>}
          {riskRes && (
            <div className="space-y-2">
              {riskRes.text && <p className={`text-sm ${riskRes.ok ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{riskRes.text}</p>}
              {riskRes.data !== undefined && <Json value={riskRes.data} />}
            </div>
          )}
        </div>
      )}

      {tab === 'parcelles' && (
        <div className={cardCls}>
          <p className="text-sm text-gray-600 dark:text-gray-300">Récupère les parcelles stockées sur la plateforme (GET /v1/plots) : métadonnées, géométries et évaluations de risque. Laissez l&apos;identifiant vide pour lister, ou saisissez un id de parcelle.</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-48">
              <label className={labelCls}>Identifiant de parcelle (optionnel)</label>
              <input className={inputCls} value={plotId} onChange={e => setPlotId(e.target.value)} placeholder="ex. 0LEvhQusJoIIOHAUfyD8" />
            </div>
            <button className={btnPrimary} disabled={plotsLoading || !configured} onClick={loadPlots}>{plotsLoading ? 'Chargement…' : 'Charger'}</button>
          </div>
          {plotsRes && (
            <div className="space-y-2">
              {plotsRes.text && <p className="text-sm text-red-600 dark:text-red-400">{plotsRes.text}</p>}
              {plotsRes.data !== undefined && <Json value={plotsRes.data} />}
            </div>
          )}
        </div>
      )}

      {tab === 'juridictions' && (
        <div className={cardCls}>
          <p className="text-sm text-gray-600 dark:text-gray-300">Risque de déforestation au niveau juridiction (GET /v1/jurisdictions) — sans upload de parcelles. Utile pour enrichir les grilles de risque pays.</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-32">
              <label className={labelCls}>Pays (ISO2, optionnel)</label>
              <input className={inputCls} value={jurCountry} onChange={e => setJurCountry(e.target.value)} placeholder="CI" maxLength={2} />
            </div>
            <button className={btnPrimary} disabled={jurLoading || !configured} onClick={loadJurisdictions}>{jurLoading ? 'Chargement…' : 'Interroger'}</button>
          </div>
          {jurRes && (
            <div className="space-y-2">
              {jurRes.text && <p className="text-sm text-red-600 dark:text-red-400">{jurRes.text}</p>}
              {jurRes.data !== undefined && <Json value={jurRes.data} />}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

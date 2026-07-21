'use client'

import { useState, useEffect, useCallback } from 'react'
import { toIso2 } from '@/lib/eudr/countries'

// Connexion au système d'information EUDR (TRACES NT) de la Commission européenne.
// Trois blocs : identifiants Web Service (+ test Echo), vérification d'une DDS reçue,
// dépôt d'une DDS. L'app ne connaît jamais la clé en clair (chiffrée côté serveur).

const inputCls = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500'
const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'
const cardCls = 'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 p-5 space-y-4'
const btnPrimary = 'px-3 py-2 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50'
const btnGhost = 'px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-50'

interface CredInfo { username: string; environment: 'acceptance' | 'production'; clientId: string; updatedAt: string | null }

interface GeoReport {
  featuresBefore: number; featuresAfter: number; holesRemoved: number; multiPolygonsSplit: number
  pointsBefore: number; pointsAfter: number; areaBeforeHa: number; areaAfterHa: number
  holeAlerts: { name: string; plotHa: number; addedHa: number; pct: number }[]; changed: boolean
}

interface DdsRow {
  id: string; dds_uuid: string; environment: string
  internal_reference_number: string | null; reference_number: string | null; verification_number: string | null
  status: string | null; activity_type: string | null; commodity: string | null
  official_date: string | null; official_updated_by: string | null
  submitted_by: string | null; submitted_at: string; last_checked_at: string | null
}

interface SupplierLite { id: string; company?: string; country_origin?: string }
interface ContractLite { id: string; contract_number?: string; product?: string; delivery_country?: string; supplier?: string }

export default function EudrTracesPanel({ orgId, canManage, suppliers = [], contracts = [] }: {
  orgId: string
  canManage: boolean
  suppliers?: SupplierLite[]
  contracts?: ContractLite[]
}) {
  // ── Identifiants ──────────────────────────────────────────────────────────
  const [configured, setConfigured] = useState(false)
  const [info, setInfo] = useState<CredInfo | null>(null)
  const [username, setUsername] = useState('')
  const [authKey, setAuthKey] = useState('')
  const [environment, setEnvironment] = useState<'acceptance' | 'production'>('acceptance')
  const [savingCred, setSavingCred] = useState(false)
  const [credMsg, setCredMsg] = useState<string | null>(null)
  const [editingCred, setEditingCred] = useState(false)

  const loadCred = useCallback(async () => {
    try {
      const res = await fetch(`/api/eudr-fournisseurs/traces/credentials?org_id=${orgId}`)
      const j = await res.json()
      if (res.ok) {
        setConfigured(!!j.configured)
        setInfo(j.info ?? null)
        if (j.info) { setUsername(j.info.username); setEnvironment(j.info.environment); setEditingCred(false) }
        else setEditingCred(true)
      }
    } catch { /* ignore */ }
  }, [orgId])

  useEffect(() => { loadCred() }, [loadCred])

  async function saveCred() {
    setSavingCred(true); setCredMsg(null)
    try {
      const res = await fetch(`/api/eudr-fournisseurs/traces/credentials`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, username: username.trim(), authKey: authKey.trim(), environment }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error ?? 'Erreur')
      setAuthKey(''); setCredMsg('✅ Identifiants enregistrés.')
      await loadCred()
    } catch (e) { setCredMsg('❌ ' + String((e as Error).message ?? e)) }
    finally { setSavingCred(false) }
  }

  async function deleteCred() {
    setSavingCred(true); setCredMsg(null)
    try {
      await fetch(`/api/eudr-fournisseurs/traces/credentials?org_id=${orgId}`, { method: 'DELETE' })
      setUsername(''); setAuthKey(''); setConfigured(false); setInfo(null); setEditingCred(true)
      setCredMsg('Identifiants supprimés.')
    } catch { /* ignore */ }
    finally { setSavingCred(false) }
  }

  // ── Test Echo ─────────────────────────────────────────────────────────────
  const [echoing, setEchoing] = useState(false)
  const [echoMsg, setEchoMsg] = useState<{ ok: boolean; text: string; detail?: string } | null>(null)
  async function testEcho() {
    setEchoing(true); setEchoMsg(null)
    try {
      const res = await fetch(`/api/eudr-fournisseurs/traces/echo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ org_id: orgId }),
      })
      const j = await res.json().catch(() => ({}))
      if (res.ok && j.ok) setEchoMsg({ ok: true, text: `Connexion réussie (${j.environment}).` })
      else setEchoMsg({ ok: false, text: `${j.error ?? 'Échec de la connexion.'}${j.status ? ` (HTTP ${j.status})` : ''}`, detail: j.detail })
    } catch (e) { setEchoMsg({ ok: false, text: String((e as Error).message ?? e) }) }
    finally { setEchoing(false) }
  }

  // ── Vérification DDS ────────────────────────────────────────────────────────
  const [refNum, setRefNum] = useState('')
  const [verNum, setVerNum] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyRes, setVerifyRes] = useState<{ ok: boolean; text: string; data?: unknown } | null>(null)
  async function verifyDds() {
    setVerifying(true); setVerifyRes(null)
    try {
      const res = await fetch(`/api/eudr-fournisseurs/traces/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, referenceNumber: refNum.trim(), verificationNumber: verNum.trim() }),
      })
      const j = await res.json().catch(() => ({}))
      if (res.ok && j.ok) {
        const dds = (j.result?.ddsInfo?.[0]) ?? j.result
        const status = dds?.status ?? '—'
        setVerifyRes({ ok: true, text: `Statut : ${status}`, data: j.result })
      } else setVerifyRes({ ok: false, text: `${j.error ?? 'DDS introuvable ou erreur.'}${j.status ? ` (HTTP ${j.status})` : ''}`, data: j.detail })
    } catch (e) { setVerifyRes({ ok: false, text: String((e as Error).message ?? e) }) }
    finally { setVerifying(false) }
  }

  // ── Dépôt DDS (formulaire minimal V2) ────────────────────────────────────────
  const [dds, setDds] = useState({
    operatorType: 'OPERATOR', internalReferenceNumber: '', activityType: 'DOMESTIC',
    countryOfActivity: 'FR', hsHeading: '', descriptionOfGoods: '', netWeight: '',
    percentageEstimation: '', speciesScientific: '', speciesCommon: '',
    producerCountry: '', producerName: '', geojson: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitRes, setSubmitRes] = useState<{ ok: boolean; text: string; detail?: string; geo?: GeoReport | null } | null>(null)
  function setF<K extends keyof typeof dds>(k: K, v: string) { setDds(d => ({ ...d, [k]: v })) }

  // Pré-remplissage depuis un contrat existant (mappe les champs disponibles ; le code SH,
  // le poids, l'espèce et la géométrie GeoJSON ne sont pas stockés et restent à compléter).
  function prefillFromContract(contractId: string) {
    const c = contracts.find(x => x.id === contractId)
    if (!c) return
    const sup = suppliers.find(s => (s.company ?? '').trim() && s.company === c.supplier)
    setDds(d => ({
      ...d,
      internalReferenceNumber: c.contract_number ?? d.internalReferenceNumber,
      descriptionOfGoods: c.product ?? d.descriptionOfGoods,
      countryOfActivity: toIso2(c.delivery_country) || d.countryOfActivity,
      producerName: c.supplier ?? d.producerName,
      producerCountry: toIso2(sup?.country_origin) || d.producerCountry,
    }))
  }

  // GeoJSON depuis un document SharePoint (au lieu du collage texte).
  const [geoSupplierId, setGeoSupplierId] = useState('')
  const [geoDocs, setGeoDocs] = useState<{ id: string; name: string }[]>([])
  const [geojsonAttachmentId, setGeojsonAttachmentId] = useState('')
  const [geoPreview, setGeoPreview] = useState<{ features?: number; types?: string[]; error?: string; loading?: boolean } | null>(null)
  useEffect(() => {
    setGeoDocs([]); setGeojsonAttachmentId('')
    if (!geoSupplierId) return
    fetch(`/api/eudr-fournisseurs/documents?org_id=${orgId}&entity_type=supplier&entity_id=${geoSupplierId}`)
      .then(r => r.json()).then(j => setGeoDocs((j.data ?? []).filter((d: { doc_type: string }) => d.doc_type === 'geojson')))
      .catch(() => {})
  }, [geoSupplierId, orgId])
  // Aperçu du GeoJSON du document sélectionné (confirmation visuelle).
  useEffect(() => {
    if (!geojsonAttachmentId) { setGeoPreview(null); return }
    setGeoPreview({ loading: true })
    fetch(`/api/eudr-fournisseurs/traces/geojson-preview?org_id=${orgId}&id=${geojsonAttachmentId}`)
      .then(r => r.json())
      .then(j => setGeoPreview(j.ok ? { features: j.features, types: j.types } : { error: j.error ?? 'Aperçu indisponible' }))
      .catch(() => setGeoPreview({ error: 'Aperçu indisponible' }))
  }, [geojsonAttachmentId, orgId])

  // Suivi post-dépôt : récupère n° de référence + n° de vérification (getDds par UUID).
  const [lastUuid, setLastUuid] = useState<string | null>(null)
  const [statusChecking, setStatusChecking] = useState(false)
  const [statusRes, setStatusRes] = useState<{ referenceNumber?: string | null; verificationNumber?: string | null; status?: string | null; error?: string } | null>(null)
  async function checkStatus() {
    if (!lastUuid) return
    setStatusChecking(true); setStatusRes(null)
    try {
      const res = await fetch(`/api/eudr-fournisseurs/traces/status`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, uuid: lastUuid }),
      })
      const j = await res.json().catch(() => ({}))
      if (res.ok && j.ok) setStatusRes({ referenceNumber: j.referenceNumber, verificationNumber: j.verificationNumber, status: j.status })
      else setStatusRes({ error: j.error ?? 'Erreur' })
    } catch (e) { setStatusRes({ error: String((e as Error).message ?? e) }) }
    finally { setStatusChecking(false) }
  }

  // ── Suivi des DDS déposées (vision officielle TRACES) ─────────────────────
  const [ddsList, setDdsList] = useState<DdsRow[]>([])
  const [ddsBusy, setDdsBusy] = useState(false)
  const loadDds = useCallback(async () => {
    try {
      const r = await fetch(`/api/eudr-fournisseurs/traces/dds?org_id=${orgId}`)
      const j = await r.json(); if (r.ok) setDdsList(j.data ?? [])
    } catch { /* ignore */ }
  }, [orgId])
  useEffect(() => { if (configured) loadDds() }, [configured, loadDds])
  async function refreshDds(id?: string) {
    setDdsBusy(true)
    try {
      const r = await fetch(`/api/eudr-fournisseurs/traces/dds`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, id }),
      })
      const j = await r.json(); if (r.ok) setDdsList(j.data ?? [])
    } catch { /* ignore */ }
    finally { setDdsBusy(false) }
  }
  const tracesBase = info?.environment === 'production'
    ? 'https://eudr.webcloud.ec.europa.eu' : 'https://acceptance.eudr.webcloud.ec.europa.eu'

  async function submitDds() {
    setSubmitting(true); setSubmitRes(null)
    try {
      let geojsonObj: unknown = undefined
      if (dds.geojson.trim()) {
        try { geojsonObj = JSON.parse(dds.geojson) } catch { throw new Error('GeoJSON invalide (JSON non valide).') }
      }
      // goodsMeasure V2 : netWeight, et percentageEstimationOrDeviation (obligatoire Domestic/Trade,
      // interdit Import/Export). Pas de `volume` en V2.
      const isDomesticOrTrade = dds.activityType === 'DOMESTIC' || dds.activityType === 'TRADE'
      const goodsMeasure: Record<string, number> = {}
      if (dds.netWeight) goodsMeasure.netWeight = Number(dds.netWeight)
      // Obligatoire en Domestique/Négoce : si laissé vide, on envoie 0 (aucune déviation).
      if (isDomesticOrTrade) {
        goodsMeasure.percentageEstimationOrDeviation = dds.percentageEstimation !== '' ? Number(dds.percentageEstimation) : 0
      }
      const producers = (dds.producerCountry || dds.producerName || geojsonObj) ? [{
        country: dds.producerCountry || undefined,
        name: dds.producerName || undefined,
        geometryGeojson: geojsonObj,
      }] : undefined
      // speciesInfo obligatoire pour les produits bois (Annexe I) : nom scientifique + nom commun.
      const speciesInfo = (dds.speciesScientific || dds.speciesCommon)
        ? { scientificName: dds.speciesScientific || undefined, commonName: dds.speciesCommon || undefined }
        : undefined
      const statement = {
        internalReferenceNumber: dds.internalReferenceNumber,
        activityType: dds.activityType,
        countryOfActivity: dds.countryOfActivity,
        commodities: [{
          descriptors: { descriptionOfGoods: dds.descriptionOfGoods, goodsMeasure },
          hsHeading: dds.hsHeading,
          ...(speciesInfo ? { speciesInfo } : {}),
          ...(producers ? { producers } : {}),
        }],
      }
      const res = await fetch(`/api/eudr-fournisseurs/traces/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, operatorType: dds.operatorType, statement, geojsonAttachmentId: geojsonAttachmentId || undefined }),
      })
      const j = await res.json().catch(() => ({}))
      if (res.ok && j.ok) { setSubmitRes({ ok: true, text: `DDS déposée (${j.environment}). Identifiant : ${j.ddsIdentifier ?? '—'}`, geo: j.geoSanitized ?? null }); setLastUuid(j.ddsIdentifier ?? null); setStatusRes(null); loadDds() }
      else setSubmitRes({ ok: false, text: `${j.error ?? 'Échec du dépôt.'}${j.status ? ` (HTTP ${j.status})` : ''}`, detail: j.detail })
    } catch (e) { setSubmitRes({ ok: false, text: String((e as Error).message ?? e) }) }
    finally { setSubmitting(false) }
  }

  const ready = configured && !editingCred

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Bandeau */}
      <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
        🇪🇺 Connexion au système d&apos;information EUDR (TRACES) de la Commission européenne.
        {info?.environment === 'production'
          ? ' Environnement PRODUCTION — les dépôts ont valeur légale.'
          : ' Environnement d’acceptation (tests, sans valeur légale).'}
      </div>

      {/* Identifiants */}
      <div className={cardCls}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">🔑 Identifiants Web Service</h3>
          {configured && !editingCred && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">Configuré</span>
          )}
        </div>

        {!canManage ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {configured ? 'Identifiants configurés par le propriétaire du dossier.' : 'Aucun identifiant configuré. Seul le propriétaire peut les gérer.'}
          </p>
        ) : ready ? (
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-medium">{info?.username}</span>
              <span className="text-gray-400"> · {info?.environment === 'production' ? 'Production' : 'Acceptation'}</span>
            </div>
            <div className="flex gap-2">
              <button className={btnGhost} onClick={() => setEditingCred(true)}>Modifier</button>
              <button className={btnGhost} onClick={deleteCred} disabled={savingCred}>Supprimer</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Nom d&apos;utilisateur TRACES</label>
              <input className={inputCls} value={username} onChange={e => setUsername(e.target.value)} placeholder="mon-compte-traces" />
            </div>
            <div>
              <label className={labelCls}>Clé d&apos;authentification (Web Service Access)</label>
              <input className={inputCls} type="password" value={authKey} onChange={e => setAuthKey(e.target.value)} placeholder="••••••••••••" />
              <p className="text-xs text-gray-400 mt-1">À demander à sante-traces@ec.europa.eu, visible dans le panneau « Web Services Access » de votre profil EUDR. Différente de votre mot de passe TRACES.</p>
            </div>
            <div>
              <label className={labelCls}>Environnement</label>
              <select className={inputCls} value={environment} onChange={e => setEnvironment(e.target.value as 'acceptance' | 'production')}>
                <option value="acceptance">Acceptation (tests)</option>
                <option value="production">Production (valeur légale)</option>
              </select>
            </div>
            {credMsg && <p className="text-xs text-gray-600 dark:text-gray-300">{credMsg}</p>}
            <div className="flex gap-2">
              <button className={btnPrimary} onClick={saveCred} disabled={savingCred || !username.trim() || !authKey.trim()}>
                {savingCred ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              {configured && <button className={btnGhost} onClick={() => { setEditingCred(false); setAuthKey('') }}>Annuler</button>}
            </div>
          </div>
        )}

        {ready && (
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center gap-3">
            <button className={btnGhost} onClick={testEcho} disabled={echoing}>{echoing ? 'Test…' : '🔌 Tester la connexion'}</button>
            {echoMsg && <span className={`text-sm ${echoMsg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{echoMsg.ok ? '✅ ' : '❌ '}{echoMsg.text}</span>}
          </div>
        )}
        {echoMsg?.detail && (
          <pre className="mt-1 max-h-48 overflow-auto text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap bg-gray-50 dark:bg-gray-900/40 rounded p-2">{echoMsg.detail}</pre>
        )}
      </div>

      {/* Suivi des DDS déposées */}
      {ready && (
        <div className={cardCls}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">📋 Suivi de mes déclarations DDS</h3>
            <button className={btnGhost} onClick={() => refreshDds()} disabled={ddsBusy || ddsList.length === 0}>
              {ddsBusy ? 'Actualisation…' : '🔄 Actualiser les statuts'}
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Vision officielle TRACES : statut, date et auteur de chaque dépôt. « Actualiser » interroge le registre EUDR.</p>
          {ddsList.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">Aucune DDS déposée depuis l&apos;application pour le moment.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 pr-3">Réf. interne / produit</th>
                    <th className="py-2 pr-3">Statut officiel</th>
                    <th className="py-2 pr-3">N° référence / vérification</th>
                    <th className="py-2 pr-3">Date officielle · auteur</th>
                    <th className="py-2 pr-3">Déposée par</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {ddsList.map(d => {
                    const st = (d.status ?? '').toUpperCase()
                    const cls = st === 'AVAILABLE' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                      : st === 'REJECTED' || st === 'CANCELLED' || st === 'WITHDRAWN' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                      : st ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'
                    const fmt = (s: string | null) => { if (!s) return '—'; const dt = new Date(s); return isNaN(+dt) ? s : dt.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) }
                    return (
                      <tr key={d.id} className="border-b border-gray-100 dark:border-gray-800 align-top">
                        <td className="py-2 pr-3">
                          <div className="font-medium text-gray-800 dark:text-gray-200">{d.internal_reference_number || '—'}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{[d.commodity, d.activity_type].filter(Boolean).join(' · ') || '—'}{d.environment === 'production' ? '' : ' · acceptance'}</div>
                        </td>
                        <td className="py-2 pr-3"><span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{d.status ?? 'non actualisé'}</span></td>
                        <td className="py-2 pr-3 text-xs text-gray-600 dark:text-gray-300">{d.reference_number ? <><div className="font-mono">{d.reference_number}</div><div className="font-mono text-gray-400">{d.verification_number}</div></> : '—'}</td>
                        <td className="py-2 pr-3 text-xs text-gray-600 dark:text-gray-300">{fmt(d.official_date)}{d.official_updated_by ? <div className="text-gray-400">{d.official_updated_by}</div> : null}</td>
                        <td className="py-2 pr-3 text-xs text-gray-600 dark:text-gray-300">{d.submitted_by || '—'}<div className="text-gray-400">{fmt(d.submitted_at)}</div></td>
                        <td className="py-2 text-right whitespace-nowrap">
                          <a className="text-xs text-green-600 dark:text-green-400 hover:underline" href={`${tracesBase}/tracesnt/certificate/eudr/edit/${d.dds_uuid}`} target="_blank" rel="noopener noreferrer">DDS officielle ↗</a>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Vérification DDS */}
      <div className={cardCls}>
        <h3 className="font-semibold text-gray-900 dark:text-white">🔎 Vérifier une DDS reçue</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Saisissez le numéro de référence et le numéro de vérification communiqués par un fournisseur ou acheteur.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Numéro de référence</label>
            <input className={inputCls} value={refNum} onChange={e => setRefNum(e.target.value)} placeholder="25FRXXXXXXXXXX" />
          </div>
          <div>
            <label className={labelCls}>Numéro de vérification</label>
            <input className={inputCls} value={verNum} onChange={e => setVerNum(e.target.value)} placeholder="XXXXXXXX" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className={btnPrimary} onClick={verifyDds} disabled={verifying || !ready || !refNum.trim() || !verNum.trim()}>
            {verifying ? 'Vérification…' : 'Vérifier'}
          </button>
          {!ready && <span className="text-xs text-gray-400">Configurez d&apos;abord les identifiants.</span>}
        </div>
        {verifyRes && (
          <div className={`rounded-lg px-4 py-3 text-sm ${verifyRes.ok ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
            <p className="font-medium">{verifyRes.ok ? '✅ ' : '❌ '}{verifyRes.text}</p>
            {verifyRes.data != null && (
              <pre className="mt-2 max-h-64 overflow-auto text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{JSON.stringify(verifyRes.data, null, 2)}</pre>
            )}
          </div>
        )}
      </div>

      {/* Dépôt DDS */}
      <div className={cardCls}>
        <h3 className="font-semibold text-gray-900 dark:text-white">📤 Déposer une DDS</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Déclaration de diligence raisonnée (submitDds V3). La géolocalisation est un GeoJSON.</p>
        {contracts.length > 0 && (
          <div>
            <label className={labelCls}>Pré-remplir depuis un contrat</label>
            <select className={inputCls} defaultValue="" onChange={e => { if (e.target.value) prefillFromContract(e.target.value) }}>
              <option value="">— Choisir un contrat —</option>
              {contracts.map(c => (
                <option key={c.id} value={c.id}>{c.contract_number || '(sans n°)'}{c.product ? ` · ${c.product}` : ''}{c.supplier ? ` · ${c.supplier}` : ''}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Reprend référence, produit, pays et producteur. Le code SH, le poids, l&apos;espèce et le GeoJSON restent à compléter (non stockés dans la fiche).</p>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Type d&apos;opérateur</label>
            <select className={inputCls} value={dds.operatorType} onChange={e => setF('operatorType', e.target.value)}>
              <option value="OPERATOR">Opérateur</option>
              <option value="TRADER">Négociant (Trader)</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Type d&apos;activité</label>
            <select className={inputCls} value={dds.activityType} onChange={e => setF('activityType', e.target.value)}>
              <option value="IMPORT">Import</option>
              <option value="EXPORT">Export</option>
              <option value="DOMESTIC">Domestique</option>
              <option value="TRADE">Commerce</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Référence interne</label>
            <input className={inputCls} value={dds.internalReferenceNumber} onChange={e => setF('internalReferenceNumber', e.target.value)} placeholder="REF-2026-001" />
          </div>
          <div>
            <label className={labelCls}>Pays d&apos;activité (ISO)</label>
            <input className={inputCls} value={dds.countryOfActivity} onChange={e => setF('countryOfActivity', e.target.value)} placeholder="FR" maxLength={2} />
          </div>
          <div>
            <label className={labelCls}>Code SH</label>
            <input className={inputCls} value={dds.hsHeading} onChange={e => setF('hsHeading', e.target.value)} placeholder="4401" />
          </div>
          <div>
            <label className={labelCls}>Description des marchandises</label>
            <input className={inputCls} value={dds.descriptionOfGoods} onChange={e => setF('descriptionOfGoods', e.target.value)} placeholder="Bois de chauffage" />
          </div>
          <div>
            <label className={labelCls}>Poids net (kg)</label>
            <input className={inputCls} type="number" value={dds.netWeight} onChange={e => setF('netWeight', e.target.value)} placeholder="1000" />
          </div>
          <div>
            <label className={labelCls}>% estimation/déviation {(dds.activityType === 'DOMESTIC' || dds.activityType === 'TRADE') ? '(obligatoire)' : '(Domestique/Négoce)'}</label>
            <input className={inputCls} type="number" value={dds.percentageEstimation} onChange={e => setF('percentageEstimation', e.target.value)} placeholder="0" min={0} max={25} />
          </div>
          <div>
            <label className={labelCls}>Espèce — nom scientifique</label>
            <input className={inputCls} list="eudr-species-sci" value={dds.speciesScientific} onChange={e => setF('speciesScientific', e.target.value)} placeholder="Theobroma cacao" />
            <datalist id="eudr-species-sci">
              <option value="Theobroma cacao" label="Cacao" />
              <option value="Coffea arabica" label="Café (arabica)" />
              <option value="Coffea canephora" label="Café (robusta)" />
              <option value="Elaeis guineensis" label="Palmier à huile" />
              <option value="Hevea brasiliensis" label="Hévéa / caoutchouc" />
              <option value="Glycine max" label="Soja" />
              <option value="Bos taurus" label="Bovin" />
            </datalist>
          </div>
          <div>
            <label className={labelCls}>Espèce — nom commun</label>
            <input className={inputCls} list="eudr-species-common" value={dds.speciesCommon} onChange={e => setF('speciesCommon', e.target.value)} placeholder="Cacao" />
            <datalist id="eudr-species-common">
              <option value="Cacao" />
              <option value="Café" />
              <option value="Huile de palme" />
              <option value="Caoutchouc naturel" />
              <option value="Soja" />
              <option value="Bovin" />
            </datalist>
          </div>
          <div>
            <label className={labelCls}>Pays producteur (ISO)</label>
            <input className={inputCls} value={dds.producerCountry} onChange={e => setF('producerCountry', e.target.value)} placeholder="BR" maxLength={2} />
          </div>
          <div>
            <label className={labelCls}>Nom producteur</label>
            <input className={inputCls} value={dds.producerName} onChange={e => setF('producerName', e.target.value)} placeholder="Ferme XYZ" />
          </div>
        </div>
        <div>
          <label className={labelCls}>Géolocalisation (GeoJSON FeatureCollection)</label>
          {geojsonAttachmentId ? (
            <div className="rounded-lg border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3 text-sm">
              <p className="text-green-700 dark:text-green-400 font-medium">📄 GeoJSON fourni par le document sélectionné</p>
              {geoPreview?.loading && <p className="text-xs text-gray-500 mt-1">Lecture du document…</p>}
              {geoPreview?.features != null && <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{geoPreview.features} parcelle(s){geoPreview.types?.length ? ` · ${geoPreview.types.join(', ')}` : ''} — injecté au dépôt.</p>}
              {geoPreview?.error && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">⚠️ {geoPreview.error}</p>}
              <button type="button" onClick={() => { setGeojsonAttachmentId(''); setGeoSupplierId('') }} className="text-xs text-gray-500 hover:underline mt-1">Utiliser plutôt le champ texte</button>
            </div>
          ) : (
            <textarea className={`${inputCls} font-mono h-28`} value={dds.geojson} onChange={e => setF('geojson', e.target.value)}
              placeholder='{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[-60.0,-3.0]},"properties":{}}]}' />
          )}
        </div>
        {suppliers.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>…ou GeoJSON depuis un document (fournisseur)</label>
              <select className={inputCls} value={geoSupplierId} onChange={e => setGeoSupplierId(e.target.value)}>
                <option value="">— Choisir un fournisseur —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.company || '(sans nom)'}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Document GeoJSON</label>
              <select className={inputCls} value={geojsonAttachmentId} onChange={e => setGeojsonAttachmentId(e.target.value)} disabled={!geoSupplierId}>
                <option value="">{geoSupplierId ? (geoDocs.length ? '— Choisir —' : 'Aucun GeoJSON pour ce fournisseur') : '—'}</option>
                {geoDocs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {geojsonAttachmentId && <p className="text-xs text-green-600 dark:text-green-400 mt-1">✓ GeoJSON du document utilisé (le champ texte est ignoré).</p>}
            </div>
          </div>
        )}
        <div className="flex items-center gap-3">
          <button className={btnPrimary} onClick={submitDds} disabled={submitting || !ready || !dds.internalReferenceNumber.trim() || !dds.hsHeading.trim()}>
            {submitting ? 'Dépôt…' : 'Déposer la DDS'}
          </button>
          {!ready && <span className="text-xs text-gray-400">Configurez d&apos;abord les identifiants.</span>}
        </div>
        {submitRes && (
          <div className={`rounded-lg px-4 py-3 text-sm ${submitRes.ok ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
            <p>{submitRes.ok ? '✅ ' : '❌ '}{submitRes.text}</p>
            {submitRes.detail && (
              <pre className="mt-2 max-h-64 overflow-auto text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{submitRes.detail}</pre>
            )}
          </div>
        )}
        {submitRes?.ok && submitRes.geo && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">🧭 Nettoyage géométrique appliqué avant envoi (l&apos;original SharePoint est conservé)</p>
            <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-0.5">
              <li>Parcelles : {submitRes.geo.featuresBefore} → {submitRes.geo.featuresAfter}{submitRes.geo.multiPolygonsSplit > 0 ? ` (${submitRes.geo.multiPolygonsSplit} MultiPolygon éclaté(s))` : ''}</li>
              <li>Sommets : {submitRes.geo.pointsBefore.toLocaleString('fr-FR')} → {submitRes.geo.pointsAfter.toLocaleString('fr-FR')} (coordonnées arrondies à 6 décimales)</li>
              <li>Surface : {submitRes.geo.areaBeforeHa.toLocaleString('fr-FR')} ha → <span className="font-medium">{submitRes.geo.areaAfterHa.toLocaleString('fr-FR')} ha</span>{submitRes.geo.holesRemoved > 0 ? ` · ${submitRes.geo.holesRemoved} trou(s) retiré(s)` : ''}
                {submitRes.geo.areaBeforeHa > 0 && <span className="text-gray-400"> (écart {(((submitRes.geo.areaAfterHa - submitRes.geo.areaBeforeHa) / submitRes.geo.areaBeforeHa) * 100).toFixed(2)} %)</span>}
              </li>
            </ul>
            {submitRes.geo.holeAlerts?.length > 0 ? (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-2">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-300">⚠️ À vérifier : retrait de trou &gt; 1 % de la parcelle (surface sur-déclarée) — contrôlez ces parcelles sur la carte TRACES.</p>
                <ul className="mt-1 text-xs text-amber-700 dark:text-amber-400 space-y-0.5">
                  {submitRes.geo.holeAlerts.map((a, i) => (
                    <li key={i}>• <span className="font-medium">{a.name}</span> : +{a.addedHa.toLocaleString('fr-FR')} ha sur {a.plotHa.toLocaleString('fr-FR')} ha (+{a.pct} %)</li>
                  ))}
                </ul>
              </div>
            ) : submitRes.geo.holesRemoved > 0 ? (
              <p className="text-xs text-green-700 dark:text-green-400">✓ Trous retirés négligeables (&lt; 1 % de chaque parcelle).</p>
            ) : null}
          </div>
        )}
        {lastUuid && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
            <div className="flex items-center gap-3">
              <button className={btnGhost} onClick={checkStatus} disabled={statusChecking}>{statusChecking ? 'Vérification…' : '🔄 Récupérer n° de référence / statut'}</button>
              <span className="text-xs text-gray-400">La DDS doit être traitée (statut AVAILABLE) pour obtenir les numéros.</span>
            </div>
            {statusRes && (statusRes.error
              ? <p className="text-sm text-red-600 dark:text-red-400">❌ {statusRes.error}</p>
              : <div className="text-sm text-gray-700 dark:text-gray-200 space-y-0.5">
                  <p>Statut : <span className="font-medium">{statusRes.status ?? '—'}</span></p>
                  <p>N° de référence : <span className="font-mono">{statusRes.referenceNumber ?? '—'}</span></p>
                  <p>N° de vérification : <span className="font-mono">{statusRes.verificationNumber ?? '—'}</span></p>
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

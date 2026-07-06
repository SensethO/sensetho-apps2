'use client'

import { useState, useEffect, useCallback } from 'react'

// Connexion au système d'information EUDR (TRACES NT) de la Commission européenne.
// Trois blocs : identifiants Web Service (+ test Echo), vérification d'une DDS reçue,
// dépôt d'une DDS. L'app ne connaît jamais la clé en clair (chiffrée côté serveur).

const inputCls = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500'
const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'
const cardCls = 'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 p-5 space-y-4'
const btnPrimary = 'px-3 py-2 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50'
const btnGhost = 'px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-50'

interface CredInfo { username: string; environment: 'acceptance' | 'production'; clientId: string; updatedAt: string | null }

export default function EudrTracesPanel({ orgId, canManage }: { orgId: string; canManage: boolean }) {
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
  const [submitRes, setSubmitRes] = useState<{ ok: boolean; text: string; detail?: string } | null>(null)
  function setF<K extends keyof typeof dds>(k: K, v: string) { setDds(d => ({ ...d, [k]: v })) }

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
      if (isDomesticOrTrade && dds.percentageEstimation !== '') {
        goodsMeasure.percentageEstimationOrDeviation = Number(dds.percentageEstimation)
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
        body: JSON.stringify({ org_id: orgId, operatorType: dds.operatorType, statement }),
      })
      const j = await res.json().catch(() => ({}))
      if (res.ok && j.ok) setSubmitRes({ ok: true, text: `DDS déposée (${j.environment}). Identifiant : ${j.ddsIdentifier ?? '—'}` })
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
        <p className="text-sm text-gray-500 dark:text-gray-400">Déclaration de diligence raisonnée (submitDds V2). La géolocalisation est un GeoJSON.</p>
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
            <label className={labelCls}>Espèce — nom scientifique (bois)</label>
            <input className={inputCls} value={dds.speciesScientific} onChange={e => setF('speciesScientific', e.target.value)} placeholder="Fagus sylvatica" />
          </div>
          <div>
            <label className={labelCls}>Espèce — nom commun (bois)</label>
            <input className={inputCls} value={dds.speciesCommon} onChange={e => setF('speciesCommon', e.target.value)} placeholder="Hêtre" />
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
          <textarea className={`${inputCls} font-mono h-28`} value={dds.geojson} onChange={e => setF('geojson', e.target.value)}
            placeholder='{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[-60.0,-3.0]},"properties":{}}]}' />
        </div>
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
      </div>
    </div>
  )
}

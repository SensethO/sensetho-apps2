'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// Analyse des COA (Certificate of Analysis) : téléversement du COA (+ demande client
// optionnelle) sur SharePoint, analyse par IA (extraction + cohérence spécifications/résultats),
// points à vérifier, et validation par un responsable habilité.

const input = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500'
const label = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'
const card = 'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 p-5 space-y-4'
const btnP = 'px-3 py-2 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50'
const btnG = 'px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-50'
const hint = 'text-xs text-gray-400 dark:text-gray-500'

type Verdict = 'conforme' | 'non_conforme' | 'a_verifier'
interface Row { section: string; parametre: string; methode: string; specification: string; resultat: string; verdict: Verdict; commentaire: string; source: string }
interface Coa {
  id: string; label: string; supplier_id: string | null; contract_id: string | null
  source_attachment_id: string | null; client_demand_attachment_id: string | null
  status: 'draft' | 'analyzed' | 'validated'
  extracted: { header?: Record<string, string>; rows?: Row[] }
  analysis: unknown[]; summary: { conforme_global?: boolean; resume?: string; counts?: { conforme: number; non_conforme: number; a_verifier: number } }
  points_a_verifier: string[]; analyzed_at: string | null; analyzed_model: string | null
  validated_by: string | null; validated_at: string | null; created_at: string
}
interface Lite { id: string; company?: string; contract_number?: string }

const VERDICT = {
  conforme: { label: 'Conforme', cls: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' },
  non_conforme: { label: 'Non conforme', cls: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400' },
  a_verifier: { label: 'À vérifier', cls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' },
}

export default function EudrCoaPanel({ orgId, canManage, suppliers = [], contracts = [] }: {
  orgId: string; canManage: boolean; suppliers?: Lite[]; contracts?: Lite[]
}) {
  const [coas, setCoas] = useState<Coa[]>([])
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/eudr-fournisseurs/coa?org_id=${orgId}`)
      const j = await res.json()
      if (res.ok) setCoas(j.data ?? [])
    } catch { /* ignore */ }
  }, [orgId])
  useEffect(() => { load() }, [load])

  // ── Nouveau COA (création + upload + analyse) ─────────────────────────────
  const [label_, setLabel] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [contractId, setContractId] = useState('')
  const coaFileRef = useRef<HTMLInputElement>(null)
  const demandFileRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<string | null>(null)

  async function uploadToCoa(coaId: string, file: File, kind: 'coa' | 'client_demand') {
    const sRes = await fetch(`/api/eudr-fournisseurs/coa/upload-session`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId, coa_id: coaId, filename: file.name, kind }),
    })
    const sJson = await sRes.json()
    if (!sRes.ok) throw new Error(sJson.error ?? 'Échec upload session')
    const put = await fetch(sJson.uploadUrl, { method: 'PUT', headers: { 'Content-Range': `bytes 0-${file.size - 1}/${file.size}` }, body: file })
    if (!put.ok) throw new Error('Échec de l’envoi vers SharePoint')
    const item = await put.json() as { id?: string }
    if (!item.id) throw new Error('Réponse SharePoint invalide')
    const cRes = await fetch(`/api/eudr-fournisseurs/coa/upload-confirm`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId, coa_id: coaId, kind, spItemId: item.id, name: sJson.finalName, mime: file.type, size: file.size }),
    })
    const cJson = await cRes.json()
    if (!cRes.ok) throw new Error(cJson.error ?? 'Échec enregistrement')
  }

  async function createAndAnalyze() {
    const coaFile = coaFileRef.current?.files?.[0]
    if (!coaFile) { setError('Sélectionnez le fichier COA.'); return }
    setError(null); setProgress('Création du dossier COA…')
    try {
      const cRes = await fetch(`/api/eudr-fournisseurs/coa`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, label: label_.trim() || coaFile.name, supplier_id: supplierId || undefined, contract_id: contractId || undefined }),
      })
      const cJson = await cRes.json()
      if (!cRes.ok) throw new Error(cJson.error ?? 'Erreur')
      const coaId = cJson.data.id as string

      setProgress('Envoi du COA vers SharePoint…')
      await uploadToCoa(coaId, coaFile, 'coa')

      const demandFile = demandFileRef.current?.files?.[0]
      if (demandFile) { setProgress('Envoi de la demande client…'); await uploadToCoa(coaId, demandFile, 'client_demand') }

      setProgress('Analyse par IA en cours (30–60 s)…')
      const aRes = await fetch(`/api/eudr-fournisseurs/coa/analyze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, coa_id: coaId }),
      })
      const aJson = await aRes.json()
      if (!aRes.ok) throw new Error(aJson.error ?? 'Échec de l’analyse')

      setLabel(''); setSupplierId(''); setContractId('')
      if (coaFileRef.current) coaFileRef.current.value = ''
      if (demandFileRef.current) demandFileRef.current.value = ''
      await load()
      setExpanded(coaId)
    } catch (e) { setError(String((e as Error).message ?? e)) }
    finally { setProgress(null) }
  }

  async function reanalyze(coaId: string) {
    setError(null); setProgress('Nouvelle analyse en cours…')
    try {
      const aRes = await fetch(`/api/eudr-fournisseurs/coa/analyze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ org_id: orgId, coa_id: coaId }),
      })
      const aJson = await aRes.json()
      if (!aRes.ok) throw new Error(aJson.error ?? 'Échec')
      await load()
    } catch (e) { setError(String((e as Error).message ?? e)) }
    finally { setProgress(null) }
  }

  async function del(coaId: string) {
    if (!confirm('Supprimer ce COA ?')) return
    await fetch(`/api/eudr-fournisseurs/coa?id=${coaId}&org_id=${orgId}`, { method: 'DELETE' })
    await load()
  }

  async function validate(coaId: string) {
    setError(null)
    const res = await fetch(`/api/eudr-fournisseurs/coa/validate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ org_id: orgId, coa_id: coaId }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setError(j.error ?? 'Échec de la validation'); return }
    await load()
  }
  async function unvalidate(coaId: string) {
    await fetch(`/api/eudr-fournisseurs/coa/validate?org_id=${orgId}&coa_id=${coaId}`, { method: 'DELETE' })
    await load()
  }
  async function download(attId: string) {
    const res = await fetch(`/api/eudr-fournisseurs/documents/download?org_id=${orgId}&id=${attId}`)
    const j = await res.json().catch(() => ({}))
    if (res.ok && j.url) window.open(j.url, '_blank')
  }

  const supplierName = (id: string | null) => suppliers.find(s => s.id === id)?.company ?? ''

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
        🧪 Analyse des Certificats d’Analyses (COA). L’IA extrait le tableau (description organoleptique, physico-chimique, microbiologique) et vérifie la cohérence des résultats vs les spécifications. Les points non tranchables sont listés « à vérifier ». Un COA n’est validé que si un responsable habilité le valide.
      </div>

      {error && <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>}

      {canManage && <ResponsablesCard orgId={orgId} />}

      {/* Nouveau COA */}
      {canManage && (
        <div className={card}>
          <h3 className="font-semibold text-gray-900 dark:text-white">Analyser un nouveau COA</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={label}>Libellé</label>
              <input className={input} value={label_} onChange={e => setLabel(e.target.value)} placeholder="COA — produit / batch" />
            </div>
            <div>
              <label className={label}>Fournisseur (optionnel)</label>
              <select className={input} value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                <option value="">—</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.company || s.id}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Contrat (optionnel)</label>
              <select className={input} value={contractId} onChange={e => setContractId(e.target.value)}>
                <option value="">—</option>
                {contracts.map(c => <option key={c.id} value={c.id}>{c.contract_number || c.id}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={label}>Fichier COA (PDF ou image) *</label>
              <input ref={coaFileRef} type="file" accept="application/pdf,image/*" className="text-sm text-gray-600 dark:text-gray-300" />
            </div>
            <div>
              <label className={label}>Demande client (optionnel — PDF, image, Excel, CSV)</label>
              <input ref={demandFileRef} type="file" accept="application/pdf,image/*,.xlsx,.xls,.csv,.txt" className="text-sm text-gray-600 dark:text-gray-300" />
              <p className={hint}>Sert de référence pour les critères qualitatifs (couleur attendue, etc.).</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className={btnP} onClick={createAndAnalyze} disabled={!!progress}>{progress ? '…' : '🔍 Analyser'}</button>
            {progress && <span className="text-sm text-gray-500 dark:text-gray-400">{progress}</span>}
          </div>
          <p className={hint}>Le fichier est envoyé sur SharePoint puis transmis à l’IA pour analyse (rien n’est stocké ailleurs).</p>
        </div>
      )}

      {/* Liste des COA */}
      {coas.length === 0 ? (
        <div className={card}><p className={hint}>Aucun COA analysé pour l’instant.</p></div>
      ) : coas.map(coa => {
        const counts = coa.summary?.counts
        const rows = coa.extracted?.rows ?? []
        const open = expanded === coa.id
        return (
          <div key={coa.id} className={card}>
            <div className="flex items-start justify-between gap-3">
              <button className="text-left flex-1" onClick={() => setExpanded(open ? null : coa.id)}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900 dark:text-white">{coa.label}</span>
                  {coa.status === 'validated'
                    ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-600 text-white">✓ Validé</span>
                    : coa.status === 'analyzed'
                      ? <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400">Analysé</span>
                      : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500">Brouillon</span>}
                  {counts && (
                    <span className="flex gap-1 text-xs">
                      <span className="px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">{counts.conforme} ✓</span>
                      {counts.non_conforme > 0 && <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400">{counts.non_conforme} ✗</span>}
                      {counts.a_verifier > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">{counts.a_verifier} ?</span>}
                    </span>
                  )}
                </div>
                <p className={hint}>{supplierName(coa.supplier_id) || ''}{coa.summary?.resume ? ` — ${coa.summary.resume}` : ''}</p>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                {coa.source_attachment_id && <button className="text-gray-400 hover:text-green-600 text-sm" title="Télécharger le COA" onClick={() => download(coa.source_attachment_id!)}>⬇</button>}
                {canManage && <button className="text-gray-400 hover:text-red-500 text-sm" title="Supprimer" onClick={() => del(coa.id)}>✕</button>}
              </div>
            </div>

            {open && (
              <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-gray-700">
                {/* En-tête extrait */}
                {coa.extracted?.header && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
                    {Object.entries(coa.extracted.header).filter(([, v]) => v).map(([k, v]) => (
                      <div key={k}><span className="text-gray-400">{k.replace(/_/g, ' ')}:</span> {v}</div>
                    ))}
                  </div>
                )}

                {/* Tableau des lignes */}
                {rows.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                          <th className="p-2">Paramètre</th><th className="p-2">Méthode</th><th className="p-2">Spécification</th><th className="p-2">Résultat</th><th className="p-2">Verdict</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={i} className="border-b border-gray-100 dark:border-gray-700 align-top">
                            <td className="p-2"><span className="text-[10px] text-gray-400 block">{r.section}</span>{r.parametre}</td>
                            <td className="p-2 text-gray-500">{r.methode || '—'}</td>
                            <td className="p-2">{r.specification || '—'}</td>
                            <td className="p-2 font-medium">{r.resultat || '—'}</td>
                            <td className="p-2">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${VERDICT[r.verdict]?.cls ?? ''}`}>{VERDICT[r.verdict]?.label ?? r.verdict}</span>
                              {r.commentaire && <p className="text-[11px] text-gray-400 mt-0.5 max-w-xs">{r.commentaire}{r.source ? ` · ${r.source}` : ''}</p>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Points à vérifier */}
                {coa.points_a_verifier?.length > 0 && (
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">⚠️ Points à vérifier manuellement</p>
                    <ul className="space-y-1">
                      {coa.points_a_verifier.map((p, i) => <li key={i} className="text-xs text-amber-800 dark:text-amber-300">• {p}</li>)}
                    </ul>
                  </div>
                )}

                {/* Validation */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {coa.status === 'validated' ? (
                    <>
                      <span className="text-sm text-green-700 dark:text-green-400">✓ Validé par {coa.validated_by}{coa.validated_at ? ` le ${new Date(coa.validated_at).toLocaleDateString('fr-FR')}` : ''}</span>
                      <button className={btnG} onClick={() => unvalidate(coa.id)}>Retirer la validation</button>
                    </>
                  ) : coa.status === 'analyzed' ? (
                    <button className={btnP} onClick={() => validate(coa.id)}>✓ Valider ce COA</button>
                  ) : null}
                  {canManage && coa.status !== 'draft' && <button className={btnG} onClick={() => reanalyze(coa.id)} disabled={!!progress}>↻ Relancer l’analyse</button>}
                  {coa.analyzed_model && <span className={hint}>Analysé par {coa.analyzed_model}</span>}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Gestion des responsables COA (propriétaire) ──────────────────────────────
function ResponsablesCard({ orgId }: { orgId: string }) {
  const [list, setList] = useState<{ id: string; email: string }[]>([])
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/eudr-fournisseurs/coa/responsables?org_id=${orgId}`)
    const j = await res.json().catch(() => ({}))
    if (res.ok) setList(j.data ?? [])
  }, [orgId])
  useEffect(() => { if (open) load() }, [open, load])

  async function add() {
    setMsg(null)
    const res = await fetch(`/api/eudr-fournisseurs/coa/responsables`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ org_id: orgId, email: email.trim() }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg(j.error ?? 'Erreur'); return }
    setEmail(''); await load()
  }
  async function remove(id: string) {
    await fetch(`/api/eudr-fournisseurs/coa/responsables?id=${id}&org_id=${orgId}`, { method: 'DELETE' })
    await load()
  }

  return (
    <div className={card}>
      <button className="flex items-center justify-between w-full" onClick={() => setOpen(!open)}>
        <h3 className="font-semibold text-gray-900 dark:text-white">👤 Responsables habilités à valider</h3>
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="space-y-3">
          <p className={hint}>Ces personnes (compte Sens’ethO) peuvent valider un COA. La validation d’un seul suffit.</p>
          <div className="flex gap-2">
            <input className={input} value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemple.com" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
            <button className={btnP} onClick={add} disabled={!email.trim()}>+ Ajouter</button>
          </div>
          {msg && <p className="text-xs text-red-500">{msg}</p>}
          {list.map(r => (
            <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/40 text-sm">
              <span className="text-gray-700 dark:text-gray-200">{r.email}</span>
              <button onClick={() => remove(r.id)} className="text-gray-400 hover:text-red-500" title="Retirer">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useMemo } from 'react'
import FollowUpJournal from '@/components/apps/FollowUpJournal'

// CRM de collecte documentaire EUDR. Objectif : savoir QUI relancer, QUAND et POUR QUOI,
// et amener chaque fournisseur/acheteur de « à contacter » à « dossier complet ».
// - Vue « À faire » : liste priorisée des relances (docs manquants + échéances).
// - Fiche unifiée (drawer) : coordonnées, contacts, checklist EUDR éditable, timeline, relance — au même endroit (fin de la double saisie).
// - Statut CALCULÉ à partir des faits (documents reçus + échanges), pas manuel.

const input = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500'
const label = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'
const card = 'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 p-4 space-y-3'
const btnP = 'px-3 py-2 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50'
const btnG = 'px-2.5 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-50'
const hint = 'text-xs text-gray-400 dark:text-gray-500'

const DOC_STATUS = [
  { value: 'oui', label: 'Reçu / OK' }, { value: 'partiel', label: 'Partiel' },
  { value: 'en_cours', label: 'En cours' }, { value: 'non', label: 'Non' }, { value: 'unknown', label: 'À demander' },
]
const FU_TYPES = [
  { value: 'demande', label: 'Demande' }, { value: 'relance', label: 'Relance' },
  { value: 'reponse', label: 'Réponse' }, { value: 'document', label: 'Document reçu' },
  { value: 'appel', label: 'Appel / WhatsApp' }, { value: 'autre', label: 'Autre' },
]
const FU_MAP = Object.fromEntries(FU_TYPES.map(o => [o.value, o.label]))

// Statuts calculés (situation du dossier)
const SITU = {
  a_contacter: { label: 'À contacter', cls: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300', rank: 1 },
  demande_envoyee: { label: 'Demande envoyée', cls: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400', rank: 2 },
  relance: { label: 'Relancé', cls: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400', rank: 3 },
  sans_reponse: { label: 'Sans réponse', cls: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400', rank: 3 },
  repondu: { label: 'A répondu', cls: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400', rank: 4 },
  partiel: { label: 'Dossier partiel', cls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400', rank: 4 },
  complet: { label: '✓ Complet', cls: 'bg-green-600 text-white', rank: 5 },
} as const
type Situ = keyof typeof SITU

interface FollowUp { date: string; type: string; text: string }
interface Contact { name: string; role: string; email: string; phone: string }
interface Cert { type: string; status: string; valid_until: string }
interface Rec {
  id: string; company?: string | null; name?: string | null; contact_person?: string | null; eudr_contact?: string | null; email?: string | null
  eudr_risk_level?: string | null; geojson_status?: string | null; farmer_questionnaire_status?: string | null; questionnaire_status?: string | null
  ddr_status?: string | null; dds_number?: string | null; certifications?: Cert[] | null
  follow_ups?: FollowUp[] | null; contacts?: Contact[] | null; next_action?: string | null; next_action_date?: string | null; owner?: string | null
}

// Documents requis par type de relation
const DOCS = {
  suppliers: [
    { key: 'geojson_status', label: 'GeoJSON' },
    { key: 'farmer_questionnaire_status', label: 'Questionnaire' },
    { key: 'ddr_status', label: 'DDR' },
  ],
  buyers: [
    { key: 'geojson_status', label: 'GeoJSON' },
    { key: 'questionnaire_status', label: 'Questionnaire' },
    { key: 'dds_number', label: 'DDS', text: true },
  ],
} as const

const todayStr = () => { try { return new Date().toISOString().slice(0, 10) } catch { return '' } }
const fmt = (s?: string | null) => { if (!s) return '—'; const d = new Date(s); return isNaN(+d) ? s : d.toLocaleDateString('fr-FR') }
function addDays(iso: string, n: number): string { const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
function daysSince(iso?: string): number { if (!iso) return 9999; const d = new Date(iso); if (isNaN(+d)) return 9999; return Math.floor((Date.now() - d.getTime()) / 86400000) }
function certState(c: Cert): 'valide' | 'bientot' | 'expire' | 'inconnu' {
  const raw = (c.valid_until ?? '').trim(); if (!raw) return c.status === 'expiré' ? 'expire' : 'inconnu'
  let d: Date | null = null, m: RegExpMatchArray | null
  if ((m = raw.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/))) d = new Date(+m[3], +m[2] - 1, +m[1])
  else if ((m = raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})/))) d = new Date(+m[1], +m[2] - 1, +m[3])
  else if ((m = raw.match(/(\d{1,2})[.\/](\d{4})/))) d = new Date(+m[2], +m[1] - 1, 1)
  else if ((m = raw.match(/^(\d{4})$/))) d = new Date(+m[1], 11, 31)
  if (!d || isNaN(+d)) return 'inconnu'
  const days = (d.getTime() - Date.now()) / 86400000
  return days < 0 ? 'expire' : days < 60 ? 'bientot' : 'valide'
}

export default function EudrCrmPanel({ orgId, canWrite, suppliers = [], buyers = [], onChanged }: {
  orgId: string; canWrite: boolean; suppliers?: Rec[]; buyers?: Rec[]; onChanged: () => void
}) {
  void orgId
  const [kind, setKind] = useState<'suppliers' | 'buyers'>('suppliers')
  const [view, setView] = useState<'todo' | 'all'>('todo')
  const [editing, setEditing] = useState<Rec | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const records = kind === 'suppliers' ? suppliers : buyers
  const docs = DOCS[kind]
  const nameOf = (r: Rec) => (kind === 'suppliers' ? r.company : r.name) || '(sans nom)'
  const isDone = (r: Rec, d: { key: string; text?: boolean }) => {
    const v = (r as unknown as Record<string, unknown>)[d.key] as string | null | undefined
    return d.text ? !!(v && String(v).trim()) : v === 'oui'
  }
  const missingOf = (r: Rec) => docs.filter(d => !isDone(r, d))
  const lastFu = (r: Rec) => (r.follow_ups ?? []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]

  // Statut calculé à partir des faits (docs + échanges)
  function situationOf(r: Rec): Situ {
    const done = docs.filter(d => isDone(r, d)).length
    if (done === docs.length) return 'complet'
    if (done > 0) return 'partiel'
    const fu = r.follow_ups ?? []
    const hasInbound = fu.some(f => f.type === 'reponse' || f.type === 'document')
    if (hasInbound) return 'repondu'
    const outbound = fu.filter(f => f.type === 'demande' || f.type === 'relance' || f.type === 'appel')
    if (outbound.length) {
      const last = lastFu(r)
      if (daysSince(last?.date) > 14) return 'sans_reponse'
      return fu.some(f => f.type === 'relance') ? 'relance' : 'demande_envoyee'
    }
    return 'a_contacter'
  }

  // Score d'urgence (plus élevé = plus urgent)
  function urgency(r: Rec): number {
    let u = 0
    const situ = situationOf(r)
    if (situ === 'complet') return -1
    const nd = r.next_action_date
    if (nd && nd < today) u += 100
    else if (nd && nd <= addDays(today, 3)) u += 40
    if (situ === 'sans_reponse') u += 35
    if (r.eudr_risk_level === 'high') u += 25
    u += missingOf(r).length * 6
    if (situ === 'a_contacter') u += 15
    const days = daysSince(lastFu(r)?.date)
    if (days > 21 && situ !== 'a_contacter') u += 10
    if (kind === 'suppliers') u += (r.certifications ?? []).filter(c => certState(c) === 'expire').length * 8
    return u
  }

  const today = todayStr()
  const enriched = useMemo(() => records.map(r => ({ r, situ: situationOf(r), missing: missingOf(r), u: urgency(r) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [records, kind])
  const todo = enriched.filter(x => x.u >= 0 && x.situ !== 'complet').sort((a, b) => b.u - a.u)
  const all = [...enriched].sort((a, b) => b.u - a.u)

  const stats = useMemo(() => {
    const s = { complet: 0, partiel: 0, arelancer: 0, acontacter: 0 }
    enriched.forEach(x => {
      if (x.situ === 'complet') s.complet++
      else if (x.situ === 'partiel' || x.situ === 'repondu') s.partiel++
      else if (x.situ === 'a_contacter') s.acontacter++
      else s.arelancer++
    })
    return s
  }, [enriched])

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/eudr-fournisseurs/${kind}?id=${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error ?? 'Erreur')
      onChanged()
    } catch (e) { setError(String((e as Error).message ?? e)) }
    finally { setBusy(false) }
  }

  // Relance rapide : journalise une relance + fixe la prochaine échéance à +7 j.
  async function quickRelance(r: Rec) {
    const miss = missingOf(r).map(d => d.label).join(', ')
    const fu = [{ date: today, type: 'relance', text: `Relance${miss ? ` — documents manquants : ${miss}` : ''}` }, ...(r.follow_ups ?? [])]
    await patch(r.id, { follow_ups: fu, next_action: `Relancer${miss ? ` (${miss})` : ''}`, next_action_date: addDays(today, 7) })
  }
  async function markReceived(r: Rec) { await patch(r.id, { next_action: '', next_action_date: null }) }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {(['suppliers', 'buyers'] as const).map(k => (
            <button key={k} onClick={() => setKind(k)}
              className={`px-3 py-1.5 text-sm ${kind === k ? 'bg-green-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
              {k === 'suppliers' ? '🌱 Fournisseurs' : '🏢 Acheteurs'}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {([['todo', '📌 À faire'], ['all', '≣ Toutes']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 text-sm ${view === v ? 'bg-gray-800 dark:bg-gray-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>{l}</button>
          ))}
        </div>
      </div>

      {/* Synthèse */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { n: stats.acontacter, l: 'À contacter', c: 'text-gray-600 dark:text-gray-300' },
          { n: stats.arelancer, l: 'À relancer', c: 'text-amber-600 dark:text-amber-400' },
          { n: stats.partiel, l: 'En cours / partiel', c: 'text-teal-600 dark:text-teal-400' },
          { n: stats.complet, l: 'Dossiers complets', c: 'text-green-600 dark:text-green-400' },
        ].map(s => (
          <div key={s.l} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
            <div className={`text-2xl font-bold ${s.c}`}>{s.n}</div><div className="text-[11px] text-gray-500 dark:text-gray-400">{s.l}</div>
          </div>
        ))}
      </div>

      {error && <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-2 text-sm text-red-700 dark:text-red-400">{error}</div>}

      {/* Liste (À faire = priorisée sans les complets ; Toutes = tout) */}
      <div className="space-y-2">
        {(view === 'todo' ? todo : all).map(({ r, situ, missing }) => {
          const nd = r.next_action_date
          const overdue = nd && nd < today
          const fu = lastFu(r)
          return (
            <div key={r.id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 dark:text-white">{nameOf(r)}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${SITU[situ].cls}`}>{SITU[situ].label}</span>
                    {r.eudr_risk_level === 'high' && <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400">risque élevé</span>}
                  </div>
                  {/* Ce qui manque */}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {missing.length === 0
                      ? <span className="text-[11px] text-green-600 dark:text-green-400">Tous les documents requis sont reçus</span>
                      : missing.map(d => <span key={d.key} className="text-[11px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">manque : {d.label}</span>)}
                  </div>
                  <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                    {fu ? `Dernier échange : ${fmt(fu.date)} (${daysSince(fu.date)} j) · ${FU_MAP[fu.type] ?? fu.type}` : 'Aucun échange'}
                    {r.next_action ? <> · <span className={overdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}>Prochaine : {r.next_action}{nd ? ` (${fmt(nd)})` : ''}{overdue ? ' ⚠ en retard' : ''}</span></> : null}
                    {r.owner ? ` · 👤 ${r.owner}` : ''}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {canWrite && situ !== 'complet' && <button className={btnP + ' !py-1.5'} onClick={() => quickRelance(r)} disabled={busy}>✉ Relancer</button>}
                  <button className={btnG} onClick={() => setEditing(r)}>{canWrite ? 'Ouvrir la fiche' : 'Voir'}</button>
                </div>
              </div>
            </div>
          )
        })}
        {(view === 'todo' ? todo : all).length === 0 && (
          <div className={card}><p className={hint}>{view === 'todo' ? '🎉 Aucune relance à faire — tous les dossiers sont à jour.' : 'Aucune relation.'}</p></div>
        )}
      </div>

      {editing && <FicheDrawer record={editing} kind={kind} docs={docs} nameOf={nameOf} situ={situationOf(editing)} canWrite={canWrite} busy={busy}
        onClose={() => setEditing(null)} onRelance={quickRelance} onReceived={markReceived}
        onSave={async (body) => { await patch(editing.id, body); setEditing(null) }} />}
    </div>
  )
}

// ── Fiche unifiée (tout au même endroit : coordonnées, checklist, timeline, relance) ──
function FicheDrawer({ record, kind, docs, nameOf, situ, canWrite, busy, onClose, onSave, onRelance, onReceived }: {
  record: Rec; kind: 'suppliers' | 'buyers'; docs: readonly { key: string; label: string; text?: boolean }[]
  nameOf: (r: Rec) => string; situ: Situ; canWrite: boolean; busy: boolean
  onClose: () => void; onSave: (body: Record<string, unknown>) => void
  onRelance: (r: Rec) => void; onReceived: (r: Rec) => void
}) {
  const ro = !canWrite
  const [owner, setOwner] = useState(record.owner || '')
  const [nextAction, setNextAction] = useState(record.next_action || '')
  const [nextDate, setNextDate] = useState(record.next_action_date || '')
  const [contacts, setContacts] = useState<Contact[]>(record.contacts ?? [])
  const [fups, setFups] = useState<FollowUp[]>(record.follow_ups ?? [])
  const [docState, setDocState] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {}
    docs.forEach(d => { o[d.key] = ((record as unknown as Record<string, unknown>)[d.key] as string) ?? (d.text ? '' : 'unknown') })
    return o
  })

  const addContact = () => setContacts([...contacts, { name: '', role: '', email: '', phone: '' }])
  const updContact = (i: number, p: Partial<Contact>) => setContacts(contacts.map((c, idx) => idx === i ? { ...c, ...p } : c))
  const certs = kind === 'suppliers' ? (record.certifications ?? []) : []

  function save() {
    onSave({ owner, next_action: nextAction, next_action_date: nextDate || null, contacts, follow_ups: fups, ...docState })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-bold text-gray-900 dark:text-white truncate">🤝 {nameOf(record)}</h2>
            <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${SITU[situ].cls}`}>{SITU[situ].label}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Coordonnées */}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {(kind === 'suppliers' ? record.contact_person : record.eudr_contact) || '—'}{record.email ? ` · ${record.email}` : ''}
          </p>

          {/* Checklist EUDR — éditable ici (fin de la double saisie) */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">📋 Documents EUDR</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {docs.map(d => (
                <div key={d.key}>
                  <label className={label}>{d.label}</label>
                  {d.text ? (
                    <input className={input} value={docState[d.key] ?? ''} onChange={e => setDocState({ ...docState, [d.key]: e.target.value })} disabled={ro} placeholder="N° / référence" />
                  ) : (
                    <select className={input} value={docState[d.key] || 'unknown'} onChange={e => setDocState({ ...docState, [d.key]: e.target.value })} disabled={ro}>
                      {DOC_STATUS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
            {certs.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {certs.map((c, i) => {
                  const st = certState(c)
                  const cls = st === 'expire' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400' : st === 'bientot' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' : st === 'valide' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  return <span key={i} className={`text-[11px] px-2 py-0.5 rounded ${cls}`}>{c.type}{st === 'expire' ? ' · expiré' : st === 'bientot' ? ' · expire bientôt' : c.valid_until ? ` · ${c.valid_until}` : ''}</span>
                })}
              </div>
            )}
          </div>

          {/* Prochaine relance */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">🔔 Relance</span>
              {canWrite && situ !== 'complet' && <button className={btnG} onClick={() => onRelance(record)} disabled={busy}>✉ Enregistrer une relance (+7 j)</button>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2"><label className={label}>Prochaine action</label><input className={input} value={nextAction} onChange={e => setNextAction(e.target.value)} disabled={ro} placeholder="ex. Relancer par téléphone" /></div>
              <div><label className={label}>Échéance</label><input type="date" className={input} value={nextDate} onChange={e => setNextDate(e.target.value)} disabled={ro} /></div>
            </div>
            {(record.next_action_date || record.next_action) && canWrite && <button className="text-xs text-gray-500 hover:underline" onClick={() => onReceived(record)}>Marquer traité (effacer la relance)</button>}
          </div>

          {/* Responsable */}
          <div><label className={label}>Responsable du suivi</label><input className={input} value={owner} onChange={e => setOwner(e.target.value)} disabled={ro} placeholder="Qui suit ce dossier" /></div>

          {/* Contacts */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
            <div className="flex items-center justify-between"><span className="text-xs font-semibold text-gray-700 dark:text-gray-300">👥 Contacts</span>{!ro && <button className="text-xs text-green-600 dark:text-green-400 hover:underline" onClick={addContact}>+ Ajouter</button>}</div>
            {contacts.length === 0 ? <p className={hint}>Aucun contact.</p> : contacts.map((c, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                <input className={input} value={c.name} onChange={e => updContact(i, { name: e.target.value })} placeholder="Nom" disabled={ro} />
                <input className={input} value={c.role} onChange={e => updContact(i, { role: e.target.value })} placeholder="Fonction" disabled={ro} />
                <input className={input} value={c.email} onChange={e => updContact(i, { email: e.target.value })} placeholder="Email" disabled={ro} />
                <div className="flex gap-1"><input className={input} value={c.phone} onChange={e => updContact(i, { phone: e.target.value })} placeholder="Téléphone" disabled={ro} />{!ro && <button className="text-gray-400 hover:text-red-500" onClick={() => setContacts(contacts.filter((_, idx) => idx !== i))}>✕</button>}</div>
              </div>
            ))}
          </div>

          {/* Timeline */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <FollowUpJournal items={fups} onChange={setFups} readOnly={ro} />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">Fermer</button>
          {canWrite && <button onClick={save} disabled={busy} className={btnP}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>}
        </div>
      </div>
    </div>
  )
}

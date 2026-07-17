'use client'

import { useState, useMemo } from 'react'

// CRM relation fournisseurs / acheteurs : pipeline par statut, relances programmées
// (prochaine action + échéance), contacts multiples, responsable, et journal d'échanges
// (timeline). Écrit via les routes PATCH existantes /suppliers et /buyers.

const input = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500'
const label = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'
const card = 'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 p-4 space-y-3'
const btnP = 'px-3 py-2 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50'
const btnG = 'px-2.5 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors'
const hint = 'text-xs text-gray-400 dark:text-gray-500'

const STAGES = [
  { value: 'nouveau', label: 'Nouveau', cls: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300' },
  { value: 'demande_envoyee', label: 'Demande envoyée', cls: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400' },
  { value: 'relance', label: 'Relancé', cls: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400' },
  { value: 'en_attente', label: 'En attente', cls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' },
  { value: 'repondu', label: 'A répondu', cls: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400' },
  { value: 'documents_recus', label: 'Documents reçus', cls: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' },
  { value: 'complet', label: 'Complet', cls: 'bg-green-600 text-white' },
  { value: 'sans_reponse', label: 'Sans réponse', cls: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400' },
]
const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.value, s]))
const FU_TYPES = [
  { value: 'demande', label: 'Demande' }, { value: 'relance', label: 'Relance' },
  { value: 'reponse', label: 'Réponse' }, { value: 'document', label: 'Document reçu' },
  { value: 'appel', label: 'Appel / WhatsApp' }, { value: 'autre', label: 'Autre' },
]
const FU_MAP = Object.fromEntries(FU_TYPES.map(o => [o.value, o.label]))

interface FollowUp { date: string; type: string; text: string }
interface Contact { name: string; role: string; email: string; phone: string }
interface Rec {
  id: string; company?: string | null; name?: string | null; contact_person?: string | null; eudr_contact?: string | null; email?: string | null
  relationship_status?: string | null; follow_ups?: FollowUp[] | null; contacts?: Contact[] | null
  next_action?: string | null; next_action_date?: string | null; owner?: string | null
}

const todayStr = () => { try { return new Date().toISOString().slice(0, 10) } catch { return '' } }
const fmt = (s?: string | null) => { if (!s) return '—'; const d = new Date(s); return isNaN(+d) ? s : d.toLocaleDateString('fr-FR') }

export default function EudrCrmPanel({ orgId, canWrite, suppliers = [], buyers = [], onChanged }: {
  orgId: string; canWrite: boolean; suppliers?: Rec[]; buyers?: Rec[]; onChanged: () => void
}) {
  void orgId
  const [kind, setKind] = useState<'suppliers' | 'buyers'>('suppliers')
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [stageFilter, setStageFilter] = useState('')
  const [editing, setEditing] = useState<Rec | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const records = kind === 'suppliers' ? suppliers : buyers
  const nameOf = (r: Rec) => (kind === 'suppliers' ? r.company : r.name) || '(sans nom)'
  const contactOf = (r: Rec) => (kind === 'suppliers' ? r.contact_person : r.eudr_contact) || (r.contacts?.[0]?.name) || '—'
  const lastFu = (r: Rec) => (r.follow_ups ?? []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]

  const today = todayStr()
  const tasks = useMemo(() => {
    const withAction = records.filter(r => r.next_action_date || r.next_action)
    const overdue = withAction.filter(r => r.next_action_date && r.next_action_date < today)
    const soon = withAction.filter(r => r.next_action_date && r.next_action_date >= today && r.next_action_date <= addDays(today, 7))
    const nodate = withAction.filter(r => !r.next_action_date && r.next_action)
    return { overdue, soon, nodate }
  }, [records, today])

  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    records.forEach(r => { const s = r.relationship_status || 'nouveau'; m[s] = (m[s] ?? 0) + 1 })
    return m
  }, [records])

  const filtered = stageFilter ? records.filter(r => (r.relationship_status || 'nouveau') === stageFilter) : records

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

  async function completeTask(r: Rec) {
    const fu = [...(r.follow_ups ?? [])]
    if (r.next_action) fu.unshift({ date: today, type: 'autre', text: `Action réalisée : ${r.next_action}` })
    await patch(r.id, { next_action: '', next_action_date: null, follow_ups: fu })
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {(['suppliers', 'buyers'] as const).map(k => (
            <button key={k} onClick={() => { setKind(k); setStageFilter('') }}
              className={`px-3 py-1.5 text-sm ${kind === k ? 'bg-green-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
              {k === 'suppliers' ? '🌱 Fournisseurs' : '🏢 Acheteurs'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {(['list', 'kanban'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm ${view === v ? 'bg-gray-800 dark:bg-gray-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
                {v === 'list' ? '≣ Liste' : '▤ Kanban'}
              </button>
            ))}
          </div>
          <span className={hint}>{records.length} relation(s)</span>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-2 text-sm text-red-700 dark:text-red-400">{error}</div>}

      {/* Relances à traiter */}
      {(tasks.overdue.length > 0 || tasks.soon.length > 0 || tasks.nodate.length > 0) && (
        <div className={card}>
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">📌 Relances à traiter</h3>
          <div className="space-y-1.5">
            {[...tasks.overdue.map(r => ({ r, kind: 'overdue' as const })), ...tasks.soon.map(r => ({ r, kind: 'soon' as const })), ...tasks.nodate.map(r => ({ r, kind: 'nodate' as const }))].map(({ r, kind: k }) => (
              <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-gray-800 dark:text-gray-200">{nameOf(r)}</span>
                  <span className="text-gray-500 dark:text-gray-400"> — {r.next_action || 'Relance'}</span>
                  <span className={`ml-2 text-xs ${k === 'overdue' ? 'text-red-600 dark:text-red-400 font-medium' : k === 'soon' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>
                    {r.next_action_date ? `${k === 'overdue' ? '⚠ en retard · ' : 'échéance '}${fmt(r.next_action_date)}` : 'sans échéance'}
                  </span>
                </div>
                {canWrite && (
                  <span className="flex gap-2 shrink-0">
                    <button className={btnG} onClick={() => setEditing(r)}>Ouvrir</button>
                    <button className={btnG} onClick={() => completeTask(r)} disabled={busy}>✓ Fait</button>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'list' && (<>
      {/* Pipeline */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setStageFilter('')} className={`text-xs px-2.5 py-1 rounded-full border ${!stageFilter ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>Tous ({records.length})</button>
        {STAGES.filter(s => counts[s.value]).map(s => (
          <button key={s.value} onClick={() => setStageFilter(stageFilter === s.value ? '' : s.value)}
            className={`text-xs px-2.5 py-1 rounded-full ${stageFilter === s.value ? 'ring-2 ring-green-400 ' : ''}${s.cls}`}>
            {s.label} ({counts[s.value]})
          </button>
        ))}
      </div>

      {/* Table */}
      <div className={card + ' !p-0 overflow-x-auto'}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="px-3 py-2 min-w-[160px]">Relation</th>
              <th className="px-3 py-2 min-w-[150px]">Statut</th>
              <th className="px-3 py-2">Contact</th>
              <th className="px-3 py-2">Dernier échange</th>
              <th className="px-3 py-2 min-w-[180px]">Prochaine action</th>
              <th className="px-3 py-2">Responsable</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const fu = lastFu(r)
              const overdue = r.next_action_date && r.next_action_date < today
              return (
                <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800 align-top">
                  <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{nameOf(r)}</td>
                  <td className="px-3 py-2">
                    {canWrite ? (
                      <select className={`${input} text-xs py-1`} value={r.relationship_status || 'nouveau'} onChange={e => patch(r.id, { relationship_status: e.target.value })} disabled={busy}>
                        {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    ) : <span className={`text-xs px-2 py-0.5 rounded-full ${STAGE_MAP[r.relationship_status || 'nouveau']?.cls}`}>{STAGE_MAP[r.relationship_status || 'nouveau']?.label}</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{contactOf(r)}</td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs">{fu ? `${fmt(fu.date)} · ${FU_MAP[fu.type] ?? fu.type}` : '—'}</td>
                  <td className="px-3 py-2 text-xs">
                    {r.next_action ? <span className={overdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-700 dark:text-gray-300'}>{r.next_action}{r.next_action_date ? ` · ${fmt(r.next_action_date)}` : ''}{overdue ? ' ⚠' : ''}</span> : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300 text-xs">{r.owner || '—'}</td>
                  <td className="px-3 py-2 text-right"><button className={btnG} onClick={() => setEditing(r)}>{canWrite ? 'Gérer' : 'Voir'}</button></td>
                </tr>
              )
            })}
            {filtered.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400 text-sm">Aucune relation.</td></tr>}
          </tbody>
        </table>
      </div>
      </>)}

      {/* Vue Kanban (glisser-déposer une carte pour changer de statut) */}
      {view === 'kanban' && (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max">
            {STAGES.map(s => {
              const col = records.filter(r => (r.relationship_status || 'nouveau') === s.value)
              return (
                <div key={s.value} className="w-64 shrink-0 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700"
                  onDragOver={e => { if (canWrite && dragId) e.preventDefault() }}
                  onDrop={() => { if (canWrite && dragId) { const r = records.find(x => x.id === dragId); if (r && (r.relationship_status || 'nouveau') !== s.value) patch(dragId, { relationship_status: s.value }); setDragId(null) } }}>
                  <div className={`px-3 py-2 rounded-t-xl text-xs font-semibold flex items-center justify-between ${s.cls}`}>
                    <span>{s.label}</span><span>{col.length}</span>
                  </div>
                  <div className="p-2 space-y-2 min-h-[60px]">
                    {col.map(r => {
                      const fu = lastFu(r)
                      const overdue = r.next_action_date && r.next_action_date < today
                      return (
                        <div key={r.id} draggable={canWrite} onDragStart={() => setDragId(r.id)} onDragEnd={() => setDragId(null)}
                          onClick={() => setEditing(r)}
                          className={`rounded-lg border bg-white dark:bg-gray-800 p-2 text-xs cursor-pointer hover:shadow ${dragId === r.id ? 'opacity-50' : ''} border-gray-200 dark:border-gray-700`}>
                          <p className="font-medium text-gray-900 dark:text-white truncate">{nameOf(r)}</p>
                          {r.next_action && <p className={`mt-0.5 ${overdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>📌 {r.next_action}{r.next_action_date ? ` · ${fmt(r.next_action_date)}` : ''}{overdue ? ' ⚠' : ''}</p>}
                          <p className="mt-0.5 text-gray-400">{r.owner ? `👤 ${r.owner}` : ''}{fu ? `${r.owner ? ' · ' : ''}${fmt(fu.date)}` : ''}</p>
                        </div>
                      )
                    })}
                    {col.length === 0 && <p className="text-[11px] text-gray-300 dark:text-gray-600 text-center py-2">—</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {editing && <CrmDrawer record={editing} nameOf={nameOf} canWrite={canWrite} busy={busy}
        onClose={() => setEditing(null)} onSave={async (body) => { await patch(editing.id, body); setEditing(null) }} />}
    </div>
  )
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10)
}

// ── Drawer d'édition d'une relation ──────────────────────────────────────────
function CrmDrawer({ record, nameOf, canWrite, busy, onClose, onSave }: {
  record: Rec; nameOf: (r: Rec) => string; canWrite: boolean; busy: boolean
  onClose: () => void; onSave: (body: Record<string, unknown>) => void
}) {
  const [stage, setStage] = useState(record.relationship_status || 'nouveau')
  const [owner, setOwner] = useState(record.owner || '')
  const [nextAction, setNextAction] = useState(record.next_action || '')
  const [nextDate, setNextDate] = useState(record.next_action_date || '')
  const [contacts, setContacts] = useState<Contact[]>(record.contacts ?? [])
  const [fups, setFups] = useState<FollowUp[]>(record.follow_ups ?? [])
  const ro = !canWrite

  const addContact = () => setContacts([...contacts, { name: '', role: '', email: '', phone: '' }])
  const updContact = (i: number, p: Partial<Contact>) => setContacts(contacts.map((c, idx) => idx === i ? { ...c, ...p } : c))
  const addFu = () => setFups([{ date: todayStr(), type: 'relance', text: '' }, ...fups])
  const updFu = (i: number, p: Partial<FollowUp>) => setFups(fups.map((f, idx) => idx === i ? { ...f, ...p } : f))
  const sortedFu = fups.map((f, i) => ({ f, i })).sort((a, b) => (b.f.date || '').localeCompare(a.f.date || ''))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-bold text-gray-900 dark:text-white">🤝 {nameOf(record)}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={label}>Statut</label>
              <select className={input} value={stage} onChange={e => setStage(e.target.value)} disabled={ro}>
                {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div><label className={label}>Responsable</label><input className={input} value={owner} onChange={e => setOwner(e.target.value)} disabled={ro} placeholder="Qui suit ce dossier" /></div>
            <div><label className={label}>Échéance prochaine action</label><input type="date" className={input} value={nextDate} onChange={e => setNextDate(e.target.value)} disabled={ro} /></div>
          </div>
          <div><label className={label}>Prochaine action (relance à faire)</label><input className={input} value={nextAction} onChange={e => setNextAction(e.target.value)} disabled={ro} placeholder="ex. Relancer par téléphone pour le GeoJSON" /></div>

          {/* Contacts */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
            <div className="flex items-center justify-between"><span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Contacts</span>{!ro && <button className="text-xs text-green-600 dark:text-green-400 hover:underline" onClick={addContact}>+ Ajouter</button>}</div>
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
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
            <div className="flex items-center justify-between"><span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Journal des échanges</span>{!ro && <button className="text-xs text-green-600 dark:text-green-400 hover:underline" onClick={addFu}>+ Ajouter</button>}</div>
            {fups.length === 0 ? <p className={hint}>Aucun échange.</p> : sortedFu.map(({ f, i }) => (
              <div key={i} className="flex flex-wrap items-start gap-2">
                <input type="date" className={`${input} w-36`} value={f.date || ''} onChange={e => updFu(i, { date: e.target.value })} disabled={ro} />
                <select className={`${input} w-40`} value={f.type || 'relance'} onChange={e => updFu(i, { type: e.target.value })} disabled={ro}>{FU_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                <input className={`${input} flex-1 min-w-[150px]`} value={f.text || ''} onChange={e => updFu(i, { text: e.target.value })} placeholder="Détail…" disabled={ro} />
                {!ro && <button className="text-gray-400 hover:text-red-500 mt-2" onClick={() => setFups(fups.filter((_, idx) => idx !== i))}>✕</button>}
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">Fermer</button>
          {canWrite && <button onClick={() => onSave({ relationship_status: stage, owner, next_action: nextAction, next_action_date: nextDate || null, contacts, follow_ups: fups })} disabled={busy} className={btnP}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>}
        </div>
      </div>
    </div>
  )
}

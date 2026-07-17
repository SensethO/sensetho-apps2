'use client'

import { useState } from 'react'

// Journal des échanges façon « timeline » : les entrées s'affichent en lecture
// (une ligne compacte : date · type coloré · texte) et l'ajout / la modification
// se fait via un petit composer (texte en grand + type en pastilles + date).
// Bien plus lisible que 3 champs éditables empilés par entrée.

export interface JFollowUp { date: string; type: string; text: string }

const TYPES = [
  { v: 'demande', l: 'Demande', dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  { v: 'relance', l: 'Relance', dot: 'bg-indigo-500', badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
  { v: 'reponse', l: 'Réponse', dot: 'bg-teal-500', badge: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' },
  { v: 'document', l: 'Document reçu', dot: 'bg-green-500', badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  { v: 'appel', l: 'Appel / WhatsApp', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  { v: 'autre', l: 'Autre', dot: 'bg-gray-400', badge: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
]
const TMAP = Object.fromEntries(TYPES.map(t => [t.v, t]))

const inp = 'rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500'
const today = () => { try { return new Date().toISOString().slice(0, 10) } catch { return '' } }
const fmt = (s?: string) => { if (!s) return '—'; const d = new Date(s); return isNaN(+d) ? s : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) }

function Composer({ initial, onSubmit, onCancel }: { initial?: JFollowUp; onSubmit: (f: JFollowUp) => void; onCancel: () => void }) {
  const [text, setText] = useState(initial?.text ?? '')
  const [type, setType] = useState(initial?.type ?? 'relance')
  const [date, setDate] = useState(initial?.date ?? today())
  const submit = () => { if (text.trim()) onSubmit({ date: date || today(), type, text: text.trim() }) }
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-2.5 space-y-2">
      <textarea autoFocus rows={2} className={`${inp} w-full resize-none`} value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit() } }}
        placeholder="Qu’avez-vous échangé ? (ex. Relance par email — documents manquants)" />
      <div className="flex flex-wrap items-center gap-1.5">
        {TYPES.map(t => (
          <button key={t.v} type="button" onClick={() => setType(t.v)}
            className={`text-[11px] px-2 py-1 rounded-full transition-colors ${type === t.v ? t.badge + ' ring-1 ring-current' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {t.l}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input type="date" className={`${inp} w-40`} value={date} onChange={e => setDate(e.target.value)} />
        <div className="flex-1" />
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Annuler</button>
        <button type="button" onClick={submit} disabled={!text.trim()}
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-40">
          {initial ? 'Enregistrer' : 'Ajouter'}
        </button>
      </div>
    </div>
  )
}

export default function FollowUpJournal({ items, onChange, readOnly = false }: {
  items: JFollowUp[]; onChange: (v: JFollowUp[]) => void; readOnly?: boolean
}) {
  const [adding, setAdding] = useState(false)
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const sorted = items.map((it, i) => ({ it, i })).sort((a, b) => (b.it.date || '').localeCompare(a.it.date || ''))

  const add = (f: JFollowUp) => { onChange([f, ...items]); setAdding(false) }
  const save = (i: number, f: JFollowUp) => { onChange(items.map((it, idx) => idx === i ? f : it)); setEditIdx(null) }
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">🕑 Journal des échanges</span>
        {!readOnly && !adding && <button type="button" onClick={() => { setAdding(true); setEditIdx(null) }} className="text-xs text-green-600 dark:text-green-400 hover:underline">+ Ajouter un échange</button>}
      </div>

      {adding && <Composer onSubmit={add} onCancel={() => setAdding(false)} />}

      {sorted.length === 0 && !adding ? (
        <p className="text-xs text-gray-400 dark:text-gray-500">Aucun échange enregistré.</p>
      ) : (
        <div className="space-y-0">
          {sorted.map(({ it, i }, pos) => {
            const t = TMAP[it.type] ?? TMAP.autre
            const last = pos === sorted.length - 1
            if (editIdx === i) return <div key={i} className="pb-2"><Composer initial={it} onSubmit={f => save(i, f)} onCancel={() => setEditIdx(null)} /></div>
            return (
              <div key={i} className="group flex gap-2.5">
                <div className="flex flex-col items-center pt-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${t.dot}`} />
                  {!last && <span className="w-px flex-1 bg-gray-200 dark:bg-gray-700 mt-1" />}
                </div>
                <div className="flex-1 pb-3 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{fmt(it.date)}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${t.badge}`}>{t.l}</span>
                    {!readOnly && (
                      <span className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => { setEditIdx(i); setAdding(false) }} className="text-gray-400 hover:text-green-600" title="Modifier">✎</button>
                        <button type="button" onClick={() => remove(i)} className="text-gray-400 hover:text-red-500" title="Supprimer">✕</button>
                      </span>
                    )}
                  </div>
                  {it.text && <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 whitespace-pre-wrap break-words">{it.text}</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'
import clsx from 'clsx'
import type { AppQuote, QuoteStatus, PricingType } from '@/types'

const STATUS_CONFIG: Record<QuoteStatus, { label: string; color: string; next: QuoteStatus[] }> = {
  pending:    { label: 'En attente',   color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',   next: ['processing', 'rejected'] },
  processing: { label: 'En cours',     color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',       next: ['accepted', 'rejected'] },
  accepted:   { label: 'Accepté',      color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',   next: [] },
  rejected:   { label: 'Refusé',       color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',           next: [] },
}

interface QuoteRow extends AppQuote {
  app?: { name: string; slug: string; icon: string; pricing_type: PricingType }
  profile?: { email: string; full_name: string | null }
}

export default function QuotesManager() {
  const [quotes, setQuotes] = useState<QuoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<QuoteStatus | 'all'>('pending')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editNotes, setEditNotes] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const supabase = createClient()

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('app_quotes')
      .select('*, app:apps(name, slug, icon, pricing_type), profile:profiles(email, full_name)')
      .order('created_at', { ascending: false })
    setQuotes((data ?? []) as QuoteRow[])
    setLoading(false)
  }

  async function updateStatus(id: string, status: QuoteStatus) {
    setSaving(id)
    await supabase.from('app_quotes').update({ status }).eq('id', id)
    setQuotes(prev => prev.map(q => q.id === id ? { ...q, status } : q))
    setSaving(null)
  }

  async function saveNotes(id: string) {
    setSaving(id)
    const notes = editNotes[id] ?? ''
    await supabase.from('app_quotes').update({ admin_notes: notes }).eq('id', id)
    setQuotes(prev => prev.map(q => q.id === id ? { ...q, admin_notes: notes } : q))
    setSaving(null)
  }

  const filtered = filterStatus === 'all' ? quotes : quotes.filter(q => q.status === filterStatus)

  const counts: Record<QuoteStatus | 'all', number> = {
    all: quotes.length,
    pending: quotes.filter(q => q.status === 'pending').length,
    processing: quotes.filter(q => q.status === 'processing').length,
    accepted: quotes.filter(q => q.status === 'accepted').length,
    rejected: quotes.filter(q => q.status === 'rejected').length,
  }

  if (loading) return <div className="text-gray-400 text-sm">Chargement…</div>

  return (
    <div className="space-y-4">
      {/* Tabs de statut */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-slate-700">
        {(['pending', 'processing', 'accepted', 'rejected', 'all'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={clsx('flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              filterStatus === s
                ? 'border-gray-900 dark:border-slate-300 text-gray-900 dark:text-slate-100'
                : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200')}>
            {s === 'all' ? 'Tous' : STATUS_CONFIG[s].label}
            {counts[s] > 0 && (
              <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                s === 'pending' ? 'bg-amber-500 text-white' : 'bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-slate-300')}>
                {counts[s]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Liste des devis */}
      <div className="space-y-3">
        {filtered.map(quote => {
          const isOpen = expanded === quote.id
          const cfg = STATUS_CONFIG[quote.status]

          return (
            <div key={quote.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
              {/* En-tête */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <Icon name={quote.app?.icon ?? 'app'} size={18} className="text-gray-500 dark:text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-gray-900 dark:text-slate-100">{quote.app?.name ?? '—'}</span>
                    <span className={clsx('text-[11px] px-2 py-0.5 rounded-full font-medium', cfg.color)}>{cfg.label}</span>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    {quote.profile?.full_name ?? quote.email}
                    {quote.company && ` · ${quote.company}`}
                    {quote.users_count && ` · ${quote.users_count} utilisateurs`}
                    {' · '}{new Date(quote.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>

                {/* Actions de statut */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {cfg.next.map(next => (
                    <button key={next} disabled={saving === quote.id}
                      onClick={() => updateStatus(quote.id, next)}
                      className={clsx('text-xs px-2.5 py-1 rounded-lg font-medium transition-colors disabled:opacity-50',
                        next === 'accepted' ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                          : next === 'rejected' ? 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400')}>
                      {next === 'accepted' ? 'Accepter' : next === 'rejected' ? 'Refuser' : 'Traiter'}
                    </button>
                  ))}
                  <button onClick={() => setExpanded(isOpen ? null : quote.id)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400">
                    <Icon name={isOpen ? 'chevronDown' : 'chevronRight'} size={14} />
                  </button>
                </div>
              </div>

              {/* Détails expandés */}
              {isOpen && (
                <div className="border-t border-gray-100 dark:border-slate-700 px-4 py-4 space-y-4">
                  {/* Contact */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mb-0.5">Email</p>
                      <p className="text-gray-900 dark:text-slate-100">{quote.email}</p>
                    </div>
                    {quote.company && (
                      <div>
                        <p className="text-xs text-gray-400 dark:text-slate-500 mb-0.5">Entreprise</p>
                        <p className="text-gray-900 dark:text-slate-100">{quote.company}</p>
                      </div>
                    )}
                    {quote.users_count && (
                      <div>
                        <p className="text-xs text-gray-400 dark:text-slate-500 mb-0.5">Nb utilisateurs</p>
                        <p className="text-gray-900 dark:text-slate-100">{quote.users_count}</p>
                      </div>
                    )}
                  </div>

                  {/* Message */}
                  {quote.message && (
                    <div>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Message</p>
                      <p className="text-sm text-gray-700 dark:text-slate-300 bg-gray-50 dark:bg-slate-700 rounded-lg p-3">{quote.message}</p>
                    </div>
                  )}

                  {/* Notes admin */}
                  <div>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Notes internes</p>
                    <textarea rows={3}
                      value={editNotes[quote.id] ?? (quote.admin_notes ?? '')}
                      onChange={e => setEditNotes(n => ({ ...n, [quote.id]: e.target.value }))}
                      placeholder="Notes pour l'équipe…"
                      className="w-full border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
                    <button onClick={() => saveNotes(quote.id)} disabled={saving === quote.id}
                      className="mt-1.5 text-xs px-3 py-1.5 bg-gray-900 dark:bg-slate-600 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">
                      {saving === quote.id ? 'Enregistrement…' : 'Sauvegarder les notes'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 dark:text-slate-500 text-sm">
            Aucune demande de devis dans cette catégorie.
          </div>
        )}
      </div>
    </div>
  )
}

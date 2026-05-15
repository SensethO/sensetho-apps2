'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Icon from '@/components/ui/Icon'
import clsx from 'clsx'
import type { Ticket, TicketStatus } from '@/types'

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Ouvert',
  in_progress: 'En cours',
  closed: 'Fermé',
}
const STATUS_COLORS: Record<TicketStatus, string> = {
  open: 'bg-red-100 text-red-700',
  in_progress: 'bg-amber-100 text-amber-700',
  closed: 'bg-green-100 text-green-700',
}
const TYPE_LABELS: Record<string, string> = {
  support: 'Support',
  password_reset: 'Réinitialisation MDP',
  forgot_password: 'Mot de passe oublié',
}
const TYPE_COLORS: Record<string, string> = {
  support: 'bg-blue-100 text-blue-700',
  password_reset: 'bg-purple-100 text-purple-700',
  forgot_password: 'bg-orange-100 text-orange-700',
}

type FilterTab = 'all' | TicketStatus

export default function TicketsManager() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const supabase = createClient()

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('tickets')
      .select('*, profile:profiles(email, full_name)')
      .order('created_at', { ascending: false })
    setTickets((data ?? []) as Ticket[])
    setLoading(false)
  }

  async function updateStatus(id: string, status: TicketStatus) {
    setUpdatingId(id)
    await supabase.from('tickets').update({
      status,
      resolved_at: status === 'closed' ? new Date().toISOString() : null,
    }).eq('id', id)
    setTickets(prev => prev.map(t => t.id === id
      ? { ...t, status, resolved_at: status === 'closed' ? new Date().toISOString() : null }
      : t
    ))
    setUpdatingId(null)
  }

  const TABS: { id: FilterTab; label: string }[] = [
    { id: 'all', label: 'Tous' },
    { id: 'open', label: 'Ouverts' },
    { id: 'in_progress', label: 'En cours' },
    { id: 'closed', label: 'Fermés' },
  ]

  const filtered = filter === 'all' ? tickets : tickets.filter(t => t.status === filter)
  const openCount = tickets.filter(t => t.status === 'open').length

  if (loading) return <div className="text-gray-400 text-sm">Chargement…</div>

  return (
    <div className="space-y-4">
      {/* Résumé */}
      <div className="grid grid-cols-3 gap-3">
        {(['open', 'in_progress', 'closed'] as TicketStatus[]).map(s => (
          <div key={s} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
            <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-1">{STATUS_LABELS[s]}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              {tickets.filter(t => t.status === s).length}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs filtre */}
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setFilter(t.id)}
            className={clsx('px-3 py-1.5 rounded-md text-sm font-medium transition-colors', {
              'bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-100 shadow-sm': filter === t.id,
              'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200': filter !== t.id,
            })}>
            {t.label}
            {t.id === 'open' && openCount > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5">{openCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Liste tickets */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-slate-500">
          <Icon name="ticket" size={32} className="mx-auto mb-3 opacity-40" />
          <p>Aucun ticket dans cette catégorie</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(ticket => (
            <div key={ticket.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
              <div className="flex items-start gap-3 px-4 py-3">
                {/* Type badge */}
                <span className={`mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${TYPE_COLORS[ticket.type]}`}>
                  {TYPE_LABELS[ticket.type]}
                </span>

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm text-gray-900 dark:text-slate-100">{ticket.subject}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                        {ticket.profile?.full_name ?? ticket.profile?.email ?? ticket.email ?? 'Anonyme'}
                        {' · '}
                        {new Date(ticket.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[ticket.status]}`}>
                        {STATUS_LABELS[ticket.status]}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setExpanded(expanded === ticket.id ? null : ticket.id)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 transition-colors"
                    title="Voir le message">
                    <Icon name={expanded === ticket.id ? 'chevronDown' : 'chevronRight'} size={14} />
                  </button>
                </div>
              </div>

              {/* Détail + actions statut */}
              {expanded === ticket.id && (
                <div className="px-4 pb-4 border-t border-gray-100 dark:border-slate-700 pt-3 space-y-3">
                  {ticket.message && (
                    <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-3">
                      <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{ticket.message}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 dark:text-slate-500 mr-2">Changer le statut :</span>
                    {(['open', 'in_progress', 'closed'] as TicketStatus[]).map(s => (
                      <button key={s}
                        onClick={() => updateStatus(ticket.id, s)}
                        disabled={ticket.status === s || updatingId === ticket.id}
                        className={clsx(
                          'text-xs px-2.5 py-1 rounded-full font-medium transition-all',
                          ticket.status === s
                            ? `${STATUS_COLORS[s]} opacity-100 cursor-default`
                            : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-200 disabled:opacity-50'
                        )}>
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

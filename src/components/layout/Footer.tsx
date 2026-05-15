'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'

export default function Footer() {
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true); setError('')
    const res = await fetch('/api/tickets/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, message, type: 'support' }),
    })
    setSending(false)
    if (res.ok) { setSent(true) }
    else { setError('Erreur lors de l\'envoi. Veuillez réessayer.') }
  }

  function close() {
    setOpen(false); setSent(false); setSubject(''); setMessage(''); setError('')
  }

  return (
    <>
      {/* Footer bar */}
      <footer className="flex-shrink-0 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-2.5 flex items-center justify-between text-xs text-gray-400 dark:text-slate-500">
        <div className="flex items-center gap-3">
          <span>© 2025 Sensetho™</span>
          <span className="text-gray-300 dark:text-slate-600">·</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-full font-medium text-[10px]">
            Version Bêta
          </span>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
        >
          <Icon name="ticket" size={13} />
          Créer un ticket support
        </button>
      </footer>

      {/* Modal ticket */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700 w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Icon name="ticket" size={18} className="text-gray-600 dark:text-slate-400" />
                <h2 className="font-semibold text-gray-900 dark:text-slate-100">Créer un ticket support</h2>
              </div>
              <button onClick={close} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400">
                <Icon name="x" size={18} />
              </button>
            </div>

            {sent ? (
              <div className="text-center py-8 space-y-3">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                  <Icon name="check" size={22} className="text-green-600 dark:text-green-400" />
                </div>
                <p className="font-medium text-gray-900 dark:text-slate-100">Ticket envoyé !</p>
                <p className="text-sm text-gray-500 dark:text-slate-400">Un administrateur traitera votre demande prochainement.</p>
                <button onClick={close}
                  className="mt-2 px-4 py-2 bg-gray-900 dark:bg-slate-600 text-white rounded-lg text-sm font-medium">
                  Fermer
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Sujet <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    required
                    placeholder="Décrivez brièvement votre demande"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Message</label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={4}
                    placeholder="Détails supplémentaires…"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={close}
                    className="flex-1 px-4 py-2 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                    Annuler
                  </button>
                  <button type="submit" disabled={sending || !subject.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 dark:bg-slate-600 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
                    <Icon name="send" size={14} />
                    {sending ? 'Envoi…' : 'Envoyer'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}

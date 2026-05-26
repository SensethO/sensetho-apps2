'use client'

import { useEffect, useState, useCallback } from 'react'

interface UserRow {
  id: string
  email: string
  full_name: string | null
  role: 'user' | 'admin'
  status: 'pending' | 'active' | 'suspended'
  created_at: string
  must_change_password: boolean
}

type TabStatus = 'pending' | 'active' | 'suspended'

const TAB_LABELS: Record<TabStatus, string> = {
  pending: '⏳ En attente',
  active: '✅ Actifs',
  suspended: '🚫 Suspendus',
}

const EMPTY_MESSAGES: Record<TabStatus, string> = {
  pending: '🎉 Aucune inscription en attente de validation.',
  active: 'Aucun utilisateur actif.',
  suspended: 'Aucun compte suspendu.',
}

function getInitials(fullName: string | null, email: string): string {
  if (fullName && fullName.trim()) {
    const parts = fullName.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return parts[0].slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(dateStr))
}

export default function UsersManager() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabStatus>('pending')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      const json = await res.json()
      setUsers(json.data ?? [])
    } catch {
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  async function patchUser(id: string, status: 'active' | 'suspended') {
    setProcessingId(id)
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        await loadUsers()
        showToast(
          status === 'active' ? 'Utilisateur approuvé / réactivé avec succès.' : 'Compte suspendu.'
        )
      }
    } finally {
      setProcessingId(null)
    }
  }

  async function handleApprove(user: UserRow) {
    await patchUser(user.id, 'active')
  }

  async function handleReject(user: UserRow) {
    if (!window.confirm(`Refuser l'inscription de ${user.email} ? Son compte sera suspendu.`)) return
    await patchUser(user.id, 'suspended')
  }

  async function handleSuspend(user: UserRow) {
    if (!window.confirm(`Suspendre le compte de ${user.email} ?`)) return
    await patchUser(user.id, 'suspended')
  }

  async function handleReactivate(user: UserRow) {
    await patchUser(user.id, 'active')
  }

  const counts: Record<TabStatus, number> = {
    pending: users.filter(u => u.status === 'pending').length,
    active: users.filter(u => u.status === 'active').length,
    suspended: users.filter(u => u.status === 'suspended').length,
  }

  const filteredUsers = users.filter(u => u.status === activeTab)

  return (
    <div className="space-y-4 relative">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-lg transition-all">
          {toast}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {(Object.keys(TAB_LABELS) as TabStatus[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2',
              activeTab === tab
                ? 'border border-b-0 bg-[var(--bg-card)] text-[var(--text)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]',
            ].join(' ')}
            style={
              activeTab === tab
                ? { borderColor: 'var(--border)', marginBottom: '-1px' }
                : {}
            }
          >
            {TAB_LABELS[tab]}
            <span
              className={[
                'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold',
                tab === 'pending'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                  : tab === 'active'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400',
              ].join(' ')}
            >
              {counts[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <svg
            className="animate-spin h-8 w-8 text-[var(--text-muted)]"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div
          className="rounded-xl border px-6 py-12 text-center text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)' }}
        >
          {EMPTY_MESSAGES[activeTab]}
        </div>
      ) : (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}
              >
                <th className="px-4 py-3 text-left">Utilisateur</th>
                <th className="px-4 py-3 text-left">Rôle</th>
                <th className="px-4 py-3 text-left">Inscrit le</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ '--tw-divide-opacity': '1' } as React.CSSProperties}>
              {filteredUsers.map(user => (
                <tr
                  key={user.id}
                  className={[
                    'transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]',
                    user.status === 'pending' ? 'border-l-2 border-amber-400' : '',
                  ].join(' ')}
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  {/* Utilisateur */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-bold select-none">
                        {getInitials(user.full_name, user.email)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium" style={{ color: 'var(--text)' }}>
                            {user.full_name || '—'}
                          </span>
                          {user.status === 'pending' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                              En attente
                            </span>
                          )}
                        </div>
                        <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Rôle */}
                  <td className="px-4 py-3">
                    <span
                      className={[
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                        user.role === 'admin'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400',
                      ].join(' ')}
                    >
                      {user.role === 'admin' ? 'Admin' : 'Utilisateur'}
                    </span>
                  </td>

                  {/* Inscrit le */}
                  <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                    {formatDate(user.created_at)}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2 flex-wrap">
                      {user.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(user)}
                            disabled={processingId === user.id}
                            className="px-3 py-1 text-xs font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            ✓ Approuver
                          </button>
                          <button
                            onClick={() => handleReject(user)}
                            disabled={processingId === user.id}
                            className="px-3 py-1 text-xs font-medium rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            ✗ Rejeter
                          </button>
                        </>
                      )}
                      {user.status === 'active' && user.role !== 'admin' && (
                        <button
                          onClick={() => handleSuspend(user)}
                          disabled={processingId === user.id}
                          className="px-3 py-1 text-xs font-medium rounded-lg border border-orange-300 text-orange-600 hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Suspendre
                        </button>
                      )}
                      {user.status === 'suspended' && (
                        <button
                          onClick={() => handleReactivate(user)}
                          disabled={processingId === user.id}
                          className="px-3 py-1 text-xs font-medium rounded-lg border border-emerald-300 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Réactiver
                        </button>
                      )}
                      {processingId === user.id && (
                        <svg
                          className="animate-spin h-4 w-4 text-[var(--text-muted)]"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import ConfirmModal from '@/components/ui/ConfirmModal'

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

// ─── Modal édition utilisateur ────────────────────────────────────────────────

interface EditModalProps {
  user: UserRow
  onClose: () => void
  onSaved: () => void
  onToast: (msg: string) => void
}

function EditModal({ user, onClose, onSaved, onToast }: EditModalProps) {
  const [fullName, setFullName]         = useState(user.full_name ?? '')
  const [email, setEmail]               = useState(user.email)
  const [saving, setSaving]             = useState(false)
  const [resetting, setResetting]       = useState(false)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [copied, setCopied]             = useState(false)
  const [resetPending, setResetPending] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          email: email !== user.email ? email : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) { onToast(`Erreur : ${json.error}`); return }
      onToast('Profil mis à jour.')
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleResetPassword() {
    setResetting(true)
    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })
      const json = await res.json()
      if (!res.ok) { onToast(`Erreur : ${json.error}`); return }
      setTempPassword(json.tempPassword)
      onSaved() // refresh la liste (must_change_password = true)
    } finally {
      setResetting(false)
    }
  }

  function copyPassword() {
    if (!tempPassword) return
    navigator.clipboard.writeText(tempPassword).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-xl shadow-2xl p-6 space-y-5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
            Modifier l&apos;utilisateur
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Prénom + Nom */}
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
            Prénom et Nom
          </label>
          <input
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Ex : Jean Dupont"
            className="w-full rounded-lg px-3 py-2 text-sm border outline-none focus:ring-2 focus:ring-indigo-500"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
            Adresse e-mail
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm border outline-none focus:ring-2 focus:ring-indigo-500"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          />
          {email !== user.email && (
            <p className="text-xs mt-1 text-amber-500">
              ⚠️ Le changement d&apos;email est immédiat et confirmé automatiquement.
            </p>
          )}
        </div>

        {/* Bouton Sauvegarder */}
        <button
          onClick={handleSave}
          disabled={saving || (!fullName.trim() && email === user.email)}
          className="w-full py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
        </button>

        {/* Séparateur */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" style={{ borderColor: 'var(--border)' }} />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
              Sécurité
            </span>
          </div>
        </div>

        {/* Reset mot de passe */}
        {!tempPassword ? (
          <div>
            <button
              onClick={() => setResetPending(true)}
              disabled={resetting}
              className="w-full py-2 rounded-lg text-sm font-medium border transition-colors"
              style={{
                border: '1px solid var(--border)',
                color: 'var(--text)',
                background: 'transparent',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {resetting ? '🔄 Génération…' : '🔑 Réinitialiser le mot de passe'}
            </button>
            <p className="text-xs mt-1 text-center" style={{ color: 'var(--text-muted)' }}>
              Un mot de passe temporaire sera généré. L&apos;utilisateur devra le changer à la prochaine connexion.
            </p>
          </div>
        ) : (
          <div
            className="rounded-lg p-4 space-y-3"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
          >
            <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>
              ✅ Mot de passe temporaire généré
            </p>
            <div className="flex items-center gap-2">
              <code
                className="flex-1 rounded px-3 py-2 text-sm font-mono tracking-wider select-all"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}
              >
                {tempPassword}
              </code>
              <button
                onClick={copyPassword}
                className="px-3 py-2 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
                style={{
                  background: copied ? 'rgb(16 185 129)' : 'var(--bg-card)',
                  color: copied ? 'white' : 'var(--text)',
                  border: '1px solid var(--border)',
                }}
              >
                {copied ? '✓ Copié !' : '📋 Copier'}
              </button>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Copiez ce mot de passe et transmettez-le à l&apos;utilisateur. Il lui sera demandé de le changer à la prochaine connexion.
            </p>
          </div>
        )}
      </div>

      {/* Confirmation génération mot de passe temporaire */}
      <ConfirmModal
        open={resetPending}
        title="Générer un mot de passe temporaire ?"
        message={`Un mot de passe temporaire sera généré pour ${user.email}. L'utilisateur devra le changer à la prochaine connexion.`}
        confirmLabel="Générer"
        onConfirm={() => { setResetPending(false); handleResetPassword() }}
        onCancel={() => setResetPending(false)}
      />
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function UsersManager() {
  const [users, setUsers]           = useState<UserRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [activeTab, setActiveTab]   = useState<TabStatus>('pending')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [toast, setToast]           = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const [actionPending, setActionPending] = useState<{ user: UserRow; action: 'refuse' | 'suspend' } | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
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

  useEffect(() => { loadUsers() }, [loadUsers])

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
        showToast(status === 'active' ? '✅ Compte approuvé / réactivé.' : '🚫 Compte suspendu.')
      }
    } finally {
      setProcessingId(null)
    }
  }

  async function handleApprove(user: UserRow) { await patchUser(user.id, 'active') }
  function handleReject(user: UserRow) { setActionPending({ user, action: 'refuse' }) }
  function handleSuspend(user: UserRow) { setActionPending({ user, action: 'suspend' }) }
  async function handleReactivate(user: UserRow) { await patchUser(user.id, 'active') }

  const counts: Record<TabStatus, number> = {
    pending:   users.filter(u => u.status === 'pending').length,
    active:    users.filter(u => u.status === 'active').length,
    suspended: users.filter(u => u.status === 'suspended').length,
  }
  const filteredUsers = users.filter(u => u.status === activeTab)

  return (
    <div className="space-y-4 relative">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {/* Modal édition */}
      {editingUser && (
        <EditModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={loadUsers}
          onToast={showToast}
        />
      )}

      {/* Note validation */}
      <div
        className="rounded-lg px-4 py-3 text-sm flex items-start gap-2"
        style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: 'var(--text)' }}
      >
        <span className="text-amber-400 mt-0.5 flex-shrink-0">ⓘ</span>
        <span>
          Tout nouveau compte est en <strong>attente de validation</strong> avant de pouvoir accéder aux applications.
          Un administrateur doit approuver le compte avant l&apos;attribution de tout droit.
        </span>
      </div>

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
            style={activeTab === tab ? { borderColor: 'var(--border)', marginBottom: '-1px' } : {}}
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
          <svg className="animate-spin h-8 w-8 text-[var(--text-muted)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
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
                  className="transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                  style={{
                    borderBottom: '1px solid var(--border)',
                    borderLeft: user.status === 'pending' ? '3px solid rgb(251,191,36)' : undefined,
                  }}
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
                          {user.must_change_password && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                              🔑 MDP temp.
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

                      {/* Bouton Modifier (toujours visible) */}
                      <button
                        onClick={() => setEditingUser(user)}
                        className="px-3 py-1 text-xs font-medium rounded-lg border transition-colors"
                        style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
                        title="Modifier nom, email ou réinitialiser le mot de passe"
                      >
                        ✏️ Modifier
                      </button>

                      {/* Actions de statut */}
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
                        <svg className="animate-spin h-4 w-4 text-[var(--text-muted)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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

      {/* Confirmation refus / suspension */}
      <ConfirmModal
        open={!!actionPending}
        title={actionPending?.action === 'refuse' ? "Refuser l'inscription ?" : 'Suspendre le compte ?'}
        message={
          actionPending?.action === 'refuse'
            ? `Refuser l'inscription de ${actionPending.user.email} ? Son compte sera suspendu.`
            : actionPending ? `Suspendre le compte de ${actionPending.user.email} ?` : undefined
        }
        confirmLabel={actionPending?.action === 'refuse' ? 'Refuser' : 'Suspendre'}
        onConfirm={() => {
          if (actionPending) patchUser(actionPending.user.id, 'suspended')
          setActionPending(null)
        }}
        onCancel={() => setActionPending(null)}
      />
    </div>
  )
}

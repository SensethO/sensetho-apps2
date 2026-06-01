'use client'

import { useState, useEffect } from 'react'

interface ShareEntry {
  id: string
  permission: 'view' | 'edit'
  shared_with_user_id: string
  profiles: { email: string; full_name: string | null } | null
}

interface Props {
  boardId: string
  boardTitle: string
  onClose: () => void
}

export default function ShareBoardModal({ boardId, boardTitle, onClose }: Props) {
  const [shares, setShares]     = useState<ShareEntry[]>([])
  const [email, setEmail]       = useState('')
  const [permission, setPerm]   = useState<'view' | 'edit'>('view')
  const [saving, setSaving]     = useState(false)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [copied, setCopied]     = useState(false)

  // URL partageable (accès direct au board)
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/business/board/${boardId}`
    : ''

  useEffect(() => {
    fetch(`/api/boards/${boardId}/shares`)
      .then(r => r.json())
      .then(d => setShares(d.data ?? []))
      .finally(() => setLoading(false))
  }, [boardId])

  async function addShare() {
    if (!email.trim()) return
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/boards/${boardId}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), permission }),
      })
      const j = await res.json()
      if (!res.ok) { setError(j.error ?? 'Erreur'); return }
      setShares(prev => [...prev.filter(s => s.shared_with_user_id !== j.data.shared_with_user_id), j.data])
      setEmail('')
    } finally { setSaving(false) }
  }

  async function removeShare(shareId: string) {
    await fetch(`/api/boards/${boardId}/shares?share_id=${shareId}`, { method: 'DELETE' })
    setShares(prev => prev.filter(s => s.id !== shareId))
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}>
      <div className="rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="font-bold text-base">👥 Partager le tableau</h2>
            <p className="text-xs mt-0.5 truncate max-w-[280px]" style={{ color: 'var(--text-muted)' }}>
              {boardTitle}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-lg"
            style={{ color: 'var(--text-muted)' }}>✕</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Lien direct */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
              🔗 Lien direct
            </p>
            <div className="flex gap-2">
              <input readOnly value={shareUrl}
                className="flex-1 text-xs px-3 py-2 rounded-lg border truncate"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
              <button onClick={copyLink}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ${
                  copied ? 'bg-emerald-600 text-white' : 'border hover:border-indigo-400'
                }`}
                style={!copied ? { borderColor: 'var(--border)', color: 'var(--text)' } : {}}>
                {copied ? '✓ Copié !' : '📋 Copier'}
              </button>
            </div>
            <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
              ⚠️ Ce lien est accessible uniquement aux utilisateurs qui ont un compte et l&apos;accès.
            </p>
          </div>

          {/* Inviter par email */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
              ✉️ Inviter un utilisateur
            </p>
            <div className="flex gap-2">
              <input
                value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addShare() }}
                placeholder="prenom.nom@example.com"
                className="flex-1 text-sm px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
              <select value={permission} onChange={e => setPerm(e.target.value as 'view' | 'edit')}
                className="text-sm px-2 py-2 rounded-lg border focus:outline-none"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                <option value="view">👁️ Lecture</option>
                <option value="edit">✏️ Édition</option>
              </select>
            </div>
            {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
            <button onClick={addShare} disabled={saving || !email.trim()}
              className="mt-2 w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
              {saving ? 'Envoi en cours…' : '+ Partager'}
            </button>
          </div>

          {/* Liste des accès */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
              👤 Accès ({loading ? '…' : shares.length})
            </p>
            {loading && <div className="text-center py-3 text-xs animate-pulse" style={{ color: 'var(--text-muted)' }}>Chargement…</div>}
            {!loading && shares.length === 0 && (
              <p className="text-xs text-center py-3" style={{ color: 'var(--text-muted)' }}>
                Aucun partage — invitez des collaborateurs via leur email.
              </p>
            )}
            <div className="space-y-2">
              {shares.map(s => (
                <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}>
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {(s.profiles?.full_name ?? s.profiles?.email ?? '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                      {s.profiles?.full_name ?? s.profiles?.email ?? 'Utilisateur inconnu'}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {s.profiles?.email}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                    s.permission === 'edit'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {s.permission === 'edit' ? '✏️ Édition' : '👁️ Lecture'}
                  </span>
                  <button onClick={() => removeShare(s.id)}
                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-xs">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

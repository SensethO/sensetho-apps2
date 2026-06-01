'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface ShareEntry {
  id: string
  permission: 'view' | 'edit'
  shared_with_user_id: string
  profiles: { email: string; full_name: string | null } | null
}

interface UserResult {
  id: string
  email: string
  full_name: string | null
  role: string
}

interface Props {
  boardId: string
  boardTitle: string
  onClose: () => void
}

function initials(u: UserResult) {
  const name = u.full_name ?? u.email
  return name.slice(0, 2).toUpperCase()
}

function avatarColor(id: string) {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#22c55e', '#3b82f6']
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export default function ShareBoardModal({ boardId, boardTitle, onClose }: Props) {
  const [shares, setShares]       = useState<ShareEntry[]>([])
  const [permission, setPerm]     = useState<'view' | 'edit'>('view')
  const [saving, setSaving]       = useState(false)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [copied, setCopied]       = useState(false)

  // Autocomplete
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState<UserResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected]   = useState<UserResult | null>(null)
  const [showDropdown, setShowDrop] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef    = useRef<HTMLInputElement>(null)

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/business/board/${boardId}`
    : ''

  // Charger les partages existants
  useEffect(() => {
    fetch(`/api/boards/${boardId}/shares`)
      .then(r => r.json())
      .then(d => setShares(d.data ?? []))
      .catch(e => setError('Erreur chargement : ' + String(e)))
      .finally(() => setLoading(false))
  }, [boardId])

  // Recherche autocomplete avec debounce 300ms
  const searchUsers = useCallback((q: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (q.length < 2) { setResults([]); setShowDrop(false); return }
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const r = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`)
        const d = await r.json()
        const alreadyShared = new Set(shares.map(s => s.shared_with_user_id))
        setResults((d.data ?? []).filter((u: UserResult) => !alreadyShared.has(u.id)))
        setShowDrop(true)
      } catch { setResults([]) }
      finally { setSearching(false) }
    }, 300)
  }, [shares])

  function handleQueryChange(val: string) {
    setQuery(val)
    setSelected(null) // reset selection si l'utilisateur retape
    searchUsers(val)
  }

  function selectUser(u: UserResult) {
    setSelected(u)
    setQuery(u.full_name ?? u.email)
    setResults([])
    setShowDrop(false)
    inputRef.current?.blur()
  }

  async function addShare() {
    if (!selected) { setError('Sélectionnez un utilisateur dans la liste'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/boards/${boardId}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: selected.email, permission }),
      })
      const j = await res.json()
      if (!res.ok) {
        setError(j.error ?? `Erreur ${res.status}`)
        return
      }
      // Ajouter à la liste locale
      setShares(prev => [
        ...prev.filter(s => s.shared_with_user_id !== j.data.shared_with_user_id),
        { ...j.data, profiles: { email: selected.email, full_name: selected.full_name } },
      ])
      setSelected(null)
      setQuery('')
    } catch (e) {
      setError('Erreur réseau : ' + String(e))
    } finally {
      setSaving(false)
    }
  }

  async function removeShare(shareId: string) {
    const res = await fetch(`/api/boards/${boardId}/shares?share_id=${shareId}`, { method: 'DELETE' })
    if (res.ok) setShares(prev => prev.filter(s => s.id !== shareId))
    else setError('Erreur lors de la révocation')
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
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="font-bold text-base flex items-center gap-2">👥 Partager le tableau</h2>
            <p className="text-xs mt-0.5 truncate max-w-[300px]" style={{ color: 'var(--text-muted)' }}>{boardTitle}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
          </div>

          {/* Inviter — autocomplete */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
              ✉️ Inviter un utilisateur
            </p>

            {/* Champ de recherche */}
            <div className="relative">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={e => handleQueryChange(e.target.value)}
                    onFocus={() => { if (results.length > 0) setShowDrop(true) }}
                    onBlur={() => setTimeout(() => setShowDrop(false), 200)}
                    placeholder="Rechercher par nom, prénom ou email…"
                    autoComplete="off"
                    className="w-full text-sm px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-8"
                    style={{ backgroundColor: 'var(--bg)', borderColor: selected ? '#6366f1' : 'var(--border)', color: 'var(--text)' }}
                  />
                  {/* Indicateur de chargement / sélection */}
                  <div className="absolute right-2.5 top-2.5">
                    {searching ? (
                      <span className="text-xs text-gray-400 animate-spin inline-block">⟳</span>
                    ) : selected ? (
                      <span className="text-xs text-indigo-500">✓</span>
                    ) : query.length >= 2 ? (
                      <span className="text-xs text-gray-400">🔍</span>
                    ) : null}
                  </div>
                </div>
                <select value={permission} onChange={e => setPerm(e.target.value as 'view' | 'edit')}
                  className="text-sm px-2 py-2 rounded-lg border focus:outline-none flex-shrink-0"
                  style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                  <option value="view">👁️ Lecture</option>
                  <option value="edit">✏️ Édition</option>
                </select>
              </div>

              {/* Dropdown résultats */}
              {showDropdown && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-xl overflow-hidden z-10"
                  style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                  {results.map(u => (
                    <button key={u.id} onMouseDown={() => selectUser(u)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: avatarColor(u.id) }}>
                        {initials(u)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                          {u.full_name ?? u.email}
                        </p>
                        <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                          {u.email}
                          {u.role === 'admin' && <span className="ml-1 text-amber-500 font-bold">· Admin</span>}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Aucun résultat */}
              {showDropdown && !searching && results.length === 0 && query.length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-xl px-4 py-3 z-10"
                  style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucun utilisateur trouvé pour &quot;{query}&quot;</p>
                </div>
              )}
            </div>

            {/* Info de l'utilisateur sélectionné */}
            {selected && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                  style={{ backgroundColor: avatarColor(selected.id) }}>
                  {initials(selected)}
                </div>
                <span className="text-xs text-indigo-700 dark:text-indigo-300 flex-1 truncate">
                  {selected.full_name ?? selected.email} — {selected.email}
                </span>
                <button onClick={() => { setSelected(null); setQuery('') }}
                  className="text-xs text-indigo-400 hover:text-indigo-600 flex-shrink-0">✕</button>
              </div>
            )}

            {/* Erreur */}
            {error && (
              <div className="mt-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Bouton Partager */}
            <button onClick={addShare}
              disabled={saving || !selected}
              className="mt-3 w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {saving
                ? <><span className="animate-spin">⟳</span> Envoi en cours…</>
                : selected
                  ? <>👥 Partager avec {selected.full_name ?? selected.email.split('@')[0]}</>
                  : '👥 Sélectionnez un utilisateur ci-dessus'
              }
            </button>
          </div>

          {/* Accès existants */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
              Accès ({loading ? '…' : shares.length})
            </p>
            {loading && <p className="text-xs text-center py-3 animate-pulse" style={{ color: 'var(--text-muted)' }}>Chargement…</p>}
            {!loading && shares.length === 0 && (
              <p className="text-xs text-center py-3" style={{ color: 'var(--text-muted)' }}>
                Aucun partage actif — invitez des collaborateurs ci-dessus.
              </p>
            )}
            <div className="space-y-2">
              {shares.map(s => (
                <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: avatarColor(s.shared_with_user_id) }}>
                    {(s.profiles?.full_name ?? s.profiles?.email ?? '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                      {s.profiles?.full_name ?? s.profiles?.email ?? 'Utilisateur'}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{s.profiles?.email}</p>
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

'use client'

import { useState, useEffect, useRef } from 'react'

interface UserHit { id: string; email: string; full_name: string | null }

/**
 * Champ de recherche d'utilisateurs avec autocomplétion (nom, prénom, email).
 * Interroge /api/users/search. `value` = email retenu ; `onChange` reçoit l'email.
 * Réutilisable par toutes les modales de partage des apps RSE.
 */
export default function ShareAutocomplete({
  value, onChange, onEnter, inputClassName,
}: {
  value: string
  onChange: (email: string) => void
  onEnter?: () => void
  inputClassName?: string
}) {
  const [results, setResults] = useState<UserHit[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  // Recherche debouncée
  useEffect(() => {
    const q = value.trim()
    if (q.length < 2) { setResults([]); return }
    let cancel = false
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`)
        const { data } = await res.json()
        if (!cancel) { setResults(data ?? []); setOpen(true) }
      } catch {
        if (!cancel) setResults([])
      } finally {
        if (!cancel) setLoading(false)
      }
    }, 250)
    return () => { cancel = true; clearTimeout(t) }
  }, [value])

  // Fermeture au clic extérieur
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div className="relative" ref={boxRef}>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => { if (results.length) setOpen(true) }}
        onKeyDown={e => { if (e.key === 'Enter') { setOpen(false); onEnter?.() } }}
        placeholder="Nom, prénom ou email…"
        className={inputClassName}
        autoComplete="off"
      />
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 animate-pulse">…</span>
      )}
      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg max-h-56 overflow-auto">
          {results.map(u => (
            <button
              key={u.id}
              type="button"
              onClick={() => { onChange(u.email); setResults([]); setOpen(false) }}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="block text-sm text-gray-800 dark:text-gray-100">{u.full_name || u.email}</span>
              {u.full_name && <span className="block text-xs text-gray-400">{u.email}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

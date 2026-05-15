'use client'

import { useState, useRef, useEffect } from 'react'
import clsx from 'clsx'
import Icon from '@/components/ui/Icon'
import type { Organisation, OrganisationSearchResult } from '@/types/organisation'

interface OrganisationsSidebarProps {
  organisations: Organisation[]
  selected: Organisation | null
  onSelect: (org: Organisation) => void
  onSave: (result: OrganisationSearchResult) => Promise<Organisation | null>
  onSaveManual: (denomination: string, siren?: string) => Promise<Organisation | null>
  onRemove: (id: string) => void
  loading?: boolean
}

export default function OrganisationsSidebar({
  organisations, selected, onSelect, onSave, onSaveManual, onRemove, loading
}: OrganisationsSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OrganisationSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [manualName, setManualName] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 2) { setResults([]); return }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/organisations/search?q=${encodeURIComponent(query)}&per_page=8`)
        const data = await res.json()
        const savedSirens = new Set(organisations.map(o => o.siren).filter(Boolean))
        setResults((data.results ?? []).map((r: OrganisationSearchResult) => ({
          ...r,
          already_saved: r.siren ? savedSirens.has(r.siren) : false,
        })))
      } catch { setResults([]) }
      setSearching(false)
    }, 350)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, organisations])

  async function handleSelect(result: OrganisationSearchResult) {
    if (result.already_saved) {
      const existing = organisations.find(o => o.siren === result.siren)
      if (existing) { onSelect(existing); closeSearch(); return }
    }
    setSaving(true)
    const org = await onSave(result)
    setSaving(false)
    if (org) { onSelect(org); closeSearch() }
  }

  async function handleManual() {
    if (!manualName.trim()) return
    setSaving(true)
    const org = await onSaveManual(manualName.trim())
    setSaving(false)
    if (org) { onSelect(org); setManualName(''); setShowManual(false); setShowSearch(false) }
  }

  function closeSearch() {
    setShowSearch(false); setQuery(''); setResults([]); setShowManual(false); setManualName('')
  }

  function openSearch() {
    setShowSearch(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const primoDir = (org: Organisation) => {
    const d = org.dirigeants?.[0]
    if (!d) return null
    return d.type_dirigeant === 'personne_morale'
      ? d.denomination
      : `${d.prenoms ?? ''} ${d.nom}`.trim()
  }

  return (
    <aside className={clsx(
      'flex flex-col flex-shrink-0 border-r transition-all duration-200 overflow-hidden',
      collapsed ? 'w-10' : 'w-64'
    )} style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border)' }}>

      {/* Header */}
      <div className={clsx('flex items-center gap-2 px-3 py-3 border-b flex-shrink-0', collapsed && 'justify-center')}
        style={{ borderColor: 'var(--border)' }}>
        {!collapsed && (
          <span className="text-xs font-semibold uppercase tracking-wider flex-1" style={{ color: 'var(--text-subtle)' }}>
            Organisations
          </span>
        )}
        <button onClick={() => setCollapsed(v => !v)}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 flex-shrink-0"
          title={collapsed ? 'Déplier' : 'Replier'}
          style={{ color: 'var(--text-muted)' }}>
          <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={14} />
        </button>
      </div>

      {!collapsed && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Bouton + Nouvelle organisation */}
          {!showSearch ? (
            <div className="p-2 flex-shrink-0">
              <button onClick={openSearch}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border border-dashed text-xs font-medium transition-colors hover:bg-gray-50 dark:hover:bg-slate-700"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                <Icon name="plus" size={13} />
                Nouvelle organisation
              </button>
            </div>
          ) : (
            /* Zone de recherche DATA.GOUV */
            <div className="p-2 flex-shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-xs font-medium flex-1" style={{ color: 'var(--text)' }}>Rechercher</span>
                <button onClick={closeSearch} className="p-0.5 rounded hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
                  <Icon name="x" size={13} />
                </button>
              </div>

              {/* Input recherche */}
              <div className="relative mb-1">
                <Icon name="search" size={13} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Raison sociale, SIRET, SIREN…"
                  className="w-full pl-7 pr-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-900 dark:focus:ring-slate-400"
                  style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
              </div>

              {/* Résultats */}
              {searching && (
                <p className="text-[10px] text-center py-2" style={{ color: 'var(--text-muted)' }}>Recherche…</p>
              )}
              {!searching && results.length > 0 && (
                <div className="max-h-52 overflow-y-auto rounded-lg border divide-y" style={{ borderColor: 'var(--border)' }}>
                  {results.map((r, i) => (
                    <button key={i} onClick={() => handleSelect(r)} disabled={saving}
                      className="w-full text-left px-2.5 py-2 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium truncate flex-1" style={{ color: 'var(--text)' }}>
                          {r.nom_complet}
                        </span>
                        {r.already_saved && (
                          <span className="text-[9px] bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-1 py-0.5 rounded flex-shrink-0">En base</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {r.siren && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>SIREN {r.siren}</span>}
                        {r.ville && <span className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{r.ville}</span>}
                      </div>
                      {r.dirigeants?.[0] && (
                        <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {r.dirigeants[0].prenoms} {r.dirigeants[0].nom}
                          {r.dirigeants[0].qualite ? ` · ${r.dirigeants[0].qualite}` : ''}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {!searching && query.length >= 2 && results.length === 0 && (
                <p className="text-[10px] text-center py-1.5" style={{ color: 'var(--text-muted)' }}>Aucun résultat DATA.GOUV</p>
              )}

              {/* Saisie manuelle */}
              <button onClick={() => setShowManual(v => !v)}
                className="mt-1.5 text-[10px] underline hover:no-underline w-full text-center"
                style={{ color: 'var(--text-muted)' }}>
                {showManual ? 'Masquer la saisie manuelle' : 'Saisir manuellement'}
              </button>

              {showManual && (
                <div className="mt-1.5 flex gap-1">
                  <input
                    value={manualName}
                    onChange={e => setManualName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleManual()}
                    placeholder="Nom de l'organisation"
                    className="flex-1 px-2 py-1 text-xs border rounded focus:outline-none"
                    style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  />
                  <button onClick={handleManual} disabled={saving || !manualName.trim()}
                    className="px-2 py-1 text-xs bg-gray-900 dark:bg-slate-600 text-white rounded disabled:opacity-50">
                    Créer
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Liste des organisations */}
          {loading ? (
            <p className="text-[10px] text-center py-4" style={{ color: 'var(--text-muted)' }}>Chargement…</p>
          ) : (
            <div className="flex-1 overflow-y-auto py-1">
              {organisations.length === 0 && !showSearch && (
                <p className="text-[10px] text-center px-3 py-4" style={{ color: 'var(--text-muted)' }}>
                  Aucune organisation.<br />Ajoutez-en une via DATA.GOUV.
                </p>
              )}
              {organisations.map(org => (
                <div key={org.id} className="group relative">
                  <button
                    onClick={() => onSelect(org)}
                    className={clsx(
                      'w-full text-left px-3 py-2.5 transition-colors',
                      selected?.id === org.id
                        ? 'bg-gray-900 dark:bg-slate-600 text-white'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-700'
                    )}>
                    <p className={clsx('text-xs font-medium truncate', selected?.id === org.id ? 'text-white' : '')}
                      style={selected?.id !== org.id ? { color: 'var(--text)' } : undefined}>
                      {org.denomination}
                    </p>
                    {org.siren && (
                      <p className={clsx('text-[10px] truncate', selected?.id === org.id ? 'text-white/70' : '')}
                        style={selected?.id !== org.id ? { color: 'var(--text-muted)' } : undefined}>
                        {org.siren} {org.ville ? `· ${org.ville}` : ''}
                      </p>
                    )}
                    {primoDir(org) && (
                      <p className={clsx('text-[10px] truncate', selected?.id === org.id ? 'text-white/70' : '')}
                        style={selected?.id !== org.id ? { color: 'var(--text-muted)' } : undefined}>
                        {primoDir(org)}
                      </p>
                    )}
                  </button>
                  {/* Bouton supprimer (hover) */}
                  <button
                    onClick={() => { if (confirm('Supprimer cette organisation ?')) onRemove(org.id) }}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-0.5 rounded text-red-400 hover:text-red-600 transition-opacity">
                    <Icon name="trash" size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Vue compacte (collapsed) */}
      {collapsed && (
        <div className="flex-1 flex flex-col items-center py-2 gap-1 overflow-y-auto">
          {organisations.map(org => (
            <button key={org.id} onClick={() => { setCollapsed(false); onSelect(org) }}
              title={org.denomination}
              className={clsx(
                'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 transition-colors',
                selected?.id === org.id
                  ? 'bg-gray-900 dark:bg-slate-600 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600'
              )}
              style={selected?.id !== org.id ? { color: 'var(--text-muted)' } : undefined}>
              {org.denomination[0].toUpperCase()}
            </button>
          ))}
          <button onClick={() => setCollapsed(false)} title="Nouvelle organisation"
            className="w-7 h-7 rounded-full border border-dashed flex items-center justify-center flex-shrink-0 hover:bg-gray-50 dark:hover:bg-slate-700"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <Icon name="plus" size={12} />
          </button>
        </div>
      )}
    </aside>
  )
}

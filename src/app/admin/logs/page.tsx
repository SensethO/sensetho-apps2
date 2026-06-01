'use client'

import { useState, useEffect, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'

interface Log {
  id: string
  created_at: string
  path: string
  is_authenticated: boolean
  user_id: string | null
  user_name: string | null
  user_email: string | null
  device_type: string | null
  browser: string | null
  browser_version: string | null
  os: string | null
  screen: string | null
  ip: string | null
  referrer: string | null
  session_id: string | null
}

const DEVICE_ICONS: Record<string, string> = {
  desktop: '🖥️', mobile: '📱', tablet: '📟', bot: '🤖', unknown: '❓',
}
const DEVICE_COLORS: Record<string, string> = {
  desktop: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  mobile:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  tablet:  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  bot:     'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60)    return `${Math.floor(diff)}s`
  if (diff < 3600)  return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function LogsPage() {
  const [logs, setLogs]       = useState<Log[]>([])
  const [count, setCount]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [device, setDevice]   = useState('')
  const [auth, setAuth]       = useState('')
  const [from, setFrom]       = useState('')
  const [to, setTo]           = useState('')
  const [offset, setOffset]   = useState(0)
  const LIMIT = 50

  const load = useCallback(() => {
    setLoading(true)
    const p = new URLSearchParams()
    p.set('limit', String(LIMIT))
    p.set('offset', String(offset))
    if (search) p.set('search', search)
    if (device) p.set('device', device)
    if (auth)   p.set('auth', auth)
    if (from)   p.set('from', from)
    if (to)     p.set('to', to + 'T23:59:59')

    fetch(`/api/logs?${p}`)
      .then(r => r.json())
      .then(d => { setLogs(d.data ?? []); setCount(d.count ?? 0) })
      .finally(() => setLoading(false))
  }, [search, device, auth, from, to, offset])

  useEffect(() => { load() }, [load])

  // Stats rapides depuis les logs chargés
  const stats = {
    total:       count,
    authed:      logs.filter(l => l.is_authenticated).length,
    anonymous:   logs.filter(l => !l.is_authenticated).length,
    mobile:      logs.filter(l => l.device_type === 'mobile').length,
    desktop:     logs.filter(l => l.device_type === 'desktop').length,
    uniquePaths: new Set(logs.map(l => l.path)).size,
  }

  function clearFilters() {
    setSearch(''); setDevice(''); setAuth(''); setFrom(''); setTo('')
    setOffset(0)
  }

  const hasFilters = search || device || auth || from || to

  return (
    <AppShell>
      <div className="space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>📊 Logs de navigation</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Visiteurs publics et utilisateurs connectés — {count.toLocaleString('fr-FR')} entrées
            </p>
          </div>
          <button onClick={load}
            className="px-3 py-1.5 rounded-lg border text-sm transition-colors hover:border-indigo-400"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            🔄 Actualiser
          </button>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total', value: count, icon: '📋', color: 'text-gray-700 dark:text-gray-300' },
            { label: 'Connectés', value: stats.authed, icon: '🔐', color: 'text-indigo-600 dark:text-indigo-400' },
            { label: 'Anonymes', value: stats.anonymous, icon: '👤', color: 'text-gray-500 dark:text-gray-400' },
            { label: 'Pages uniques', value: stats.uniquePaths, icon: '📄', color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Mobile', value: stats.mobile, icon: '📱', color: 'text-orange-600 dark:text-orange-400' },
            { label: 'Desktop', value: stats.desktop, icon: '🖥️', color: 'text-blue-600 dark:text-blue-400' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border p-3 text-center"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="text-xl">{s.icon}</div>
              <div className={`text-lg font-bold mt-0.5 ${s.color}`}>{s.value.toLocaleString('fr-FR')}</div>
              <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filtres */}
        <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>
                🔍 Recherche (nom, email, page)
              </label>
              <input value={search} onChange={e => { setSearch(e.target.value); setOffset(0) }}
                placeholder="sylvain, /dashboard, @sensetho…"
                className="w-full text-sm px-3 py-1.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Appareil</label>
              <select value={device} onChange={e => { setDevice(e.target.value); setOffset(0) }}
                className="text-sm px-3 py-1.5 rounded-lg border focus:outline-none"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                <option value="">Tous</option>
                <option value="desktop">🖥️ Desktop</option>
                <option value="mobile">📱 Mobile</option>
                <option value="tablet">📟 Tablette</option>
                <option value="bot">🤖 Bot</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Statut</label>
              <select value={auth} onChange={e => { setAuth(e.target.value); setOffset(0) }}
                className="text-sm px-3 py-1.5 rounded-lg border focus:outline-none"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                <option value="">Tous</option>
                <option value="true">🔐 Connectés</option>
                <option value="false">👤 Anonymes</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Du</label>
              <input type="date" value={from} onChange={e => { setFrom(e.target.value); setOffset(0) }}
                className="text-sm px-3 py-1.5 rounded-lg border focus:outline-none"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Au</label>
              <input type="date" value={to} onChange={e => { setTo(e.target.value); setOffset(0) }}
                className="text-sm px-3 py-1.5 rounded-lg border focus:outline-none"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            </div>
            {hasFilters && (
              <button onClick={clearFilters}
                className="text-xs px-3 py-1.5 rounded-lg border text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                style={{ borderColor: 'var(--border)' }}>
                ✕ Réinitialiser
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
              <div className="text-4xl mb-3">📭</div>
              <p>Aucun log trouvé</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}>
                    {['Horodatage', 'Utilisateur', 'Page', 'Appareil', 'Navigateur', 'OS', 'Écran', 'IP'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                        style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                      {/* Horodatage */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                          {timeAgo(log.created_at)}
                        </div>
                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {new Date(log.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </td>

                      {/* Utilisateur */}
                      <td className="px-4 py-3">
                        {log.is_authenticated ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                              {(log.user_name ?? log.user_email ?? 'U')[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-medium truncate max-w-[140px]" style={{ color: 'var(--text)' }}>
                                {log.user_name ?? 'Sans nom'}
                              </div>
                              <div className="text-[10px] truncate max-w-[140px]" style={{ color: 'var(--text-muted)' }}>
                                {log.user_email}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                            👤 Anonyme
                          </span>
                        )}
                      </td>

                      {/* Page */}
                      <td className="px-4 py-3 max-w-[200px]">
                        <div className="text-xs truncate font-mono" title={log.path} style={{ color: 'var(--text)' }}>
                          {log.path}
                        </div>
                        {log.referrer && (
                          <div className="text-[10px] truncate max-w-[180px]" style={{ color: 'var(--text-muted)' }}
                            title={log.referrer}>
                            ← {log.referrer.replace(/^https?:\/\//, '')}
                          </div>
                        )}
                      </td>

                      {/* Appareil */}
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${DEVICE_COLORS[log.device_type ?? 'unknown'] ?? DEVICE_COLORS.unknown}`}>
                          {DEVICE_ICONS[log.device_type ?? 'unknown']} {log.device_type ?? '?'}
                        </span>
                      </td>

                      {/* Navigateur */}
                      <td className="px-4 py-3">
                        <div className="text-xs" style={{ color: 'var(--text)' }}>
                          {log.browser ?? '—'}
                          {log.browser_version && <span className="text-[10px] ml-1" style={{ color: 'var(--text-muted)' }}>v{log.browser_version}</span>}
                        </div>
                      </td>

                      {/* OS */}
                      <td className="px-4 py-3">
                        <div className="text-xs whitespace-nowrap" style={{ color: 'var(--text)' }}>
                          {log.os ?? '—'}
                        </div>
                      </td>

                      {/* Écran */}
                      <td className="px-4 py-3">
                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {log.screen ?? '—'}
                        </div>
                      </td>

                      {/* IP */}
                      <td className="px-4 py-3">
                        <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                          {log.ip ?? '—'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {count > LIMIT && (
          <div className="flex items-center justify-between text-sm" style={{ color: 'var(--text-muted)' }}>
            <span>{offset + 1}–{Math.min(offset + LIMIT, count)} sur {count.toLocaleString('fr-FR')}</span>
            <div className="flex gap-2">
              <button onClick={() => setOffset(Math.max(0, offset - LIMIT))} disabled={offset === 0}
                className="px-3 py-1.5 rounded-lg border disabled:opacity-40 hover:border-indigo-400 transition-colors"
                style={{ borderColor: 'var(--border)' }}>← Précédent</button>
              <button onClick={() => setOffset(offset + LIMIT)} disabled={offset + LIMIT >= count}
                className="px-3 py-1.5 rounded-lg border disabled:opacity-40 hover:border-indigo-400 transition-colors"
                style={{ borderColor: 'var(--border)' }}>Suivant →</button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}

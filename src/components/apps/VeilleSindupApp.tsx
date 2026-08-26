'use client'

// App « Veille stratégique (Sindup) » — la veille du compte Sindup de
// l'utilisateur remonte dans la plateforme via les flux RSS exportés depuis
// Sindup (dossiers / recherches → Partager/Exporter → Flux RSS). Un connecteur
// API (offres entreprise Sindup) est préparé : clé chiffrée par organisation,
// client à brancher dès que la documentation API sera disponible.
//
// API : /api/veille-sindup (sources, collect, mentions, stats, credentials)

import { useState, useEffect, useCallback, useRef } from 'react'
import type { RseContext } from '@/components/rse/RseAppShell'

// ── Types (contrat API) ───────────────────────────────────────────────────────
interface Source {
  id: string
  type: 'rss' | 'api'
  label: string
  url: string
  actif: boolean
  last_fetch_at: string | null
  last_status: string | null
  last_error: string | null
}

interface Mention {
  id: string
  source_id: string
  guid: string
  titre: string
  url: string
  extrait: string | null
  auteur: string | null
  published_at: string | null
  image_url: string | null
  lu: boolean
  favori: boolean
}

interface Stats {
  total: number
  non_lues: number
  favoris: number
  par_jour: { date: string; n: number }[]
  par_source: { source_id: string; label: string; n: number }[]
}

type TabKey = 'fil' | 'dashboard' | 'sources' | 'api'
const TABS: { key: TabKey; label: string }[] = [
  { key: 'fil', label: '📰 Fil de veille' },
  { key: 'dashboard', label: '📊 Tableau de bord' },
  { key: 'sources', label: '🔗 Sources' },
  { key: 'api', label: '⚙️ Connexion API' },
]

const PAGE_SIZE = 50
type Periode = '7' | '30' | '90' | 'tout'

// ── Utilitaires ───────────────────────────────────────────────────────────────
function formatDateFr(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTimeFr(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function truncateUrl(url: string, max = 56): string {
  const clean = url.replace(/^https?:\/\//, '')
  return clean.length > max ? clean.slice(0, max) + '…' : clean
}

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

/** Tolère { sources: [...] } ou tableau direct. */
function parseSources(j: unknown): Source[] {
  if (Array.isArray(j)) return j as Source[]
  if (j && typeof j === 'object' && Array.isArray((j as { sources?: unknown }).sources)) {
    return (j as { sources: Source[] }).sources
  }
  return []
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function VeilleSindupApp({ ctx }: { ctx: RseContext }) {
  const orgId = ctx.org?.id ?? null
  const readOnly = ctx.isShared // lecture seule : pas d'ajout, de suppression ni de collecte

  const [tab, setTab] = useState<TabKey>('fil')
  const [error, setError] = useState<string | null>(null)

  // Sources
  const [sources, setSources] = useState<Source[]>([])
  const [sourcesLoaded, setSourcesLoaded] = useState(false)

  // Mentions + filtres
  const [mentions, setMentions] = useState<Mention[]>([])
  const [total, setTotal] = useState(0)
  const [loadingMentions, setLoadingMentions] = useState(false)
  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [periode, setPeriode] = useState<Periode>('30')
  const [nonLues, setNonLues] = useState(false)
  const [favoris, setFavoris] = useState(false)
  const [page, setPage] = useState(1)

  // Collecte
  const [collecting, setCollecting] = useState(false)
  const [collectInfo, setCollectInfo] = useState<string | null>(null)

  // Stats (tableau de bord)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  // Recherche : debounce 400 ms
  useEffect(() => {
    const t = setTimeout(() => { setQDebounced(q); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [q])

  // ── Chargements ──
  const loadSources = useCallback(async () => {
    if (!orgId) return
    try {
      const res = await fetch(`/api/veille-sindup/sources?organisation_id=${orgId}`)
      const j = await res.json()
      if (!res.ok) throw new Error((j as { error?: string }).error ?? 'Erreur de chargement des sources')
      setSources(parseSources(j))
    } catch (e) { setError(String((e as Error).message ?? e)) }
    finally { setSourcesLoaded(true) }
  }, [orgId])

  const loadMentions = useCallback(async () => {
    if (!orgId) return
    setLoadingMentions(true); setError(null)
    try {
      const params = new URLSearchParams({ organisation_id: orgId, page: String(page) })
      if (qDebounced.trim()) params.set('q', qDebounced.trim())
      if (filterSource) params.set('source_id', filterSource)
      if (nonLues) params.set('lus', 'false')
      if (favoris) params.set('favoris', 'true')
      if (periode !== 'tout') params.set('from', isoDaysAgo(Number(periode)))
      const res = await fetch(`/api/veille-sindup/mentions?${params.toString()}`)
      const j = await res.json()
      if (!res.ok) throw new Error((j as { error?: string }).error ?? 'Erreur de chargement des mentions')
      setMentions(Array.isArray(j.mentions) ? j.mentions : [])
      setTotal(typeof j.total === 'number' ? j.total : 0)
    } catch (e) { setError(String((e as Error).message ?? e)) }
    finally { setLoadingMentions(false) }
  }, [orgId, page, qDebounced, filterSource, nonLues, favoris, periode])

  const loadStats = useCallback(async () => {
    if (!orgId) return
    setLoadingStats(true)
    try {
      const res = await fetch(`/api/veille-sindup/stats?organisation_id=${orgId}`)
      const j = await res.json()
      if (res.ok) setStats(j as Stats)
    } catch { /* silencieux : le fil reste utilisable */ }
    finally { setLoadingStats(false) }
  }, [orgId])

  useEffect(() => { loadSources() }, [loadSources])
  useEffect(() => { loadMentions() }, [loadMentions])
  useEffect(() => { if (tab === 'dashboard') loadStats() }, [tab, loadStats])

  // ── Collecte ──
  const collectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleCollect = useCallback(async () => {
    if (!orgId || readOnly) return
    setCollecting(true); setError(null); setCollectInfo(null)
    try {
      const res = await fetch(`/api/veille-sindup/collect`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organisation_id: orgId }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((j as { error?: string }).error ?? 'Erreur de collecte')
      const n = typeof j.collected === 'number' ? j.collected : 0
      const errs = Array.isArray(j.perSource) ? (j.perSource as { error?: string | null }[]).filter(p => p.error).length : 0
      setCollectInfo(
        (n > 0 ? `+${n} nouvelle${n > 1 ? 's' : ''} mention${n > 1 ? 's' : ''}` : 'Aucune nouvelle mention') +
        (errs > 0 ? ` · ${errs} source${errs > 1 ? 's' : ''} en erreur` : '')
      )
      if (collectTimer.current) clearTimeout(collectTimer.current)
      collectTimer.current = setTimeout(() => setCollectInfo(null), 6000)
      await Promise.all([loadMentions(), loadSources()])
      if (tab === 'dashboard') await loadStats()
    } catch (e) { setError(String((e as Error).message ?? e)) }
    finally { setCollecting(false) }
  }, [orgId, readOnly, loadMentions, loadSources, loadStats, tab])

  useEffect(() => () => { if (collectTimer.current) clearTimeout(collectTimer.current) }, [])

  // ── Actions header ──
  useEffect(() => {
    if (!orgId) { ctx.setActions(null); return }
    ctx.setActions(
      <div className="flex items-center gap-2">
        <a href="https://app.sindup.com" target="_blank" rel="noopener noreferrer"
          className="px-3 py-1.5 text-sm rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
          Ouvrir Sindup ↗
        </a>
        {!readOnly && (
          <button onClick={handleCollect} disabled={collecting}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50">
            {collecting ? 'Collecte…' : '🔄 Actualiser'}
          </button>
        )}
      </div>
    )
    return () => ctx.setActions(null)
  }, [orgId, readOnly, collecting, handleCollect, ctx])

  // ── Mutations mentions ──
  async function patchMention(id: string, patch: { lu?: boolean; favori?: boolean }) {
    // Optimiste : on met à jour tout de suite, on recharge en cas d'échec.
    setMentions(prev => prev.map(m => (m.id === id ? { ...m, ...patch } : m)))
    try {
      const res = await fetch(`/api/veille-sindup/mentions`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      })
      if (!res.ok) await loadMentions()
    } catch { await loadMentions() }
  }

  if (!orgId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md" style={{ color: 'var(--text-muted)' }}>
          <div className="text-5xl mb-3">📡</div>
          <p className="text-sm">Sélectionnez une organisation dans la barre latérale pour consulter sa veille stratégique.</p>
        </div>
      </div>
    )
  }

  const activeSources = sources.filter(s => s.actif)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* En-tête */}
      <div className="flex items-center gap-2">
        <span className="text-2xl">📡</span>
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Veille stratégique — Sindup</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {ctx.org?.denomination}{readOnly ? ' · lecture seule (dossier partagé)' : ''}
          </p>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 border-b overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm whitespace-nowrap transition-colors ${tab === t.key
              ? 'text-indigo-700 dark:text-indigo-400 font-semibold border-b-2 border-indigo-500'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}
      {collectInfo && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-2 text-xs text-emerald-700 dark:text-emerald-400">
          {collectInfo}
        </div>
      )}

      {tab === 'fil' && (
        <FilTab
          mentions={mentions} total={total} page={page} totalPages={totalPages}
          loading={loadingMentions} sources={sources} sourcesLoaded={sourcesLoaded}
          hasActiveSources={activeSources.length > 0}
          q={q} onQ={setQ}
          filterSource={filterSource} onFilterSource={v => { setFilterSource(v); setPage(1) }}
          periode={periode} onPeriode={v => { setPeriode(v); setPage(1) }}
          nonLues={nonLues} onNonLues={v => { setNonLues(v); setPage(1) }}
          favoris={favoris} onFavoris={v => { setFavoris(v); setPage(1) }}
          onPage={setPage}
          onPatch={patchMention}
          onCollect={handleCollect} collecting={collecting} readOnly={readOnly}
          onGoSources={() => setTab('sources')}
        />
      )}
      {tab === 'dashboard' && <DashboardTab stats={stats} loading={loadingStats} />}
      {tab === 'sources' && (
        <SourcesTab orgId={orgId} sources={sources} loaded={sourcesLoaded} readOnly={readOnly} onChanged={loadSources} />
      )}
      {tab === 'api' && <ApiTab orgId={orgId} readOnly={readOnly} />}
    </div>
  )
}

// ── 📰 Fil de veille ──────────────────────────────────────────────────────────
function FilTab(props: {
  mentions: Mention[]; total: number; page: number; totalPages: number
  loading: boolean; sources: Source[]; sourcesLoaded: boolean; hasActiveSources: boolean
  q: string; onQ: (v: string) => void
  filterSource: string; onFilterSource: (v: string) => void
  periode: Periode; onPeriode: (v: Periode) => void
  nonLues: boolean; onNonLues: (v: boolean) => void
  favoris: boolean; onFavoris: (v: boolean) => void
  onPage: (p: number) => void
  onPatch: (id: string, patch: { lu?: boolean; favori?: boolean }) => void
  onCollect: () => void; collecting: boolean; readOnly: boolean
  onGoSources: () => void
}) {
  const { mentions, total, page, totalPages, loading, sources, sourcesLoaded, hasActiveSources } = props
  const sourceLabel = (id: string) => sources.find(s => s.id === id)?.label ?? 'Source'
  const selectCls = 'px-2 py-1.5 text-sm rounded-lg border bg-transparent'
  const selectStyle = { borderColor: 'var(--border)', color: 'var(--text)', backgroundColor: 'var(--bg-card)' } as const

  // État vide pédagogique : aucune source configurée
  if (sourcesLoaded && sources.length === 0) {
    return (
      <div className="rounded-2xl border p-10 text-center" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
        <div className="text-5xl mb-4">📡</div>
        <h2 className="text-base font-semibold mb-2 text-gray-900 dark:text-white">Votre fil de veille est prêt à démarrer</h2>
        <p className="text-sm max-w-md mx-auto mb-5" style={{ color: 'var(--text-muted)' }}>
          Ajoutez vos flux Sindup dans l’onglet Sources : chaque dossier ou recherche de veille
          de votre compte Sindup peut être exporté en flux RSS et remonter ici automatiquement.
        </p>
        <button onClick={props.onGoSources}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
          🔗 Ajouter une source
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <input type="search" value={props.q} onChange={e => props.onQ(e.target.value)}
          placeholder="Rechercher dans les mentions…"
          className="flex-1 min-w-[180px] px-3 py-1.5 text-sm rounded-lg border bg-transparent focus:outline-none focus:ring-1 focus:ring-indigo-400"
          style={selectStyle} />
        <select value={props.filterSource} onChange={e => props.onFilterSource(e.target.value)} className={selectCls} style={selectStyle}>
          <option value="">Toutes les sources</option>
          {sources.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select value={props.periode} onChange={e => props.onPeriode(e.target.value as Periode)} className={selectCls} style={selectStyle}>
          <option value="7">7 derniers jours</option>
          <option value="30">30 derniers jours</option>
          <option value="90">90 derniers jours</option>
          <option value="tout">Tout</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none" style={{ color: 'var(--text-muted)' }}>
          <input type="checkbox" checked={props.nonLues} onChange={e => props.onNonLues(e.target.checked)} className="accent-indigo-600" />
          Non lues
        </label>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none" style={{ color: 'var(--text-muted)' }}>
          <input type="checkbox" checked={props.favoris} onChange={e => props.onFavoris(e.target.checked)} className="accent-amber-500" />
          ★ Favoris
        </label>
        {!props.readOnly && (
          <button onClick={props.onCollect} disabled={props.collecting}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-50">
            {props.collecting ? 'Collecte en cours…' : '🔄 Actualiser la collecte'}
          </button>
        )}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="text-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>Chargement…</div>
      ) : mentions.length === 0 ? (
        <div className="rounded-2xl border p-10 text-center" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
          <div className="text-3xl mb-3">🔍</div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {hasActiveSources
              ? 'Aucune mention ne correspond à ces filtres. Élargissez la période ou lancez une collecte.'
              : 'Aucune source active : réactivez un flux dans l’onglet Sources, puis lancez une collecte.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {mentions.map(m => (
            <article key={m.id}
              className={`group relative rounded-xl border p-4 transition-colors ${m.lu ? '' : 'border-l-4 border-l-indigo-500'}`}
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
              <div className="flex items-start gap-3">
                {!m.lu && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" title="Non lue" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium">
                      {sourceLabel(m.source_id)}
                    </span>
                    {m.published_at && <time dateTime={m.published_at}>{formatDateFr(m.published_at)}</time>}
                    {m.auteur && <span>· {m.auteur}</span>}
                  </div>
                  <a href={m.url} target="_blank" rel="noopener noreferrer"
                    onClick={() => { if (!m.lu) props.onPatch(m.id, { lu: true }) }}
                    className={`block text-sm hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors ${m.lu ? 'font-medium text-gray-700 dark:text-gray-300' : 'font-semibold text-gray-900 dark:text-white'}`}>
                    {m.titre}
                  </a>
                  {m.extrait && (
                    <p className="text-xs mt-1 leading-relaxed line-clamp-2" style={{ color: 'var(--text-muted)' }}>{m.extrait}</p>
                  )}
                </div>
                {/* Actions au survol (toujours visibles si favori) */}
                <div className={`flex items-center gap-1 shrink-0 transition-opacity ${m.favori ? '' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`}>
                  <button onClick={() => props.onPatch(m.id, { favori: !m.favori })}
                    title={m.favori ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                    className={`px-1.5 py-1 rounded text-base leading-none transition-colors ${m.favori ? 'text-amber-500' : 'text-gray-300 dark:text-gray-600 hover:text-amber-500'}`}>
                    ★
                  </button>
                  <button onClick={() => props.onPatch(m.id, { lu: !m.lu })}
                    title={m.lu ? 'Marquer comme non lue' : 'Marquer comme lue'}
                    className={`px-1.5 py-1 rounded text-sm leading-none transition-colors ${m.lu ? 'text-emerald-500' : 'text-gray-300 dark:text-gray-600 hover:text-emerald-500'}`}>
                    ✓
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && total > 0 && (
        <div className="flex items-center justify-between text-xs pt-1" style={{ color: 'var(--text-muted)' }}>
          <span>{total} mention{total > 1 ? 's' : ''} · page {page}/{totalPages}</span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button onClick={() => props.onPage(page - 1)} disabled={page <= 1}
                className="px-2.5 py-1 rounded-lg border disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                style={{ borderColor: 'var(--border)' }}>← Précédente</button>
              <button onClick={() => props.onPage(page + 1)} disabled={page >= totalPages}
                className="px-2.5 py-1 rounded-lg border disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                style={{ borderColor: 'var(--border)' }}>Suivante →</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 📊 Tableau de bord ────────────────────────────────────────────────────────
function DashboardTab({ stats, loading }: { stats: Stats | null; loading: boolean }) {
  if (loading && !stats) {
    return <div className="text-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>Chargement…</div>
  }
  if (!stats) {
    return (
      <div className="rounded-2xl border p-10 text-center" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Statistiques indisponibles pour le moment.</p>
      </div>
    )
  }

  // Barres des 30 derniers jours (jours manquants comblés à 0)
  const byDate = new Map(stats.par_jour.map(p => [p.date.slice(0, 10), p.n]))
  const days: { date: string; n: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    days.push({ date: key, n: byDate.get(key) ?? 0 })
  }
  const maxN = Math.max(1, ...days.map(d => d.n))
  const W = 600, H = 140, PAD = 4
  const barW = (W - PAD * 2) / days.length
  const maxSource = Math.max(1, ...stats.par_source.map(s => s.n))

  const cards: { label: string; value: number; icon: string; accent?: string }[] = [
    { label: 'Mentions au total', value: stats.total, icon: '📰' },
    { label: 'Non lues', value: stats.non_lues, icon: '🔵', accent: 'text-indigo-600 dark:text-indigo-400' },
    { label: 'Favoris', value: stats.favoris, icon: '★', accent: 'text-amber-500' },
  ]

  return (
    <div className="space-y-5">
      {/* Cartes stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map(c => (
          <div key={c.label} className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
            <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{c.icon} {c.label}</div>
            <div className={`text-3xl font-bold ${c.accent ?? 'text-gray-900 dark:text-white'}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Mentions par jour — SVG maison */}
      <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
        <h2 className="text-sm font-semibold mb-1 text-gray-900 dark:text-white">Mentions par jour</h2>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>30 derniers jours · maximum : {maxN === 1 && days.every(d => d.n === 0) ? 0 : maxN} / jour</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Histogramme des mentions par jour sur 30 jours">
          <line x1={PAD} y1={H - 16} x2={W - PAD} y2={H - 16} stroke="var(--border)" strokeWidth="1" />
          {days.map((d, i) => {
            const h = d.n > 0 ? Math.max(2, (d.n / maxN) * (H - 28)) : 0
            const x = PAD + i * barW
            return (
              <g key={d.date}>
                {d.n > 0 && (
                  <rect x={x + barW * 0.15} y={H - 16 - h} width={barW * 0.7} height={h} rx="2"
                    fill="var(--accent, #4f46e5)" opacity={0.85}>
                    <title>{`${formatDateFr(d.date)} : ${d.n} mention${d.n > 1 ? 's' : ''}`}</title>
                  </rect>
                )}
                {(i === 0 || i === 14 || i === 29) && (
                  <text x={x + barW / 2} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--text-muted)">
                    {new Date(d.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Répartition par source */}
      <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
        <h2 className="text-sm font-semibold mb-3 text-gray-900 dark:text-white">Répartition par source</h2>
        {stats.par_source.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Aucune mention collectée pour l’instant.</p>
        ) : (
          <div className="space-y-2">
            {[...stats.par_source].sort((a, b) => b.n - a.n).map(s => (
              <div key={s.source_id} className="flex items-center gap-3 text-xs">
                <span className="w-40 truncate shrink-0" style={{ color: 'var(--text)' }} title={s.label}>{s.label}</span>
                <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(s.n / maxSource) * 100}%` }} />
                </div>
                <span className="w-10 text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>{s.n}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 🔗 Sources ────────────────────────────────────────────────────────────────
function SourcesTab({ orgId, sources, loaded, readOnly, onChanged }: {
  orgId: string; sources: Source[]; loaded: boolean; readOnly: boolean; onChanged: () => Promise<void>
}) {
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim() || !url.trim()) return
    setAdding(true); setAddError(null)
    try {
      const res = await fetch(`/api/veille-sindup/sources`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organisation_id: orgId, label: label.trim(), url: url.trim() }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((j as { error?: string }).error ?? 'Flux invalide')
      setLabel(''); setUrl('')
      await onChanged()
    } catch (e2) { setAddError(String((e2 as Error).message ?? e2)) }
    finally { setAdding(false) }
  }

  async function handleToggle(s: Source) {
    setBusyId(s.id)
    try {
      await fetch(`/api/veille-sindup/sources`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, actif: !s.actif }),
      })
      await onChanged()
    } finally { setBusyId(null) }
  }

  async function handleDelete(id: string) {
    setBusyId(id)
    try {
      await fetch(`/api/veille-sindup/sources?id=${id}`, { method: 'DELETE' })
      setConfirmDelete(null)
      await onChanged()
    } finally { setBusyId(null) }
  }

  return (
    <div className="space-y-4">
      {/* Aide */}
      <div className="rounded-xl border px-4 py-3 text-xs leading-relaxed" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)' }}>
        💡 <span className="font-medium text-gray-700 dark:text-gray-300">Dans Sindup :</span> ouvrez un dossier
        ou une recherche de veille → <span className="font-medium">Partager/Exporter → Flux RSS</span>, puis collez
        l’URL ici. Chaque flux devient une source collectée automatiquement dans votre fil de veille.
      </div>

      {/* Formulaire d'ajout */}
      {!readOnly && (
        <form onSubmit={handleAdd} className="rounded-2xl border p-4 space-y-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Ajouter un flux</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Libellé (ex. Veille concurrents)"
              className="sm:w-56 px-3 py-1.5 text-sm rounded-lg border bg-transparent focus:outline-none focus:ring-1 focus:ring-indigo-400"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }} required />
            <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://… (URL du flux RSS Sindup)"
              className="flex-1 px-3 py-1.5 text-sm rounded-lg border bg-transparent focus:outline-none focus:ring-1 focus:ring-indigo-400"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }} required />
            <button type="submit" disabled={adding || !label.trim() || !url.trim()}
              className="px-4 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50">
              {adding ? 'Test du flux…' : '+ Ajouter'}
            </button>
          </div>
          {addError && <p className="text-xs text-red-600 dark:text-red-400">{addError}</p>}
        </form>
      )}

      {/* Liste des sources */}
      {!loaded ? (
        <div className="text-center py-10 text-sm" style={{ color: 'var(--text-muted)' }}>Chargement…</div>
      ) : sources.length === 0 ? (
        <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Aucune source pour l’instant{readOnly ? '.' : ' — ajoutez votre premier flux RSS Sindup ci-dessus.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map(s => (
            <div key={s.id} className={`rounded-xl border p-4 flex flex-wrap items-center gap-3 ${s.actif ? '' : 'opacity-60'}`}
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
              {/* Statut dernière collecte */}
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.last_status === 'ok' ? 'bg-emerald-500' : s.last_status ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                title={
                  s.last_status === 'ok'
                    ? `Dernière collecte réussie${s.last_fetch_at ? ` le ${formatDateTimeFr(s.last_fetch_at)}` : ''}`
                    : s.last_status
                      ? `Erreur${s.last_fetch_at ? ` le ${formatDateTimeFr(s.last_fetch_at)}` : ''} : ${s.last_error ?? s.last_status}`
                      : 'Pas encore collectée'
                }
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  {s.label}
                  {s.type === 'api' && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">API</span>
                  )}
                </div>
                <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }} title={s.url}>{truncateUrl(s.url)}</div>
                {s.last_fetch_at && (
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Dernière collecte : {formatDateTimeFr(s.last_fetch_at)}
                    {s.last_status && s.last_status !== 'ok' && (
                      <span className="text-red-500 dark:text-red-400"> · en erreur</span>
                    )}
                  </div>
                )}
              </div>
              {!readOnly && (
                <div className="flex items-center gap-2 shrink-0">
                  {/* Toggle actif */}
                  <button onClick={() => handleToggle(s)} disabled={busyId === s.id}
                    title={s.actif ? 'Désactiver ce flux' : 'Réactiver ce flux'}
                    className={`relative h-5 w-9 rounded-full transition-colors disabled:opacity-50 ${s.actif ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${s.actif ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>
                  {confirmDelete === s.id ? (
                    <span className="flex items-center gap-1 text-xs">
                      <span style={{ color: 'var(--text-muted)' }}>Supprimer ?</span>
                      <button onClick={() => handleDelete(s.id)} disabled={busyId === s.id}
                        className="px-2 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors disabled:opacity-50">Oui</button>
                      <button onClick={() => setConfirmDelete(null)}
                        className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors">Non</button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmDelete(s.id)} title="Supprimer cette source"
                      className="px-2 py-1 text-xs rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors">🗑</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── ⚙️ Connexion API ──────────────────────────────────────────────────────────
function ApiTab({ orgId, readOnly }: { orgId: string; readOnly: boolean }) {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/veille-sindup/credentials?organisation_id=${orgId}`)
      const j = await res.json().catch(() => ({}))
      if (res.ok) setConnected(Boolean((j as { connected?: boolean }).connected))
      else setConnected(false)
    } catch { setConnected(false) }
  }, [orgId])

  useEffect(() => { load() }, [load])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!apiKey.trim()) return
    setSaving(true); setErr(null)
    try {
      const res = await fetch(`/api/veille-sindup/credentials`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organisation_id: orgId, api_key: apiKey.trim() }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((j as { error?: string }).error ?? 'Erreur d’enregistrement')
      setApiKey('')
      await load()
    } catch (e2) { setErr(String((e2 as Error).message ?? e2)) }
    finally { setSaving(false) }
  }

  async function handleRemove() {
    setRemoving(true); setErr(null)
    try {
      const res = await fetch(`/api/veille-sindup/credentials?organisation_id=${orgId}`, { method: 'DELETE' })
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error((j as { error?: string }).error ?? 'Erreur') }
      await load()
    } catch (e2) { setErr(String((e2 as Error).message ?? e2)) }
    finally { setRemoving(false) }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
        <h2 className="text-sm font-semibold mb-2 text-gray-900 dark:text-white">🔌 Connecteur API Sindup</h2>
        <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--text-muted)' }}>
          L’API Sindup (offres entreprise) permettra une intégration plus profonde que les flux RSS :
          synchronisation des dossiers de veille, tonalité, indicateurs d’e-réputation.
          Votre clé API est stockée chiffrée, par organisation, et ne quitte jamais le serveur.
        </p>

        {/* Statut */}
        <div className="flex items-center gap-2 mb-4 text-sm">
          <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
          {connected === null ? (
            <span style={{ color: 'var(--text-muted)' }}>Vérification…</span>
          ) : connected ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Clé API enregistrée — connecteur prêt</span>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>Aucune clé API enregistrée</span>
          )}
        </div>

        {!readOnly && (
          <form onSubmit={handleSave} className="flex flex-col sm:flex-row gap-2">
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder={connected ? 'Remplacer la clé API…' : 'Clé API Sindup'}
              autoComplete="off"
              className="flex-1 px-3 py-1.5 text-sm rounded-lg border bg-transparent focus:outline-none focus:ring-1 focus:ring-indigo-400"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }} />
            <button type="submit" disabled={saving || !apiKey.trim()}
              className="px-4 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50">
              {saving ? 'Enregistrement…' : connected ? 'Remplacer' : 'Enregistrer'}
            </button>
            {connected && (
              <button type="button" onClick={handleRemove} disabled={removing}
                className="px-4 py-1.5 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-50">
                {removing ? '…' : 'Supprimer la clé'}
              </button>
            )}
          </form>
        )}
        {err && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{err}</p>}
      </div>

      <p className="text-xs leading-relaxed px-1" style={{ color: 'var(--text-muted)' }}>
        ⏳ Le client API est en attente de la documentation API Sindup — vos flux RSS fonctionnent
        dès maintenant et alimentent le fil de veille sans configuration supplémentaire.
      </p>
    </div>
  )
}

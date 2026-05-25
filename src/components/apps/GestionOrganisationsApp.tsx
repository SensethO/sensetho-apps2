'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useOrganisations } from '@/hooks/useOrganisations'
import type { Organisation, OrganisationSearchResult } from '@/types/organisation'

// ─── Sous-composants ──────────────────────────────────────────────────────────

function Field({ label, value, mono, className }: {
  label: string
  value?: string | null
  mono?: boolean
  className?: string
}) {
  return (
    <div className={className}>
      <dt className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{label}</dt>
      <dd className={`text-sm text-gray-900 dark:text-white ${mono ? 'font-mono' : ''}`}>{value || '—'}</dd>
    </div>
  )
}

function LabelBadge({ label, color }: { label: string; color: 'emerald' | 'blue' | 'purple' | 'amber' }) {
  const colors = {
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  }
  return <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors[color]}`}>{label}</span>
}

// ─── Modale de détail ─────────────────────────────────────────────────────────

type DetailTab = 'identite' | 'activite' | 'dirigeants' | 'labels'

function OrgDetailModal({ org, result, isInBase, onAdd, onRemove, onClose }: {
  org?: Organisation
  result?: OrganisationSearchResult
  isInBase: boolean
  onAdd?: () => Promise<void>
  onRemove?: () => Promise<void>
  onClose: () => void
}) {
  const [tab, setTab] = useState<DetailTab>('identite')
  const [busy, setBusy] = useState(false)

  const denomination = org?.denomination ?? result?.nom_complet ?? '—'
  const siren        = org?.siren ?? result?.siren
  const siret        = org?.siret_siege ?? result?.siret_siege
  const etat         = org?.etat_administratif ?? result?.etat_administratif
  const forme        = org?.forme_juridique ?? result?.forme_juridique
  const categorie    = org?.categorie_entreprise ?? result?.categorie_entreprise
  const rna          = org?.identifiant_association ?? result?.identifiant_association
  const activite     = org?.libelle_activite ?? result?.libelle_activite
  const effectif     = org?.effectif_tranche ?? result?.effectif_tranche
  const adresse      = org?.adresse ?? result?.adresse
  const codePostal   = org?.code_postal ?? result?.code_postal
  const ville        = org?.ville ?? result?.ville
  const region       = org?.region ?? result?.region
  const dirigeants   = org?.dirigeants ?? result?.dirigeants ?? []
  const estEss       = org?.est_ess ?? result?.est_ess
  const estAsso      = org?.est_association ?? result?.est_association
  const estMission   = org?.est_societe_mission ?? result?.est_societe_mission
  const estPublic    = org?.est_service_public ?? result?.est_service_public

  const TABS: { key: DetailTab; label: string }[] = [
    { key: 'identite',   label: 'Identité' },
    { key: 'activite',   label: 'Activité & Siège' },
    { key: 'dirigeants', label: `Dirigeants (${dirigeants.length})` },
    { key: 'labels',     label: 'Labels' },
  ]

  async function handleAction(fn: () => Promise<void>) {
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* En-tête */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">{denomination}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {siren && <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{siren}</span>}
              {ville && <span className="text-xs text-gray-500 dark:text-gray-400">· {ville}</span>}
              {etat === 'A' && <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">Actif</span>}
              {etat === 'C' && <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full">Cessé</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
            {isInBase && onRemove && (
              <button
                onClick={() => handleAction(onRemove)}
                disabled={busy}
                className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
              >
                {busy ? '…' : 'Retirer'}
              </button>
            )}
            {!isInBase && onAdd && (
              <button
                onClick={() => handleAction(onAdd)}
                disabled={busy}
                className="px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {busy ? '…' : '+ Ajouter'}
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        {/* Onglets */}
        <div className="flex gap-1 px-6 pt-3 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-sm whitespace-nowrap rounded-t-lg transition-colors ${
                tab === t.key
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-medium border-b-2 border-emerald-500'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'identite' && (
            <dl className="grid grid-cols-2 gap-4">
              <Field label="SIREN" value={siren} mono />
              <Field label="SIRET siège" value={siret} mono />
              <Field label="Forme juridique" value={forme} />
              <Field label="Catégorie" value={categorie} />
              <Field label="RNA" value={rna} mono />
              <Field label="Statut" value={etat === 'A' ? 'Actif' : etat === 'C' ? 'Cessé' : etat ?? undefined} />
            </dl>
          )}

          {tab === 'activite' && (
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Activité principale" value={activite} className="col-span-2" />
              <Field label="Effectif" value={effectif} />
              <Field label="Adresse" value={adresse} className="col-span-2" />
              <Field label="Code postal" value={codePostal} />
              <Field label="Ville" value={ville} />
              <Field label="Région" value={region} />
            </dl>
          )}

          {tab === 'dirigeants' && (
            <div className="space-y-3">
              {dirigeants.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">Aucun dirigeant renseigné</p>
              ) : dirigeants.map((d, i) => {
                const nom = d.type_dirigeant === 'personne_morale'
                  ? (d.denomination ?? '—')
                  : `${d.prenoms ?? ''} ${d.nom ?? ''}`.trim()
                return (
                  <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 text-sm font-bold flex-shrink-0">
                      {(nom[0] ?? '?').toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{nom}</p>
                      {d.qualite && <p className="text-xs text-gray-500 dark:text-gray-400">{d.qualite}</p>}
                      {d.date_naissance_partielle && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">Né(e) {d.date_naissance_partielle}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {tab === 'labels' && (
            <div className="flex flex-wrap gap-2">
              {estEss     && <LabelBadge label="ESS"               color="emerald" />}
              {estAsso    && <LabelBadge label="Association"        color="blue"    />}
              {estMission && <LabelBadge label="Société à mission"  color="purple"  />}
              {estPublic  && <LabelBadge label="Service public"     color="amber"   />}
              {!estEss && !estAsso && !estMission && !estPublic && (
                <p className="text-sm text-gray-400 dark:text-gray-500">Aucun label spécifique</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function GestionOrganisationsApp() {
  const { organisations, loading, save, saveManual, remove, reload } = useOrganisations()

  const [mode, setMode]                   = useState<'list' | 'search'>('list')
  const [query, setQuery]                 = useState('')
  const [searchResults, setSearchResults] = useState<OrganisationSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [filter, setFilter]               = useState('')
  const [selected, setSelected]           = useState<{ org?: Organisation; result?: OrganisationSearchResult } | null>(null)
  const [showManual, setShowManual]       = useState(false)
  const [manualName, setManualName]       = useState('')
  const [manualSiren, setManualSiren]     = useState('')
  const [manualSaving, setManualSaving]   = useState(false)

  const abortRef = useRef<AbortController | null>(null)

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return }
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setSearchLoading(true)
    try {
      const res = await fetch(
        `/api/organisations/search?q=${encodeURIComponent(q)}&per_page=12`,
        { signal: abortRef.current.signal }
      )
      const json = await res.json()
      setSearchResults(json.results ?? [])
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => doSearch(query), 350)
    return () => clearTimeout(t)
  }, [query, doSearch])

  function getSirenInBase(siren?: string | null) {
    if (!siren) return undefined
    return organisations.find(o => o.siren === siren)
  }

  const filtered = filter.trim()
    ? organisations.filter(o => {
        const q = filter.toLowerCase()
        return (
          o.denomination?.toLowerCase().includes(q) ||
          o.siren?.includes(q) ||
          o.ville?.toLowerCase().includes(q) ||
          o.nom_commercial?.toLowerCase().includes(q) ||
          o.dirigeants?.some(d =>
            `${d.prenoms ?? ''} ${d.nom ?? ''}`.toLowerCase().includes(q)
          )
        )
      })
    : organisations

  async function handleManualAdd() {
    if (!manualName.trim()) return
    setManualSaving(true)
    await saveManual(manualName.trim(), manualSiren.trim() || undefined)
    setManualSaving(false)
    setShowManual(false)
    setManualName('')
    setManualSiren('')
  }

  function switchToSearch() {
    setMode('search')
    setQuery('')
    setSearchResults([])
  }

  function switchToList() {
    setMode('list')
    setQuery('')
    setSearchResults([])
  }

  return (
    <div className="min-h-full max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Organisations</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {loading
              ? 'Chargement…'
              : `${organisations.length} organisation${organisations.length > 1 ? 's' : ''} enregistrée${organisations.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex gap-2">
          {mode === 'list' ? (
            <>
              <button
                onClick={() => setShowManual(true)}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Saisie manuelle
              </button>
              <button
                onClick={switchToSearch}
                className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
              >
                + Rechercher
              </button>
            </>
          ) : (
            <button
              onClick={switchToList}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              ← Retour
            </button>
          )}
        </div>
      </div>

      {/* Mode recherche */}
      {mode === 'search' && (
        <div className="space-y-4">
          <div className="relative">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher par nom, SIREN, ville…"
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            />
            {searchLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {query.length >= 2 ? (
            <div className="space-y-2">
              {!searchLoading && searchResults.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">Aucun résultat</p>
              )}
              {searchResults.map(r => {
                const existing = getSirenInBase(r.siren)
                const inBase = !!existing
                return (
                  <button
                    key={r.siren ?? r.nom_complet}
                    type="button"
                    onClick={() => setSelected({ result: r, org: existing })}
                    className="w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 font-bold text-sm flex-shrink-0">
                      {(r.nom_complet?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{r.nom_complet}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {r.siren   && <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{r.siren}</span>}
                        {r.ville   && <span className="text-xs text-gray-400 dark:text-gray-500">· {r.ville}</span>}
                        {r.forme_juridique && <span className="text-xs text-gray-400 dark:text-gray-500">· {r.forme_juridique}</span>}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${
                      inBase
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}>
                      {inBase ? '✓ Dans ma base' : '+ Ajouter'}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500">
              <p className="text-4xl mb-3">🔍</p>
              <p className="text-sm">Saisissez au moins 2 caractères</p>
              <p className="text-xs mt-1 opacity-70">Sources : Entreprises, associations, fondations</p>
            </div>
          )}
        </div>
      )}

      {/* Mode liste */}
      {mode === 'list' && (
        <div className="space-y-4">
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filtrer par nom, SIREN, ville, dirigeant…"
            className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
          />

          {loading ? (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500">
              <p className="text-4xl mb-3">🏢</p>
              <p className="text-sm">
                {filter ? 'Aucune organisation ne correspond au filtre' : 'Aucune organisation enregistrée'}
              </p>
              {!filter && (
                <button
                  onClick={switchToSearch}
                  className="mt-4 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                >
                  Rechercher une organisation
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtered.map(org => (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => setSelected({ org })}
                  className="flex items-start gap-3 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-bold text-sm flex-shrink-0">
                    {(org.denomination?.[0] ?? '?').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{org.denomination}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {org.siren && <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{org.siren}</span>}
                      {org.ville && <span className="text-xs text-gray-400 dark:text-gray-500">· {org.ville}</span>}
                    </div>
                    {org.libelle_activite && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{org.libelle_activite}</p>
                    )}
                    {org.dirigeants?.[0] && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                        {org.dirigeants[0].prenoms
                          ? `${org.dirigeants[0].prenoms} ${org.dirigeants[0].nom ?? ''}`.trim()
                          : org.dirigeants[0].nom ?? ''}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modale saisie manuelle */}
      {showManual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Saisie manuelle</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                  Dénomination <span className="text-red-500">*</span>
                </label>
                <input
                  autoFocus
                  type="text"
                  value={manualName}
                  onChange={e => setManualName(e.target.value)}
                  placeholder="Nom de l&apos;organisation"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">SIREN (optionnel)</label>
                <input
                  type="text"
                  value={manualSiren}
                  onChange={e => setManualSiren(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  placeholder="9 chiffres"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setShowManual(false); setManualName(''); setManualSiren('') }}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleManualAdd}
                disabled={!manualName.trim() || manualSaving}
                className="flex-1 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
              >
                {manualSaving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale de détail */}
      {selected && (
        <OrgDetailModal
          org={selected.org}
          result={selected.result}
          isInBase={!!selected.org || !!getSirenInBase(selected.result?.siren)}
          onAdd={selected.result && !selected.org ? async () => {
            await save(selected.result!)
            await reload()
            switchToList()
          } : undefined}
          onRemove={selected.org ? async () => {
            await remove(selected.org!.id)
          } : undefined}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

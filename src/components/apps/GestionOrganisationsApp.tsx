'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useOrganisations } from '@/hooks/useOrganisations'
import type { Organisation, OrganisationSearchResult } from '@/types/organisation'

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function Field({ label, value, mono, className }: {
  label: string
  value?: string | number | null
  mono?: boolean
  className?: string
}) {
  return (
    <div className={className}>
      <dt className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{label}</dt>
      <dd className={`text-sm text-gray-900 dark:text-white ${mono ? 'font-mono' : ''}`}>
        {value !== null && value !== undefined && value !== '' ? String(value) : '—'}
      </dd>
    </div>
  )
}

function LabelBadge({ label, color }: {
  label: string
  color: 'emerald' | 'blue' | 'purple' | 'amber' | 'rose' | 'teal' | 'indigo' | 'lime'
}) {
  const colors = {
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    blue:    'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    purple:  'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    amber:   'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    rose:    'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
    teal:    'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400',
    indigo:  'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
    lime:    'bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-400',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colors[color]}`}>
      {label}
    </span>
  )
}

// ─── Modale de détail ─────────────────────────────────────────────────────────

type DetailTab = 'identite' | 'activite' | 'siege' | 'dirigeants' | 'labels'

function OrgDetailModal({ org, result, isInBase, onAdd, onRemove, onClose }: {
  org?: Organisation
  result?: OrganisationSearchResult
  isInBase: boolean
  onAdd?: () => Promise<void>
  onRemove?: () => Promise<void>
  onClose: () => void
}) {
  const [tab, setTab]   = useState<DetailTab>('identite')
  const [busy, setBusy] = useState(false)

  // Fusion org (DB) + result (API) — DB prioritaire
  const get = <K extends keyof Organisation & keyof OrganisationSearchResult>(key: K) =>
    (org?.[key] ?? (result as unknown as Organisation)?.[key]) as Organisation[K] | undefined

  const denomination = org?.denomination ?? result?.nom_complet ?? '—'
  const etat         = get('etat_administratif')
  const ville        = get('ville')
  const siren        = get('siren')

  const dirigeants   = org?.dirigeants ?? result?.dirigeants ?? []
  const liste_idcc   = org?.liste_idcc ?? result?.liste_idcc ?? []

  // Labels actifs
  type LabelDef = { label: string; color: 'emerald' | 'blue' | 'purple' | 'amber' | 'rose' | 'teal' | 'indigo' | 'lime'; key: string }
  const LABELS: LabelDef[] = [
    { key: 'est_ess',                     label: 'ESS',                       color: 'emerald' },
    { key: 'est_association',             label: 'Association',               color: 'blue'    },
    { key: 'est_societe_mission',         label: 'Soc. à mission',            color: 'purple'  },
    { key: 'est_service_public',          label: 'Service public',            color: 'amber'   },
    { key: 'est_entrepreneur_individuel', label: 'Entrepreneur individuel',   color: 'rose'    },
    { key: 'est_entrepreneur_spectacle',  label: 'Spectacle vivant',          color: 'indigo'  },
    { key: 'est_finess',                  label: 'Établissement sanitaire',   color: 'teal'    },
    { key: 'est_uai',                     label: 'Établissement scolaire',    color: 'teal'    },
    { key: 'est_rge',                     label: 'RGE',                       color: 'lime'    },
    { key: 'est_organisme_formation',     label: 'Organisme de formation',    color: 'amber'   },
    { key: 'est_qualiopi',                label: 'Qualiopi',                  color: 'emerald' },
    { key: 'est_bio',                     label: 'Agriculture bio',           color: 'lime'    },
    { key: 'est_patrimoine_vivant',       label: 'Patrimoine vivant',         color: 'indigo'  },
    { key: 'est_labor_agrement',          label: 'Agrément SAP',              color: 'rose'    },
    { key: 'convention_collective_renseignee', label: 'Convention collective', color: 'blue' },
  ]

  const activeLabels = LABELS.filter(l => {
    const val = org?.[l.key as keyof Organisation] ?? result?.[l.key as keyof OrganisationSearchResult]
    return val === true
  })

  const TABS: { key: DetailTab; label: string }[] = [
    { key: 'identite',  label: 'Identité'       },
    { key: 'activite',  label: 'Activité'        },
    { key: 'siege',     label: 'Siège'           },
    { key: 'dirigeants', label: `Dirigeants (${dirigeants.length})` },
    { key: 'labels',    label: `Labels (${activeLabels.length})`   },
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
              {etat === 'F' && <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">Fermé</span>}
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
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Field label="SIREN"              value={get('siren')}            mono />
              <Field label="SIRET siège"        value={get('siret_siege')}      mono />
              <Field label="RNA"                value={get('identifiant_association')} mono />
              <Field label="Nature juridique"   value={get('nature_juridique')} mono />
              <Field label="Forme juridique"    value={get('forme_juridique')}  className="col-span-2" />
              <Field label="Statut"             value={etat === 'A' ? 'Actif' : etat === 'C' ? 'Cessé' : etat === 'F' ? 'Fermé' : etat ?? undefined} />
              <Field label="Date de création"   value={get('date_creation')} />
              <Field label="Catégorie"          value={get('categorie_entreprise')} />
              <Field label="Dernière MàJ"       value={get('date_mise_a_jour')} />
              {(org?.liste_enseignes?.length ?? result?.liste_enseignes?.length ?? 0) > 0 && (
                <div className="col-span-2">
                  <dt className="text-xs text-gray-400 dark:text-gray-500 mb-1">Enseignes</dt>
                  <dd className="flex flex-wrap gap-1">
                    {(org?.liste_enseignes ?? result?.liste_enseignes ?? []).map((e, i) => (
                      <span key={i} className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded">{e}</span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          )}

          {tab === 'activite' && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Code NAF"          value={get('activite_principale')} mono />
              <Field label="Section"           value={get('section_activite_principale')} />
              <Field label="Activité"          value={get('libelle_activite')} className="col-span-2" />
              <Field label="Début d&apos;activité"  value={get('date_debut_activite')} />
              <Field label="Effectif"          value={get('effectif_tranche')} />
              <Field label="Année effectif"    value={get('annee_effectif')} />
              <Field label="Établissements"    value={get('nombre_etablissements')} />
              <Field label="Étab. ouverts"     value={get('nombre_etablissements_ouverts')} />
              {liste_idcc.length > 0 && (
                <div className="col-span-2">
                  <dt className="text-xs text-gray-400 dark:text-gray-500 mb-1">Conventions collectives (IDCC)</dt>
                  <dd className="flex flex-wrap gap-1">
                    {liste_idcc.map((idcc, i) => (
                      <span key={i} className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded font-mono">{idcc}</span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          )}

          {tab === 'siege' && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Adresse"           value={get('adresse')}            className="col-span-2" />
              <Field label="Code postal"       value={get('code_postal')} />
              <Field label="Commune (INSEE)"   value={get('commune')}            mono />
              <Field label="Ville"             value={get('ville')} />
              <Field label="Département"       value={get('libelle_departement')} />
              <Field label="Code département"  value={get('departement')}        mono />
              <Field label="Région"            value={get('region')} />
              <Field label="Latitude"          value={get('latitude')} />
              <Field label="Longitude"         value={get('longitude')} />
              {get('latitude') && get('longitude') && (
                <div className="col-span-2 mt-2">
                  <a
                    href={`https://maps.google.com/?q=${get('latitude')},${get('longitude')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    📍 Voir sur Google Maps
                  </a>
                </div>
              )}
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
                  <div key={i} className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 text-sm font-bold flex-shrink-0">
                      {(nom[0] ?? '?').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{nom}</p>
                      {d.qualite && <p className="text-xs text-gray-500 dark:text-gray-400">{d.qualite}</p>}
                      <div className="flex flex-wrap gap-3 mt-1">
                        {d.date_naissance_partielle && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">Né(e) {d.date_naissance_partielle}</span>
                        )}
                        {d.nationalite && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">🌍 {d.nationalite}</span>
                        )}
                        {d.siren && (
                          <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">SIREN {d.siren}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {tab === 'labels' && (
            <div>
              {activeLabels.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">Aucun label spécifique</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {activeLabels.map(l => (
                    <LabelBadge key={l.key} label={l.label} color={l.color} />
                  ))}
                </div>
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
          o.departement?.includes(q) ||
          o.libelle_departement?.toLowerCase().includes(q) ||
          o.nom_commercial?.toLowerCase().includes(q) ||
          o.libelle_activite?.toLowerCase().includes(q) ||
          o.commune?.includes(q) ||
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

  function switchToSearch() { setMode('search'); setQuery(''); setSearchResults([]) }
  function switchToList()   { setMode('list');   setQuery(''); setSearchResults([]) }

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
                const inBase   = !!existing
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
                        {r.siren             && <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{r.siren}</span>}
                        {r.ville             && <span className="text-xs text-gray-400 dark:text-gray-500">· {r.ville}</span>}
                        {r.libelle_departement && <span className="text-xs text-gray-400 dark:text-gray-500">({r.libelle_departement})</span>}
                        {r.forme_juridique   && <span className="text-xs text-gray-400 dark:text-gray-500">· {r.forme_juridique}</span>}
                        {r.etat_administratif === 'C' && <span className="text-xs text-red-400">· Cessé</span>}
                      </div>
                      {r.libelle_activite && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{r.libelle_activite}</p>
                      )}
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
            placeholder="Filtrer par nom, SIREN, ville, activité, dirigeant…"
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
                      {org.libelle_departement && <span className="text-xs text-gray-400 dark:text-gray-500">({org.libelle_departement})</span>}
                    </div>
                    {org.libelle_activite && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{org.libelle_activite}</p>
                    )}
                    {org.dirigeants?.[0] && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                        {org.dirigeants[0].prenoms
                          ? `${org.dirigeants[0].prenoms} ${org.dirigeants[0].nom ?? ''}`.trim()
                          : org.dirigeants[0].nom ?? ''}
                        {org.dirigeants[0].qualite ? ` — ${org.dirigeants[0].qualite}` : ''}
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
                  placeholder="Nom de l'organisation"
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

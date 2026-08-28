'use client'

// Vue « Système de création de valeur » (System for Value Delivery, PMI) de
// l'app Projet RSE : carte visuelle Portefeuilles → Programmes → Projets →
// Opérations, façon PMBOK. Blocs imbriqués (un portefeuille contient des
// programmes et des projets directs ; programmes et projets autonomes à
// côté ; barre Opérations en bas) + flux d'information (la stratégie
// descend, la performance remonte).
//
// API : /api/projet-rse (portefeuilles, programmes, operations, projets)

import { useState, useEffect, useCallback, useMemo } from 'react'

// ── Types (contrat API) ───────────────────────────────────────────────────────

type Phase = 'pre_project' | 'discovery' | 'design' | 'delivery' | 'closure'

interface Portefeuille {
  id: string
  nom: string
  description: string | null
  objectifs_strategiques: string | null
  nb_programmes: number
  nb_projets: number
}

interface Programme {
  id: string
  nom: string
  description: string | null
  portefeuille_id: string | null
  nb_projets: number
}

interface Operation {
  id: string
  nom: string
  description: string | null
  statut: 'active' | 'arretee'
  projet_source: { id: string; nom: string } | null
}

interface ProjetLite {
  id: string
  nom: string
  phase: Phase
  statut: string
  programme_id: string | null
  portefeuille_id: string | null
}

const PHASE_LABELS: Record<Phase, string> = {
  pre_project: 'Avant-projet',
  discovery: 'Découverte',
  design: 'Conception',
  delivery: 'Réalisation',
  closure: 'Clôture',
}

const PHASE_BADGES: Record<Phase, string> = {
  pre_project: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  discovery: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  design: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  delivery: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  closure: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
}

// ── Helpers fetch ─────────────────────────────────────────────────────────────

const BASE = '/api/projet-rse'

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const j = await res.json()
  if (!res.ok) throw new Error((j as { error?: string }).error ?? 'Erreur serveur')
  return j as T
}

function postJson<T>(url: string, body: unknown): Promise<T> {
  return apiJson<T>(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

function patchJson<T>(url: string, body: unknown): Promise<T> {
  return apiJson<T>(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

// ── Cible du menu « Rattacher à… » ────────────────────────────────────────────

type AttachTarget =
  | { type: 'projet'; id: string; nom: string; current: string }
  | { type: 'programme'; id: string; nom: string; current: string }

/** Encode le rattachement actuel pour présélectionner la modale. */
function currentOfProjet(p: { programme_id?: string | null; portefeuille_id?: string | null }): string {
  if (p.programme_id) return `pg:${p.programme_id}`
  if (p.portefeuille_id) return `pf:${p.portefeuille_id}`
  return ''
}
function currentOfProgramme(pg: { portefeuille_id?: string | null }): string {
  return pg.portefeuille_id ? `pf:${pg.portefeuille_id}` : ''
}

type CreateKind = 'portefeuille' | 'programme' | 'operation'

// ── Composant principal ───────────────────────────────────────────────────────

export default function ProjetRseValeurView({ organisationId, readOnly, onOpenProjet }: {
  organisationId: string
  readOnly: boolean
  onOpenProjet: (projetId: string) => void
}) {
  const [portefeuilles, setPortefeuilles] = useState<Portefeuille[]>([])
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [operations, setOperations] = useState<Operation[]>([])
  const [projets, setProjets] = useState<ProjetLite[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createKind, setCreateKind] = useState<CreateKind | null>(null)
  const [attachTarget, setAttachTarget] = useState<AttachTarget | null>(null)

  const reload = useCallback(async () => {
    try {
      const q = `?organisation_id=${organisationId}`
      const [pf, pg, op, pj] = await Promise.all([
        apiJson<{ portefeuilles?: Portefeuille[] }>(`${BASE}/portefeuilles${q}`),
        apiJson<{ programmes?: Programme[] }>(`${BASE}/programmes${q}`),
        apiJson<{ operations?: Operation[] }>(`${BASE}/operations${q}`),
        apiJson<{ projets?: ProjetLite[] }>(`${BASE}/projets${q}`),
      ])
      setPortefeuilles(pf.portefeuilles ?? [])
      setProgrammes(pg.programmes ?? [])
      setOperations(op.operations ?? [])
      setProjets(pj.projets ?? [])
    } catch (e) { setError(String((e as Error).message ?? e)) }
    finally { setLoaded(true) }
  }, [organisationId])

  useEffect(() => { setLoaded(false); reload() }, [reload])

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    try { await fn(); await reload() }
    catch (e) { setError(String((e as Error).message ?? e)) }
  }, [reload])

  // Regroupements
  const programmesDe = useCallback(
    (portefeuilleId: string) => programmes.filter(p => p.portefeuille_id === portefeuilleId),
    [programmes])
  const programmesAutonomes = useMemo(() => programmes.filter(p => !p.portefeuille_id), [programmes])
  const projetsDuProgramme = useCallback(
    (programmeId: string) => projets.filter(p => p.programme_id === programmeId),
    [projets])
  const projetsDirects = useCallback(
    (portefeuilleId: string) => projets.filter(p => !p.programme_id && p.portefeuille_id === portefeuilleId),
    [projets])
  const projetsAutonomes = useMemo(
    () => projets.filter(p => !p.programme_id && !p.portefeuille_id),
    [projets])

  const supprimer = (kind: CreateKind, id: string, nom: string) => {
    if (!window.confirm(`Supprimer « ${nom} » ? Les éléments rattachés deviendront autonomes.`)) return
    const route = kind === 'portefeuille' ? 'portefeuilles' : kind === 'programme' ? 'programmes' : 'operations'
    run(() => apiJson(`${BASE}/${route}?id=${id}`, { method: 'DELETE' }))
  }

  if (!loaded) return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Chargement de la carte de valeur…</p>

  const isEmpty = portefeuilles.length === 0 && programmes.length === 0 && projets.length === 0 && operations.length === 0

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400 flex items-start justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="shrink-0 font-medium hover:underline">Fermer</button>
        </div>
      )}

      {/* Bandeau stratégie + flux d'information */}
      <div className="rounded-xl border p-4" style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎯</span>
            <div>
              <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-300">Direction &amp; stratégie</h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Le système de création de valeur (PMI) : la stratégie descend vers les portefeuilles,
                programmes et projets ; l’information de performance remonte.
              </p>
            </div>
          </div>
          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setCreateKind('portefeuille')}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
                + Portefeuille
              </button>
              <button onClick={() => setCreateKind('programme')}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition-colors">
                + Programme
              </button>
              <button onClick={() => setCreateKind('operation')}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors">
                + Opération
              </button>
            </div>
          )}
        </div>
        {/* Flèches de flux */}
        <div className="mt-3 flex items-center justify-center gap-8 text-xs font-medium">
          <span className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300">
            <FlowArrow direction="down" /> Stratégie
          </span>
          <span className="flex items-center gap-1.5 text-teal-700 dark:text-teal-300">
            <FlowArrow direction="up" /> Information de performance
          </span>
        </div>
      </div>

      {isEmpty ? (
        <div className="rounded-xl border border-dashed p-10 text-center space-y-2" style={{ borderColor: 'var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            La carte est vide : créez un portefeuille ou un programme, ou rattachez vos projets existants.
          </p>
        </div>
      ) : (
        <>
          {/* Carte de création de valeur */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Portefeuilles */}
            {portefeuilles.map(pf => (
              <div key={pf.id}
                className="rounded-xl border-2 p-4 space-y-3 border-indigo-300 dark:border-indigo-700"
                style={{ background: 'var(--card-bg)' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                      <span aria-hidden>🗂️</span>
                      <span className="truncate" title={pf.objectifs_strategiques ?? undefined}>{pf.nom}</span>
                    </h4>
                    {pf.objectifs_strategiques && (
                      <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-muted)' }}
                        title={pf.objectifs_strategiques}>
                        🎯 {pf.objectifs_strategiques}
                      </p>
                    )}
                    {pf.description && <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{pf.description}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300"
                      title="Programmes / projets du portefeuille">
                      {pf.nb_programmes} pgm · {pf.nb_projets} prj
                    </span>
                    {!readOnly && (
                      <button onClick={() => supprimer('portefeuille', pf.id, pf.nom)} title="Supprimer le portefeuille"
                        className="text-xs opacity-50 hover:opacity-100 transition-opacity">🗑</button>
                    )}
                  </div>
                </div>

                {/* Programmes du portefeuille */}
                <div className="space-y-2">
                  {programmesDe(pf.id).map(pg => (
                    <ProgrammeBloc key={pg.id} programme={pg} projets={projetsDuProgramme(pg.id)}
                      readOnly={readOnly} onOpenProjet={onOpenProjet}
                      onAttach={() => setAttachTarget({ type: 'programme', id: pg.id, nom: pg.nom, current: currentOfProgramme(pg) })}
                      onAttachProjet={p => setAttachTarget({ type: 'projet', id: p.id, nom: p.nom, current: currentOfProjet(p) })}
                      onDelete={() => supprimer('programme', pg.id, pg.nom)} />
                  ))}
                  {/* Projets rattachés directement au portefeuille */}
                  {projetsDirects(pf.id).length > 0 && (
                    <div className="rounded-lg border border-dashed p-2.5" style={{ borderColor: 'var(--border)' }}>
                      <p className="text-[10px] uppercase tracking-wide font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                        Projets directs
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {projetsDirects(pf.id).map(p => (
                          <ProjetChip key={p.id} projet={p} readOnly={readOnly}
                            onOpen={() => onOpenProjet(p.id)}
                            onAttach={() => setAttachTarget({ type: 'projet', id: p.id, nom: p.nom, current: currentOfProjet(p) })} />
                        ))}
                      </div>
                    </div>
                  )}
                  {programmesDe(pf.id).length === 0 && projetsDirects(pf.id).length === 0 && (
                    <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
                      Aucun programme ni projet rattaché pour l’instant.
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* Programmes autonomes + projets autonomes */}
            {(programmesAutonomes.length > 0 || projetsAutonomes.length > 0) && (
              <div className="rounded-xl border-2 border-dashed p-4 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--card-bg)' }}>
                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">Hors portefeuille</h4>
                {programmesAutonomes.map(pg => (
                  <ProgrammeBloc key={pg.id} programme={pg} projets={projetsDuProgramme(pg.id)}
                    readOnly={readOnly} onOpenProjet={onOpenProjet}
                    onAttach={() => setAttachTarget({ type: 'programme', id: pg.id, nom: pg.nom, current: currentOfProgramme(pg) })}
                    onAttachProjet={p => setAttachTarget({ type: 'projet', id: p.id, nom: p.nom, current: currentOfProjet(p) })}
                    onDelete={() => supprimer('programme', pg.id, pg.nom)} />
                ))}
                {projetsAutonomes.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      Projets autonomes
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {projetsAutonomes.map(p => (
                        <ProjetChip key={p.id} projet={p} readOnly={readOnly}
                          onOpen={() => onOpenProjet(p.id)}
                          onAttach={() => setAttachTarget({ type: 'projet', id: p.id, nom: p.nom, current: currentOfProjet(p) })} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Barre Opérations */}
          <div className="rounded-xl border-2 p-4 space-y-2 border-teal-300 dark:border-teal-700" style={{ background: 'var(--card-bg)' }}>
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-teal-700 dark:text-teal-300 flex items-center gap-1.5">
                <span aria-hidden>⚙️</span> Opérations
                <span className="font-normal text-xs" style={{ color: 'var(--text-muted)' }}>
                  — activités permanentes issues des livrables des projets
                </span>
              </h4>
            </div>
            {operations.length === 0 ? (
              <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>Aucune activité opérationnelle pour l’instant.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {operations.map(op => (
                  <div key={op.id} className="rounded-lg border p-2.5 flex items-start justify-between gap-2"
                    style={{ borderColor: 'var(--border)' }}>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900 dark:text-white truncate" title={op.description ?? undefined}>
                        {op.nom}
                      </p>
                      {op.projet_source && (
                        <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                          ← livrable de : {op.projet_source.nom}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {readOnly ? (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${op.statut === 'active'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                          {op.statut === 'active' ? 'Active' : 'Arrêtée'}
                        </span>
                      ) : (
                        <button
                          onClick={() => run(() => patchJson(`${BASE}/operations`, { id: op.id, statut: op.statut === 'active' ? 'arretee' : 'active' }))}
                          title="Basculer le statut"
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold transition-opacity hover:opacity-80 ${op.statut === 'active'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                          {op.statut === 'active' ? 'Active' : 'Arrêtée'}
                        </button>
                      )}
                      {!readOnly && (
                        <button onClick={() => supprimer('operation', op.id, op.nom)} title="Supprimer l’opération"
                          className="text-xs opacity-50 hover:opacity-100 transition-opacity">🗑</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modales */}
      {createKind && !readOnly && (
        <CreateEntiteModal kind={createKind} organisationId={organisationId}
          portefeuilles={portefeuilles} projets={projets}
          onClose={() => setCreateKind(null)}
          onCreated={async () => { setCreateKind(null); await reload() }}
          onError={m => { setCreateKind(null); setError(m) }} />
      )}
      {attachTarget && !readOnly && (
        <AttachModal target={attachTarget} portefeuilles={portefeuilles} programmes={programmes}
          onClose={() => setAttachTarget(null)}
          onDone={async () => { setAttachTarget(null); await reload() }}
          onError={m => { setAttachTarget(null); setError(m) }} />
      )}
    </div>
  )
}

// ── Flèche de flux (SVG maison) ───────────────────────────────────────────────

function FlowArrow({ direction }: { direction: 'down' | 'up' }) {
  return (
    <svg width="14" height="20" viewBox="0 0 14 20" aria-hidden="true"
      className={direction === 'up' ? 'rotate-180' : ''}>
      <line x1="7" y1="2" x2="7" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M2 11 L7 18 L12 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Bloc programme ────────────────────────────────────────────────────────────

function ProgrammeBloc({ programme, projets, readOnly, onOpenProjet, onAttach, onAttachProjet, onDelete }: {
  programme: Programme
  projets: ProjetLite[]
  readOnly: boolean
  onOpenProjet: (id: string) => void
  onAttach: () => void
  onAttachProjet: (p: ProjetLite) => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-lg border p-2.5 space-y-1.5 border-violet-300 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-900/10">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold text-violet-700 dark:text-violet-300 min-w-0 truncate"
          title={programme.description ?? undefined}>
          📦 {programme.nom}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300"
            title="Projets du programme">
            {programme.nb_projets} prj
          </span>
          {!readOnly && (
            <>
              <button onClick={onAttach} title="Déplacer vers un autre portefeuille"
                className="text-[11px] font-medium px-1.5 py-0.5 rounded border border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors">↪ Déplacer</button>
              <button onClick={onDelete} title="Supprimer le programme"
                className="text-xs opacity-50 hover:opacity-100 transition-opacity">🗑</button>
            </>
          )}
        </div>
      </div>
      {projets.length === 0 ? (
        <p className="text-[11px] italic" style={{ color: 'var(--text-muted)' }}>Aucun projet rattaché.</p>
      ) : (
        <ul className="space-y-1">
          {projets.map(p => (
            <li key={p.id} className="flex items-center gap-1.5 text-xs">
              <span aria-hidden style={{ color: 'var(--text-muted)' }}>•</span>
              <button onClick={() => onOpenProjet(p.id)}
                className="min-w-0 truncate text-left font-medium text-gray-900 dark:text-white hover:underline">
                {p.nom}
              </button>
              <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PHASE_BADGES[p.phase] ?? PHASE_BADGES.pre_project}`}>
                {PHASE_LABELS[p.phase] ?? p.phase}
              </span>
              {!readOnly && (
                <button onClick={() => onAttachProjet(p)} title="Déplacer vers un autre portefeuille ou programme"
                  className="shrink-0 text-[11px] px-1 rounded border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors">↪</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Chip projet (projets directs / autonomes) ─────────────────────────────────

function ProjetChip({ projet, readOnly, onOpen, onAttach }: {
  projet: ProjetLite
  readOnly: boolean
  onOpen: () => void
  onAttach: () => void
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border pl-2.5 pr-1.5 py-1 text-xs"
      style={{ borderColor: 'var(--border)' }}>
      <button onClick={onOpen} className="font-medium text-gray-900 dark:text-white hover:underline max-w-[14rem] truncate">
        {projet.nom}
      </button>
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PHASE_BADGES[projet.phase] ?? PHASE_BADGES.pre_project}`}>
        {PHASE_LABELS[projet.phase] ?? projet.phase}
      </span>
      {!readOnly && (
        <button onClick={onAttach} title="Déplacer vers un autre portefeuille ou programme"
          className="text-[11px] px-1 rounded border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors">↪</button>
      )}
    </span>
  )
}

// ── Modale de création (portefeuille / programme / opération) ─────────────────

const KIND_META: Record<CreateKind, { titre: string; couleur: string }> = {
  portefeuille: { titre: 'Nouveau portefeuille', couleur: 'text-indigo-700 dark:text-indigo-300' },
  programme: { titre: 'Nouveau programme', couleur: 'text-violet-700 dark:text-violet-300' },
  operation: { titre: 'Nouvelle opération', couleur: 'text-teal-700 dark:text-teal-300' },
}

function CreateEntiteModal({ kind, organisationId, portefeuilles, projets, onClose, onCreated, onError }: {
  kind: CreateKind
  organisationId: string
  portefeuilles: Portefeuille[]
  projets: ProjetLite[]
  onClose: () => void
  onCreated: () => Promise<void>
  onError: (m: string) => void
}) {
  const [nom, setNom] = useState('')
  const [description, setDescription] = useState('')
  const [objectifs, setObjectifs] = useState('')
  const [rattachement, setRattachement] = useState('')
  const [saving, setSaving] = useState(false)

  const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500'
  const labelCls = 'block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300'
  const meta = KIND_META[kind]

  const create = async () => {
    if (!nom.trim()) return
    setSaving(true)
    try {
      const base = { organisation_id: organisationId, nom: nom.trim(), description: description.trim() || undefined }
      if (kind === 'portefeuille') {
        await postJson(`${BASE}/portefeuilles`, { ...base, objectifs_strategiques: objectifs.trim() || undefined })
      } else if (kind === 'programme') {
        await postJson(`${BASE}/programmes`, { ...base, portefeuille_id: rattachement || undefined })
      } else {
        await postJson(`${BASE}/operations`, { ...base, projet_source_id: rattachement || undefined })
      }
      await onCreated()
    } catch (e) { onError(String((e as Error).message ?? e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border shadow-xl p-5 space-y-4"
        style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <h3 className={`text-base font-bold ${meta.couleur}`}>{meta.titre}</h3>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Nom *</label>
            <input className={inputCls} style={{ borderColor: 'var(--border)' }}
              value={nom} onChange={e => setNom(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea rows={2} className={inputCls} style={{ borderColor: 'var(--border)' }}
              value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          {kind === 'portefeuille' && (
            <div>
              <label className={labelCls}>Objectifs stratégiques</label>
              <textarea rows={2} className={inputCls} style={{ borderColor: 'var(--border)' }}
                value={objectifs} onChange={e => setObjectifs(e.target.value)} />
            </div>
          )}
          {kind === 'programme' && (
            <div>
              <label className={labelCls}>Portefeuille de rattachement</label>
              <select className={inputCls} style={{ borderColor: 'var(--border)' }}
                value={rattachement} onChange={e => setRattachement(e.target.value)}>
                <option value="">Autonome (hors portefeuille)</option>
                {portefeuilles.map(pf => <option key={pf.id} value={pf.id}>{pf.nom}</option>)}
              </select>
            </div>
          )}
          {kind === 'operation' && (
            <div>
              <label className={labelCls}>Projet source du livrable</label>
              <select className={inputCls} style={{ borderColor: 'var(--border)' }}
                value={rattachement} onChange={e => setRattachement(e.target.value)}>
                <option value="">Aucun projet source</option>
                {projets.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors">
            Annuler
          </button>
          <button onClick={create} disabled={saving || !nom.trim()}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50">
            {saving ? 'Création…' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modale « Rattacher à… » ───────────────────────────────────────────────────

function AttachModal({ target, portefeuilles, programmes, onClose, onDone, onError }: {
  target: AttachTarget
  portefeuilles: Portefeuille[]
  programmes: Programme[]
  onClose: () => void
  onDone: () => Promise<void>
  onError: (m: string) => void
}) {
  // Valeur encodée : '' = autonome ; 'pf:<id>' = portefeuille ; 'pg:<id>' = programme
  const [valeur, setValeur] = useState(target.current)
  const [saving, setSaving] = useState(false)

  const apply = async () => {
    setSaving(true)
    try {
      if (target.type === 'programme') {
        await patchJson(`${BASE}/programmes`, {
          id: target.id,
          portefeuille_id: valeur.startsWith('pf:') ? valeur.slice(3) : null,
        })
      } else {
        const body: { id: string; programme_id: string | null; portefeuille_id: string | null } = {
          id: target.id, programme_id: null, portefeuille_id: null,
        }
        if (valeur.startsWith('pg:')) body.programme_id = valeur.slice(3)
        else if (valeur.startsWith('pf:')) body.portefeuille_id = valeur.slice(3)
        await patchJson(`${BASE}/projets`, body)
      }
      await onDone()
    } catch (e) { onError(String((e as Error).message ?? e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border shadow-xl p-5 space-y-4"
        style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold text-indigo-700 dark:text-indigo-300">
          Déplacer « {target.nom} » vers…
        </h3>
        <select
          className="w-full px-3 py-2 text-sm rounded-lg border bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          style={{ borderColor: 'var(--border)' }}
          value={valeur} onChange={e => setValeur(e.target.value)}>
          <option value="">Autonome (aucun rattachement)</option>
          <optgroup label="Portefeuilles">
            {portefeuilles.map(pf => <option key={pf.id} value={`pf:${pf.id}`}>{pf.nom}</option>)}
          </optgroup>
          {target.type === 'projet' && (
            <optgroup label="Programmes">
              {programmes.map(pg => <option key={pg.id} value={`pg:${pg.id}`}>{pg.nom}</option>)}
            </optgroup>
          )}
        </select>
        {target.type === 'projet' && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Un projet rattaché à un programme apparaît dans ce programme ; rattaché à un portefeuille,
            il apparaît comme projet direct du portefeuille.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors">
            Annuler
          </button>
          <button onClick={apply} disabled={saving}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50">
            {saving ? 'Enregistrement…' : 'Déplacer'}
          </button>
        </div>
      </div>
    </div>
  )
}

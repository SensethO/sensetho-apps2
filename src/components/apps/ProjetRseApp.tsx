'use client'

// App « Projet RSE » — gestion de projet RSE selon la méthode PRiSM :
// cycle de vie en 5 phases (Avant-projet → Découverte → Conception →
// Réalisation → Clôture) avec revues de fin de phase (Go / No-Go /
// Conditionnel) qui interrogent la validité du business case et le respect
// des seuils d'impact. Architecture MODULAIRE : les sous-applications sont
// enregistrées dans src/lib/projetRseModules.tsx et montées en onglets
// autour du projet courant.
//
// API : /api/projet-rse (projets, revues, parties, engagements, import-parties)

import { useState, useEffect, useCallback } from 'react'
import type { RseContext } from '@/components/rse/RseAppShell'
import { PROJET_RSE_MODULES } from '@/lib/projetRseModules'
import ProjetRseValeurView from '@/components/apps/ProjetRseValeurView'
import ProjetRseRegistreView from './ProjetRseRegistreView'

// ── Types (contrat API) ───────────────────────────────────────────────────────

type Statut = 'actif' | 'suspendu' | 'clos'
type Phase = 'pre_project' | 'discovery' | 'design' | 'delivery' | 'closure'
type Decision = 'go' | 'no_go' | 'conditionnel'

interface Projet {
  id: string
  nom: string
  description: string | null
  contexte: string | null
  statut: Statut
  phase: Phase
  date_debut: string | null
  date_fin_prevue: string | null
  business_case: string | null
  created_at: string
}

interface Revue {
  id: string
  phase: Phase
  decision: Decision
  commentaire: string | null
  business_case_valide: boolean
  seuils_respectes: boolean
  decide_le: string
}

// ── Libellés ──────────────────────────────────────────────────────────────────

const PHASES: { value: Phase; label: string }[] = [
  { value: 'pre_project', label: 'Avant-projet' },
  { value: 'discovery', label: 'Découverte' },
  { value: 'design', label: 'Conception' },
  { value: 'delivery', label: 'Réalisation' },
  { value: 'closure', label: 'Clôture' },
]

const STATUTS: Record<Statut, { label: string; badge: string }> = {
  actif: { label: 'Actif', badge: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  suspendu: { label: 'Suspendu', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  clos: { label: 'Clos', badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
}

const DECISIONS: Record<Decision, { label: string; badge: string }> = {
  go: { label: 'GO', badge: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  no_go: { label: 'NO-GO', badge: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  conditionnel: { label: 'Conditionnel', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
}

function phaseLabel(p: Phase): string { return PHASES.find(x => x.value === p)?.label ?? p }
function phaseIndex(p: Phase): number { return Math.max(0, PHASES.findIndex(x => x.value === p)) }

function formatDateFr(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function ProjetRseApp({ ctx }: { ctx: RseContext }) {
  const orgId = ctx.org?.id ?? null
  const readOnly = ctx.isShared

  const [projets, setProjets] = useState<Projet[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Projet | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [vue, setVue] = useState<'projets' | 'valeur' | 'registre'>('projets')

  // ── Chargement des projets ──
  const loadProjets = useCallback(async (): Promise<Projet[]> => {
    if (!orgId) return []
    try {
      const res = await fetch(`/api/projet-rse/projets?organisation_id=${orgId}`)
      const j = await res.json()
      if (!res.ok) throw new Error((j as { error?: string }).error ?? 'Erreur de chargement des projets')
      const list = ((j as { projets?: Projet[] }).projets) ?? []
      setProjets(list)
      return list
    } catch (e) { setError(String((e as Error).message ?? e)); return [] }
    finally { setLoaded(true) }
  }, [orgId])

  useEffect(() => { setSelected(null); setLoaded(false); loadProjets() }, [loadProjets])

  // Recharge le projet sélectionné (après revue GO, la phase avance côté serveur)
  const refreshSelected = useCallback(async (id: string) => {
    const list = await loadProjets()
    const p = list.find(x => x.id === id)
    if (p) setSelected(p)
  }, [loadProjets])

  // ── Header actions ──
  useEffect(() => {
    if (!orgId) { ctx.setActions(null); return }
    ctx.setActions(
      <div className="flex items-center gap-2">
        {selected ? (
          <button onClick={() => setSelected(null)}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors">
            ← Projets
          </button>
        ) : (!readOnly && (
          <button onClick={() => setShowCreate(true)}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
            + Nouveau projet
          </button>
        ))}
      </div>
    )
    return () => ctx.setActions(null)
  }, [orgId, selected, readOnly, ctx])

  if (!orgId) {
    return <p className="text-sm p-4" style={{ color: 'var(--text-muted)' }}>Sélectionnez une organisation.</p>
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400 flex items-start justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="shrink-0 font-medium hover:underline">Fermer</button>
        </div>
      )}

      {selected ? (
        <ProjetDetail projet={selected} organisationId={orgId} readOnly={readOnly}
          onProjetChanged={() => refreshSelected(selected.id)} onError={setError} />
      ) : (
        <>
          {/* Sélecteur de vue (liste uniquement) */}
          <div className="inline-flex rounded-lg border p-0.5" style={{ borderColor: 'var(--border)', background: 'var(--card-bg)' }}>
            {([
              { id: 'projets' as const, label: '📁 Projets' },
              { id: 'valeur' as const, label: '🏛️ Création de valeur' },
              { id: 'registre' as const, label: '👥 Registre des parties prenantes' },
            ]).map(v => (
              <button key={v.id} onClick={() => setVue(v.id)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${vue === v.id
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}>
                {v.label}
              </button>
            ))}
          </div>
          {vue === 'projets' && (
            <ProjetsList projets={projets} loaded={loaded} readOnly={readOnly}
              onOpen={setSelected} onCreate={() => setShowCreate(true)} />
          )}
          {vue === 'valeur' && (
            <ProjetRseValeurView organisationId={orgId} readOnly={readOnly}
              onOpenProjet={(projetId) => {
                const p = projets.find(x => x.id === projetId)
                if (p) setSelected(p)
              }} />
          )}
          {vue === 'registre' && (
            <ProjetRseRegistreView organisationId={orgId} readOnly={readOnly} />
          )}
        </>
      )}

      {showCreate && !readOnly && (
        <CreateModal organisationId={orgId}
          onClose={() => setShowCreate(false)}
          onCreated={async (p) => { setShowCreate(false); await loadProjets(); setSelected(p) }}
          onError={setError} />
      )}
    </div>
  )
}

// ── Fil d'avancement du projet ────────────────────────────────────────────────

interface EntreeJournal {
  id: string
  type: string
  texte: string
  created_at: string
}

const JOURNAL_BADGES: Record<string, string> = {
  acteur: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  rattachement: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  structure: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  revue: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  note: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
}
const JOURNAL_LABELS: Record<string, string> = {
  acteur: 'Partie prenante', rattachement: 'Rattachement',
  structure: 'Structure', revue: 'Revue', jalon: 'Jalon', note: 'Note',
}

function JournalProjet({ projetId, organisationId }: { projetId: string; organisationId: string }) {
  const [entrees, setEntrees] = useState<EntreeJournal[]>([])
  const [ouvert, setOuvert] = useState(false)

  useEffect(() => {
    let vivant = true
    ;(async () => {
      try {
        const res = await fetch(
          `/api/projet-rse/journal?organisation_id=${organisationId}&projet_id=${projetId}`)
        if (!res.ok) return
        const j = await res.json()
        if (vivant) setEntrees(j.entrees ?? [])
      } catch { /* le fil est un complément : son échec ne bloque pas la page */ }
    })()
    return () => { vivant = false }
  }, [projetId, organisationId])

  if (!entrees.length) return null

  return (
    <div>
      <button onClick={() => setOuvert(v => !v)}
        className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
        {ouvert ? '▾' : '▸'} Fil d’avancement ({entrees.length})
      </button>
      {ouvert && (
        <div className="mt-2 divide-y" style={{ borderColor: 'var(--border)' }}>
          {entrees.map(e => (
            <div key={e.id} className="py-2 flex flex-wrap items-start gap-2 text-xs">
              <span className={`inline-block px-2 py-0.5 rounded-full font-semibold ${JOURNAL_BADGES[e.type] ?? JOURNAL_BADGES.note}`}>
                {JOURNAL_LABELS[e.type] ?? e.type}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>{formatDateFr(e.created_at)}</span>
              <span className="w-full text-gray-800 dark:text-gray-200">{e.texte}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Liste des projets ─────────────────────────────────────────────────────────

function ProjetsList({ projets, loaded, readOnly, onOpen, onCreate }: {
  projets: Projet[]
  loaded: boolean
  readOnly: boolean
  onOpen: (p: Projet) => void
  onCreate: () => void
}) {
  if (!loaded) return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Chargement…</p>
  if (projets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center space-y-3" style={{ borderColor: 'var(--border)' }}>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Aucun projet RSE pour cette organisation.
        </p>
        {!readOnly && (
          <button onClick={onCreate}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
            + Créer le premier projet
          </button>
        )}
      </div>
    )
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {projets.map(p => {
        const st = STATUTS[p.statut] ?? STATUTS.actif
        return (
          <button key={p.id} onClick={() => onOpen(p)}
            className="text-left rounded-xl border p-4 space-y-2 hover:shadow-md transition-shadow"
            style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">{p.nom}</h3>
              <span className={`shrink-0 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${st.badge}`}>{st.label}</span>
            </div>
            {p.description && <p className="text-xs line-clamp-2" style={{ color: 'var(--text-muted)' }}>{p.description}</p>}
            <p className="text-xs font-medium text-indigo-700 dark:text-indigo-400">Phase : {phaseLabel(p.phase)}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {formatDateFr(p.date_debut)} → {formatDateFr(p.date_fin_prevue)}
            </p>
          </button>
        )
      })}
    </div>
  )
}

// ── Création ──────────────────────────────────────────────────────────────────

function CreateModal({ organisationId, onClose, onCreated, onError }: {
  organisationId: string
  onClose: () => void
  onCreated: (p: Projet) => void
  onError: (m: string) => void
}) {
  const [nom, setNom] = useState('')
  const [description, setDescription] = useState('')
  const [contexte, setContexte] = useState('')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [saving, setSaving] = useState(false)

  const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500'
  const labelCls = 'block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300'

  const create = async () => {
    if (!nom.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/projet-rse/projets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organisation_id: organisationId,
          nom: nom.trim(),
          description: description.trim() || undefined,
          contexte: contexte.trim() || undefined,
          date_debut: dateDebut || undefined,
          date_fin_prevue: dateFin || undefined,
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error((j as { error?: string }).error ?? 'Erreur de création du projet')
      onCreated((j as { projet: Projet }).projet)
    } catch (e) { onError(String((e as Error).message ?? e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border shadow-xl p-5 space-y-4"
        style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold text-indigo-700 dark:text-indigo-300">Nouveau projet RSE</h3>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Nom du projet *</label>
            <input className={inputCls} style={{ borderColor: 'var(--border)' }} value={nom} onChange={e => setNom(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea rows={2} className={inputCls} style={{ borderColor: 'var(--border)' }} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Contexte (enjeux, origine de la demande)</label>
            <textarea rows={2} className={inputCls} style={{ borderColor: 'var(--border)' }} value={contexte} onChange={e => setContexte(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Date de début</label>
              <input type="date" className={inputCls} style={{ borderColor: 'var(--border)' }} value={dateDebut} onChange={e => setDateDebut(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Fin prévue</label>
              <input type="date" className={inputCls} style={{ borderColor: 'var(--border)' }} value={dateFin} onChange={e => setDateFin(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors">
            Annuler
          </button>
          <button onClick={create} disabled={saving || !nom.trim()}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50">
            {saving ? 'Création…' : 'Créer le projet'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Détail projet ─────────────────────────────────────────────────────────────

function ProjetDetail({ projet, organisationId, readOnly, onProjetChanged, onError }: {
  projet: Projet
  organisationId: string
  readOnly: boolean
  onProjetChanged: () => Promise<void> | void
  onError: (m: string) => void
}) {
  const [revues, setRevues] = useState<Revue[]>([])
  const [showRevue, setShowRevue] = useState(false)
  const [showHistorique, setShowHistorique] = useState(false)

  const defaultModule = PROJET_RSE_MODULES.find(m => m.statut === 'disponible')?.id ?? PROJET_RSE_MODULES[0]?.id ?? ''
  const [moduleId, setModuleId] = useState(defaultModule)
  const activeModule = PROJET_RSE_MODULES.find(m => m.id === moduleId)

  const loadRevues = useCallback(async () => {
    try {
      const res = await fetch(`/api/projet-rse/projets/${projet.id}/revues`)
      const j = await res.json()
      if (!res.ok) throw new Error((j as { error?: string }).error ?? 'Erreur de chargement des revues')
      setRevues(((j as { revues?: Revue[] }).revues) ?? [])
    } catch (e) { onError(String((e as Error).message ?? e)) }
  }, [projet.id, onError])

  useEffect(() => { loadRevues() }, [loadRevues])

  const st = STATUTS[projet.statut] ?? STATUTS.actif
  const currentIdx = phaseIndex(projet.phase)
  const isLastPhase = currentIdx === PHASES.length - 1

  return (
    <div className="space-y-5">
      {/* En-tête projet */}
      <div className="rounded-xl border p-4 space-y-2" style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{projet.nom}</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {formatDateFr(projet.date_debut)} → {formatDateFr(projet.date_fin_prevue)}
              {readOnly ? ' · lecture seule (dossier partagé)' : ''}
            </p>
          </div>
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${st.badge}`}>{st.label}</span>
        </div>
        {projet.description && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{projet.description}</p>}
        {projet.contexte && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="font-semibold text-gray-800 dark:text-gray-200">Contexte : </span>{projet.contexte}
          </p>
        )}
      </div>

      {/* Frise du cycle PRiSM */}
      <div className="rounded-xl border p-4 space-y-3" style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-teal-700 dark:text-teal-300">Cycle de vie PRiSM</h3>
          {!readOnly && (
            <button onClick={() => setShowRevue(true)}
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
              🚦 Revue de fin de phase
            </button>
          )}
        </div>
        <div className="flex items-start">
          {PHASES.map((ph, i) => {
            const done = i < currentIdx
            const current = i === currentIdx
            return (
              <div key={ph.value} className="flex-1 flex flex-col items-center relative">
                {/* Segment de liaison */}
                {i > 0 && (
                  <div className={`absolute top-4 right-1/2 w-full h-0.5 ${i <= currentIdx ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                )}
                <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                  done ? 'bg-indigo-500 border-indigo-500 text-white'
                    : current ? 'bg-indigo-100 dark:bg-indigo-900/50 border-indigo-500 text-indigo-700 dark:text-indigo-300 ring-4 ring-indigo-500/20'
                      : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500'}`}>
                  {done ? '✓' : i + 1}
                </div>
                <p className={`mt-1.5 text-xs text-center px-1 ${current ? 'font-bold text-indigo-700 dark:text-indigo-300' : done ? 'font-medium text-gray-700 dark:text-gray-300' : ''}`}
                  style={current || done ? undefined : { color: 'var(--text-muted)' }}>
                  {ph.label}
                </p>
              </div>
            )
          })}
        </div>

        {/* Historique des revues */}
        <div>
          <button onClick={() => setShowHistorique(v => !v)}
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
            {showHistorique ? '▾' : '▸'} Historique des revues ({revues.length})
          </button>
          {showHistorique && (
            revues.length === 0 ? (
              <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>Aucune revue de fin de phase pour l’instant.</p>
            ) : (
              <div className="mt-2 divide-y" style={{ borderColor: 'var(--border)' }}>
                {revues.map(r => {
                  const dec = DECISIONS[r.decision] ?? DECISIONS.conditionnel
                  return (
                    <div key={r.id} className="py-2 flex flex-wrap items-start gap-2 text-xs">
                      <span className={`inline-block px-2 py-0.5 rounded-full font-semibold ${dec.badge}`}>{dec.label}</span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">{phaseLabel(r.phase)}</span>
                      <span style={{ color: 'var(--text-muted)' }}>· {formatDateFr(r.decide_le)}</span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        · Business case {r.business_case_valide ? 'valide ✓' : 'à revoir ✗'} · Seuils {r.seuils_respectes ? 'respectés ✓' : 'dépassés ✗'}
                      </span>
                      {r.commentaire && <span className="w-full" style={{ color: 'var(--text-muted)' }}>{r.commentaire}</span>}
                    </div>
                  )
                })}
              </div>
            )
          )}
        </div>

        {/* Fil d'avancement : les changements de parties prenantes y sont reportés
            avec leur contexte, ce qui rend lisible, plus tard, qu'un interlocuteur
            a changé en cours de route et pour quelle raison. */}
        <JournalProjet projetId={projet.id} organisationId={organisationId} />
      </div>

      {/* Onglets modules (générés depuis le registre) */}
      <div className="flex gap-1 border-b overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        {PROJET_RSE_MODULES.map(m => (
          <button key={m.id} onClick={() => setModuleId(m.id)}
            className={`px-3 py-2 text-sm whitespace-nowrap transition-colors ${moduleId === m.id
              ? 'text-indigo-700 dark:text-indigo-400 font-semibold border-b-2 border-indigo-500'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            {m.icon} {m.label}{m.statut === 'a_venir' ? ' ·' : ''}
            {m.statut === 'a_venir' && <span className="ml-1 text-[10px] uppercase tracking-wide opacity-70">bientôt</span>}
          </button>
        ))}
      </div>

      {activeModule && (
        activeModule.statut === 'disponible' && activeModule.Component ? (
          <activeModule.Component projetId={projet.id} organisationId={organisationId} phase={projet.phase} readOnly={readOnly} />
        ) : (
          <div className="rounded-xl border border-dashed p-8 text-center space-y-3 max-w-2xl mx-auto" style={{ borderColor: 'var(--border)' }}>
            <p className="text-3xl">{activeModule.icon}</p>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">{activeModule.label}</h3>
            <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Sous-application à venir</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{activeModule.description}</p>
          </div>
        )
      )}

      {/* Modale de revue */}
      {showRevue && !readOnly && (
        <RevueModal projet={projet}
          onClose={() => setShowRevue(false)}
          onDone={async () => { setShowRevue(false); await loadRevues(); await onProjetChanged() }}
          onError={onError}
          isLastPhase={isLastPhase} />
      )}
    </div>
  )
}

// ── Modale de revue de fin de phase ───────────────────────────────────────────

function RevueModal({ projet, onClose, onDone, onError, isLastPhase }: {
  projet: Projet
  onClose: () => void
  onDone: () => Promise<void>
  onError: (m: string) => void
  isLastPhase: boolean
}) {
  const [decision, setDecision] = useState<Decision>('go')
  const [bcValide, setBcValide] = useState(true)
  const [seuilsOk, setSeuilsOk] = useState(true)
  const [commentaire, setCommentaire] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/projet-rse/projets/${projet.id}/revues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: projet.phase,
          decision,
          commentaire: commentaire.trim() || undefined,
          business_case_valide: bcValide,
          seuils_respectes: seuilsOk,
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error((j as { error?: string }).error ?? 'Erreur d’enregistrement de la revue')
      await onDone()
    } catch (e) { onError(String((e as Error).message ?? e)); setSaving(false) }
  }

  const decisionBtn = (d: Decision, label: string, activeCls: string) => (
    <button onClick={() => setDecision(d)}
      className={`flex-1 px-3 py-2 text-sm font-semibold rounded-lg border-2 transition-colors ${decision === d
        ? activeCls
        : 'border-transparent bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
      {label}
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border shadow-xl p-5 space-y-4"
        style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold text-indigo-700 dark:text-indigo-300">
          Revue de fin de phase — {phaseLabel(projet.phase)}
        </h3>
        <p className="text-xs rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 px-3 py-2 text-teal-800 dark:text-teal-300">
          🎓 La revue de fin de phase interroge deux choses : le business case est-il toujours valide, et les seuils d’impact
          (sociaux et environnementaux) sont-ils respectés ? Un GO fait passer le projet à la phase suivante.
        </p>

        <div className="flex gap-2">
          {decisionBtn('go', '✅ Go', 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300')}
          {decisionBtn('conditionnel', '⚠️ Conditionnel', 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300')}
          {decisionBtn('no_go', '⛔ No-Go', 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300')}
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
            <input type="checkbox" className="accent-indigo-600" checked={bcValide} onChange={e => setBcValide(e.target.checked)} />
            Le business case est toujours valide
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
            <input type="checkbox" className="accent-indigo-600" checked={seuilsOk} onChange={e => setSeuilsOk(e.target.checked)} />
            Les seuils d’impact sont respectés
          </label>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">Commentaire</label>
          <textarea rows={3}
            className="w-full px-3 py-2 text-sm rounded-lg border bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            style={{ borderColor: 'var(--border)' }}
            value={commentaire} onChange={e => setCommentaire(e.target.value)} />
        </div>

        {decision === 'go' && isLastPhase && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Le projet est en phase de clôture : un GO valide la fin du cycle.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors">
            Annuler
          </button>
          <button onClick={submit} disabled={saving}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50">
            {saving ? 'Enregistrement…' : 'Enregistrer la décision'}
          </button>
        </div>
      </div>
    </div>
  )
}

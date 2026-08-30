'use client'

// Fil d'avancement et panneau de sous-programme.
//
// Le fil est le même à tous les niveaux — portefeuille, programme,
// sous-programme, projet — parce que la question est la même : qu'est-ce qui a
// changé ici, quand, et pourquoi. Il n'était visible que sur le projet, alors
// que les entrées des autres niveaux s'écrivaient déjà.
//
// Le sous-programme, lui, n'avait aucune page : il existait en base et
// s'affichait comme regroupement, sans qu'on puisse l'éditer ni voir ce qui
// s'y passe. C'est pourtant le niveau où l'arbitrage entre projets se fait.

import { useCallback, useEffect, useState } from 'react'

const BASE = '/api/projet-rse'

export type NiveauCible = 'portefeuille' | 'programme' | 'sous_programme' | 'projet'
const COLONNE: Record<NiveauCible, string> = {
  portefeuille: 'portefeuille_id', programme: 'programme_id',
  sous_programme: 'sous_programme_id', projet: 'projet_id',
}

interface Entree { id: string; type: string; texte: string; created_at: string }

const BADGES: Record<string, string> = {
  acteur: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  rattachement: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  structure: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  revue: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  jalon: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  note: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
}
const LIBELLES: Record<string, string> = {
  acteur: 'Partie prenante', rattachement: 'Rattachement', structure: 'Structure',
  revue: 'Revue', jalon: 'Jalon', note: 'Note',
}

function dateFr(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—'
    : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Fil d'avancement d'un élément, à n'importe quel niveau. */
export function FilAvancement({ organisationId, niveau, cibleId, readOnly, replie }: {
  organisationId: string
  niveau: NiveauCible
  cibleId: string
  readOnly?: boolean
  /** Replié par défaut : utile sur une page déjà dense. */
  replie?: boolean
}) {
  const [entrees, setEntrees] = useState<Entree[]>([])
  const [ouvert, setOuvert] = useState(!replie)
  const [note, setNote] = useState('')
  const [enCours, setEnCours] = useState(false)

  const charger = useCallback(async () => {
    try {
      const r = await fetch(
        `${BASE}/journal?organisation_id=${organisationId}&${COLONNE[niveau]}=${cibleId}`)
      if (!r.ok) return
      setEntrees((await r.json()).entrees ?? [])
    } catch { /* le fil est un complément : son échec ne bloque rien */ }
  }, [organisationId, niveau, cibleId])

  useEffect(() => { void charger() }, [charger])

  const ajouter = async () => {
    if (!note.trim()) return
    setEnCours(true)
    try {
      await fetch(`${BASE}/journal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organisation_id: organisationId,
          [COLONNE[niveau]]: cibleId, texte: note.trim(), type: 'note' }),
      })
      setNote(''); await charger()
    } finally { setEnCours(false) }
  }

  return (
    <div>
      <button onClick={() => setOuvert(v => !v)}
        className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
        {ouvert ? '▾' : '▸'} Fil d’avancement ({entrees.length})
      </button>
      {ouvert && (
        <>
          {!readOnly && (
            <div className="mt-2 flex gap-2">
              <input value={note} onChange={e => setNote(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void ajouter() }}
                placeholder="Consigner une décision, un constat, un changement…"
                className="flex-1 rounded-md border px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                style={{ borderColor: 'var(--border)' }} />
              <button onClick={ajouter} disabled={enCours || !note.trim()}
                className="rounded-md bg-indigo-600 px-3 py-1 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                Consigner
              </button>
            </div>
          )}
          {entrees.length === 0 ? (
            <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              Rien de consigné à ce niveau pour l’instant.
            </p>
          ) : (
            <div className="mt-2 divide-y" style={{ borderColor: 'var(--border)' }}>
              {entrees.map(e => (
                <div key={e.id} className="py-2 flex flex-wrap items-start gap-2 text-xs">
                  <span className={`inline-block px-2 py-0.5 rounded-full font-semibold ${BADGES[e.type] ?? BADGES.note}`}>
                    {LIBELLES[e.type] ?? e.type}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>{dateFr(e.created_at)}</span>
                  <span className="w-full text-gray-800 dark:text-gray-200">{e.texte}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Panneau de sous-programme ───────────────────────────────────────────────

interface SousProgramme {
  id: string; programme_id: string; code: string; nom: string
  fonction: string | null; description: string | null; ordre: number
  nb_projets?: number; nb_actifs?: number; nb_suspendus?: number; nb_clos?: number
}
interface ProjetLite { id: string; nom: string; statut: string; phase: string; sous_programme_id: string | null }
interface ActeurLie { id: string; nom: string; role_local: string | null; criticite: string }

const inputCls = 'w-full rounded-md border px-2.5 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
const labelCls = 'block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400'

/**
 * Page d'un sous-programme : ce qu'il regroupe, ce qu'il remplit comme
 * fonction, qui le concerne, et ce qui s'y est passé.
 */
export function PanneauSousProgramme({ sousProgramme, organisationId, projets, readOnly, onClose, onChange }: {
  sousProgramme: SousProgramme
  organisationId: string
  projets: ProjetLite[]
  readOnly: boolean
  onClose: () => void
  onChange: () => void
}) {
  const sp = sousProgramme
  const [f, setF] = useState({ code: sp.code, nom: sp.nom,
    fonction: sp.fonction ?? '', description: sp.description ?? '' })
  const [acteurs, setActeurs] = useState<ActeurLie[]>([])
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let vivant = true
    ;(async () => {
      try {
        const r = await fetch(`${BASE}/acteurs/liens?sous_programme_id=${sp.id}`)
        if (r.ok && vivant) setActeurs((await r.json()).acteurs ?? [])
      } catch { /* complément */ }
    })()
    return () => { vivant = false }
  }, [sp.id])

  const miens = projets.filter(p => p.sous_programme_id === sp.id)

  const enregistrer = async () => {
    setEnCours(true); setMessage(null)
    try {
      const r = await fetch(`${BASE}/sous-programmes`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sp.id, ...f, fonction: f.fonction || null,
          description: f.description || null }),
      })
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? 'Enregistrement impossible')
      setMessage('Enregistré.'); onChange()
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)) }
    finally { setEnCours(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-xl border shadow-xl my-8"
        style={{ borderColor: 'var(--border)', background: 'var(--card-bg)' }}>
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {sp.code} — {sp.nom}
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Un sous-programme ne produit aucun livrable : il regroupe les projets qui concourent au même
              bénéfice, et c’est à ce niveau que l’arbitrage entre projets se fait.
            </p>
          </div>
          <button onClick={onClose} className="text-sm font-medium hover:underline"
            style={{ color: 'var(--text-muted)' }}>Fermer</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div><label className={labelCls}>Code</label>
              <input className={inputCls} style={{ borderColor: 'var(--border)' }} disabled={readOnly}
                value={f.code} onChange={e => setF({ ...f, code: e.target.value })} /></div>
            <div className="sm:col-span-3"><label className={labelCls}>Nom</label>
              <input className={inputCls} style={{ borderColor: 'var(--border)' }} disabled={readOnly}
                value={f.nom} onChange={e => setF({ ...f, nom: e.target.value })} /></div>
          </div>
          <div>
            <label className={labelCls}>Fonction remplie</label>
            <input className={inputCls} style={{ borderColor: 'var(--border)' }} disabled={readOnly}
              value={f.fonction} onChange={e => setF({ ...f, fonction: e.target.value })} />
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              Calquer les sous-programmes sur les fonctions à remplir, et non sur l’organigramme, évite
              qu’une direction s’approprie un sous-programme comme son domaine réservé.
            </p>
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea rows={3} className={inputCls} style={{ borderColor: 'var(--border)' }} disabled={readOnly}
              value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
          </div>
          {message && <p className="text-sm text-indigo-700 dark:text-indigo-300">{message}</p>}
          {!readOnly && (
            <div className="flex justify-end">
              <button onClick={enregistrer} disabled={enCours}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                {enCours ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          )}

          <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
            <h4 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
              Projets regroupés ({miens.length})
            </h4>
            {miens.length ? (
              <ul className="mt-2 space-y-1 text-sm">
                {miens.map(p => (
                  <li key={p.id} className="flex items-center gap-2">
                    <span className="text-gray-800 dark:text-gray-200">{p.nom}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                      p.statut === 'suspendu' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                      : p.statut === 'clos' ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'}`}>
                      {p.statut}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                Aucun projet rattaché. Un sous-programme vide n’arbitre rien.
              </p>
            )}
          </div>

          <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
            <h4 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
              Parties prenantes de ce niveau ({acteurs.length})
            </h4>
            {acteurs.length ? (
              <ul className="mt-2 space-y-1 text-sm">
                {acteurs.map(a => (
                  <li key={a.id}>
                    <span className="font-medium text-gray-900 dark:text-white">{a.nom}</span>
                    {a.role_local && (
                      <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>{a.role_local}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                Aucune partie prenante rattachée à ce niveau. Le pilote du sous-programme y a sa place.
              </p>
            )}
          </div>

          <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
            <FilAvancement organisationId={organisationId} niveau="sous_programme"
              cibleId={sp.id} readOnly={readOnly} />
          </div>
        </div>
      </div>
    </div>
  )
}

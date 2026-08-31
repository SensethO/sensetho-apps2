'use client'

// Registre des parties prenantes — niveau organisation.
//
// Une partie prenante y est enregistrée une seule fois et référencée par les
// éléments qu'elle concerne : portefeuille, programme, sous-programme, projet.
// La modifier ici la modifie partout. Le changement est daté, motivé, et
// reporté dans le fil d'avancement de chaque élément rattaché — ce qui permet,
// en relisant un projet plus tard, de constater qu'un interlocuteur a changé
// et de savoir pourquoi.

import { useCallback, useEffect, useMemo, useState } from 'react'
import ProjetRseNotesNiveauPanel from '@/components/apps/ProjetRseNotesNiveauPanel'

const BASE = '/api/projet-rse'

type TypeActeur = 'personne' | 'fonction' | 'collectif' | 'entite' | 'sans_voix'
type Categorie = 'verte' | 'orange' | 'bleue'
type Attitude = 'alliee' | 'ouverte' | 'neutre' | 'vigilante' | 'opposee'
type StatutSuivi = 'a_engager' | 'engagee' | 'a_risque' | 'ok'
type Niveau = 'peu_conscient' | 'resistant' | 'neutre' | 'solidaire' | 'leader'

interface Lien {
  niveau: 'portefeuille' | 'programme' | 'sous_programme' | 'projet'
  id: string
  nom: string
  role_local: string | null
}

interface Acteur {
  id: string
  nom: string
  organisation: string | null
  type: TypeActeur
  categorie: Categorie
  role: string | null
  pouvoir: number
  interet: number
  legitimite: number
  urgence: number
  attitude: Attitude
  attentes: string | null
  verbatims: string | null
  strategie: string | null
  statut_suivi: StatutSuivi
  engagement_actuel: Niveau
  engagement_souhaite: Niveau
  actif: boolean
  liens?: Lien[]
}

interface Succession {
  predecesseur_id: string | null
  successeur_id: string | null
}

interface EntreeHistorique {
  id: string
  type: string
  champ: string | null
  ancienne_valeur: string | null
  nouvelle_valeur: string | null
  motif: string | null
  created_at: string
}

// ── libellés ────────────────────────────────────────────────────────────────

const TYPES: { v: TypeActeur; l: string; aide: string }[] = [
  { v: 'personne', l: 'Personne physique', aide: 'Se remplace. Un changement de nom est un changement d’interlocuteur et exige un motif.' },
  { v: 'fonction', l: 'Fonction', aide: 'Se réattribue. Le poste survit à celui qui l’occupe.' },
  { v: 'collectif', l: 'Collectif', aide: 'Se recompose : instance, comité, collectif de salariés.' },
  { v: 'entite', l: 'Entité', aide: 'Organisation, entreprise, administration, association.' },
  { v: 'sans_voix', l: 'Sans porte-parole', aide: 'La Terre, les générations futures : légitimes, sans personne pour parler en leur nom.' },
]
const CATEGORIES: Record<Categorie, { l: string; c: string }> = {
  verte:  { l: '🟢 Opérationnel', c: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  orange: { l: '🟠 Gouvernance',  c: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
  bleue:  { l: '🔵 Externe',      c: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
}
const ATTITUDES: Record<Attitude, string> = {
  alliee: 'Alliée', ouverte: 'Ouverte', neutre: 'Neutre', vigilante: 'Vigilante', opposee: 'Opposée',
}
const SUIVIS: Record<StatutSuivi, { l: string; c: string }> = {
  a_engager: { l: 'À engager', c: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  engagee:   { l: 'Engagée',   c: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300' },
  a_risque:  { l: 'À risque',  c: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  ok:        { l: 'OK',        c: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
}
const NIVEAUX: { v: Niveau; l: string }[] = [
  { v: 'peu_conscient', l: 'Peu conscient' }, { v: 'resistant', l: 'Résistant' },
  { v: 'neutre', l: 'Neutre' }, { v: 'solidaire', l: 'Solidaire' }, { v: 'leader', l: 'Leader' },
]
const NIVEAU_INDEX = (v: Niveau) => NIVEAUX.findIndex(n => n.v === v)

const SALIENCE = {
  definitifs:       { l: 'Définitifs',       c: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300' },
  dominants:        { l: 'Dominants',        c: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300' },
  dangereux:        { l: 'Dangereux',        c: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  dependants:       { l: 'Dépendants',       c: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300' },
  dormants:         { l: 'Dormants',         c: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300' },
  discretionnaires: { l: 'Discrétionnaires', c: 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300' },
  demandeurs:       { l: 'Demandeurs',       c: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  hors:             { l: 'Hors périmètre',   c: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
} as const
type CleSalience = keyof typeof SALIENCE

/** Modèle de saillance : un attribut est présent lorsque sa note dépasse 3. */
function salienceDe(p: number, l: number, u: number): CleSalience {
  const P = p > 3, L = l > 3, U = u > 3
  if (P && L && U) return 'definitifs'
  if (P && L) return 'dominants'
  if (P && U) return 'dangereux'
  if (L && U) return 'dependants'
  if (P) return 'dormants'
  if (L) return 'discretionnaires'
  if (U) return 'demandeurs'
  return 'hors'
}

const NIVEAU_LIEN: Record<Lien['niveau'], string> = {
  portefeuille: 'Portefeuille', programme: 'Programme',
  sous_programme: 'Sous-programme', projet: 'Projet',
}

const inputCls = 'w-full rounded-md border px-2.5 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
const labelCls = 'block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400'

function dateFr(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—'
    : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── vue principale ──────────────────────────────────────────────────────────

export default function ProjetRseRegistreView({ organisationId, readOnly }: {
  organisationId: string
  readOnly: boolean
}) {
  const [acteurs, setActeurs] = useState<Acteur[]>([])
  const [charge, setCharge] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [recherche, setRecherche] = useState('')
  const [filtre, setFiltre] = useState<'tous' | CleSalience>('tous')
  const [creation, setCreation] = useState(false)
  const [successions, setSuccessions] = useState<Record<string, Succession>>({})
  const [montrerRemplaces, setMontrerRemplaces] = useState(false)

  const charger = useCallback(async () => {
    try {
      const [r, rs] = await Promise.all([
        fetch(`${BASE}/acteurs?organisation_id=${organisationId}&avec_liens=1`),
        fetch(`${BASE}/acteurs/succession?organisation_id=${organisationId}`),
      ])
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? 'Chargement impossible')
      setActeurs(j.acteurs ?? [])
      if (rs.ok) setSuccessions((await rs.json()).successions ?? {})
    } catch (e) { setErreur(e instanceof Error ? e.message : String(e)) }
    finally { setCharge(true) }
  }, [organisationId])

  useEffect(() => { void charger() }, [charger])

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    return acteurs.filter(a => {
      if (!a.actif && !montrerRemplaces) return false
      if (filtre !== 'tous' && salienceDe(a.pouvoir, a.legitimite, a.urgence) !== filtre) return false
      if (!q) return true
      return [a.nom, a.organisation, a.role].some(v => (v ?? '').toLowerCase().includes(q))
    })
  }, [acteurs, recherche, filtre, montrerRemplaces])

  const compteurs = useMemo(() => {
    const c = {} as Record<CleSalience, number>
    for (const a of acteurs) {
      const k = salienceDe(a.pouvoir, a.legitimite, a.urgence)
      c[k] = (c[k] ?? 0) + 1
    }
    return c
  }, [acteurs])

  const ecart = useMemo(() => acteurs.reduce((s, a) =>
    s + Math.max(0, NIVEAU_INDEX(a.engagement_souhaite) - NIVEAU_INDEX(a.engagement_actuel)), 0), [acteurs])
  const nonRattaches = acteurs.filter(a => a.actif && !a.liens?.length).length
  const remplaces = acteurs.filter(a => !a.actif).length
  const nomDe = useCallback((id: string | null | undefined) =>
    acteurs.find(a => a.id === id)?.nom ?? null, [acteurs])

  if (!charge) return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Chargement du registre…</p>

  return (
    <div className="space-y-4">
      {erreur && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400 flex items-start justify-between gap-3">
          <span>{erreur}</span>
          <button onClick={() => setErreur(null)} className="shrink-0 font-medium hover:underline">Fermer</button>
        </div>
      )}

      <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
        <h3 className="font-semibold text-indigo-700 dark:text-indigo-300">Registre des parties prenantes</h3>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          Une partie prenante est enregistrée <strong>une seule fois</strong> et référencée par les éléments
          qu’elle concerne. La modifier ici la modifie partout, et le changement est reporté dans le fil
          d’avancement de chaque élément rattaché.
        </p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <span><strong className="text-lg">{acteurs.filter(a => a.actif).length}</strong> au registre</span>
          <span><strong className="text-lg">{ecart}</strong> niveaux d’engagement à gagner</span>
          {nonRattaches > 0 && (
            <span className="text-amber-700 dark:text-amber-400">
              <strong className="text-lg">{nonRattaches}</strong> sans rattachement
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input value={recherche} onChange={e => setRecherche(e.target.value)}
          placeholder="Rechercher un nom, une entité, un rôle…"
          className={`${inputCls} max-w-xs`} style={{ borderColor: 'var(--border)' }} />
        <select value={filtre} onChange={e => setFiltre(e.target.value as 'tous' | CleSalience)}
          className={`${inputCls} max-w-[16rem]`} style={{ borderColor: 'var(--border)' }}>
          <option value="tous">Tous les groupes de saillance ({acteurs.length})</option>
          {(Object.keys(SALIENCE) as CleSalience[]).map(k => (
            <option key={k} value={k}>{SALIENCE[k].l} ({compteurs[k] ?? 0})</option>
          ))}
        </select>
        {remplaces > 0 && (
          <label className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: 'var(--text-muted)' }}>
            <input type="checkbox" className="accent-indigo-600"
              checked={montrerRemplaces} onChange={e => setMontrerRemplaces(e.target.checked)} />
            Afficher les {remplaces} remplacé{remplaces > 1 ? 's' : ''}
          </label>
        )}
        {!readOnly && (
          <button onClick={() => setCreation(true)}
            className="ml-auto rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700">
            + Inscrire une partie prenante
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/60">
            <tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              <th className="px-3 py-2">Partie prenante</th>
              <th className="px-3 py-2">Nature</th>
              <th className="px-3 py-2 text-center" title="Pouvoir">P</th>
              <th className="px-3 py-2 text-center" title="Intérêt">I</th>
              <th className="px-3 py-2 text-center" title="Légitimité">L</th>
              <th className="px-3 py-2 text-center" title="Urgence">U</th>
              <th className="px-3 py-2">Saillance</th>
              <th className="px-3 py-2">Engagement</th>
              <th className="px-3 py-2">Rattachements</th>
              <th className="px-3 py-2">Suivi</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(a => {
              const s = SALIENCE[salienceDe(a.pouvoir, a.legitimite, a.urgence)]
              const d = Math.max(0, NIVEAU_INDEX(a.engagement_souhaite) - NIVEAU_INDEX(a.engagement_actuel))
              return (
                <tr key={a.id} onClick={() => setOuvert(a.id)}
                  className={`border-t cursor-pointer hover:bg-indigo-50/60 dark:hover:bg-indigo-900/10 ${a.actif ? '' : 'opacity-50'}`}
                  style={{ borderColor: 'var(--border)' }}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900 dark:text-white">{a.nom}</div>
                    {a.organisation && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.organisation}</div>}
                    {!a.actif && (
                      <div className="text-xs text-amber-700 dark:text-amber-400">
                        Remplacé{nomDe(successions[a.id]?.successeur_id)
                          ? ` par ${nomDe(successions[a.id]?.successeur_id)}` : ''}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${CATEGORIES[a.categorie].c}`}>
                      {CATEGORIES[a.categorie].l}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-gray-900 dark:text-white">{a.pouvoir}</td>
                  <td className="px-3 py-2 text-center text-gray-900 dark:text-white">{a.interet}</td>
                  <td className="px-3 py-2 text-center text-gray-900 dark:text-white">{a.legitimite}</td>
                  <td className="px-3 py-2 text-center text-gray-900 dark:text-white">{a.urgence}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${s.c}`}>{s.l}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300">
                    {NIVEAUX[NIVEAU_INDEX(a.engagement_actuel)].l}
                    {d > 0 && <span className="text-amber-600 dark:text-amber-400"> → {NIVEAUX[NIVEAU_INDEX(a.engagement_souhaite)].l}</span>}
                  </td>
                  <td className="px-3 py-2">
                    {a.liens?.length
                      ? <span className="text-gray-700 dark:text-gray-300">{a.liens.length}</span>
                      : <span className="text-amber-600 dark:text-amber-400">aucun</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${SUIVIS[a.statut_suivi].c}`}>
                      {SUIVIS[a.statut_suivi].l}
                    </span>
                  </td>
                </tr>
              )
            })}
            {!visibles.length && (
              <tr><td colSpan={10} className="px-3 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                Aucune partie prenante ne correspond à ce filtre.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {ouvert && (
        <FicheActeur acteurId={ouvert} readOnly={readOnly}
          succession={successions[ouvert]} nomDe={nomDe}
          onClose={() => setOuvert(null)}
          onChanged={() => { void charger() }}
          onError={setErreur} />
      )}
      {creation && !readOnly && (
        <ModaleCreation organisationId={organisationId}
          onClose={() => setCreation(false)}
          onCreated={() => { setCreation(false); void charger() }}
          onError={setErreur} />
      )}
    </div>
  )
}

// ── fiche d'un acteur ───────────────────────────────────────────────────────

function FicheActeur({ acteurId, readOnly, succession, nomDe, onClose, onChanged, onError }: {
  acteurId: string
  readOnly: boolean
  succession?: Succession
  nomDe: (id: string | null | undefined) => string | null
  onClose: () => void
  onChanged: () => void
  onError: (m: string) => void
}) {
  const [a, setA] = useState<Acteur | null>(null)
  const [histo, setHisto] = useState<EntreeHistorique[]>([])
  const [form, setForm] = useState<Partial<Acteur>>({})
  const [motif, setMotif] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [ouvrirSuccession, setOuvrirSuccession] = useState(false)

  const charger = useCallback(async () => {
    try {
      const [ra, rh] = await Promise.all([
        fetch(`${BASE}/acteurs/fiche?id=${acteurId}`),
        fetch(`${BASE}/acteurs/historique?acteur_id=${acteurId}`),
      ])
      const ja = await ra.json()
      if (!ra.ok) throw new Error(ja.error ?? 'Acteur introuvable')
      setA(ja.acteur)
      setForm({ ...ja.acteur })
      const jh = await rh.json()
      if (rh.ok) setHisto(jh.historique ?? [])
    } catch (e) { onError(e instanceof Error ? e.message : String(e)) }
    // onError est stable pour la durée de la modale
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acteurId])

  useEffect(() => { void charger() }, [charger])

  const enregistrer = async () => {
    if (!a) return
    setEnCours(true); setMessage(null)
    try {
      const corps: Record<string, unknown> = { id: a.id }
      for (const k of ['nom', 'organisation', 'type', 'categorie', 'role', 'pouvoir', 'interet',
        'legitimite', 'urgence', 'attitude', 'attentes', 'verbatims', 'strategie',
        'statut_suivi', 'engagement_actuel', 'engagement_souhaite', 'actif'] as const) {
        if (form[k] !== undefined && form[k] !== a[k]) corps[k] = form[k]
      }
      if (Object.keys(corps).length === 1) { setMessage('Aucune modification.'); return }
      if (motif.trim()) corps.motif = motif.trim()

      const r = await fetch(`${BASE}/acteurs`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corps),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? 'Enregistrement impossible')
      setMotif('')
      await charger()
      const n = j.propagation?.elements ?? 0
      setMessage(n > 0
        ? `Enregistré. Le changement a été reporté dans le fil d’avancement de ${n} élément${n > 1 ? 's' : ''}.`
        : 'Enregistré.')
      onChanged()
    } catch (e) { onError(e instanceof Error ? e.message : String(e)) }
    finally { setEnCours(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-xl border shadow-xl my-8"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {a?.nom ?? 'Partie prenante'}
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Fiche du registre — les modifications valent pour tous les éléments rattachés.
            </p>
          </div>
          <button onClick={onClose} className="text-sm font-medium hover:underline" style={{ color: 'var(--text-muted)' }}>
            Fermer
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {a && (
            <>
              {(succession?.predecesseur_id || succession?.successeur_id || !a.actif) && (
                <div className="rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
                  {succession?.predecesseur_id && (
                    <div className="text-gray-800 dark:text-gray-200">
                      Succède à <strong>{nomDe(succession.predecesseur_id) ?? 'un prédécesseur'}</strong>.
                    </div>
                  )}
                  {succession?.successeur_id && (
                    <div className="text-amber-700 dark:text-amber-400">
                      Remplacé par <strong>{nomDe(succession.successeur_id) ?? 'un successeur'}</strong> —
                      cette fiche est close et conserve ce qui lui est attaché.
                    </div>
                  )}
                  {!a.actif && !succession?.successeur_id && (
                    <div className="text-amber-700 dark:text-amber-400">Retiré du registre.</div>
                  )}
                </div>
              )}

              {!readOnly && a.actif && (a.type === 'personne' || a.type === 'fonction') && (
                <div className="rounded-lg border border-dashed p-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Une <strong>autre personne</strong> prend ce rôle ? Utilisez la succession plutôt que le
                      renommage : elle transfère les rattachements et les actions à mener, et laisse ce qui a
                      été fait attaché à son auteur.
                    </p>
                    <button onClick={() => setOuvrirSuccession(true)}
                      className="shrink-0 rounded-md border border-amber-400 dark:border-amber-700 px-3 py-1.5 text-sm font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20">
                      ↦ Remplacer le titulaire
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nom</label>
                  <input className={inputCls} style={{ borderColor: 'var(--border)' }}
                    disabled={readOnly} value={form.nom ?? ''}
                    onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Entité d’appartenance</label>
                  <input className={inputCls} style={{ borderColor: 'var(--border)' }}
                    disabled={readOnly} value={form.organisation ?? ''}
                    onChange={e => setForm(f => ({ ...f, organisation: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Nature</label>
                  <select className={inputCls} style={{ borderColor: 'var(--border)' }}
                    disabled={readOnly} value={form.type ?? 'entite'}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value as TypeActeur }))}>
                    {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                  </select>
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {TYPES.find(t => t.v === (form.type ?? 'entite'))?.aide}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Rôle</label>
                  <input className={inputCls} style={{ borderColor: 'var(--border)' }}
                    disabled={readOnly} value={form.role ?? ''}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
                </div>
                {([['pouvoir', 'Pouvoir'], ['interet', 'Intérêt'], ['legitimite', 'Légitimité'],
                   ['urgence', 'Urgence']] as const).map(([k, l]) => (
                  <div key={k}>
                    <label className={labelCls}>{l} : {form[k] ?? 3}/5</label>
                    <input type="range" min={1} max={5} step={1} className="w-full accent-indigo-600"
                      disabled={readOnly} value={Number(form[k] ?? 3)}
                      onChange={e => setForm(f => ({ ...f, [k]: Number(e.target.value) }))} />
                  </div>
                ))}
                <div>
                  <label className={labelCls}>Attitude</label>
                  <select className={inputCls} style={{ borderColor: 'var(--border)' }}
                    disabled={readOnly} value={form.attitude ?? 'neutre'}
                    onChange={e => setForm(f => ({ ...f, attitude: e.target.value as Attitude }))}>
                    {(Object.keys(ATTITUDES) as Attitude[]).map(k => <option key={k} value={k}>{ATTITUDES[k]}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Statut de suivi</label>
                  <select className={inputCls} style={{ borderColor: 'var(--border)' }}
                    disabled={readOnly} value={form.statut_suivi ?? 'a_engager'}
                    onChange={e => setForm(f => ({ ...f, statut_suivi: e.target.value as StatutSuivi }))}>
                    {(Object.keys(SUIVIS) as StatutSuivi[]).map(k => <option key={k} value={k}>{SUIVIS[k].l}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Engagement actuel</label>
                  <select className={inputCls} style={{ borderColor: 'var(--border)' }}
                    disabled={readOnly} value={form.engagement_actuel ?? 'peu_conscient'}
                    onChange={e => setForm(f => ({ ...f, engagement_actuel: e.target.value as Niveau }))}>
                    {NIVEAUX.map(n => <option key={n.v} value={n.v}>{n.l}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Engagement souhaité</label>
                  <select className={inputCls} style={{ borderColor: 'var(--border)' }}
                    disabled={readOnly} value={form.engagement_souhaite ?? 'solidaire'}
                    onChange={e => setForm(f => ({ ...f, engagement_souhaite: e.target.value as Niveau }))}>
                    {NIVEAUX.map(n => <option key={n.v} value={n.v}>{n.l}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Attentes</label>
                  <textarea rows={2} className={inputCls} style={{ borderColor: 'var(--border)' }}
                    disabled={readOnly} value={form.attentes ?? ''}
                    onChange={e => setForm(f => ({ ...f, attentes: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Stratégie d’engagement</label>
                  <textarea rows={3} className={inputCls} style={{ borderColor: 'var(--border)' }}
                    disabled={readOnly} value={form.strategie ?? ''}
                    onChange={e => setForm(f => ({ ...f, strategie: e.target.value }))} />
                </div>
              </div>

              {!readOnly && (
                <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                  <label className={labelCls}>
                    Motif du changement
                    {form.type === 'personne' && form.nom !== a.nom && (
                      <span className="text-red-600 dark:text-red-400"> — requis : vous remplacez une personne physique</span>
                    )}
                  </label>
                  <input className={inputCls} style={{ borderColor: 'var(--border)' }}
                    value={motif} onChange={e => setMotif(e.target.value)}
                    placeholder="Ex. : départ à la retraite, réorganisation, changement de position après la revue de phase…" />
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    Ce motif sera repris dans le fil d’avancement de chaque élément rattaché.
                  </p>
                </div>
              )}

              {message && (
                <p className="text-sm text-indigo-700 dark:text-indigo-300">{message}</p>
              )}

              {!readOnly && (
                <div className="flex justify-end gap-2">
                  <button onClick={onClose} className="rounded-md border px-3 py-1.5 text-sm"
                    style={{ borderColor: 'var(--border)' }}>Annuler</button>
                  <button onClick={enregistrer} disabled={enCours}
                    className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                    {enCours ? 'Enregistrement…' : 'Enregistrer et propager'}
                  </button>
                </div>
              )}

              <Rattachements acteur={a} readOnly={readOnly} onChanged={() => { onChanged() }} onError={onError} />
              <Historique entrees={histo} />

              {ouvrirSuccession && (
                <ModaleSuccession acteur={a}
                  onClose={() => setOuvrirSuccession(false)}
                  onFait={(r) => {
                    setOuvrirSuccession(false)
                    setMessage(`Succession enregistrée. ${r.rattachements_transferes} rattachement(s) `
                      + `et ${r.engagements_transferes} action(s) transférés ; `
                      + `${r.engagements_conserves} action(s) achevée(s) restent attachées au prédécesseur. `
                      + `Le changement est reporté dans le fil de ${r.elements_journalises} élément(s).`)
                    void charger(); onChanged()
                  }}
                  onError={onError} />
              )}
            </>
          )}

          <div className="pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <ProjetRseNotesNiveauPanel niveau="acteur" cibleId={acteurId}
              readOnly={readOnly} libelle="pièces de la partie prenante" />
          </div>
        </div>
      </div>
    </div>
  )
}

interface ResultatSuccession {
  rattachements_transferes: number
  engagements_transferes: number
  engagements_conserves: number
  elements_journalises: number
}

/** Remplacement du titulaire — distinct du renommage. */
function ModaleSuccession({ acteur, onClose, onFait, onError }: {
  acteur: Acteur
  onClose: () => void
  onFait: (r: ResultatSuccession) => void
  onError: (m: string) => void
}) {
  const [nom, setNom] = useState('')
  const [role, setRole] = useState(acteur.role ?? '')
  const [motif, setMotif] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [niveau, setNiveau] = useState<Niveau>('peu_conscient')
  const [enCours, setEnCours] = useState(false)

  const lancer = async () => {
    setEnCours(true)
    try {
      const r = await fetch(`${BASE}/acteurs/succession`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acteur_id: acteur.id, nouveau_nom: nom.trim(),
          motif: motif.trim(), date_effet: date, engagement_initial: niveau,
          attributs: { role: role.trim() || null } }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? 'Succession impossible')
      onFait(j.succession)
    } catch (e) { onError(e instanceof Error ? e.message : String(e)) }
    finally { setEnCours(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border p-5 shadow-xl"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Remplacer le titulaire
        </h3>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          <strong>{acteur.nom}</strong> sera clos au registre et conservera ce qu’il a produit. Le successeur
          reprend les rattachements, leur rôle local, et les actions restant à mener. Les actions achevées
          restent attachées au prédécesseur, parce que c’est lui qui les a menées.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <label className={labelCls}>Nom du successeur</label>
            <input className={inputCls} style={{ borderColor: 'var(--border)' }}
              value={nom} onChange={e => setNom(e.target.value)} autoFocus />
          </div>
          <div>
            <label className={labelCls}>Rôle du successeur</label>
            <input className={inputCls} style={{ borderColor: 'var(--border)' }}
              value={role} onChange={e => setRole(e.target.value)} />
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              Repris du prédécesseur. À relire : un intitulé genré ne convient pas toujours au successeur.
            </p>
          </div>
          <div>
            <label className={labelCls}>Date d’effet</label>
            <input type="date" className={inputCls} style={{ borderColor: 'var(--border)' }}
              value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Position d’engagement du successeur</label>
            <select className={inputCls} style={{ borderColor: 'var(--border)' }}
              value={niveau} onChange={e => setNiveau(e.target.value as Niveau)}>
              {NIVEAUX.map(n => <option key={n.v} value={n.v}>{n.l}</option>)}
            </select>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              Par défaut « peu conscient » : un successeur hérite du rôle, pas de la relation.
            </p>
          </div>
          <div>
            <label className={labelCls}>Motif <span className="text-red-600 dark:text-red-400">— requis</span></label>
            <textarea rows={2} className={inputCls} style={{ borderColor: 'var(--border)' }}
              value={motif} onChange={e => setMotif(e.target.value)}
              placeholder="Ex. : départ à la retraite au 31 décembre 2026 ; mobilité interne ; réorganisation de la direction…" />
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              Repris dans le fil d’avancement de chacun des {acteur.liens?.length ?? 0} élément(s) rattaché(s).
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)' }}>Annuler</button>
          <button onClick={lancer} disabled={enCours || !nom.trim() || !motif.trim()}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
            {enCours ? 'Succession…' : 'Enregistrer la succession'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Rattachements({ acteur, readOnly, onChanged, onError }: {
  acteur: Acteur
  readOnly: boolean
  onChanged: () => void
  onError: (m: string) => void
}) {
  const liens = acteur.liens ?? []
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
      <h4 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
        Rattachements ({liens.length})
      </h4>
      <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
        Les éléments qui référencent cette partie prenante. Toute modification de la fiche les concerne tous.
      </p>
      {liens.length ? (
        <ul className="mt-2 space-y-1">
          {liens.map(l => (
            <li key={`${l.niveau}-${l.id}`} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                {NIVEAU_LIEN[l.niveau]}
              </span>
              <span className="text-gray-800 dark:text-gray-200">
                {l.nom}
                {l.role_local && <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>{l.role_local}</span>}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
          Aucun rattachement. Une partie prenante inscrite au registre et rattachée à rien n’est suivie par personne.
        </p>
      )}
      {!readOnly && <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        Le rattachement se fait depuis l’élément concerné — onglet « Parties prenantes » d’un projet.
      </p>}
      {/* Réservé aux évolutions : détachement direct depuis la fiche. */}
      <span className="hidden">{String(onChanged)}{String(onError)}</span>
    </div>
  )
}

function Historique({ entrees }: { entrees: EntreeHistorique[] }) {
  const TYPE_L: Record<string, string> = {
    creation: 'Inscription au registre', modification: 'Modification',
    remplacement: 'Remplacement d’interlocuteur', retrait: 'Retrait',
    rattachement: 'Rattachement', detachement: 'Détachement',
  }
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
      <h4 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
        Historique ({entrees.length})
      </h4>
      {entrees.length ? (
        <ul className="mt-2 space-y-2">
          {entrees.map(h => (
            <li key={h.id} className="text-sm border-l-2 pl-3"
              style={{ borderColor: h.type === 'remplacement' ? '#dc2626' : 'var(--border)' }}>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-medium text-gray-900 dark:text-white">{TYPE_L[h.type] ?? h.type}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{dateFr(h.created_at)}</span>
              </div>
              {h.champ && (
                <div className="text-xs text-gray-700 dark:text-gray-300">
                  {h.champ} : {h.ancienne_valeur ?? '—'} → {h.nouvelle_valeur ?? '—'}
                </div>
              )}
              {h.motif && <div className="text-xs italic" style={{ color: 'var(--text-muted)' }}>{h.motif}</div>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>Aucun mouvement enregistré.</p>
      )}
    </div>
  )
}

function ModaleCreation({ organisationId, onClose, onCreated, onError }: {
  organisationId: string
  onClose: () => void
  onCreated: () => void
  onError: (m: string) => void
}) {
  const [nom, setNom] = useState('')
  const [org, setOrg] = useState('')
  const [type, setType] = useState<TypeActeur>('entite')
  const [categorie, setCategorie] = useState<Categorie>('bleue')
  const [enCours, setEnCours] = useState(false)

  const creer = async () => {
    if (!nom.trim()) return
    setEnCours(true)
    try {
      const r = await fetch(`${BASE}/acteurs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organisation_id: organisationId, nom: nom.trim(),
          organisation: org.trim() || null, type, categorie }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? 'Création impossible')
      onCreated()
    } catch (e) { onError(e instanceof Error ? e.message : String(e)) }
    finally { setEnCours(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border p-5 shadow-xl"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Inscrire une partie prenante</h3>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          Au registre de l’organisation. Le rattachement aux projets se fait ensuite, élément par élément.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <label className={labelCls}>Nom</label>
            <input className={inputCls} style={{ borderColor: 'var(--border)' }}
              value={nom} onChange={e => setNom(e.target.value)} autoFocus />
          </div>
          <div>
            <label className={labelCls}>Entité d’appartenance</label>
            <input className={inputCls} style={{ borderColor: 'var(--border)' }}
              value={org} onChange={e => setOrg(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Nature</label>
            <select className={inputCls} style={{ borderColor: 'var(--border)' }}
              value={type} onChange={e => setType(e.target.value as TypeActeur)}>
              {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              {TYPES.find(t => t.v === type)?.aide}
            </p>
          </div>
          <div>
            <label className={labelCls}>Catégorie</label>
            <select className={inputCls} style={{ borderColor: 'var(--border)' }}
              value={categorie} onChange={e => setCategorie(e.target.value as Categorie)}>
              {(Object.keys(CATEGORIES) as Categorie[]).map(k => (
                <option key={k} value={k}>{CATEGORIES[k].l}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)' }}>Annuler</button>
          <button onClick={creer} disabled={enCours || !nom.trim()}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
            {enCours ? 'Création…' : 'Inscrire'}
          </button>
        </div>
      </div>
    </div>
  )
}

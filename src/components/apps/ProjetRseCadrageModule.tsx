'use client'

// Cadrage et business case durable.
//
// Douze rubriques. La règle du référentiel est simple et opposable : une fiche
// incomplète interdit le démarrage. L'application ne bloque pas la saisie —
// elle se remplit progressivement — mais elle affiche en permanence ce qui
// manque, et sur quoi le démarrage butera.
//
// La rubrique décisive est la capacité visée : ce que l'organisation saura
// faire une fois le livrable remis. C'est celle qui manquait au programme
// précédent, et son absence explique que le bilan carbone n'ait jamais été
// transféré aux sites.

import { useCallback, useEffect, useState } from 'react'
import type { ProjetRseModuleProps } from '@/lib/projetRseModules'

interface Cadrage {
  finalite: string | null
  livrable: string | null
  capacite_visee: string | null
  benefice_attendu: string | null
  pilote_acteur_id: string | null
  parrain_acteur_id: string | null
  perimetre_inclus: string | null
  perimetre_exclu: string | null
  dependances: string | null
  charge_etp: number | null
  origine_ressources: string | null
  budget_adosse: string | null
  budget_nouveau: string | null
  justification: string | null
  alternatives: string | null
  criteres_succes: string | null
  seuils_impact: string | null
  approche: string | null
}

interface ActeurLite { id: string; nom: string; organisation: string | null }

const VIDE: Cadrage = {
  finalite: '', livrable: '', capacite_visee: '', benefice_attendu: '',
  pilote_acteur_id: null, parrain_acteur_id: null, perimetre_inclus: '',
  perimetre_exclu: '', dependances: '', charge_etp: null, origine_ressources: null,
  budget_adosse: '', budget_nouveau: '', justification: '', alternatives: '',
  criteres_succes: '', seuils_impact: '', approche: null,
}

/** Les rubriques dont l'absence interdit le démarrage. */
const OBLIGATOIRES: { cle: keyof Cadrage; libelle: string }[] = [
  { cle: 'finalite', libelle: 'Finalité' },
  { cle: 'livrable', libelle: 'Livrable' },
  { cle: 'capacite_visee', libelle: 'Capacité visée' },
  { cle: 'benefice_attendu', libelle: 'Bénéfice attendu' },
  { cle: 'pilote_acteur_id', libelle: 'Pilote' },
  { cle: 'parrain_acteur_id', libelle: 'Parrain' },
  { cle: 'perimetre_inclus', libelle: 'Périmètre inclus' },
  { cle: 'perimetre_exclu', libelle: 'Périmètre exclu' },
  { cle: 'justification', libelle: 'Justification' },
  { cle: 'criteres_succes', libelle: 'Critères de succès' },
]

const APPROCHES = [
  { v: 'predictive', l: 'Prédictive', aide: 'Le livrable est connu à l’avance et l’exigence est stable. Le plan précède l’exécution.' },
  { v: 'iterative', l: 'Itérative', aide: 'Le livrable se précise par essais successifs. Le plan se révise à chaque itération.' },
  { v: 'adaptative', l: 'Adaptative', aide: 'L’exigence elle-même peut changer, parce qu’elle dépend d’acteurs extérieurs ou de la réaction des personnes.' },
]
const ORIGINES = [
  { v: 'redeploiement', l: 'Redéploiement interne', aide: 'Immédiat à trois mois. La charge courante ne disparaît pas pour autant.' },
  { v: 'recrutement', l: 'Recrutement', aide: 'Huit mois en moyenne, avec un risque d’échec documenté.' },
  { v: 'externe', l: 'Recours externe', aide: 'Quelques semaines. Résout un délai, crée une dépendance.' },
  { v: 'mixte', l: 'Mixte', aide: '' },
]

const inputCls = 'w-full rounded-md border px-2.5 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
const labelCls = 'block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300'

export default function ProjetRseCadrageModule({ projetId, organisationId, readOnly }: ProjetRseModuleProps) {
  const [c, setC] = useState<Cadrage>(VIDE)
  const [acteurs, setActeurs] = useState<ActeurLite[]>([])
  const [charge, setCharge] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const charger = useCallback(async () => {
    try {
      const [rc, ra] = await Promise.all([
        fetch(`/api/projet-rse/projets/${projetId}/cadrage`),
        fetch(`/api/projet-rse/acteurs?organisation_id=${organisationId}`),
      ])
      const jc = await rc.json()
      if (!rc.ok) throw new Error(jc.error ?? 'Cadrage inaccessible')
      if (jc.cadrage) setC({ ...VIDE, ...jc.cadrage })
      if (ra.ok) setActeurs(((await ra.json()).acteurs ?? [])
        .filter((a: { actif: boolean }) => a.actif))
    } catch (e) { setErreur(e instanceof Error ? e.message : String(e)) }
    finally { setCharge(true) }
  }, [projetId, organisationId])

  useEffect(() => { void charger() }, [charger])

  const set = (p: Partial<Cadrage>) => { setC(v => ({ ...v, ...p })); setMessage(null) }

  const manquants = OBLIGATOIRES.filter(o => {
    const v = c[o.cle]
    return v === null || v === undefined || String(v).trim() === ''
  })

  const enregistrer = async () => {
    setEnCours(true); setErreur(null)
    try {
      const r = await fetch(`/api/projet-rse/projets/${projetId}/cadrage`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...c, charge_etp: c.charge_etp === null || String(c.charge_etp) === ''
          ? null : Number(c.charge_etp) }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? 'Enregistrement impossible')
      setC({ ...VIDE, ...j.cadrage })
      setMessage('Fiche enregistrée.')
    } catch (e) { setErreur(e instanceof Error ? e.message : String(e)) }
    finally { setEnCours(false) }
  }

  if (!charge) return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Chargement de la fiche…</p>

  const Zone = ({ cle, titre, aide, lignes = 2 }: {
    cle: keyof Cadrage; titre: string; aide?: string; lignes?: number
  }) => (
    <div>
      <label className={labelCls}>
        {titre}
        {OBLIGATOIRES.some(o => o.cle === cle) && !String(c[cle] ?? '').trim() && (
          <span className="ml-1 font-normal text-amber-600 dark:text-amber-400">— manquant</span>
        )}
      </label>
      <textarea rows={lignes} className={inputCls} style={{ borderColor: 'var(--border)' }}
        disabled={readOnly} value={String(c[cle] ?? '')}
        onChange={e => set({ [cle]: e.target.value } as Partial<Cadrage>)} />
      {aide && <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{aide}</p>}
    </div>
  )

  const SelectActeur = ({ cle, titre, aide }: { cle: keyof Cadrage; titre: string; aide: string }) => (
    <div>
      <label className={labelCls}>
        {titre}
        {!c[cle] && <span className="ml-1 font-normal text-amber-600 dark:text-amber-400">— manquant</span>}
      </label>
      <select className={inputCls} style={{ borderColor: 'var(--border)' }}
        disabled={readOnly} value={String(c[cle] ?? '')}
        onChange={e => set({ [cle]: e.target.value || null } as Partial<Cadrage>)}>
        <option value="">— à désigner —</option>
        {acteurs.map(a => (
          <option key={a.id} value={a.id}>{a.nom}{a.organisation ? ` · ${a.organisation}` : ''}</option>
        ))}
      </select>
      <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{aide}</p>
    </div>
  )

  return (
    <div className="space-y-4 max-w-4xl">
      {erreur && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400 flex items-start justify-between gap-3">
          <span>{erreur}</span>
          <button onClick={() => setErreur(null)} className="shrink-0 font-medium hover:underline">Fermer</button>
        </div>
      )}

      {/* État de complétude */}
      <div className={`rounded-xl border p-4 ${manquants.length
        ? 'border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-900/10'
        : 'border-green-300 dark:border-green-700 bg-green-50/60 dark:bg-green-900/10'}`}>
        <h3 className={`text-sm font-bold ${manquants.length
          ? 'text-amber-800 dark:text-amber-300' : 'text-green-800 dark:text-green-300'}`}>
          {manquants.length
            ? `Fiche incomplète — ${manquants.length} rubrique${manquants.length > 1 ? 's' : ''} sur ${OBLIGATOIRES.length}`
            : 'Fiche complète — le démarrage peut être autorisé'}
        </h3>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          La règle est opposable : une fiche incomplète interdit le démarrage. Elle se remplit
          progressivement, mais ce qui manque reste visible.
        </p>
        {manquants.length > 0 && (
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
            {manquants.map(m => m.libelle).join(' · ')}
          </p>
        )}
      </div>

      <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--card-bg)' }}>
        <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-300">Ce que le projet produit</h3>
        <Zone cle="finalite" titre="1 · Finalité"
          aide="Le problème traité, en une phrase. Un projet dont la finalité tient en trois phrases n’est pas cadré." />
        <Zone cle="livrable" titre="2 · Livrable" aide="Ce qui sera produit, et sa spécification." />
        <Zone cle="capacite_visee" titre="3 · Capacité visée"
          aide="Ce que l’organisation saura faire une fois le livrable remis — et donc qui devra savoir le faire. C’est la rubrique qui manquait au programme précédent." />
        <Zone cle="benefice_attendu" titre="4 · Bénéfice attendu"
          aide="Le bénéfice du registre auquel ce projet contribue. Un projet qui ne contribue à aucun est à réexaminer." />
      </div>

      <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--card-bg)' }}>
        <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-300">Qui le porte</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SelectActeur cle="pilote_acteur_id" titre="5 · Pilote"
            aide="Une personne, prise au registre. Un projet sans pilote unique est un lot d’un autre projet." />
          <SelectActeur cle="parrain_acteur_id" titre="6 · Parrain"
            aide="Il arbitre ce que le pilote ne peut pas arbitrer." />
        </div>
      </div>

      <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--card-bg)' }}>
        <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-300">Ce qu’il couvre, et ce qu’il ne couvre pas</h3>
        <Zone cle="perimetre_inclus" titre="7 · Périmètre inclus" />
        <Zone cle="perimetre_exclu" titre="7 bis · Périmètre exclu"
          aide="Écrit explicitement : c’est l’exclusion qui évite l’extension silencieuse, mode d’échec le plus courant." />
        <Zone cle="dependances" titre="8 · Dépendances"
          aide="Ce dont le projet dépend, et ce qui dépend de lui." />
      </div>

      <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--card-bg)' }}>
        <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-300">Ce qu’il coûte</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>9 · Charge, en équivalents temps plein</label>
            <input type="number" step="0.5" min="0" className={inputCls} style={{ borderColor: 'var(--border)' }}
              disabled={readOnly} value={c.charge_etp ?? ''}
              onChange={e => set({ charge_etp: e.target.value === '' ? null : Number(e.target.value) })} />
          </div>
          <div>
            <label className={labelCls}>Origine des ressources</label>
            <select className={inputCls} style={{ borderColor: 'var(--border)' }}
              disabled={readOnly} value={c.origine_ressources ?? ''}
              onChange={e => set({ origine_ressources: e.target.value || null })}>
              <option value="">— à définir —</option>
              {ORIGINES.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              {ORIGINES.find(o => o.v === c.origine_ressources)?.aide}
            </p>
          </div>
        </div>
        <Zone cle="budget_adosse" titre="Budget adossé à une enveloppe existante"
          aide="Cette part réoriente une dépense déjà consentie ; elle n’appelle pas de décision budgétaire." />
        <Zone cle="budget_nouveau" titre="Budget appelant une enveloppe nouvelle"
          aide="La seule part qui demande un arbitrage. La distinguer est le premier argument devant la Direction Financière." />
      </div>

      <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--card-bg)' }}>
        <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-300">Pourquoi le faire, et comment savoir si c’est réussi</h3>
        <Zone cle="justification" titre="10 · Justification" lignes={3} />
        <Zone cle="alternatives" titre="Alternatives examinées"
          aide="Y compris le statu quo, avec ce qu’il coûterait." lignes={3} />
        <Zone cle="criteres_succes" titre="11 · Critères de succès" lignes={3} />
        <Zone cle="seuils_impact" titre="Seuils de déclenchement"
          aide="Au-delà de quoi l’échelon supérieur est saisi. Sans seuil, la dérive est invisible." lignes={2} />
        <div>
          <label className={labelCls}>12 · Approche de développement</label>
          <select className={inputCls} style={{ borderColor: 'var(--border)' }}
            disabled={readOnly} value={c.approche ?? ''}
            onChange={e => set({ approche: e.target.value || null })}>
            <option value="">— à choisir —</option>
            {APPROCHES.map(a => <option key={a.v} value={a.v}>{a.l}</option>)}
          </select>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            {APPROCHES.find(a => a.v === c.approche)?.aide
              ?? 'Elle se choisit selon la stabilité de l’exigence, elle ne s’hérite pas des habitudes.'}
          </p>
        </div>
      </div>

      {message && <p className="text-sm text-indigo-700 dark:text-indigo-300">{message}</p>}

      {!readOnly && (
        <div className="flex justify-end">
          <button onClick={enregistrer} disabled={enCours}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
            {enCours ? 'Enregistrement…' : 'Enregistrer la fiche'}
          </button>
        </div>
      )}
    </div>
  )
}

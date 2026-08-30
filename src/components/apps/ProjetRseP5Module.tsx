'use client'

// Analyse d'impact P5 — People, Planet, Prosperity, Product, Process.
//
// Chaque élément se cote de −3 à +3. La règle anti-masquage est le cœur de la
// méthode : un impact très négatif ne se compense pas par un impact positif
// ailleurs. L'application ne propose donc jamais une moyenne comme résultat —
// elle affiche, pour chaque catégorie, le pire élément coté, et la liste de
// ceux qui atteignent −2 ou −3.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ProjetRseModuleProps } from '@/lib/projetRseModules'

interface Cotation { id: string; code: string; note: number; commentaire: string | null }

interface Element { code: string; libelle: string }
interface Categorie { cle: string; nom: string; couleur: string; groupes: { nom: string; elements: Element[] }[] }

/** Référentiel des éléments. Porté par le code, jamais figé en base. */
const REFERENTIEL: Categorie[] = [
  { cle: 'people', nom: 'People — les personnes', couleur: 'text-teal-700 dark:text-teal-300', groupes: [
    { nom: 'Travail et conditions décentes', elements: [
      { code: 'pe.emploi', libelle: 'Emploi et stabilité des postes' },
      { code: 'pe.dialogue', libelle: 'Dialogue social et relations de travail' },
      { code: 'pe.sst', libelle: 'Santé et sécurité au travail' },
      { code: 'pe.formation', libelle: 'Formation et développement des compétences' },
      { code: 'pe.apprentissage', libelle: 'Apprentissage organisationnel' },
      { code: 'pe.diversite', libelle: 'Diversité et égalité des chances' },
    ]},
    { nom: 'Société et utilisateurs', elements: [
      { code: 'pe.communaute', libelle: 'Soutien aux communautés locales' },
      { code: 'pe.politiques', libelle: 'Influence sur les politiques publiques' },
      { code: 'pe.securite_produit', libelle: 'Santé et sécurité des utilisateurs' },
      { code: 'pe.etiquetage', libelle: 'Information et étiquetage produit' },
      { code: 'pe.communication', libelle: 'Loyauté de la communication commerciale' },
      { code: 'pe.donnees', libelle: 'Protection des données personnelles' },
    ]},
    { nom: 'Droits humains', elements: [
      { code: 'pe.discrimination', libelle: 'Non-discrimination' },
      { code: 'pe.association', libelle: 'Liberté d’association' },
      { code: 'pe.enfants', libelle: 'Travail des enfants' },
      { code: 'pe.force', libelle: 'Travail forcé' },
    ]},
    { nom: 'Comportement éthique', elements: [
      { code: 'pe.achats', libelle: 'Éthique des achats et des investissements' },
      { code: 'pe.corruption', libelle: 'Lutte contre la corruption' },
      { code: 'pe.concurrence', libelle: 'Loyauté de la concurrence' },
    ]},
  ]},
  { cle: 'planet', nom: 'Planet — les milieux', couleur: 'text-green-700 dark:text-green-300', groupes: [
    { nom: 'Transport', elements: [
      { code: 'pl.local', libelle: 'Approvisionnement local' },
      { code: 'pl.numerique', libelle: 'Substitution numérique aux déplacements' },
      { code: 'pl.deplacements', libelle: 'Déplacements professionnels' },
      { code: 'pl.logistique', libelle: 'Logistique amont et aval' },
    ]},
    { nom: 'Énergie', elements: [
      { code: 'pl.energie', libelle: 'Énergie consommée' },
      { code: 'pl.emissions', libelle: 'Émissions de gaz à effet de serre' },
      { code: 'pl.recuperation', libelle: 'Récupération et valorisation d’énergie' },
    ]},
    { nom: 'Terre, air et eau', elements: [
      { code: 'pl.biodiversite', libelle: 'Biodiversité et habitats' },
      { code: 'pl.air', libelle: 'Qualité de l’air' },
      { code: 'pl.eau', libelle: 'Qualité et disponibilité de l’eau' },
      { code: 'pl.sol', libelle: 'Qualité des sols' },
    ]},
    { nom: 'Consommation', elements: [
      { code: 'pl.recyclage', libelle: 'Recyclage et réemploi' },
      { code: 'pl.dechets', libelle: 'Production et traitement des déchets' },
      { code: 'pl.reutilisabilite', libelle: 'Réutilisabilité du produit' },
      { code: 'pl.matieres', libelle: 'Consommation de matières vierges' },
    ]},
  ]},
  { cle: 'prosperity', nom: 'Prosperity — la valeur économique', couleur: 'text-indigo-700 dark:text-indigo-300', groupes: [
    { nom: 'Analyse économique', elements: [
      { code: 'pr.valeur', libelle: 'Valeur actuelle nette' },
      { code: 'pr.ratio', libelle: 'Rapport bénéfices sur coûts' },
      { code: 'pr.retour', libelle: 'Délai de retour' },
    ]},
    { nom: 'Agilité de l’entreprise', elements: [
      { code: 'pr.flexibilite', libelle: 'Flexibilité et options ouvertes' },
      { code: 'pr.marche', libelle: 'Accès aux marchés et référencements' },
    ]},
    { nom: 'Stimulation économique', elements: [
      { code: 'pr.local_eco', libelle: 'Retombées économiques locales' },
      { code: 'pr.indirects', libelle: 'Bénéfices indirects' },
      { code: 'pr.fiscal', libelle: 'Contribution fiscale territoriale' },
    ]},
  ]},
  { cle: 'product', nom: 'Product — le produit', couleur: 'text-amber-700 dark:text-amber-300', groupes: [
    { nom: 'Cycle de vie', elements: [
      { code: 'pd.duree', libelle: 'Durée de vie du produit' },
      { code: 'pd.entretien', libelle: 'Réparabilité et entretien' },
      { code: 'pd.fin_vie', libelle: 'Fin de vie et démontabilité' },
      { code: 'pd.tracabilite', libelle: 'Traçabilité des matières' },
    ]},
  ]},
  { cle: 'process', nom: 'Process — la conduite', couleur: 'text-violet-700 dark:text-violet-300', groupes: [
    { nom: 'Qualité de la conduite', elements: [
      { code: 'ps.efficience', libelle: 'Efficience du processus' },
      { code: 'ps.efficacite', libelle: 'Efficacité du processus' },
      { code: 'ps.equite', libelle: 'Équité des processus — accès à l’information, mécanisme de réclamation' },
      { code: 'ps.maturite', libelle: 'Maturité et capitalisation' },
    ]},
  ]},
]

const NOTES = [
  { v: -3, l: '−3', aide: 'Impact très négatif' }, { v: -2, l: '−2', aide: 'Impact négatif' },
  { v: -1, l: '−1', aide: 'Impact légèrement négatif' }, { v: 0, l: '0', aide: 'Neutre' },
  { v: 1, l: '+1', aide: 'Impact légèrement positif' }, { v: 2, l: '+2', aide: 'Impact positif' },
  { v: 3, l: '+3', aide: 'Impact très positif' },
]

function couleurNote(n: number | undefined) {
  if (n === undefined) return 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
  if (n <= -2) return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
  if (n === -1) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300'
  if (n === 0) return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  if (n === 1) return 'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300'
  return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
}

export default function ProjetRseP5Module({ projetId, readOnly }: ProjetRseModuleProps) {
  const base = `/api/projet-rse/projets/${projetId}/p5`
  const [cotations, setCotations] = useState<Cotation[]>([])
  const [charge, setCharge] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [ouvert, setOuvert] = useState<string | null>(REFERENTIEL[0].cle)

  const charger = useCallback(async () => {
    try {
      const r = await fetch(base); const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? 'Chargement impossible')
      setCotations(j.cotations ?? [])
    } catch (e) { setErreur(e instanceof Error ? e.message : String(e)) }
    finally { setCharge(true) }
  }, [base])

  useEffect(() => { void charger() }, [charger])

  const parCode = useMemo(() => {
    const m: Record<string, Cotation> = {}
    for (const c of cotations) m[c.code] = c
    return m
  }, [cotations])

  const coter = async (code: string, note: number) => {
    const existante = parCode[code]
    try {
      const r = existante
        ? await fetch(base, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: existante.id, note }) })
        : await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, note }) })
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? 'Cotation impossible')
      await charger()
    } catch (e) { setErreur(e instanceof Error ? e.message : String(e)) }
  }

  const tousElements = REFERENTIEL.flatMap(c => c.groupes.flatMap(g => g.elements))
  const cotes = tousElements.filter(e => parCode[e.code] !== undefined)
  const alertes = tousElements
    .map(e => ({ e, n: parCode[e.code]?.note }))
    .filter(x => x.n !== undefined && x.n <= -2)

  if (!charge) return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Chargement…</p>

  return (
    <div className="space-y-4">
      {erreur && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400 flex items-start justify-between gap-3">
          <span>{erreur}</span>
          <button onClick={() => setErreur(null)} className="shrink-0 font-medium hover:underline">Fermer</button>
        </div>
      )}

      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
        <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-300">La règle anti-masquage</h3>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          Un impact très négatif ne se compense pas par un impact positif ailleurs. Cette page n’affiche
          donc jamais de moyenne : elle montre, pour chaque catégorie, le pire élément coté. Un projet dont
          la moyenne serait bonne et qui porte un −3 quelque part reste un projet à revoir.
        </p>
        <p className="mt-2 text-sm">
          <strong>{cotes.length}</strong> élément{cotes.length > 1 ? 's' : ''} coté{cotes.length > 1 ? 's' : ''} sur {tousElements.length}
        </p>
        {alertes.length > 0 && (
          <div className="mt-2 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2">
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">
              {alertes.length} impact{alertes.length > 1 ? 's' : ''} négatif{alertes.length > 1 ? 's' : ''} marqué{alertes.length > 1 ? 's' : ''}
            </p>
            <ul className="mt-1 text-xs text-red-700 dark:text-red-400">
              {alertes.map(a => <li key={a.e.code}>{a.e.libelle} — {a.n}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* Le pire par catégorie, jamais la moyenne */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
        {REFERENTIEL.map(c => {
          const notes = c.groupes.flatMap(g => g.elements)
            .map(e => parCode[e.code]?.note).filter((n): n is number => n !== undefined)
          const pire = notes.length ? Math.min(...notes) : undefined
          return (
            <button key={c.cle} onClick={() => setOuvert(ouvert === c.cle ? null : c.cle)}
              className={`rounded-lg border p-3 text-left transition-colors ${ouvert === c.cle
                ? 'border-indigo-400 dark:border-indigo-600' : ''}`}
              style={{ borderColor: ouvert === c.cle ? undefined : 'var(--border)', background: 'var(--bg-card)' }}>
              <p className={`text-xs font-bold ${c.couleur}`}>{c.nom.split(' — ')[0]}</p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{c.nom.split(' — ')[1]}</p>
              <p className="mt-1.5">
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${couleurNote(pire)}`}>
                  {pire === undefined ? 'non coté' : `pire : ${pire > 0 ? '+' : ''}${pire}`}
                </span>
              </p>
              <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>{notes.length} coté(s)</p>
            </button>
          )
        })}
      </div>

      {REFERENTIEL.filter(c => c.cle === ouvert).map(c => (
        <div key={c.cle} className="rounded-xl border p-4 space-y-4"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
          <h3 className={`text-sm font-bold ${c.couleur}`}>{c.nom}</h3>
          {c.groupes.map(g => (
            <div key={g.nom}>
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{g.nom}</p>
              <ul className="mt-1 space-y-1">
                {g.elements.map(el => {
                  const n = parCode[el.code]?.note
                  return (
                    <li key={el.code} className="flex flex-wrap items-center gap-2 py-1 border-b last:border-b-0"
                      style={{ borderColor: 'var(--border)' }}>
                      <span className="flex-1 min-w-[14rem] text-sm text-gray-800 dark:text-gray-200">{el.libelle}</span>
                      <div className="flex gap-0.5">
                        {NOTES.map(o => (
                          <button key={o.v} disabled={readOnly} title={o.aide}
                            onClick={() => coter(el.code, o.v)}
                            className={`w-8 h-7 text-xs font-semibold rounded transition-colors ${
                              n === o.v ? couleurNote(o.v) + ' ring-2 ring-indigo-500'
                                : 'bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                            {o.l}
                          </button>
                        ))}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

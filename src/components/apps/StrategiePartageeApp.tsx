'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { RseContext } from '@/components/rse/RseAppShell'

// ─── Méthode Hoshin Kanri « Stratégie Partagée » (AQM Conseil) — Phase 1 : Élaborer ───
// Document vivant unique par organisation. Modules : Mission, SWOT, Attentes (Kano),
// Vision (4 parties prenantes), Valeurs & règles du jeu, Axes & Lignes d'actions,
// Stratégie d'activité. Sauvegarde manuelle via le bouton du header.

// ── Types ────────────────────────────────────────────────────────────────────
interface Mission { raisonEtre: string; criteres: Record<string, boolean> }
interface Swot { forces: string[]; faiblesses: string[]; opportunites: string[]; menaces: string[] }
interface Attentes { base: string[]; proportionnel: string[]; attractif: string[]; avantages: string[]; nps: string }
interface VisionParties { hommes: string; marche: string; environnement: string; entreprise: string }
interface VisionQuestions { entreprise: string; clients: string; marche: string; personnel: string; fonctionnement: string }
interface Vision { synthetique: string; detaillee: string; chiffree: string; parties: VisionParties; questions: VisionQuestions }
interface Valeur { valeur: string; regles: string[] }
interface LigneAction { enonce: string; objectif: string; indicateur: string; niveauActuel: string; cible: string; echeance: string; deployable: boolean }
interface Axe { titre: string; freins: string[]; lignes: LigneAction[] }
interface StrategieActivite { produits: string[]; notes: string }
// Phase 2 — Déployer
interface Hoshin { scores: Record<string, Record<string, number>>; sponsors: Record<string, string> }
interface BscItem { objectif: string; indicateur: string; cible: string }
interface Bsc { finances: BscItem[]; clients: BscItem[]; processus: BscItem[]; apprentissage: BscItem[] }
interface MasterRow { libelle: string; type: 'action' | 'projet'; pilotage: 'hierarchique' | 'transversal' | 'projet'; responsable: string; livrables: string; echeance: string }

interface Doc {
  horizon: string
  mission: Mission
  swot: Swot
  attentes: Attentes
  vision: Vision
  valeurs: Valeur[]
  axes: Axe[]
  strategie_activite: StrategieActivite
  hoshin: Hoshin
  bsc: Bsc
  master_plan: MasterRow[]
}

const MISSION_CRITERES: { key: string; label: string }[] = [
  { key: 'clients', label: 'Centrée sur la satisfaction des besoins des clients / usagers / parties prenantes' },
  { key: 'metier', label: 'Basée sur le cœur de compétence / métier de l’organisation' },
  { key: 'engagement', label: 'Motive et inspire l’engagement des équipes' },
  { key: 'claire', label: 'Réaliste, claire, facile à comprendre' },
  { key: 'memorable', label: 'Spécifique, courte, interpellante et mémorable' },
  { key: 'coherente', label: 'Cohérente avec la vision' },
]

const VISION_QUESTIONS: { key: keyof VisionQuestions; label: string }[] = [
  { key: 'entreprise', label: 'Comment voyons-nous notre entreprise à l’horizon ? (marché, clients, produits, RH, CA, sites, résultats)' },
  { key: 'clients', label: 'Comment voyons-nous nos clients et comment voulons-nous être vus par eux ? (attractivité, image)' },
  { key: 'marche', label: 'Comment voulons-nous être vus par le marché, notre écosystème et notre environnement ?' },
  { key: 'personnel', label: 'Comment voyons-nous notre personnel et comment voulons-nous être vus par lui ? (relations, hiérarchie)' },
  { key: 'fonctionnement', label: 'Comment voyons-nous notre fonctionnement et nos outils ? (organisation, processus, SI, infrastructures)' },
]

function emptyDoc(): Doc {
  return {
    horizon: '',
    mission: { raisonEtre: '', criteres: {} },
    swot: { forces: [], faiblesses: [], opportunites: [], menaces: [] },
    attentes: { base: [], proportionnel: [], attractif: [], avantages: [], nps: '' },
    vision: {
      synthetique: '', detaillee: '', chiffree: '',
      parties: { hommes: '', marche: '', environnement: '', entreprise: '' },
      questions: { entreprise: '', clients: '', marche: '', personnel: '', fonctionnement: '' },
    },
    valeurs: [],
    axes: [],
    strategie_activite: { produits: [], notes: '' },
    hoshin: { scores: {}, sponsors: {} },
    bsc: { finances: [], clients: [], processus: [], apprentissage: [] },
    master_plan: [],
  }
}

type TabKey = 'presentation' | 'mission' | 'swot' | 'attentes' | 'vision' | 'valeurs' | 'axes' | 'activite' | 'hoshin' | 'bsc' | 'masterplan'
const TABS: { key: TabKey; label: string; phase: 1 | 2 }[] = [
  { key: 'presentation', label: '📖 Présentation', phase: 1 },
  { key: 'mission', label: '🎯 Mission', phase: 1 },
  { key: 'swot', label: '⚖️ SWOT', phase: 1 },
  { key: 'attentes', label: '👥 Attentes clients', phase: 1 },
  { key: 'vision', label: '🔭 Vision', phase: 1 },
  { key: 'valeurs', label: '💎 Valeurs', phase: 1 },
  { key: 'axes', label: '🧭 Axes & Lignes d’actions', phase: 1 },
  { key: 'activite', label: '📦 Stratégie d’activité', phase: 1 },
  { key: 'hoshin', label: '🔀 Matrice Hoshin', phase: 2 },
  { key: 'bsc', label: '📊 Balanced Scorecard', phase: 2 },
  { key: 'masterplan', label: '🗓️ Master Plan', phase: 2 },
]

// ── Styles ────────────────────────────────────────────────────────────────────
const input = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500'
const label = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'
const card = 'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 p-5 space-y-4'
const btnGhost = 'px-2.5 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors'
const hint = 'text-xs text-gray-400 dark:text-gray-500'

// ── Éditeur de liste de chaînes ────────────────────────────────────────────────
function StringList({ items, onChange, placeholder, readOnly }: { items: string[]; onChange: (v: string[]) => void; placeholder?: string; readOnly?: boolean }) {
  const [draft, setDraft] = useState('')
  function add() { const v = draft.trim(); if (!v) return; onChange([...items, v]); setDraft('') }
  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-2 group">
              <span className="mt-1 text-indigo-400">•</span>
              <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{it}</span>
              {!readOnly && (
                <button onClick={() => onChange(items.filter((_, j) => j !== i))} title="Supprimer"
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 text-xs transition-opacity">✕</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <div className="flex gap-2">
          <input className={input} value={draft} placeholder={placeholder ?? 'Ajouter…'} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
          <button className={btnGhost} onClick={add}>+ Ajouter</button>
        </div>
      )}
    </div>
  )
}

export default function StrategiePartageeApp({ ctx }: { ctx: RseContext }) {
  const orgId = ctx.org?.id ?? null
  const readOnly = ctx.isShared // les collaborateurs en lecture ne peuvent pas éditer (le back gère aussi le droit d'édition)

  const [tab, setTab] = useState<TabKey>('presentation')
  const [doc, setDoc] = useState<Doc>(emptyDoc())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const initial = useRef(false)

  // ── Chargement ──
  const reload = useCallback(async () => {
    if (!orgId) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/strategie-partagee/data?org_id=${orgId}`)
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Erreur de chargement')
      const d = emptyDoc()
      if (j.data) {
        const row = j.data as Record<string, unknown>
        d.horizon = (row.horizon as string) ?? ''
        Object.assign(d.mission, row.mission ?? {})
        Object.assign(d.swot, row.swot ?? {})
        Object.assign(d.attentes, row.attentes ?? {})
        if (row.vision) {
          const v = row.vision as Partial<Vision>
          d.vision = { ...d.vision, ...v, parties: { ...d.vision.parties, ...(v.parties ?? {}) }, questions: { ...d.vision.questions, ...(v.questions ?? {}) } }
        }
        d.valeurs = Array.isArray(row.valeurs) ? row.valeurs as Valeur[] : []
        d.axes = Array.isArray(row.axes) ? row.axes as Axe[] : []
        Object.assign(d.strategie_activite, row.strategie_activite ?? {})
        if (row.hoshin) { const h = row.hoshin as Partial<Hoshin>; d.hoshin = { scores: h.scores ?? {}, sponsors: h.sponsors ?? {} } }
        if (row.bsc) Object.assign(d.bsc, row.bsc)
        d.master_plan = Array.isArray(row.master_plan) ? row.master_plan as MasterRow[] : []
      }
      setDoc(d); setDirty(false); initial.current = true
    } catch (e) { setError(String((e as Error).message ?? e)) }
    finally { setLoading(false) }
  }, [orgId])

  useEffect(() => { reload() }, [reload])

  // ── Sauvegarde (bouton header) ──
  const save = useCallback(async () => {
    if (!orgId) return
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/strategie-partagee/data`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, ...doc }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error ?? 'Erreur')
      setDirty(false)
    } catch (e) { setError(String((e as Error).message ?? e)) }
    finally { setSaving(false) }
  }, [orgId, doc])

  useEffect(() => {
    if (!orgId || readOnly) { ctx.setActions(null); return }
    ctx.setActions(
      <button onClick={save} disabled={saving || !dirty}
        className="px-3 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50">
        {saving ? 'Enregistrement…' : dirty ? '💾 Enregistrer' : '✓ Enregistré'}
      </button>
    )
    return () => ctx.setActions(null)
  }, [orgId, readOnly, saving, dirty, save, ctx])

  // Helper de mise à jour immuable + marquage dirty
  function update(mut: (d: Doc) => void) {
    setDoc(prev => { const next = structuredClone(prev); mut(next); return next })
    if (initial.current) setDirty(true)
  }

  if (!orgId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500 dark:text-gray-400 max-w-md">
          <div className="text-5xl mb-3">🧭</div>
          <p className="text-sm">Sélectionnez une organisation dans la barre latérale pour élaborer sa stratégie partagée.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* En-tête */}
      <div className="flex items-center gap-2">
        <span className="text-2xl">🧭</span>
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Stratégie Partagée — Hoshin Kanri</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{ctx.org?.denomination}{readOnly ? ' · lecture seule (dossier partagé)' : ''}</p>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {TABS.map((t, i) => (
          <span key={t.key} className="flex items-center">
            {i > 0 && TABS[i - 1].phase !== t.phase && (
              <span className="mx-1 text-xs text-gray-300 dark:text-gray-600 select-none" title="Phase 2 — Déployer">·</span>
            )}
            <button onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-sm whitespace-nowrap transition-colors ${tab === t.key
                ? 'text-indigo-700 dark:text-indigo-400 font-semibold border-b-2 border-indigo-500'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
              {t.label}
            </button>
          </span>
        ))}
      </div>

      {error && <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>}

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Chargement…</div>
      ) : (
        <>
          {tab === 'presentation' && <Presentation horizon={doc.horizon} onHorizon={v => update(d => { d.horizon = v })} readOnly={readOnly} />}
          {tab === 'mission' && <MissionTab mission={doc.mission} update={update} readOnly={readOnly} />}
          {tab === 'swot' && <SwotTab swot={doc.swot} update={update} readOnly={readOnly} />}
          {tab === 'attentes' && <AttentesTab a={doc.attentes} update={update} readOnly={readOnly} />}
          {tab === 'vision' && <VisionTab vision={doc.vision} update={update} readOnly={readOnly} />}
          {tab === 'valeurs' && <ValeursTab valeurs={doc.valeurs} update={update} readOnly={readOnly} />}
          {tab === 'axes' && <AxesTab axes={doc.axes} update={update} readOnly={readOnly} />}
          {tab === 'activite' && <ActiviteTab sa={doc.strategie_activite} update={update} readOnly={readOnly} />}
          {tab === 'hoshin' && <HoshinTab axes={doc.axes} hoshin={doc.hoshin} update={update} readOnly={readOnly} />}
          {tab === 'bsc' && <BscTab bsc={doc.bsc} update={update} readOnly={readOnly} />}
          {tab === 'masterplan' && <MasterPlanTab rows={doc.master_plan} update={update} readOnly={readOnly} />}
        </>
      )}
    </div>
  )
}

type Upd = (mut: (d: Doc) => void) => void

// ── Présentation ──
function Presentation({ horizon, onHorizon, readOnly }: { horizon: string; onHorizon: (v: string) => void; readOnly: boolean }) {
  const etapes = [
    'Annonce du lancement de la démarche',
    'Partage et cadrage du projet au niveau Direction',
    'Contributions des équipes au projet (co-construction)',
    'Synthèse et enrichissement, structuration du déploiement',
    'Déploiement du projet dans les équipes',
    'Synthèse des déploiements et ajustement des plans',
    'Plénière : partage du projet et appropriation',
  ]
  return (
    <div className="space-y-5">
      <div className={card}>
        <h3 className="font-semibold text-gray-900 dark:text-white">La démarche « Stratégie Partagée » (Hoshin Kanri)</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300">Trois temps : <strong>1. Élaborer</strong> la stratégie · <strong>2. Déployer</strong> la stratégie · <strong>3. Piloter</strong> la stratégie. Cet espace couvre la phase <strong>Élaborer</strong> : mission, analyse (SWOT, attentes clients), vision, valeurs, axes stratégiques et lignes d’actions, stratégie d’activité.</p>
        <div className="max-w-xs">
          <label className={label}>Horizon de la vision (ex. 2027-2029)</label>
          <input className={input} value={horizon} onChange={e => onHorizon(e.target.value)} placeholder="20XX - 20XX" disabled={readOnly} />
        </div>
      </div>
      <div className={card}>
        <h3 className="font-semibold text-gray-900 dark:text-white">Déroulé d’animation (intégration des équipes dès le début)</h3>
        <ol className="space-y-2">
          {etapes.map((e, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
              <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-bold">{i + 1}</span>
              {e}
            </li>
          ))}
        </ol>
        <p className={hint}>Étapes 3 à 6 : itération de 3 à 6 mois entre la Direction et les équipes.</p>
      </div>
    </div>
  )
}

// ── Mission ──
function MissionTab({ mission, update, readOnly }: { mission: Mission; update: Upd; readOnly: boolean }) {
  return (
    <div className={card}>
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-white">Mission — raison d’être</h3>
        <p className={hint}>Élaborée en termes nobles : « une activité au profit d’un client ». Réaliste, claire, courte et mémorable.</p>
      </div>
      <textarea className={`${input} h-28`} value={mission.raisonEtre} disabled={readOnly}
        onChange={e => update(d => { d.mission.raisonEtre = e.target.value })}
        placeholder="Notre raison d’être est de…" />
      <div>
        <p className={label}>Critères de validation</p>
        <div className="space-y-2">
          {MISSION_CRITERES.map(c => (
            <label key={c.key} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" className="mt-0.5 accent-indigo-600" disabled={readOnly}
                checked={!!mission.criteres[c.key]}
                onChange={e => update(d => { d.mission.criteres[c.key] = e.target.checked })} />
              {c.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── SWOT ──
function SwotTab({ swot, update, readOnly }: { swot: Swot; update: Upd; readOnly: boolean }) {
  const quadrants: { key: keyof Swot; title: string; sub: string; cls: string }[] = [
    { key: 'forces', title: 'Forces', sub: 'Interne · Positif — Qu’est-ce que nous faisons bien ? Sur quoi nous appuyer ?', cls: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' },
    { key: 'faiblesses', title: 'Faiblesses', sub: 'Interne · Négatif — Qu’est-ce qui ne marche pas bien ? Quoi surmonter ?', cls: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
    { key: 'opportunites', title: 'Opportunités', sub: 'Externe · Positif — Quels facteurs externes exploiter ? Nos potentiels ?', cls: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
    { key: 'menaces', title: 'Menaces', sub: 'Externe · Négatif — Quels changements / menaces pèsent sur notre projet ?', cls: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
  ]
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {quadrants.map(q => (
        <div key={q.key} className={`rounded-xl border p-4 space-y-3 ${q.cls}`}>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{q.title}</h3>
            <p className={hint}>{q.sub}</p>
          </div>
          <StringList items={swot[q.key]} readOnly={readOnly} onChange={v => update(d => { d.swot[q.key] = v })} placeholder={`Ajouter une ${q.title.toLowerCase()}…`} />
        </div>
      ))}
    </div>
  )
}

// ── Attentes clients (Kano) ──
function AttentesTab({ a, update, readOnly }: { a: Attentes; update: Upd; readOnly: boolean }) {
  const cats: { key: keyof Attentes; title: string; sub: string }[] = [
    { key: 'base', title: 'Attentes de base (obligatoire)', sub: 'Le « dû » — leur absence génère de l’insatisfaction, leur présence ne satisfait pas.' },
    { key: 'proportionnel', title: 'Attentes proportionnelles (performance)', sub: 'Plus c’est présent, plus le client est satisfait — identifient la performance.' },
    { key: 'attractif', title: 'Attentes attractives (séduction)', sub: 'Déclenchent l’achat, assurent fidélité et recommandation.' },
  ]
  return (
    <div className="space-y-4">
      <div className={card}>
        <h3 className="font-semibold text-gray-900 dark:text-white">Attentes clients — modèle de Kano</h3>
        <p className={hint}>Quelles sont les principales attentes de nos clients (aujourd’hui et demain) ? Répartissez-les par catégorie.</p>
      </div>
      {cats.map(c => (
        <div key={c.key} className={card}>
          <div><h4 className="font-medium text-gray-900 dark:text-white">{c.title}</h4><p className={hint}>{c.sub}</p></div>
          <StringList items={a[c.key] as string[]} readOnly={readOnly} onChange={v => update(d => { (d.attentes[c.key] as string[]) = v })} />
        </div>
      ))}
      <div className={card}>
        <h4 className="font-medium text-gray-900 dark:text-white">Avantages compétitifs</h4>
        <p className={hint}>En quoi sommes-nous différenciants ? Ce que nous faisons ou sommes d’unique.</p>
        <StringList items={a.avantages} readOnly={readOnly} onChange={v => update(d => { d.attentes.avantages = v })} />
        <div className="max-w-xs pt-2">
          <label className={label}>NPS — Net Promoter Score (indicatif)</label>
          <input className={input} value={a.nps} disabled={readOnly} onChange={e => update(d => { d.attentes.nps = e.target.value })} placeholder="ex. +32" />
        </div>
      </div>
    </div>
  )
}

// ── Vision ──
function VisionTab({ vision, update, readOnly }: { vision: Vision; update: Upd; readOnly: boolean }) {
  const parties: { key: keyof VisionParties; label: string }[] = [
    { key: 'hommes', label: 'Hommes (collaborateurs)' },
    { key: 'marche', label: 'Marché / Clients' },
    { key: 'environnement', label: 'Environnement / Écosystème' },
    { key: 'entreprise', label: 'Entreprise / Actionnaires' },
  ]
  return (
    <div className="space-y-4">
      <div className={card}>
        <h3 className="font-semibold text-gray-900 dark:text-white">Vision — « À quelle entreprise rêvons-nous ? »</h3>
        <p className={hint}>Audacieuse, inspirante, motivante, chiffrée autant que possible. Prend en compte les 4 parties prenantes.</p>
        <div>
          <label className={label}>Vision synthétique (une phrase — le rêve partagé)</label>
          <input className={input} value={vision.synthetique} disabled={readOnly} onChange={e => update(d => { d.vision.synthetique = e.target.value })} placeholder="En 20XX, nous serons…" />
        </div>
        <div>
          <label className={label}>Vision détaillée (plusieurs phrases décrivant l’état futur)</label>
          <textarea className={`${input} h-28`} value={vision.detaillee} disabled={readOnly} onChange={e => update(d => { d.vision.detaillee = e.target.value })} />
        </div>
        <div>
          <label className={label}>Éléments chiffrés (CA, effectifs, sites, parts de marché…)</label>
          <textarea className={`${input} h-20`} value={vision.chiffree} disabled={readOnly} onChange={e => update(d => { d.vision.chiffree = e.target.value })} />
        </div>
      </div>
      <div className={card}>
        <h4 className="font-medium text-gray-900 dark:text-white">Les 4 parties prenantes de la vision</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {parties.map(p => (
            <div key={p.key}>
              <label className={label}>{p.label}</label>
              <textarea className={`${input} h-24`} value={vision.parties[p.key]} disabled={readOnly} onChange={e => update(d => { d.vision.parties[p.key] = e.target.value })} />
            </div>
          ))}
        </div>
      </div>
      <div className={card}>
        <h4 className="font-medium text-gray-900 dark:text-white">Questions structurantes</h4>
        <div className="space-y-3">
          {VISION_QUESTIONS.map(q => (
            <div key={q.key}>
              <label className={label}>{q.label}</label>
              <textarea className={`${input} h-20`} value={vision.questions[q.key]} disabled={readOnly} onChange={e => update(d => { d.vision.questions[q.key] = e.target.value })} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Valeurs & règles du jeu ──
function ValeursTab({ valeurs, update, readOnly }: { valeurs: Valeur[]; update: Upd; readOnly: boolean }) {
  return (
    <div className="space-y-4">
      <div className={card}>
        <h3 className="font-semibold text-gray-900 dark:text-white">Valeurs & règles du jeu</h3>
        <p className={hint}>Culture, morale et éthique à partager. Chaque valeur se traduit en règles de comportement concrètes, formulées positivement et évaluables. Le management doit être exemplaire.</p>
      </div>
      {valeurs.map((v, i) => (
        <div key={i} className={card}>
          <div className="flex items-center gap-2">
            <input className={input} value={v.valeur} disabled={readOnly} placeholder="Valeur (ex. Intégrité, Esprit d’équipe…)"
              onChange={e => update(d => { d.valeurs[i].valeur = e.target.value })} />
            {!readOnly && <button className={btnGhost} onClick={() => update(d => { d.valeurs.splice(i, 1) })}>Supprimer</button>}
          </div>
          <div>
            <label className={label}>Règles de comportement associées</label>
            <StringList items={v.regles} readOnly={readOnly} onChange={val => update(d => { d.valeurs[i].regles = val })} placeholder="Je… / Nous… (formulation positive)" />
          </div>
        </div>
      ))}
      {!readOnly && <button className={btnGhost} onClick={() => update(d => { d.valeurs.push({ valeur: '', regles: [] }) })}>+ Ajouter une valeur</button>}
    </div>
  )
}

// ── Axes stratégiques & Lignes d'actions ──
function AxesTab({ axes, update, readOnly }: { axes: Axe[]; update: Upd; readOnly: boolean }) {
  return (
    <div className="space-y-4">
      <div className={card}>
        <h3 className="font-semibold text-gray-900 dark:text-white">Axes stratégiques & Lignes d’actions</h3>
        <p className={hint}>4 à 6 axes : les grandes voies pour atteindre la vision. Chaque ligne d’action précise un axe (énoncé, objectif/résultat, indicateur, niveau actuel, cible, échéance, déployable ou non). Identifiez aussi les freins et obstacles majeurs.</p>
      </div>
      {axes.map((axe, ai) => (
        <div key={ai} className={card}>
          <div className="flex items-center gap-2">
            <span className="shrink-0 w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">A{ai + 1}</span>
            <input className={`${input} font-medium`} value={axe.titre} disabled={readOnly} placeholder="Énoncé de l’axe stratégique"
              onChange={e => update(d => { d.axes[ai].titre = e.target.value })} />
            {!readOnly && <button className={btnGhost} onClick={() => update(d => { d.axes.splice(ai, 1) })}>Supprimer</button>}
          </div>

          <div>
            <label className={label}>Freins et obstacles majeurs (3 à 4)</label>
            <StringList items={axe.freins} readOnly={readOnly} onChange={v => update(d => { d.axes[ai].freins = v })} />
          </div>

          <div className="space-y-3">
            <p className={label}>Lignes d’actions</p>
            {axe.lignes.map((la, li) => (
              <div key={li} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2 bg-gray-50/60 dark:bg-gray-800/30">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">LA{ai + 1}.{li + 1}</span>
                  <input className={input} value={la.enonce} disabled={readOnly} placeholder="Énoncé de la ligne d’action"
                    onChange={e => update(d => { d.axes[ai].lignes[li].enonce = e.target.value })} />
                  {!readOnly && <button className={btnGhost} onClick={() => update(d => { d.axes[ai].lignes.splice(li, 1) })}>✕</button>}
                </div>
                <div>
                  <label className={label}>Résultat à atteindre (ce qui fera dire qu’on a réussi)</label>
                  <input className={input} value={la.objectif} disabled={readOnly} onChange={e => update(d => { d.axes[ai].lignes[li].objectif = e.target.value })} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div><label className={label}>Indicateur</label><input className={input} value={la.indicateur} disabled={readOnly} onChange={e => update(d => { d.axes[ai].lignes[li].indicateur = e.target.value })} /></div>
                  <div><label className={label}>Niveau actuel</label><input className={input} value={la.niveauActuel} disabled={readOnly} onChange={e => update(d => { d.axes[ai].lignes[li].niveauActuel = e.target.value })} /></div>
                  <div><label className={label}>Cible</label><input className={input} value={la.cible} disabled={readOnly} onChange={e => update(d => { d.axes[ai].lignes[li].cible = e.target.value })} /></div>
                  <div><label className={label}>Échéance</label><input className={input} value={la.echeance} disabled={readOnly} onChange={e => update(d => { d.axes[ai].lignes[li].echeance = e.target.value })} /></div>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" className="accent-indigo-600" disabled={readOnly} checked={la.deployable}
                    onChange={e => update(d => { d.axes[ai].lignes[li].deployable = e.target.checked })} />
                  Déployable au niveau inférieur (n-1)
                </label>
              </div>
            ))}
            {!readOnly && <button className={btnGhost} onClick={() => update(d => { d.axes[ai].lignes.push({ enonce: '', objectif: '', indicateur: '', niveauActuel: '', cible: '', echeance: '', deployable: false }) })}>+ Ligne d’action</button>}
          </div>
        </div>
      ))}
      {!readOnly && <button className={btnGhost} onClick={() => update(d => { d.axes.push({ titre: '', freins: [], lignes: [] }) })}>+ Ajouter un axe stratégique</button>}
    </div>
  )
}

// ── Stratégie d'activité ──
function ActiviteTab({ sa, update, readOnly }: { sa: StrategieActivite; update: Upd; readOnly: boolean }) {
  return (
    <div className={card}>
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-white">Stratégie d’activité</h3>
        <p className={hint}>Quels produits/services pour atteindre notre vision — répondant aux attentes clients et au marché, fruit de notre R&D et de notre innovation ? (Outils possibles : Business Model Canvas d’Osterwalder, Lean Canvas d’Ash Maurya.)</p>
      </div>
      <div>
        <label className={label}>Produits / services clés</label>
        <StringList items={sa.produits} readOnly={readOnly} onChange={v => update(d => { d.strategie_activite.produits = v })} />
      </div>
      <div>
        <label className={label}>Notes (Business Model Canvas / Lean Canvas, plan produit…)</label>
        <textarea className={`${input} h-32`} value={sa.notes} disabled={readOnly} onChange={e => update(d => { d.strategie_activite.notes = e.target.value })} />
      </div>
    </div>
  )
}

// ── Matrice Hoshin d'alignement ────────────────────────────────────────────────
function HoshinTab({ axes, hoshin, update, readOnly }: { axes: Axe[]; hoshin: Hoshin; update: Upd; readOnly: boolean }) {
  // Lignes = toutes les lignes d'actions (aplaties) ; Colonnes = axes. Cellule = contribution 0..3.
  const rows: { rk: string; label: string; texte: string }[] = []
  axes.forEach((axe, ai) => axe.lignes.forEach((la, li) => {
    rows.push({ rk: `${ai}.${li}`, label: `LA${ai + 1}.${li + 1}`, texte: la.enonce || '—' })
  }))
  const cols = axes.map((axe, ai) => ({ ck: `${ai}`, label: `A${ai + 1}`, texte: axe.titre || '—' }))

  if (!cols.length || !rows.length) {
    return (
      <div className={card}>
        <h3 className="font-semibold text-gray-900 dark:text-white">Matrice Hoshin d’alignement</h3>
        <p className={hint}>Renseignez d’abord des <strong>axes stratégiques</strong> et des <strong>lignes d’actions</strong> (onglet « Axes & Lignes d’actions »). La matrice croisera automatiquement lignes d’actions × axes pour vérifier la contribution de chacune (impact fort 3 / moyen 2 / faible 1).</p>
      </div>
    )
  }

  const score = (rk: string, ck: string) => hoshin.scores[rk]?.[ck] ?? 0
  function cycle(rk: string, ck: string) {
    if (readOnly) return
    update(d => {
      const cur = d.hoshin.scores[rk]?.[ck] ?? 0
      const next = (cur + 1) % 4 // 0→1→2→3→0
      if (!d.hoshin.scores[rk]) d.hoshin.scores[rk] = {}
      d.hoshin.scores[rk][ck] = next
    })
  }
  const colTotal = (ck: string) => rows.reduce((s, r) => s + score(r.rk, ck), 0)
  const rowTotal = (rk: string) => cols.reduce((s, c) => s + score(rk, c.ck), 0)
  const cellCls = (v: number) => v === 3 ? 'bg-indigo-600 text-white' : v === 2 ? 'bg-indigo-300 dark:bg-indigo-700 text-gray-900 dark:text-white' : v === 1 ? 'bg-indigo-100 dark:bg-indigo-900/50 text-gray-700 dark:text-gray-200' : 'text-gray-300 dark:text-gray-600'

  return (
    <div className={card}>
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-white">Matrice Hoshin d’alignement</h3>
        <p className={hint}>Cliquez une cellule pour noter la contribution de chaque ligne d’action à chaque axe : <strong>3</strong> fort · <strong>2</strong> moyen · <strong>1</strong> faible · vide = aucune. Une ligne d’action sans contribution ou un axe faiblement couvert signalent un défaut d’alignement.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="text-sm border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left sticky left-0 bg-white dark:bg-gray-800/40 min-w-[220px]">Lignes d’actions \ Axes</th>
              {cols.map(c => (
                <th key={c.ck} className="p-2 align-bottom text-center min-w-[64px]" title={c.texte}>
                  <div className="font-bold text-indigo-700 dark:text-indigo-400">{c.label}</div>
                  <div className="text-[10px] font-normal text-gray-400 max-w-[80px] truncate mx-auto">{c.texte}</div>
                </th>
              ))}
              <th className="p-2 text-center font-semibold">Σ</th>
              <th className="p-2 text-left min-w-[140px]">Sponsor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.rk} className="border-t border-gray-100 dark:border-gray-700">
                <td className="p-2 sticky left-0 bg-white dark:bg-gray-800/40">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{r.label}</span>
                  <span className="text-gray-400"> — {r.texte}</span>
                </td>
                {cols.map(c => {
                  const v = score(r.rk, c.ck)
                  return (
                    <td key={c.ck} className="p-1 text-center">
                      <button onClick={() => cycle(r.rk, c.ck)} disabled={readOnly}
                        className={`w-9 h-9 rounded font-bold ${cellCls(v)} ${readOnly ? '' : 'hover:ring-2 hover:ring-indigo-400'}`}>
                        {v || ''}
                      </button>
                    </td>
                  )
                })}
                <td className="p-2 text-center font-semibold text-gray-700 dark:text-gray-200">{rowTotal(r.rk)}</td>
                <td className="p-1">
                  <input className={input} value={hoshin.sponsors[r.rk] ?? ''} disabled={readOnly}
                    onChange={e => update(d => { d.hoshin.sponsors[r.rk] = e.target.value })} placeholder="Resp." />
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-gray-200 dark:border-gray-600">
              <td className="p-2 sticky left-0 bg-white dark:bg-gray-800/40 font-semibold">Total par axe</td>
              {cols.map(c => <td key={c.ck} className="p-2 text-center font-semibold text-indigo-700 dark:text-indigo-400">{colTotal(c.ck)}</td>)}
              <td /><td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Balanced Scorecard ──────────────────────────────────────────────────────────
function BscTab({ bsc, update, readOnly }: { bsc: Bsc; update: Upd; readOnly: boolean }) {
  const persp: { key: keyof Bsc; title: string; sub: string }[] = [
    { key: 'finances', title: 'Résultats financiers', sub: 'Comment nous voient nos actionnaires ?' },
    { key: 'clients', title: 'Résultats clients', sub: 'Comment nous voient nos clients ?' },
    { key: 'processus', title: 'Processus internes', sub: 'Quels processus maîtriser pour satisfaire clients et actionnaires ?' },
    { key: 'apprentissage', title: 'Apprentissage organisationnel', sub: 'Comment continuer à progresser et créer de la valeur ?' },
  ]
  return (
    <div className="space-y-4">
      <div className={card}>
        <h3 className="font-semibold text-gray-900 dark:text-white">Balanced Scorecard — 4 perspectives</h3>
        <p className={hint}>Traduisez la vision et la stratégie en objectifs et indicateurs équilibrés sur les 4 perspectives.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {persp.map(p => (
          <div key={p.key} className={card}>
            <div><h4 className="font-medium text-gray-900 dark:text-white">{p.title}</h4><p className={hint}>{p.sub}</p></div>
            <div className="space-y-2">
              {bsc[p.key].map((it, i) => (
                <div key={i} className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 space-y-2 bg-gray-50/60 dark:bg-gray-800/30">
                  <div className="flex items-center gap-2">
                    <input className={input} value={it.objectif} disabled={readOnly} placeholder="Objectif"
                      onChange={e => update(d => { d.bsc[p.key][i].objectif = e.target.value })} />
                    {!readOnly && <button className={btnGhost} onClick={() => update(d => { d.bsc[p.key].splice(i, 1) })}>✕</button>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input className={input} value={it.indicateur} disabled={readOnly} placeholder="Indicateur"
                      onChange={e => update(d => { d.bsc[p.key][i].indicateur = e.target.value })} />
                    <input className={input} value={it.cible} disabled={readOnly} placeholder="Cible"
                      onChange={e => update(d => { d.bsc[p.key][i].cible = e.target.value })} />
                  </div>
                </div>
              ))}
              {!readOnly && <button className={btnGhost} onClick={() => update(d => { d.bsc[p.key].push({ objectif: '', indicateur: '', cible: '' }) })}>+ Objectif</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Master Plan ──────────────────────────────────────────────────────────────────
function MasterPlanTab({ rows, update, readOnly }: { rows: MasterRow[]; update: Upd; readOnly: boolean }) {
  const pilotageLabel: Record<MasterRow['pilotage'], string> = { hierarchique: 'Hiérarchique', transversal: 'Transversal', projet: 'Projet' }
  return (
    <div className={card}>
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-white">Master Plan</h3>
        <p className={hint}>Positionnez les actions/projets dans le temps. Précisez le type (action ou projet), le mode de pilotage (hiérarchique/vertical, transversal, ou projet), le responsable, les livrables et l’échéance.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="p-2 min-w-[220px]">Action / Projet</th>
              <th className="p-2">Type</th>
              <th className="p-2">Pilotage</th>
              <th className="p-2 min-w-[120px]">Responsable</th>
              <th className="p-2 min-w-[160px]">Livrables</th>
              <th className="p-2 min-w-[110px]">Échéance</th>
              {!readOnly && <th className="p-2" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-700 align-top">
                <td className="p-1"><input className={input} value={r.libelle} disabled={readOnly} onChange={e => update(d => { d.master_plan[i].libelle = e.target.value })} /></td>
                <td className="p-1">
                  <select className={input} value={r.type} disabled={readOnly} onChange={e => update(d => { d.master_plan[i].type = e.target.value as MasterRow['type'] })}>
                    <option value="action">Action</option><option value="projet">Projet</option>
                  </select>
                </td>
                <td className="p-1">
                  <select className={input} value={r.pilotage} disabled={readOnly} onChange={e => update(d => { d.master_plan[i].pilotage = e.target.value as MasterRow['pilotage'] })}>
                    {(Object.keys(pilotageLabel) as MasterRow['pilotage'][]).map(k => <option key={k} value={k}>{pilotageLabel[k]}</option>)}
                  </select>
                </td>
                <td className="p-1"><input className={input} value={r.responsable} disabled={readOnly} onChange={e => update(d => { d.master_plan[i].responsable = e.target.value })} /></td>
                <td className="p-1"><input className={input} value={r.livrables} disabled={readOnly} onChange={e => update(d => { d.master_plan[i].livrables = e.target.value })} /></td>
                <td className="p-1"><input className={input} value={r.echeance} disabled={readOnly} onChange={e => update(d => { d.master_plan[i].echeance = e.target.value })} /></td>
                {!readOnly && <td className="p-1 text-center"><button className={btnGhost} onClick={() => update(d => { d.master_plan.splice(i, 1) })}>✕</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && <button className={btnGhost} onClick={() => update(d => { d.master_plan.push({ libelle: '', type: 'action', pilotage: 'hierarchique', responsable: '', livrables: '', echeance: '' }) })}>+ Ajouter une ligne</button>}
    </div>
  )
}

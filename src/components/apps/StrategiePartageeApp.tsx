'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { RseContext } from '@/components/rse/RseAppShell'
import ShareAutocomplete from '@/components/apps/ShareAutocomplete'
import { exportStrategiePdf } from '@/lib/pdf/strategiePdf'

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
interface LigneAction { id: string; enonce: string; objectif: string; indicateur: string; niveauActuel: string; cible: string; echeance: string; deployable: boolean }
interface Axe { id: string; titre: string; indicateur: string; objectif: string; freins: string[]; lignes: LigneAction[] }
interface StrategieActivite { produits: string[]; notes: string }
// Phase 2 — Déployer
interface Hoshin { scores: Record<string, Record<string, number>>; sponsors: Record<string, string> }
// type d'indicateur BSC : 'A' = en Avance (précurseur), 'P' = a Posteriori (règle du cours : 1/3 A, 2/3 P)
interface BscItem { id: string; objectif: string; indicateur: string; cible: string; type: 'A' | 'P' }
interface Bsc { finances: BscItem[]; clients: BscItem[]; processus: BscItem[]; apprentissage: BscItem[] }
// QQOQCP : Quoi (libelle), Qui (responsable), Où (perimetre), Quand (echeance), Combien (ressources), Pourquoi (pourquoi)
interface MasterRow { libelle: string; type: 'action' | 'projet'; pilotage: 'hierarchique' | 'transversal' | 'projet'; responsable: string; livrables: string; echeance: string; perimetre: string; ressources: string; pourquoi: string }
// Phase 3 — Piloter
type Feu = '' | 'vert' | 'orange' | 'rouge'
interface Suivi { valeur: string; statut: Feu }
// Types de revues du cours : suivi master plan en unité, revue Codir (trimestrielle),
// audit du président, réactualisation annuelle de la stratégie.
type RevueType = 'unite' | 'codir' | 'audit' | 'reactualisation'
interface Revue { date: string; note: string; type: RevueType }
interface Pilotage { suivi: Record<string, Suivi>; revues: Revue[] }
type KotterStatut = 'afaire' | 'encours' | 'fait'
interface KotterStep { statut: KotterStatut; note: string }
// Arbre d'alignement stratégique : 3 à 5 FCS, chacun avec ses indicateurs stratégiques.
interface FcsIndicateur { id: string; libelle: string; cible: string }
interface Fcs { id: string; titre: string; indicateurs: FcsIndicateur[] }
// Carte stratégique : lien de cause à effet entre 2 indicateurs BSC (force 3/2/1, durée en mois).
interface CarteLien { id: string; causeId: string; effetId: string; force: number; duree: string }
// Communication de la stratégie
interface Communication { slogan: string; visuel: string; messages: string[]; objections: string[]; checklist: Record<string, boolean> }
// Business Model Canvas & Lean Canvas (9 blocs chacun, listes)
interface Canvas { bmc: Record<string, string[]>; lean: Record<string, string[]> }
// Récolte des valeurs — les 3 questions du cours
interface ValeursCollecte { aujourdhui: string[]; mieux: string[]; projet: string[] }
// Matrices de croisement
interface Tows { fo: string[]; fa: string[]; wo: string[]; wa: string[] }
interface Matrices { visionAxes: Record<string, Record<string, number>>; attentesOffre: Record<string, Record<string, number>> }
interface DeployAction { id: string; libelle: string }
interface Deploiement { actions: DeployAction[]; scores: Record<string, Record<string, number>> }

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
  pilotage: Pilotage
  kotter: KotterStep[]
  tows: Tows
  matrices: Matrices
  deploiement: Deploiement
  fcs: Fcs[]
  carte: CarteLien[]
  communication: Communication
  canvas: Canvas
  valeurs_collecte: ValeursCollecte
}

// Blocs des canvas (ordre du cours)
const BMC_BLOCS: { key: string; label: string; hintTxt: string }[] = [
  { key: 'segments', label: '1. Segments de clientèle', hintTxt: 'Pour qui créons-nous de la valeur ? Quels sont nos clients les plus importants ?' },
  { key: 'proposition', label: '2. Proposition de valeur', hintTxt: 'Quelle valeur apportons-nous ? Quels problèmes résolvons-nous, à quels besoins répondons-nous ?' },
  { key: 'canaux', label: '3. Canaux', hintTxt: 'Comment communiquons-nous et touchons-nous nos segments ? (reconnaissance, évaluation, achat, prestation, après-vente)' },
  { key: 'relations', label: '4. Relations clients', hintTxt: 'Quel type de relation chaque segment souhaite-t-il ? (assistance, self-service, communautés, co-création…)' },
  { key: 'revenus', label: '5. Flux de revenus', hintTxt: 'Pour quelle valeur nos clients sont-ils disposés à payer ? Comment ? (vente, abonnement, licence…)' },
  { key: 'ressources', label: '6. Ressources clés', hintTxt: 'Actifs requis : physiques, intellectuels, humains, financiers.' },
  { key: 'activites', label: '7. Activités clés', hintTxt: 'Que devons-nous faire pour que le modèle fonctionne ? (production, résolution de problèmes, plate-forme)' },
  { key: 'partenaires', label: '8. Partenariats clés', hintTxt: 'Partenaires et fournisseurs clés (alliances, coopétition, joint-venture, acheteur-fournisseur).' },
  { key: 'couts', label: '9. Structure de coûts', hintTxt: 'Coûts les plus importants ; ressources et activités les plus coûteuses ; logique coûts ou valeur.' },
]
const LEAN_BLOCS: { key: string; label: string; hintTxt: string }[] = [
  { key: 'probleme', label: '1. Problème', hintTxt: 'Les 3 problèmes essentiels à résoudre pour le client ; solutions existantes.' },
  { key: 'segments', label: '2. Segments de clients', hintTxt: 'Clients cibles ; caractériser les early adopters.' },
  { key: 'uvp', label: '3. Proposition de valeur unique', hintTxt: 'Message simple, clair et persuasif : en quoi le produit est différent et mérite d’être acheté.' },
  { key: 'solution', label: '4. Solution', hintTxt: 'Les 3 fonctionnalités essentielles — rester au niveau de l’ébauche la plus simple.' },
  { key: 'canaux', label: '5. Canaux', hintTxt: 'Chemins d’accès aux clients (entrants/sortants, gratuits/payants, direct/indirect).' },
  { key: 'revenus', label: '6. Sources de revenus', hintTxt: 'Modèle de revenus, prix (le prix fait partie du produit et détermine vos clients).' },
  { key: 'couts', label: '7. Structure de coûts', hintTxt: 'Coûts opérationnels, coût du MVP, taux d’absorption, seuil de rentabilité.' },
  { key: 'indicateurs', label: '8. Indicateurs clés', hintTxt: 'Pirate Metrics : Acquisition, Activation, Rétention, Revenu, Recommandation.' },
  { key: 'avantage', label: '9. Avantage déloyal', hintTxt: 'Ce qui ne peut pas être facilement copié ou acheté (communauté, experts, effet réseau…).' },
]
// Checklist « Tout d'abord faire comprendre ! » (communication)
const COMM_CHECKLIST: { key: string; label: string }[] = [
  { key: 'swot3', label: 'SWOT : rester sur les 3 majeurs par cadran, créer le sentiment d’urgence (chiffres)' },
  { key: 'mission', label: 'Mission : expliquer le pourquoi et chaque mot, dimension noble' },
  { key: 'vision20', label: 'Vision : aller à l’essentiel (20 points clés max), montrer les écarts, susciter les échanges' },
  { key: 'axes', label: 'Axes : expliquer chaque axe = le QUOI ; ensemble on construira le COMMENT' },
  { key: 'cascading', label: 'Cascading : expliquer la suite, les Lignes d’Actions = le début du COMMENT' },
  { key: 'managers', label: 'Managers : appropriation (questions, clarifications) et implication (venir avec des idées)' },
]

// Clé stable dérivée du texte (robuste au réordonnancement des listes de chaînes).
function slug(s: string): string {
  return (s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48) || '_'
}

const KOTTER_ETAPES = [
  'Créer un sentiment d’urgence',
  'Former une coalition puissante pour lancer la transformation',
  'Développer une vision mobilisatrice',
  'Communiquer la vision à l’ensemble du personnel',
  'Lever les obstacles au changement',
  'Démontrer des résultats à court terme',
  'Bâtir sur les premiers résultats pour accélérer le changement',
  'Ancrer les nouvelles pratiques dans la culture de l’organisation',
]

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

let _idc = 0
function uid(): string {
  try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID() } catch { /* noop */ }
  return `id_${Date.now().toString(36)}_${(_idc++).toString(36)}`
}

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
    pilotage: { suivi: {}, revues: [] },
    kotter: KOTTER_ETAPES.map(() => ({ statut: 'afaire' as KotterStatut, note: '' })),
    tows: { fo: [], fa: [], wo: [], wa: [] },
    matrices: { visionAxes: {}, attentesOffre: {} },
    deploiement: { actions: [], scores: {} },
    fcs: [],
    carte: [],
    communication: { slogan: '', visuel: '', messages: [], objections: [], checklist: {} },
    canvas: { bmc: {}, lean: {} },
    valeurs_collecte: { aujourdhui: [], mieux: [], projet: [] },
  }
}

type TabKey = 'presentation' | 'mission' | 'swot' | 'attentes' | 'vision' | 'valeurs' | 'axes' | 'activite' | 'hoshin' | 'deploiement' | 'masterplan' | 'communication' | 'fcs' | 'bsc' | 'carte' | 'tableaubord' | 'changement'
const TABS: { key: TabKey; label: string; phase: 1 | 2 | 3 }[] = [
  { key: 'presentation', label: '📖 Présentation', phase: 1 },
  { key: 'mission', label: '🎯 Mission', phase: 1 },
  { key: 'swot', label: '⚖️ SWOT', phase: 1 },
  { key: 'attentes', label: '👥 Attentes clients', phase: 1 },
  { key: 'vision', label: '🔭 Vision', phase: 1 },
  { key: 'valeurs', label: '💎 Valeurs', phase: 1 },
  { key: 'axes', label: '🧭 Axes & Lignes d’actions', phase: 1 },
  { key: 'activite', label: '📦 Stratégie d’activité', phase: 1 },
  { key: 'hoshin', label: '🔀 Matrice Hoshin', phase: 2 },
  { key: 'deploiement', label: '⬇️ Déploiement (QUOI/COMMENT)', phase: 2 },
  { key: 'masterplan', label: '🗓️ Master Plan', phase: 2 },
  { key: 'communication', label: '📣 Communication', phase: 2 },
  { key: 'fcs', label: '🌳 FCS & Arbre d’alignement', phase: 3 },
  { key: 'bsc', label: '📊 Balanced Scorecard', phase: 3 },
  { key: 'carte', label: '🗺️ Carte stratégique', phase: 3 },
  { key: 'tableaubord', label: '📈 Tableau de bord', phase: 3 },
  { key: 'changement', label: '🚀 Conduite du changement', phase: 3 },
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

// Cellule de score 0→1→2→3 (clic), couleurs indigo — partagée par les matrices.
function ScoreCell({ value, onCycle, readOnly }: { value: number; onCycle: () => void; readOnly: boolean }) {
  const cls = value === 3 ? 'bg-indigo-600 text-white' : value === 2 ? 'bg-indigo-300 dark:bg-indigo-700 text-gray-900 dark:text-white' : value === 1 ? 'bg-indigo-100 dark:bg-indigo-900/50 text-gray-700 dark:text-gray-200' : 'text-gray-300 dark:text-gray-600'
  return (
    <button onClick={onCycle} disabled={readOnly} className={`w-9 h-9 rounded font-bold ${cls} ${readOnly ? '' : 'hover:ring-2 hover:ring-indigo-400'}`}>{value || ''}</button>
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

  // Export + partage
  const [exporting, setExporting] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [sharePermission, setSharePermission] = useState<'read' | 'edit'>('read')
  const [shareList, setShareList] = useState<{ id: string; email: string; permission: 'read' | 'edit' }[]>([])
  const [shareSaving, setShareSaving] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)

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
        // Backfill des ids stables et nouveaux champs (données antérieures)
        d.axes.forEach(a => { if (!a.id) a.id = uid(); a.indicateur = a.indicateur ?? ''; a.objectif = a.objectif ?? ''; a.lignes = Array.isArray(a.lignes) ? a.lignes : []; a.lignes.forEach(l => { if (!l.id) l.id = uid() }) })
        Object.assign(d.strategie_activite, row.strategie_activite ?? {})
        if (row.hoshin) { const h = row.hoshin as Partial<Hoshin>; d.hoshin = { scores: h.scores ?? {}, sponsors: h.sponsors ?? {} } }
        if (row.bsc) { Object.assign(d.bsc, row.bsc); (Object.keys(d.bsc) as (keyof Bsc)[]).forEach(k => d.bsc[k].forEach(it => { if (!it.id) it.id = uid(); if (it.type !== 'A' && it.type !== 'P') it.type = 'P' })) }
        d.master_plan = Array.isArray(row.master_plan) ? row.master_plan as MasterRow[] : []
        d.master_plan.forEach(m => { m.perimetre = m.perimetre ?? ''; m.ressources = m.ressources ?? ''; m.pourquoi = m.pourquoi ?? '' })
        if (row.pilotage) { const p = row.pilotage as Partial<Pilotage>; d.pilotage = { suivi: p.suivi ?? {}, revues: Array.isArray(p.revues) ? p.revues : [] }; d.pilotage.revues.forEach(r => { if (!r.type) r.type = 'codir' }) }
        if (Array.isArray(row.kotter) && row.kotter.length === KOTTER_ETAPES.length) d.kotter = row.kotter as KotterStep[]
        if (row.tows) Object.assign(d.tows, row.tows)
        if (row.matrices) { const m = row.matrices as Partial<Matrices>; d.matrices = { visionAxes: m.visionAxes ?? {}, attentesOffre: m.attentesOffre ?? {} } }
        if (row.deploiement) { const dp = row.deploiement as Partial<Deploiement>; d.deploiement = { actions: Array.isArray(dp.actions) ? dp.actions : [], scores: dp.scores ?? {} }; d.deploiement.actions.forEach(a => { if (!a.id) a.id = uid() }) }
        d.fcs = Array.isArray(row.fcs) ? row.fcs as Fcs[] : []
        d.fcs.forEach(f => { if (!f.id) f.id = uid(); f.indicateurs = Array.isArray(f.indicateurs) ? f.indicateurs : []; f.indicateurs.forEach(i => { if (!i.id) i.id = uid() }) })
        d.carte = Array.isArray(row.carte) ? row.carte as CarteLien[] : []
        d.carte.forEach(l => { if (!l.id) l.id = uid() })
        if (row.communication) { const c = row.communication as Partial<Communication>; d.communication = { slogan: c.slogan ?? '', visuel: c.visuel ?? '', messages: c.messages ?? [], objections: c.objections ?? [], checklist: c.checklist ?? {} } }
        if (row.canvas) { const cv = row.canvas as Partial<Canvas>; d.canvas = { bmc: cv.bmc ?? {}, lean: cv.lean ?? {} } }
        if (row.valeurs_collecte) { const vc = row.valeurs_collecte as Partial<ValeursCollecte>; d.valeurs_collecte = { aujourdhui: vc.aujourdhui ?? [], mieux: vc.mieux ?? [], projet: vc.projet ?? [] } }
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

  const handleExport = useCallback(async () => {
    if (!orgId) return
    setExporting(true)
    try {
      const res = await fetch(`/api/strategie-partagee/export-excel?org_id=${orgId}`)
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? 'Erreur export') }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'Strategie.xlsx'; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { setError(String((e as Error).message ?? e)) }
    finally { setExporting(false) }
  }, [orgId])

  const handleExportPdf = useCallback(async () => {
    setExportingPdf(true)
    try { await exportStrategiePdf(doc, ctx.org?.denomination ?? 'Organisation') }
    catch (e) { setError(String((e as Error).message ?? e)) }
    finally { setExportingPdf(false) }
  }, [doc, ctx.org?.denomination])

  useEffect(() => {
    if (!orgId) { ctx.setActions(null); return }
    ctx.setActions(
      <div className="flex items-center gap-2">
        {!readOnly && (
          <button onClick={() => setShowShare(true)}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors">👥 Partager</button>
        )}
        <button onClick={handleExportPdf} disabled={exportingPdf}
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-50">
          {exportingPdf ? '…' : '⬇ PDF'}
        </button>
        <button onClick={handleExport} disabled={exporting}
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50">
          {exporting ? '…' : '⬇ Excel'}
        </button>
        {!readOnly && (
          <button onClick={save} disabled={saving || !dirty}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50">
            {saving ? 'Enregistrement…' : dirty ? '💾 Enregistrer' : '✓ Enregistré'}
          </button>
        )}
      </div>
    )
    return () => ctx.setActions(null)
  }, [orgId, readOnly, saving, dirty, save, exporting, handleExport, exportingPdf, handleExportPdf, ctx])

  // ── Partage du dossier (rse_diagnostic_shares, diagnostic_id = org_id) ──
  const loadShares = useCallback(async () => {
    if (!orgId) return
    try {
      const res = await fetch(`/api/strategie-partagee/shares?org_id=${orgId}`)
      const j = await res.json()
      if (res.ok) setShareList(j.data ?? [])
    } catch { /* ignore */ }
  }, [orgId])

  useEffect(() => { if (showShare) loadShares() }, [showShare, loadShares])

  async function handleAddShare() {
    if (!orgId || !shareEmail.trim()) return
    setShareSaving(true); setShareError(null)
    try {
      const res = await fetch(`/api/strategie-partagee/shares`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, email: shareEmail.trim(), permission: sharePermission }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error ?? 'Erreur')
      setShareEmail(''); await loadShares()
    } catch (e) { setShareError(String((e as Error).message ?? e)) }
    finally { setShareSaving(false) }
  }

  async function handleRemoveShare(shareId: string) {
    if (!orgId) return
    try { await fetch(`/api/strategie-partagee/shares?shareId=${shareId}&org_id=${orgId}`, { method: 'DELETE' }); await loadShares() } catch { /* ignore */ }
  }

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
          {tab === 'swot' && <SwotTab swot={doc.swot} tows={doc.tows} update={update} readOnly={readOnly} />}
          {tab === 'attentes' && <AttentesTab a={doc.attentes} produits={doc.strategie_activite.produits} matrices={doc.matrices} update={update} readOnly={readOnly} />}
          {tab === 'vision' && <VisionTab vision={doc.vision} axes={doc.axes} matrices={doc.matrices} update={update} readOnly={readOnly} />}
          {tab === 'valeurs' && <ValeursTab valeurs={doc.valeurs} collecte={doc.valeurs_collecte} update={update} readOnly={readOnly} />}
          {tab === 'axes' && <AxesTab axes={doc.axes} update={update} readOnly={readOnly} />}
          {tab === 'activite' && <ActiviteTab sa={doc.strategie_activite} canvas={doc.canvas} update={update} readOnly={readOnly} />}
          {tab === 'hoshin' && <HoshinTab axes={doc.axes} hoshin={doc.hoshin} update={update} readOnly={readOnly} />}
          {tab === 'deploiement' && <DeploiementTab axes={doc.axes} deploiement={doc.deploiement} update={update} readOnly={readOnly} />}
          {tab === 'communication' && <CommunicationTab comm={doc.communication} update={update} readOnly={readOnly} />}
          {tab === 'fcs' && <FcsTab fcs={doc.fcs} vision={doc.vision} axes={doc.axes} update={update} readOnly={readOnly} />}
          {tab === 'carte' && <CarteTab carte={doc.carte} bsc={doc.bsc} update={update} readOnly={readOnly} />}
          {tab === 'bsc' && <BscTab bsc={doc.bsc} update={update} readOnly={readOnly} />}
          {tab === 'masterplan' && <MasterPlanTab rows={doc.master_plan} update={update} readOnly={readOnly} />}
          {tab === 'tableaubord' && <TableauBordTab axes={doc.axes} bsc={doc.bsc} pilotage={doc.pilotage} update={update} readOnly={readOnly} />}
          {tab === 'changement' && <ChangementTab kotter={doc.kotter} update={update} readOnly={readOnly} />}
        </>
      )}

      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowShare(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-bold text-gray-900 dark:text-white">👥 Partager la stratégie</h2>
              <button onClick={() => setShowShare(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-3">
                <div>
                  <label className={label}>Email de l&apos;utilisateur</label>
                  <ShareAutocomplete value={shareEmail} onChange={setShareEmail} onEnter={handleAddShare} inputClassName={input} />
                </div>
                <div>
                  <label className={label}>Niveau d&apos;accès</label>
                  <select value={sharePermission} onChange={e => setSharePermission(e.target.value as 'read' | 'edit')} className={input}>
                    <option value="read">Lecture seule</option>
                    <option value="edit">Édition</option>
                  </select>
                </div>
                {shareError && <p className="text-xs text-red-500">{shareError}</p>}
                <button onClick={handleAddShare} disabled={shareSaving || !shareEmail.trim()}
                  className="w-full px-3 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50">
                  {shareSaving ? 'Partage en cours…' : '+ Partager'}
                </button>
              </div>
              {shareList.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Personnes ayant accès</p>
                  {shareList.map(s => (
                    <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/40 text-sm">
                      <span className="truncate text-gray-700 dark:text-gray-200">{s.email}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">{s.permission === 'edit' ? 'Édition' : 'Lecture'}</span>
                        <button onClick={() => handleRemoveShare(s.id)} title="Retirer l'accès" className="text-gray-400 hover:text-red-500 transition-colors">✕</button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400 text-center">Le collaborateur doit avoir un compte Sens&apos;ethO. Il retrouvera la stratégie en sélectionnant la même organisation.</p>
            </div>
          </div>
        </div>
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
function SwotTab({ swot, tows, update, readOnly }: { swot: Swot; tows: Tows; update: Upd; readOnly: boolean }) {
  const quadrants: { key: keyof Swot; title: string; sub: string; cls: string }[] = [
    { key: 'forces', title: 'Forces', sub: 'Interne · Positif — Qu’est-ce que nous faisons bien ? Sur quoi nous appuyer ?', cls: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' },
    { key: 'faiblesses', title: 'Faiblesses', sub: 'Interne · Négatif — Qu’est-ce qui ne marche pas bien ? Quoi surmonter ?', cls: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
    { key: 'opportunites', title: 'Opportunités', sub: 'Externe · Positif — Quels facteurs externes exploiter ? Nos potentiels ?', cls: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
    { key: 'menaces', title: 'Menaces', sub: 'Externe · Négatif — Quels changements / menaces pèsent sur notre projet ?', cls: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
  ]
  // Rappels des réponses SWOT pour aider à croiser
  const ref = (arr: string[]) => arr.length ? arr.map(x => `• ${x}`).join('  ') : '—'
  const towsCells: { key: keyof Tows; title: string; desc: string; cls: string }[] = [
    { key: 'fo', title: 'FO — Offensif (Forces × Opportunités)', desc: 'S’appuyer sur nos forces pour saisir les opportunités.', cls: 'bg-green-50 dark:bg-green-900/20' },
    { key: 'wo', title: 'WO — Réorientation (Faiblesses × Opportunités)', desc: 'Corriger nos faiblesses en profitant des opportunités.', cls: 'bg-blue-50 dark:bg-blue-900/20' },
    { key: 'fa', title: 'FA — Défensif (Forces × Menaces)', desc: 'Utiliser nos forces pour contrer les menaces.', cls: 'bg-amber-50 dark:bg-amber-900/20' },
    { key: 'wa', title: 'WA — Repli / Vigilance (Faiblesses × Menaces)', desc: 'Minimiser les faiblesses et éviter les menaces.', cls: 'bg-red-50 dark:bg-red-900/20' },
  ]
  return (
    <div className="space-y-5">
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

      <div className={card}>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Matrice de confrontation (TOWS)</h3>
          <p className={hint}>Croisez les réponses du SWOT pour formuler les options stratégiques dans les 4 cases.</p>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 grid grid-cols-1 md:grid-cols-2 gap-2">
          <p><strong>Forces :</strong> {ref(swot.forces)}</p>
          <p><strong>Opportunités :</strong> {ref(swot.opportunites)}</p>
          <p><strong>Faiblesses :</strong> {ref(swot.faiblesses)}</p>
          <p><strong>Menaces :</strong> {ref(swot.menaces)}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {towsCells.map(c => (
            <div key={c.key} className={`rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2 ${c.cls}`}>
              <div><h4 className="font-medium text-gray-900 dark:text-white text-sm">{c.title}</h4><p className={hint}>{c.desc}</p></div>
              <StringList items={tows[c.key]} readOnly={readOnly} onChange={v => update(d => { d.tows[c.key] = v })} placeholder="Option stratégique…" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Attentes clients (Kano) ──
function AttentesTab({ a, produits, matrices, update, readOnly }: { a: Attentes; produits: string[]; matrices: Matrices; update: Upd; readOnly: boolean }) {
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

      <AttentesOffreMatrix a={a} produits={produits} matrices={matrices} update={update} readOnly={readOnly} />
    </div>
  )
}

// Matrice attentes (Kano) × offre (produits/services) : niveau de réponse 3/2/1.
function AttentesOffreMatrix({ a, produits, matrices, update, readOnly }: { a: Attentes; produits: string[]; matrices: Matrices; update: Upd; readOnly: boolean }) {
  const rows = [
    ...a.base.map(x => ({ txt: x, cat: 'Base' })),
    ...a.proportionnel.map(x => ({ txt: x, cat: 'Perf.' })),
    ...a.attractif.map(x => ({ txt: x, cat: 'Attractif' })),
  ].filter(r => r.txt.trim())
  const cols = produits.filter(p => p.trim())
  if (!rows.length || !cols.length) {
    return (
      <div className={card}>
        <h3 className="font-semibold text-gray-900 dark:text-white">Matrice attentes × offre</h3>
        <p className={hint}>Renseignez des <strong>attentes clients</strong> (ci-dessus) et des <strong>produits/services</strong> (onglet « Stratégie d’activité ») : la matrice permettra d’évaluer dans quelle mesure chaque offre répond à chaque attente (3 fort · 2 moyen · 1 faible).</p>
      </div>
    )
  }
  const val = (rk: string, ck: string) => matrices.attentesOffre[rk]?.[ck] ?? 0
  return (
    <div className={card}>
      <div><h3 className="font-semibold text-gray-900 dark:text-white">Matrice attentes × offre</h3><p className={hint}>Dans quelle mesure chaque produit/service répond à chaque attente ? 3 fort · 2 moyen · 1 faible.</p></div>
      <div className="overflow-x-auto">
        <table className="text-sm border-collapse">
          <thead><tr>
            <th className="p-2 text-left sticky left-0 bg-white dark:bg-gray-800/40 min-w-[220px]">Attente \ Offre</th>
            {cols.map((c, j) => <th key={j} className="p-2 text-center min-w-[64px]"><div className="text-[11px] max-w-[90px] truncate mx-auto" title={c}>{c}</div></th>)}
          </tr></thead>
          <tbody>
            {rows.map((r, i) => {
              const rk = slug(r.txt)
              return (
                <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="p-2 sticky left-0 bg-white dark:bg-gray-800/40"><span className="text-[10px] text-gray-400">{r.cat}</span> <span className="text-gray-700 dark:text-gray-300">{r.txt}</span></td>
                  {cols.map((c, j) => {
                    const ck = slug(c)
                    return <td key={j} className="p-1 text-center"><ScoreCell value={val(rk, ck)} readOnly={readOnly} onCycle={() => update(d => { if (!d.matrices.attentesOffre[rk]) d.matrices.attentesOffre[rk] = {}; d.matrices.attentesOffre[rk][ck] = (val(rk, ck) + 1) % 4 })} /></td>
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Vision ──
function VisionTab({ vision, axes, matrices, update, readOnly }: { vision: Vision; axes: Axe[]; matrices: Matrices; update: Upd; readOnly: boolean }) {
  const parties: { key: keyof VisionParties; label: string }[] = [
    { key: 'hommes', label: 'Hommes (collaborateurs)' },
    { key: 'marche', label: 'Marché / Clients' },
    { key: 'environnement', label: 'Environnement / Écosystème' },
    { key: 'entreprise', label: 'Entreprise / Actionnaires' },
  ]
  const val = (pk: string, ck: string) => matrices.visionAxes[pk]?.[ck] ?? 0
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

      <div className={card}>
        <div><h4 className="font-medium text-gray-900 dark:text-white">Matrice : parties prenantes × axes stratégiques</h4><p className={hint}>Vérifiez que chaque partie prenante de la vision est bien servie par les axes. 3 fort · 2 moyen · 1 faible.</p></div>
        {axes.length === 0 ? (
          <p className={hint}>Renseignez d’abord des axes stratégiques (onglet « Axes »).</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-sm border-collapse">
              <thead><tr>
                <th className="p-2 text-left sticky left-0 bg-white dark:bg-gray-800/40 min-w-[200px]">Partie prenante \ Axe</th>
                {axes.map((a, ai) => <th key={a.id} className="p-2 text-center min-w-[64px]"><div className="font-bold text-indigo-700 dark:text-indigo-400">A{ai + 1}</div><div className="text-[10px] font-normal text-gray-400 max-w-[80px] truncate mx-auto" title={a.titre}>{a.titre || '—'}</div></th>)}
              </tr></thead>
              <tbody>
                {parties.map(p => (
                  <tr key={p.key} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="p-2 sticky left-0 bg-white dark:bg-gray-800/40 text-gray-700 dark:text-gray-300">{p.label}</td>
                    {axes.map(a => (
                      <td key={a.id} className="p-1 text-center"><ScoreCell value={val(p.key, a.id)} readOnly={readOnly} onCycle={() => update(d => { if (!d.matrices.visionAxes[p.key]) d.matrices.visionAxes[p.key] = {}; d.matrices.visionAxes[p.key][a.id] = (val(p.key, a.id) + 1) % 4 })} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Valeurs & règles du jeu ──
function ValeursTab({ valeurs, collecte, update, readOnly }: { valeurs: Valeur[]; collecte: ValeursCollecte; update: Upd; readOnly: boolean }) {
  const questions: { key: keyof ValeursCollecte; label: string }[] = [
    { key: 'aujourdhui', label: 'Quelles valeurs sommes-nous sûrs de partager aujourd’hui dans notre entreprise ?' },
    { key: 'mieux', label: 'Quelles valeurs voudrions-nous mieux partager pour réussir notre projet stratégique ?' },
    { key: 'projet', label: 'Quelles valeurs devrions-nous partager pour réussir notre projet ?' },
  ]
  return (
    <div className="space-y-4">
      <div className={card}>
        <h3 className="font-semibold text-gray-900 dark:text-white">Valeurs & règles du jeu</h3>
        <p className={hint}>Culture, morale et éthique à partager. Chaque valeur se traduit en règles de comportement concrètes, formulées positivement et évaluables. Le management doit être exemplaire.</p>
      </div>

      <div className={card}>
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white">Déterminer les valeurs — récolte (Codir + équipes)</h4>
          <p className={hint}>Méthode du cours : pour chaque question, 3 valeurs par personne sur post-it, tri par affinité, hiérarchisation (vote 3 gommettes), puis synthèse pour <strong>choisir 3 à 6 valeurs</strong>. La détermination ne peut être le fait du seul Codir : récolte préalable auprès du personnel, confrontation, synthèse générale.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {questions.map(q => (
            <div key={q.key} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2 bg-gray-50/60 dark:bg-gray-800/30">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-300">{q.label}</p>
              <StringList items={collecte[q.key]} readOnly={readOnly} onChange={v => update(d => { d.valeurs_collecte[q.key] = v })} placeholder="Valeur…" />
            </div>
          ))}
        </div>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className={label}>Indicateur de l’axe (mesure la réussite de l’axe)</label>
              <input className={input} value={axe.indicateur} disabled={readOnly} placeholder="ex. Index satisfaction sur 100"
                onChange={e => update(d => { d.axes[ai].indicateur = e.target.value })} />
            </div>
            <div>
              <label className={label}>Objectif de l’axe (niveau à atteindre)</label>
              <input className={input} value={axe.objectif} disabled={readOnly} placeholder="ex. 77,5"
                onChange={e => update(d => { d.axes[ai].objectif = e.target.value })} />
            </div>
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
            {!readOnly && <button className={btnGhost} onClick={() => update(d => { d.axes[ai].lignes.push({ id: uid(), enonce: '', objectif: '', indicateur: '', niveauActuel: '', cible: '', echeance: '', deployable: false }) })}>+ Ligne d’action</button>}
          </div>
        </div>
      ))}
      {!readOnly && <button className={btnGhost} onClick={() => update(d => { d.axes.push({ id: uid(), titre: '', indicateur: '', objectif: '', freins: [], lignes: [] }) })}>+ Ajouter un axe stratégique</button>}
    </div>
  )
}

// ── Stratégie d'activité ──
function ActiviteTab({ sa, canvas, update, readOnly }: { sa: StrategieActivite; canvas: Canvas; update: Upd; readOnly: boolean }) {
  const [canvasMode, setCanvasMode] = useState<'bmc' | 'lean'>('bmc')
  const blocs = canvasMode === 'bmc' ? BMC_BLOCS : LEAN_BLOCS
  const data = canvasMode === 'bmc' ? canvas.bmc : canvas.lean
  return (
    <div className="space-y-4">
      <div className={card}>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Stratégie d’activité</h3>
          <p className={hint}>Quels produits/services pour atteindre notre vision — répondant aux attentes clients et au marché, fruit de notre R&D et de notre innovation ?</p>
        </div>
        <div>
          <label className={label}>Produits / services clés</label>
          <StringList items={sa.produits} readOnly={readOnly} onChange={v => update(d => { d.strategie_activite.produits = v })} />
        </div>
        <div>
          <label className={label}>Notes (plan produit, critères de choix par marché…)</label>
          <textarea className={`${input} h-24`} value={sa.notes} disabled={readOnly} onChange={e => update(d => { d.strategie_activite.notes = e.target.value })} />
        </div>
      </div>

      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">{canvasMode === 'bmc' ? 'Business Model Canvas (Osterwalder & Pigneur)' : 'Lean Canvas (Ash Maurya — Running Lean)'}</h4>
            <p className={hint}>{canvasMode === 'bmc' ? 'Les 9 blocs du modèle économique — remplir de gauche (entreprise) à droite (marché).' : 'Les 9 blocs orientés produit/startup — commencer par Problème et Segments.'}</p>
          </div>
          <div className="flex gap-1">
            <button className={`px-2.5 py-1.5 text-xs rounded-lg ${canvasMode === 'bmc' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`} onClick={() => setCanvasMode('bmc')}>Business Model Canvas</button>
            <button className={`px-2.5 py-1.5 text-xs rounded-lg ${canvasMode === 'lean' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`} onClick={() => setCanvasMode('lean')}>Lean Canvas</button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {blocs.map(b => (
            <div key={b.key} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2 bg-gray-50/60 dark:bg-gray-800/30">
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{b.label}</p>
                <p className="text-[10px] text-gray-400">{b.hintTxt}</p>
              </div>
              <StringList items={data[b.key] ?? []} readOnly={readOnly}
                onChange={v => update(d => { d.canvas[canvasMode][b.key] = v })} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Matrice Hoshin d'alignement (format du modèle officiel AQM : axes en lignes, LA en colonnes) ──
function HoshinTab({ axes, hoshin, update, readOnly }: { axes: Axe[]; hoshin: Hoshin; update: Upd; readOnly: boolean }) {
  // Colonnes = lignes d'actions (aplaties) ; Lignes = axes. Cellule = contribution 0..3 (0 = nul).
  const laCols: { id: string; ai: number; li: number; label: string; texte: string }[] = []
  axes.forEach((axe, ai) => axe.lignes.forEach((la, li) => {
    laCols.push({ id: la.id, ai, li, label: `LA ${ai + 1}.${li + 1}`, texte: la.enonce || '—' })
  }))

  if (!axes.length || !laCols.length) {
    return (
      <div className={card}>
        <h3 className="font-semibold text-gray-900 dark:text-white">Matrice Hoshin d’alignement</h3>
        <p className={hint}>Renseignez d’abord des <strong>axes stratégiques</strong> et des <strong>lignes d’actions</strong> (onglet « Axes & Lignes d’actions »). La matrice croisera automatiquement axes (en lignes) × lignes d’actions (en colonnes), conformément au modèle officiel.</p>
      </div>
    )
  }

  const score = (laId: string, axId: string) => hoshin.scores[laId]?.[axId] ?? 0
  function cycle(laId: string, axId: string) {
    if (readOnly) return
    update(d => {
      const cur = d.hoshin.scores[laId]?.[axId] ?? 0
      if (!d.hoshin.scores[laId]) d.hoshin.scores[laId] = {}
      d.hoshin.scores[laId][axId] = (cur + 1) % 4 // 0→1→2→3→0
    })
  }
  const laTotal = (laId: string) => axes.reduce((s, a) => s + score(laId, a.id), 0)
  const axeTotal = (axId: string) => laCols.reduce((s, c) => s + score(c.id, axId), 0)
  const cellCls = (v: number) => v === 3 ? 'bg-indigo-600 text-white' : v === 2 ? 'bg-indigo-300 dark:bg-indigo-700 text-gray-900 dark:text-white' : v === 1 ? 'bg-indigo-100 dark:bg-indigo-900/50 text-gray-700 dark:text-gray-200' : 'text-gray-300 dark:text-gray-600'
  const headCls = 'p-2 sticky left-0 bg-white dark:bg-gray-800/40 text-left min-w-[190px]'
  const smallInput = `${input} text-xs px-1.5 py-1`

  return (
    <div className={card}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Matrice Hoshin d’alignement</h3>
          <p className={hint}>Format du modèle officiel : <strong>axes stratégiques en lignes</strong>, <strong>lignes d’actions en colonnes</strong>. Cliquez une cellule pour noter la contribution. Les totaux horizontaux et verticaux permettent d’évaluer l’équilibrage global.</p>
        </div>
        <div className="text-xs rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 text-indigo-800 dark:text-indigo-300 whitespace-nowrap">
          3 = Fort<br/>2 = Moyen<br/>1 = Faible<br/>0 = Nul
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="text-sm border-collapse">
          <thead>
            <tr>
              <th className={headCls}>Matrice Hoshin d’alignement</th>
              {laCols.map(c => (
                <th key={c.id} className="p-1.5 align-bottom text-center min-w-[86px]" title={c.texte}>
                  <div className="font-bold text-indigo-700 dark:text-indigo-400">{c.label}</div>
                  <div className="text-[9px] font-normal text-gray-400 max-w-[86px] truncate mx-auto">{c.texte}</div>
                </th>
              ))}
              <th className="p-2 text-center font-semibold">Σ</th>
              <th className="p-2 text-left min-w-[150px]">Indicateur</th>
              <th className="p-2 text-left min-w-[110px]">Objectif</th>
            </tr>
            <tr className="border-t border-gray-100 dark:border-gray-700">
              <th className={`${headCls} text-xs font-medium text-gray-500 dark:text-gray-400`}>Responsable de la ligne d’action / Sponsor</th>
              {laCols.map(c => (
                <td key={c.id} className="p-1">
                  <input className={smallInput} value={hoshin.sponsors[c.id] ?? ''} disabled={readOnly}
                    onChange={e => update(d => { d.hoshin.sponsors[c.id] = e.target.value })} placeholder="Resp." />
                </td>
              ))}
              <td /><td /><td />
            </tr>
            <tr className="border-t border-gray-100 dark:border-gray-700">
              <th className={`${headCls} text-xs font-medium text-gray-500 dark:text-gray-400`}>Déployable aux niveaux suivants</th>
              {laCols.map(c => {
                const dep = axes[c.ai]?.lignes[c.li]?.deployable ?? false
                return (
                  <td key={c.id} className="p-1 text-center">
                    <button disabled={readOnly}
                      onClick={() => update(d => { d.axes[c.ai].lignes[c.li].deployable = !d.axes[c.ai].lignes[c.li].deployable })}
                      className={`px-2 py-0.5 rounded text-xs ${dep ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'} ${readOnly ? '' : 'hover:ring-1 hover:ring-indigo-400'}`}>
                      {dep ? 'Oui' : 'Non'}
                    </button>
                  </td>
                )
              })}
              <td /><td /><td />
            </tr>
          </thead>
          <tbody>
            {axes.map((axe, ai) => (
              <tr key={axe.id} className="border-t border-gray-100 dark:border-gray-700">
                <td className={headCls}>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Axe {ai + 1}</span>
                  <span className="text-gray-400"> — {axe.titre || '—'}</span>
                </td>
                {laCols.map(c => {
                  const v = score(c.id, axe.id)
                  return (
                    <td key={c.id} className="p-1 text-center">
                      <button onClick={() => cycle(c.id, axe.id)} disabled={readOnly}
                        className={`w-9 h-9 rounded font-bold ${cellCls(v)} ${readOnly ? '' : 'hover:ring-2 hover:ring-indigo-400'}`}>
                        {v || '0'}
                      </button>
                    </td>
                  )
                })}
                <td className="p-2 text-center font-semibold text-indigo-700 dark:text-indigo-400">{axeTotal(axe.id)}</td>
                <td className="p-1">
                  <input className={smallInput} value={axe.indicateur} disabled={readOnly}
                    onChange={e => update(d => { d.axes[ai].indicateur = e.target.value })} placeholder="Indicateur de l’axe" />
                </td>
                <td className="p-1">
                  <input className={smallInput} value={axe.objectif} disabled={readOnly}
                    onChange={e => update(d => { d.axes[ai].objectif = e.target.value })} placeholder="Objectif" />
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-gray-200 dark:border-gray-600">
              <td className={`${headCls} font-semibold`}>Total par ligne d’action</td>
              {laCols.map(c => <td key={c.id} className="p-2 text-center font-semibold text-gray-700 dark:text-gray-200">{laTotal(c.id)}</td>)}
              <td className="p-2 text-center font-semibold text-indigo-700 dark:text-indigo-400">{laCols.reduce((s, c) => s + laTotal(c.id), 0)}</td>
              <td /><td />
            </tr>
            <tr className="border-t border-gray-100 dark:border-gray-700">
              <td className={`${headCls} text-xs font-medium text-gray-500 dark:text-gray-400`}>Indicateur</td>
              {laCols.map(c => (
                <td key={c.id} className="p-1">
                  <input className={smallInput} value={axes[c.ai]?.lignes[c.li]?.indicateur ?? ''} disabled={readOnly}
                    onChange={e => update(d => { d.axes[c.ai].lignes[c.li].indicateur = e.target.value })} placeholder="Indicateur" />
                </td>
              ))}
              <td /><td /><td />
            </tr>
            <tr className="border-t border-gray-100 dark:border-gray-700">
              <td className={`${headCls} text-xs font-medium text-gray-500 dark:text-gray-400`}>Objectif</td>
              {laCols.map(c => (
                <td key={c.id} className="p-1">
                  <input className={smallInput} value={axes[c.ai]?.lignes[c.li]?.cible ?? ''} disabled={readOnly}
                    onChange={e => update(d => { d.axes[c.ai].lignes[c.li].cible = e.target.value })} placeholder="Cible" />
                </td>
              ))}
              <td /><td /><td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Déploiement cascading QUOI / COMMENT ────────────────────────────────────────
function DeploiementTab({ axes, deploiement, update, readOnly }: { axes: Axe[]; deploiement: Deploiement; update: Upd; readOnly: boolean }) {
  // QUOI = lignes d'actions niveau direction ; COMMENT = actions du niveau n-1 (colonnes).
  const rows: { rk: string; label: string; texte: string }[] = []
  axes.forEach((axe, ai) => axe.lignes.forEach((la, li) => rows.push({ rk: la.id, label: `LA${ai + 1}.${li + 1}`, texte: la.enonce || '—' })))
  const cols = deploiement.actions
  const val = (rk: string, ck: string) => deploiement.scores[rk]?.[ck] ?? 0
  const colTotal = (ck: string) => rows.reduce((s, r) => s + val(r.rk, ck), 0)

  return (
    <div className={card}>
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-white">Déploiement niveau n-1 — matrice QUOI / COMMENT</h3>
        <p className={hint}>Le déploiement descend par une démarche QUOI/COMMENT : les lignes d’actions de la direction (QUOI, en lignes) sont traduites en lignes d’actions du niveau inférieur (COMMENT, en colonnes). Notez la corrélation : 3 fort · 2 moyen · 1 faible. La somme par colonne vérifie l’alignement de chaque action n-1. En général 10 à 20 lignes d’actions au niveau Codir ; les lignes d’actions doivent induire une amélioration ou une transformation.</p>
      </div>

      <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 px-4 py-3 text-xs text-indigo-800 dark:text-indigo-300">
        <strong>Catchball</strong> (Hoshin Kanri) : réunions d’ajustement et de négociation entre lignes hiérarchiques (n-1/n-2…). Vérifie que les lignes d’actions sont pertinentes et exécutables, résout les conflits et besoins en ressources, gère les liens entre départements (ligne d’action affectant un autre processus, gap nécessitant une coopération transversale). Le mécanisme remontant d’alignement permet l’équilibrage, à partir des master plans des unités.
      </div>

      {rows.length === 0 ? (
        <p className={hint}>Renseignez d’abord des lignes d’actions (onglet « Axes & Lignes d’actions »).</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="text-sm border-collapse">
              <thead><tr>
                <th className="p-2 text-left sticky left-0 bg-white dark:bg-gray-800/40 min-w-[240px]">QUOI (LA direction) \ COMMENT (actions n-1)</th>
                {cols.map((c, j) => (
                  <th key={c.id} className="p-2 align-bottom text-center min-w-[80px]">
                    <input className={`${input} text-xs w-24`} value={c.libelle} disabled={readOnly} placeholder={`Action ${j + 1}`}
                      onChange={e => update(d => { const a = d.deploiement.actions.find(x => x.id === c.id); if (a) a.libelle = e.target.value })} />
                    {!readOnly && <button className="text-[10px] text-gray-400 hover:text-red-500 mt-1" onClick={() => update(d => { d.deploiement.actions = d.deploiement.actions.filter(x => x.id !== c.id) })}>retirer</button>}
                  </th>
                ))}
              </tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.rk} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="p-2 sticky left-0 bg-white dark:bg-gray-800/40"><span className="font-medium text-gray-700 dark:text-gray-300">{r.label}</span><span className="text-gray-400"> — {r.texte}</span></td>
                    {cols.map(c => <td key={c.id} className="p-1 text-center"><ScoreCell value={val(r.rk, c.id)} readOnly={readOnly} onCycle={() => update(d => { if (!d.deploiement.scores[r.rk]) d.deploiement.scores[r.rk] = {}; d.deploiement.scores[r.rk][c.id] = (val(r.rk, c.id) + 1) % 4 })} /></td>)}
                  </tr>
                ))}
                {cols.length > 0 && (
                  <tr className="border-t-2 border-gray-200 dark:border-gray-600">
                    <td className="p-2 sticky left-0 bg-white dark:bg-gray-800/40 font-semibold">Total par action n-1</td>
                    {cols.map(c => <td key={c.id} className="p-2 text-center font-semibold text-indigo-700 dark:text-indigo-400">{colTotal(c.id)}</td>)}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {!readOnly && <button className={btnGhost} onClick={() => update(d => { d.deploiement.actions.push({ id: uid(), libelle: '' }) })}>+ Ajouter une action n-1 (COMMENT)</button>}
        </>
      )}
    </div>
  )
}

// ── Balanced Scorecard ──────────────────────────────────────────────────────────
function BscTab({ bsc, update, readOnly }: { bsc: Bsc; update: Upd; readOnly: boolean }) {
  const persp: { key: keyof Bsc; title: string; sub: string; cible: number }[] = [
    { key: 'finances', title: 'Résultats financiers', sub: 'Que faut-il apporter aux actionnaires ?', cible: 20 },
    { key: 'clients', title: 'Résultats clients / parties prenantes', sub: 'Que faut-il apporter aux clients (et autres parties prenantes) ?', cible: 20 },
    { key: 'processus', title: 'Processus internes', sub: 'Quels processus clés dans la satisfaction des clients et des actionnaires ?', cible: 40 },
    { key: 'apprentissage', title: 'Apprentissage organisationnel', sub: 'Comment piloter le changement et l’amélioration ?', cible: 20 },
  ]
  // Équilibrage (règles du cours) : 15-25 indicateurs ; 1/3 en Avance, 2/3 a Posteriori ; 20/20/40/20 par axe.
  const total = persp.reduce((s, p) => s + bsc[p.key].length, 0)
  const nbAvance = persp.reduce((s, p) => s + bsc[p.key].filter(i => i.type === 'A').length, 0)
  const pctA = total ? Math.round((nbAvance / total) * 100) : 0
  const okTotal = total >= 15 && total <= 25
  const okAvance = total > 0 && pctA >= 25 && pctA <= 45
  const badge = (ok: boolean, txt2: string) => (
    <span className={`px-2 py-1 rounded text-xs ${ok ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'}`}>{txt2}</span>
  )
  return (
    <div className="space-y-4">
      <div className={card}>
        <h3 className="font-semibold text-gray-900 dark:text-white">Balanced Scorecard — 4 perspectives (Kaplan & Norton)</h3>
        <p className={hint}>Un tableau de bord relié à la stratégie (si la stratégie change, les indicateurs changent). Type d’indicateur : <strong>A</strong> = en Avance (précurseur) · <strong>P</strong> = a Posteriori. Règles d’équilibrage : 15 à 25 indicateurs · 1/3 en avance, 2/3 a posteriori · ventilation 20 % Finances, 20 % Clients, 40 % Processus, 20 % Apprentissage.</p>
        {total > 0 && (
          <div className="flex flex-wrap gap-2">
            {badge(okTotal, `${total} indicateur${total > 1 ? 's' : ''} (cible 15-25)`)}
            {badge(okAvance, `${pctA} % en avance (cible ~33 %)`)}
            {persp.map(p => {
              const pct = total ? Math.round((bsc[p.key].length / total) * 100) : 0
              return badge(Math.abs(pct - p.cible) <= 12, `${p.title.split(' ')[1] ?? p.key} ${pct} % (cible ${p.cible} %)`)
            })}
          </div>
        )}
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
                    <select className={`${input} w-40`} value={it.type ?? 'P'} disabled={readOnly} title="A = en Avance (précurseur) · P = a Posteriori"
                      onChange={e => update(d => { d.bsc[p.key][i].type = e.target.value as 'A' | 'P' })}>
                      <option value="A">A — en Avance</option>
                      <option value="P">P — a Posteriori</option>
                    </select>
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
              {!readOnly && <button className={btnGhost} onClick={() => update(d => { d.bsc[p.key].push({ id: uid(), objectif: '', indicateur: '', cible: '', type: 'P' }) })}>+ Objectif</button>}
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
        <p className={hint}>Positionnez les actions/projets dans le temps (master plan sur 3 ans, précision du trimestre sur la première année). Planifiez selon <strong>QQOQCP</strong> : Quoi (l’action, orientée finalité) · Qui (le responsable) · Où (le périmètre) · Quand (l’échéance) · Combien (les ressources) · Pourquoi (l’objectif).</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="p-2 min-w-[200px]">Quoi (action / projet)</th>
              <th className="p-2">Type</th>
              <th className="p-2">Pilotage</th>
              <th className="p-2 min-w-[110px]">Qui (resp.)</th>
              <th className="p-2 min-w-[110px]">Où (périmètre)</th>
              <th className="p-2 min-w-[100px]">Quand</th>
              <th className="p-2 min-w-[110px]">Combien (ressources)</th>
              <th className="p-2 min-w-[130px]">Pourquoi (objectif)</th>
              <th className="p-2 min-w-[140px]">Livrables</th>
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
                <td className="p-1"><input className={input} value={r.perimetre} disabled={readOnly} onChange={e => update(d => { d.master_plan[i].perimetre = e.target.value })} /></td>
                <td className="p-1"><input className={input} value={r.echeance} disabled={readOnly} onChange={e => update(d => { d.master_plan[i].echeance = e.target.value })} /></td>
                <td className="p-1"><input className={input} value={r.ressources} disabled={readOnly} onChange={e => update(d => { d.master_plan[i].ressources = e.target.value })} /></td>
                <td className="p-1"><input className={input} value={r.pourquoi} disabled={readOnly} onChange={e => update(d => { d.master_plan[i].pourquoi = e.target.value })} /></td>
                <td className="p-1"><input className={input} value={r.livrables} disabled={readOnly} onChange={e => update(d => { d.master_plan[i].livrables = e.target.value })} /></td>
                {!readOnly && <td className="p-1 text-center"><button className={btnGhost} onClick={() => update(d => { d.master_plan.splice(i, 1) })}>✕</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && <button className={btnGhost} onClick={() => update(d => { d.master_plan.push({ libelle: '', type: 'action', pilotage: 'hierarchique', responsable: '', livrables: '', echeance: '', perimetre: '', ressources: '', pourquoi: '' }) })}>+ Ajouter une ligne</button>}
    </div>
  )
}

// ── Tableau de bord (Piloter / PDCA) ──────────────────────────────────────────────
const FEUX: { v: Feu; label: string; cls: string }[] = [
  { v: '', label: '—', cls: 'bg-gray-100 dark:bg-gray-700 text-gray-400' },
  { v: 'vert', label: '● Atteint / en bonne voie', cls: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' },
  { v: 'orange', label: '● À surveiller', cls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' },
  { v: 'rouge', label: '● En retard / non atteint', cls: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400' },
]

function TableauBordTab({ axes, bsc, pilotage, update, readOnly }: { axes: Axe[]; bsc: Bsc; pilotage: Pilotage; update: Upd; readOnly: boolean }) {
  // Agrège les indicateurs de la stratégie : lignes d'actions (axes) + Balanced Scorecard.
  type Row = { key: string; source: string; indicateur: string; depart: string; cible: string }
  const rows: Row[] = []
  axes.forEach((axe, ai) => axe.lignes.forEach((la, li) => {
    if (la.indicateur || la.objectif) rows.push({ key: `la:${la.id}`, source: `A${ai + 1}.${li + 1} — ${axe.titre || '…'}`, indicateur: la.indicateur || la.objectif, depart: la.niveauActuel, cible: la.cible })
  }))
  const bscLabel: Record<keyof Bsc, string> = { finances: 'BSC · Finances', clients: 'BSC · Clients', processus: 'BSC · Processus', apprentissage: 'BSC · Apprentissage' }
  ;(Object.keys(bscLabel) as (keyof Bsc)[]).forEach(p => bsc[p].forEach(it => {
    if (it.indicateur || it.objectif) rows.push({ key: `bsc:${it.id}`, source: bscLabel[p], indicateur: it.indicateur || it.objectif, depart: '', cible: it.cible })
  }))

  const get = (k: string): Suivi => pilotage.suivi[k] ?? { valeur: '', statut: '' }
  function setSuivi(k: string, patch: Partial<Suivi>) {
    update(d => { d.pilotage.suivi[k] = { ...(d.pilotage.suivi[k] ?? { valeur: '', statut: '' }), ...patch } })
  }

  const counts = { vert: 0, orange: 0, rouge: 0 }
  rows.forEach(r => { const s = get(r.key).statut; if (s === 'vert') counts.vert++; else if (s === 'orange') counts.orange++; else if (s === 'rouge') counts.rouge++ })

  return (
    <div className="space-y-4">
      <div className={card}>
        <h3 className="font-semibold text-gray-900 dark:text-white">Tableau de bord stratégique (PDCA)</h3>
        <p className={hint}>Suivi des indicateurs issus des lignes d’actions et de la Balanced Scorecard. Renseignez la valeur actuelle et l’état d’avancement à chaque revue de stratégie.</p>
        {rows.length > 0 && (
          <div className="flex gap-3 text-sm">
            <span className="px-2 py-1 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">{counts.vert} en bonne voie</span>
            <span className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">{counts.orange} à surveiller</span>
            <span className="px-2 py-1 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400">{counts.rouge} en retard</span>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className={card}><p className={hint}>Aucun indicateur pour l’instant. Ajoutez des indicateurs dans les lignes d’actions (onglet « Axes ») ou dans la Balanced Scorecard.</p></div>
      ) : (
        <div className={card}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="p-2 min-w-[200px]">Origine</th>
                  <th className="p-2 min-w-[180px]">Indicateur</th>
                  <th className="p-2">Départ</th>
                  <th className="p-2">Cible</th>
                  <th className="p-2">Actuel</th>
                  <th className="p-2 min-w-[190px]">État</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const s = get(r.key)
                  return (
                    <tr key={r.key} className="border-b border-gray-100 dark:border-gray-700 align-top">
                      <td className="p-2 text-gray-500 dark:text-gray-400 text-xs">{r.source}</td>
                      <td className="p-2 text-gray-800 dark:text-gray-200">{r.indicateur}</td>
                      <td className="p-2 text-gray-500">{r.depart || '—'}</td>
                      <td className="p-2 text-gray-500">{r.cible || '—'}</td>
                      <td className="p-1"><input className={`${input} w-24`} value={s.valeur} disabled={readOnly} onChange={e => setSuivi(r.key, { valeur: e.target.value })} /></td>
                      <td className="p-1">
                        <select className={`${input} ${FEUX.find(f => f.v === s.statut)?.cls ?? ''}`} value={s.statut} disabled={readOnly}
                          onChange={e => setSuivi(r.key, { statut: e.target.value as Feu })}>
                          {FEUX.map(f => <option key={f.v} value={f.v}>{f.label}</option>)}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className={card}>
        <h4 className="font-medium text-gray-900 dark:text-white">Revues de stratégie</h4>
        <p className={hint}>Roue PDCA — dispositif du cours : suivi des <strong>master plans en unité</strong> (fréquence définie), revue de la stratégie en <strong>Codir</strong> (habituellement trimestrielle, tableau de bord mensuel ou trimestriel), <strong>audit du président</strong> (objectif, modalités) et <strong>réactualisation annuelle</strong> de la stratégie.</p>
        {pilotage.revues.map((rev, i) => (
          <div key={i} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2 bg-gray-50/60 dark:bg-gray-800/30">
            <div className="flex flex-wrap items-center gap-2">
              <input className={`${input} w-40`} type="date" value={rev.date} disabled={readOnly} onChange={e => update(d => { d.pilotage.revues[i].date = e.target.value })} />
              <select className={`${input} w-56`} value={rev.type ?? 'codir'} disabled={readOnly} onChange={e => update(d => { d.pilotage.revues[i].type = e.target.value as RevueType })}>
                <option value="unite">Suivi master plan (unité)</option>
                <option value="codir">Revue Codir (trimestrielle)</option>
                <option value="audit">Audit du président</option>
                <option value="reactualisation">Réactualisation annuelle</option>
              </select>
              {!readOnly && <button className={btnGhost} onClick={() => update(d => { d.pilotage.revues.splice(i, 1) })}>Supprimer</button>}
            </div>
            <textarea className={`${input} h-20`} value={rev.note} disabled={readOnly} placeholder="Compte rendu, décisions, ajustements…" onChange={e => update(d => { d.pilotage.revues[i].note = e.target.value })} />
          </div>
        ))}
        {!readOnly && <button className={btnGhost} onClick={() => update(d => { d.pilotage.revues.push({ date: '', note: '', type: 'codir' }) })}>+ Ajouter une revue</button>}
      </div>
    </div>
  )
}

// ── FCS & Arbre d'alignement stratégique ─────────────────────────────────────────
function FcsTab({ fcs, vision, axes, update, readOnly }: { fcs: Fcs[]; vision: Vision; axes: Axe[]; update: Upd; readOnly: boolean }) {
  return (
    <div className="space-y-4">
      <div className={card}>
        <h3 className="font-semibold text-gray-900 dark:text-white">Facteurs Clés de Succès & Arbre d’alignement stratégique</h3>
        <p className={hint}>3 à 5 grands aspects sur lesquels l’entreprise doit se focaliser pour atteindre sa vision (leviers). L’arbre relie : Stratégie → FCS → indicateurs stratégiques → indicateurs opérationnels. Questions clés : Pourquoi les clients achètent-ils une première fois, pourquoi reviennent-ils ? Quels avantages pourrions-nous mieux exploiter ? Quels problèmes devons-nous régler sans quoi notre succès futur serait en danger ? Que devons-nous absolument réussir ?</p>
      </div>

      {/* Sommet de l'arbre : vision + axes (rappel) */}
      <div className={card}>
        <h4 className="font-medium text-gray-900 dark:text-white">Sommet de l’arbre</h4>
        <p className="text-sm text-gray-700 dark:text-gray-300"><strong>Vision :</strong> {vision.synthetique || <span className="text-gray-400">à renseigner (onglet Vision)</span>}</p>
        {axes.length > 0 && (
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-0.5">
            {axes.map((a, ai) => <li key={a.id}>A{ai + 1} — {a.titre || '…'}</li>)}
          </ul>
        )}
      </div>

      {fcs.map((f, fi) => (
        <div key={f.id} className={card}>
          <div className="flex items-center gap-2">
            <span className="shrink-0 w-12 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">FCS{fi + 1}</span>
            <input className={`${input} font-medium`} value={f.titre} disabled={readOnly} placeholder="Énoncé du Facteur Clé de Succès"
              onChange={e => update(d => { d.fcs[fi].titre = e.target.value })} />
            {!readOnly && <button className={btnGhost} onClick={() => update(d => { d.fcs.splice(fi, 1) })}>Supprimer</button>}
          </div>
          <div className="space-y-2">
            <p className={label}>Indicateurs stratégiques liés au FCS</p>
            {f.indicateurs.map((ind, ii) => (
              <div key={ind.id} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 shrink-0">I{fi + 1}.{ii + 1}</span>
                <input className={input} value={ind.libelle} disabled={readOnly} placeholder="Indicateur stratégique"
                  onChange={e => update(d => { d.fcs[fi].indicateurs[ii].libelle = e.target.value })} />
                <input className={`${input} w-32`} value={ind.cible} disabled={readOnly} placeholder="Cible"
                  onChange={e => update(d => { d.fcs[fi].indicateurs[ii].cible = e.target.value })} />
                {!readOnly && <button className={btnGhost} onClick={() => update(d => { d.fcs[fi].indicateurs.splice(ii, 1) })}>✕</button>}
              </div>
            ))}
            {!readOnly && <button className={btnGhost} onClick={() => update(d => { d.fcs[fi].indicateurs.push({ id: uid(), libelle: '', cible: '' }) })}>+ Indicateur stratégique</button>}
          </div>
        </div>
      ))}
      {fcs.length >= 5 && <p className={hint}>Le cours recommande 3 à 5 FCS — au-delà, la focalisation se perd.</p>}
      {!readOnly && <button className={btnGhost} onClick={() => update(d => { d.fcs.push({ id: uid(), titre: '', indicateurs: [] }) })}>+ Ajouter un FCS</button>}
    </div>
  )
}

// ── Carte stratégique (liens de cause à effet) ────────────────────────────────────
function CarteTab({ carte, bsc, update, readOnly }: { carte: CarteLien[]; bsc: Bsc; update: Upd; readOnly: boolean }) {
  // Réservoir d'indicateurs = ceux de la BSC, étiquetés par perspective.
  const perspLabel: Record<keyof Bsc, string> = { finances: 'Finances', clients: 'Clients', processus: 'Processus', apprentissage: 'Apprentissage' }
  const pool: { id: string; label: string }[] = []
  ;(Object.keys(perspLabel) as (keyof Bsc)[]).forEach(p => bsc[p].forEach(it => {
    if (it.indicateur || it.objectif) pool.push({ id: it.id, label: `[${perspLabel[p]}] ${it.indicateur || it.objectif}` })
  }))
  const name = (id: string) => pool.find(p => p.id === id)?.label ?? '—'
  const forceLabel: Record<number, string> = { 3: 'Fort', 2: 'Moyen', 1: 'Faible' }

  return (
    <div className="space-y-4">
      <div className={card}>
        <h3 className="font-semibold text-gray-900 dark:text-white">Carte stratégique — liens de cause à effet</h3>
        <p className={hint}>Construite de haut en bas, lue de bas en haut (Apprentissage → Processus → Clients → Finances). Chaque lien cause→effet est évalué par sa <strong>force</strong> (fort/moyen/faible : probabilité que la cause agisse sur l’effet) et sa <strong>durée en mois</strong> (délai pour que l’indicateur « effet » bouge). Les chemins courts et longs se lisent en chaînant les liens.</p>
      </div>

      {pool.length < 2 ? (
        <div className={card}><p className={hint}>Renseignez d’abord des indicateurs dans la Balanced Scorecard (au moins 2) pour tracer des liens de cause à effet.</p></div>
      ) : (
        <div className={card}>
          {carte.length > 0 && (
            <div className="space-y-2">
              {carte.map((l, i) => (
                <div key={l.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-2 bg-gray-50/60 dark:bg-gray-800/30">
                  <select className={`${input} flex-1 min-w-[180px]`} value={l.causeId} disabled={readOnly} onChange={e => update(d => { d.carte[i].causeId = e.target.value })}>
                    <option value="">— Cause —</option>
                    {pool.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                  <span className="text-indigo-500 font-bold">→</span>
                  <select className={`${input} flex-1 min-w-[180px]`} value={l.effetId} disabled={readOnly} onChange={e => update(d => { d.carte[i].effetId = e.target.value })}>
                    <option value="">— Effet —</option>
                    {pool.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                  <select className={`${input} w-28`} value={l.force} disabled={readOnly} onChange={e => update(d => { d.carte[i].force = Number(e.target.value) })}>
                    {[3, 2, 1].map(v => <option key={v} value={v}>{forceLabel[v]}</option>)}
                  </select>
                  <input className={`${input} w-24`} value={l.duree} disabled={readOnly} placeholder="mois" onChange={e => update(d => { d.carte[i].duree = e.target.value })} />
                  {!readOnly && <button className={btnGhost} onClick={() => update(d => { d.carte.splice(i, 1) })}>✕</button>}
                </div>
              ))}
            </div>
          )}
          {!readOnly && <button className={btnGhost} onClick={() => update(d => { d.carte.push({ id: uid(), causeId: '', effetId: '', force: 2, duree: '' }) })}>+ Ajouter un lien cause → effet</button>}

          {carte.filter(l => l.causeId && l.effetId).length > 0 && (
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <p className={label}>Lecture des liens</p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                {carte.filter(l => l.causeId && l.effetId).map(l => (
                  <li key={l.id}>• {name(l.causeId)} <span className="text-indigo-500">→</span> {name(l.effetId)} <span className="text-gray-400">({forceLabel[l.force] ?? '—'}{l.duree ? `, ${l.duree} mois` : ''})</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Communication de la stratégie ──────────────────────────────────────────────────
function CommunicationTab({ comm, update, readOnly }: { comm: Communication; update: Upd; readOnly: boolean }) {
  return (
    <div className="space-y-4">
      <div className={card}>
        <h3 className="font-semibold text-gray-900 dark:text-white">Communication de la stratégie</h3>
        <p className={hint}>Pourquoi communiquer (Balanced Scorecard Collaborative Survey) : <strong>95 %</strong> des équipes ne comprennent pas la stratégie de leur organisation · <strong>90 %</strong> des organisations échouent dans l’exécution réelle · <strong>86 %</strong> des équipes de direction passent moins d’une heure par mois à parler de stratégie · <strong>60 %</strong> ne font pas le lien entre stratégie et budget.</p>
      </div>

      <div className={card}>
        <h4 className="font-medium text-gray-900 dark:text-white">Slogan & visuel de référence</h4>
        <div>
          <label className={label}>Slogan (à partir de la mission ou de la vision)</label>
          <input className={input} value={comm.slogan} disabled={readOnly} onChange={e => update(d => { d.communication.slogan = e.target.value })} placeholder="Notre slogan…" />
        </div>
        <div>
          <label className={label}>Visuel de référence (description du visuel unique qui raconte la stratégie)</label>
          <textarea className={`${input} h-20`} value={comm.visuel} disabled={readOnly} onChange={e => update(d => { d.communication.visuel = e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={card}>
          <h4 className="font-medium text-gray-900 dark:text-white">Messages clés</h4>
          <p className={hint}>Points importants, menaces, chiffres clés. « Qu’est-ce que je veux qu’ils retiennent ? »</p>
          <StringList items={comm.messages} readOnly={readOnly} onChange={v => update(d => { d.communication.messages = v })} />
        </div>
        <div className={card}>
          <h4 className="font-medium text-gray-900 dark:text-white">Principales objections (et réponses)</h4>
          <p className={hint}>Identifier les objections probables et préparer les réponses.</p>
          <StringList items={comm.objections} readOnly={readOnly} onChange={v => update(d => { d.communication.objections = v })} />
        </div>
      </div>

      <div className={card}>
        <h4 className="font-medium text-gray-900 dark:text-white">« Tout d’abord faire comprendre ! » — checklist</h4>
        <div className="space-y-2">
          {COMM_CHECKLIST.map(c => (
            <label key={c.key} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" className="mt-0.5 accent-indigo-600" disabled={readOnly}
                checked={!!comm.checklist[c.key]}
                onChange={e => update(d => { d.communication.checklist[c.key] = e.target.checked })} />
              {c.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Conduite du changement (8 étapes de Kotter) ────────────────────────────────────
function ChangementTab({ kotter, update, readOnly }: { kotter: KotterStep[]; update: Upd; readOnly: boolean }) {
  const statuts: { v: KotterStatut; label: string; cls: string }[] = [
    { v: 'afaire', label: 'À faire', cls: 'bg-gray-100 dark:bg-gray-700 text-gray-500' },
    { v: 'encours', label: 'En cours', cls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' },
    { v: 'fait', label: 'Fait', cls: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' },
  ]
  const done = kotter.filter(k => k.statut === 'fait').length
  return (
    <div className="space-y-4">
      <div className={card}>
        <h3 className="font-semibold text-gray-900 dark:text-white">Conduite du changement — les 8 étapes de Kotter</h3>
        <p className={hint}>D’après John P. Kotter (« Leading Change »). Suivez l’avancement de la transformation. {done}/{KOTTER_ETAPES.length} étapes réalisées.</p>
      </div>
      {KOTTER_ETAPES.map((etape, i) => {
        const step = kotter[i] ?? { statut: 'afaire' as KotterStatut, note: '' }
        return (
          <div key={i} className={card}>
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">{i + 1}</span>
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-medium text-gray-900 dark:text-white">{etape}</h4>
                  <div className="flex gap-1">
                    {statuts.map(s => (
                      <button key={s.v} disabled={readOnly} onClick={() => update(d => { d.kotter[i] = { ...d.kotter[i], statut: s.v } })}
                        className={`px-2 py-1 text-xs rounded-lg transition-colors ${step.statut === s.v ? s.cls + ' font-semibold ring-1 ring-inset ring-current' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea className={`${input} h-16`} value={step.note} disabled={readOnly} placeholder="Actions, responsables, notes…" onChange={e => update(d => { d.kotter[i] = { ...d.kotter[i], note: e.target.value } })} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

'use client'

// Sous-application « Parties prenantes » de Projet RSE (méthode du cours,
// Practice Guide §7.1) : registre, matrice Pouvoir × Intérêt interactive et
// plan d'engagement. Particularité du cours : « la société » et « la Terre »
// sont des parties prenantes à part entière.
//
// API : /api/projet-rse/projets/[id]/parties · engagements · import-parties

import { useState, useEffect, useCallback, useRef } from 'react'
import type { ProjetRseModuleProps } from '@/lib/projetRseModules'

// ── Types (contrat API) ───────────────────────────────────────────────────────

type Categorie = 'verte' | 'orange' | 'bleue'
type Attitude = 'alliee' | 'ouverte' | 'neutre' | 'vigilante' | 'opposee'
type StatutSuivi = 'a_engager' | 'engagee' | 'a_risque' | 'ok'
type StatutEngagement = 'a_faire' | 'en_cours' | 'fait'
type NiveauEngagement = 'peu_conscient' | 'resistant' | 'neutre' | 'solidaire' | 'leader'
type ModeCom = 'push' | 'pull' | 'interactive'

interface Partie {
  id: string
  nom: string
  organisation: string | null
  categorie: Categorie
  role: string | null
  pouvoir: number
  interet: number
  legitimite: number
  urgence: number
  engagement_actuel: NiveauEngagement
  engagement_souhaite: NiveauEngagement
  attitude: Attitude
  attentes: string | null
  verbatims: string | null
  strategie: string | null
  statut_suivi: StatutSuivi
}

interface Engagement {
  id: string
  partie_id: string
  action: string
  responsable: string | null
  canal: string | null
  frequence: string | null
  echeance: string | null
  statut: StatutEngagement
  mode: ModeCom | null
}

interface PpSession {
  id: string
  name: string
  organisation: string | null
  exercice: string | null
  pp_count: number
}

// ── Libellés & couleurs ───────────────────────────────────────────────────────

const CATEGORIES: { value: Categorie; label: string; dot: string; badge: string }[] = [
  { value: 'verte', label: '🟢 Opérationnel quotidien', dot: '#16a34a', badge: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  { value: 'orange', label: '🟠 Gouvernance', dot: '#ea580c', badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
  { value: 'bleue', label: '🔵 Externe critique', dot: '#2563eb', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
]

const ATTITUDES: { value: Attitude; label: string; ring: string; badge: string; dash?: string }[] = [
  { value: 'alliee', label: 'Alliée', ring: '#15803d', badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  { value: 'ouverte', label: 'Ouverte', ring: '#0d9488', badge: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300' },
  { value: 'neutre', label: 'Neutre', ring: '#6b7280', badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  { value: 'vigilante', label: 'Vigilante', ring: '#d97706', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300', dash: '4 2' },
  { value: 'opposee', label: 'Opposée', ring: '#dc2626', badge: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300', dash: '2 2' },
]

const STATUTS_SUIVI: { value: StatutSuivi; label: string; badge: string }[] = [
  { value: 'a_engager', label: 'À engager', badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  { value: 'engagee', label: 'Engagée', badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300' },
  { value: 'a_risque', label: 'À risque', badge: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  { value: 'ok', label: 'OK', badge: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
]

const STATUTS_ENGAGEMENT: Record<StatutEngagement, { label: string; badge: string; next: StatutEngagement }> = {
  a_faire: { label: 'À faire', badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', next: 'en_cours' },
  en_cours: { label: 'En cours', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300', next: 'fait' },
  fait: { label: 'Fait ✓', badge: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300', next: 'a_faire' },
}

// ── Cours MdGP : cycle, salience, engagement, modes de communication ─────────

// Cycle d'engagement en 6 étapes (processus continu)
const CYCLE_STEPS: { label: string; tip: string }[] = [
  { label: 'Identifier', tip: 'Recenser toutes les personnes et entités touchées par le projet ou capables de l’influencer.' },
  { label: 'Comprendre', tip: 'Saisir leurs attentes, leurs besoins et leur perception du projet.' },
  { label: 'Analyser', tip: 'Évaluer leur pouvoir, leur légitimité, leur urgence, leur intérêt et leur attitude.' },
  { label: 'Hiérarchiser', tip: 'Prioriser l’effort d’engagement : il est inversement proportionnel à la prépondérance.' },
  { label: 'Impliquer', tip: 'Mettre en œuvre le plan d’engagement avec le bon mode de communication.' },
  { label: 'Suivre', tip: 'Mesurer l’évolution de l’engagement et réévaluer en continu, à chaque phase.' },
]

// Matrice d'évaluation de l'engagement : 5 niveaux (C = actuel, D = désiré)
const NIVEAUX_ENGAGEMENT: { value: NiveauEngagement; label: string }[] = [
  { value: 'peu_conscient', label: 'Peu conscient' },
  { value: 'resistant', label: 'Résistant' },
  { value: 'neutre', label: 'Neutre' },
  { value: 'solidaire', label: 'Solidaire' },
  { value: 'leader', label: 'Leader' },
]
function niveauIndex(v: NiveauEngagement): number {
  const i = NIVEAUX_ENGAGEMENT.findIndex(n => n.value === v)
  return i >= 0 ? i : 0
}

// Modes de communication (PMBOK)
const MODES_COM: { value: ModeCom; label: string; def: string }[] = [
  { value: 'push', label: 'Push', def: 'Push : communication à sens unique, envoyée vers la partie prenante (notes, rapports, courriels) — à utiliser délibérément.' },
  { value: 'pull', label: 'Pull', def: 'Pull : l’information est mise à disposition et la partie prenante vient la chercher (intranet, tableau de bord, base documentaire).' },
  { value: 'interactive', label: 'Interactif', def: 'Interactif : échange bidirectionnel — réunions, appels, démonstrations — avec boucles de rétroaction rapides.' },
]
const MODES_TOOLTIP = MODES_COM.map(m => m.def).join('\n')

// Modèle de salience (Mitchell, Agle & Wood, 1997) :
// attribut « présent » si sa note est > 3 ; 7 groupes + hors périmètre.
type SalienceKey = 'definitifs' | 'dominants' | 'dangereux' | 'dependants' | 'dormants' | 'discretionnaires' | 'demandeurs' | 'hors'

const SALIENCE: Record<SalienceKey, { label: string; attrs: string; strategie: string; rang: number; fill: string; badge: string }> = {
  definitifs: { label: 'Définitifs', attrs: 'Pouvoir + Légitimité + Urgence', strategie: 'Engager / collaborer étroitement', rang: 7, fill: '#8b5cf6', badge: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300' },
  dominants: { label: 'Dominants', attrs: 'Pouvoir + Légitimité', strategie: 'Maintenir satisfait', rang: 6, fill: '#6366f1', badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300' },
  dangereux: { label: 'Dangereux', attrs: 'Pouvoir + Urgence', strategie: 'Maintenir satisfait', rang: 5, fill: '#dc2626', badge: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  dependants: { label: 'Dépendants', attrs: 'Légitimité + Urgence', strategie: 'Maintenir informé', rang: 4, fill: '#0d9488', badge: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300' },
  dormants: { label: 'Dormants', attrs: 'Pouvoir seul', strategie: 'Prendre en compte / veiller', rang: 3, fill: '#818cf8', badge: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300' },
  discretionnaires: { label: 'Discrétionnaires', attrs: 'Légitimité seule', strategie: 'Prendre en compte / veiller', rang: 2, fill: '#2dd4bf', badge: 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300' },
  demandeurs: { label: 'Demandeurs', attrs: 'Urgence seule', strategie: 'Prendre en compte / veiller', rang: 1, fill: '#f59e0b', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  hors: { label: 'Hors périmètre', attrs: 'Aucun attribut > 3', strategie: 'À surveiller', rang: 0, fill: '#9ca3af', badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
}

function salienceOf(pouvoir: number, legitimite: number, urgence: number): SalienceKey {
  const P = pouvoir > 3, L = legitimite > 3, U = urgence > 3
  if (P && L && U) return 'definitifs'
  if (P && L) return 'dominants'
  if (P && U) return 'dangereux'
  if (L && U) return 'dependants'
  if (P) return 'dormants'
  if (L) return 'discretionnaires'
  if (U) return 'demandeurs'
  return 'hors'
}

const LETTRE_OU_CHIFFRE = /[0-9A-Za-zÀ-ÖØ-öø-ÿ]/
function initialesDe(nom: string): string {
  const ini = nom.trim().split(/\s+/)
    .map(m => { const c = m.split('').find(ch => LETTRE_OU_CHIFFRE.test(ch)); return c ?? '' })
    .join('').toUpperCase()
  return ini.slice(0, 3) || '?'
}

function catOf(v: Categorie) { return CATEGORIES.find(c => c.value === v) ?? CATEGORIES[0] }
function attOf(v: Attitude) { return ATTITUDES.find(a => a.value === v) ?? ATTITUDES[2] }
function suiviOf(v: StatutSuivi) { return STATUTS_SUIVI.find(s => s.value === v) ?? STATUTS_SUIVI[0] }

function quadrantStrategie(pouvoir: number, interet: number): string {
  if (pouvoir >= 3 && interet >= 3) return 'Engager pleinement'
  if (pouvoir >= 3) return 'Garder satisfait'
  if (interet >= 3) return 'Tenir informé'
  return 'Information minimale'
}

function formatDateFr(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Fiche d'édition ───────────────────────────────────────────────────────────

interface PartieForm {
  id?: string
  nom: string
  organisation: string
  categorie: Categorie
  role: string
  pouvoir: number
  interet: number
  legitimite: number
  urgence: number
  engagement_actuel: NiveauEngagement
  engagement_souhaite: NiveauEngagement
  attitude: Attitude
  attentes: string
  verbatims: string
  strategie: string
  statut_suivi: StatutSuivi
}

const EMPTY_FORM: PartieForm = {
  nom: '', organisation: '', categorie: 'verte', role: '', pouvoir: 3, interet: 3,
  legitimite: 3, urgence: 1, engagement_actuel: 'peu_conscient', engagement_souhaite: 'solidaire',
  attitude: 'neutre', attentes: '', verbatims: '', strategie: '', statut_suivi: 'a_engager',
}

const PRESET_TERRE: PartieForm = {
  ...EMPTY_FORM,
  nom: 'La Terre',
  categorie: 'bleue',
  role: 'Partie prenante silencieuse — écosystèmes, climat, ressources',
  pouvoir: 5, interet: 5,
  legitimite: 5, urgence: 4,
  attentes: 'Préservation des ressources, limitation des émissions et des déchets, respect des limites planétaires.',
  strategie: 'Engager pleinement',
  attitude: 'neutre',
}

const PRESET_SOCIETE: PartieForm = {
  ...EMPTY_FORM,
  nom: 'La société',
  categorie: 'bleue',
  role: 'Partie prenante silencieuse — communautés, générations futures',
  pouvoir: 4, interet: 4,
  legitimite: 5, urgence: 2,
  attentes: 'Retombées sociales positives, transparence, équité, absence d’externalités négatives pour les communautés.',
  strategie: 'Engager pleinement',
  attitude: 'neutre',
}

function formFromPartie(p: Partie): PartieForm {
  return {
    id: p.id, nom: p.nom, organisation: p.organisation ?? '', categorie: p.categorie,
    role: p.role ?? '', pouvoir: p.pouvoir, interet: p.interet,
    legitimite: p.legitimite ?? 3, urgence: p.urgence ?? 1,
    engagement_actuel: p.engagement_actuel ?? 'peu_conscient',
    engagement_souhaite: p.engagement_souhaite ?? 'solidaire',
    attitude: p.attitude,
    attentes: p.attentes ?? '', verbatims: p.verbatims ?? '', strategie: p.strategie ?? '',
    statut_suivi: p.statut_suivi,
  }
}

// ── Composant principal ───────────────────────────────────────────────────────

type SubTab = 'registre' | 'matrice' | 'salience' | 'engagement' | 'plan'
const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'registre', label: '📇 Registre' },
  { key: 'matrice', label: '🧭 Matrice Pouvoir × Intérêt' },
  { key: 'salience', label: '🎯 Salience' },
  { key: 'engagement', label: '📶 Engagement' },
  { key: 'plan', label: '🤝 Plan d’engagement' },
]

export default function ProjetRsePartiesModule({ projetId, organisationId, phase, readOnly }: ProjetRseModuleProps) {
  const base = `/api/projet-rse/projets/${projetId}`

  const [tab, setTab] = useState<SubTab>('registre')
  const [rattacher, setRattacher] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parties, setParties] = useState<Partie[]>([])
  const [loaded, setLoaded] = useState(false)

  // Fiche d'édition
  const [form, setForm] = useState<PartieForm | null>(null)
  const [saving, setSaving] = useState(false)

  // Import depuis Parties Prenantes & Matérialité
  const [showImport, setShowImport] = useState(false)
  const [sessions, setSessions] = useState<PpSession[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [importInfo, setImportInfo] = useState<string | null>(null)

  // Engagements
  const [engagements, setEngagements] = useState<Engagement[]>([])
  const [filterPartie, setFilterPartie] = useState('')

  // Rappel de revue : la phase du projet a-t-elle changé depuis la dernière
  // modification des parties ? (heuristique simple, mémorisée en localStorage)
  const phaseKey = `projet-rse-parties-phase-${projetId}`
  const [phaseBanner, setPhaseBanner] = useState(false)
  useEffect(() => {
    try {
      const last = window.localStorage.getItem(phaseKey)
      setPhaseBanner(last !== null && last !== phase)
    } catch { /* stockage indisponible : pas de bandeau */ }
  }, [phase, phaseKey])
  const rememberPhase = useCallback(() => {
    try { window.localStorage.setItem(phaseKey, phase) } catch { /* ignore */ }
    setPhaseBanner(false)
  }, [phaseKey, phase])

  // ── Chargements ──
  const loadParties = useCallback(async () => {
    try {
      const res = await fetch(`${base}/parties`)
      const j = await res.json()
      if (!res.ok) throw new Error((j as { error?: string }).error ?? 'Erreur de chargement des parties prenantes')
      setParties(((j as { parties?: Partie[] }).parties) ?? [])
    } catch (e) { setError(String((e as Error).message ?? e)) }
    finally { setLoaded(true) }
  }, [base])

  const loadEngagements = useCallback(async () => {
    try {
      const res = await fetch(`${base}/engagements`)
      const j = await res.json()
      if (!res.ok) throw new Error((j as { error?: string }).error ?? 'Erreur de chargement du plan d’engagement')
      setEngagements(((j as { engagements?: Engagement[] }).engagements) ?? [])
    } catch (e) { setError(String((e as Error).message ?? e)) }
  }, [base])

  useEffect(() => { loadParties(); loadEngagements() }, [loadParties, loadEngagements])

  // ── Mutations parties ──
  const savePartie = useCallback(async () => {
    if (!form || !form.nom.trim()) return
    setSaving(true); setError(null)
    try {
      const payload = {
        ...(form.id ? { id: form.id } : {}),
        nom: form.nom.trim(),
        organisation: form.organisation.trim() || null,
        categorie: form.categorie,
        role: form.role.trim() || null,
        pouvoir: form.pouvoir,
        interet: form.interet,
        legitimite: form.legitimite,
        urgence: form.urgence,
        engagement_actuel: form.engagement_actuel,
        engagement_souhaite: form.engagement_souhaite,
        attitude: form.attitude,
        attentes: form.attentes.trim() || null,
        verbatims: form.verbatims.trim() || null,
        strategie: form.strategie.trim() || null,
        statut_suivi: form.statut_suivi,
      }
      const res = await fetch(`${base}/parties`, {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await res.json()
      if (!res.ok) throw new Error((j as { error?: string }).error ?? 'Erreur d’enregistrement')
      setForm(null)
      rememberPhase()
      await loadParties()
    } catch (e) { setError(String((e as Error).message ?? e)) }
    finally { setSaving(false) }
  }, [form, base, loadParties, rememberPhase])

  const deletePartie = useCallback(async (id: string) => {
    if (!window.confirm('Supprimer cette partie prenante (et ses actions d’engagement) ?')) return
    try {
      const res = await fetch(`${base}/parties?id=${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        // L'identifiant est aussi transmis dans le corps : la chaîne de requête
        // n'atteint pas toujours les routes imbriquées sous un segment dynamique.
        body: JSON.stringify({ id }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error ?? 'Erreur de suppression')
      }
      rememberPhase()
      await loadParties(); await loadEngagements()
    } catch (e) { setError(String((e as Error).message ?? e)) }
  }, [base, loadParties, loadEngagements, rememberPhase])

  const patchPartie = useCallback(async (id: string, champs: Partial<Partie>) => {
    // Mise à jour optimiste (drag de la matrice, changement de statut)
    setParties(prev => prev.map(p => (p.id === id ? { ...p, ...champs } : p)))
    try {
      const res = await fetch(`${base}/parties`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...champs }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error ?? 'Erreur de mise à jour')
      }
      rememberPhase()
    } catch (e) { setError(String((e as Error).message ?? e)); await loadParties() }
  }, [base, loadParties, rememberPhase])

  // ── Import ──
  const openImport = useCallback(async () => {
    setShowImport(true); setSessions(null); setImportInfo(null)
    try {
      const res = await fetch('/api/parties-prenantes/sessions')
      const j = await res.json()
      if (!res.ok) throw new Error((j as { error?: string }).error ?? 'Erreur de chargement des sessions')
      setSessions(((j as { data?: PpSession[] }).data) ?? [])
    } catch (e) { setError(String((e as Error).message ?? e)); setSessions([]) }
  }, [])

  const runImport = useCallback(async (sessionId: string) => {
    setImporting(true); setError(null)
    try {
      const res = await fetch(`${base}/import-parties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pp_session_id: sessionId }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error((j as { error?: string }).error ?? 'Erreur d’import')
      const n = (j as { imported?: number }).imported ?? 0
      setImportInfo(`${n} partie${n > 1 ? 's' : ''} prenante${n > 1 ? 's' : ''} importée${n > 1 ? 's' : ''}.`)
      rememberPhase()
      await loadParties()
    } catch (e) { setError(String((e as Error).message ?? e)) }
    finally { setImporting(false) }
  }, [base, loadParties, rememberPhase])

  // ── Mutations engagements ──
  const [newEng, setNewEng] = useState<{ partie_id: string; action: string; responsable: string; canal: string; frequence: string; echeance: string; mode: string }>(
    { partie_id: '', action: '', responsable: '', canal: '', frequence: '', echeance: '', mode: '' })
  const [savingEng, setSavingEng] = useState(false)

  const addEngagement = useCallback(async () => {
    const partieId = filterPartie || newEng.partie_id
    if (!partieId || !newEng.action.trim()) return
    setSavingEng(true); setError(null)
    try {
      const res = await fetch(`${base}/engagements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partie_id: partieId,
          action: newEng.action.trim(),
          responsable: newEng.responsable.trim() || null,
          canal: newEng.canal.trim() || null,
          frequence: newEng.frequence.trim() || null,
          echeance: newEng.echeance || null,
          statut: 'a_faire',
          mode: newEng.mode || null,
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error((j as { error?: string }).error ?? 'Erreur d’ajout de l’action')
      setNewEng({ partie_id: '', action: '', responsable: '', canal: '', frequence: '', echeance: '', mode: '' })
      await loadEngagements()
    } catch (e) { setError(String((e as Error).message ?? e)) }
    finally { setSavingEng(false) }
  }, [base, newEng, filterPartie, loadEngagements])

  const cycleEngagement = useCallback(async (eng: Engagement) => {
    const next = STATUTS_ENGAGEMENT[eng.statut].next
    setEngagements(prev => prev.map(e => (e.id === eng.id ? { ...e, statut: next } : e)))
    try {
      const res = await fetch(`${base}/engagements`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: eng.id, statut: next }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error ?? 'Erreur de mise à jour du statut')
      }
    } catch (e) { setError(String((e as Error).message ?? e)); await loadEngagements() }
  }, [base, loadEngagements])

  const setEngagementMode = useCallback(async (id: string, mode: ModeCom | null) => {
    setEngagements(prev => prev.map(e => (e.id === id ? { ...e, mode } : e)))
    try {
      const res = await fetch(`${base}/engagements`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, mode }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error ?? 'Erreur de mise à jour du mode')
      }
    } catch (e) { setError(String((e as Error).message ?? e)); await loadEngagements() }
  }, [base, loadEngagements])

  const deleteEngagement = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${base}/engagements?id=${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        // L'identifiant est aussi transmis dans le corps : la chaîne de requête
        // n'atteint pas toujours les routes imbriquées sous un segment dynamique.
        body: JSON.stringify({ id }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error ?? 'Erreur de suppression')
      }
      await loadEngagements()
    } catch (e) { setError(String((e as Error).message ?? e)) }
  }, [base, loadEngagements])

  const partieById = useCallback((id: string) => parties.find(p => p.id === id), [parties])

  // ── Rendu ──
  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400 flex items-start justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="shrink-0 font-medium hover:underline">Fermer</button>
        </div>
      )}

      {phaseBanner && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 flex items-start justify-between gap-3">
          <span>🔄 Nouvelle phase du projet : pensez à réévaluer le pouvoir et l’intérêt de chaque partie prenante — le processus d’engagement est continu.</span>
          <button onClick={rememberPhase} className="shrink-0 font-medium hover:underline">OK</button>
        </div>
      )}

      {/* Bandeau du cycle d'engagement en 6 étapes (processus continu) */}
      <div className="rounded-xl border p-3" style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-1 overflow-x-auto">
          {CYCLE_STEPS.map((s, i) => (
            <div key={s.label} className="flex items-center gap-1 shrink-0">
              <span title={s.tip} className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 cursor-help">
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] font-bold">{i + 1}</span>
                {s.label}
              </span>
              {i < CYCLE_STEPS.length - 1 && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>→</span>}
            </div>
          ))}
          <span title="Après « Suivre », on repart sur « Identifier » : l’engagement des parties prenantes n’est jamais terminé." className="shrink-0 ml-1 text-xs cursor-help" style={{ color: 'var(--text-muted)' }}>↺ processus continu</span>
        </div>
      </div>

      {/* Sous-onglets */}
      <div className="flex gap-1 border-b overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        {SUB_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm whitespace-nowrap transition-colors ${tab === t.key
              ? 'text-indigo-700 dark:text-indigo-400 font-semibold border-b-2 border-indigo-500'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'registre' && (
        <RegistreTab
          parties={parties} loaded={loaded} readOnly={readOnly}
          onNew={() => setForm({ ...EMPTY_FORM })}
          onPreset={(preset) => setForm({ ...preset })}
          onEdit={(p) => setForm(formFromPartie(p))}
          onDelete={deletePartie}
          onImport={openImport}
          onRattacher={() => setRattacher(true)}
        />
      )}

      {rattacher && !readOnly && (
        <ModaleRattachement
          projetId={projetId} organisationId={organisationId}
          dejaRattaches={parties.map(p => p.id)}
          onClose={() => setRattacher(false)}
          onFait={() => { setRattacher(false); void loadParties() }}
          onError={setError} />
      )}

      {tab === 'matrice' && (
        <MatriceTab parties={parties} readOnly={readOnly} onMove={(id, pouvoir, interet) => patchPartie(id, { pouvoir, interet })} />
      )}

      {tab === 'salience' && (
        <SalienceTab parties={parties} loaded={loaded} onOpen={(p) => setForm(formFromPartie(p))} />
      )}

      {tab === 'engagement' && (
        <EngagementTab parties={parties} loaded={loaded} readOnly={readOnly}
          onSet={(id, champs) => patchPartie(id, champs)} />
      )}

      {tab === 'plan' && (
        <PlanTab
          parties={parties} engagements={engagements} readOnly={readOnly}
          filterPartie={filterPartie} setFilterPartie={setFilterPartie}
          newEng={newEng} setNewEng={setNewEng} savingEng={savingEng}
          onAdd={addEngagement} onCycle={cycleEngagement} onDelete={deleteEngagement}
          onMode={setEngagementMode}
          partieById={partieById}
        />
      )}

      {/* Fiche d'édition */}
      {form && (
        <FicheModal form={form} setForm={setForm} saving={saving} onSave={savePartie} onClose={() => setForm(null)} />
      )}

      {/* Import */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowImport(false)}>
          <div className="w-full max-w-lg rounded-xl border shadow-xl p-5 space-y-4"
            style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}
            onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-indigo-700 dark:text-indigo-300">Importer depuis « Parties Prenantes & Matérialité »</h3>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Sélectionnez une session : ses parties prenantes identifiées seront ajoutées au registre du projet.
            </p>
            {importInfo && (
              <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-2 text-sm text-green-700 dark:text-green-400">
                ✓ {importInfo}
              </div>
            )}
            {sessions === null ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Chargement des sessions…</p>
            ) : sessions.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucune session trouvée dans l’app Parties Prenantes & Matérialité.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto divide-y" style={{ borderColor: 'var(--border)' }}>
                {sessions.map(s => (
                  <div key={s.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{s.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {[s.organisation, s.exercice].filter(Boolean).join(' · ')} · {s.pp_count} PP identifiée{s.pp_count > 1 ? 's' : ''}
                      </p>
                    </div>
                    <button onClick={() => runImport(s.id)} disabled={importing}
                      className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50">
                      {importing ? 'Import…' : 'Importer'}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={() => setShowImport(false)}
                className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Onglet Registre ───────────────────────────────────────────────────────────

/**
 * Rattacher une partie prenante déjà inscrite au registre de l'organisation.
 *
 * C'est le geste normal : on ne recrée pas une partie prenante existante, on la
 * référence. Le rôle local est demandé parce que c'est lui qui distingue un
 * rattachement utile d'une liste recopiée.
 */
function ModaleRattachement({ projetId, organisationId, dejaRattaches, onClose, onFait, onError }: {
  projetId: string
  organisationId: string
  dejaRattaches: string[]
  onClose: () => void
  onFait: () => void
  onError: (m: string) => void
}) {
  const [candidats, setCandidats] = useState<{ id: string; nom: string; organisation: string | null; role: string | null }[]>([])
  const [charge, setCharge] = useState(false)
  const [q, setQ] = useState('')
  const [choisi, setChoisi] = useState<string | null>(null)
  const [roleLocal, setRoleLocal] = useState('')
  const [criticite, setCriticite] = useState('concernee')
  const [enCours, setEnCours] = useState(false)

  useEffect(() => {
    let vivant = true
    ;(async () => {
      try {
        const r = await fetch(`/api/projet-rse/acteurs?organisation_id=${organisationId}`)
        const j = await r.json()
        if (!r.ok) throw new Error(j.error ?? 'Registre inaccessible')
        if (vivant) setCandidats((j.acteurs ?? []).filter(
          (a: { id: string; actif: boolean }) => a.actif && !dejaRattaches.includes(a.id)))
      } catch (e) { onError(e instanceof Error ? e.message : String(e)) }
      finally { if (vivant) setCharge(true) }
    })()
    return () => { vivant = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId])

  const visibles = candidats.filter(a => {
    const t = q.trim().toLowerCase()
    return !t || [a.nom, a.organisation, a.role].some(v => (v ?? '').toLowerCase().includes(t))
  })

  const poser = async () => {
    if (!choisi) return
    setEnCours(true)
    try {
      const r = await fetch('/api/projet-rse/acteurs/liens', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acteur_id: choisi, projet_id: projetId,
          role_local: roleLocal.trim() || null, criticite }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? 'Rattachement impossible')
      onFait()
    } catch (e) { onError(e instanceof Error ? e.message : String(e)) }
    finally { setEnCours(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border p-5 shadow-xl"
        style={{ borderColor: 'var(--border)', background: 'var(--card-bg)' }}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Rattacher depuis le registre</h3>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          Le registre est tenu au niveau de l’organisation. Rattacher plutôt que recréer, c’est ce qui
          permet à une modification de valoir partout.
        </p>

        <input value={q} onChange={e => setQ(e.target.value)} autoFocus
          placeholder="Rechercher dans le registre…"
          className="mt-4 w-full rounded-md border px-2.5 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          style={{ borderColor: 'var(--border)' }} />

        <div className="mt-2 max-h-52 overflow-y-auto rounded-md border" style={{ borderColor: 'var(--border)' }}>
          {!charge ? (
            <p className="p-3 text-sm" style={{ color: 'var(--text-muted)' }}>Chargement…</p>
          ) : visibles.length === 0 ? (
            <p className="p-3 text-sm" style={{ color: 'var(--text-muted)' }}>
              Aucune partie prenante disponible. Toutes celles du registre sont déjà rattachées à ce projet.
            </p>
          ) : visibles.map(a => (
            <button key={a.id} onClick={() => setChoisi(a.id)}
              className={`block w-full text-left px-3 py-2 text-sm border-b last:border-b-0 transition-colors ${
                choisi === a.id ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              style={{ borderColor: 'var(--border)' }}>
              <span className="font-medium text-gray-900 dark:text-white">{a.nom}</span>
              {a.organisation && <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>{a.organisation}</span>}
            </button>
          ))}
        </div>

        <div className="mt-3">
          <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">
            Rôle sur ce projet
          </label>
          <textarea rows={2} value={roleLocal} onChange={e => setRoleLocal(e.target.value)}
            placeholder="Pourquoi cette partie prenante est-elle concernée par ce projet précis ?"
            className="w-full rounded-md border px-2.5 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            style={{ borderColor: 'var(--border)' }} />
        </div>
        <div className="mt-2">
          <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Criticité</label>
          <select value={criticite} onChange={e => setCriticite(e.target.value)}
            className="w-full rounded-md border px-2.5 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            style={{ borderColor: 'var(--border)' }}>
            <option value="cle">Clé — le projet dépend d’elle</option>
            <option value="concernee">Concernée</option>
            <option value="informee">Informée</option>
          </select>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)' }}>Annuler</button>
          <button onClick={poser} disabled={enCours || !choisi}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
            {enCours ? 'Rattachement…' : 'Rattacher'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RegistreTab({ parties, loaded, readOnly, onNew, onPreset, onEdit, onDelete, onImport, onRattacher }: {
  parties: Partie[]
  loaded: boolean
  readOnly: boolean
  onNew: () => void
  onPreset: (preset: PartieForm) => void
  onEdit: (p: Partie) => void
  onDelete: (id: string) => void
  onImport: () => void
  onRattacher: () => void
}) {
  return (
    <div className="space-y-4">
      {/* Aide : les catégories du cours */}
      <div className="rounded-xl border p-4 space-y-2" style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-bold text-teal-700 dark:text-teal-300">Les trois catégories du cours</h3>
        <div className="grid gap-2 sm:grid-cols-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          <p><span className="font-semibold text-gray-800 dark:text-gray-200">🟢 Opérationnel quotidien</span> — équipe, métiers, fournisseurs directs : ceux qui font le projet au jour le jour.</p>
          <p><span className="font-semibold text-gray-800 dark:text-gray-200">🟠 Gouvernance</span> — sponsor, direction, financeurs : ceux qui décident, arbitrent et valident.</p>
          <p><span className="font-semibold text-gray-800 dark:text-gray-200">🔵 Externe critique</span> — clients, riverains, régulateurs… et, particularité de la méthode, <span className="font-semibold text-gray-800 dark:text-gray-200">« la société » et « la Terre »</span> sont des parties prenantes à part entière, même silencieuses.</p>
        </div>
      </div>

      {/* Barre d'actions */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={onNew}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
            + Ajouter une partie prenante
          </button>
          <button onClick={() => onPreset(PRESET_TERRE)}
            className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors">
            🌍 + Ajouter la Terre
          </button>
          <button onClick={() => onPreset(PRESET_SOCIETE)}
            className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors">
            🏘️ + Ajouter la société
          </button>
          <button onClick={onRattacher}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-indigo-400 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
            ↳ Rattacher depuis le registre
          </button>
          <button onClick={onImport}
            className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors">
            📥 Importer depuis Parties Prenantes & Matérialité
          </button>
        </div>
      )}

      {/* Tableau */}
      {!loaded ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Chargement…</p>
      ) : parties.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          Aucune partie prenante pour l’instant. Ajoutez-en une, ou commencez par « la Terre » et « la société ».
        </div>
      ) : (
        <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                <th className="px-3 py-2">Nom</th>
                <th className="px-3 py-2">Organisation</th>
                <th className="px-3 py-2">Catégorie</th>
                <th className="px-3 py-2">Rôle</th>
                <th className="px-3 py-2 text-center">Pouvoir</th>
                <th className="px-3 py-2 text-center">Intérêt</th>
                <th className="px-3 py-2">Attitude</th>
                <th className="px-3 py-2">Suivi</th>
                {!readOnly && <th className="px-3 py-2 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {parties.map(p => {
                const cat = catOf(p.categorie); const att = attOf(p.attitude); const sui = suiviOf(p.statut_suivi)
                return (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                    onClick={() => onEdit(p)}>
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{p.nom}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{p.organisation ?? '—'}</td>
                    <td className="px-3 py-2"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cat.badge}`}>{cat.label}</span></td>
                    <td className="px-3 py-2 max-w-[16rem] truncate" style={{ color: 'var(--text-muted)' }}>{p.role ?? '—'}</td>
                    <td className="px-3 py-2 text-center text-gray-900 dark:text-white">{p.pouvoir}</td>
                    <td className="px-3 py-2 text-center text-gray-900 dark:text-white">{p.interet}</td>
                    <td className="px-3 py-2"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${att.badge}`}>{att.label}</span></td>
                    <td className="px-3 py-2"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${sui.badge}`}>{sui.label}</span></td>
                    {!readOnly && (
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button onClick={e => { e.stopPropagation(); onEdit(p) }}
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mr-3">Modifier</button>
                        <button onClick={e => { e.stopPropagation(); onDelete(p.id) }}
                          className="text-xs text-red-600 dark:text-red-400 hover:underline">Supprimer</button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Fiche modale ──────────────────────────────────────────────────────────────

function FicheModal({ form, setForm, saving, onSave, onClose }: {
  form: PartieForm
  setForm: (f: PartieForm | null) => void
  saving: boolean
  onSave: () => void
  onClose: () => void
}) {
  const set = (patch: Partial<PartieForm>) => setForm({ ...form, ...patch })
  const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500'
  const labelCls = 'block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border shadow-xl p-5 space-y-4"
        style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold text-indigo-700 dark:text-indigo-300">
          {form.id ? 'Modifier la partie prenante' : 'Nouvelle partie prenante'}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Nom *</label>
            <input className={inputCls} style={{ borderColor: 'var(--border)' }} value={form.nom} onChange={e => set({ nom: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Organisation</label>
            <input className={inputCls} style={{ borderColor: 'var(--border)' }} value={form.organisation} onChange={e => set({ organisation: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Catégorie</label>
            <select className={inputCls} style={{ borderColor: 'var(--border)' }} value={form.categorie} onChange={e => set({ categorie: e.target.value as Categorie })}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Rôle dans le projet</label>
            <input className={inputCls} style={{ borderColor: 'var(--border)' }} value={form.role} onChange={e => set({ role: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Pouvoir : {form.pouvoir}/5</label>
            <input type="range" min={1} max={5} step={1} className="w-full accent-indigo-600" value={form.pouvoir} onChange={e => set({ pouvoir: Number(e.target.value) })} />
          </div>
          <div>
            <label className={labelCls}>Intérêt : {form.interet}/5</label>
            <input type="range" min={1} max={5} step={1} className="w-full accent-indigo-600" value={form.interet} onChange={e => set({ interet: Number(e.target.value) })} />
          </div>
          <div>
            <label className={labelCls}>Légitimité : {form.legitimite}/5</label>
            <input type="range" min={1} max={5} step={1} className="w-full accent-teal-600" value={form.legitimite} onChange={e => set({ legitimite: Number(e.target.value) })} />
          </div>
          <div>
            <label className={labelCls}>Urgence : {form.urgence}/5</label>
            <input type="range" min={1} max={5} step={1} className="w-full accent-amber-600" value={form.urgence} onChange={e => set({ urgence: Number(e.target.value) })} />
          </div>
          {/* Groupe de salience calculé en direct (Mitchell, Agle & Wood) */}
          {(() => {
            const s = SALIENCE[salienceOf(form.pouvoir, form.legitimite, form.urgence)]
            return (
              <div className="sm:col-span-2 rounded-lg border px-3 py-2 flex flex-wrap items-center gap-2 text-xs" style={{ borderColor: 'var(--border)' }}>
                <span className="font-semibold text-gray-700 dark:text-gray-300">Salience :</span>
                <span className={`inline-block px-2 py-0.5 rounded-full font-medium ${s.badge}`}>{s.label}</span>
                <span style={{ color: 'var(--text-muted)' }}>({s.attrs} — attribut « présent » si &gt; 3)</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">→ {s.strategie}</span>
              </div>
            )
          })()}
          <div>
            <label className={labelCls}>Engagement actuel (C)</label>
            <select className={inputCls} style={{ borderColor: 'var(--border)' }} value={form.engagement_actuel} onChange={e => set({ engagement_actuel: e.target.value as NiveauEngagement })}>
              {NIVEAUX_ENGAGEMENT.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Engagement souhaité (D)</label>
            <select className={inputCls} style={{ borderColor: 'var(--border)' }} value={form.engagement_souhaite} onChange={e => set({ engagement_souhaite: e.target.value as NiveauEngagement })}>
              {NIVEAUX_ENGAGEMENT.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Attitude</label>
            <select className={inputCls} style={{ borderColor: 'var(--border)' }} value={form.attitude} onChange={e => set({ attitude: e.target.value as Attitude })}>
              {ATTITUDES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Statut de suivi</label>
            <select className={inputCls} style={{ borderColor: 'var(--border)' }} value={form.statut_suivi} onChange={e => set({ statut_suivi: e.target.value as StatutSuivi })}>
              {STATUTS_SUIVI.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Attentes vis-à-vis du projet</label>
            <textarea rows={2} className={inputCls} style={{ borderColor: 'var(--border)' }} value={form.attentes} onChange={e => set({ attentes: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Verbatims (paroles entendues, telles quelles)</label>
            <textarea rows={2} className={inputCls} style={{ borderColor: 'var(--border)' }} value={form.verbatims} onChange={e => set({ verbatims: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Stratégie d’engagement <span className="font-normal" style={{ color: 'var(--text-muted)' }}>(suggestion selon la matrice : {quadrantStrategie(form.pouvoir, form.interet)})</span></label>
            <textarea rows={2} className={inputCls} style={{ borderColor: 'var(--border)' }} value={form.strategie} onChange={e => set({ strategie: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors">
            Annuler
          </button>
          <button onClick={onSave} disabled={saving || !form.nom.trim()}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50">
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Onglet Matrice ────────────────────────────────────────────────────────────

// Géométrie du SVG (viewBox fixe, responsive via width 100%)
const M = { w: 640, h: 520, left: 56, right: 16, top: 40, bottom: 56 }
const PLOT_W = M.w - M.left - M.right
const PLOT_H = M.h - M.top - M.bottom

function xOf(interet: number) { return M.left + ((interet - 1) / 4) * PLOT_W }
function yOf(pouvoir: number) { return M.top + PLOT_H - ((pouvoir - 1) / 4) * PLOT_H }

function MatriceTab({ parties, readOnly, onMove }: {
  parties: Partie[]
  readOnly: boolean
  onMove: (id: string, pouvoir: number, interet: number) => void
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [drag, setDrag] = useState<{ id: string; pouvoir: number; interet: number } | null>(null)
  const dragRef = useRef<typeof drag>(null)
  dragRef.current = drag

  // Convertit un événement pointeur en valeurs (pouvoir, intérêt) continues 1-5
  const toValues = useCallback((e: React.PointerEvent) => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * M.w
    const py = ((e.clientY - rect.top) / rect.height) * M.h
    const interet = Math.min(5, Math.max(1, 1 + ((px - M.left) / PLOT_W) * 4))
    const pouvoir = Math.min(5, Math.max(1, 1 + ((M.top + PLOT_H - py) / PLOT_H) * 4))
    return { pouvoir, interet }
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return
    const v = toValues(e)
    if (v) setDrag({ id: dragRef.current.id, ...v })
  }, [toValues])

  const onPointerUp = useCallback(() => {
    const d = dragRef.current
    if (d) {
      const pouvoir = Math.round(d.pouvoir)
      const interet = Math.round(d.interet)
      const p = parties.find(x => x.id === d.id)
      if (p && (p.pouvoir !== pouvoir || p.interet !== interet)) onMove(d.id, pouvoir, interet)
    }
    setDrag(null)
  }, [parties, onMove])

  // Décale légèrement les points superposés pour qu'ils restent tous visibles
  const seen = new Map<string, number>()
  const positioned = parties.map(p => {
    const isDragged = drag?.id === p.id
    const pv = isDragged ? drag!.pouvoir : p.pouvoir
    const it = isDragged ? drag!.interet : p.interet
    const key = `${p.pouvoir}-${p.interet}`
    const n = seen.get(key) ?? 0
    seen.set(key, n + 1)
    const jitter = isDragged ? 0 : n * 10
    return { p, cx: xOf(it) + jitter, cy: yOf(pv) - (isDragged ? 0 : (n % 2) * 8), isDragged }
  })

  const gridColor = 'var(--border)'
  const midX = xOf(3); const midY = yOf(3)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-4" style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-bold text-teal-700 dark:text-teal-300 mb-1">Matrice Pouvoir × Intérêt</h3>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          {readOnly
            ? 'Lecture seule : les points reflètent le pouvoir et l’intérêt de chaque partie prenante.'
            : 'Faites glisser un point pour réévaluer le pouvoir et l’intérêt d’une partie prenante (enregistrement automatique).'}
        </p>
        <svg ref={svgRef} viewBox={`0 0 ${M.w} ${M.h}`} className="w-full select-none" style={{ touchAction: 'none' }}
          onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
          {/* Quadrants */}
          <rect x={midX} y={M.top} width={M.left + PLOT_W - midX} height={midY - M.top} fill="#6366f1" opacity={0.10} />
          <rect x={M.left} y={M.top} width={midX - M.left} height={midY - M.top} fill="#6366f1" opacity={0.05} />
          <rect x={midX} y={midY} width={M.left + PLOT_W - midX} height={M.top + PLOT_H - midY} fill="#6366f1" opacity={0.05} />

          {/* Grille 1-5 */}
          {[1, 2, 3, 4, 5].map(v => (
            <g key={v}>
              <line x1={xOf(v)} y1={M.top} x2={xOf(v)} y2={M.top + PLOT_H} stroke={gridColor} strokeWidth={v === 3 ? 2 : 1} strokeDasharray={v === 3 ? undefined : '3 3'} />
              <line x1={M.left} y1={yOf(v)} x2={M.left + PLOT_W} y2={yOf(v)} stroke={gridColor} strokeWidth={v === 3 ? 2 : 1} strokeDasharray={v === 3 ? undefined : '3 3'} />
              <text x={xOf(v)} y={M.top + PLOT_H + 18} textAnchor="middle" fontSize={11} fill="var(--text-muted)">{v}</text>
              <text x={M.left - 12} y={yOf(v) + 4} textAnchor="end" fontSize={11} fill="var(--text-muted)">{v}</text>
            </g>
          ))}

          {/* Axes */}
          <text x={M.left + PLOT_W / 2} y={M.h - 14} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--text-muted)">Intérêt →</text>
          <text x={16} y={M.top + PLOT_H / 2} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--text-muted)"
            transform={`rotate(-90 16 ${M.top + PLOT_H / 2})`}>Pouvoir →</text>

          {/* Libellés de stratégie par quadrant */}
          <text x={(M.left + midX) / 2} y={M.top + 18} textAnchor="middle" fontSize={12} fontWeight={700} fill="#6366f1">Garder satisfait</text>
          <text x={(midX + M.left + PLOT_W) / 2} y={M.top + 18} textAnchor="middle" fontSize={12} fontWeight={700} fill="#6366f1">Engager pleinement</text>
          <text x={(M.left + midX) / 2} y={M.top + PLOT_H - 8} textAnchor="middle" fontSize={12} fontWeight={700} fill="#6366f1">Information minimale</text>
          <text x={(midX + M.left + PLOT_W) / 2} y={M.top + PLOT_H - 8} textAnchor="middle" fontSize={12} fontWeight={700} fill="#6366f1">Tenir informé</text>

          {/* Points */}
          {positioned.map(({ p, cx, cy, isDragged }) => {
            const cat = catOf(p.categorie); const att = attOf(p.attitude)
            return (
              <g key={p.id} style={{ cursor: readOnly ? 'default' : 'grab' }}
                onPointerDown={readOnly ? undefined : (e) => {
                  e.preventDefault();
                  (e.currentTarget.ownerSVGElement)?.setPointerCapture?.(e.pointerId)
                  setDrag({ id: p.id, pouvoir: p.pouvoir, interet: p.interet })
                }}>
                <circle cx={cx} cy={cy} r={isDragged ? 13 : 10} fill={cat.dot} fillOpacity={0.9}
                  stroke={att.ring} strokeWidth={3} strokeDasharray={att.dash} />
                <text x={cx} y={cy - (isDragged ? 18 : 15)} textAnchor="middle" fontSize={11} fontWeight={600}
                  fill="var(--text-muted)">{p.nom.length > 22 ? p.nom.slice(0, 22) + '…' : p.nom}</text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Légende */}
      <div className="grid gap-3 sm:grid-cols-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        <div className="rounded-xl border p-3 space-y-1.5" style={{ borderColor: 'var(--border)' }}>
          <p className="font-semibold text-gray-800 dark:text-gray-200">Couleur du point = catégorie</p>
          {CATEGORIES.map(c => (
            <p key={c.value} className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: c.dot }} /> {c.label}
            </p>
          ))}
        </div>
        <div className="rounded-xl border p-3 space-y-1.5" style={{ borderColor: 'var(--border)' }}>
          <p className="font-semibold text-gray-800 dark:text-gray-200">Liseré du point = attitude</p>
          {ATTITUDES.map(a => (
            <p key={a.value} className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 14 14">
                <circle cx="7" cy="7" r="5" fill="none" stroke={a.ring} strokeWidth="2.5" strokeDasharray={a.dash} />
              </svg>
              {a.label}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Onglet Plan d'engagement ──────────────────────────────────────────────────

function PlanTab({ parties, engagements, readOnly, filterPartie, setFilterPartie, newEng, setNewEng, savingEng, onAdd, onCycle, onDelete, onMode, partieById }: {
  parties: Partie[]
  engagements: Engagement[]
  readOnly: boolean
  filterPartie: string
  setFilterPartie: (id: string) => void
  newEng: { partie_id: string; action: string; responsable: string; canal: string; frequence: string; echeance: string; mode: string }
  setNewEng: (v: { partie_id: string; action: string; responsable: string; canal: string; frequence: string; echeance: string; mode: string }) => void
  savingEng: boolean
  onAdd: () => void
  onCycle: (e: Engagement) => void
  onDelete: (id: string) => void
  onMode: (id: string, mode: ModeCom | null) => void
  partieById: (id: string) => Partie | undefined
}) {
  const visible = engagements
    .filter(e => !filterPartie || e.partie_id === filterPartie)
    .slice()
    .sort((a, b) => {
      if (!a.echeance && !b.echeance) return 0
      if (!a.echeance) return 1
      if (!b.echeance) return -1
      return a.echeance.localeCompare(b.echeance)
    })

  const inputCls = 'px-2 py-1.5 text-xs rounded-lg border bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <div className="space-y-4">
      {/* Bandeau conseil Fair Process */}
      <div className="rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 px-4 py-3 text-sm text-teal-800 dark:text-teal-300">
        💡 <span className="font-semibold">Fair Process</span> : impliquer les parties prenantes en amont, expliquer la décision prise, clarifier les attentes qui en découlent.
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Partie prenante :</label>
        <select className={inputCls} style={{ borderColor: 'var(--border)' }} value={filterPartie} onChange={e => setFilterPartie(e.target.value)}>
          <option value="">Toutes</option>
          {parties.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
        </select>
      </div>

      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              <th className="px-3 py-2">Partie prenante</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Responsable</th>
              <th className="px-3 py-2">Canal</th>
              <th className="px-3 py-2">
                <span title={MODES_TOOLTIP} className="cursor-help underline decoration-dotted underline-offset-2">Mode</span>
              </th>
              <th className="px-3 py-2">Fréquence</th>
              <th className="px-3 py-2">Échéance</th>
              <th className="px-3 py-2">Statut</th>
              {!readOnly && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {visible.map(e => {
              const st = STATUTS_ENGAGEMENT[e.statut]
              return (
                <tr key={e.id}>
                  <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{partieById(e.partie_id)?.nom ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-900 dark:text-white">{e.action}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{e.responsable ?? '—'}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{e.canal ?? '—'}</td>
                  <td className="px-3 py-2">
                    {readOnly ? (
                      <span style={{ color: 'var(--text-muted)' }}>{MODES_COM.find(m => m.value === e.mode)?.label ?? '—'}</span>
                    ) : (
                      <select className={inputCls} style={{ borderColor: 'var(--border)' }} title={MODES_TOOLTIP}
                        value={e.mode ?? ''} onChange={ev => onMode(e.id, (ev.target.value || null) as ModeCom | null)}>
                        <option value="">—</option>
                        {MODES_COM.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{e.frequence ?? '—'}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{formatDateFr(e.echeance)}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => !readOnly && onCycle(e)} disabled={readOnly}
                      title={readOnly ? undefined : 'Cliquer pour faire avancer le statut'}
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium transition-opacity ${st.badge} ${readOnly ? 'cursor-default' : 'hover:opacity-75'}`}>
                      {st.label}
                    </button>
                  </td>
                  {!readOnly && (
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => onDelete(e.id)} className="text-xs text-red-600 dark:text-red-400 hover:underline">Supprimer</button>
                    </td>
                  )}
                </tr>
              )
            })}
            {visible.length === 0 && (
              <tr><td colSpan={readOnly ? 8 : 9} className="px-3 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                Aucune action d’engagement pour l’instant.
              </td></tr>
            )}
            {/* Ajout inline */}
            {!readOnly && (
              <tr>
                <td className="px-3 py-2">
                  {filterPartie ? (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{partieById(filterPartie)?.nom}</span>
                  ) : (
                    <select className={inputCls} style={{ borderColor: 'var(--border)' }} value={newEng.partie_id}
                      onChange={e => setNewEng({ ...newEng, partie_id: e.target.value })}>
                      <option value="">Choisir…</option>
                      {parties.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                    </select>
                  )}
                </td>
                <td className="px-3 py-2">
                  <input className={`${inputCls} w-full`} style={{ borderColor: 'var(--border)' }} placeholder="Nouvelle action…"
                    value={newEng.action} onChange={e => setNewEng({ ...newEng, action: e.target.value })} />
                </td>
                <td className="px-3 py-2">
                  <input className={`${inputCls} w-24`} style={{ borderColor: 'var(--border)' }} placeholder="Qui ?"
                    value={newEng.responsable} onChange={e => setNewEng({ ...newEng, responsable: e.target.value })} />
                </td>
                <td className="px-3 py-2">
                  <input className={`${inputCls} w-24`} style={{ borderColor: 'var(--border)' }} placeholder="Canal"
                    value={newEng.canal} onChange={e => setNewEng({ ...newEng, canal: e.target.value })} />
                </td>
                <td className="px-3 py-2">
                  <select className={inputCls} style={{ borderColor: 'var(--border)' }} title={MODES_TOOLTIP}
                    value={newEng.mode} onChange={e => setNewEng({ ...newEng, mode: e.target.value })}>
                    <option value="">Mode…</option>
                    {MODES_COM.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input className={`${inputCls} w-24`} style={{ borderColor: 'var(--border)' }} placeholder="Fréquence"
                    value={newEng.frequence} onChange={e => setNewEng({ ...newEng, frequence: e.target.value })} />
                </td>
                <td className="px-3 py-2">
                  <input type="date" className={inputCls} style={{ borderColor: 'var(--border)' }}
                    value={newEng.echeance} onChange={e => setNewEng({ ...newEng, echeance: e.target.value })} />
                </td>
                <td className="px-3 py-2" colSpan={2}>
                  <button onClick={onAdd} disabled={savingEng || !newEng.action.trim() || !(filterPartie || newEng.partie_id)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50">
                    {savingEng ? 'Ajout…' : '+ Ajouter'}
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Onglet Salience (Mitchell, Agle & Wood, 1997) ─────────────────────────────

// Géométrie du Venn : trois cercles de rayon égal aux sommets d'un triangle
// isocèle — Pouvoir en haut à gauche, Légitimité en haut à droite, Urgence en
// bas au centre. Chaque zone (7 intersections + extérieur) a un point d'ancrage
// vérifié géométriquement ; les pastilles s'y rangent en petite grille.
const V = { w: 640, h: 560, r: 155 }
const VC = {
  P: { x: 230, y: 205 },
  L: { x: 410, y: 205 },
  U: { x: 320, y: 365 },
}
const V_ANCHORS: Record<SalienceKey, { x: number; y: number }> = {
  dormants: { x: 140, y: 140 },
  discretionnaires: { x: 500, y: 140 },
  demandeurs: { x: 320, y: 458 },
  dominants: { x: 320, y: 152 },
  dangereux: { x: 213, y: 322 },
  dependants: { x: 427, y: 322 },
  definitifs: { x: 320, y: 262 },
  hors: { x: 80, y: 468 },
}
// Petits décalages en grille autour de l'ancre (restent dans la zone)
const V_OFFSETS: [number, number][] = [
  [0, 0], [28, 0], [-28, 0], [0, 28], [28, 28], [-28, 28], [0, -26], [28, -26], [-28, -26],
  [56, 0], [-56, 0], [56, 28], [-56, 28],
]

const SALIENCE_ORDER: SalienceKey[] = ['definitifs', 'dominants', 'dangereux', 'dependants', 'dormants', 'discretionnaires', 'demandeurs', 'hors']

function SalienceTab({ parties, loaded, onOpen }: {
  parties: Partie[]
  loaded: boolean
  onOpen: (p: Partie) => void
}) {
  const groupes = new Map<SalienceKey, Partie[]>()
  for (const k of SALIENCE_ORDER) groupes.set(k, [])
  for (const p of parties) groupes.get(salienceOf(p.pouvoir, p.legitimite ?? 3, p.urgence ?? 1))!.push(p)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-4" style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-bold text-teal-700 dark:text-teal-300 mb-1">Modèle de salience (Mitchell, Agle &amp; Wood, 1997)</h3>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          Trois attributs — Pouvoir, Légitimité, Urgence — sont « présents » quand leur note dépasse 3.
          Leur croisement définit 7 groupes ; <span className="font-medium text-gray-800 dark:text-gray-200">l’effort d’engagement est inversement proportionnel à la prépondérance</span>.
          Cliquez sur une pastille pour ouvrir la fiche.
        </p>

        {!loaded ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Chargement…</p>
        ) : (
          <svg viewBox={`0 0 ${V.w} ${V.h}`} className="w-full select-none">
            {/* Zone extérieure */}
            <rect x={4} y={4} width={V.w - 8} height={V.h - 8} rx={12} fill="#9ca3af" opacity={0.06} />
            {/* Les 3 cercles ; leurs superpositions teintent naturellement les 7 zones */}
            <circle cx={VC.P.x} cy={VC.P.y} r={V.r} fill="#6366f1" opacity={0.12} stroke="#6366f1" strokeWidth={1.5} strokeOpacity={0.6} />
            <circle cx={VC.L.x} cy={VC.L.y} r={V.r} fill="#0d9488" opacity={0.12} stroke="#0d9488" strokeWidth={1.5} strokeOpacity={0.6} />
            <circle cx={VC.U.x} cy={VC.U.y} r={V.r} fill="#f59e0b" opacity={0.12} stroke="#f59e0b" strokeWidth={1.5} strokeOpacity={0.6} />

            {/* Titres des attributs */}
            <text x={128} y={40} textAnchor="middle" fontSize={14} fontWeight={700} fill="#6366f1">Pouvoir</text>
            <text x={512} y={40} textAnchor="middle" fontSize={14} fontWeight={700} fill="#0d9488">Légitimité</text>
            <text x={320} y={548} textAnchor="middle" fontSize={14} fontWeight={700} fill="#f59e0b">Urgence</text>

            {/* Noms des zones */}
            <text x={140} y={102} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--text-muted)">Dormants</text>
            <text x={500} y={102} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--text-muted)">Discrétionnaires</text>
            <text x={320} y={500} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--text-muted)">Demandeurs</text>
            <text x={320} y={118} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--text-muted)">Dominants</text>
            <text x={188} y={288} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--text-muted)">Dangereux</text>
            <text x={452} y={288} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--text-muted)">Dépendants</text>
            <text x={320} y={230} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--text-muted)">Définitifs</text>
            <text x={80} y={432} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--text-muted)">Hors périmètre</text>
            <text x={80} y={445} textAnchor="middle" fontSize={9} fill="var(--text-muted)">(à surveiller)</text>

            {/* Pastilles des parties prenantes */}
            {SALIENCE_ORDER.map(k => {
              const anchor = V_ANCHORS[k]
              const s = SALIENCE[k]
              return groupes.get(k)!.map((p, i) => {
                const [dx, dy] = V_OFFSETS[i % V_OFFSETS.length]
                const cx = anchor.x + dx, cy = anchor.y + dy
                return (
                  <g key={p.id} style={{ cursor: 'pointer' }} onClick={() => onOpen(p)}>
                    <title>{`${p.nom} — Pouvoir ${p.pouvoir}/5 · Légitimité ${p.legitimite ?? 3}/5 · Urgence ${p.urgence ?? 1}/5 → ${s.label} : ${s.strategie}`}</title>
                    <circle cx={cx} cy={cy} r={13} fill={s.fill} fillOpacity={0.9} stroke="var(--card-bg)" strokeWidth={2} />
                    <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill="#ffffff">{initialesDe(p.nom)}</text>
                  </g>
                )
              })
            })}
          </svg>
        )}
      </div>

      {/* Légende des 7 groupes et stratégies du cours */}
      <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-2">Les 7 groupes et leurs stratégies</p>
        <div className="grid gap-1.5 sm:grid-cols-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          {SALIENCE_ORDER.map(k => {
            const s = SALIENCE[k]
            return (
              <p key={k} className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ background: s.fill }} />
                <span><span className="font-semibold text-gray-800 dark:text-gray-200">{s.label}</span> ({s.attrs}) → {s.strategie}</span>
              </p>
            )
          })}
        </div>
      </div>

      {/* Récapitulatif trié par prépondérance décroissante */}
      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              <th className="px-3 py-2">Groupe</th>
              <th className="px-3 py-2">Parties prenantes</th>
              <th className="px-3 py-2">Stratégie du cours</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {SALIENCE_ORDER.map(k => {
              const s = SALIENCE[k]
              const membres = groupes.get(k)!
              return (
                <tr key={k}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${s.badge}`}>{s.label}</span>
                  </td>
                  <td className="px-3 py-2">
                    {membres.length === 0
                      ? <span style={{ color: 'var(--text-muted)' }}>—</span>
                      : membres.map((p, i) => (
                        <span key={p.id}>
                          {i > 0 && <span style={{ color: 'var(--text-muted)' }}> · </span>}
                          <button onClick={() => onOpen(p)} className="text-indigo-600 dark:text-indigo-400 hover:underline">{p.nom}</button>
                        </span>
                      ))}
                  </td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{s.strategie}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Onglet Engagement (matrice d'évaluation de l'engagement) ─────────────────

function EngagementTab({ parties, loaded, readOnly, onSet }: {
  parties: Partie[]
  loaded: boolean
  readOnly: boolean
  onSet: (id: string, champs: Partial<Partie>) => void
}) {
  const [placer, setPlacer] = useState<'C' | 'D'>('C')

  // Écart global : somme des niveaux à gagner (D au-delà de C)
  let ecartTotal = 0, alignees = 0, regressions = 0
  for (const p of parties) {
    const d = niveauIndex(p.engagement_souhaite ?? 'solidaire') - niveauIndex(p.engagement_actuel ?? 'peu_conscient')
    if (d > 0) ecartTotal += d
    else if (d === 0) alignees += 1
    else regressions += 1
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-4" style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-bold text-teal-700 dark:text-teal-300 mb-1">Matrice d’évaluation de l’engagement</h3>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          <span className="font-semibold">C</span> = situation actuelle (cercle plein) · <span className="font-semibold">D</span> = situation désirée (cercle creux).
          {' '}L’écart entre situation actuelle et désirée dimensionne l’effort d’engagement.
        </p>

        {/* Bascule du mode de placement + compteur */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          {!readOnly && (
            <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setPlacer('C')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${placer === 'C'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                Placer C (actuel)
              </button>
              <button onClick={() => setPlacer('D')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${placer === 'D'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                Placer D (désiré)
              </button>
            </div>
          )}
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Écart global : <span className="font-semibold text-gray-800 dark:text-gray-200">{ecartTotal} niveau{ecartTotal > 1 ? 'x' : ''} à gagner</span>
            {' '}· {alignees} partie{alignees > 1 ? 's' : ''} à l’objectif{regressions > 0 ? ` · ${regressions} au-delà de l’attendu` : ''}
          </span>
        </div>

        {!loaded ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Chargement…</p>
        ) : parties.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            Ajoutez des parties prenantes dans le registre pour renseigner la matrice.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[40rem]">
              {/* En-tête des 5 niveaux */}
              <div className="flex items-center border-b pb-1 mb-1" style={{ borderColor: 'var(--border)' }}>
                <div className="w-44 shrink-0" />
                <div className="flex-1 grid grid-cols-5">
                  {NIVEAUX_ENGAGEMENT.map(n => (
                    <div key={n.value} className="text-center text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{n.label}</div>
                  ))}
                </div>
              </div>
              {/* Une ligne par partie prenante */}
              {parties.map(p => {
                const c = niveauIndex(p.engagement_actuel ?? 'peu_conscient')
                const d = niveauIndex(p.engagement_souhaite ?? 'solidaire')
                const couleur = d > c ? '#16a34a' : d === c ? '#d97706' : '#dc2626'
                const gauche = (Math.min(c, d) + 0.5) / 5 * 100
                const largeur = Math.abs(d - c) / 5 * 100
                const versLaDroite = d >= c
                return (
                  <div key={p.id} className="flex items-center">
                    <div className="w-44 shrink-0 py-2 pr-2 text-sm font-medium text-gray-900 dark:text-white truncate" title={p.nom}>{p.nom}</div>
                    <div className="relative flex-1 grid grid-cols-5">
                      {/* Flèche C → D */}
                      {c !== d && (
                        <div className="absolute top-1/2 -translate-y-1/2 pointer-events-none" style={{ left: `${gauche}%`, width: `${largeur}%` }}>
                          <div className="h-0.5 w-full" style={{ background: couleur }} />
                          <div className="absolute top-1/2 -translate-y-1/2" style={versLaDroite
                            ? { right: -1, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: `6px solid ${couleur}` }
                            : { left: -1, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderRight: `6px solid ${couleur}` }} />
                        </div>
                      )}
                      {NIVEAUX_ENGAGEMENT.map((n, idx) => (
                        <button key={n.value} disabled={readOnly}
                          onClick={() => {
                            if (readOnly) return
                            if (placer === 'C') onSet(p.id, { engagement_actuel: n.value })
                            else onSet(p.id, { engagement_souhaite: n.value })
                          }}
                          title={readOnly ? undefined : `${placer === 'C' ? 'Placer la situation actuelle (C)' : 'Placer la situation désirée (D)'} : ${n.label}`}
                          className={`relative h-10 flex items-center justify-center gap-1 border-b border-dashed transition-colors ${readOnly ? 'cursor-default' : 'hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer'}`}
                          style={{ borderColor: 'var(--border)' }}>
                          {idx === c && (
                            <span className="flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold text-white" style={{ background: couleur, zIndex: 1 }}>C</span>
                          )}
                          {idx === d && (
                            <span className="flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold bg-transparent" style={{ border: `2px solid ${couleur}`, color: couleur, zIndex: 1 }}>D</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Rappel pédagogique */}
      <div className="rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 px-4 py-3 text-xs text-teal-800 dark:text-teal-300">
        💡 Flèche <span className="font-semibold">verte</span> : progression souhaitée (D au-delà de C) ·
        marqueurs <span className="font-semibold">ambre</span> superposés : objectif atteint ·
        flèche <span className="font-semibold">rouge</span> : l’engagement actuel dépasse le niveau désiré (à réévaluer).
        L’écart C → D guide le plan d’engagement.
      </div>
    </div>
  )
}

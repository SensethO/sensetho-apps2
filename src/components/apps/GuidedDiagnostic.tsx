'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'
import Icon from '@/components/ui/Icon'
import type { RseContext } from '@/components/rse/RseAppShell'
import ViewTabs from '@/components/rse/ViewTabs'
import GuidedAnnexesModal from './GuidedAnnexesModal'
import type { GuidedPDFData, GuidedPhaseReport, GuidedDomainReport } from './GuidedDiagnosticPDFReport'
import type { NoteSection } from './GuidedActionNotePanel'

// ── Lazy PDF Report (html2canvas + jspdf — ne pas inclure dans le bundle principal)
const PdfReportLazy = dynamic(
  () => import('./GuidedDiagnosticPDFReport').then(m => ({ default: m.default })),
  { ssr: false, loading: () => null },
)

// ── Lazy Note Panel (fetch côté client)
const GuidedActionNotePanelLazy = dynamic(
  () => import('./GuidedActionNotePanel'),
  { ssr: false, loading: () => null },
)

// ─── Types locaux ─────────────────────────────────────────────────────────────

interface DiagnosticRecord {
  id: string
  user_id: string
  organisation_id: string
  year: number
  scores: Record<string, number>
  action_progress: Record<string, number>
  action_na: Record<string, boolean>
  ai_analysis: string | null
  ai_scores: Record<string, number> | null
  ai_generated_at: string | null
}

interface ShareEntry {
  id: string
  permission: 'read' | 'edit'
  created_at: string
  profiles: { email: string; full_name: string | null } | null
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Domain {
  id: string
  nom: string
  isoRef: string
  phase: 1 | 2 | 3 | 4
  qcNom: string
  qcIcone: string
  rationale: string
  actions: string[]
  focusActionIndices: number[]
  kpis: string[]
  ods: string[]
}

// ─── Données ISO 26000 — source de vérité locale ──────────────────────────────
// (Ces données sont également publiées dans @sensetho/catalogue-app/guided-diagnostic
//  pour les autres projets consommateurs.)

const SCORE_LABELS = ['Non évalué', 'Initiale', 'Engagée', 'Structurée', 'Avancée', 'Exemplaire']

const PHASES = [
  { id: 1 as const, label: 'Fondamentaux',          color: '#ef4444', bg: 'rgba(239,68,68,0.08)',    border: 'rgba(239,68,68,0.25)' },
  { id: 2 as const, label: 'Piliers sociaux',        color: '#f97316', bg: 'rgba(249,115,22,0.08)',   border: 'rgba(249,115,22,0.25)' },
  { id: 3 as const, label: 'Environnement',          color: '#22c55e', bg: 'rgba(34,197,94,0.08)',    border: 'rgba(34,197,94,0.25)' },
  { id: 4 as const, label: 'Enjeux complémentaires', color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)',   border: 'rgba(139,92,246,0.25)' },
]

const DOMAINS: Domain[] = [
  // Phase 1 : Fondamentaux
  {
    id: 'DA1.1', nom: 'Gouvernance organisationnelle', isoRef: '6.2', phase: 1,
    qcNom: "Gouvernance de l'organisation", qcIcone: '🏛️',
    rationale: 'La gouvernance est le socle transversal de toute démarche RSE. Sans structures de décision claires et un engagement de la direction, les autres actions restent isolées et sans pilotage.',
    focusActionIndices: [0, 1, 5, 8],
    actions: [
      'Définir et formaliser les valeurs, vision et stratégie RSE',
      'Identifier et cartographier les parties prenantes',
      'Mettre en place des mécanismes de décision transparents',
      'Établir un reporting RSE régulier (annuel au minimum)',
      'Intégrer la RSE dans les objectifs stratégiques et la feuille de route',
      'Désigner un responsable RSE ou un comité dédié avec mandat officiel',
      'Promouvoir la diversité dans les instances de décision',
      'Évaluer et améliorer en continu les pratiques de gouvernance',
      'Former les dirigeants et administrateurs aux enjeux de responsabilité sociétale',
      'Publier un rapport de durabilité selon un référentiel reconnu (GRI, CSRD…)',
    ],
    kpis: ['Politique RSE formalisée (oui/non)', "Score d'intégration RSE dans les objectifs (0-100%)", 'Fréquence du reporting RSE (nombre/an)'],
    ods: ['ODD16', 'ODD17'],
  },
  {
    id: 'DA3.4', nom: 'Santé et sécurité au travail', isoRef: '6.4.6', phase: 1,
    qcNom: 'Relations et conditions de travail', qcIcone: '👷',
    rationale: "Premier enjeu social et légal. La santé et la sécurité au travail impactent chaque collaborateur quotidiennement.",
    focusActionIndices: [0, 1, 2, 3],
    actions: [
      'Évaluer les risques professionnels et mettre à jour le document unique (DUER)',
      'Mettre en place un comité SSCT (Santé, Sécurité et Conditions de Travail)',
      'Former régulièrement les collaborateurs aux gestes et postures et aux risques spécifiques',
      'Définir des indicateurs de suivi : taux de fréquence, taux de gravité des accidents',
      "Promouvoir la remontée d'incidents et de presqu'accidents (culture de sécurité)",
      'Intégrer le bien-être mental dans la politique santé (prévention des RPS)',
      'Auditer régulièrement les conditions de travail et agir sur les résultats',
    ],
    kpis: ['Taux de fréquence des accidents (/million h)', "Taux d'absentéisme (%)", '% salariés formés SST'],
    ods: ['ODD3', 'ODD8'],
  },
  {
    id: 'DA4.3', nom: 'Atténuation des changements climatiques', isoRef: '6.5.5', phase: 1,
    qcNom: 'Environnement', qcIcone: '🌱',
    rationale: "Pression réglementaire croissante (CSRD, taxonomie verte). Mesurer son empreinte carbone est désormais incontournable.",
    focusActionIndices: [0, 1, 2, 5],
    actions: [
      'Réaliser un bilan des émissions de gaz à effet de serre (Bilan Carbone® ou GHG Protocol)',
      'Fixer des objectifs de réduction des émissions à court et moyen terme',
      'Optimiser la consommation énergétique des bâtiments et équipements',
      "Développer l'usage des énergies renouvelables",
      "Intégrer le critère carbone dans les décisions d'achats et d'investissements",
      'Communiquer transparentement sur les émissions et les progrès réalisés',
      'Étudier les compensations carbone comme levier complémentaire (pas substitutif)',
    ],
    kpis: ['Émissions CO₂ scope 1+2 (tCO₂eq)', '% énergie renouvelable dans le mix énergétique', 'Réduction annuelle des émissions (%)'],
    ods: ['ODD7', 'ODD13'],
  },
  {
    id: 'DA5.1', nom: 'Lutte contre la corruption', isoRef: '6.6.3', phase: 1,
    qcNom: 'Loyauté des pratiques', qcIcone: '⚖️',
    rationale: 'Obligation légale (Loi Sapin 2). Le risque réputationnel et pénal en cas de corruption est majeur pour toute organisation, quelle que soit sa taille.',
    focusActionIndices: [0, 1, 2, 3],
    actions: [
      'Adopter et diffuser un code de conduite anti-corruption',
      "Cartographier les risques de corruption et d'atteinte à la probité",
      'Former les collaborateurs exposés aux risques de corruption',
      "Mettre en place un dispositif d'alerte interne (whistleblowing)",
      'Évaluer les tiers (clients, fournisseurs, intermédiaires) sur leur intégrité',
      'Auditer régulièrement les processus à risque (achats, commercial, partenariats)',
    ],
    kpis: ['Code de conduite diffusé (oui/non)', '% collaborateurs formés anti-corruption', "Dispositif d'alerte en place (oui/non)"],
    ods: ['ODD16'],
  },
  // Phase 2 : Piliers sociaux
  {
    id: 'DA3.1', nom: 'Emploi et relations de travail', isoRef: '6.4.3', phase: 2,
    qcNom: 'Relations et conditions de travail', qcIcone: '👷',
    rationale: "Des conditions d'emploi équitables sont le premier levier d'attractivité et de fidélisation des talents.",
    focusActionIndices: [0, 1, 2, 4],
    actions: [
      'Établir une politique de rémunération équitable et transparente',
      'Garantir la stabilité des contrats et limiter la précarité',
      'Favoriser le dialogue social et la consultation des représentants du personnel',
      'Mettre en place des entretiens individuels réguliers et des parcours de carrière',
      'Développer la flexibilité du travail (télétravail, aménagement horaires)',
      "Mesurer et améliorer le taux d'engagement et de satisfaction des collaborateurs",
    ],
    kpis: ['Taux de turnover (%)', "Index d'égalité professionnelle (/100)", "% CDI dans l'effectif total"],
    ods: ['ODD8', 'ODD10'],
  },
  {
    id: 'DA3.5', nom: 'Formation et éducation', isoRef: '6.4.7', phase: 2,
    qcNom: 'Relations et conditions de travail', qcIcone: '👷',
    rationale: 'La formation est un droit pour chaque salarié et un investissement à ROI prouvé. La CSRD impose désormais de mesurer et communiquer cet engagement.',
    focusActionIndices: [0, 1, 2, 5],
    actions: [
      'Définir un plan de développement des compétences annuel',
      "Garantir l'accès à la formation pour tous les niveaux hiérarchiques",
      'Intégrer la RSE dans les parcours de formation',
      'Développer le mentorat et le transfert de compétences internes',
      "Mesurer l'impact des formations sur les performances",
      'Favoriser les certifications professionnelles et la validation des acquis',
    ],
    kpis: ['Heures de formation par salarié (h/an)', '% budget masse salariale consacré à la formation', "Taux d'accès à la formation (%)"],
    ods: ['ODD4', 'ODD8'],
  },
  {
    id: 'DA3.6', nom: 'Égalité professionnelle', isoRef: '6.4.4', phase: 2,
    qcNom: 'Relations et conditions de travail', qcIcone: '👷',
    rationale: "L'Index Égalité Professionnelle est obligatoire dès 50 salariés. L'égalité femmes/hommes est un facteur de performance mesurable.",
    focusActionIndices: [0, 1, 2, 3],
    actions: [
      "Calculer et publier l'Index d'égalité professionnelle femmes/hommes",
      "Analyser les écarts de rémunération et définir un plan d'action correctif",
      'Fixer des objectifs de mixité à tous les niveaux hiérarchiques, notamment en direction',
      'Prévenir et traiter les situations de harcèlement moral et sexuel',
      'Faciliter la conciliation vie professionnelle / vie personnelle',
      'Former les managers et recruteurs aux biais inconscients',
    ],
    kpis: ['Index égalité professionnelle (/100)', 'Écart de rémunération H/F (%)', '% femmes dans les postes de direction'],
    ods: ['ODD5', 'ODD8', 'ODD10'],
  },
  {
    id: 'DA5.4', nom: "Pratiques d'achat responsables", isoRef: '6.6.6', phase: 2,
    qcNom: 'Loyauté des pratiques', qcIcone: '⚖️',
    rationale: "Vos fournisseurs et partenaires engagent votre responsabilité sociale et environnementale. Les grands donneurs d'ordres vous imposent de plus en plus des exigences RSE.",
    focusActionIndices: [0, 1, 2, 3],
    actions: [
      "Définir une politique d'achats responsables intégrant des critères RSE",
      'Évaluer les fournisseurs sur des critères sociaux, environnementaux et éthiques',
      'Intégrer des clauses RSE dans les contrats fournisseurs',
      "Privilégier les fournisseurs locaux et les entreprises de l'ESS",
      'Accompagner les fournisseurs dans leur démarche RSE',
      "Mesurer et réduire l'empreinte carbone de la chaîne d'approvisionnement",
    ],
    kpis: ['% fournisseurs évalués RSE', '% achats locaux (< 100km)', '% achats avec clause RSE contractuelle'],
    ods: ['ODD12', 'ODD17'],
  },
  // Phase 3 : Environnement
  {
    id: 'DA4.1', nom: 'Prévention de la pollution', isoRef: '6.5.3', phase: 3,
    qcNom: 'Environnement', qcIcone: '🌱',
    rationale: "Réduire les déchets et les émissions polluantes génère souvent des économies immédiates. C'est aussi le domaine environnemental le plus visible pour les riverains.",
    focusActionIndices: [0, 2, 3, 6],
    actions: [
      'Cartographier et quantifier les pollutions générées (air, eau, sol, déchets)',
      'Mettre en conformité les installations avec les réglementations environnementales',
      'Réduire à la source les émissions polluantes et les déchets produits',
      'Trier et valoriser les déchets (réemploi, recyclage, compostage)',
      'Former les collaborateurs aux bonnes pratiques environnementales',
      'Travailler avec les fournisseurs pour réduire les emballages et matières dangereuses',
      "Mesurer l'évolution des indicateurs pollution et fixer des objectifs de réduction",
    ],
    kpis: ['Déchets produits par salarié (kg/an)', 'Taux de valorisation des déchets (%)', 'Rejets de substances polluantes (kg/an)'],
    ods: ['ODD3', 'ODD6', 'ODD12', 'ODD14', 'ODD15'],
  },
  {
    id: 'DA4.2', nom: 'Utilisation durable des ressources', isoRef: '6.5.4', phase: 3,
    qcNom: 'Environnement', qcIcone: '🌱',
    rationale: "Énergie et eau : des économies directes et une réduction de l'exposition aux prix volatils. L'efficacité des ressources est souvent le chemin le plus court vers la rentabilité verte.",
    focusActionIndices: [0, 1, 2, 6],
    actions: [
      "Réaliser un audit des consommations énergétiques et identifier les gisements d'économies",
      "Mettre en oeuvre un plan d'efficacité énergétique (isolation, équipements, process)",
      "Mesurer et réduire les consommations d'eau",
      "Développer l'économie circulaire dans les processus de production",
      "Réduire l'utilisation de matières premières vierges (recyclées, biosourcées)",
      'Mettre en place un suivi des consommations en temps réel',
      'Fixer des objectifs annuels de réduction des consommations et les suivre',
    ],
    kpis: ['Consommation énergétique par salarié (kWh)', 'Consommation eau par salarié (m³)', '% matières recyclées dans les achats'],
    ods: ['ODD6', 'ODD7', 'ODD12'],
  },
  // Phase 4 : Enjeux complémentaires
  {
    id: 'DA2.1', nom: 'Devoir de vigilance', isoRef: '6.3.3', phase: 4,
    qcNom: "Droits de l'Homme", qcIcone: '🤝',
    rationale: "La loi française sur le devoir de vigilance s'applique aux grandes entreprises et s'étend progressivement via la CSDDD européenne.",
    focusActionIndices: [0, 1, 2, 4],
    actions: [
      "Cartographier les risques d'atteintes aux droits humains dans la chaîne de valeur",
      'Élaborer et publier un plan de vigilance conforme à la loi',
      "Mettre en oeuvre des procédures d'évaluation et d'audit fournisseurs sur les droits humains",
      'Former les acheteurs et responsables commerciaux au devoir de vigilance',
      "Établir un mécanisme d'alerte pour les victimes de violations",
      "Assurer le suivi et l'amélioration continue du plan de vigilance",
    ],
    kpis: ['Plan de vigilance publié (oui/non)', '% fournisseurs audités sur les droits humains', "Nombre d'alertes traitées"],
    ods: ['ODD8', 'ODD10', 'ODD16'],
  },
  {
    id: 'DA6.5', nom: 'Protection des données', isoRef: '6.7.7', phase: 4,
    qcNom: 'Questions relatives aux consommateurs', qcIcone: '🛒',
    rationale: 'La conformité RGPD est une obligation légale depuis 2018. La protection des données clients est un avantage concurrentiel fort dans un contexte de méfiance croissante.',
    focusActionIndices: [0, 1, 3, 4],
    actions: [
      'Désigner un délégué à la protection des données (DPO) ou un référent RGPD',
      'Réaliser un registre des traitements de données personnelles',
      'Mettre en place les mentions légales et les consentements conformes au RGPD',
      'Former les collaborateurs aux bonnes pratiques de protection des données',
      "Réaliser des analyses d'impact (AIPD) pour les traitements à risque",
      "Gérer les demandes d'exercice des droits des personnes (accès, suppression…)",
    ],
    kpis: ['DPO/référent RGPD désigné (oui/non)', 'Registre des traitements à jour (oui/non)', 'Délai moyen de traitement des demandes droits (jours)'],
    ods: ['ODD16'],
  },
  {
    id: 'DA7.1', nom: 'Implication auprès des communautés', isoRef: '6.8.3', phase: 4,
    qcNom: 'Communautés et développement local', qcIcone: '🏘️',
    rationale: "L'ancrage territorial est un avantage compétitif et une attente forte des parties prenantes locales. Il différencie durablement les organisations responsables.",
    focusActionIndices: [0, 1, 2, 3],
    actions: [
      'Cartographier et dialoguer régulièrement avec les communautés locales',
      'Soutenir des initiatives locales (emploi, culture, sport, éducation)',
      "Développer des partenariats avec les associations et acteurs de l'ESS locaux",
      "Favoriser l'emploi local dans les recrutements et sous-traitances",
      "Mesurer l'impact territorial de l'organisation (emplois induits, achats locaux…)",
      'Participer aux concertations et décisions qui affectent le territoire',
    ],
    kpis: ['Budget mécénat/sponsoring local (€)', 'Nombre de partenariats associatifs actifs', '% achats auprès de fournisseurs locaux'],
    ods: ['ODD11', 'ODD17'],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  if (s === 0) return '#6b7280'
  if (s <= 1) return '#ef4444'
  if (s <= 2) return '#f97316'
  if (s <= 3) return '#eab308'
  if (s <= 4) return '#22c55e'
  return '#4ade80'
}

function progressColor(p: number) {
  if (p === 0) return '#6b7280'
  if (p <= 2) return '#ef4444'
  if (p <= 4) return '#f97316'
  if (p <= 6) return '#eab308'
  if (p <= 8) return '#22c55e'
  return '#4ade80'
}

// ─── ActionItem ───────────────────────────────────────────────────────────────

function ActionItem({ text, progress, na, note, isOpen, readOnly, diagnosticId, actionKey, actionSections, notesRemoteVersion, onToggle, onSetProgress, onToggleNa, onNoteChange, onSectionsChange }: {
  text: string; progress: number; na: boolean; note: string; isOpen: boolean
  readOnly: boolean
  diagnosticId: string
  actionKey: string
  actionSections: NoteSection[]
  notesRemoteVersion: number
  onToggle: () => void; onSetProgress: (v: number) => void; onToggleNa: () => void
  onNoteChange: (v: string) => void
  onSectionsChange: (sects: NoteSection[]) => void
}) {
  const done = na || progress >= 10
  const hasContent = !!note || actionSections.some(s => s.title || s.content || s.attachments.length > 0)
  return (
    <li className="rounded-lg border transition-colors"
      style={isOpen
        ? { borderColor: 'rgba(99,102,241,0.4)', backgroundColor: 'rgba(99,102,241,0.05)' }
        : { borderColor: 'transparent' }}>
      <button onClick={onToggle}
        className="w-full flex items-start gap-2 px-2 pt-1.5 pb-1 text-left">
        <span className={`shrink-0 mt-0.5 text-xs transition-transform ${isOpen ? 'rotate-90' : ''}`}
          style={{ color: isOpen ? '#6366f1' : 'var(--text-muted)' }}>▶</span>
        <span className={`flex-1 text-sm leading-snug ${done ? 'line-through' : ''}`}
          style={{ color: done ? 'var(--text-muted)' : 'var(--text)' }}>{text}</span>
        {done && <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${na ? 'bg-gray-500/20 text-gray-500' : 'bg-green-500/20 text-green-600'}`}>{na ? 'N/A' : '✓'}</span>}
        {hasContent && !done && <span className="shrink-0 text-indigo-400 text-xs">📝</span>}
      </button>

      <div className="flex items-center gap-2 px-2 pb-1.5">
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
            <button key={n} disabled={readOnly}
              onClick={e => { e.stopPropagation(); if (!readOnly) onSetProgress(progress === n ? 0 : n) }}
              className={`w-3.5 h-3.5 transition-all hover:scale-110 ${n === 1 ? 'rounded-l-sm' : n === 10 ? 'rounded-r-sm' : ''}`}
              style={n <= progress ? { backgroundColor: progressColor(progress) } : undefined}>
              {n > progress && <span className="block w-full h-full rounded-[inherit] bg-gray-200 dark:bg-gray-700" />}
            </button>
          ))}
        </div>
        {progress > 0 && <span className="text-xs tabular-nums w-8" style={{ color: progressColor(progress) }}>{progress}/10</span>}
        <button disabled={readOnly} onClick={e => { e.stopPropagation(); if (!readOnly) onToggleNa() }}
          className={`ml-auto text-xs px-2 py-0.5 rounded border font-medium transition-colors ${na ? 'bg-gray-500/80 text-white border-gray-500' : 'border-gray-300 dark:border-gray-600 text-gray-400 hover:border-gray-500'}`}>N/A</button>
      </div>

      {isOpen && (
        <GuidedActionNotePanelLazy
          diagnosticId={diagnosticId}
          actionKey={actionKey}
          readOnly={readOnly}
          note={note}
          onNoteChange={onNoteChange}
          initialSections={actionSections}
          notesRemoteVersion={notesRemoteVersion}
          onSectionsChange={onSectionsChange}
        />
      )}
    </li>
  )
}

// ─── ScoreSelector ────────────────────────────────────────────────────────────

/** Calcule un score suggéré (0-5) depuis la progression moyenne des actions focus */
function computeSuggestedScore(
  domain: Domain,
  actionProgress: Record<string, number>,
  actionNa: Record<string, boolean>,
): number | null {
  const keys = domain.focusActionIndices.map(i => `${domain.id}_${i}`)
  const active = keys.filter(k => !actionNa[k])
  if (active.length === 0) return null
  const totalStarted = active.filter(k => (actionProgress[k] ?? 0) > 0).length
  if (totalStarted === 0) return null
  const avg = active.reduce((s, k) => s + (actionProgress[k] ?? 0), 0) / active.length
  // Mapping 0-10 → 0-5
  if (avg >= 9.5) return 5
  if (avg >= 7.5) return 4
  if (avg >= 5.5) return 3
  if (avg >= 3.5) return 2
  if (avg >= 1)   return 1
  return 0
}

function ScoreSelector({ score, readOnly, onChange, suggestedScore }: {
  score: number; readOnly: boolean; onChange: (v: number) => void; suggestedScore?: number | null
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 flex-wrap">
        {[0, 1, 2, 3, 4, 5].map(v => (
          <button key={v} disabled={readOnly} onClick={() => onChange(v)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
            style={score === v
              ? { backgroundColor: scoreColor(v), color: '#fff', borderColor: scoreColor(v) }
              : { backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
            {v} — {SCORE_LABELS[v]}
          </button>
        ))}
      </div>
      {/* Score suggéré par la progression des actions */}
      {!readOnly && suggestedScore != null && suggestedScore !== score && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
          style={{ backgroundColor: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            💡 Score suggéré par vos actions :
          </span>
          <span className="font-semibold" style={{ color: scoreColor(suggestedScore) }}>
            {suggestedScore} — {SCORE_LABELS[suggestedScore]}
          </span>
          <button onClick={() => onChange(suggestedScore)}
            className="ml-auto text-xs font-medium px-2 py-0.5 rounded transition-colors hover:opacity-80"
            style={{ backgroundColor: '#6366f1', color: '#fff' }}>
            Appliquer
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Onglets de navigation (ViewTabs) — définis localement pour ce composant ──
// Le composant ViewTabs est importé depuis @/components/rse/ViewTabs (partagé RSE).

const GUIDED_TABS = [
  { id: 'intro'     as const, label: 'Présentation',    icon: '📋' },
  { id: 'dashboard' as const, label: 'Tableau de bord', icon: '🎯' },
  { id: 'summary'   as const, label: 'Synthèse',        icon: '📊' },
  { id: 'step'      as const, label: 'Questionnaire',   icon: '📝' },
] as const

// ─── ShareModal ───────────────────────────────────────────────────────────────

function ShareModal({ diagnosticId, onClose }: { diagnosticId: string; onClose: () => void }) {
  const [shares, setShares] = useState<ShareEntry[]>([])
  const [email, setEmail] = useState('')
  const [permission, setPermission] = useState<'read' | 'edit'>('read')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/guided-diagnostic/${diagnosticId}/shares`)
      .then(r => r.json())
      .then(j => { setShares(j.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [diagnosticId])

  async function share() {
    if (!email.trim()) return
    setSaving(true); setError(null)
    const res = await fetch(`/api/guided-diagnostic/${diagnosticId}/shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), permission }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }
    setShares(prev => [...prev, json.data])
    setEmail(''); setSaving(false)
  }

  async function removeShare(shareId: string) {
    await fetch(`/api/guided-diagnostic/${diagnosticId}/shares?share_id=${shareId}`, { method: 'DELETE' })
    setShares(prev => prev.filter(s => s.id !== shareId))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="rounded-xl shadow-xl w-full max-w-md p-5 flex flex-col gap-4"
        style={{ backgroundColor: 'var(--bg-card)' }}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Partager ce diagnostic</h3>
          <button onClick={onClose} className="p-1 rounded hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Seuls les utilisateurs ayant un abonnement actif sur cette application peuvent être invités.
        </p>

        <div className="flex gap-2">
          <input value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && share()}
            placeholder="email@exemple.com"
            className="flex-1 px-3 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <select value={permission} onChange={e => setPermission(e.target.value as 'read' | 'edit')}
            className="px-2 py-1.5 text-xs border rounded-lg focus:outline-none"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
            <option value="read">Lecture</option>
            <option value="edit">Édition</option>
          </select>
          <button onClick={share} disabled={saving || !email.trim()}
            className="px-3 py-1.5 text-xs text-white rounded-lg disabled:opacity-50"
            style={{ backgroundColor: '#6366f1' }}>Inviter</button>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        {loading ? (
          <p className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>Chargement…</p>
        ) : shares.length === 0 ? (
          <p className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>Aucun partage actif</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {shares.map(s => (
              <li key={s.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: 'var(--bg)' }}>
                <span className="flex-1 text-xs" style={{ color: 'var(--text)' }}>
                  {s.profiles?.full_name || s.profiles?.email}
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                    {s.permission === 'edit' ? 'Édition' : 'Lecture'}
                  </span>
                </span>
                <button onClick={() => removeShare(s.id)}
                  className="text-red-400 hover:text-red-600 p-0.5 rounded hover:opacity-80">
                  <Icon name="trash" size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function GuidedDiagnostic({ ctx }: { ctx: RseContext }) {
  const { org, year, setActions } = ctx

  const [diagnostic, setDiagnostic] = useState<DiagnosticRecord | null>(null)
  const [isOwner, setIsOwner] = useState(true)
  const [loadingDiag, setLoadingDiag] = useState(false)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [actionProgress, setActionProgress] = useState<Record<string, number>>({})
  const [actionNa, setActionNa] = useState<Record<string, boolean>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [sections, setSections] = useState<Record<string, NoteSection[]>>({})
  const [notesRemoteVersion, setNotesRemoteVersion] = useState(0)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [activePhase, setActivePhase] = useState<1 | 2 | 3 | 4>(1)
  const [activeDomainId, setActiveDomainId] = useState<string>(DOMAINS[0].id)
  const [view, setView] = useState<'intro' | 'step' | 'summary' | 'dashboard'>('intro')
  const [exportingPDF, setExportingPDF] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [showAnnexes, setShowAnnexes] = useState(false)
  const [pdfData, setPdfData] = useState<GuidedPDFData | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [generatingAI, setGeneratingAI] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [analysisFromCache, setAnalysisFromCache] = useState(false)
  const [showCacheNotice, setShowCacheNotice] = useState(false)
  const [showShare, setShowShare] = useState(false)

  const saveTimer        = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noteSaveTimers   = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  /** true pendant la sauvegarde diagnostic → bloque la sync realtime distante */
  const diagSavePending  = useRef(false)

  // ── Enregistrer le handler de décalage d'année ────────────────────────────
  useEffect(() => {
    ctx.setYearShiftHandler(async (delta: number) => {
      if (!org?.id) return
      await fetch('/api/guided-diagnostic/shift-year', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: org.id, delta }),
      })
    })
    return () => { ctx.setYearShiftHandler(null) }
  }, [org?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Charger ou créer le diagnostic quand org/year change ──────────────────
  useEffect(() => {
    if (!org) { setDiagnostic(null); setScores({}); setActionProgress({}); setActionNa({}); return }
    load()

    async function load() {
      setLoadingDiag(true)
      try {
        const res = await fetch(`/api/guided-diagnostic?org_id=${org!.id}&year=${year}`)
        const json = await res.json()

        if (json.data) {
          const d = json.data as DiagnosticRecord
          setDiagnostic(d)
          setIsOwner(json.isOwner ?? true)
          setScores(d.scores ?? {})
          setActionProgress(d.action_progress ?? {})
          setActionNa(d.action_na ?? {})
          setAiAnalysis(d.ai_analysis ?? null)
          // Charger les notes (texte + sections Tiptap)
          const nr = await fetch(`/api/guided-diagnostic/${d.id}/notes`)
          if (nr.ok) {
            const nj = await nr.json()
            setSections(nj.data?.sections ?? {})
            setNotes(nj.data?.notes ?? {})
            setNotesRemoteVersion(v => v + 1)
          }
        } else {
          // Créer automatiquement
          const cr = await fetch('/api/guided-diagnostic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ org_id: org!.id, year }),
          })
          if (cr.ok) {
            const cj = await cr.json()
            setDiagnostic(cj.data)
            setIsOwner(true)
            setScores({}); setActionProgress({}); setActionNa({}); setNotes({}); setSections({})
            setAiAnalysis(null)
          }
        }
      } finally {
        setLoadingDiag(false)
      }
    }
  }, [org?.id, year]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync — Realtime WebSocket + fallback polling toutes les 4s ───────────
  useEffect(() => {
    if (!diagnostic) return
    const diagId = diagnostic.id
    let realtimeOk = false

    // ── Tentative Realtime ────────────────────────────────────────────────
    const supabase = createClient()
    const channel = supabase
      .channel(`guided_diag_${diagId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'guided_diagnostics', filter: `id=eq.${diagId}` },
        (payload: { new?: Record<string, unknown> }) => {
          if (diagSavePending.current) return
          const remote = payload.new as DiagnosticRecord | undefined
          if (!remote) return
          setActionProgress(remote.action_progress ?? {})
          setActionNa(remote.action_na ?? {})
          setScores(remote.scores ?? {})
        }
      )
      .subscribe((status: string) => {
        realtimeOk = status === 'SUBSCRIBED'
      })

    // ── Realtime : guided_action_notes ────────────────────────────────────
    // Quand Realtime est opérationnel, ce channel reçoit immédiatement les
    // changements de notes/sections de tous les autres navigateurs et met à
    // jour notesRemoteVersion → les panneaux ouverts se rafraîchissent en live.
    // Quand Realtime est HS, ce channel ne reçoit rien et le polling prend le relais.
    const notesChannel = supabase
      .channel(`guided_notes_${diagId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'guided_action_notes', filter: `diagnostic_id=eq.${diagId}` },
        (payload: { new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
          const row = (payload.new ?? payload.old) as { action_key?: string; sections?: NoteSection[]; content?: string } | null
          if (!row?.action_key) return
          const key = row.action_key
          if (row.sections !== undefined) setSections(prev => ({ ...prev, [key]: row.sections ?? [] }))
          if (row.content  !== undefined) setNotes(prev   => ({ ...prev, [key]: row.content  ?? '' }))
          setNotesRemoteVersion(v => v + 1)
        }
      )
      .subscribe()

    // ── Fallback polling (si Realtime indisponible) ───────────────────────
    let pollTick = 0
    const poll = setInterval(async () => {
      if (realtimeOk || diagSavePending.current) return
      pollTick++
      try {
        // Toutes les 2s : sync scores / progress / na
        const res = await fetch(`/api/guided-diagnostic?org_id=${diagnostic.organisation_id}&year=${diagnostic.year}`)
        if (!res.ok) return
        const json = await res.json()
        const remote = json.data as DiagnosticRecord | null
        if (!remote) return
        setActionProgress(remote.action_progress ?? {})
        setActionNa(remote.action_na ?? {})
        setScores(remote.scores ?? {})

        // Toutes les ~4s (1 tick sur 2) : sync notes + sections (si aucune sauvegarde locale en cours)
        if (pollTick % 2 === 0 && Object.keys(noteSaveTimers.current).length === 0) {
          const nr = await fetch(`/api/guided-diagnostic/${diagId}/notes`)
          if (nr.ok) {
            const nj = await nr.json()
            setNotes(nj.data?.notes ?? {})
            setSections(nj.data?.sections ?? {})
            setNotesRemoteVersion(v => v + 1)
          }
        }
      } catch { /* silencieux */ }
    }, 2000)

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(notesChannel)
      clearInterval(poll)
    }
  }, [diagnostic?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Injecter les boutons dans le header RSE ───────────────────────────────
  useEffect(() => {
    if (!diagnostic) { setActions(null); return }
    setActions(
      <div className="flex items-center gap-2">
        {/* Statut sauvegarde */}
        {saveStatus === 'saving' && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Enregistrement…</span>}
        {saveStatus === 'saved'  && <span className="text-xs text-green-500">✓ Enregistré</span>}
        {/* Excel */}
        <button onClick={handleExportExcel} disabled={exportingExcel}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors hover:opacity-80 disabled:opacity-50"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          title="Exporter en Excel">
          <Icon name="download" size={13} />
          {exportingExcel ? '…' : 'Excel'}
        </button>
        {/* PDF */}
        <button onClick={handleExportPDF} disabled={exportingPDF}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors hover:opacity-80 disabled:opacity-50"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          title="Exporter en PDF">
          <Icon name="fileText" size={13} />
          {exportingPDF ? '…' : 'PDF'}
        </button>
        {/* Annexes */}
        <button onClick={() => setShowAnnexes(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors hover:opacity-80"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          title="Voir et télécharger les pièces jointes">
          <Icon name="paperclip" size={13} />
          Annexes
        </button>
        {/* Partager */}
        {isOwner && (
          <button onClick={() => setShowShare(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors hover:opacity-80"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <Icon name="share" size={13} /> Partager
          </button>
        )}
        {/* Vue */}
      </div>
    )
  }, [diagnostic, saveStatus, isOwner, view]) // eslint-disable-line react-hooks/exhaustive-deps


  // ── Debounce save ─────────────────────────────────────────────────────────
  const scheduleSave = useCallback((newScores: Record<string, number>, newProgress: Record<string, number>, newNa: Record<string, boolean>) => {
    diagSavePending.current = true
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (!diagnostic) { diagSavePending.current = false; return }
      setSaveStatus('saving')
      try {
        await fetch(`/api/guided-diagnostic/${diagnostic.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scores: newScores, action_progress: newProgress, action_na: newNa }),
        })
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      } catch { setSaveStatus('idle') }
      finally { diagSavePending.current = false }
    }, 700)
  }, [diagnostic])

  function setScore(domainId: string, score: number) {
    const s = { ...scores, [domainId]: score }
    setScores(s); scheduleSave(s, actionProgress, actionNa)
  }

  function setProgress(key: string, value: number) {
    const p = { ...actionProgress, [key]: value }
    setActionProgress(p); scheduleSave(scores, p, actionNa)
  }

  function toggleNa(key: string) {
    const n = { ...actionNa, [key]: !actionNa[key] }
    setActionNa(n); scheduleSave(scores, actionProgress, n)
  }

  function updateNote(key: string, value: string) {
    setNotes(prev => ({ ...prev, [key]: value }))
    const timerKey = `note_${key}`
    if (noteSaveTimers.current[timerKey]) clearTimeout(noteSaveTimers.current[timerKey])
    noteSaveTimers.current[timerKey] = setTimeout(() => {
      delete noteSaveTimers.current[timerKey]
      if (!diagnostic) return
      fetch(`/api/guided-diagnostic/${diagnostic.id}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_key: key, content: value }),
      })
    }, 800)
  }

  // Les sections sont sauvegardées directement par GuidedActionNotePanel (via scheduleSave).
  // Cette fonction met uniquement à jour l'état local (pour PDF export, etc.)
  function updateSections(key: string, sects: NoteSection[]) {
    setSections(prev => ({ ...prev, [key]: sects }))
  }

  // ── AI ────────────────────────────────────────────────────────────────────
  async function generateAnalysis(force?: boolean) {
    if (!diagnostic || generatingAI) return
    setGeneratingAI(true); setAiError(null); setShowCacheNotice(false)
    try {
      const res = await fetch(`/api/guided-diagnostic/${diagnostic.id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: force ?? false }),
      })
      const json = await res.json()
      if (!res.ok) { setAiError(json.error); return }
      setAiAnalysis(json.analysis)
      // Mettre à jour le record local avec la date de génération si fournie
      if (json.generated_at) {
        setDiagnostic(prev => prev ? { ...prev, ai_analysis: json.analysis, ai_generated_at: json.generated_at } : prev)
      }
      const fromCache = json.regenerated === false
      setAnalysisFromCache(fromCache)
      setShowCacheNotice(fromCache)
    } catch (e) { setAiError(String(e)) }
    finally { setGeneratingAI(false) }
  }

  // ── PDF export ────────────────────────────────────────────────────────────
  function buildPDFData(): GuidedPDFData {
    const SCORE_LABELS_LOCAL = ['Non évalué', 'Initiale', 'Engagée', 'Structurée', 'Avancée', 'Exemplaire']
    const evaluatedDomains = DOMAINS.filter(d => (scores[d.id] ?? 0) > 0)
    const avg = evaluatedDomains.length > 0
      ? evaluatedDomains.reduce((s, d) => s + scores[d.id], 0) / evaluatedDomains.length
      : 0

    const phases: GuidedPhaseReport[] = PHASES.map(phase => {
      const pDomains = DOMAINS.filter(d => d.phase === phase.id)
      const phaseEval = pDomains.filter(x => (scores[x.id] ?? 0) > 0)
      const phaseAvg = phaseEval.length > 0
        ? phaseEval.reduce((s, x) => s + scores[x.id], 0) / phaseEval.length
        : 0
      let isFirst = true
      const phaseDomains = pDomains.map((d): GuidedDomainReport => {
        const sc = scores[d.id] ?? 0
        const focusActions = d.focusActionIndices.map(i => ({
          key: `${d.id}_${i}`,
          text: d.actions[i],
          progress: actionProgress[`${d.id}_${i}`] ?? 0,
          na: actionNa[`${d.id}_${i}`] ?? false,
          note: undefined,
        }))
        const domainReport: GuidedDomainReport = {
          domainId: d.id,
          domainName: d.nom,
          isoRef: d.isoRef,
          qcNom: d.qcNom,
          qcIcone: d.qcIcone,
          phase: d.phase,
          score: sc,
          maturityName: SCORE_LABELS_LOCAL[sc] ?? 'Non évalué',
          rationale: d.rationale,
          focusActions,
          isFirstInPhase: isFirst,
          ...(isFirst ? {
            phaseLabel: phase.label,
            phaseColor: phase.color,
            phaseBgColor: phase.bg,
            phaseAvgScore: phaseAvg,
            phaseEvaluated: phaseEval.length,
            phaseTotal: pDomains.length,
          } : {}),
        }
        isFirst = false
        return domainReport
      })
      return { id: phase.id, label: phase.label, color: phase.color, bgColor: phase.bg, domains: phaseDomains }
    })

    return {
      organisation: org?.denomination ?? null,
      year,
      date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
      evaluatedCount: evaluatedDomains.length,
      totalCount: DOMAINS.length,
      avgScore: avg,
      phases,
      aiAnalysis: aiAnalysis ?? null,
    }
  }

  async function handleExportPDF() {
    if (!diagnostic || exportingPDF) return
    setExportingPDF(true)
    try {
      const data = buildPDFData()
      // 1. Pré-charger le module PDF pendant que le composant se monte
      const pdfModulePromise = import('./GuidedDiagnosticPDFReport')
      setPdfData(data)
      // 2. Attendre que les éléments DOM du rapport soient présents (MutationObserver + fallback)
      await new Promise<void>(resolve => {
        if (document.querySelector('[data-guided-pdf-page]')) { resolve(); return }
        const observer = new MutationObserver(() => {
          if (document.querySelector('[data-guided-pdf-page]')) {
            observer.disconnect()
            resolve()
          }
        })
        observer.observe(document.body, { childList: true, subtree: true })
        setTimeout(() => { observer.disconnect(); resolve() }, 4000)
      })
      // 3. Laisser html2canvas rendre les images (RAF x2)
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      const { exportGuidedPDF } = await pdfModulePromise
      const orgSlug = (org?.denomination ?? 'diagnostic').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
      await exportGuidedPDF(data, `Diagnostic-RSE-${orgSlug}-${year}.pdf`)
    } catch (e) { console.error('[exportPDF]', e) }
    finally { setExportingPDF(false); setPdfData(null) }
  }

  // ── Excel export ──────────────────────────────────────────────────────────
  async function handleExportExcel() {
    if (!diagnostic || exportingExcel) return
    setExportingExcel(true)
    try {
      const res = await fetch(`/api/guided-diagnostic/${diagnostic.id}/export-excel`)
      if (!res.ok) { console.error('Excel export failed'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const orgSlug = (org?.denomination ?? 'diagnostic').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
      a.href = url
      a.download = `Diagnostic-RSE-${orgSlug}-${year}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) { console.error('[exportExcel]', e) }
    finally { setExportingExcel(false) }
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  const evaluatedCount = DOMAINS.filter(d => (scores[d.id] ?? 0) > 0).length
  const avgScore = evaluatedCount > 0
    ? DOMAINS.filter(d => (scores[d.id] ?? 0) > 0).reduce((s, d) => s + scores[d.id], 0) / evaluatedCount
    : 0
  const readOnly = !isOwner

  const activeDomain = DOMAINS.find(d => d.id === activeDomainId)!
  const phaseForActive = PHASES.find(p => p.id === activeDomain?.phase)!

  // ── Vue PRÉSENTATION — affichée même sans org sélectionnée ──────────────
  // Placée avant les guards !org / loadingDiag / !diagnostic
  // pour que la page de présentation soit toujours accessible.
  if (view === 'intro') {
    const evalCount = DOMAINS.filter(d => (scores[d.id] ?? 0) > 0).length
    const completionPct = Math.round((evalCount / DOMAINS.length) * 100)
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <ViewTabs tabs={GUIDED_TABS} active={view} onChange={setView} />

        {/* Hero */}
        <div className="rounded-2xl p-7 text-center"
          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #3730a3 100%)' }}>
          <div className="text-5xl mb-3">🌐</div>
          <h1 className="text-2xl font-bold text-white mb-2">Diagnostic Initial Guidé RSE</h1>
          <p className="text-indigo-200 text-sm mb-1">Référentiel ISO 26000 — Responsabilité Sociétale des Organisations</p>
          <p className="text-indigo-300 text-xs max-w-xl mx-auto leading-relaxed">
            Évaluez la maturité RSE de votre organisation sur 13 domaines prioritaires, structurés en 4 phases progressives.
            Obtenez une analyse IA personnalisée et un plan d&apos;actions concret.
          </p>
          {diagnostic && evalCount > 0 && (
            <div className="mt-4 inline-flex items-center gap-3 px-4 py-2 rounded-full text-sm font-medium"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white' }}>
              <div className="w-24 h-1.5 rounded-full bg-white/30 overflow-hidden">
                <div className="h-full rounded-full bg-white transition-all" style={{ width: `${completionPct}%` }} />
              </div>
              <span>{evalCount}/{DOMAINS.length} domaines évalués ({completionPct} %)</span>
            </div>
          )}
        </div>

        {/* Chiffres clés */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: '📐', value: '4', label: 'Phases progressives' },
            { icon: '🔍', value: '13', label: 'Domaines prioritaires' },
            { icon: '✅', value: '52', label: 'Actions focus' },
            { icon: '📊', value: '0–5', label: 'Niveaux de maturité' },
          ].map(stat => (
            <div key={stat.label} className="rounded-xl border p-4 text-center"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="text-xl font-bold" style={{ color: 'var(--accent, #6366f1)' }}>{stat.value}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Phases */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PHASES.map(phase => {
            const pDomains = DOMAINS.filter(d => d.phase === phase.id)
            const evaluated = pDomains.filter(d => (scores[d.id] ?? 0) > 0).length
            const pct = Math.round((evaluated / pDomains.length) * 100)
            return (
              <div key={phase.id} className="rounded-xl border p-4"
                style={{ borderColor: phase.border, backgroundColor: phase.bg }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: phase.color }}>
                      Phase {phase.id}
                    </div>
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{phase.label}</h3>
                  </div>
                  {diagnostic && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ backgroundColor: phase.color, color: 'white' }}>
                      {evaluated}/{pDomains.length}
                    </span>
                  )}
                </div>
                {diagnostic && pDomains.length > 0 && (
                  <div className="w-full h-1 rounded-full mb-3 overflow-hidden" style={{ backgroundColor: `${phase.color}30` }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: phase.color }} />
                  </div>
                )}
                <ul className="space-y-1">
                  {pDomains.map(d => {
                    const s = scores[d.id] ?? 0
                    return (
                      <li key={d.id}
                        className="flex items-center gap-2 text-xs cursor-pointer rounded px-1.5 py-0.5 transition-colors hover:opacity-80"
                        onClick={() => { setActiveDomainId(d.id); setActivePhase(d.phase); setView('step') }}
                        style={{ color: 'var(--text)' }}>
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s > 0 ? scoreColor(s) : 'var(--border)' }} />
                        <span className="flex-1 truncate">{d.qcIcone} {d.nom}</span>
                        {s > 0 && <span className="text-[10px] font-semibold flex-shrink-0" style={{ color: scoreColor(s) }}>{s}/5</span>}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>

        {/* Niveaux de maturité */}
        <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>📊 Niveaux de maturité RSE</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {([
              [0, 'Non évalué', 'Aucune évaluation réalisée'],
              [1, 'Initiale', 'Premières actions ponctuelles'],
              [2, 'Engagée', 'Actions formalisées engagées'],
              [3, 'Structurée', 'Pratiques documentées et déployées'],
              [4, 'Avancée', 'Pilotage et amélioration continue'],
              [5, 'Exemplaire', 'Excellence RSE et benchmark sectoriel'],
            ] as [number, string, string][]).map(([s, name, desc]) => (
              <div key={s} className="flex items-start gap-2 p-2 rounded-lg"
                style={{ backgroundColor: s === 0 ? 'var(--bg)' : `${scoreColor(s)}15` }}>
                <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: s === 0 ? 'var(--border)' : scoreColor(s) }}>
                  {s}
                </div>
                <div>
                  <div className="text-xs font-semibold" style={{ color: s === 0 ? 'var(--text-muted)' : scoreColor(s) }}>{name}</div>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="flex gap-3 justify-center pb-2">
          <button onClick={() => setView('dashboard')}
            className="px-6 py-2.5 text-sm font-medium rounded-xl border transition-colors hover:opacity-80"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            🎯 Tableau de bord
          </button>
          <button onClick={() => setView('step')}
            className="px-6 py-2.5 text-sm font-semibold rounded-xl text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: 'var(--accent, #6366f1)' }}>
            📝 {evalCount > 0 ? 'Continuer le questionnaire' : 'Commencer l\'évaluation'}
          </button>
        </div>

        {showShare && diagnostic && (
          <ShareModal diagnosticId={diagnostic.id} onClose={() => setShowShare(false)} />
        )}
        {showAnnexes && diagnostic && (
          <GuidedAnnexesModal diagnosticId={diagnostic.id} onClose={() => setShowAnnexes(false)} />
        )}
        {pdfData && (
          <div style={{ position: 'fixed', left: -9999, top: 0, pointerEvents: 'none', zIndex: -1 }}>
            <PdfReportLazy data={pdfData} />
          </div>
        )}
      </div>
    )
  }

  // ── Guards : org / chargement / diagnostic ──────────────────────────────
  if (!org) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="text-5xl">🏢</div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Sélectionnez une organisation dans le panneau de gauche<br />pour commencer le diagnostic.
        </p>
      </div>
    )
  }

  if (loadingDiag) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!diagnostic) {
    return <div className="text-sm text-center py-10" style={{ color: 'var(--text-muted)' }}>Impossible de charger le diagnostic.</div>
  }

  // ── Vue SYNTHÈSE ──────────────────────────────────────────────────────────
  if (view === 'summary') {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <ViewTabs tabs={GUIDED_TABS} active={view} onChange={setView} />

        {/* Scores globaux */}
        <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
          <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--text)' }}>
            Synthèse — {evaluatedCount}/{DOMAINS.length} domaines évalués
          </h3>
          {evaluatedCount > 0 && (
            <p className="text-xs mb-4 font-semibold text-green-600 dark:text-green-400">
              Score moyen : {avgScore.toFixed(1)}/5 — {SCORE_LABELS[Math.round(avgScore)]}
            </p>
          )}
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            Cliquez sur un domaine pour l&apos;évaluer ou le modifier.
          </p>
          {PHASES.map(phase => {
            const pDomains = DOMAINS.filter(d => d.phase === phase.id)
            return (
              <div key={phase.id} className="mb-5">
                <div className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: phase.color }}>
                  Phase {phase.id} — {phase.label}
                </div>
                <div className="space-y-2">
                  {pDomains.map(d => {
                    const s = scores[d.id] ?? 0
                    return (
                      <button
                        key={d.id}
                        onClick={() => { setActiveDomainId(d.id); setActivePhase(d.phase); setView('step') }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/60 group"
                        style={{ border: '1px solid var(--border)' }}>
                        <span className="text-xs flex-1 font-medium group-hover:underline" style={{ color: 'var(--text)' }}>
                          {d.qcIcone} {d.nom}
                        </span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="w-20 h-1.5 rounded-full overflow-hidden bg-gray-200 dark:bg-slate-600">
                            <div className="h-full rounded-full transition-all" style={{ width: `${(s / 5) * 100}%`, backgroundColor: scoreColor(s) }} />
                          </div>
                          <span className="text-xs font-semibold w-10 tabular-nums text-right" style={{ color: s > 0 ? scoreColor(s) : 'var(--text-muted)' }}>
                            {s > 0 ? `${s}/5` : '—'}
                          </span>
                        </div>
                        <Icon name="chevronRight" size={12} style={{ color: 'var(--text-subtle)', flexShrink: 0 }} />
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Analyse IA */}
        <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>✨ Analyse IA</h3>
              {aiAnalysis && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  Sauvegardée
                </span>
              )}
            </div>
            {!readOnly && (
              <button onClick={() => generateAnalysis()} disabled={generatingAI || evaluatedCount === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white rounded-lg disabled:opacity-50 transition-colors"
                style={{ backgroundColor: '#6366f1' }}>
                {generatingAI ? '⏳ Génération…' : aiAnalysis ? '↻ Mettre à jour' : '✨ Générer'}
              </button>
            )}
          </div>
          {diagnostic?.ai_generated_at && (
            <p className="text-[10px] mb-3" style={{ color: 'var(--text-muted)' }}>
              Analyse générée le {new Date(diagnostic.ai_generated_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
          {showCacheNotice && analysisFromCache && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-3 text-xs"
              style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#92400e' }}>
              <span className="flex-1">ℹ️ Aucun changement significatif depuis la dernière analyse.</span>
              <button onClick={() => generateAnalysis(true)}
                className="underline font-medium hover:opacity-80 whitespace-nowrap">
                Forcer la régénération
              </button>
              <button onClick={() => setShowCacheNotice(false)} className="ml-1 hover:opacity-70">×</button>
            </div>
          )}
          {aiError && <p className="text-xs text-red-500 mb-2">{aiError}</p>}
          {evaluatedCount === 0 && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Évaluez au moins un domaine pour générer l&apos;analyse.</p>}
          {aiAnalysis ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {aiAnalysis.split('\n').map((line, i) => (
                <p key={i} className="text-sm mb-2 last:mb-0" style={{ color: 'var(--text)' }}>
                  {line.startsWith('**') ? <strong>{line.replace(/\*\*/g, '')}</strong> : line}
                </p>
              ))}
            </div>
          ) : (
            !generatingAI && evaluatedCount > 0 && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Cliquez sur &quot;Générer&quot; pour obtenir une analyse personnalisée.</p>
            )
          )}
        </div>

      {showShare && diagnostic && (
        <ShareModal diagnosticId={diagnostic.id} onClose={() => setShowShare(false)} />
      )}
      {showAnnexes && diagnostic && (
        <GuidedAnnexesModal diagnosticId={diagnostic.id} onClose={() => setShowAnnexes(false)} />
      )}

      {/* Composant PDF caché — monté uniquement pendant l'export */}
      {pdfData && (
        <div style={{ position: 'fixed', left: -9999, top: 0, pointerEvents: 'none', zIndex: -1 }}>
          <PdfReportLazy data={pdfData} />
        </div>
      )}
      </div>
    )
  }

  // ── Vue TABLEAU DE BORD ───────────────────────────────────────────────────
  if (view === 'dashboard') {
    const evalCount = DOMAINS.filter(d => (scores[d.id] ?? 0) > 0).length
    const avg = evalCount > 0
      ? DOMAINS.filter(d => (scores[d.id] ?? 0) > 0).reduce((s, d) => s + scores[d.id], 0) / evalCount
      : 0
    const completionPct = Math.round((evalCount / DOMAINS.length) * 100)

    // Top recommandations : domaines évalués triés par score croissant (les plus faibles)
    const topReco = DOMAINS
      .filter(d => (scores[d.id] ?? 0) > 0)
      .sort((a, b) => (scores[a.id] ?? 0) - (scores[b.id] ?? 0))
      .slice(0, 5)

    // ODD actifs (union des ODD des domaines évalués avec score > 0)
    const activeOdds = Array.from(new Set(
      DOMAINS.filter(d => (scores[d.id] ?? 0) > 0).flatMap(d => d.ods)
    )).sort()

    // SVG Radar simplifié (pentagone 13 axes → trop complexe; on utilise un graphe circulaire par phase)
    const W = 340, H = 340, CX = 170, CY = 170, MAX_R = 130
    const N = DOMAINS.length
    const points = DOMAINS.map((d, i) => {
      const angle = (2 * Math.PI * i / N) - Math.PI / 2
      const r = ((scores[d.id] ?? 0) / 5) * MAX_R
      return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle), d }
    })
    const gridPoints = (frac: number) => DOMAINS.map((_, i) => {
      const angle = (2 * Math.PI * i / N) - Math.PI / 2
      const r = frac * MAX_R
      return `${CX + r * Math.cos(angle)},${CY + r * Math.sin(angle)}`
    }).join(' ')
    const scorePolygon = points.map(p => `${p.x},${p.y}`).join(' ')

    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <ViewTabs tabs={GUIDED_TABS} active={view} onChange={setView} />

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Score moyen', value: evalCount > 0 ? `${avg.toFixed(1)}/5` : '—', sub: evalCount > 0 ? SCORE_LABELS[Math.round(avg)] : 'Aucun domaine évalué', color: scoreColor(avg) },
            { label: 'Complétion', value: `${completionPct}%`, sub: `${evalCount}/${DOMAINS.length} domaines`, color: completionPct === 100 ? '#22c55e' : completionPct > 50 ? '#f97316' : '#6366f1' },
            { label: 'ODD couverts', value: String(activeOdds.length), sub: 'sur 17 ODD', color: '#0ea5e9' },
            { label: 'Actions en cours', value: String(Object.entries(actionProgress).filter(([, v]) => v > 0 && v < 10).length), sub: 'en progression', color: '#8b5cf6' },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-xl border p-4 flex flex-col gap-1"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
              <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>{kpi.label}</span>
              <span className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</span>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{kpi.sub}</span>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Radar SVG */}
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="text-xs font-semibold mb-3" style={{ color: 'var(--text)' }}>Radar des 13 domaines</h3>
            <div className="flex justify-center">
              <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: '100%' }}>
                {/* Grilles */}
                {[0.2, 0.4, 0.6, 0.8, 1].map(f => (
                  <polygon key={f} points={gridPoints(f)} fill="none"
                    stroke="var(--border)" strokeWidth={f === 1 ? 1.5 : 0.8} />
                ))}
                {/* Axes */}
                {DOMAINS.map((d, i) => {
                  const angle = (2 * Math.PI * i / N) - Math.PI / 2
                  return (
                    <line key={d.id}
                      x1={CX} y1={CY}
                      x2={CX + MAX_R * Math.cos(angle)}
                      y2={CY + MAX_R * Math.sin(angle)}
                      stroke="var(--border)" strokeWidth={0.8} />
                  )
                })}
                {/* Score polygon */}
                {evalCount > 0 && (
                  <polygon points={scorePolygon}
                    fill="rgba(99,102,241,0.15)" stroke="#6366f1" strokeWidth={2} />
                )}
                {/* Labels domaines */}
                {DOMAINS.map((d, i) => {
                  const angle = (2 * Math.PI * i / N) - Math.PI / 2
                  const lr = MAX_R + 18
                  const x = CX + lr * Math.cos(angle)
                  const y = CY + lr * Math.sin(angle)
                  const sc = scores[d.id] ?? 0
                  return (
                    <text key={d.id} x={x} y={y}
                      textAnchor={Math.cos(angle) > 0.1 ? 'start' : Math.cos(angle) < -0.1 ? 'end' : 'middle'}
                      dominantBaseline="middle"
                      fontSize={8} fill={sc > 0 ? scoreColor(sc) : 'var(--text-muted)'}>
                      {d.qcIcone}
                    </text>
                  )
                })}
              </svg>
            </div>
          </div>

          {/* Scores par phase */}
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="text-xs font-semibold mb-3" style={{ color: 'var(--text)' }}>Scores par phase</h3>
            <div className="space-y-4">
              {PHASES.map(phase => {
                const pDomains = DOMAINS.filter(d => d.phase === phase.id)
                const pEval = pDomains.filter(d => (scores[d.id] ?? 0) > 0)
                const pAvg = pEval.length > 0
                  ? pEval.reduce((s, d) => s + scores[d.id], 0) / pEval.length
                  : 0
                return (
                  <div key={phase.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold" style={{ color: phase.color }}>
                        Phase {phase.id} — {phase.label}
                      </span>
                      <span className="text-xs font-bold tabular-nums" style={{ color: phase.color }}>
                        {pEval.length > 0 ? `${pAvg.toFixed(1)}/5` : '—'}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: phase.border }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${(pAvg / 5) * 100}%`, backgroundColor: phase.color }} />
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {pDomains.map(d => {
                        const s = scores[d.id] ?? 0
                        return (
                          <button key={d.id}
                            onClick={() => { setActiveDomainId(d.id); setActivePhase(d.phase); setView('step') }}
                            className="text-[9px] px-1.5 py-0.5 rounded-full border transition-colors hover:opacity-80"
                            style={{
                              borderColor: s > 0 ? scoreColor(s) : 'var(--border)',
                              color: s > 0 ? scoreColor(s) : 'var(--text-muted)',
                              backgroundColor: s > 0 ? `${scoreColor(s)}15` : 'transparent',
                            }}
                            title={`${d.nom} : ${s > 0 ? `${s}/5` : 'Non évalué'}`}>
                            {d.qcIcone} {s > 0 ? `${s}/5` : '—'}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Top recommandations */}
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="text-xs font-semibold mb-3" style={{ color: 'var(--text)' }}>
              ⚠️ Domaines prioritaires ({topReco.length} plus faibles)
            </h3>
            {topReco.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Aucun domaine évalué</p>
            ) : (
              <div className="space-y-2">
                {topReco.map((d, i) => {
                  const s = scores[d.id] ?? 0
                  return (
                    <button key={d.id} onClick={() => { setActiveDomainId(d.id); setActivePhase(d.phase); setView('step') }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/60"
                      style={{ border: '1px solid var(--border)' }}>
                      <span className="text-xs font-bold w-4 tabular-nums" style={{ color: 'var(--text-muted)' }}>#{i + 1}</span>
                      <span className="text-xs flex-1 font-medium" style={{ color: 'var(--text)' }}>{d.qcIcone} {d.nom}</span>
                      <span className="text-xs font-bold" style={{ color: scoreColor(s) }}>{s}/5</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* ODD badges */}
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="text-xs font-semibold mb-3" style={{ color: 'var(--text)' }}>
              🌍 ODD couverts ({activeOdds.length}/17)
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 17 }, (_, i) => `ODD${i + 1}`).map(odd => {
                const active = activeOdds.includes(odd)
                const num = odd.replace('ODD', '')
                return (
                  <span key={odd}
                    className="text-[10px] font-bold px-2 py-1 rounded-full"
                    style={{
                      backgroundColor: active ? '#6366f1' : 'var(--bg)',
                      color: active ? 'white' : 'var(--text-muted)',
                      border: `1px solid ${active ? '#6366f1' : 'var(--border)'}`,
                    }}>
                    ODD {num}
                  </span>
                )
              })}
            </div>
          </div>
        </div>

        {/* Export — même ordre et style que le header : Excel | PDF | Annexes */}
        <div className="flex gap-2 justify-end">
          <button onClick={handleExportExcel} disabled={exportingExcel}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border transition-colors hover:opacity-80 disabled:opacity-50"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <Icon name="download" size={13} />
            {exportingExcel ? 'Export…' : 'Excel'}
          </button>
          <button onClick={handleExportPDF} disabled={exportingPDF || evalCount === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border transition-colors hover:opacity-80 disabled:opacity-50"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <Icon name="fileText" size={13} />
            {exportingPDF ? 'Génération…' : 'PDF'}
          </button>
          <button onClick={() => setShowAnnexes(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border transition-colors hover:opacity-80"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <Icon name="paperclip" size={13} />
            Annexes
          </button>
        </div>

      {showShare && diagnostic && (
        <ShareModal diagnosticId={diagnostic.id} onClose={() => setShowShare(false)} />
      )}
      {showAnnexes && diagnostic && (
        <GuidedAnnexesModal diagnosticId={diagnostic.id} onClose={() => setShowAnnexes(false)} />
      )}

      {/* Composant PDF caché — monté uniquement pendant l'export */}
      {pdfData && (
        <div style={{ position: 'fixed', left: -9999, top: 0, pointerEvents: 'none', zIndex: -1 }}>
          <PdfReportLazy data={pdfData} />
        </div>
      )}
      </div>
    )
  }

  // ── Vue QUESTIONNAIRE ─────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto">
      <ViewTabs tabs={GUIDED_TABS} active={view} onChange={setView} />
    <div className="flex gap-4">
      {/* Colonne phases + domaines */}
      <div className="w-52 flex-shrink-0">
        <div className="sticky top-0 space-y-1">
          {PHASES.map(phase => {
            const pDomains = DOMAINS.filter(d => d.phase === phase.id)
            const evaluated = pDomains.filter(d => (scores[d.id] ?? 0) > 0).length
            return (
              <div key={phase.id}>
                <button onClick={() => { setActivePhase(phase.id); setActiveDomainId(pDomains[0].id) }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition-colors"
                  style={activePhase === phase.id
                    ? { backgroundColor: phase.bg, color: phase.color, border: `1px solid ${phase.border}` }
                    : { color: 'var(--text-muted)', border: '1px solid transparent' }}>
                  <span className="flex-1">Phase {phase.id} — {phase.label}</span>
                  <span className="text-[10px] font-normal">{evaluated}/{pDomains.length}</span>
                </button>
                {activePhase === phase.id && (
                  <div className="ml-2 mt-0.5 space-y-0.5">
                    {pDomains.map(d => {
                      const s = scores[d.id] ?? 0
                      return (
                        <button key={d.id} onClick={() => setActiveDomainId(d.id)}
                          className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-left text-xs transition-colors"
                          style={activeDomainId === d.id
                            ? { backgroundColor: 'var(--bg-card)', color: 'var(--text)', fontWeight: 500 }
                            : { color: 'var(--text-muted)' }}>
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: scoreColor(s) }} />
                          <span className="flex-1 truncate">{d.nom}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

        </div>
      </div>

      {/* Domaine actif */}
      {activeDomain && (
        <div className="flex-1 min-w-0 rounded-xl border p-5"
          style={{ borderColor: phaseForActive.border, backgroundColor: `${phaseForActive.bg}` }}>

          {/* En-tête domaine */}
          <div className="mb-4">
            <div className="text-xs font-semibold mb-0.5" style={{ color: phaseForActive.color }}>
              Phase {phaseForActive.id} — {phaseForActive.label}
            </div>
            <h2 className="text-base font-bold mb-1" style={{ color: 'var(--text)' }}>
              {activeDomain.qcIcone} {activeDomain.nom}
            </h2>
            <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>{activeDomain.rationale}</p>
          </div>

          {/* Score de maturité */}
          <div className="mb-5">
            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text)' }}>
              Niveau de maturité RSE
            </label>
            <ScoreSelector score={scores[activeDomain.id] ?? 0} readOnly={readOnly}
              onChange={v => setScore(activeDomain.id, v)}
              suggestedScore={computeSuggestedScore(activeDomain, actionProgress, actionNa)} />
          </div>

          {/* Actions prioritaires */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text)' }}>
              Actions prioritaires
            </label>
            <ul className="space-y-1">
              {activeDomain.focusActionIndices
                .filter(i => i < activeDomain.actions.length)
                .map(i => {
                  const key = `${activeDomain.id}_${i}`
                  return (
                    <ActionItem key={key} text={activeDomain.actions[i]}
                      progress={actionProgress[key] ?? 0}
                      na={actionNa[key] ?? false}
                      note={notes[key] ?? ''}
                      isOpen={expandedKey === key}
                      readOnly={readOnly}
                      diagnosticId={diagnostic.id}
                      actionKey={key}
                      actionSections={sections[key] ?? []}
                      notesRemoteVersion={notesRemoteVersion}
                      onToggle={() => setExpandedKey(prev => prev === key ? null : key)}
                      onSetProgress={v => setProgress(key, v)}
                      onToggleNa={() => toggleNa(key)}
                      onNoteChange={v => updateNote(key, v)}
                      onSectionsChange={sects => updateSections(key, sects)} />
                  )
                })}
            </ul>
          </div>

          {/* Navigation entre domaines */}
          <div className="flex justify-between mt-5 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            {(() => {
              const idx = DOMAINS.findIndex(d => d.id === activeDomainId)
              const prev = DOMAINS[idx - 1]
              const next = DOMAINS[idx + 1]
              return (
                <>
                  <button onClick={() => { if (prev) { setActiveDomainId(prev.id); setActivePhase(prev.phase) } }}
                    disabled={!prev}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border transition-colors disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-slate-700"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                    <Icon name="chevronLeft" size={14} />
                    {prev ? `${prev.qcIcone} ${prev.nom}`.substring(0, 24) + '…' : 'Précédent'}
                  </button>
                  {next ? (
                    <button onClick={() => { setActiveDomainId(next.id); setActivePhase(next.phase) }}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg text-white transition-colors"
                      style={{ backgroundColor: phaseForActive.color }}>
                      {`${next.qcIcone} ${next.nom}`.substring(0, 24) + '…'}
                      <Icon name="chevronRight" size={14} />
                    </button>
                  ) : (
                    <button onClick={() => setView('summary')}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg text-white transition-colors"
                      style={{ backgroundColor: 'var(--accent)' }}>
                      Voir la synthèse
                      <Icon name="barChart" size={14} />
                    </button>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}

      {showShare && diagnostic && (
        <ShareModal diagnosticId={diagnostic.id} onClose={() => setShowShare(false)} />
      )}
      {showAnnexes && diagnostic && (
        <GuidedAnnexesModal diagnosticId={diagnostic.id} onClose={() => setShowAnnexes(false)} />
      )}

      {/* Composant PDF caché — monté uniquement pendant l'export */}
      {pdfData && (
        <div style={{ position: 'fixed', left: -9999, top: 0, pointerEvents: 'none', zIndex: -1 }}>
          <PdfReportLazy data={pdfData} />
        </div>
      )}
    </div>
    </div>
  )
}


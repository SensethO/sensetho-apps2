/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import type { RseContext } from '@/components/rse/RseAppShell'
import ConfirmModal from '@/components/ui/ConfirmModal'
import type { NoteSection } from '@/components/apps/GuidedActionNotePanel'
import ResponsableSelect, { useDiagnosticMembers, notifyMembersChanged } from '@/components/rse/ResponsableSelect'
import ShareAutocomplete from '@/components/apps/ShareAutocomplete'

const GuidedActionNotePanel = dynamic(() => import('@/components/apps/GuidedActionNotePanel'), {
  ssr: false,
  loading: () => <div className="py-3 text-xs text-gray-400 animate-pulse">Chargement éditeur…</div>
})

// ─── Données statiques Sapin II ───────────────────────────────────────────────

export const SAPIN2_AXES = [
  {
    id: 'gouvernance', label: 'Gouvernance & Engagement', icon: '🏛️',
    color: '#065f46', colorLight: '#d1fae5', weight: 0.20,
    description: "Code de conduite, engagement de la direction générale, désignation d'un Compliance Officer (référent AFA), et intégration de la conformité anti-corruption dans la stratégie d'entreprise.",
    criteres: [
      { id: 'gouv-code',       label: 'Code de conduite anti-corruption',                description: 'Un code de conduite définissant et illustrant les comportements interdits est formalisé, validé par la direction et diffusé à l\'ensemble des collaborateurs et des tiers.' },
      { id: 'gouv-direction',  label: 'Engagement de la direction générale',             description: 'La direction générale affiche un engagement visible et actif (« tone from the top »), alloue les ressources nécessaires et participe aux formations.' },
      { id: 'gouv-ressources', label: 'Ressources et organisation dédiées',              description: 'Un Compliance Officer ou responsable conformité est désigné, dispose d\'une ligne directe avec la direction et de ressources humaines, techniques et budgétaires adaptées.' },
      { id: 'gouv-strategie',  label: 'Intégration dans la stratégie d\'entreprise',    description: 'La conformité anti-corruption est intégrée dans les décisions stratégiques, les processus M&A, les nouvelles activités et les reportings aux instances de gouvernance (CA, comité d\'audit).' },
    ],
  },
  {
    id: 'cartographie', label: 'Cartographie des risques', icon: '🗺️',
    color: '#991b1b', colorLight: '#fee2e2', weight: 0.20,
    description: "Identification et évaluation des processus, activités et implantations géographiques exposés à des risques de corruption, de trafic d'influence et de facilitation. Mise à jour régulière et couverture des filiales et sous-traitants.",
    criteres: [
      { id: 'carto-processus',  label: 'Identification des processus et activités à risque', description: 'Les processus à risque sont identifiés (achats, ventes, relations institutionnelles, attributions de marchés, fusions-acquisitions) selon les recommandations de l\'AFA.' },
      { id: 'carto-evaluation', label: 'Évaluation de la probabilité et de l\'impact',       description: 'Pour chaque risque identifié, la probabilité d\'occurrence et l\'impact potentiel sont évalués, en tenant compte des mesures de maîtrise existantes (risque résiduel).' },
      { id: 'carto-hierarchie', label: 'Hiérarchisation et plan de mise à jour',             description: 'Les risques sont priorisés dans une cartographie formalisée, mise à jour au moins tous les 3 ans ou lors de changements significatifs (nouvelles activités, implantations, acquisitions).' },
      { id: 'carto-couverture', label: 'Couverture des filiales, sous-traitants et tiers',  description: 'La cartographie intègre les filiales françaises et étrangères, les sous-traitants et les tiers à risque élevé, avec adaptation aux contextes locaux (indices de corruption, secteur).' },
    ],
  },
  {
    id: 'prevention', label: 'Prévention & Contrôles internes', icon: '🛡️',
    color: '#1e40af', colorLight: '#dbeafe', weight: 0.20,
    description: "Programme de formation et sensibilisation, procédures internes (cadeaux, hospitalités, mécénat, lobbying, facilitation payments), procédures de contrôle comptable et audit de conformité.",
    criteres: [
      { id: 'prev-formation',   label: 'Programme de formation et sensibilisation',          description: 'Un programme de formation adapté aux profils à risque est déployé : e-learning, présentiel, sessions spécifiques pour les fonctions exposées (achats, commercial, direction). Traçabilité des formations.' },
      { id: 'prev-procedures',  label: 'Procédures internes (cadeaux, hospitalités, mécénat)', description: 'Des procédures claires encadrent les cadeaux et invitations (seuils, validation, registre), le mécénat et le parrainage, les relations avec les partis politiques et le lobbying.' },
      { id: 'prev-comptable',   label: 'Procédures de contrôle comptable',                   description: 'Les procédures comptables préviennent et détectent toute comptabilisation frauduleuse : séparation des pouvoirs, double validation, contrôle des notes de frais, gestion des intermédiaires.' },
      { id: 'prev-audit',       label: 'Contrôle interne et audit de conformité',             description: 'Des contrôles internes réguliers vérifient l\'application des procédures anti-corruption. L\'audit interne ou externe évalue périodiquement l\'efficacité du programme.' },
    ],
  },
  {
    id: 'tiers', label: 'Gestion des tiers', icon: '🤝',
    color: '#5b21b6', colorLight: '#ede9fe', weight: 0.20,
    description: "Identification des tiers à risque, due diligence préalable et continue, intégration de clauses contractuelles anti-corruption, et surveillance des intermédiaires, agents commerciaux et fournisseurs stratégiques.",
    criteres: [
      { id: 'tiers-carto',     label: 'Cartographie et identification des tiers à risque',  description: 'Les tiers présentant un risque de corruption sont identifiés et classés : intermédiaires, agents, distributeurs, fournisseurs dans des zones à risque, partenaires en JV, consultants.' },
      { id: 'tiers-diligence', label: 'Due diligence et évaluation des tiers',              description: 'Une due diligence proportionnée au risque est réalisée avant tout engagement : questionnaire de conformité, vérification des antécédents, bases de données (sanctions, PEP, adverse media).' },
      { id: 'tiers-contrats',  label: 'Clauses contractuelles anti-corruption',              description: 'Les contrats avec les tiers à risque incluent des clauses anti-corruption : déclarations de conformité, droit d\'audit, résiliation pour non-conformité, obligations de formation.' },
      { id: 'tiers-suivi',     label: 'Suivi, surveillance et réévaluation des tiers',      description: 'Les tiers font l\'objet d\'une surveillance continue et d\'une réévaluation périodique : alertes sur incidents, vérification des flux financiers, renouvellement de la due diligence.' },
    ],
  },
  {
    id: 'detection', label: 'Détection & Remédiation', icon: '🔍',
    color: '#b45309', colorLight: '#fef3c7', weight: 0.20,
    description: "Dispositif d'alerte interne conforme à la loi Sapin II et à la directive européenne sur les lanceurs d'alerte, gestion des incidents, régime disciplinaire proportionné et amélioration continue du programme.",
    criteres: [
      { id: 'det-alerte',     label: 'Dispositif d\'alerte interne (lanceurs d\'alerte)',   description: 'Un dispositif d\'alerte conforme à la loi Sapin II (art. 17-II-4°) et à la loi « Waserman » est déployé : canal sécurisé, confidentialité, protection du lanceur d\'alerte, accusé de réception sous 7 jours.' },
      { id: 'det-incidents',  label: 'Gestion des incidents et enquêtes internes',           description: 'Une procédure de gestion des incidents définit les étapes d\'enquête interne, les rôles, les délais et le traitement des signalements : qualification, investigation, décision, documentation.' },
      { id: 'det-sanctions',  label: 'Régime disciplinaire et sanctions',                   description: 'Un régime disciplinaire proportionné prévoit des sanctions pour les manquements au code de conduite et aux procédures anti-corruption, avec une application effective et documentée.' },
      { id: 'det-reporting',  label: 'Reporting, mesure d\'efficacité et amélioration continue', description: 'L\'efficacité du programme est mesurée (KPI : taux de formation, nombre d\'alertes, résultats d\'audit) et reportée aux instances de gouvernance. Des plans d\'amélioration sont définis et suivis.' },
    ],
  },
]

export const SAPIN2_NIVEAUX = [
  { value: 0, shortLabel: 'NC', label: 'Non conforme',     description: "Aucun dispositif — risque de mise en demeure AFA",                  pct: 0,    color: '#9ca3af', bg: 'bg-gray-100 dark:bg-gray-700',           text: 'text-gray-600 dark:text-gray-400'   },
  { value: 1, shortLabel: '1',  label: 'Initial',           description: "Prise de conscience, premières démarches informelles",               pct: 0.25, color: '#ef4444', bg: 'bg-red-50 dark:bg-red-900/20',          text: 'text-red-700 dark:text-red-400'     },
  { value: 2, shortLabel: '2',  label: 'En développement',  description: "Processus en cours de formalisation, manques significatifs",         pct: 0.50, color: '#f97316', bg: 'bg-orange-50 dark:bg-orange-900/20',    text: 'text-orange-700 dark:text-orange-400' },
  { value: 3, shortLabel: '3',  label: 'Conforme AFA',      description: "Programme AFA complet, exigences légales respectées",               pct: 0.75, color: '#22c55e', bg: 'bg-green-50 dark:bg-green-900/20',      text: 'text-green-700 dark:text-green-400' },
  { value: 4, shortLabel: '4',  label: 'Leader',            description: "Programme exemplaire, certifié ISO 37001, référence sectorielle",   pct: 1.0,  color: '#3b82f6', bg: 'bg-blue-50 dark:bg-blue-900/20',        text: 'text-blue-700 dark:text-blue-400'   },
]

const BADGE_LEVELS = [
  { label: 'Leader',           min: 85, color: '#3b82f6', icon: '🏆' },
  { label: 'Conforme AFA',     min: 60, color: '#16a34a', icon: '✅' },
  { label: 'En développement', min: 30, color: '#f97316', icon: '🔧' },
  { label: 'Non conforme',     min: 0,  color: '#dc2626', icon: '⚠️' },
]

export function calculateSapin2Score(niveaux: Record<string, number>): number {
  let total = 0
  for (const axe of SAPIN2_AXES) {
    let axeScore = 0
    const nb = axe.criteres.length
    for (const c of axe.criteres) {
      const n = niveaux[c.id] ?? 0
      axeScore += (SAPIN2_NIVEAUX[n]?.pct ?? 0) / nb
    }
    total += axeScore * axe.weight
  }
  return Math.round(total * 100)
}

function getBadge(score: number) {
  return BADGE_LEVELS.find(b => score >= b.min) ?? BADGE_LEVELS[BADGE_LEVELS.length - 1]
}

// ─── Types ────────────────────────────────────────────────────────────────────

type View = 'presentation' | 'dashboard' | 'diagnostic' | 'actions' | 'correspondances'

interface DiagnosticData { id: string; annee: number; statut: string; score_global: number | null }
interface Reponse { id?: string; critere_id: string; niveau: number; commentaire: string | null }
interface Action {
  id: string; critere_id: string; titre: string; description: string | null
  priorite: 'haute' | 'moyenne' | 'basse'; statut: 'a_faire' | 'en_cours' | 'termine'
  echeance: string | null; responsable: string | null; created_at: string
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function card(extra = '') { return `bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl ${extra}` }
function inputCls() { return 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500' }
function labelCls() { return 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1' }
function btnP(extra = '') { return `px-3 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium transition-colors disabled:opacity-50 ${extra}` }
function btnS(extra = '') { return `px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm transition-colors ${extra}` }

const PRIORITE_COLORS = {
  haute:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  moyenne: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  basse:   'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}
const STATUT_COLORS = {
  a_faire:  'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  en_cours: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  termine:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
}
const STATUT_LABELS = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' }
const PRIORITE_LABELS = { haute: '🔴 Haute', moyenne: '🟡 Moyenne', basse: '🟢 Basse' }

// ─── Vue Présentation ─────────────────────────────────────────────────────────

function PresentationView() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Hero */}
      <div className={card('p-6 space-y-4')}>
        <div className="flex items-center gap-3">
          <span className="text-4xl">⚖️</span>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Loi Sapin II — Conformité Anti-Corruption</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loi n°2016-1691 du 9 décembre 2016 — Programme de conformité anti-corruption obligatoire</p>
          </div>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          La loi Sapin II impose aux grandes entreprises françaises (plus de 500 salariés et plus de 100 M€ de chiffre d&apos;affaires)
          de mettre en place et de faire appliquer un <strong>programme anti-corruption</strong> comprenant 8 mesures obligatoires définies
          à l&apos;article 17. L&apos;Agence Française Anticorruption (AFA) contrôle la mise en œuvre de ces dispositifs
          et peut prononcer des sanctions.
        </p>
      </div>

      {/* Entreprises concernées & Sanctions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={card('p-5 border-l-4 border-teal-600')}>
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">🏢 Entreprises concernées</h3>
          <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <div className="flex items-start gap-2">
              <span className="text-teal-600 font-bold flex-shrink-0">▸</span>
              <span>Sociétés françaises de plus de <strong>500 salariés</strong></span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-teal-600 font-bold flex-shrink-0">▸</span>
              <span>Chiffre d&apos;affaires ou CA consolidé supérieur à <strong>100 millions d&apos;euros</strong></span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-teal-600 font-bold flex-shrink-0">▸</span>
              <span>Sociétés mères ou filiales répondant à ces critères <strong>au niveau du groupe</strong></span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-amber-600 font-bold flex-shrink-0">▸</span>
              <span>Application recommandée aux <strong>ETI et PME</strong> exposées (filiales, chaîne d&apos;appro.)</span>
            </div>
          </div>
        </div>

        <div className={card('p-5 border-l-4 border-red-500')}>
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">⚠️ Sanctions AFA</h3>
          <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <div className="flex items-start gap-2">
              <span className="font-bold text-red-600">•</span>
              <span>Amende jusqu&apos;à <strong>200 000 €</strong> pour les personnes physiques</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-red-600">•</span>
              <span>Amende jusqu&apos;à <strong>1 000 000 €</strong> pour les personnes morales</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-red-600">•</span>
              <span><strong>Publication de la sanction</strong> sur le site de l&apos;AFA (name &amp; shame)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-red-600">•</span>
              <span>Mise en demeure avec délai de mise en conformité</span>
            </div>
          </div>
        </div>
      </div>

      {/* 8 mesures obligatoires */}
      <div className={card('p-5')}>
        <h3 className="font-bold text-gray-900 dark:text-white mb-4">📋 Les 8 mesures obligatoires (art. 17 Sapin II)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            ['1', 'Code de conduite', 'Définit et illustre les comportements interdits au regard des risques de corruption'],
            ['2', 'Dispositif d\'alerte interne', 'Recueil des signalements d\'employés relatifs à des violations du code de conduite'],
            ['3', 'Cartographie des risques', 'Identifie, analyse et hiérarchise les risques d\'exposition de la société à des sollicitations externes à des fins de corruption'],
            ['4', 'Procédures d\'évaluation des tiers', 'Due diligence sur les clients, fournisseurs et intermédiaires au regard de la cartographie des risques'],
            ['5', 'Contrôles comptables', 'Vérifications internes ou externes pour s\'assurer que les comptes ne sont pas utilisés pour dissimuler des actes de corruption'],
            ['6', 'Plan de formation', 'Formations destinées aux cadres et personnels les plus exposés aux risques de corruption'],
            ['7', 'Régime disciplinaire', 'Sanctionne les manquements au code de conduite de la société'],
            ['8', 'Dispositif de contrôle et d\'évaluation interne', 'Évalue régulièrement l\'efficacité des mesures mises en place'],
          ].map(([num, title, desc]) => (
            <div key={num} className="flex gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/30">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-teal-700 text-white flex items-center justify-center text-xs font-bold">{num}</div>
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">{title}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Les 5 axes */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Les 5 axes du diagnostic Sapin II</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SAPIN2_AXES.map(axe => (
            <div key={axe.id} className={card('p-4')}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{axe.icon}</span>
                <div>
                  <div className="font-semibold text-sm" style={{ color: axe.color }}>{axe.label}</div>
                  <div className="text-xs text-gray-400">Poids : {Math.round(axe.weight * 100)}%</div>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 leading-relaxed">{axe.description}</p>
              <div className="space-y-1">
                {axe.criteres.map(c => (
                  <div key={c.id} className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                    <span className="mt-0.5 text-gray-400">•</span>
                    <span>{c.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Niveaux */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Niveaux de maturité du programme</h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {SAPIN2_NIVEAUX.map(n => (
            <div key={n.value} className={card('p-3 text-center')}>
              <div className="text-2xl font-bold" style={{ color: n.color }}>{n.shortLabel}</div>
              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mt-0.5">{n.label}</div>
              <div className="text-[10px] text-gray-400 mt-1 leading-tight">{n.description}</div>
              <div className="mt-2 text-xs font-medium" style={{ color: n.color }}>{Math.round(n.pct * 100)}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Badges */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Badge de maturité globale</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {BADGE_LEVELS.map(b => (
            <div key={b.label} className={card('p-4 text-center')}>
              <div className="text-3xl">{b.icon}</div>
              <div className="font-bold text-sm mt-1" style={{ color: b.color }}>{b.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">≥ {b.min}%</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">Seuils : 0-30% Non conforme · 30-60% En développement · 60-85% Conforme AFA · 85-100% Leader</p>
      </div>

      {/* Comment utiliser */}
      <div className={card('p-5 space-y-3')}>
        <h3 className="font-semibold text-gray-900 dark:text-white">💡 Comment utiliser cette application</h3>
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          {[
            ['1', 'Diagnostic Sapin II', 'Pour chacun des 20 critères, évaluez votre niveau de maturité (NC à 4), documentez vos pratiques et créez des actions d\'amélioration.'],
            ['2', 'Plan d\'actions', 'Visualisez et gérez toutes vos actions : priorité, responsable, échéance, statut d\'avancement.'],
            ['3', 'Documents & Preuves', 'Uploadez directement dans SharePoint vos preuves documentaires (code de conduite, formations, audits) classées par critère.'],
            ['4', 'Export Excel', 'Générez un rapport Excel structuré avec 6 onglets pour le reporting RSE et les contrôles AFA.'],
          ].map(([num, title, desc]) => (
            <div key={num} className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 flex items-center justify-center text-xs font-bold">{num}</div>
              <div><span className="font-medium">{title}</span> — {desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Vue Tableau de bord ─────────────────────────────────────────────────────

function TableauDeBordView({ reponses, actions, score }: { reponses: Record<string, Reponse>; actions: Action[]; score: number }) {
  const badge = getBadge(score)

  const axeStats = SAPIN2_AXES.map(axe => {
    const total = axe.criteres.length
    const niveaux = axe.criteres.map(c => reponses[c.id]?.niveau ?? 0)
    const pct = niveaux.reduce((s, n) => s + (SAPIN2_NIVEAUX[n]?.pct ?? 0), 0) / total
    const renseignes = niveaux.filter(n => n > 0).length
    return { ...axe, pct, renseignes, total }
  })

  const N = axeStats.length
  const cx = 170, cy = 165, r = 120

  function polarToXY(i: number, radius: number) {
    const angle = (i / N) * 2 * Math.PI - Math.PI / 2
    return { x: +(cx + radius * Math.cos(angle)).toFixed(1), y: +(cy + radius * Math.sin(angle)).toFixed(1) }
  }

  const levels = [0.25, 0.5, 0.75, 1.0]
  const dataPolygon = axeStats.map((axe, i) => {
    const { x, y } = polarToXY(i, r * Math.max(axe.pct, 0.03))
    return `${x},${y}`
  }).join(' ')

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={card('p-5 sm:col-span-1 flex flex-col items-center justify-center gap-2')}>
          <div className="text-4xl font-black text-gray-900 dark:text-white">{score}</div>
          <div className="text-sm text-gray-400">/ 100</div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold" style={{ background: `${badge.color}22`, color: badge.color }}>
            {badge.icon} {badge.label}
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
            <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${score}%`, background: badge.color }} />
          </div>
          <div className="text-xs text-gray-400 mt-1">Seuils : 30% En dév. · 60% Conforme AFA · 85% Leader</div>
        </div>

        <div className={card('p-4 sm:col-span-2')}>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Radar de maturité par axe</h3>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <svg viewBox="0 0 340 330" className="w-full sm:w-72 flex-shrink-0" style={{ maxHeight: 260 }}>
              {levels.map(level => {
                const pts = axeStats.map((_, i) => { const { x, y } = polarToXY(i, r * level); return `${x},${y}` }).join(' ')
                return <polygon key={level} points={pts} fill="none" stroke="var(--border, #374151)" strokeWidth={level === 1 ? '1.5' : '0.7'} />
              })}
              {axeStats.map((_, i) => { const { x, y } = polarToXY(i, r); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--border, #374151)" strokeWidth="1" strokeDasharray="3,3" /> })}
              <polygon points={dataPolygon} fill="#065f4622" stroke="#065f46" strokeWidth="2.5" strokeLinejoin="round" />
              {axeStats.map((axe, i) => { const { x, y } = polarToXY(i, r * Math.max(axe.pct, 0.03)); return <circle key={i} cx={x} cy={y} r="5" fill={axe.color} stroke="white" strokeWidth="1.5" /> })}
              {levels.map(level => { const { x, y } = polarToXY(0, r * level); return <text key={level} x={x} y={y - 5} textAnchor="middle" fontSize="8" fill="var(--text-muted, #6b7280)" fontWeight="500">{Math.round(level * 100)}%</text> })}
              {axeStats.map((axe, i) => {
                const { x, y } = polarToXY(i, r + 28)
                const anchor = x < cx - 8 ? 'end' : x > cx + 8 ? 'start' : 'middle'
                return <text key={i} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontSize="14" fill={axe.color} fontWeight="700">{axe.icon}</text>
              })}
            </svg>
            <div className="space-y-2 flex-1 w-full">
              {axeStats.map(axe => (
                <div key={axe.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{axe.icon}</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">{axe.label}</span>
                    </div>
                    <span className="font-bold" style={{ color: axe.color }}>{Math.round(axe.pct * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${Math.round(axe.pct * 100)}%`, background: axe.color }} />
                  </div>
                  <div className="text-[10px] text-gray-400">{axe.renseignes}/{axe.total} critères évalués</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Détail par axe */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Détail par axe et critère</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {axeStats.map(axe => (
            <div key={axe.id} className={card('p-4 space-y-2')}>
              <div className="flex items-center gap-2">
                <span className="text-xl">{axe.icon}</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{axe.label}</div>
                  <div className="text-xs text-gray-400">Poids {Math.round(axe.weight * 100)}% · Score : <span className="font-bold" style={{ color: axe.color }}>{Math.round(axe.pct * 100)}%</span></div>
                </div>
              </div>
              <div className="space-y-1.5 ml-1">
                {axe.criteres.map(c => {
                  const n = reponses[c.id]?.niveau ?? 0
                  const niv = SAPIN2_NIVEAUX[n]
                  return (
                    <div key={c.id} className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0" style={{ background: (niv?.color ?? '#9ca3af') + '33', color: niv?.color ?? '#9ca3af' }}>
                        {niv?.shortLabel ?? 'NC'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-gray-600 dark:text-gray-400 truncate">{c.label}</div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 mt-0.5">
                          <div className="h-1 rounded-full" style={{ width: `${Math.round((niv?.pct ?? 0) * 100)}%`, background: niv?.color ?? '#9ca3af' }} />
                        </div>
                      </div>
                      <div className="text-[9px] font-bold flex-shrink-0" style={{ color: niv?.color ?? '#9ca3af' }}>{Math.round((niv?.pct ?? 0) * 100)}%</div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Synthèse actions */}
      <div className={card('p-4')}>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Plan d&apos;actions — Synthèse</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'À faire',   count: actions.filter(a => a.statut === 'a_faire').length,  color: 'text-gray-600 dark:text-gray-400' },
            { label: 'En cours',  count: actions.filter(a => a.statut === 'en_cours').length, color: 'text-blue-600 dark:text-blue-400' },
            { label: 'Terminées', count: actions.filter(a => a.statut === 'termine').length,  color: 'text-green-600 dark:text-green-400' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>
        {actions.length > 0 && (
          <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div className="h-2 rounded-full bg-teal-600 transition-all" style={{ width: `${Math.round(actions.filter(a => a.statut === 'termine').length / actions.length * 100)}%` }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Vue Correspondances ──────────────────────────────────────────────────────

const CORRESPONDANCES_SAPIN2 = [
  {
    categorie: "Applications RSE Sens'ethO",
    icon: '🏠', color: 'indigo',
    items: [
      {
        ref: 'Devoir de Vigilance', icon: '👁️', route: '/rse/vigilance',
        desc: 'Loi n°2017-399 — complémentaire à Sapin II : la cartographie des risques de corruption inclut les risques liés aux tiers et à la chaîne d\'approvisionnement.',
        liens: [
          { axe: 'cartographie', label: 'Cartographie', ref: 'Devoir de Vigilance — Cartographie des risques dans la chaîne de sous-traitance' },
          { axe: 'tiers',        label: 'Tiers',        ref: 'Devoir de Vigilance — Évaluation et suivi des filiales et sous-traitants' },
        ],
      },
      {
        ref: 'EcoVadis Diagnostic', icon: '⭐', route: '/rse/ecovadis',
        desc: 'Le thème Éthique d\'EcoVadis évalue directement les mesures anti-corruption : code de conduite, procédures fournisseurs, formation. Un programme Sapin II solide améliore la note.',
        liens: [
          { axe: 'gouvernance', label: 'Gouvernance', ref: 'EcoVadis Éthique — Code de conduite et politiques anti-corruption' },
          { axe: 'tiers',       label: 'Tiers',       ref: 'EcoVadis Éthique — Procédures d\'évaluation des fournisseurs et tiers' },
        ],
      },
      {
        ref: 'VSME EFRAG', icon: '📊', route: '/rse/vsme-efrag',
        desc: 'Standard volontaire PME (VSME EFRAG) — le volet G1 Gouvernance couvre la gestion des risques et le contrôle interne, aligné avec les exigences Sapin II.',
        liens: [
          { axe: 'gouvernance', label: 'Gouvernance', ref: 'VSME G1 — Gouvernance, gestion des risques et contrôle interne' },
          { axe: 'prevention',  label: 'Prévention',  ref: 'VSME G1 — Procédures de conformité et audit interne' },
        ],
      },
    ],
  },
  {
    categorie: 'Référentiels légaux et réglementaires',
    icon: '⚖️', color: 'blue',
    items: [
      {
        ref: 'Loi Sapin II (n°2016-1691)', icon: '📜', route: null,
        desc: 'Loi du 9 décembre 2016 relative à la transparence, à la lutte contre la corruption et à la modernisation de la vie économique — texte fondateur du programme anti-corruption français.',
        liens: [
          { axe: 'gouvernance',  label: 'Gouvernance',  ref: 'Art. 17-I — Code de conduite, engagement de la direction' },
          { axe: 'cartographie', label: 'Cartographie', ref: 'Art. 17-II-3° — Cartographie des risques de corruption' },
          { axe: 'prevention',   label: 'Prévention',   ref: 'Art. 17-II-5°, 6° — Contrôles comptables et formation' },
          { axe: 'tiers',        label: 'Tiers',        ref: 'Art. 17-II-4° — Procédures d\'évaluation des tiers' },
          { axe: 'detection',    label: 'Détection',    ref: 'Art. 17-II-2° et 7° — Dispositif d\'alerte et régime disciplinaire' },
        ],
      },
      {
        ref: 'Convention OCDE anti-corruption (1997)', icon: '🌍', route: null,
        desc: 'Convention sur la lutte contre la corruption d\'agents publics étrangers dans les transactions commerciales internationales — ratifiée par la France en 2000.',
        liens: [
          { axe: 'tiers',        label: 'Tiers',        ref: 'OCDE — Due diligence sur les intermédiaires dans les marchés étrangers' },
          { axe: 'gouvernance',  label: 'Gouvernance',  ref: 'OCDE — Engagement de la direction contre la corruption transnationale' },
        ],
      },
      {
        ref: 'FCPA (États-Unis)', icon: '🇺🇸', route: null,
        desc: 'Foreign Corrupt Practices Act — applicable aux entreprises françaises cotées aux États-Unis ou ayant des opérations américaines. Amendes potentiellement très élevées.',
        liens: [
          { axe: 'tiers',        label: 'Tiers',        ref: 'FCPA — Due diligence renforcée sur les intermédiaires étrangers' },
          { axe: 'prevention',   label: 'Prévention',   ref: 'FCPA — Contrôles comptables stricts et documentation' },
        ],
      },
      {
        ref: 'UK Bribery Act (2010)', icon: '🇬🇧', route: null,
        desc: 'Loi britannique sur la corruption — applicable aux entreprises ayant une activité au Royaume-Uni. Défense de « procédures adéquates » similaire à Sapin II.',
        liens: [
          { axe: 'gouvernance',  label: 'Gouvernance',  ref: 'UK Bribery Act — « Adequate procedures » : 6 principes de compliance' },
          { axe: 'tiers',        label: 'Tiers',        ref: 'UK Bribery Act — Due diligence sur les partenaires commerciaux' },
        ],
      },
    ],
  },
  {
    categorie: 'Standards et référentiels internationaux',
    icon: '🌐', color: 'green',
    items: [
      {
        ref: 'ISO 37001 — Anti-corruption', icon: '🏅', route: null,
        desc: 'Norme internationale de système de management anti-corruption — certification reconnue par l\'AFA comme démonstration de meilleures pratiques.',
        liens: [
          { axe: 'gouvernance',  label: 'Gouvernance',  ref: 'ISO 37001 — Engagement de la direction et politique anti-corruption' },
          { axe: 'cartographie', label: 'Cartographie', ref: 'ISO 37001 — Évaluation des risques de corruption (clause 6.1)' },
          { axe: 'prevention',   label: 'Prévention',   ref: 'ISO 37001 — Contrôles opérationnels et formation (clauses 8-7)' },
          { axe: 'tiers',        label: 'Tiers',        ref: 'ISO 37001 — Due diligence sur les partenaires d\'affaires (clause 8.2)' },
          { axe: 'detection',    label: 'Détection',    ref: 'ISO 37001 — Surveillance, signalement et amélioration continue (clauses 9-10)' },
        ],
      },
      {
        ref: 'GRI 205 — Anti-corruption', icon: '📋', route: null,
        desc: 'GRI 205 : disclosure sur les risques de corruption, formations, incidents confirmés et procédures disciplinaires. Requis pour le reporting CSRD.',
        liens: [
          { axe: 'cartographie', label: 'Cartographie', ref: 'GRI 205-1 — Opérations évaluées pour des risques de corruption' },
          { axe: 'prevention',   label: 'Prévention',   ref: 'GRI 205-2 — Communication et formation sur les politiques et procédures' },
          { axe: 'detection',    label: 'Détection',    ref: 'GRI 205-3 — Incidents de corruption confirmés et mesures prises' },
        ],
      },
      {
        ref: 'CSRD — ESRS G1 Éthique', icon: '📊', route: null,
        desc: 'Corporate Sustainability Reporting Directive — ESRS G1 traite de la gouvernance, de la culture d\'entreprise, de l\'anti-corruption et de l\'anti-concurrence.',
        liens: [
          { axe: 'gouvernance',  label: 'Gouvernance',  ref: 'ESRS G1-1 — Politiques relatives aux affaires responsables' },
          { axe: 'detection',    label: 'Détection',    ref: 'ESRS G1-3 — Prévention et détection de la corruption et des pots-de-vin' },
          { axe: 'prevention',   label: 'Prévention',   ref: 'ESRS G1-4 — Incidents de corruption, enquêtes et procédures' },
        ],
      },
      {
        ref: 'UN SDG 16 — Paix & Justice', icon: '⚖️', route: null,
        desc: 'Objectif de Développement Durable 16 — Réduire considérablement la corruption et les pots-de-vin sous toutes leurs formes (cible 16.5).',
        liens: [
          { axe: 'gouvernance',  label: 'Gouvernance',  ref: 'SDG 16.6 — Mettre en place des institutions efficaces, responsables et transparentes' },
          { axe: 'detection',    label: 'Détection',    ref: 'SDG 16.5 — Réduire nettement la corruption et les pots-de-vin sous toutes leurs formes' },
        ],
      },
      {
        ref: 'ISO 26000 — Domaine 4 (Droits humains)', icon: '⚙️', route: '/rse/iso26000',
        desc: 'ISO 26000 Domaine 4 et 5 — Droits de l\'Homme et relations du travail : anti-corruption contribue à la gouvernance responsable et aux pratiques équitables.',
        liens: [
          { axe: 'gouvernance',  label: 'Gouvernance',  ref: 'ISO 26000 — 6.6.3 : Concurrence loyale et pratiques anticorruption' },
          { axe: 'tiers',        label: 'Tiers',        ref: 'ISO 26000 — 6.3.5 : Vigilance sur la chaîne de valeur' },
        ],
      },
    ],
  },
]

const AXE_BADGE_CLS: Record<string, string> = {
  gouvernance:  'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  cartographie: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  prevention:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  tiers:        'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  detection:    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

function CorrespondancesView() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className={card('p-4')}>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          La loi Sapin II s&apos;inscrit dans un écosystème mondial de lutte contre la corruption.
          Les correspondances ci-dessous vous permettent de mutualiser vos efforts de conformité et d&apos;aligner
          votre programme Sapin II avec l&apos;ISO 37001, la CSRD (ESRS G1), le FCPA, l&apos;UK Bribery Act,
          les référentiels EcoVadis et les ODD.
        </p>
      </div>

      {CORRESPONDANCES_SAPIN2.map(cat => (
        <div key={cat.categorie} className="space-y-3">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <span>{cat.icon}</span>{cat.categorie}
          </h3>
          <div className="space-y-3">
            {cat.items.map(item => (
              <div key={item.ref} className={card('p-4')}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0 mt-0.5">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 dark:text-white">{item.ref}</span>
                      {item.route && (
                        <a href={item.route} className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 hover:bg-indigo-200 transition-colors font-medium">
                          ↗ Ouvrir dans Sens&apos;ethO
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.desc}</p>
                    {item.liens.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {item.liens.map((l, i) => {
                          const axe = SAPIN2_AXES.find(a => a.id === l.axe)
                          return (
                            <div key={i} className="flex items-start gap-2 flex-wrap">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${AXE_BADGE_CLS[l.axe] ?? ''}`}>
                                {axe?.icon} {l.label}
                              </span>
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 flex-1">{l.ref}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Panneau critère (Diagnostic) ─────────────────────────────────────────────

interface SAxe { id: string; label: string; icon: string; color: string; colorLight: string; weight: number; description: string; criteres: SCritere[] }
interface SCritere { id: string; label: string; description: string }

interface CriterePanelProps {
  axe: SAxe; critere: SCritere; reponse: Reponse | null; actions: Action[]
  diagnosticId: string; allNotes: Record<string, string>; allNoteSections: Record<string, NoteSection[]>
  onReponseChange: (critere_id: string, niveau: number, commentaire: string) => void
  onActionsChange: (actions: Action[]) => void
  onNoteChange: (key: string, content: string) => void
  onNoteSectionsChange: (key: string, sections: NoteSection[]) => void
}

function CriterePanel({ axe, critere, reponse, actions, diagnosticId, allNotes, allNoteSections, onReponseChange, onActionsChange, onNoteChange, onNoteSectionsChange }: CriterePanelProps) {
  const [niveau, setNiveau] = useState(reponse?.niveau ?? 0)
  const [commentaire, setCommentaire] = useState(reponse?.commentaire ?? '')
  const [savingReponse, setSavingReponse] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [showActionForm, setShowActionForm] = useState(false)
  const [actionForm, setActionForm] = useState({ titre: '', description: '', priorite: 'moyenne', echeance: '', responsable: '' })
  const [savingAction, setSavingAction] = useState(false)

  const [editingActionId, setEditingActionId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<Action>>({})
  const [savingEdit, setSavingEdit] = useState(false)
  const [expandedActionNoteId, setExpandedActionNoteId] = useState<string | null>(null)

  const members = useDiagnosticMembers('sapin2', diagnosticId)

  const critereActions = actions.filter(a => a.critere_id === critere.id)

  useEffect(() => {
    setNiveau(reponse?.niveau ?? 0)
    setCommentaire(reponse?.commentaire ?? '')
  }, [reponse])

  function handleNiveauChange(n: number) { setNiveau(n); scheduleSave(n, commentaire) }
  function handleCommentaireChange(c: string) { setCommentaire(c); scheduleSave(niveau, c) }

  function scheduleSave(n: number, c: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSavingReponse(true)
      onReponseChange(critere.id, n, c)
      setSavingReponse(false)
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 2000)
    }, 800)
  }

  async function addAction() {
    if (!actionForm.titre.trim()) return
    setSavingAction(true)
    const res = await fetch(`/api/sapin2/${diagnosticId}/actions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ critere_id: critere.id, ...actionForm }),
    })
    if (res.ok) {
      const { data } = await res.json()
      onActionsChange([...actions, data])
      setActionForm({ titre: '', description: '', priorite: 'moyenne', echeance: '', responsable: '' })
      setShowActionForm(false)
    }
    setSavingAction(false)
  }

  const [actionToDelete, setActionToDelete] = useState<string | null>(null)
  async function deleteAction(id: string) {
    await fetch(`/api/sapin2/${diagnosticId}/actions?action_id=${id}`, { method: 'DELETE' })
    onActionsChange(actions.filter(a => a.id !== id))
  }

  async function saveEdit(id: string) {
    setSavingEdit(true)
    const res = await fetch(`/api/sapin2/${diagnosticId}/actions?action_id=${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editData),
    })
    if (res.ok) {
      const { data } = await res.json()
      onActionsChange(actions.map(a => a.id === id ? data : a))
      setEditingActionId(null)
    }
    setSavingEdit(false)
  }

  async function toggleActionStatut(action: Action) {
    const next = action.statut === 'a_faire' ? 'en_cours' : action.statut === 'en_cours' ? 'termine' : 'a_faire'
    const res = await fetch(`/api/sapin2/${diagnosticId}/actions?action_id=${action.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: next }),
    })
    if (res.ok) {
      const { data } = await res.json()
      onActionsChange(actions.map(a => a.id === action.id ? data : a))
    }
  }

  const niv = SAPIN2_NIVEAUX[niveau]

  return (
    <div className="space-y-5">
      <div className="rounded-xl p-4 border border-gray-200 dark:border-gray-700" style={{ background: axe.colorLight + '80' }}>
        <h3 className="font-bold text-base" style={{ color: axe.color }}>{critere.label}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{critere.description}</p>
      </div>

      <div className={card('p-4 space-y-3')}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">Niveau de maturité</div>
          {savingReponse && <span className="text-xs text-gray-400 animate-pulse">Enregistrement…</span>}
          {savedOk && !savingReponse && <span className="text-xs text-green-600 dark:text-green-400">✓ Sauvegardé</span>}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {SAPIN2_NIVEAUX.map(n => (
            <button key={n.value} onClick={() => handleNiveauChange(n.value)}
              className={`p-2 rounded-lg border-2 text-center transition-all ${niveau === n.value ? `${n.bg} ring-2 ring-offset-1` : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}
              style={{ borderColor: niveau === n.value ? n.color : undefined }}>
              <div className="text-lg font-bold" style={{ color: n.color }}>{n.shortLabel}</div>
              <div className="text-[10px] font-medium text-gray-600 dark:text-gray-400 mt-0.5">{n.label}</div>
            </button>
          ))}
        </div>
        {niv && <div className={`text-xs px-3 py-1.5 rounded-lg ${niv.bg} ${niv.text} font-medium`}>{niv.description} ({Math.round(niv.pct * 100)}%)</div>}
      </div>

      <div className={card('p-4 space-y-2')}>
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">📝 Commentaire & contexte</label>
        <p className="text-xs text-gray-500 dark:text-gray-400">Décrivez vos dispositifs actuels, les preuves disponibles, les manques identifiés et les actions prévues.</p>
        <textarea
          value={commentaire}
          onChange={e => handleCommentaireChange(e.target.value)}
          rows={4}
          placeholder="Ex : Notre code de conduite a été formalisé en 2023 et distribué à tous les collaborateurs. Une formation e-learning est disponible mais le taux de complétion est de 40%…"
          className={`${inputCls()} resize-y`}
        />
        <GuidedActionNotePanel
          diagnosticId={diagnosticId}
          actionKey={critere.id}
          apiBase="/api/sapin2"
          noteTable="sapin2_notes"
          readOnly={false}
          note={allNotes[critere.id] ?? ''}
          onNoteChange={v => onNoteChange(critere.id, v)}
          initialSections={allNoteSections[critere.id] ?? []}
          onSectionsChange={s => onNoteSectionsChange(critere.id, s)}
        />
      </div>

      <div className={card('p-4 space-y-3')}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            🎯 Actions d&apos;amélioration
            {critereActions.length > 0 && (
              <span className="ml-2 text-xs bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 px-1.5 py-0.5 rounded-full font-medium">
                {critereActions.filter(a => a.statut === 'termine').length}/{critereActions.length}
              </span>
            )}
          </div>
          <button onClick={() => setShowActionForm(v => !v)} className={btnP('text-xs py-1.5')}>+ Action</button>
        </div>

        {showActionForm && (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 space-y-2 border border-gray-200 dark:border-gray-700">
            <div><label className={labelCls()}>Titre *</label>
              <input className={inputCls()} value={actionForm.titre} onChange={e => setActionForm(f => ({ ...f, titre: e.target.value }))} placeholder="Ex : Mettre à jour le code de conduite et organiser une session de sensibilisation direction" />
            </div>
            <div><label className={labelCls()}>Description</label>
              <textarea className={`${inputCls()} resize-none`} rows={2} value={actionForm.description} onChange={e => setActionForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><label className={labelCls()}>Priorité</label>
                <select className={inputCls()} value={actionForm.priorite} onChange={e => setActionForm(f => ({ ...f, priorite: e.target.value }))}>
                  <option value="haute">🔴 Haute</option><option value="moyenne">🟡 Moyenne</option><option value="basse">🟢 Basse</option>
                </select>
              </div>
              <div><label className={labelCls()}>Échéance</label>
                <input type="date" className={inputCls()} value={actionForm.echeance} onChange={e => setActionForm(f => ({ ...f, echeance: e.target.value }))} />
              </div>
              <div><label className={labelCls()}>Responsable</label>
                <ResponsableSelect className={inputCls()} value={actionForm.responsable} members={members} onChange={v => setActionForm(f => ({ ...f, responsable: v }))} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button className={btnS()} onClick={() => setShowActionForm(false)}>Annuler</button>
              <button className={btnP()} onClick={addAction} disabled={savingAction || !actionForm.titre.trim()}>{savingAction ? '…' : '✓ Créer'}</button>
            </div>
          </div>
        )}

        {critereActions.length === 0 && !showActionForm && (
          <p className="text-xs text-gray-400 text-center py-3">Aucune action — créez des mesures concrètes pour progresser vers la conformité AFA</p>
        )}

        <div className="space-y-3">
          {critereActions.map(a => {
            const actionNoteKey = `${critere.id}_action_${a.id}`
            const isEditing = editingActionId === a.id
            const isExpanded = expandedActionNoteId === a.id
            const incomplete = !a.responsable && !a.echeance
            return (
              <div key={a.id} className={`rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden${incomplete ? ' ring-1 ring-amber-300 dark:ring-amber-500/40' : ''}`}>
                {isEditing ? (
                  <div className="p-3 space-y-2 bg-gray-50 dark:bg-gray-900/50">
                    <div><label className={labelCls()}>Titre *</label>
                      <input className={inputCls()} value={editData.titre ?? a.titre} onChange={e => setEditData(d => ({ ...d, titre: e.target.value }))} />
                    </div>
                    <div><label className={labelCls()}>Description</label>
                      <textarea className={`${inputCls()} resize-none`} rows={2} value={editData.description ?? a.description ?? ''} onChange={e => setEditData(d => ({ ...d, description: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div><label className={labelCls()}>Priorité</label>
                        <select className={inputCls()} value={editData.priorite ?? a.priorite} onChange={e => setEditData(d => ({ ...d, priorite: e.target.value as Action['priorite'] }))}>
                          <option value="haute">🔴 Haute</option><option value="moyenne">🟡 Moyenne</option><option value="basse">🟢 Basse</option>
                        </select>
                      </div>
                      <div><label className={labelCls()}>Statut</label>
                        <select className={inputCls()} value={editData.statut ?? a.statut} onChange={e => setEditData(d => ({ ...d, statut: e.target.value as Action['statut'] }))}>
                          <option value="a_faire">À faire</option><option value="en_cours">En cours</option><option value="termine">Terminé</option>
                        </select>
                      </div>
                      <div><label className={labelCls()}>Échéance</label>
                        <input type="date" className={inputCls()} value={editData.echeance ?? a.echeance ?? ''} onChange={e => setEditData(d => ({ ...d, echeance: e.target.value }))} />
                      </div>
                      <div><label className={labelCls()}>Responsable</label>
                        <ResponsableSelect className={inputCls()} value={editData.responsable ?? a.responsable ?? ''} members={members} onChange={v => setEditData(d => ({ ...d, responsable: v }))} />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button className={btnS('text-xs py-1')} onClick={() => setEditingActionId(null)}>Annuler</button>
                      <button className={btnP('text-xs py-1')} onClick={() => saveEdit(a.id)} disabled={savingEdit}>{savingEdit ? '…' : '✓ Sauvegarder'}</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 p-2.5 bg-gray-50 dark:bg-gray-900/30">
                    <button onClick={() => toggleActionStatut(a)} title="Changer statut"
                      className={`mt-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUT_COLORS[a.statut]}`}>
                      {STATUT_LABELS[a.statut]}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-medium ${a.statut === 'termine' ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>{a.titre}</div>
                      {a.description && <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{a.description}</div>}
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[9px] px-1 py-0.5 rounded ${PRIORITE_COLORS[a.priorite]}`}>{PRIORITE_LABELS[a.priorite]}</span>
                        {a.echeance && <span className="text-[9px] text-gray-400">📅 {a.echeance}</span>}
                        {a.responsable && <span className="text-[9px] text-gray-400">👤 {a.responsable}</span>}
                        {incomplete && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">⚠ À compléter</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => { setEditingActionId(a.id); setEditData({}) }}
                        className="text-gray-400 hover:text-blue-500 text-xs px-1 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">✏️</button>
                      <button onClick={() => setActionToDelete(a.id)} className="text-gray-300 hover:text-red-400 text-xs px-1">✕</button>
                    </div>
                  </div>
                )}
                <div className="border-t border-gray-100 dark:border-gray-700/50">
                  <button onClick={() => setExpandedActionNoteId(isExpanded ? null : a.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <span>📄 Notes & documents</span>
                    {(allNotes[actionNoteKey] || (allNoteSections[actionNoteKey] ?? []).length > 0) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                    )}
                    <span className="ml-auto">{isExpanded ? '▾' : '›'}</span>
                  </button>
                  {isExpanded && (
                    <div className="px-2 pb-2">
                      <GuidedActionNotePanel
                        diagnosticId={diagnosticId}
                        actionKey={actionNoteKey}
                        apiBase="/api/sapin2"
                        noteTable="sapin2_notes"
                        readOnly={false}
                        note={allNotes[actionNoteKey] ?? ''}
                        onNoteChange={v => onNoteChange(actionNoteKey, v)}
                        initialSections={allNoteSections[actionNoteKey] ?? []}
                        onSectionsChange={s => onNoteSectionsChange(actionNoteKey, s)}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <ConfirmModal
        open={!!actionToDelete}
        title="Supprimer l'action"
        message="L'action sera définitivement supprimée."
        onConfirm={() => { if (actionToDelete) deleteAction(actionToDelete); setActionToDelete(null) }}
        onCancel={() => setActionToDelete(null)}
      />
    </div>
  )
}

// ─── Vue Diagnostic ───────────────────────────────────────────────────────────

function DiagnosticView({ diagnostic, reponses, actions, allNotes, allNoteSections, onReponseChange, onActionsChange, onNoteChange, onNoteSectionsChange }: {
  diagnostic: DiagnosticData; reponses: Record<string, Reponse>; actions: Action[]
  allNotes: Record<string, string>; allNoteSections: Record<string, NoteSection[]>
  onReponseChange: (critere_id: string, niveau: number, commentaire: string) => void
  onActionsChange: (a: Action[]) => void
  onNoteChange: (key: string, v: string) => void
  onNoteSectionsChange: (key: string, s: NoteSection[]) => void
}) {
  const [activeAxe, setActiveAxe] = useState(SAPIN2_AXES[0].id)
  const [activeCritere, setActiveCritere] = useState<string | null>(SAPIN2_AXES[0].criteres[0].id)

  const niveaux: Record<string, number> = {}
  for (const [k, v] of Object.entries(reponses)) niveaux[k] = v.niveau
  const scoreGlobal = calculateSapin2Score(niveaux)
  const badge = getBadge(scoreGlobal)

  return (
    <div className="space-y-4">
      <div className={card('p-4')}>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Score simulé</div>
            <div className="flex items-center gap-3">
              <div className="text-3xl font-black text-gray-900 dark:text-white">{scoreGlobal}</div>
              <div className="text-sm text-gray-400">/ 100</div>
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: `${badge.color}22`, color: badge.color }}>
                {badge.icon} {badge.label}
              </div>
            </div>
            <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${scoreGlobal}%`, background: badge.color }} />
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {SAPIN2_AXES.map(axe => {
              const axeNiveaux = axe.criteres.map(c => niveaux[c.id] ?? 0)
              const axePct = Math.round(axeNiveaux.reduce((s, n) => s + SAPIN2_NIVEAUX[n].pct, 0) / axe.criteres.length * 100)
              const renseignes = axe.criteres.filter(c => (niveaux[c.id] ?? 0) > 0).length
              return (
                <div key={axe.id} className="text-center p-2 rounded-lg" style={{ background: axe.colorLight }}>
                  <div className="text-base">{axe.icon}</div>
                  <div className="text-sm font-bold" style={{ color: axe.color }}>{axePct}%</div>
                  <div className="text-[9px] text-gray-400">{renseignes}/{axe.criteres.length}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <div className={card('overflow-hidden')}>
          <div className="space-y-1 p-2">
            {SAPIN2_AXES.map(axe => {
              const isOpen = activeAxe === axe.id
              const renseignes = axe.criteres.filter(c => (niveaux[c.id] ?? 0) > 0).length
              return (
                <div key={axe.id}>
                  <button
                    onClick={() => { setActiveAxe(axe.id); if (!isOpen) setActiveCritere(axe.criteres[0].id) }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors"
                    style={isOpen ? { background: axe.colorLight, color: axe.color } : {}}
                  >
                    <span className="text-base">{axe.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate">{axe.label}</div>
                      <div className="text-[10px] text-gray-400">{renseignes}/{axe.criteres.length} critères · complétude {Math.round(axe.criteres.reduce((s, c) => s + (niveaux[c.id] ?? 0) / 4, 0) / axe.criteres.length * 100)}%</div>
                    </div>
                    <span className="text-xs">{isOpen ? '▾' : '›'}</span>
                  </button>
                  {isOpen && (
                    <div className="ml-3 mt-1 space-y-0.5">
                      {axe.criteres.map(c => {
                        const n = niveaux[c.id] ?? 0
                        const niv = SAPIN2_NIVEAUX[n]
                        const isActive = activeCritere === c.id
                        return (
                          <button key={c.id} onClick={() => setActiveCritere(c.id)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${isActive ? 'bg-gray-900 dark:bg-white/10 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'}`}>
                            <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0"
                              style={{ background: niv.color + '33', color: niv.color }}>
                              {niv.shortLabel}
                            </div>
                            <span className="text-[10px] font-medium truncate flex-1">{c.label}</span>
                            {actions.filter(a => a.critere_id === c.id).length > 0 && (
                              <span className="text-[9px] text-gray-400 flex-shrink-0">{actions.filter(a => a.critere_id === c.id).length}🎯</span>
                            )}
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

        <div className="min-w-0">
          {activeCritere ? (() => {
            const axe = SAPIN2_AXES.find(a => a.criteres.some(c => c.id === activeCritere))!
            const critere = axe.criteres.find(c => c.id === activeCritere)!
            return (
              <CriterePanel key={activeCritere} axe={axe} critere={critere}
                reponse={reponses[activeCritere] ?? null} actions={actions}
                diagnosticId={diagnostic.id} allNotes={allNotes} allNoteSections={allNoteSections}
                onReponseChange={onReponseChange} onActionsChange={onActionsChange}
                onNoteChange={onNoteChange} onNoteSectionsChange={onNoteSectionsChange} />
            )
          })() : (
            <div className={card('p-8 text-center')}>
              <p className="text-gray-400 text-sm">Sélectionnez un critère pour commencer l&apos;évaluation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Vue Plan d'actions ───────────────────────────────────────────────────────

function ActionsView({ diagnostic, actions, onActionsChange }: { diagnostic: DiagnosticData; actions: Action[]; onActionsChange: (a: Action[]) => void }) {
  const [filterAxe, setFilterAxe] = useState<string>('all')
  const [filterPriorite, setFilterPriorite] = useState<string>('all')
  const [filterStatut, setFilterStatut] = useState<string>('all')
  const [editId, setEditId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<Action>>({})
  const [saving, setSaving] = useState(false)

  const members = useDiagnosticMembers('sapin2', diagnostic.id)

  const filtered = actions.filter(a => {
    const axe = SAPIN2_AXES.find(x => x.criteres.some(c => c.id === a.critere_id))
    if (filterAxe !== 'all' && axe?.id !== filterAxe) return false
    if (filterPriorite !== 'all' && a.priorite !== filterPriorite) return false
    if (filterStatut !== 'all' && a.statut !== filterStatut) return false
    return true
  })

  const termines = actions.filter(a => a.statut === 'termine').length

  async function saveEdit(id: string) {
    setSaving(true)
    const res = await fetch(`/api/sapin2/${diagnostic.id}/actions?action_id=${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editData),
    })
    if (res.ok) {
      const { data } = await res.json()
      onActionsChange(actions.map(a => a.id === id ? data : a))
      setEditId(null)
    }
    setSaving(false)
  }

  async function toggleStatut(action: Action) {
    const next = action.statut === 'a_faire' ? 'en_cours' : action.statut === 'en_cours' ? 'termine' : 'a_faire'
    const res = await fetch(`/api/sapin2/${diagnostic.id}/actions?action_id=${action.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: next }),
    })
    if (res.ok) {
      const { data } = await res.json()
      onActionsChange(actions.map(a => a.id === action.id ? data : a))
    }
  }

  const [actionToDelete, setActionToDelete] = useState<string | null>(null)
  async function deleteAction(id: string) {
    await fetch(`/api/sapin2/${diagnostic.id}/actions?action_id=${id}`, { method: 'DELETE' })
    onActionsChange(actions.filter(a => a.id !== id))
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* KPI */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',     v: actions.length,                                              c: 'text-gray-900 dark:text-white' },
          { label: 'À faire',   v: actions.filter(a => a.statut === 'a_faire').length,          c: 'text-gray-600 dark:text-gray-400' },
          { label: 'En cours',  v: actions.filter(a => a.statut === 'en_cours').length,         c: 'text-blue-600 dark:text-blue-400' },
          { label: 'Terminées', v: termines,                                                    c: 'text-green-600 dark:text-green-400' },
        ].map(s => (
          <div key={s.label} className={card('p-3 text-center')}>
            <div className={`text-2xl font-bold ${s.c}`}>{s.v}</div>
            <div className="text-xs text-gray-400">{s.label}</div>
          </div>
        ))}
      </div>
      {actions.length > 0 && (
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div className="h-2 rounded-full bg-teal-600 transition-all" style={{ width: `${Math.round(termines / actions.length * 100)}%` }} />
        </div>
      )}

      {/* Filtres */}
      <div className={card('p-3 flex flex-wrap gap-2')}>
        <select className={inputCls() + ' !w-auto'} value={filterAxe} onChange={e => setFilterAxe(e.target.value)}>
          <option value="all">Tous les axes</option>
          {SAPIN2_AXES.map(a => <option key={a.id} value={a.id}>{a.icon} {a.label}</option>)}
        </select>
        <select className={inputCls() + ' !w-auto'} value={filterPriorite} onChange={e => setFilterPriorite(e.target.value)}>
          <option value="all">Toutes priorités</option>
          <option value="haute">🔴 Haute</option>
          <option value="moyenne">🟡 Moyenne</option>
          <option value="basse">🟢 Basse</option>
        </select>
        <select className={inputCls() + ' !w-auto'} value={filterStatut} onChange={e => setFilterStatut(e.target.value)}>
          <option value="all">Tous statuts</option>
          <option value="a_faire">À faire</option>
          <option value="en_cours">En cours</option>
          <option value="termine">Terminé</option>
        </select>
        <span className="text-xs text-gray-400 self-center">{filtered.length} action{filtered.length > 1 ? 's' : ''}</span>
      </div>

      {filtered.length === 0 ? (
        <div className={card('p-8 text-center')}>
          <p className="text-gray-400">Aucune action — créez vos premières actions depuis l&apos;onglet Diagnostic</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => {
            const axe = SAPIN2_AXES.find(x => x.criteres.some(c => c.id === a.critere_id))
            const critere = axe?.criteres.find(c => c.id === a.critere_id)
            const isEditing = editId === a.id
            const incomplete = !a.responsable && !a.echeance
            return (
              <div key={a.id} className={card(`p-4${incomplete ? ' ring-1 ring-amber-300 dark:ring-amber-500/40' : ''}`)}>
                {isEditing ? (
                  <div className="space-y-2">
                    <input className={inputCls()} value={editData.titre ?? a.titre} onChange={e => setEditData(d => ({ ...d, titre: e.target.value }))} />
                    <textarea className={`${inputCls()} resize-none`} rows={2} value={editData.description ?? a.description ?? ''} onChange={e => setEditData(d => ({ ...d, description: e.target.value }))} />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div><label className={labelCls()}>Priorité</label>
                        <select className={inputCls()} value={editData.priorite ?? a.priorite} onChange={e => setEditData(d => ({ ...d, priorite: e.target.value as Action['priorite'] }))}>
                          <option value="haute">🔴 Haute</option><option value="moyenne">🟡 Moyenne</option><option value="basse">🟢 Basse</option>
                        </select>
                      </div>
                      <div><label className={labelCls()}>Statut</label>
                        <select className={inputCls()} value={editData.statut ?? a.statut} onChange={e => setEditData(d => ({ ...d, statut: e.target.value as Action['statut'] }))}>
                          <option value="a_faire">À faire</option><option value="en_cours">En cours</option><option value="termine">Terminé</option>
                        </select>
                      </div>
                      <div><label className={labelCls()}>Échéance</label>
                        <input type="date" className={inputCls()} value={editData.echeance ?? a.echeance ?? ''} onChange={e => setEditData(d => ({ ...d, echeance: e.target.value }))} />
                      </div>
                      <div><label className={labelCls()}>Responsable</label>
                        <ResponsableSelect className={inputCls()} value={editData.responsable ?? a.responsable ?? ''} members={members} onChange={v => setEditData(d => ({ ...d, responsable: v }))} />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button className={btnS('text-xs py-1')} onClick={() => setEditId(null)}>Annuler</button>
                      <button className={btnP('text-xs py-1')} onClick={() => saveEdit(a.id)} disabled={saving}>{saving ? '…' : '✓ Sauvegarder'}</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <button onClick={() => toggleStatut(a)}
                      className={`mt-0.5 text-[10px] px-2 py-1 rounded-full font-medium flex-shrink-0 ${STATUT_COLORS[a.statut]}`}>
                      {STATUT_LABELS[a.statut]}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold ${a.statut === 'termine' ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>{a.titre}</div>
                      {a.description && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{a.description}</div>}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {axe && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: axe.colorLight, color: axe.color }}>{axe.icon} {critere?.label ?? a.critere_id}</span>}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${PRIORITE_COLORS[a.priorite]}`}>{PRIORITE_LABELS[a.priorite]}</span>
                        {a.echeance && <span className="text-[10px] text-gray-400">📅 {a.echeance}</span>}
                        {a.responsable && <span className="text-[10px] text-gray-400">👤 {a.responsable}</span>}
                        {incomplete && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">⚠ À compléter</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => { setEditId(a.id); setEditData({}) }} className="text-gray-400 hover:text-blue-500 text-sm px-1.5 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20">✏️</button>
                      <button onClick={() => setActionToDelete(a.id)} className="text-gray-300 hover:text-red-400 text-sm px-1.5 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20">✕</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      <ConfirmModal
        open={!!actionToDelete}
        title="Supprimer l'action"
        message="L'action sera définitivement supprimée."
        onConfirm={() => { if (actionToDelete) deleteAction(actionToDelete); setActionToDelete(null) }}
        onCancel={() => setActionToDelete(null)}
      />
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

const VIEWS: { id: View; label: string; icon: string }[] = [
  { id: 'presentation',  label: 'Présentation',   icon: '📖' },
  { id: 'dashboard',     label: 'Tableau de bord', icon: '📊' },
  { id: 'diagnostic',    label: 'Diagnostic Sapin II', icon: '⚖️' },
  { id: 'actions',       label: "Plan d'actions",  icon: '🎯' },
  { id: 'correspondances', label: 'Correspondances', icon: '🔗' },
]

export default function Sapin2DiagnosticApp({ ctx }: { ctx: RseContext }) {
  const { org, year, setActions: setHeaderActions } = ctx

  const [view, setView] = useState<View>('presentation')
  const [diagnostic, setDiagnostic] = useState<DiagnosticData | null>(null)
  const [reponses, setReponses] = useState<Record<string, Reponse>>({})
  const [actions, setActions] = useState<Action[]>([])
  const [allNotes, setAllNotes] = useState<Record<string, string>>({})
  const [allNoteSections, setAllNoteSections] = useState<Record<string, NoteSection[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showShare, setShowShare] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [sharePermission, setSharePermission] = useState<'read'|'edit'>('read')
  const [shareSaving, setShareSaving] = useState(false)
  const [shareError, setShareError] = useState('')
  const [shareList, setShareList] = useState<{ id: string; email: string; permission: 'read'|'edit' }[]>([])

  // Charger/créer le diagnostic
  useEffect(() => {
    if (!org || !year) { setDiagnostic(null); return }
    setLoading(true); setError(null)

    const load = async () => {
      try {
        // Chercher un diagnostic existant
        const getRes = await fetch(`/api/sapin2?org_id=${org.id}&annee=${year}`)
        const { data: existing } = await getRes.json()

        let diagId: string
        if (existing) {
          diagId = existing.id
          setDiagnostic(existing)
        } else {
          const postRes = await fetch('/api/sapin2', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ org_id: org.id, annee: year }),
          })
          const { data: created } = await postRes.json()
          setDiagnostic(created)
          diagId = created.id
        }

        // Charger reponses, actions et notes en parallèle
        const [diagFull, notesRes] = await Promise.all([
          fetch(`/api/sapin2/${diagId}`).then(r => r.json()),
          fetch(`/api/sapin2/${diagId}/notes`).then(r => r.json()),
        ])

        const repMap: Record<string, Reponse> = {}
        for (const r of (diagFull.data?.reponses ?? [])) repMap[r.critere_id] = r
        setReponses(repMap)
        setActions(diagFull.data?.actions ?? [])

        if (notesRes.data) {
          setAllNotes(notesRes.data.notes ?? {})
          const sectMap: Record<string, NoteSection[]> = {}
          for (const [k, v] of Object.entries(notesRes.data.sections ?? {})) {
            sectMap[k] = v as NoteSection[]
          }
          setAllNoteSections(sectMap)
        }
      } catch (e) {
        setError(String(e))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [org, year])

  // Mettre à jour le score global quand les réponses changent
  useEffect(() => {
    if (!diagnostic) return
    const niveaux: Record<string, number> = {}
    for (const [k, v] of Object.entries(reponses)) niveaux[k] = v.niveau
    const score = calculateSapin2Score(niveaux)
    if (score !== diagnostic.score_global) {
      fetch(`/api/sapin2/${diagnostic.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score_global: score }),
      }).catch(() => {})
    }
  }, [reponses, diagnostic])

  const handleExportExcel = useCallback(async () => {
    if (!diagnostic) return
    const res = await fetch(`/api/sapin2/${diagnostic.id}/export-excel`)
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `Sapin2_${org?.denomination ?? 'diagnostic'}_${year}.xlsx`
    a.click(); URL.revokeObjectURL(url)
  }, [diagnostic, org, year])

  // Header actions
  useEffect(() => {
    if (view === 'presentation' || !diagnostic) { setHeaderActions(null); return }
    setHeaderActions(
      <div className="flex items-center gap-2">
        <button onClick={handleExportExcel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium transition-colors">
          ⬇ Excel
        </button>
        <button onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs font-medium transition-colors">
          📄 PDF
        </button>
        <button onClick={() => setShowShare(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs font-medium transition-colors">
          👥 Partager
        </button>
      </div>
    )
    return () => setHeaderActions(null)
  }, [view, diagnostic, setHeaderActions, handleExportExcel])

  const handleReponseChange = useCallback(async (critere_id: string, niveau: number, commentaire: string) => {
    if (!diagnostic) return
    const res = await fetch(`/api/sapin2/${diagnostic.id}/reponses`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ critere_id, niveau, commentaire }),
    })
    if (res.ok) {
      const { data } = await res.json()
      setReponses(prev => ({ ...prev, [critere_id]: data }))
    }
  }, [diagnostic])

  const loadShares = useCallback(async () => {
    if (!diagnostic) return
    try {
      const res = await fetch(`/api/sapin2/${diagnostic.id}/shares`)
      const { data } = await res.json()
      setShareList(data ?? [])
    } catch { /* ignore */ }
  }, [diagnostic])

  useEffect(() => { if (showShare) loadShares() }, [showShare, loadShares])

  async function handleAddShare() {
    if (!diagnostic || !shareEmail.trim()) return
    setShareSaving(true); setShareError('')
    try {
      const res = await fetch(`/api/sapin2/${diagnostic.id}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: shareEmail.trim(), permission: sharePermission }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Erreur de partage' }))
        setShareError(error || 'Erreur de partage')
        return
      }
      setShareEmail('')
      await loadShares()
      notifyMembersChanged('sapin2', diagnostic.id)
    } catch {
      setShareError('Erreur de partage')
    } finally { setShareSaving(false) }
  }

  async function handleRemoveShare(shareId: string) {
    if (!diagnostic) return
    try {
      await fetch(`/api/sapin2/${diagnostic.id}/shares?shareId=${shareId}`, { method: 'DELETE' })
      await loadShares()
      notifyMembersChanged('sapin2', diagnostic.id)
    } catch { /* ignore */ }
  }

  const niveaux: Record<string, number> = {}
  for (const [k, v] of Object.entries(reponses)) niveaux[k] = v.niveau
  const score = calculateSapin2Score(niveaux)

  if (!org) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center">
          <div className="text-4xl mb-4">⚖️</div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Loi Sapin II — Conformité Anti-Corruption</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Sélectionnez une organisation pour accéder au diagnostic</p>
        </div>
        <PresentationView />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Onglets de navigation */}
      <div className="flex overflow-x-auto gap-1 pb-1 border-b border-gray-200 dark:border-gray-700">
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => setView(v.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${
              view === v.id
                ? 'text-teal-700 dark:text-teal-400 border-b-2 border-teal-700 dark:border-teal-400 bg-teal-50 dark:bg-teal-900/10'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}>
            <span>{v.icon}</span>
            <span>{v.label}</span>
            {v.id === 'actions' && actions.length > 0 && (
              <span className="text-[10px] bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 px-1 rounded-full">{actions.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full" />
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-400 text-sm">{error}</div>
      ) : (
        <>
          {view === 'presentation' && <PresentationView />}
          {view === 'dashboard' && diagnostic && (
            <TableauDeBordView reponses={reponses} actions={actions} score={score} />
          )}
          {view === 'diagnostic' && diagnostic && (
            <DiagnosticView
              diagnostic={diagnostic} reponses={reponses} actions={actions}
              allNotes={allNotes} allNoteSections={allNoteSections}
              onReponseChange={handleReponseChange}
              onActionsChange={setActions}
              onNoteChange={(key, content) => setAllNotes(prev => ({ ...prev, [key]: content }))}
              onNoteSectionsChange={(key, sections) => setAllNoteSections(prev => ({ ...prev, [key]: sections }))}
            />
          )}
          {view === 'actions' && diagnostic && (
            <ActionsView diagnostic={diagnostic} actions={actions} onActionsChange={setActions} />
          )}
          {view === 'correspondances' && <CorrespondancesView />}
        </>
      )}

      {/* ── Modale Partage ──────────────────────────────────────────────────── */}
      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowShare(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-bold text-gray-900 dark:text-white">👥 Partager le diagnostic Sapin II</h2>
              <button onClick={() => setShowShare(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-3">
                <div>
                  <label className={labelCls()}>Email de l&apos;utilisateur</label>
                  <ShareAutocomplete value={shareEmail} onChange={setShareEmail} onEnter={handleAddShare} inputClassName={inputCls()} />
                </div>
                <div>
                  <label className={labelCls()}>Niveau d&apos;accès</label>
                  <select value={sharePermission} onChange={e => setSharePermission(e.target.value as 'read'|'edit')}
                    className={inputCls()}>
                    <option value="read">Lecture seule</option>
                    <option value="edit">Édition</option>
                  </select>
                </div>
                {shareError && <p className="text-xs text-red-500">{shareError}</p>}
                <button onClick={handleAddShare} disabled={shareSaving || !shareEmail.trim()}
                  className={btnP('w-full text-center')}>
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
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                          {s.permission === 'edit' ? 'Édition' : 'Lecture'}
                        </span>
                        <button onClick={() => handleRemoveShare(s.id)} title="Retirer l'accès"
                          className="text-gray-400 hover:text-red-500 transition-colors">✕</button>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-gray-400 text-center">Le collaborateur doit avoir un compte Sens&apos;ethO. Il retrouvera le dossier en sélectionnant la même organisation et la même année.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

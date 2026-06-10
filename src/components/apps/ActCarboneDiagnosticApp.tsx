/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import type { RseContext } from '@/components/rse/RseAppShell'
import ConfirmModal from '@/components/ui/ConfirmModal'
import type { NoteSection } from '@/components/apps/GuidedActionNotePanel'

// GuidedActionNotePanel chargé en lazy — même pattern que les autres apps RSE
const GuidedActionNotePanel = dynamic(() => import('@/components/apps/GuidedActionNotePanel'), {
  ssr: false,
  loading: () => <div className="py-3 text-xs text-gray-400 animate-pulse">Chargement éditeur…</div>
})

// ─── Données statiques ACT Bas-Carbone ───────────────────────────────────────

export const ACT_CARBONE_AXES = [
  {
    id: 'ambition', label: 'Ambition climatique', icon: '🎯',
    color: '#16a34a', colorLight: '#dcfce7', weight: 0.20,
    description: "Définition d'objectifs de réduction GES validés scientifiquement (SBTi), trajectoire Net-Zéro documentée, gouvernance climatique au plus haut niveau et intégration dans la stratégie d'entreprise.",
    criteres: [
      { id: 'act-amb-objectifs',   label: 'Objectifs de réduction GES alignés sur la science (SBTi)', description: "L'entreprise a défini des objectifs de réduction de ses émissions GES validés ou en cours de validation par la Science Based Targets initiative (SBTi), alignés avec un scénario de limitation du réchauffement à 1,5°C." },
      { id: 'act-amb-netzero',     label: 'Trajectoire Net-Zéro et neutralité carbone long terme', description: "Une trajectoire crédible vers la neutralité carbone (Net-Zéro) à horizon 2050 au plus tard est définie, avec des jalons intermédiaires documentés et des engagements formels de direction." },
      { id: 'act-amb-gouvernance', label: 'Gouvernance climatique et pilotage au plus haut niveau', description: "La stratégie climatique est pilotée au niveau du conseil d'administration ou de la direction générale, avec des ressources dédiées, un responsable identifié et des indicateurs de performance climatique intégrés." },
      { id: 'act-amb-strategie',   label: 'Intégration dans la stratégie et le modèle d\'affaires', description: "La transition bas-carbone est intégrée au cœur de la stratégie d'entreprise : feuille de route de décarbonation, analyse TCFD des risques/opportunités climatiques, intégration dans le plan stratégique." },
    ],
  },
  {
    id: 'mesure', label: 'Mesure & Reporting', icon: '📊',
    color: '#2563eb', colorLight: '#dbeafe', weight: 0.20,
    description: "Quantification annuelle des émissions GES Scopes 1, 2 et 3 selon le GHG Protocol, publication transparente via CDP/CSRD/GRI et vérification externe par un tiers accrédité.",
    criteres: [
      { id: 'act-mes-scope12',     label: 'Bilan GES Scopes 1 et 2 — mesure et maîtrise', description: "Les émissions directes (Scope 1) et indirectes liées à l'énergie (Scope 2) sont mesurées annuellement selon le protocole GHG Protocol, avec une trajectoire de réduction documentée et des actions concrètes de réduction." },
      { id: 'act-mes-scope3',      label: 'Émissions Scope 3 — chaîne de valeur amont et aval', description: "Les émissions de la chaîne de valeur (Scope 3) sont identifiées et quantifiées sur au moins les catégories matérielles (achats, déplacements, utilisation des produits, fin de vie). Un plan de réduction Scope 3 est engagé." },
      { id: 'act-mes-reporting',   label: 'Reporting climatique et transparence (CDP, CSRD, GRI)', description: "Les données GES et la stratégie climatique sont publiées dans les rapports réglementaires (CSRD/ESRS E1) et volontaires (CDP, GRI 305), avec une méthodologie transparente et des objectifs vérifiables." },
      { id: 'act-mes-verification', label: 'Vérification externe des données GES', description: "Les données d'émissions GES font l'objet d'une vérification ou d'un audit externe par un organisme accrédité, garantissant leur fiabilité et leur comparabilité dans le temps." },
    ],
  },
  {
    id: 'reduction', label: 'Réduction des émissions', icon: '⚡',
    color: '#ea580c', colorLight: '#ffedd5', weight: 0.20,
    description: "Mise en œuvre concrète de plans d'efficacité énergétique, décarbonation des procédés industriels, réduction active des émissions Scope 3 et investissement dans l'innovation bas-carbone.",
    criteres: [
      { id: 'act-red-energie',    label: 'Efficacité énergétique et transition vers les énergies renouvelables', description: "Un plan d'efficacité énergétique est mis en œuvre avec des objectifs chiffrés. La part des énergies renouvelables dans le mix énergétique progresse : autoconsommation, PPA, certificats d'énergie renouvelable (RECs/GOs)." },
      { id: 'act-red-procedes',   label: 'Décarbonation des procédés industriels et opérations', description: "Les procédés industriels et opérations les plus émetteurs font l'objet d'un plan de décarbonation spécifique : électrification, substitution d'énergie fossile, optimisation des procédés, efficacité des équipements." },
      { id: 'act-red-scope3act',  label: 'Réduction active des émissions Scope 3', description: "Des actions concrètes de réduction sont engagées sur les principales catégories Scope 3 : achats responsables, éco-conception, optimisation logistique, accompagnement des clients vers des usages bas-carbone." },
      { id: 'act-red-innovation', label: 'Innovation bas-carbone et R&D décarbonation', description: "L'entreprise investit dans l'innovation bas-carbone : R&D sur des solutions décarbonées, partenariats avec des startups cleantech, participation à des programmes d'accélération de la transition énergétique." },
    ],
  },
  {
    id: 'engagement', label: 'Engagement & Transition', icon: '🤝',
    color: '#7c3aed', colorLight: '#ede9fe', weight: 0.20,
    description: "Mobilisation de l'ensemble de l'écosystème : exigences climatiques fournisseurs, formation des collaborateurs, financement dédié de la transition et dialogue structuré avec les parties prenantes.",
    criteres: [
      { id: 'act-eng-fournisseurs',   label: 'Engagement fournisseurs et achats bas-carbone', description: "Des exigences climatiques sont intégrées dans la politique achats : évaluation carbone des fournisseurs, préférence aux fournisseurs engagés, clauses contractuelles GES, accompagnement à la décarbonation des fournisseurs prioritaires." },
      { id: 'act-eng-collaborateurs', label: 'Mobilisation et formation des collaborateurs', description: "Les collaborateurs sont sensibilisés et formés aux enjeux climatiques et aux écogestes. Des programmes d'engagement interne (ambassadeurs, challenges, innovations participatives) favorisent la culture bas-carbone." },
      { id: 'act-eng-finance',        label: 'Plan de financement de la transition et finance durable', description: "La transition bas-carbone est financée de manière dédiée : budget carbone identifié, accès à la finance durable (green bonds, prêts verts, taxonomie UE), intégration des critères carbone dans les décisions d'investissement." },
      { id: 'act-eng-partenaires',    label: 'Dialogue parties prenantes et contribution territoriale', description: "L'entreprise engage un dialogue structuré avec ses parties prenantes sur sa stratégie climatique et contribue activement à la transition territoriale : participation à des coalitions sectorielles, partage de bonnes pratiques." },
    ],
  },
  {
    id: 'neutralite', label: 'Compensation & Neutralité', icon: '🌱',
    color: '#0891b2', colorLight: '#e0f2fe', weight: 0.20,
    description: "Développement de projets de séquestration carbone naturelle, compensation résiduelle par crédits certifiés, préservation des co-bénéfices biodiversité et trajectoire crédible vers la neutralité 2050.",
    criteres: [
      { id: 'act-neu-sequestration', label: 'Séquestration carbone et puits naturels', description: "L'entreprise développe ou soutient des projets de séquestration carbone naturelle (reforestation, agroforesterie, restauration d'écosystèmes) avec des engagements chiffrés et vérifiables sur les volumes séquestrés." },
      { id: 'act-neu-compensation',  label: 'Compensation carbone certifiée et crédible', description: "Les émissions résiduelles font l'objet d'une compensation via des crédits carbone certifiés (Gold Standard, Verra VCS) de haute intégrité, en complément —jamais en substitution— des efforts de réduction directe." },
      { id: 'act-neu-biodiversite',  label: 'Préservation des écosystèmes et co-bénéfices biodiversité', description: "La stratégie climatique intègre les co-bénéfices biodiversité : préservation et restauration d'habitats naturels, absence de double comptage avec d'autres démarches TNFD, alignement avec le cadre Kunming-Montréal." },
      { id: 'act-neu-neutralite',    label: 'Trajectoire crédible vers la neutralité carbone 2050', description: "La neutralité carbone est définie selon le standard ISO 14068 ou SBTi Net-Zero : réductions profondes en priorité (>90% des émissions), compensation résiduelle limitée, publication de progrès annuels vérifiables." },
    ],
  },
]

export const ACT_CARBONE_NIVEAUX = [
  { value: 0, shortLabel: 'NC', label: 'Non initié',        description: "Aucune démarche engagée sur ce critère",                                   pct: 0,    color: '#9ca3af', bg: 'bg-gray-100 dark:bg-gray-700',           text: 'text-gray-600 dark:text-gray-400'   },
  { value: 1, shortLabel: '1',  label: 'Sensibilisé',       description: "Prise de conscience, premières réflexions engagées",                        pct: 0.25, color: '#ef4444', bg: 'bg-red-50 dark:bg-red-900/20',          text: 'text-red-700 dark:text-red-400'     },
  { value: 2, shortLabel: '2',  label: 'Planifié',          description: "Objectifs définis, plan en cours d'élaboration",                             pct: 0.50, color: '#f97316', bg: 'bg-orange-50 dark:bg-orange-900/20',    text: 'text-orange-700 dark:text-orange-400' },
  { value: 3, shortLabel: '3',  label: 'En transition',     description: "Actions concrètes mesurées et suivies, résultats en cours",                  pct: 0.75, color: '#eab308', bg: 'bg-yellow-50 dark:bg-yellow-900/20',    text: 'text-yellow-700 dark:text-yellow-400' },
  { value: 4, shortLabel: '4',  label: 'Leader climatique', description: "Trajectoire exemplaire, résultats prouvés et publiés",                       pct: 1.0,  color: '#22c55e', bg: 'bg-green-50 dark:bg-green-900/20',      text: 'text-green-700 dark:text-green-400' },
]

const BADGE_LEVELS = [
  { label: 'Leader climatique', min: 85, color: '#22c55e', icon: '🏆' },
  { label: 'En transition',     min: 60, color: '#16a34a', icon: '✅' },
  { label: 'Planifié',          min: 30, color: '#f97316', icon: '🔧' },
  { label: 'Non initié',        min: 0,  color: '#dc2626', icon: '⚠️' },
]

export function calculateActCarboneScore(niveaux: Record<string, number>): number {
  let total = 0
  for (const axe of ACT_CARBONE_AXES) {
    let axeScore = 0
    const nb = axe.criteres.length
    for (const c of axe.criteres) {
      const n = niveaux[c.id] ?? 0
      axeScore += (ACT_CARBONE_NIVEAUX[n]?.pct ?? 0) / nb
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
function inputCls() { return 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500' }
function labelCls() { return 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1' }
function btnP(extra = '') { return `px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors disabled:opacity-50 ${extra}` }
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

function critereLabel(id: string): string {
  for (const axe of ACT_CARBONE_AXES) {
    const c = axe.criteres.find(x => x.id === id)
    if (c) return `${axe.icon} ${c.label}`
  }
  return id
}

// ─── Vue Présentation ─────────────────────────────────────────────────────────

function PresentationView() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Hero */}
      <div className={card('p-6 space-y-4')}>
        <div className="flex items-center gap-3">
          <span className="text-4xl">🌱</span>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Démarche ACT Bas-Carbone — ADEME/CDP</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Évaluez et pilotez votre stratégie climatique selon la démarche Accelerate Climate Transition</p>
          </div>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          La démarche <strong>ACT (Accelerate Climate Transition)</strong> est une initiative conjointe de l&apos;<strong>ADEME</strong> et du <strong>CDP</strong>
          qui permet aux entreprises d&apos;évaluer leur alignement avec les objectifs de l&apos;Accord de Paris.
          Elle couvre l&apos;ensemble du périmètre climatique : définition d&apos;objectifs <strong>SBTi</strong>, mesure des émissions GES
          (Scopes 1, 2 et 3), plans de réduction, engagement de la chaîne de valeur et neutralité carbone 2050.
        </p>
      </div>

      {/* Enjeux & Cadre */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={card('p-5 border-l-4 border-green-500')}>
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">🎯 Objectifs de la démarche ACT</h3>
          <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            {[
              ['Aligner', "la stratégie climatique avec un scénario 1,5°C"],
              ['Mesurer', "les émissions GES Scopes 1, 2 et 3 de façon rigoureuse"],
              ['Réduire', "les émissions à la source avec des plans concrets"],
              ['Engager', "fournisseurs, collaborateurs et parties prenantes"],
              ['Compenser', "les émissions résiduelles de façon crédible"],
            ].map(([verb, desc]) => (
              <div key={verb} className="flex items-start gap-2">
                <span className="text-green-600 font-bold flex-shrink-0">▸</span>
                <span><strong>{verb}</strong> {desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={card('p-5 border-l-4 border-blue-500')}>
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">📋 Référentiels couverts</h3>
          <div className="space-y-1">
            {[
              ['🎯', 'SBTi — Science Based Targets initiative'],
              ['📊', 'CDP Climate Change'],
              ['📜', 'CSRD — ESRS E1 Changement climatique'],
              ['📋', 'GRI 305 — Émissions GES'],
              ['🌍', 'ODD 13 — Lutte contre les changements climatiques'],
              ['🏛️', 'ISO 14064 / ISO 14068 Neutralité carbone'],
              ['⚙️', 'ISO 26000 — Domaines 3.4, 3.6, 7.1'],
              ['💰', 'Taxonomie UE — Objectif 1 Atténuation CC'],
            ].map(([icon, label]) => (
              <div key={label} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <span>{icon}</span><span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Urgence climatique */}
      <div className={card('p-5 bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800')}>
        <h3 className="font-bold text-orange-700 dark:text-orange-400 mb-3">🌡️ Contexte — Urgence climatique et enjeux réglementaires</h3>
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          {[
            'Le GIEC appelle à réduire les émissions mondiales de 45% d\'ici 2030 (vs 2010) pour limiter le réchauffement à 1,5°C',
            'La CSRD impose aux grandes entreprises de publier leur bilan GES et leur plan de transition climatique (ESRS E1)',
            'Les investisseurs exigent des trajectoires SBTi validées comme condition de financement (finance durable, taxonomie UE)',
            'Le CDP évalue les entreprises sur leur stratégie climatique : notation A à D, avec impact sur accès aux marchés et capitaux',
          ].map((line, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="font-bold text-orange-600 flex-shrink-0">•</span>
              <span>{line}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Les 5 axes */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Les 5 axes du diagnostic ACT Bas-Carbone</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ACT_CARBONE_AXES.map(axe => (
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

      {/* Niveaux de maturité */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Niveaux de maturité climatique ACT</h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {ACT_CARBONE_NIVEAUX.map(n => (
            <div key={n.value} className={card('p-3 text-center')}>
              <div className="text-2xl font-bold" style={{ color: n.color }}>{n.shortLabel}</div>
              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mt-0.5">{n.label}</div>
              <div className="text-[10px] text-gray-400 mt-1 leading-tight">{n.description}</div>
              <div className="mt-2 text-xs font-medium" style={{ color: n.color }}>{Math.round(n.pct * 100)}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Badge de maturité */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Badge de maturité climatique globale</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {BADGE_LEVELS.map(b => (
            <div key={b.label} className={card('p-4 text-center')}>
              <div className="text-3xl">{b.icon}</div>
              <div className="font-bold text-sm mt-1" style={{ color: b.color }}>{b.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">≥ {b.min}%</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">Seuils : 0-30% Non initié · 30-60% Planifié · 60-85% En transition · 85-100% Leader climatique</p>
      </div>

      {/* Comment utiliser */}
      <div className={card('p-5 space-y-3')}>
        <h3 className="font-semibold text-gray-900 dark:text-white">💡 Comment utiliser cette application</h3>
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          {[
            ['1', 'Diagnostic ACT', "Pour chaque critère, évaluez votre niveau de maturité (NC à 4), documentez vos pratiques et créez des actions d'amélioration ciblées."],
            ['2', "Plan d'actions", "Visualisez et gérez toutes vos actions de transition : priorité, responsable, échéance, statut d'avancement."],
            ['3', 'Documents & Preuves', "Uploadez directement dans SharePoint vos preuves documentaires (rapport Bilan Carbone, données CDP, certifications SBTi) classées par critère."],
            ['4', 'Export Excel', "Générez un rapport Excel structuré avec 6 onglets pour le reporting RSE, la CSRD et le questionnaire CDP."],
          ].map(([num, title, desc]) => (
            <div key={num} className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center justify-center text-xs font-bold">{num}</div>
              <div><span className="font-medium">{title}</span> — {desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Vue Tableau de bord ─────────────────────────────────────────────────────

function TableauDeBordView({
  reponses, actions, score,
}: {
  reponses: Record<string, Reponse>
  actions: Action[]
  score: number
}) {
  const badge = getBadge(score)

  const axeStats = ACT_CARBONE_AXES.map(axe => {
    const total = axe.criteres.length
    const niveaux = axe.criteres.map(c => reponses[c.id]?.niveau ?? 0)
    const pct = niveaux.reduce((s, n) => s + (ACT_CARBONE_NIVEAUX[n]?.pct ?? 0), 0) / total
    const renseignes = niveaux.filter(n => n > 0).length
    return { ...axe, pct, renseignes, total }
  })

  // Radar SVG custom — 5 axes
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
      {/* Score global */}
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
          <div className="text-xs text-gray-400 mt-1">Seuils : 30% Planifié · 60% En transition · 85% Leader</div>
        </div>

        {/* Radar */}
        <div className={card('p-4 sm:col-span-2')}>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Radar de maturité ACT par axe</h3>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <svg viewBox="0 0 340 330" className="w-full sm:w-72 flex-shrink-0" style={{ maxHeight: 260 }}>
              {/* Toile */}
              {levels.map(level => {
                const pts = axeStats.map((_, i) => { const { x, y } = polarToXY(i, r * level); return `${x},${y}` }).join(' ')
                return <polygon key={level} points={pts} fill="none" stroke="var(--border, #374151)" strokeWidth={level === 1 ? '1.5' : '0.7'} />
              })}
              {/* Axes */}
              {axeStats.map((_, i) => { const { x, y } = polarToXY(i, r); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--border, #374151)" strokeWidth="1" strokeDasharray="3,3" /> })}
              {/* Zone données */}
              <polygon points={dataPolygon} fill="#16a34a22" stroke="#16a34a" strokeWidth="2.5" strokeLinejoin="round" />
              {/* Points */}
              {axeStats.map((axe, i) => { const { x, y } = polarToXY(i, r * Math.max(axe.pct, 0.03)); return <circle key={i} cx={x} cy={y} r="5" fill={axe.color} stroke="white" strokeWidth="1.5" /> })}
              {/* Labels % */}
              {levels.map(level => { const { x, y } = polarToXY(0, r * level); return <text key={level} x={x} y={y - 5} textAnchor="middle" fontSize="8" fill="var(--text-muted, #6b7280)" fontWeight="500">{Math.round(level * 100)}%</text> })}
              {/* Labels axes */}
              {axeStats.map((axe, i) => {
                const { x, y } = polarToXY(i, r + 28)
                const anchor = x < cx - 8 ? 'end' : x > cx + 8 ? 'start' : 'middle'
                return (
                  <text key={i} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontSize="14" fill={axe.color} fontWeight="700">
                    {axe.icon}
                  </text>
                )
              })}
            </svg>

            {/* Légende */}
            <div className="space-y-2 flex-1 w-full">
              {axeStats.map(axe => (
                <div key={axe.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{axe.icon}</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">{axe.label}</span>
                      <span className="text-gray-400">({Math.round(axe.weight * 100)}%)</span>
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
                  const niv = ACT_CARBONE_NIVEAUX[n]
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
            <div className="h-2 rounded-full bg-green-500 transition-all" style={{ width: `${Math.round(actions.filter(a => a.statut === 'termine').length / actions.length * 100)}%` }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Vue Correspondances ──────────────────────────────────────────────────────

const CORRESPONDANCES_ACT = [
  {
    categorie: "Applications RSE Sens'ethO",
    icon: '🏠',
    color: 'indigo',
    items: [
      {
        ref: 'Diagnostic ISO 26000', icon: '⚙️', route: '/rse/iso26000',
        desc: "ISO 26000 — La démarche ACT couvre directement les domaines 3.4 (Atténuation CC), 3.6 (Consommation durable) et 7.1 (Droits de l'Homme dans la chaîne de valeur)",
        liens: [
          { axe: 'ambition',   label: 'Ambition',   ref: 'ISO 26000 DA3.4 — Atténuation des changements climatiques' },
          { axe: 'reduction',  label: 'Réduction',  ref: 'ISO 26000 DA3.6 — Protection de l\'environnement, biodiversité et réhabilitation' },
          { axe: 'engagement', label: 'Engagement', ref: 'ISO 26000 DA7.1 — Pratiques responsables dans la chaîne de valeur' },
        ],
      },
      {
        ref: 'Diagnostic CSRD/ESRS E1', icon: '📊', route: '/rse/csrd',
        desc: "CSRD — ESRS E1 Changement climatique : le diagnostic ACT Bas-Carbone couvre directement les exigences de publication du bilan GES, de la trajectoire de réduction et du plan de transition",
        liens: [
          { axe: 'mesure',    label: 'Mesure',    ref: 'ESRS E1-6 — Émissions brutes de GES Scopes 1, 2 et 3' },
          { axe: 'ambition',  label: 'Ambition',  ref: 'ESRS E1-4 — Objectifs de réduction des GES' },
          { axe: 'reduction', label: 'Réduction', ref: 'ESRS E1-7 — Absorption des GES et projets de carbone' },
        ],
      },
    ],
  },
  {
    categorie: 'Initiatives climatiques sectorielles',
    icon: '🌍',
    color: 'green',
    items: [
      {
        ref: 'SBTi — Science Based Targets', icon: '🎯', route: null,
        desc: "Science Based Targets initiative — validation des objectifs de réduction GES alignés 1,5°C, Net-Zero Standard 2050",
        liens: [
          { axe: 'ambition',   label: 'Ambition',   ref: 'SBTi — Objectifs de réduction à court terme (2025-2030) et long terme (2050)' },
          { axe: 'neutralite', label: 'Neutralité',  ref: 'SBTi Net-Zero Standard — Réductions profondes (>90%) avant compensation' },
        ],
      },
      {
        ref: 'CDP Climate Change', icon: '📋', route: null,
        desc: "CDP Climate Change — questionnaire international de reporting climatique (notation A-D), couvrant gouvernance, stratégie, gestion des risques et métriques",
        liens: [
          { axe: 'ambition', label: 'Ambition',  ref: 'CDP C1 — Gouvernance climatique et responsabilités direction' },
          { axe: 'mesure',   label: 'Mesure',    ref: 'CDP C6 — Émissions GES Scopes 1, 2, 3 et vérification' },
          { axe: 'reduction',label: 'Réduction', ref: 'CDP C4 — Objectifs et initiatives de réduction des émissions' },
        ],
      },
      {
        ref: 'Accord de Paris — 1,5°C', icon: '🌡️', route: null,
        desc: "Accord de Paris (2015) — objectif de limitation du réchauffement à 1,5°C par rapport aux niveaux préindustriels : trajectoire de référence pour toutes les démarches ACT et SBTi",
        liens: [
          { axe: 'ambition', label: 'Ambition', ref: 'Accord de Paris — Art. 4 : objectifs nationaux et trajectoires entreprises compatibles' },
        ],
      },
    ],
  },
  {
    categorie: 'Standards de reporting et de mesure',
    icon: '📐',
    color: 'blue',
    items: [
      {
        ref: 'GRI 305 — Émissions GES', icon: '📋', route: null,
        desc: "GRI 305 — Émissions : Scope 1 (305-1), Scope 2 (305-2), Scope 3 (305-3), intensité GES (305-4), réduction des émissions (305-5)",
        liens: [
          { axe: 'mesure',    label: 'Mesure',    ref: 'GRI 305-1 à 305-5 — Quantification et reporting des émissions GES' },
          { axe: 'reduction', label: 'Réduction', ref: 'GRI 305-5 — Réduction des émissions de GES' },
        ],
      },
      {
        ref: 'Bilan Carbone® ADEME', icon: '⚖️', route: null,
        desc: "Méthode Bilan Carbone® (ADEME) — outil de référence français pour quantifier les émissions GES et construire un plan de transition bas-carbone",
        liens: [
          { axe: 'mesure',   label: 'Mesure',   ref: 'Bilan Carbone® — Quantification Scopes 1, 2, 3 selon méthode ADEME' },
          { axe: 'ambition', label: 'Ambition', ref: 'Bilan Carbone® — Plan de transition et feuille de route de réduction' },
        ],
      },
      {
        ref: 'ISO 14064 / ISO 14068', icon: '🔬', route: null,
        desc: "ISO 14064 — Quantification et déclaration des émissions et suppressions de GES. ISO 14068 — Neutralité carbone : définition, exigences et lignes directrices",
        liens: [
          { axe: 'mesure',     label: 'Mesure',     ref: 'ISO 14064-1 — Quantification et déclaration des GES organisationnels' },
          { axe: 'neutralite', label: 'Neutralité',  ref: 'ISO 14068 — Neutralité carbone : réductions profondes + compensation résiduelle' },
        ],
      },
      {
        ref: 'ODD 13 — Action climatique', icon: '🏔️', route: null,
        desc: "Objectif de Développement Durable 13 — Prendre d'urgence des mesures pour lutter contre les changements climatiques et leurs répercussions",
        liens: [
          { axe: 'ambition',  label: 'Ambition',  ref: 'ODD 13.1 — Renforcement de la résilience et des capacités d\'adaptation' },
          { axe: 'reduction', label: 'Réduction', ref: 'ODD 13.3 — Amélioration des capacités d\'atténuation des CC' },
        ],
      },
      {
        ref: 'EU Taxonomy — Objectif 1', icon: '💶', route: null,
        desc: "Taxonomie européenne pour la finance durable — Objectif 1 : atténuation du changement climatique. Green bonds, prêts verts, décisions d'investissement bas-carbone",
        liens: [
          { axe: 'engagement', label: 'Engagement', ref: 'Taxonomie UE — Finance durable : green bonds, prêts verts, critères screening' },
          { axe: 'reduction',  label: 'Réduction',  ref: 'Taxonomie UE — Activités éligibles à contribution substantielle atténuation CC' },
        ],
      },
    ],
  },
]

const AXE_BADGE_CLS: Record<string, string> = {
  ambition:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  mesure:     'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  reduction:  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  engagement: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  neutralite: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
}

function CorrespondancesView() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className={card('p-4')}>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          La démarche ACT Bas-Carbone s&apos;inscrit dans un écosystème riche de standards climatiques en pleine évolution.
          Les correspondances ci-dessous permettent de mutualiser vos efforts de reporting et d&apos;aligner votre démarche ACT
          avec la CSRD (ESRS E1), les SBTi, le CDP, GRI 305, l&apos;ISO 26000 et la Taxonomie européenne.
        </p>
      </div>

      {CORRESPONDANCES_ACT.map(cat => (
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
                        <a href={item.route}
                          className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 hover:bg-indigo-200 transition-colors font-medium">
                          ↗ Ouvrir dans Sens&apos;ethO
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.desc}</p>

                    {item.liens.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {item.liens.map((l, i) => {
                          const axe = ACT_CARBONE_AXES.find(a => a.id === l.axe)
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

interface EAxe { id: string; label: string; icon: string; color: string; colorLight: string; weight: number; description: string; criteres: ECritere[] }
interface ECritere { id: string; label: string; description: string }

interface CriterePanelProps {
  axe: EAxe
  critere: ECritere
  reponse: Reponse | null
  actions: Action[]
  diagnosticId: string
  allNotes: Record<string, string>
  allNoteSections: Record<string, NoteSection[]>
  onReponseChange: (critere_id: string, niveau: number, commentaire: string) => void
  onActionsChange: (actions: Action[]) => void
  onNoteChange: (key: string, content: string) => void
  onNoteSectionsChange: (key: string, sections: NoteSection[]) => void
}

function CriterePanel({
  axe, critere, reponse, actions,
  diagnosticId, allNotes, allNoteSections,
  onReponseChange, onActionsChange, onNoteChange, onNoteSectionsChange,
}: CriterePanelProps) {
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
    const res = await fetch(`/api/act-carbone/${diagnosticId}/actions`, {
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
    await fetch(`/api/act-carbone/${diagnosticId}/actions?action_id=${id}`, { method: 'DELETE' })
    onActionsChange(actions.filter(a => a.id !== id))
  }

  async function saveEdit(id: string) {
    setSavingEdit(true)
    const res = await fetch(`/api/act-carbone/${diagnosticId}/actions?action_id=${id}`, {
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
    const res = await fetch(`/api/act-carbone/${diagnosticId}/actions?action_id=${action.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: next }),
    })
    if (res.ok) {
      const { data } = await res.json()
      onActionsChange(actions.map(a => a.id === action.id ? data : a))
    }
  }

  const niv = ACT_CARBONE_NIVEAUX[niveau]

  return (
    <div className="space-y-5">
      {/* Header critère */}
      <div className="rounded-xl p-4 border border-gray-200 dark:border-gray-700" style={{ background: axe.colorLight + '80' }}>
        <h3 className="font-bold text-base" style={{ color: axe.color }}>{critere.label}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{critere.description}</p>
      </div>

      {/* Niveau de maturité */}
      <div className={card('p-4 space-y-3')}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">Niveau de maturité ACT</div>
          {savingReponse && <span className="text-xs text-gray-400 animate-pulse">Enregistrement…</span>}
          {savedOk && !savingReponse && <span className="text-xs text-green-600 dark:text-green-400">✓ Sauvegardé</span>}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {ACT_CARBONE_NIVEAUX.map(n => (
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

      {/* Commentaire + Notes & documents */}
      <div className={card('p-4 space-y-2')}>
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">📝 Commentaire & contexte</label>
        <p className="text-xs text-gray-500 dark:text-gray-400">Décrivez vos pratiques actuelles, les données de votre Bilan Carbone, les certifications SBTi/CDP en cours et les points d&apos;amélioration identifiés.</p>
        <textarea
          value={commentaire}
          onChange={e => handleCommentaireChange(e.target.value)}
          rows={4}
          placeholder="Ex : Notre Bilan Carbone 2024 couvre les Scopes 1 et 2. Nos objectifs SBTi sont en cours de validation. Plan de réduction de 42% à 2030…"
          className={`${inputCls()} resize-y`}
        />
        <GuidedActionNotePanel
          diagnosticId={diagnosticId}
          actionKey={critere.id}
          apiBase="/api/act-carbone"
          noteTable="act_carbone_notes"
          readOnly={false}
          note={allNotes[critere.id] ?? ''}
          onNoteChange={v => onNoteChange(critere.id, v)}
          initialSections={allNoteSections[critere.id] ?? []}
          onSectionsChange={s => onNoteSectionsChange(critere.id, s)}
        />
      </div>

      {/* Actions d'amélioration */}
      <div className={card('p-4 space-y-3')}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            🎯 Actions de transition
            {critereActions.length > 0 && (
              <span className="ml-2 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full font-medium">
                {critereActions.filter(a => a.statut === 'termine').length}/{critereActions.length}
              </span>
            )}
          </div>
          <button onClick={() => setShowActionForm(v => !v)} className={btnP('text-xs py-1.5')}>+ Action</button>
        </div>

        {showActionForm && (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 space-y-2 border border-gray-200 dark:border-gray-700">
            <div><label className={labelCls()}>Titre *</label>
              <input className={inputCls()} value={actionForm.titre} onChange={e => setActionForm(f => ({ ...f, titre: e.target.value }))} placeholder="Ex : Soumettre nos objectifs de réduction à la SBTi d'ici Q3 2025" />
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
                <input className={inputCls()} value={actionForm.responsable} onChange={e => setActionForm(f => ({ ...f, responsable: e.target.value }))} placeholder="Prénom Nom" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button className={btnS()} onClick={() => setShowActionForm(false)}>Annuler</button>
              <button className={btnP()} onClick={addAction} disabled={savingAction || !actionForm.titre.trim()}>{savingAction ? '…' : '✓ Créer'}</button>
            </div>
          </div>
        )}

        {critereActions.length === 0 && !showActionForm && (
          <p className="text-xs text-gray-400 text-center py-3">Aucune action — créez des mesures concrètes pour progresser dans votre transition climatique</p>
        )}

        <div className="space-y-3">
          {critereActions.map(a => {
            const actionNoteKey = `${critere.id}_action_${a.id}`
            const isEditing = editingActionId === a.id
            const isExpanded = expandedActionNoteId === a.id
            return (
              <div key={a.id} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
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
                        <input className={inputCls()} value={editData.responsable ?? a.responsable ?? ''} onChange={e => setEditData(d => ({ ...d, responsable: e.target.value }))} />
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
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => { setEditingActionId(a.id); setEditData({}) }}
                        className="text-gray-400 hover:text-blue-500 text-xs px-1 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" title="Modifier">✏️</button>
                      <button onClick={() => setActionToDelete(a.id)} className="text-gray-300 hover:text-red-400 text-xs px-1">✕</button>
                    </div>
                  </div>
                )}

                {/* Notes & documents par action */}
                <div className="border-t border-gray-100 dark:border-gray-700/50">
                  <button
                    onClick={() => setExpandedActionNoteId(isExpanded ? null : a.id)}
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
                        apiBase="/api/act-carbone"
                        noteTable="act_carbone_notes"
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

interface DiagViewProps {
  diagnostic: DiagnosticData
  reponses: Record<string, Reponse>
  actions: Action[]
  allNotes: Record<string, string>
  allNoteSections: Record<string, NoteSection[]>
  onReponseChange: (critere_id: string, niveau: number, commentaire: string) => void
  onActionsChange: (a: Action[]) => void
  onNoteChange: (key: string, v: string) => void
  onNoteSectionsChange: (key: string, s: NoteSection[]) => void
}

function DiagnosticView({ diagnostic, reponses, actions, allNotes, allNoteSections, onReponseChange, onActionsChange, onNoteChange, onNoteSectionsChange }: DiagViewProps) {
  const [activeAxe, setActiveAxe] = useState(ACT_CARBONE_AXES[0].id)
  const [activeCritere, setActiveCritere] = useState<string | null>(ACT_CARBONE_AXES[0].criteres[0].id)

  const niveaux: Record<string, number> = {}
  for (const [k, v] of Object.entries(reponses)) niveaux[k] = v.niveau
  const scoreGlobal = calculateActCarboneScore(niveaux)
  const badge = getBadge(scoreGlobal)

  return (
    <div className="space-y-4">
      {/* Score simulé */}
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
            {ACT_CARBONE_AXES.map(axe => {
              const axeNiveaux = axe.criteres.map(c => niveaux[c.id] ?? 0)
              const axePct = Math.round(axeNiveaux.reduce((s, n) => s + ACT_CARBONE_NIVEAUX[n].pct, 0) / axe.criteres.length * 100)
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
        {/* Sidebar axes/critères */}
        <div className={card('overflow-hidden')}>
          <div className="space-y-1 p-2">
            {ACT_CARBONE_AXES.map(axe => {
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
                      <div className="text-[10px] text-gray-400">{renseignes}/{axe.criteres.length} critères · {Math.round(axe.weight * 100)}%</div>
                    </div>
                    <span className="text-xs">{isOpen ? '▾' : '›'}</span>
                  </button>
                  {isOpen && (
                    <div className="ml-3 mt-1 space-y-0.5">
                      {axe.criteres.map(c => {
                        const n = niveaux[c.id] ?? 0
                        const niv = ACT_CARBONE_NIVEAUX[n]
                        const isActive = activeCritere === c.id
                        return (
                          <button
                            key={c.id}
                            onClick={() => setActiveCritere(c.id)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${isActive ? 'bg-gray-900 dark:bg-white/10 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'}`}
                          >
                            <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0"
                              style={{ background: niv.color + '33', color: niv.color }}>
                              {niv.shortLabel}
                            </div>
                            <span className="text-[10px] font-medium truncate flex-1">{c.label}</span>
                            {actions.filter(a => a.critere_id === c.id).length > 0 && (
                              <span className="text-[9px] text-gray-400 flex-shrink-0">
                                {actions.filter(a => a.critere_id === c.id).length}🎯
                              </span>
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

        {/* Panneau critère actif */}
        <div className="min-w-0">
          {activeCritere ? (() => {
            const axe = ACT_CARBONE_AXES.find(a => a.criteres.some(c => c.id === activeCritere))!
            const critere = axe.criteres.find(c => c.id === activeCritere)!
            return (
              <CriterePanel
                key={activeCritere}
                axe={axe}
                critere={critere}
                reponse={reponses[activeCritere] ?? null}
                actions={actions}
                diagnosticId={diagnostic.id}
                allNotes={allNotes}
                allNoteSections={allNoteSections}
                onReponseChange={onReponseChange}
                onActionsChange={onActionsChange}
                onNoteChange={onNoteChange}
                onNoteSectionsChange={onNoteSectionsChange}
              />
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

  const filtered = actions.filter(a => {
    const axe = ACT_CARBONE_AXES.find(x => x.criteres.some(c => c.id === a.critere_id))
    if (filterAxe !== 'all' && axe?.id !== filterAxe) return false
    if (filterPriorite !== 'all' && a.priorite !== filterPriorite) return false
    if (filterStatut !== 'all' && a.statut !== filterStatut) return false
    return true
  })

  const total = actions.length
  const termines = actions.filter(a => a.statut === 'termine').length

  async function saveEdit(id: string) {
    setSaving(true)
    const res = await fetch(`/api/act-carbone/${diagnostic.id}/actions?action_id=${id}`, {
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

  const [actionToDelete, setActionToDelete] = useState<string | null>(null)
  async function deleteAction(id: string) {
    await fetch(`/api/act-carbone/${diagnostic.id}/actions?action_id=${id}`, { method: 'DELETE' })
    onActionsChange(actions.filter(a => a.id !== id))
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total actions', value: total,    color: 'text-gray-700 dark:text-gray-300' },
          { label: 'En cours',      value: actions.filter(a => a.statut === 'en_cours').length, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Terminées',     value: `${termines} (${total ? Math.round(termines / total * 100) : 0}%)`, color: 'text-green-600 dark:text-green-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className={card('p-4 text-center')}>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2">
        <select value={filterAxe} onChange={e => setFilterAxe(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 dark:bg-gray-700 dark:text-white focus:outline-none">
          <option value="all">Tous les axes</option>
          {ACT_CARBONE_AXES.map(a => <option key={a.id} value={a.id}>{a.icon} {a.label}</option>)}
        </select>
        <select value={filterPriorite} onChange={e => setFilterPriorite(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 dark:bg-gray-700 dark:text-white focus:outline-none">
          <option value="all">Toutes priorités</option>
          <option value="haute">🔴 Haute</option>
          <option value="moyenne">🟡 Moyenne</option>
          <option value="basse">🟢 Basse</option>
        </select>
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 dark:bg-gray-700 dark:text-white focus:outline-none">
          <option value="all">Tous statuts</option>
          <option value="a_faire">À faire</option>
          <option value="en_cours">En cours</option>
          <option value="termine">Terminé</option>
        </select>
        <div className="text-xs text-gray-400 flex items-center">{filtered.length} action{filtered.length !== 1 ? 's' : ''}</div>
      </div>

      {/* Liste */}
      {filtered.length === 0 && (
        <div className={card('p-8 text-center')}>
          <p className="text-gray-400 text-sm">Aucune action — créez-en depuis la vue Diagnostic, critère par critère</p>
        </div>
      )}
      <div className="space-y-2">
        {filtered.map(a => {
          const axe = ACT_CARBONE_AXES.find(x => x.criteres.some(c => c.id === a.critere_id))
          const isEditing = editId === a.id
          return (
            <div key={a.id} className={card('p-4')}>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5 text-base">{axe?.icon}</div>
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="space-y-2">
                      <input className={inputCls()} value={editData.titre ?? a.titre} onChange={e => setEditData(d => ({ ...d, titre: e.target.value }))} />
                      <textarea className={`${inputCls()} resize-none`} rows={2} value={editData.description ?? a.description ?? ''} onChange={e => setEditData(d => ({ ...d, description: e.target.value }))} />
                      <div className="grid grid-cols-3 gap-2">
                        <select className={inputCls()} value={editData.priorite ?? a.priorite} onChange={e => setEditData(d => ({ ...d, priorite: e.target.value as Action['priorite'] }))}>
                          <option value="haute">🔴 Haute</option><option value="moyenne">🟡 Moyenne</option><option value="basse">🟢 Basse</option>
                        </select>
                        <select className={inputCls()} value={editData.statut ?? a.statut} onChange={e => setEditData(d => ({ ...d, statut: e.target.value as Action['statut'] }))}>
                          <option value="a_faire">À faire</option><option value="en_cours">En cours</option><option value="termine">Terminé</option>
                        </select>
                        <input type="date" className={inputCls()} value={editData.echeance ?? a.echeance ?? ''} onChange={e => setEditData(d => ({ ...d, echeance: e.target.value }))} />
                      </div>
                      <input className={inputCls()} placeholder="Responsable" value={editData.responsable ?? a.responsable ?? ''} onChange={e => setEditData(d => ({ ...d, responsable: e.target.value }))} />
                      <div className="flex gap-2">
                        <button className={btnS()} onClick={() => setEditId(null)}>Annuler</button>
                        <button className={btnP()} onClick={() => saveEdit(a.id)} disabled={saving}>{saving ? '…' : '✓ Sauvegarder'}</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className={`text-sm font-semibold ${a.statut === 'termine' ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>{a.titre}</div>
                      {a.description && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{a.description}</div>}
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PRIORITE_COLORS[a.priorite]}`}>{PRIORITE_LABELS[a.priorite]}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUT_COLORS[a.statut]}`}>{STATUT_LABELS[a.statut]}</span>
                        <span className="text-[10px] text-gray-400">{critereLabel(a.critere_id)}</span>
                        {a.echeance && <span className="text-[10px] text-gray-400">📅 {a.echeance}</span>}
                        {a.responsable && <span className="text-[10px] text-gray-400">👤 {a.responsable}</span>}
                      </div>
                    </>
                  )}
                </div>
                {!isEditing && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => { setEditId(a.id); setEditData({}) }} className="text-xs text-gray-400 hover:text-blue-500 px-1">✏️</button>
                    <button onClick={() => setActionToDelete(a.id)} className="text-xs text-gray-400 hover:text-red-500 px-1">✕</button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
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

// ─── Composant principal ──────────────────────────────────────────────────────

const VIEWS: { id: View; label: string; icon: string }[] = [
  { id: 'presentation',    label: 'Présentation',    icon: '📋' },
  { id: 'dashboard',       label: 'Tableau de bord', icon: '📊' },
  { id: 'diagnostic',      label: 'Diagnostic ACT',  icon: '🌱' },
  { id: 'actions',         label: "Plan d'actions",  icon: '📝' },
  { id: 'correspondances', label: 'Correspondances', icon: '🔗' },
]

export default function ActCarboneDiagnosticApp({ ctx }: { ctx: RseContext }) {
  const { org, year, setActions: setHeaderActions } = ctx
  const [view, setView] = useState<View>('presentation')
  const [diagnostic, setDiagnostic] = useState<DiagnosticData | null>(null)
  const [reponses, setReponses] = useState<Record<string, Reponse>>({})
  const [actions, setActions] = useState<Action[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [noteSections, setNoteSections] = useState<Record<string, NoteSection[]>>({})
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [sharePermission, setSharePermission] = useState<'read'|'edit'>('read')
  const [shareSaving, setShareSaving] = useState(false)
  const [shareError, setShareError] = useState('')

  const load = useCallback(async () => {
    if (!org || !year) return
    setLoading(true)
    try {
      const res = await fetch(`/api/act-carbone?org_id=${org.id}&annee=${year}`)
      const { data: existingDiag } = await res.json()

      let diagId = existingDiag?.id
      if (!diagId) {
        setInitializing(true)
        const createRes = await fetch('/api/act-carbone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ org_id: org.id, annee: year }),
        })
        const { data: created } = await createRes.json()
        diagId = created?.id
        if (!diagId) return
        setDiagnostic(created)
        setInitializing(false)
      } else {
        setDiagnostic(existingDiag)
      }

      const [repRes, actRes, notesRes] = await Promise.all([
        fetch(`/api/act-carbone/${diagId}/reponses`),
        fetch(`/api/act-carbone/${diagId}/actions`),
        fetch(`/api/act-carbone/${diagId}/notes`),
      ])
      const [{ data: repData }, { data: actData }, notesJson] = await Promise.all([repRes.json(), actRes.json(), notesRes.json()])
      const repMap: Record<string, Reponse> = {}
      for (const r of (repData ?? [])) repMap[r.critere_id] = r
      setReponses(repMap)
      setActions(actData ?? [])
      setNotes((notesJson?.data?.notes as Record<string, string>) ?? {})
      setNoteSections((notesJson?.data?.sections as Record<string, NoteSection[]>) ?? {})
    } finally {
      setLoading(false)
    }
  }, [org, year])

  useEffect(() => { load() }, [load])

  async function handleReponseChange(critere_id: string, niveau: number, commentaire: string) {
    if (!diagnostic) return
    setReponses(prev => ({ ...prev, [critere_id]: { critere_id, niveau, commentaire } }))
    await fetch(`/api/act-carbone/${diagnostic.id}/reponses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ critere_id, niveau, commentaire }),
    })
    setTimeout(async () => {
      setReponses(current => {
        const n2: Record<string, number> = {}
        for (const [k, v] of Object.entries(current)) n2[k] = v.niveau
        const score = calculateActCarboneScore(n2)
        if (diagnostic) {
          fetch(`/api/act-carbone/${diagnostic.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ score_global: score }),
          })
          setDiagnostic(prev => prev ? { ...prev, score_global: score } : null)
        }
        return current
      })
    }, 100)
  }

  function handleNoteChange(critere_id: string, content: string) {
    setNotes(prev => ({ ...prev, [critere_id]: content }))
    if (!diagnostic) return
    fetch(`/api/act-carbone/${diagnostic.id}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_key: critere_id, content }),
    }).catch(e => console.error('[act-carbone/notes]', e))
  }

  function handleNoteSectionsChange(critere_id: string, sections: NoteSection[]) {
    setNoteSections(prev => ({ ...prev, [critere_id]: sections }))
    if (!diagnostic) return
    fetch(`/api/act-carbone/${diagnostic.id}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_key: critere_id, sections }),
    }).catch(e => console.error('[act-carbone/notes/sections]', e))
  }

  async function handleExportExcel() {
    if (!diagnostic) return
    setExportingExcel(true)
    try {
      const res = await fetch(`/api/act-carbone/${diagnostic.id}/export-excel`)
      if (!res.ok) throw new Error('Échec export')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `ACT_Carbone_${org?.nom ?? 'diagnostic'}_${year}.xlsx`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { alert('Erreur export Excel : ' + String(e)) }
    finally { setExportingExcel(false) }
  }

  function handleExportPDF() {
    window.print()
  }

  async function handleAddShare() {
    if (!diagnostic || !shareEmail.trim()) return
    setShareSaving(true); setShareError('')
    try {
      alert(`Lien de partage : ${window.location.href}\nEmail notifié : ${shareEmail}`)
      setShareEmail('')
    } catch {
      setShareError('Erreur de partage')
    } finally { setShareSaving(false) }
  }

  // ── Boutons injectés dans le header RseAppShell ───────────────────────────
  useEffect(() => {
    if (!diagnostic) { setHeaderActions(null); return }
    setHeaderActions(
      <div className="flex items-center gap-2">
        <button onClick={handleExportExcel} disabled={exportingExcel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50">
          {exportingExcel ? '⟳' : '⬇'} Excel
        </button>
        <button onClick={handleExportPDF}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          📄 PDF
        </button>
        <button onClick={() => setShowShare(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-colors">
          👥 Partager
        </button>
      </div>
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnostic, exportingExcel])

  const lockedTabs = !org || !diagnostic ? ['dashboard', 'diagnostic', 'actions'] : []

  if (loading && !diagnostic) {
    return <div className="flex justify-center items-center py-20 text-gray-400 text-sm animate-pulse">
      {initializing ? 'Initialisation du diagnostic ACT Bas-Carbone…' : 'Chargement…'}
    </div>
  }

  return (
    <div className="space-y-4">

      {/* ── Modale Partage ──────────────────────────────────────────────────── */}
      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowShare(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-bold text-gray-900 dark:text-white">👥 Partager le diagnostic ACT Bas-Carbone</h2>
              <button onClick={() => setShowShare(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <label className={labelCls()}>Email de l&apos;utilisateur</label>
                <div className="flex gap-2">
                  <input value={shareEmail} onChange={e => setShareEmail(e.target.value)} placeholder="prenom.nom@example.com"
                    className={`${inputCls()} flex-1`}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddShare() }} />
                  <select value={sharePermission} onChange={e => setSharePermission(e.target.value as 'read'|'edit')}
                    className={`${inputCls()} w-24`}>
                    <option value="read">Lecture</option>
                    <option value="edit">Édition</option>
                  </select>
                </div>
                {shareError && <p className="text-xs text-red-500">{shareError}</p>}
                <button onClick={handleAddShare} disabled={shareSaving || !shareEmail.trim()}
                  className={btnP('w-full text-center')}>
                  {shareSaving ? 'Partage en cours…' : '+ Partager'}
                </button>
              </div>
              <p className="text-xs text-gray-400 text-center">Partagez le lien de cette page avec un collaborateur ayant un compte Sens&apos;ethO.</p>
            </div>
          </div>
        </div>
      )}

      {/* Score dans le header */}
      {diagnostic && (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 justify-end">
          <span>Score de maturité ACT :</span>
          <span className="font-bold text-gray-900 dark:text-white">{diagnostic.score_global ?? calculateActCarboneScore(Object.fromEntries(Object.entries(reponses).map(([k, v]) => [k, v.niveau])))}/100</span>
          {(() => { const b = getBadge(diagnostic.score_global ?? 0); return <span style={{ color: b.color }}>{b.icon} {b.label}</span> })()}
        </div>
      )}

      {/* Onglets */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {VIEWS.map(v => {
          const locked = lockedTabs.includes(v.id)
          return (
            <button
              key={v.id}
              onClick={() => !locked && setView(v.id)}
              disabled={locked}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition ${
                view === v.id ? 'border-green-500 text-green-600 dark:text-green-400'
                : locked ? 'border-transparent text-gray-300 dark:text-gray-600 cursor-not-allowed'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <span>{v.icon}</span>{v.label}
            </button>
          )
        })}
      </div>

      {/* Contenu des vues */}
      {view === 'presentation' && <PresentationView />}
      {view === 'correspondances' && <CorrespondancesView />}
      {view === 'dashboard' && org && diagnostic && (
        <TableauDeBordView
          reponses={reponses}
          actions={actions}
          score={diagnostic.score_global ?? calculateActCarboneScore(Object.fromEntries(Object.entries(reponses).map(([k, v]) => [k, v.niveau])))}
        />
      )}
      {view === 'diagnostic' && org && diagnostic && (
        <DiagnosticView
          diagnostic={diagnostic}
          reponses={reponses}
          actions={actions}
          allNotes={notes}
          allNoteSections={noteSections}
          onReponseChange={handleReponseChange}
          onActionsChange={setActions}
          onNoteChange={handleNoteChange}
          onNoteSectionsChange={handleNoteSectionsChange}
        />
      )}
      {view === 'actions' && diagnostic && (
        <ActionsView diagnostic={diagnostic} actions={actions} onActionsChange={setActions} />
      )}
    </div>
  )
}

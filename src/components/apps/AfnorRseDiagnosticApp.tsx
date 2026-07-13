/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import type { RseContext } from '@/components/rse/RseAppShell'
import ConfirmModal from '@/components/ui/ConfirmModal'
import ShareAutocomplete from '@/components/apps/ShareAutocomplete'
import type { NoteSection } from '@/components/apps/GuidedActionNotePanel'
import type { AfnorRsePdfData } from '@/components/apps/AfnorRsePDFReport'
import ResponsableSelect, { useDiagnosticMembers, notifyMembersChanged } from '@/components/rse/ResponsableSelect'

// GuidedActionNotePanel chargé en lazy — même pattern que les autres apps RSE
const GuidedActionNotePanel = dynamic(() => import('@/components/apps/GuidedActionNotePanel'), {
  ssr: false,
  loading: () => <div className="py-3 text-xs text-gray-400 animate-pulse">Chargement éditeur…</div>
})

// Rapport PDF chargé en lazy (html2canvas + jspdf hors du bundle principal)
const AfnorRsePDFReport = dynamic(() => import('@/components/apps/AfnorRsePDFReport'), {
  ssr: false,
  loading: () => null,
})

// ─── Données statiques AFNOR ──────────────────────────────────────────────────

export const AFNOR_AXES = [
  {
    id: 'gouvernance', label: 'Stratégie RSE & Gouvernance', icon: '🏛️',
    color: '#7c3aed', colorLight: '#ede9fe', weight: 0.20,
    description: 'Définition et déploiement d\'une vision RSE partagée, identification et dialogue avec les parties prenantes, pilotage et communication de la démarche RSE.',
    criteres: [
      { id: 'gouv-vision', label: 'Vision et engagement RSE', description: 'La direction a formalisé une vision RSE (politique, charte, engagements), alignée avec les valeurs de l\'organisation et intégrée à la stratégie globale.' },
      { id: 'gouv-parties', label: 'Identification et dialogue parties prenantes', description: 'Les parties prenantes de l\'organisation sont identifiées et cartographiées. Un dialogue structuré avec elles alimente la démarche RSE.' },
      { id: 'gouv-pilotage', label: 'Gouvernance et pilotage RSE', description: 'Un dispositif de pilotage est en place : responsable RSE désigné, comité dédié, objectifs mesurables, revue régulière par la direction.' },
      { id: 'gouv-reporting', label: 'Communication et reporting RSE', description: 'La démarche RSE fait l\'objet d\'une communication interne et externe (rapport RSE, site web, labels) permettant une évaluation par les parties prenantes.' },
    ],
  },
  {
    id: 'rh', label: 'Capital Humain & Social', icon: '👥',
    color: '#2563eb', colorLight: '#dbeafe', weight: 0.20,
    description: 'Qualité des emplois et conditions de travail, exercice du dialogue social, prévention des risques professionnels et développement des compétences de tous les collaborateurs.',
    criteres: [
      { id: 'rh-emploi', label: 'Emploi et conditions de travail', description: 'L\'organisation garantit des conditions de travail décentes (rémunération équitable, temps de travail, contrats adaptés, non-discrimination, égalité F/H).' },
      { id: 'rh-dialogue', label: 'Dialogue social et participation', description: 'Le dialogue social est actif et structuré : instances représentatives, consultation régulière, accords collectifs, mécanismes d\'expression et de remontée des préoccupations.' },
      { id: 'rh-sst', label: 'Santé, sécurité et bien-être au travail', description: 'Une politique SST active prévient les risques professionnels (DUERP à jour, actions de prévention, culture sécurité) et favorise la qualité de vie au travail.' },
      { id: 'rh-competences', label: 'Développement des compétences', description: 'La formation, l\'employabilité et l\'évolution professionnelle sont prioritaires (plan de développement, entretiens annuels, accès équitable à la formation pour tous).' },
    ],
  },
  {
    id: 'environnement', label: 'Performance Environnementale', icon: '🌿',
    color: '#16a34a', colorLight: '#dcfce7', weight: 0.20,
    description: 'Réduction des impacts environnementaux de l\'organisation : énergie, émissions de GES, consommation de ressources, gestion des déchets et préservation de la biodiversité.',
    criteres: [
      { id: 'env-energie', label: 'Énergie et lutte contre le changement climatique', description: 'L\'organisation mesure ses émissions de GES (bilan carbone), se fixe des objectifs de réduction et déploie des actions d\'efficacité énergétique et de recours aux ENR.' },
      { id: 'env-ressources', label: 'Gestion durable des ressources', description: 'La consommation de ressources (eau, matières premières, fournitures) est mesurée et des actions d\'optimisation sont déployées (économie circulaire, réduction à la source).' },
      { id: 'env-dechets', label: 'Prévention des pollutions et gestion des déchets', description: 'Les rejets et déchets sont maîtrisés (tri, valorisation, élimination conforme), les risques de pollution sont identifiés et prévenus, la conformité réglementaire est assurée.' },
      { id: 'env-biodiversite', label: 'Biodiversité et impact sur les écosystèmes', description: 'L\'organisation connaît ses impacts sur la biodiversité, les réduit (sites, achats, mobilité) et prend des engagements de préservation ou restauration des écosystèmes.' },
    ],
  },
  {
    id: 'achats', label: 'Achats Responsables & Éthique', icon: '🤝',
    color: '#ea580c', colorLight: '#ffedd5', weight: 0.20,
    description: 'Intégration de critères RSE dans la politique d\'achats et la relation avec les fournisseurs, pratiques commerciales éthiques et lutte contre la corruption.',
    criteres: [
      { id: 'ach-politique', label: 'Politique achats responsables', description: 'Une politique d\'achats responsables est formalisée, intégrant des critères sociaux, environnementaux et éthiques dans les processus de sélection et d\'évaluation des fournisseurs.' },
      { id: 'ach-fournisseurs', label: 'Évaluation et accompagnement des fournisseurs', description: 'Les fournisseurs sont évalués sur leurs pratiques RSE (questionnaires, audits). Les fournisseurs stratégiques sont accompagnés dans leur démarche RSE.' },
      { id: 'ach-ethique', label: 'Lutte contre la corruption et conformité', description: 'L\'organisation dispose d\'un dispositif de prévention de la corruption (code de conduite, formation, procédures d\'alerte), conforme à la loi Sapin II le cas échéant.' },
      { id: 'ach-commercial', label: 'Pratiques commerciales loyales', description: 'Les relations commerciales sont fondées sur l\'équité (délais de paiement respectés, conditions contractuelles équilibrées, respect de la propriété intellectuelle, pas d\'abus de position dominante).' },
    ],
  },
  {
    id: 'territoire', label: 'Territoire & Parties Prenantes', icon: '🏙️',
    color: '#0891b2', colorLight: '#cffafe', weight: 0.20,
    description: 'Contribution au développement du territoire et des communautés locales, qualité de la relation clients et consommateurs, transparence et dialogue avec l\'ensemble des parties prenantes.',
    criteres: [
      { id: 'terr-communaute', label: 'Implication communautaire et territoire', description: 'L\'organisation s\'implique activement dans la vie locale (emploi local, partenariats associatifs, mécénat de compétences, soutien à l\'ESS, participation à des initiatives territoriales RSE).' },
      { id: 'terr-clients', label: 'Responsabilité envers les clients', description: 'L\'organisation garantit des pratiques loyales envers ses clients (information transparente, sécurité des produits/services, gestion des réclamations, protection des données personnelles).' },
      { id: 'terr-transparence', label: 'Transparence et dialogue parties prenantes', description: 'Un dialogue ouvert avec l\'ensemble des parties prenantes (clients, riverains, associations, collectivités) est assuré. Les résultats RSE sont communiqués avec transparence.' },
      { id: 'terr-developpement', label: 'Contribution au développement local', description: 'L\'organisation mesure et valorise sa contribution socio-économique au territoire (emplois directs et indirects, achats locaux, appui à la formation, partenariats avec les collectivités).' },
    ],
  },
]

export const AFNOR_NIVEAUX = [
  { value: 0, shortLabel: 'NC',     label: 'Non initié',  description: 'Aucune démarche structurée en place', pct: 0,    color: '#9ca3af', bg: 'bg-gray-100 dark:bg-gray-700',         text: 'text-gray-600 dark:text-gray-400',   star: '' },
  { value: 1, shortLabel: '⭐',     label: 'Engagé',      description: 'Démarche initiée, premières actions concrètes — Niveau Label ⭐',              pct: 0.25, color: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-900/20',     text: 'text-amber-700 dark:text-amber-400', star: '⭐' },
  { value: 2, shortLabel: '⭐⭐',   label: 'Confirmé',    description: 'Démarche structurée avec des résultats mesurables — Niveau Label ⭐⭐',         pct: 0.50, color: '#10b981', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400', star: '⭐⭐' },
  { value: 3, shortLabel: '⭐⭐⭐', label: 'Avancé',      description: 'Démarche intégrée et améliorée en continu — Niveau Label ⭐⭐⭐',              pct: 0.75, color: '#3b82f6', bg: 'bg-blue-50 dark:bg-blue-900/20',       text: 'text-blue-700 dark:text-blue-400',   star: '⭐⭐⭐' },
  { value: 4, shortLabel: '⭐⭐⭐⭐', label: 'Exemplaire', description: 'Leadership RSE, innovation et partage de bonnes pratiques — Niveau Label ⭐⭐⭐⭐', pct: 1.0, color: '#7c3aed', bg: 'bg-purple-50 dark:bg-purple-900/20',   text: 'text-purple-700 dark:text-purple-400', star: '⭐⭐⭐⭐' },
]

const BADGE_LEVELS = [
  { label: 'Exemplaire',         min: 90, color: '#7c3aed', icon: '🏆' },
  { label: 'Avancé',             min: 75, color: '#3b82f6', icon: '⭐⭐⭐' },
  { label: 'Confirmé',           min: 50, color: '#10b981', icon: '⭐⭐' },
  { label: 'Engagé',             min: 25, color: '#f59e0b', icon: '⭐' },
  { label: 'Démarche à initier', min: 0,  color: '#9ca3af', icon: '○' },
]

export function calculateAfnorScore(niveaux: Record<string, number>): number {
  let total = 0
  for (const axe of AFNOR_AXES) {
    let axeScore = 0
    const nb = axe.criteres.length
    for (const c of axe.criteres) {
      const n = niveaux[c.id] ?? 0
      axeScore += (AFNOR_NIVEAUX[n]?.pct ?? 0) / nb
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
function inputCls() { return 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500' }
function labelCls() { return 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1' }
function btnP(extra = '') { return `px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors disabled:opacity-50 ${extra}` }
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
  for (const axe of AFNOR_AXES) {
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
          <span className="text-4xl">🏆</span>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Label Engagé RSE — AFNOR Certification</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Certification française de maturité RSE fondée sur ISO 26000, ouverte à toutes les organisations</p>
          </div>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          Le <strong>Label Engagé RSE</strong> est la certification française de référence en matière de RSE, délivrée par
          AFNOR Certification. Fondé sur la norme internationale <strong>ISO 26000</strong>, il reconnaît et valorise
          les organisations qui s&apos;engagent concrètement dans une démarche de responsabilité sociétale. Ouvert à toutes
          les structures — ETI, PME, associations, collectivités — il offre une reconnaissance externe progressive en 4 niveaux.
        </p>
      </div>

      {/* 4 niveaux + durée de validité */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={card('p-5 border-l-4 border-purple-500')}>
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">⭐ Les 4 niveaux du Label</h3>
          <div className="space-y-2">
            {AFNOR_NIVEAUX.filter(n => n.value > 0).map(n => (
              <div key={n.value} className="flex items-center gap-3">
                <div className="text-lg w-16 flex-shrink-0">{n.star}</div>
                <div>
                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">{n.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{n.description.split(' — ')[0]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={card('p-5 border-l-4 border-blue-500')}>
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">📋 Processus d&apos;obtention</h3>
          <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            {[
              ['1', 'Diagnostic interne', 'Auto-évaluation sur les 5 axes (cet outil)'],
              ['2', 'Audit AFNOR Certification', 'Audit documentaire et sur site'],
              ['3', 'Attribution du niveau', 'Label valable 3 ans, audit de suivi à 18 mois'],
            ].map(([num, title, desc]) => (
              <div key={num} className="flex gap-2">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center justify-center text-xs font-bold">{num}</div>
                <div><span className="font-medium">{title}</span> — {desc}</div>
              </div>
            ))}
          </div>
          <div className={`mt-3 text-xs px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300`}>
            ⏱️ Durée de validité : <strong>3 ans</strong> (audit de suivi obligatoire à 18 mois)
          </div>
        </div>
      </div>

      {/* Bénéfices */}
      <div className={card('p-5')}>
        <h3 className="font-bold text-gray-900 dark:text-white mb-3">✅ Bénéfices du Label Engagé RSE</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            ['🏅', 'Reconnaissance externe', 'Certification officielle valorisée par les acheteurs publics et privés'],
            ['📈', 'Amélioration continue', 'Progression structurée par niveaux vers l\'excellence RSE'],
            ['🤝', 'Différenciation commerciale', 'Argument de vente face aux exigences RSE croissantes des clients'],
            ['⚖️', 'Réponse aux exigences', 'Conformité renforcée vis-à-vis des lois RSE (PACTE, Sapin II, vigilance)'],
          ].map(([icon, title, desc]) => (
            <div key={title} className="flex items-start gap-2">
              <span className="text-xl flex-shrink-0">{icon}</span>
              <div>
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Les 5 axes */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Les 5 axes du diagnostic</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {AFNOR_AXES.map(axe => (
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
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Niveaux de maturité RSE</h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {AFNOR_NIVEAUX.map(n => (
            <div key={n.value} className={card('p-3 text-center')}>
              <div className="text-2xl font-bold">{n.star || <span className="text-gray-400 text-lg">○</span>}</div>
              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mt-0.5">{n.label}</div>
              <div className="text-[10px] text-gray-400 mt-1 leading-tight">{n.description.split(' — ')[0]}</div>
              <div className="mt-2 text-xs font-medium" style={{ color: n.color }}>{Math.round(n.pct * 100)}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Badge de score */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Badges de score global</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {BADGE_LEVELS.map(b => (
            <div key={b.label} className={card('p-4 text-center')}>
              <div className="text-2xl">{b.icon}</div>
              <div className="font-bold text-xs mt-1" style={{ color: b.color }}>{b.label}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">≥ {b.min}%</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">Seuils : 0-25% Démarche à initier · 25-50% Engagé · 50-75% Confirmé · 75-90% Avancé · 90-100% Exemplaire</p>
      </div>

      {/* Ancrage référentiels */}
      <div className={card('p-5')}>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">🔗 Ancrage dans les référentiels internationaux</h3>
        <div className="flex flex-wrap gap-2">
          {['ISO 26000', 'UN SDGs / ODD', 'Principes Directeurs OCDE'].map(ref => (
            <span key={ref} className="px-2 py-1 text-xs rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium">{ref}</span>
          ))}
        </div>
      </div>

      {/* Comment utiliser */}
      <div className={card('p-5 space-y-3')}>
        <h3 className="font-semibold text-gray-900 dark:text-white">💡 Comment utiliser cette application</h3>
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          {[
            ['1', 'Diagnostic', 'Pour chaque critère, évaluez votre niveau (NC à ⭐⭐⭐⭐), documentez vos pratiques et créez des actions.'],
            ['2', "Plan d'actions", 'Visualisez et gérez toutes vos actions : priorité, responsable, échéance, statut.'],
            ['3', 'Documents & Preuves', 'Uploadez dans SharePoint vos preuves (politiques, bilans, rapports) par critère.'],
            ['4', 'Export Excel', 'Générez un rapport Excel structuré en 6 onglets pour préparer l\'audit AFNOR.'],
          ].map(([num, title, desc]) => (
            <div key={num} className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 flex items-center justify-center text-xs font-bold">{num}</div>
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

  const axeStats = AFNOR_AXES.map(axe => {
    const total = axe.criteres.length
    const niveaux = axe.criteres.map(c => reponses[c.id]?.niveau ?? 0)
    const pct = niveaux.reduce((s, n) => s + (AFNOR_NIVEAUX[n]?.pct ?? 0), 0) / total
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

  // Niveau actuel du label
  const labelNiveau = score >= 90 ? '⭐⭐⭐⭐ Exemplaire' : score >= 75 ? '⭐⭐⭐ Avancé' : score >= 50 ? '⭐⭐ Confirmé' : score >= 25 ? '⭐ Engagé' : 'Démarche à initier'

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
          <div className="text-xs font-semibold text-center" style={{ color: badge.color }}>{labelNiveau}</div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
            <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${score}%`, background: badge.color }} />
          </div>
          <div className="text-xs text-gray-400 mt-1">25% Engagé · 50% Confirmé · 75% Avancé · 90% Exemplaire</div>
        </div>

        {/* Radar */}
        <div className={card('p-4 sm:col-span-2')}>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Radar RSE par axe</h3>
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
              <polygon points={dataPolygon} fill="#7c3aed22" stroke="#7c3aed" strokeWidth="2.5" strokeLinejoin="round" />
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
                  const niv = AFNOR_NIVEAUX[n]
                  return (
                    <div key={c.id} className="flex items-center gap-2">
                      <div className="w-6 h-5 rounded flex items-center justify-center text-[9px] font-bold flex-shrink-0" style={{ background: (niv?.color ?? '#9ca3af') + '33', color: niv?.color ?? '#9ca3af' }}>
                        {niv?.star || 'NC'}
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
            <div className="h-2 rounded-full bg-purple-500 transition-all" style={{ width: `${Math.round(actions.filter(a => a.statut === 'termine').length / actions.length * 100)}%` }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Vue Correspondances ──────────────────────────────────────────────────────

const CORRESPONDANCES_AFNOR = [
  {
    categorie: "Applications RSE Sens'ethO",
    icon: '🏠',
    color: 'indigo',
    items: [
      {
        ref: 'ISO 26000 & ODD', icon: '⚙️', route: '/rse/iso26000',
        desc: "Norme internationale RSE — fondement direct du Label Engagé RSE. Les 7 domaines ISO 26000 structurent les 5 axes du diagnostic AFNOR.",
        liens: [
          { axe: 'gouvernance',   label: 'Gouvernance',   ref: 'ISO 26000 — 6.2 Gouvernance de l\'organisation' },
          { axe: 'rh',            label: 'Capital Humain', ref: 'ISO 26000 — 6.4 Pratiques en matière d\'emploi + 6.3 Droits de l\'Homme' },
          { axe: 'environnement', label: 'Environnement', ref: 'ISO 26000 — 6.5 Environnement' },
          { axe: 'achats',        label: 'Achats',         ref: 'ISO 26000 — 6.6 Bonnes pratiques des affaires' },
          { axe: 'territoire',    label: 'Territoire',     ref: 'ISO 26000 — 6.8 Communautés et développement local' },
        ],
      },
      {
        ref: 'VSME EFRAG', icon: '📊', route: '/rse/vsme',
        desc: "Standard volontaire de reporting PME — le Label Engagé RSE prépare excellemment au reporting VSME en structurant la collecte d\'indicateurs E, S et G.",
        liens: [
          { axe: 'environnement', label: 'Environnement', ref: 'VSME E1/E2/E3 — Énergie, Ressources, Déchets' },
          { axe: 'rh',            label: 'Capital Humain', ref: 'VSME S1 — Effectifs propres, conditions de travail' },
          { axe: 'gouvernance',   label: 'Gouvernance',   ref: 'VSME G1 — Conduite des affaires' },
        ],
      },
      {
        ref: 'Diagnostic RSE Guidé', icon: '🧭', route: '/rse/guided',
        desc: "Application de préparation et de structuration de la démarche RSE — complémentaire au Label Engagé RSE comme outil de diagnostic préliminaire.",
        liens: [
          { axe: 'gouvernance', label: 'Gouvernance', ref: 'Diagnostic guidé — structuration de la stratégie RSE' },
        ],
      },
      {
        ref: 'EcoVadis', icon: '🌱', route: '/rse/ecovadis',
        desc: "Outil d\'évaluation RSE des fournisseurs — le volet Achats Responsables du Label AFNOR s\'aligne directement avec les critères EcoVadis.",
        liens: [
          { axe: 'achats', label: 'Achats', ref: 'EcoVadis — Environnement, Social, Éthique, Achats responsables' },
        ],
      },
      {
        ref: 'Devoir de Vigilance', icon: '⚖️', route: '/rse/vigilance',
        desc: "Loi française 2017-399 sur le devoir de vigilance — le Label AFNOR constitue une démarche de vigilance structurée pour les entreprises concernées.",
        liens: [
          { axe: 'achats',      label: 'Achats',      ref: 'Vigilance — Chaîne d\'approvisionnement et fournisseurs' },
          { axe: 'gouvernance', label: 'Gouvernance', ref: 'Vigilance — Plan de vigilance et cartographie des risques' },
        ],
      },
    ],
  },
  {
    categorie: 'Référentiels externes',
    icon: '🌍',
    color: 'blue',
    items: [
      {
        ref: 'ISO 26000 (norme internationale RSE)', icon: '📐', route: null,
        desc: "Norme internationale de lignes directrices sur la responsabilité sociétale — fondement du Label Engagé RSE. Les 7 domaines couvrent l\'ensemble des axes AFNOR.",
        liens: [
          { axe: 'gouvernance',   label: 'Gouvernance',   ref: 'ISO 26000 — Domaine 6.2 : Gouvernance de l\'organisation' },
          { axe: 'rh',            label: 'Capital Humain', ref: 'ISO 26000 — Domaines 6.3 (Droits de l\'Homme) + 6.4 (Travail)' },
          { axe: 'environnement', label: 'Environnement', ref: 'ISO 26000 — Domaine 6.5 : Environnement' },
          { axe: 'achats',        label: 'Achats',         ref: 'ISO 26000 — Domaine 6.6 : Loyauté des pratiques' },
          { axe: 'territoire',    label: 'Territoire',     ref: 'ISO 26000 — Domaines 6.7 (Consommateurs) + 6.8 (Communautés)' },
        ],
      },
      {
        ref: 'B Corp (certification internationale)', icon: '🌐', route: null,
        desc: "Certification internationale B Corp — approche complémentaire avec un niveau d\'exigence supérieur, adaptée aux entreprises cherchant une reconnaissance internationale.",
        liens: [
          { axe: 'gouvernance',   label: 'Gouvernance',   ref: 'B Corp — Impact gouvernance et mission d\'entreprise' },
          { axe: 'territoire',    label: 'Territoire',     ref: 'B Corp — Impact communauté et environnement' },
        ],
      },
      {
        ref: 'Global Compact ONU (10 principes)', icon: '🕊️', route: null,
        desc: "Pacte Mondial des Nations Unies — 10 principes fondamentaux RSE. Le Label AFNOR couvre les 4 piliers : droits de l\'Homme, travail, environnement, lutte anti-corruption.",
        liens: [
          { axe: 'rh',            label: 'Capital Humain', ref: 'Global Compact — Principes 1-6 : Droits de l\'Homme et Travail' },
          { axe: 'environnement', label: 'Environnement', ref: 'Global Compact — Principes 7-9 : Environnement' },
          { axe: 'achats',        label: 'Achats',         ref: 'Global Compact — Principe 10 : Lutte contre la corruption' },
        ],
      },
      {
        ref: 'ODD / SDGs (17 objectifs)', icon: '🎯', route: null,
        desc: "Objectifs de Développement Durable 2030 — le Label Engagé RSE contribue directement à ODD 8 (Travail décent), ODD 12 (Consommation responsable), ODD 13 (Climat), ODD 17 (Partenariats).",
        liens: [
          { axe: 'rh',            label: 'Capital Humain', ref: 'ODD 8 — Travail décent et croissance économique' },
          { axe: 'environnement', label: 'Environnement', ref: 'ODD 12/13/15 — Consommation, Climat, Vie terrestre' },
          { axe: 'territoire',    label: 'Territoire',     ref: 'ODD 11/17 — Villes durables, Partenariats' },
        ],
      },
      {
        ref: 'CSRD / ESRS (directive UE)', icon: '🇪🇺', route: null,
        desc: "Corporate Sustainability Reporting Directive — le Label Engagé RSE structure la collecte de données pour les futurs reportings CSRD (ESRS E, S, G).",
        liens: [
          { axe: 'gouvernance',   label: 'Gouvernance',   ref: 'ESRS 2 — Gouvernance de la durabilité' },
          { axe: 'environnement', label: 'Environnement', ref: 'ESRS E1/E3/E4 — Climat, Ressources, Biodiversité' },
          { axe: 'rh',            label: 'Capital Humain', ref: 'ESRS S1 — Effectifs propres' },
        ],
      },
      {
        ref: 'GRI Standards (reporting RSE)', icon: '📋', route: null,
        desc: "Global Reporting Initiative — référentiel international de reporting RSE. Le Label AFNOR s\'appuie sur des indicateurs alignés avec les GRI Standards universels.",
        liens: [
          { axe: 'gouvernance',   label: 'Gouvernance',   ref: 'GRI 2 — Divulgations générales et gouvernance' },
          { axe: 'rh',            label: 'Capital Humain', ref: 'GRI 401/403/404 — Emploi, SST, Formation' },
          { axe: 'environnement', label: 'Environnement', ref: 'GRI 302/303/305/306 — Énergie, Eau, GES, Déchets' },
        ],
      },
      {
        ref: 'Loi PACTE (entreprise à mission)', icon: '📜', route: null,
        desc: "Loi PACTE 2019 — raison d\'être et entreprise à mission. La formalisation d\'une vision RSE (axe Gouvernance AFNOR) s\'aligne avec la démarche d\'entreprise à mission.",
        liens: [
          { axe: 'gouvernance', label: 'Gouvernance', ref: 'Loi PACTE — Raison d\'être et objet social étendu' },
        ],
      },
      {
        ref: 'Labels sectoriels (HVE, RSE Pro Commerce...)', icon: '🏷️', route: null,
        desc: "Labels sectoriels complémentaires — HVE (agriculture), RSE Pro Commerce, labels territoriaux. Le Label AFNOR est transversal et valorise les certifications sectorielles.",
        liens: [
          { axe: 'environnement', label: 'Environnement', ref: 'HVE — Haute Valeur Environnementale (agriculture)' },
          { axe: 'territoire',    label: 'Territoire',     ref: 'RSE Pro Commerce — Engagement territorial des commerçants' },
        ],
      },
    ],
  },
]

const AXE_BADGE_CLS: Record<string, string> = {
  gouvernance:   'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  rh:            'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  environnement: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  achats:        'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  territoire:    'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
}

function CorrespondancesView() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className={card('p-4')}>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Le Label Engagé RSE s&apos;inscrit dans un écosystème de standards RSE internationaux et nationaux.
          Les correspondances ci-dessous vous permettent de mutualiser vos efforts et d&apos;aligner votre
          démarche AFNOR avec les applications Sens&apos;ethO, la CSRD, l&apos;ISO 26000, les ODD, B Corp
          et les autres référentiels clés.
        </p>
      </div>

      {CORRESPONDANCES_AFNOR.map(cat => (
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
                          const axe = AFNOR_AXES.find(a => a.id === l.axe)
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

interface AAxe { id: string; label: string; icon: string; color: string; colorLight: string; weight: number; description: string; criteres: ACritere[] }
interface ACritere { id: string; label: string; description: string }

interface CriterePanelProps {
  axe: AAxe
  critere: ACritere
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

  const members = useDiagnosticMembers('afnor-rse', diagnosticId)

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
    const res = await fetch(`/api/afnor-rse/${diagnosticId}/actions`, {
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
    await fetch(`/api/afnor-rse/${diagnosticId}/actions?action_id=${id}`, { method: 'DELETE' })
    onActionsChange(actions.filter(a => a.id !== id))
  }

  async function saveEdit(id: string) {
    setSavingEdit(true)
    const res = await fetch(`/api/afnor-rse/${diagnosticId}/actions?action_id=${id}`, {
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
    const res = await fetch(`/api/afnor-rse/${diagnosticId}/actions?action_id=${action.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: next }),
    })
    if (res.ok) {
      const { data } = await res.json()
      onActionsChange(actions.map(a => a.id === action.id ? data : a))
    }
  }

  const niv = AFNOR_NIVEAUX[niveau]

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
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">Niveau de maturité RSE</div>
          {savingReponse && <span className="text-xs text-gray-400 animate-pulse">Enregistrement…</span>}
          {savedOk && !savingReponse && <span className="text-xs text-green-600 dark:text-green-400">✓ Sauvegardé</span>}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {AFNOR_NIVEAUX.map(n => (
            <button key={n.value} onClick={() => handleNiveauChange(n.value)}
              className={`p-2 rounded-lg border-2 text-center transition-all ${niveau === n.value ? `${n.bg} ring-2 ring-offset-1` : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}
              style={{ borderColor: niveau === n.value ? n.color : undefined }}>
              <div className="text-lg font-bold" style={{ color: n.color }}>{n.star || <span className="text-gray-400 text-xs">NC</span>}</div>
              <div className="text-[10px] font-medium text-gray-600 dark:text-gray-400 mt-0.5">{n.label}</div>
            </button>
          ))}
        </div>
        {niv && <div className={`text-xs px-3 py-1.5 rounded-lg ${niv.bg} ${niv.text} font-medium`}>{niv.description} ({Math.round(niv.pct * 100)}%)</div>}
      </div>

      {/* Commentaire + Notes & documents */}
      <div className={card('p-4 space-y-2')}>
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">📝 Commentaire & contexte</label>
        <p className="text-xs text-gray-500 dark:text-gray-400">Décrivez vos pratiques actuelles, les preuves documentaires disponibles, les résultats obtenus et les axes d&apos;amélioration identifiés.</p>
        <textarea
          value={commentaire}
          onChange={e => handleCommentaireChange(e.target.value)}
          rows={4}
          placeholder="Ex : Nous avons formalisé notre politique RSE en 2023, avec un responsable RSE désigné et un comité dédié réuni trimestriellement…"
          className={`${inputCls()} resize-y`}
        />
        <GuidedActionNotePanel
          diagnosticId={diagnosticId}
          actionKey={critere.id}
          apiBase="/api/afnor-rse"
          noteTable="afnor_notes"
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
            🎯 Actions d&apos;amélioration
            {critereActions.length > 0 && (
              <span className="ml-2 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-1.5 py-0.5 rounded-full font-medium">
                {critereActions.filter(a => a.statut === 'termine').length}/{critereActions.length}
              </span>
            )}
          </div>
          <button onClick={() => setShowActionForm(v => !v)} className={btnP('text-xs py-1.5')}>+ Action</button>
        </div>

        {showActionForm && (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 space-y-2 border border-gray-200 dark:border-gray-700">
            <div><label className={labelCls()}>Titre *</label>
              <input className={inputCls()} value={actionForm.titre} onChange={e => setActionForm(f => ({ ...f, titre: e.target.value }))} placeholder="Ex : Formaliser la politique RSE et la soumettre à la direction" />
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
          <p className="text-xs text-gray-400 text-center py-3">Aucune action — créez des mesures concrètes pour progresser vers le niveau supérieur</p>
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
                        apiBase="/api/afnor-rse"
                        noteTable="afnor_notes"
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
  const [activeAxe, setActiveAxe] = useState(AFNOR_AXES[0].id)
  const [activeCritere, setActiveCritere] = useState<string | null>(AFNOR_AXES[0].criteres[0].id)

  const niveaux: Record<string, number> = {}
  for (const [k, v] of Object.entries(reponses)) niveaux[k] = v.niveau
  const scoreGlobal = calculateAfnorScore(niveaux)
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
            {AFNOR_AXES.map(axe => {
              const axeNiveaux = axe.criteres.map(c => niveaux[c.id] ?? 0)
              const axePct = Math.round(axeNiveaux.reduce((s, n) => s + AFNOR_NIVEAUX[n].pct, 0) / axe.criteres.length * 100)
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
            {AFNOR_AXES.map(axe => {
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
                        const niv = AFNOR_NIVEAUX[n]
                        const isActive = activeCritere === c.id
                        return (
                          <button
                            key={c.id}
                            onClick={() => setActiveCritere(c.id)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${isActive ? 'bg-gray-900 dark:bg-white/10 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'}`}
                          >
                            <div className="w-6 h-4 rounded flex items-center justify-center text-[8px] font-bold flex-shrink-0"
                              style={{ background: niv.color + '33', color: niv.color }}>
                              {niv.star || 'NC'}
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
            const axe = AFNOR_AXES.find(a => a.criteres.some(c => c.id === activeCritere))!
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

  const members = useDiagnosticMembers('afnor-rse', diagnostic.id)

  const filtered = actions.filter(a => {
    const axe = AFNOR_AXES.find(x => x.criteres.some(c => c.id === a.critere_id))
    if (filterAxe !== 'all' && axe?.id !== filterAxe) return false
    if (filterPriorite !== 'all' && a.priorite !== filterPriorite) return false
    if (filterStatut !== 'all' && a.statut !== filterStatut) return false
    return true
  })

  const total = actions.length
  const termines = actions.filter(a => a.statut === 'termine').length

  async function saveEdit(id: string) {
    setSaving(true)
    const res = await fetch(`/api/afnor-rse/${diagnostic.id}/actions?action_id=${id}`, {
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
    await fetch(`/api/afnor-rse/${diagnostic.id}/actions?action_id=${id}`, { method: 'DELETE' })
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
          {AFNOR_AXES.map(a => <option key={a.id} value={a.id}>{a.icon} {a.label}</option>)}
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
          const axe = AFNOR_AXES.find(x => x.criteres.some(c => c.id === a.critere_id))
          const isEditing = editId === a.id
          const incomplete = !a.responsable && !a.echeance
          return (
            <div key={a.id} className={card(`p-4${incomplete ? ' ring-1 ring-amber-300 dark:ring-amber-500/40' : ''}`)}>
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
                      <ResponsableSelect className={inputCls()} value={editData.responsable ?? a.responsable ?? ''} members={members} onChange={v => setEditData(d => ({ ...d, responsable: v }))} />
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
                        {incomplete && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">⚠ À compléter</span>}
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
  { id: 'diagnostic',      label: 'Diagnostic RSE',  icon: '🏆' },
  { id: 'actions',         label: "Plan d'actions",  icon: '📝' },
  { id: 'correspondances', label: 'Correspondances', icon: '🔗' },
]

export default function AfnorRseDiagnosticApp({ ctx }: { ctx: RseContext }) {
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
  const [exportingPDF, setExportingPDF] = useState(false)
  const [pdfData, setPdfData] = useState<AfnorRsePdfData | null>(null)
  const [showShare, setShowShare] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [sharePermission, setSharePermission] = useState<'read'|'edit'>('read')
  const [shareSaving, setShareSaving] = useState(false)
  const [shareError, setShareError] = useState('')
  const [shareList, setShareList] = useState<{ id: string; email: string; permission: 'read'|'edit' }[]>([])

  const load = useCallback(async () => {
    if (!org || !year) return
    setLoading(true)
    try {
      const res = await fetch(`/api/afnor-rse?org_id=${org.id}&annee=${year}`)
      const { data: existingDiag } = await res.json()

      let diagId = existingDiag?.id
      if (!diagId) {
        setInitializing(true)
        const createRes = await fetch('/api/afnor-rse', {
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
        fetch(`/api/afnor-rse/${diagId}/reponses`),
        fetch(`/api/afnor-rse/${diagId}/actions`),
        fetch(`/api/afnor-rse/${diagId}/notes`),
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
    await fetch(`/api/afnor-rse/${diagnostic.id}/reponses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ critere_id, niveau, commentaire }),
    })
    setTimeout(async () => {
      setReponses(current => {
        const n2: Record<string, number> = {}
        for (const [k, v] of Object.entries(current)) n2[k] = v.niveau
        const score = calculateAfnorScore(n2)
        if (diagnostic) {
          fetch(`/api/afnor-rse/${diagnostic.id}`, {
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
    fetch(`/api/afnor-rse/${diagnostic.id}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_key: critere_id, content }),
    }).catch(e => console.error('[afnor-rse/notes]', e))
  }

  function handleNoteSectionsChange(critere_id: string, sections: NoteSection[]) {
    setNoteSections(prev => ({ ...prev, [critere_id]: sections }))
    if (!diagnostic) return
    fetch(`/api/afnor-rse/${diagnostic.id}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_key: critere_id, sections }),
    }).catch(e => console.error('[afnor-rse/notes/sections]', e))
  }

  async function handleExportExcel() {
    if (!diagnostic) return
    setExportingExcel(true)
    try {
      const res = await fetch(`/api/afnor-rse/${diagnostic.id}/export-excel`)
      if (!res.ok) throw new Error('Échec export')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `LabelRSE_AFNOR_${org?.denomination ?? 'diagnostic'}_${year}.xlsx`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { alert('Erreur export Excel : ' + String(e)) }
    finally { setExportingExcel(false) }
  }

  function buildPdfData(): AfnorRsePdfData {
    const niveaux: Record<string, number> = {}
    const commentaires: Record<string, string> = {}
    for (const [k, v] of Object.entries(reponses)) {
      niveaux[k] = v.niveau
      if (v.commentaire) commentaires[k] = v.commentaire
    }
    const score = diagnostic?.score_global ?? calculateAfnorScore(niveaux)
    const badge = getBadge(score)
    return {
      organisation: org?.denomination ?? null,
      siren: org?.siren ?? null,
      ville: org?.ville ?? null,
      year,
      date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
      scoreLabel: 'Score de maturité RSE',
      scoreValue: score,
      badge: { label: badge.label, emoji: badge.icon, color: badge.color },
      axes: AFNOR_AXES,
      niveaux: AFNOR_NIVEAUX,
      reponses: niveaux,
      commentaires,
      actions,
    }
  }

  async function handleExportPDF() {
    if (!diagnostic || exportingPDF) return
    setExportingPDF(true)
    try {
      const data = buildPdfData()
      // 1. Pré-charger le moteur PDF pendant que le composant se monte
      const enginePromise = import('@/lib/pdf/exportReport')
      setPdfData(data)
      // 2. Attendre que les éléments DOM du rapport soient présents
      await new Promise<void>(resolve => {
        if (document.querySelector('#afnor-rse-pdf-root [data-pdf-page]')) { resolve(); return }
        const observer = new MutationObserver(() => {
          if (document.querySelector('#afnor-rse-pdf-root [data-pdf-page]')) {
            observer.disconnect()
            resolve()
          }
        })
        observer.observe(document.body, { childList: true, subtree: true })
        setTimeout(() => { observer.disconnect(); resolve() }, 4000)
      })
      // 3. Laisser le navigateur peindre (RAF x2)
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      const { exportReport } = await enginePromise
      const orgSlug = (org?.denomination ?? 'diagnostic').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
      await exportReport('afnor-rse-pdf-root', `Label-RSE-AFNOR-${orgSlug}-${year}.pdf`)
    } catch (e) {
      console.error('[afnor-rse/exportPDF]', e)
    } finally {
      setExportingPDF(false)
      setPdfData(null)
    }
  }

  const loadShares = useCallback(async () => {
    if (!diagnostic) return
    try {
      const res = await fetch(`/api/afnor-rse/${diagnostic.id}/shares`)
      const { data } = await res.json()
      setShareList(data ?? [])
    } catch { /* ignore */ }
  }, [diagnostic])

  useEffect(() => { if (showShare) loadShares() }, [showShare, loadShares])

  async function handleAddShare() {
    if (!diagnostic || !shareEmail.trim()) return
    setShareSaving(true); setShareError('')
    try {
      const res = await fetch(`/api/afnor-rse/${diagnostic.id}/shares`, {
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
      notifyMembersChanged('afnor-rse', diagnostic.id)
    } catch {
      setShareError('Erreur de partage')
    } finally { setShareSaving(false) }
  }

  async function handleRemoveShare(shareId: string) {
    if (!diagnostic) return
    try {
      await fetch(`/api/afnor-rse/${diagnostic.id}/shares?shareId=${shareId}`, { method: 'DELETE' })
      await loadShares()
      notifyMembersChanged('afnor-rse', diagnostic.id)
    } catch { /* ignore */ }
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
        <button onClick={handleExportPDF} disabled={exportingPDF}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50">
          {exportingPDF ? '⟳' : '📄'} PDF
        </button>
        <button onClick={() => setShowShare(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium transition-colors">
          👥 Partager
        </button>
      </div>
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnostic, exportingExcel, exportingPDF])

  const lockedTabs = !org || !diagnostic ? ['dashboard', 'diagnostic', 'actions'] : []

  if (loading && !diagnostic) {
    return <div className="flex justify-center items-center py-20 text-gray-400 text-sm animate-pulse">
      {initializing ? 'Initialisation du diagnostic Label Engagé RSE…' : 'Chargement…'}
    </div>
  }

  // Score courant pour le header
  const scoreForHeader = diagnostic?.score_global ?? calculateAfnorScore(Object.fromEntries(Object.entries(reponses).map(([k, v]) => [k, v.niveau])))
  const badgeForHeader = getBadge(scoreForHeader)
  const labelEtoiles = scoreForHeader >= 90 ? '⭐⭐⭐⭐' : scoreForHeader >= 75 ? '⭐⭐⭐' : scoreForHeader >= 50 ? '⭐⭐' : scoreForHeader >= 25 ? '⭐' : '○'

  return (
    <div className="space-y-4">

      {/* ── Rapport PDF (monté hors-écran le temps de l'export) ─────────────── */}
      {pdfData && (
        <div style={{ position: 'absolute', left: -9999, top: 0 }} aria-hidden="true">
          <AfnorRsePDFReport id="afnor-rse-pdf-root" data={pdfData} />
        </div>
      )}

      {/* ── Modale Partage ──────────────────────────────────────────────────── */}
      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowShare(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-bold text-gray-900 dark:text-white">👥 Partager le diagnostic AFNOR</h2>
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

      {/* Score dans le header */}
      {diagnostic && (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 justify-end">
          <span>Score de maturité RSE :</span>
          <span className="font-bold text-gray-900 dark:text-white">{scoreForHeader}/100</span>
          <span style={{ color: badgeForHeader.color }}>{labelEtoiles} {badgeForHeader.label}</span>
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
                view === v.id ? 'border-purple-500 text-purple-600 dark:text-purple-400'
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
          score={scoreForHeader}
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

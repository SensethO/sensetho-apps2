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

// ─── Données statiques ISO 53001 (basé PAS 53002:2024) ───────────────────────────────────────────────

export const ISO53001_AXES = [
  {
    id: 'contexte', label: 'Contexte & Parties prenantes', icon: '🌍',
    color: '#0e7490', colorLight: '#cffafe', weight: 0.20,
    description: "Compréhension des 17 ODD et du contexte de l’organisation, identification des impacts (positifs et négatifs) sur la chaîne de valeur, écoute des parties prenantes et priorisation des ODD matériels.",
    criteres: [
      { id: 'ctx-enjeux',      label: 'Compréhension des ODD et du contexte',       description: "L’organisation connaît les 17 ODD et leurs 169 cibles, analyse son contexte interne et externe (enjeux, réglementation, marché) et identifie les questions de durabilité pertinentes pour ses activités." },
      { id: 'ctx-impacts',     label: 'Identification des impacts sur les ODD',     description: "Les impacts positifs et négatifs de l’organisation sur les ODD sont identifiés sur l’ensemble de la chaîne de valeur (amont, opérations, aval), conformément à la logique de PAS 53002." },
      { id: 'ctx-parties',     label: 'Parties prenantes et attentes',              description: "Les parties prenantes pertinentes (internes et externes) sont identifiées ; leurs besoins et attentes vis-à-vis de la contribution de l’organisation aux ODD sont recueillis et pris en compte." },
      { id: 'ctx-priorisation', label: 'Priorisation des ODD matériels',            description: "Une sélection argumentée des ODD et cibles prioritaires est réalisée (analyse de matérialité) ; le périmètre du système de management des ODD est défini et documenté." },
    ],
  },
  {
    id: 'leadership', label: 'Leadership & Gouvernance', icon: '🧭',
    color: '#6d28d9', colorLight: '#ede9fe', weight: 0.20,
    description: "Engagement de la direction, politique de contribution aux ODD, rôles et responsabilités, ressources allouées, culture d’entreprise et communication engageante autour du développement durable.",
    criteres: [
      { id: 'lead-engagement', label: 'Engagement de la direction',                  description: "La direction porte visiblement la démarche ODD (« tone from the top ») : elle valide les priorités, alloue les ressources, rend compte des résultats et intègre les ODD dans ses décisions." },
      { id: 'lead-politique',  label: 'Politique ODD formalisée',                    description: "Une politique de durabilité/contribution aux ODD est formalisée, cohérente avec la mission et la stratégie, communiquée en interne et disponible pour les parties prenantes." },
      { id: 'lead-roles',      label: 'Rôles, responsabilités et ressources',        description: "Les rôles et responsabilités du système de management des ODD sont attribués (référent développement durable, relais métiers) avec les moyens humains, techniques et budgétaires adaptés." },
      { id: 'lead-culture',    label: 'Culture, communication et exemplarité',       description: "La culture d’entreprise intègre les ODD : communication interne régulière, valorisation des initiatives, exemplarité du management, sensibilisation de l’ensemble des collaborateurs." },
    ],
  },
  {
    id: 'planification', label: 'Planification ODD', icon: '📐',
    color: '#b45309', colorLight: '#fef3c7', weight: 0.20,
    description: "Gestion des risques et opportunités liés aux ODD, définition d’objectifs mesurables alignés sur les cibles de l’Agenda 2030, intégration dans la stratégie et plans d’action dotés de moyens.",
    criteres: [
      { id: 'plan-risques',    label: 'Risques et opportunités',                     description: "Les risques et opportunités liés aux ODD (transition, réputation, réglementation, marchés) sont identifiés et traités par des actions proportionnées, revues périodiquement." },
      { id: 'plan-objectifs',  label: 'Objectifs ODD mesurables',                    description: "Des objectifs de contribution aux ODD sont définis : spécifiques, mesurables, alignés sur les cibles et indicateurs de l’ONU, assortis d’échéances et de responsables." },
      { id: 'plan-integration', label: 'Intégration à la stratégie',                 description: "Les objectifs ODD sont intégrés à la stratégie d’entreprise et déclinés dans les processus métiers (budget, investissements, R&D, RH, achats) — pas une démarche parallèle." },
      { id: 'plan-moyens',     label: "Plans d’action et moyens",                    description: "Des plans d’action documentés précisent les actions, moyens, responsables et échéances pour atteindre chaque objectif ODD ; leur avancement est suivi et ajusté." },
    ],
  },
  {
    id: 'operation', label: 'Opération & Support', icon: '⚙️',
    color: '#15803d', colorLight: '#dcfce7', weight: 0.20,
    description: "Maîtrise opérationnelle des contributions aux ODD, compétences et formation, chaîne de valeur et achats responsables, partenariats (ODD 17) et innovation dans les produits et services.",
    criteres: [
      { id: 'op-processus',    label: 'Maîtrise opérationnelle',                     description: "Les processus opérationnels intègrent les exigences ODD : critères de durabilité dans les opérations, maîtrise des impacts négatifs, procédures documentées où nécessaire." },
      { id: 'op-competences',  label: 'Compétences, formation et sensibilisation',   description: "Les compétences nécessaires sont identifiées et développées : formation des équipes aux ODD, sensibilisation générale, montée en compétence des fonctions clés (achats, R&D, RH)." },
      { id: 'op-chaine',       label: 'Chaîne de valeur et achats responsables',     description: "Les fournisseurs et partenaires sont embarqués dans la démarche : critères ODD dans les achats, évaluation des fournisseurs, coopération sur les impacts de la chaîne de valeur." },
      { id: 'op-innovation',   label: 'Partenariats et innovation (ODD 17)',         description: "L’organisation développe des partenariats multi-acteurs (entreprises, collectivités, ONG, recherche) et innove dans ses produits/services pour amplifier sa contribution aux ODD." },
    ],
  },
  {
    id: 'evaluation', label: 'Évaluation & Amélioration', icon: '📊',
    color: '#be123c', colorLight: '#ffe4e6', weight: 0.20,
    description: "Indicateurs de contribution aux ODD, surveillance et audit interne, revue de direction, reporting (lien CSRD/VSME) et amélioration continue du système de management.",
    criteres: [
      { id: 'eval-indicateurs', label: 'Indicateurs et mesure de la contribution',   description: "Des indicateurs pertinents mesurent la contribution réelle aux ODD prioritaires (résultats, pas seulement moyens) ; les données sont fiables, comparables et suivies dans le temps." },
      { id: 'eval-surveillance', label: 'Surveillance et audit interne',             description: "Le système de management des ODD est surveillé : contrôles réguliers, audits internes planifiés, vérification de l’atteinte des objectifs et de la conformité aux engagements." },
      { id: 'eval-revue',      label: 'Revue de direction et reporting',             description: "La direction revoit périodiquement le système (résultats, écarts, opportunités) ; la contribution aux ODD est rapportée aux parties prenantes, en cohérence avec CSRD/VSME le cas échéant." },
      { id: 'eval-amelioration', label: 'Amélioration continue',                     description: "Les écarts et non-conformités sont traités (corrections, causes racines) ; le système et la contribution aux ODD s’améliorent en continu, avec capitalisation des enseignements." },
    ],
  },
]

export const ISO53001_NIVEAUX = [
  { value: 0, shortLabel: 'NC', label: 'Inexistant',        description: "Aucune démarche ODD structurée",                                        pct: 0,    color: '#9ca3af', bg: 'bg-gray-100 dark:bg-gray-700',           text: 'text-gray-600 dark:text-gray-400'   },
  { value: 1, shortLabel: '1',  label: 'Initial',           description: "Prise de conscience, premières actions ponctuelles",                    pct: 0.25, color: '#ef4444', bg: 'bg-red-50 dark:bg-red-900/20',          text: 'text-red-700 dark:text-red-400'     },
  { value: 2, shortLabel: '2',  label: 'En développement',  description: "Démarche en cours de structuration, couverture partielle",              pct: 0.50, color: '#f97316', bg: 'bg-orange-50 dark:bg-orange-900/20',    text: 'text-orange-700 dark:text-orange-400' },
  { value: 3, shortLabel: '3',  label: 'Conforme',          description: "Exigences du système de management ODD couvertes et appliquées",        pct: 0.75, color: '#22c55e', bg: 'bg-green-50 dark:bg-green-900/20',      text: 'text-green-700 dark:text-green-400' },
  { value: 4, shortLabel: '4',  label: 'Exemplaire',        description: "Contribution démontrée et mesurée, prêt pour la certification",         pct: 1.0,  color: '#3b82f6', bg: 'bg-blue-50 dark:bg-blue-900/20',        text: 'text-blue-700 dark:text-blue-400'   },
]

const BADGE_LEVELS = [
  { label: 'Exemplaire',       min: 85, color: '#3b82f6', icon: '🏆' },
  { label: 'Conforme',         min: 60, color: '#16a34a', icon: '✅' },
  { label: 'En développement', min: 30, color: '#f97316', icon: '🔧' },
  { label: 'Insuffisant',      min: 0,  color: '#dc2626', icon: '⚠️' },
]

export function calculateIso53001Score(niveaux: Record<string, number>): number {
  let total = 0
  for (const axe of ISO53001_AXES) {
    let axeScore = 0
    const nb = axe.criteres.length
    for (const c of axe.criteres) {
      const n = niveaux[c.id] ?? 0
      axeScore += (ISO53001_NIVEAUX[n]?.pct ?? 0) / nb
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
    <div className="space-y-5">
      {/* Hero */}
      <div className={card('p-6')}>
        <div className="flex items-start gap-4">
          <span className="text-4xl">🎯</span>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">ISO/UNDP 53001 — Système de management des Objectifs de Développement Durable</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Le premier système de management dédié aux 17 ODD des Nations Unies, co-écrit par l’ISO et le PNUD — et certifiable, à la différence d’ISO 26000.</p>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-3">
              ISO 53001 fournit un cadre structuré pour intégrer, piloter et améliorer la contribution de toute organisation aux
              Objectifs de Développement Durable de l’Agenda 2030. Bâtie sur la structure harmonisée des systèmes de management
              (comme ISO 9001, 14001, 45001), elle couvre l’analyse du contexte, l’écoute des parties prenantes, la priorisation
              des ODD matériels, la définition d’objectifs mesurables et l’amélioration continue.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
              Ce diagnostic évalue votre maturité sur 5 axes × 4 critères (20 points d’évaluation), sur la base des lignes
              directrices <strong>ISO/UNDP PAS 53002:2024</strong> (publiées, gratuites) dans l’attente du texte final d’ISO 53001.
              Il vous prépare à une future certification et alimente vos reportings CSRD/VSME.
            </p>
          </div>
        </div>
      </div>

      {/* Statut de la norme */}
      <div className={card('p-5')}>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">📅 Où en est la norme ?</h3>
        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3">
            <div className="font-semibold text-green-800 dark:text-green-300">PAS 53002:2024 — publiée</div>
            <p className="text-xs text-green-700 dark:text-green-400 mt-1">Lignes directrices ISO/PNUD pour contribuer aux ODD, disponibles gratuitement. Base du présent diagnostic.</p>
          </div>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
            <div className="font-semibold text-amber-800 dark:text-amber-300">ISO 53001 — publication 2026</div>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">Norme d’exigences certifiable, en fin de développement (enquête publique passée). Ce diagnostic sera aligné sur le texte final dès sa parution.</p>
          </div>
          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3">
            <div className="font-semibold text-blue-800 dark:text-blue-300">Certifiable</div>
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">Contrairement à ISO 26000 (lignes directrices), ISO 53001 pose des exigences auditables — une preuve objective de votre management des ODD.</p>
          </div>
        </div>
      </div>

      {/* Les 5 axes */}
      <div className={card('p-5')}>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Les 5 axes du diagnostic</h3>
        <div className="grid md:grid-cols-2 gap-3">
          {ISO53001_AXES.map(axe => (
            <div key={axe.id} className="rounded-lg border p-4" style={{ borderColor: axe.color + '40', backgroundColor: axe.colorLight + '30' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{axe.icon}</span>
                <span className="font-semibold text-sm dark:brightness-[1.7]" style={{ color: axe.color }}>{axe.label}</span>
                <span className="ml-auto text-xs text-gray-400">{Math.round(axe.weight * 100)}%</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300">{axe.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Niveaux & badges */}
      <div className={card('p-5')}>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Niveaux de maturité</h3>
        <div className="grid md:grid-cols-5 gap-2">
          {ISO53001_NIVEAUX.map(n => (
            <div key={n.value} className={`rounded-lg p-3 text-center ${n.bg}`}>
              <div className={`text-lg font-bold ${n.text}`}>{n.shortLabel}</div>
              <div className={`text-xs font-medium ${n.text}`}>{n.label}</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">{n.description}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {BADGE_LEVELS.map(b => (
            <span key={b.label} className="text-xs px-2.5 py-1 rounded-full border" style={{ borderColor: b.color, color: b.color }}>
              {b.icon} {b.label} — dès {b.min}%
            </span>
          ))}
        </div>
      </div>

      {/* Points clés */}
      <div className={card('p-5')}>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">🔑 Points clés d’ISO 53001</h3>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
          <li>• <strong>Co-écrite ISO × PNUD</strong> — première norme de système de management co-brandée avec les Nations Unies.</li>
          <li>• <strong>Structure harmonisée (HLS)</strong> — s’intègre à vos systèmes existants (9001, 14001, 45001, 50001).</li>
          <li>• <strong>Matérialité ODD</strong> — l’organisation priorise les ODD sur lesquels elle a un impact réel, positif ou négatif.</li>
          <li>• <strong>Mesure de la contribution</strong> — objectifs et indicateurs alignés sur les cibles de l’Agenda 2030.</li>
          <li>• <strong>Synergie CSRD/VSME</strong> — le système structure les données et engagements utiles à vos rapports de durabilité.</li>
        </ul>
      </div>
    </div>
  )
}
function TableauDeBordView({ reponses, actions, score }: { reponses: Record<string, Reponse>; actions: Action[]; score: number }) {
  const badge = getBadge(score)

  const axeStats = ISO53001_AXES.map(axe => {
    const total = axe.criteres.length
    const niveaux = axe.criteres.map(c => reponses[c.id]?.niveau ?? 0)
    const pct = niveaux.reduce((s, n) => s + (ISO53001_NIVEAUX[n]?.pct ?? 0), 0) / total
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
          <div className="text-xs text-gray-400 mt-1">Seuils : 30% En dév. · 60% Conforme · 85% Exemplaire</div>
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
                  const niv = ISO53001_NIVEAUX[n]
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

// ─── Correspondances ──────────────────────────────────────────────────────────

interface CorrItem {
  ref: string; icon: string; route: string | null; desc: string
  correspondances: { axe: string; label: string; ref: string }[]
}

const CORR_APPS: CorrItem[] = [
  {
    ref: 'ISO 26000 & ODD', icon: '🌍', route: '/rse/odd-iso26000',
    desc: "Explorateur des liens entre les domaines d’action ISO 26000 et les 17 ODD — idéal pour préparer la priorisation des ODD matériels demandée par ISO 53001.",
    correspondances: [
      { axe: 'contexte',      label: 'Contexte',      ref: 'Identification des ODD pertinents par domaine d’action' },
      { axe: 'planification', label: 'Planification', ref: 'Sélection des cibles ODD prioritaires' },
    ],
  },
  {
    ref: 'Diagnostic RSE ISO 26000', icon: '🔎', route: '/rse/iso26000',
    desc: "La maturité RSE ISO 26000 (7 questions centrales, 37 domaines) nourrit directement l’analyse de contexte et d’impacts du système de management ODD.",
    correspondances: [
      { axe: 'contexte',   label: 'Contexte',   ref: 'Questions centrales = enjeux de durabilité de l’organisation' },
      { axe: 'leadership', label: 'Leadership', ref: 'Gouvernance de l’organisation (QC 6.2)' },
      { axe: 'operation',  label: 'Opération',  ref: 'Plans d’action par domaine ISO 26000' },
    ],
  },
  {
    ref: 'VSME EFRAG — Standard PME', icon: '📄', route: '/rse/vsme-efrag',
    desc: "Le rapport de durabilité volontaire PME (VSME) publie les données que le système ISO 53001 structure : politique, objectifs, indicateurs de contribution.",
    correspondances: [
      { axe: 'evaluation', label: 'Évaluation', ref: 'Indicateurs et reporting de durabilité (modules B/C)' },
      { axe: 'leadership', label: 'Leadership', ref: 'Politique et pratiques de durabilité' },
    ],
  },
  {
    ref: 'Évaluation AFAQ 26000', icon: '🏅', route: '/rse/afaq26000',
    desc: "L’évaluation AFAQ 26000 mesure la maturité RSE globale ; ISO 53001 y ajoute l’angle « contribution mesurée aux ODD » et la certifiabilité.",
    correspondances: [
      { axe: 'leadership', label: 'Leadership', ref: 'Vision et gouvernance responsables' },
      { axe: 'evaluation', label: 'Évaluation', ref: 'Résultats et mesure de la performance RSE' },
    ],
  },
  {
    ref: 'Bilan GES', icon: '🌡️', route: '/rse/bilan-ges',
    desc: "La mesure carbone alimente les objectifs et indicateurs de l’ODD 13 (lutte contre le changement climatique) du système ISO 53001.",
    correspondances: [
      { axe: 'planification', label: 'Planification', ref: 'Objectifs climat mesurables (ODD 13)' },
      { axe: 'evaluation',    label: 'Évaluation',    ref: 'Indicateurs d’émissions scopes 1-2-3' },
    ],
  },
  {
    ref: 'Devoir de Vigilance', icon: '🛡️', route: '/rse/vigilance',
    desc: "La cartographie des risques chaîne de valeur (droits humains, environnement) recoupe les impacts négatifs sur les ODD 8, 12 et 16 à maîtriser.",
    correspondances: [
      { axe: 'contexte',  label: 'Contexte',  ref: 'Impacts négatifs sur la chaîne de valeur' },
      { axe: 'operation', label: 'Opération', ref: 'Maîtrise des fournisseurs et partenaires' },
    ],
  },
]

const CORR_REFERENTIELS: CorrItem[] = [
  {
    ref: 'Agenda 2030 — 17 ODD (ONU)', icon: '🇺🇳', route: null,
    desc: "Le cadre de référence : 17 objectifs et 169 cibles adoptés par les Nations Unies en 2015. ISO 53001 en est l’outil de management pour les organisations.",
    correspondances: [
      { axe: 'contexte',      label: 'Contexte',      ref: 'Compréhension des 17 ODD et de leurs cibles' },
      { axe: 'planification', label: 'Planification', ref: 'Objectifs alignés sur les cibles et indicateurs ONU' },
    ],
  },
  {
    ref: 'ISO/UNDP PAS 53002:2024', icon: '📘', route: null,
    desc: "Lignes directrices publiées (et gratuites) pour contribuer aux ODD — le document précurseur d’ISO 53001, base de ce diagnostic.",
    correspondances: [
      { axe: 'contexte',   label: 'Contexte',   ref: 'Analyse d’impacts et priorisation (guidance)' },
      { axe: 'evaluation', label: 'Évaluation', ref: 'Mesure de la contribution et amélioration' },
    ],
  },
  {
    ref: 'ISO 26000 — Responsabilité sociétale', icon: '📗', route: null,
    desc: "Les lignes directrices RSE : 7 questions centrales qui structurent les enjeux. ISO 53001 est complémentaire — exigences certifiables centrées ODD.",
    correspondances: [
      { axe: 'contexte',   label: 'Contexte',   ref: 'Questions centrales et parties prenantes' },
      { axe: 'leadership', label: 'Leadership', ref: 'Gouvernance de l’organisation' },
    ],
  },
  {
    ref: 'CSRD / ESRS', icon: '🇪🇺', route: null,
    desc: "La directive européenne de reporting de durabilité : la double matérialité et les datapoints ESRS s’appuient naturellement sur un système ISO 53001 opérationnel.",
    correspondances: [
      { axe: 'contexte',   label: 'Contexte',   ref: 'Double matérialité ↔ priorisation des ODD' },
      { axe: 'evaluation', label: 'Évaluation', ref: 'Indicateurs et publication (ESRS 2, E, S, G)' },
    ],
  },
  {
    ref: 'GRI Standards', icon: '📋', route: null,
    desc: "Le référentiel de reporting le plus utilisé au monde ; le « SDG Mapping » GRI relie chaque indicateur aux cibles ODD, utile pour l’axe Évaluation.",
    correspondances: [
      { axe: 'evaluation', label: 'Évaluation', ref: 'GRI ↔ cibles ODD (linkage document GRI/UNGC)' },
    ],
  },
  {
    ref: 'SDG Compass (GRI · UNGC · WBCSD)', icon: '🧭', route: null,
    desc: "Guide méthodologique en 5 étapes pour aligner la stratégie d’entreprise sur les ODD — la logique reprise et formalisée par ISO 53001.",
    correspondances: [
      { axe: 'planification', label: 'Planification', ref: 'Définition des priorités et objectifs' },
      { axe: 'operation',     label: 'Opération',     ref: 'Intégration et communication' },
    ],
  },
]

function CorrespondancesView() {
  const axeById = (id: string) => ISO53001_AXES.find(a => a.id === id)
  const renderItem = (item: CorrItem) => (
    <div key={item.ref} className={card('p-4')}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{item.icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-gray-900 dark:text-white">{item.ref}</span>
            {item.route && (
              <a href={item.route} className="text-xs text-teal-600 dark:text-teal-400 hover:underline">Ouvrir ↗</a>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.desc}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {item.correspondances.map((c, i) => {
              const axe = axeById(c.axe)
              return (
                <span key={i} className="text-[11px] px-2 py-0.5 rounded-full" title={c.ref}
                  style={{ backgroundColor: (axe?.colorLight ?? '#eee') + '80', color: axe?.color ?? '#555' }}>
                  {axe?.icon} {c.label} — {c.ref}
                </span>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      <div className={card('p-5')}>
        <h3 className="font-semibold text-gray-900 dark:text-white">🔗 Correspondances</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Liens entre ce diagnostic ISO 53001 et les autres applications Sens&apos;ethO, ainsi que les référentiels externes.</p>
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Applications RSE Sens&apos;ethO</h4>
        <div className="space-y-3">{CORR_APPS.map(renderItem)}</div>
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Référentiels externes</h4>
        <div className="space-y-3">{CORR_REFERENTIELS.map(renderItem)}</div>
      </div>
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

  const members = useDiagnosticMembers('iso53001', diagnosticId)

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
    const res = await fetch(`/api/iso53001/${diagnosticId}/actions`, {
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
    await fetch(`/api/iso53001/${diagnosticId}/actions?action_id=${id}`, { method: 'DELETE' })
    onActionsChange(actions.filter(a => a.id !== id))
  }

  async function saveEdit(id: string) {
    setSavingEdit(true)
    const res = await fetch(`/api/iso53001/${diagnosticId}/actions?action_id=${id}`, {
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
    const res = await fetch(`/api/iso53001/${diagnosticId}/actions?action_id=${action.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: next }),
    })
    if (res.ok) {
      const { data } = await res.json()
      onActionsChange(actions.map(a => a.id === action.id ? data : a))
    }
  }

  const niv = ISO53001_NIVEAUX[niveau]

  return (
    <div className="space-y-5">
      <div className="rounded-xl p-4 border border-gray-200 dark:border-gray-700" style={{ background: axe.colorLight + '80' }}>
        <h3 className="font-bold text-base dark:brightness-[1.7]" style={{ color: axe.color }}>{critere.label}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{critere.description}</p>
      </div>

      <div className={card('p-4 space-y-3')}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">Niveau de maturité</div>
          {savingReponse && <span className="text-xs text-gray-400 animate-pulse">Enregistrement…</span>}
          {savedOk && !savingReponse && <span className="text-xs text-green-600 dark:text-green-400">✓ Sauvegardé</span>}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {ISO53001_NIVEAUX.map(n => (
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
          apiBase="/api/iso53001"
          noteTable="iso53001_notes"
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
                        apiBase="/api/iso53001"
                        noteTable="iso53001_notes"
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
        title="Supprimer l’action"
        message="L’action sera définitivement supprimée."
        onConfirm={() => { if (actionToDelete) deleteAction(actionToDelete); setActionToDelete(null) }}
        onCancel={() => setActionToDelete(null)}
      />
    </div>
  )
}

function DiagnosticView({ diagnostic, reponses, actions, allNotes, allNoteSections, onReponseChange, onActionsChange, onNoteChange, onNoteSectionsChange }: {
  diagnostic: DiagnosticData; reponses: Record<string, Reponse>; actions: Action[]
  allNotes: Record<string, string>; allNoteSections: Record<string, NoteSection[]>
  onReponseChange: (critere_id: string, niveau: number, commentaire: string) => void
  onActionsChange: (a: Action[]) => void
  onNoteChange: (key: string, v: string) => void
  onNoteSectionsChange: (key: string, s: NoteSection[]) => void
}) {
  const [activeAxe, setActiveAxe] = useState(ISO53001_AXES[0].id)
  const [activeCritere, setActiveCritere] = useState<string | null>(ISO53001_AXES[0].criteres[0].id)

  const niveaux: Record<string, number> = {}
  for (const [k, v] of Object.entries(reponses)) niveaux[k] = v.niveau
  const scoreGlobal = calculateIso53001Score(niveaux)
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
            {ISO53001_AXES.map(axe => {
              const axeNiveaux = axe.criteres.map(c => niveaux[c.id] ?? 0)
              const axePct = Math.round(axeNiveaux.reduce((s, n) => s + ISO53001_NIVEAUX[n].pct, 0) / axe.criteres.length * 100)
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
            {ISO53001_AXES.map(axe => {
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
                        const niv = ISO53001_NIVEAUX[n]
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
            const axe = ISO53001_AXES.find(a => a.criteres.some(c => c.id === activeCritere))!
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

// ─── Vue Plan d’actions ───────────────────────────────────────────────────────

function ActionsView({ diagnostic, actions, onActionsChange }: { diagnostic: DiagnosticData; actions: Action[]; onActionsChange: (a: Action[]) => void }) {
  const [filterAxe, setFilterAxe] = useState<string>('all')
  const [filterPriorite, setFilterPriorite] = useState<string>('all')
  const [filterStatut, setFilterStatut] = useState<string>('all')
  const [editId, setEditId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<Action>>({})
  const [saving, setSaving] = useState(false)

  const members = useDiagnosticMembers('iso53001', diagnostic.id)

  const filtered = actions.filter(a => {
    const axe = ISO53001_AXES.find(x => x.criteres.some(c => c.id === a.critere_id))
    if (filterAxe !== 'all' && axe?.id !== filterAxe) return false
    if (filterPriorite !== 'all' && a.priorite !== filterPriorite) return false
    if (filterStatut !== 'all' && a.statut !== filterStatut) return false
    return true
  })

  const termines = actions.filter(a => a.statut === 'termine').length

  async function saveEdit(id: string) {
    setSaving(true)
    const res = await fetch(`/api/iso53001/${diagnostic.id}/actions?action_id=${id}`, {
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
    const res = await fetch(`/api/iso53001/${diagnostic.id}/actions?action_id=${action.id}`, {
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
    await fetch(`/api/iso53001/${diagnostic.id}/actions?action_id=${id}`, { method: 'DELETE' })
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
          {ISO53001_AXES.map(a => <option key={a.id} value={a.id}>{a.icon} {a.label}</option>)}
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
            const axe = ISO53001_AXES.find(x => x.criteres.some(c => c.id === a.critere_id))
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
        title="Supprimer l’action"
        message="L’action sera définitivement supprimée."
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
  { id: 'diagnostic',    label: 'Diagnostic ODD', icon: '🎯' },
  { id: 'actions',       label: "Plan d’actions",  icon: '🎯' },
  { id: 'correspondances', label: 'Correspondances', icon: '🔗' },
]

export default function Iso53001DiagnosticApp({ ctx }: { ctx: RseContext }) {
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
        const getRes = await fetch(`/api/iso53001?org_id=${org.id}&annee=${year}`)
        const { data: existing } = await getRes.json()

        let diagId: string
        if (existing) {
          diagId = existing.id
          setDiagnostic(existing)
        } else {
          const postRes = await fetch('/api/iso53001', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ org_id: org.id, annee: year }),
          })
          const { data: created } = await postRes.json()
          setDiagnostic(created)
          diagId = created.id
        }

        // Charger reponses, actions et notes en parallèle
        const [diagFull, notesRes] = await Promise.all([
          fetch(`/api/iso53001/${diagId}`).then(r => r.json()),
          fetch(`/api/iso53001/${diagId}/notes`).then(r => r.json()),
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
    const score = calculateIso53001Score(niveaux)
    if (score !== diagnostic.score_global) {
      fetch(`/api/iso53001/${diagnostic.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score_global: score }),
      }).catch(() => {})
    }
  }, [reponses, diagnostic])

  const handleExportExcel = useCallback(async () => {
    if (!diagnostic) return
    const res = await fetch(`/api/iso53001/${diagnostic.id}/export-excel`)
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `Iso53001_${org?.denomination ?? 'diagnostic'}_${year}.xlsx`
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
    const res = await fetch(`/api/iso53001/${diagnostic.id}/reponses`, {
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
      const res = await fetch(`/api/iso53001/${diagnostic.id}/shares`)
      const { data } = await res.json()
      setShareList(data ?? [])
    } catch { /* ignore */ }
  }, [diagnostic])

  useEffect(() => { if (showShare) loadShares() }, [showShare, loadShares])

  async function handleAddShare() {
    if (!diagnostic || !shareEmail.trim()) return
    setShareSaving(true); setShareError('')
    try {
      const res = await fetch(`/api/iso53001/${diagnostic.id}/shares`, {
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
      notifyMembersChanged('iso53001', diagnostic.id)
    } catch {
      setShareError('Erreur de partage')
    } finally { setShareSaving(false) }
  }

  async function handleRemoveShare(shareId: string) {
    if (!diagnostic) return
    try {
      await fetch(`/api/iso53001/${diagnostic.id}/shares?shareId=${shareId}`, { method: 'DELETE' })
      await loadShares()
      notifyMembersChanged('iso53001', diagnostic.id)
    } catch { /* ignore */ }
  }

  const niveaux: Record<string, number> = {}
  for (const [k, v] of Object.entries(reponses)) niveaux[k] = v.niveau
  const score = calculateIso53001Score(niveaux)

  if (!org) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center">
          <div className="text-4xl mb-4">🎯</div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">ISO 53001 — Management des ODD</h2>
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
              <h2 className="font-bold text-gray-900 dark:text-white">👥 Partager le diagnostic ISO 53001</h2>
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
                        <button onClick={() => handleRemoveShare(s.id)} title="Retirer l’accès"
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

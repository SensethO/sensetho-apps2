'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import type { RseContext } from '@/components/rse/RseAppShell'
import ConfirmModal from '@/components/ui/ConfirmModal'
import ShareAutocomplete from '@/components/apps/ShareAutocomplete'
import type { NoteSection } from '@/components/apps/GuidedActionNotePanel'
import type { EcoVadisPdfData } from '@/components/apps/EcoVadisPDFReport'
import ResponsableSelect, { useDiagnosticMembers } from '@/components/rse/ResponsableSelect'

// GuidedActionNotePanel chargé en lazy — même pattern que les autres apps RSE
const GuidedActionNotePanel = dynamic(() => import('@/components/apps/GuidedActionNotePanel'), {
  ssr: false,
  loading: () => <div className="py-3 text-xs text-gray-400 animate-pulse">Chargement éditeur…</div>
})

// Rapport PDF chargé en lazy (html2canvas + jspdf hors du bundle principal)
const EcoVadisPDFReport = dynamic(() => import('@/components/apps/EcoVadisPDFReport'), {
  ssr: false,
  loading: () => null,
})

// ─── Données statiques EcoVadis ───────────────────────────────────────────────

export const ECOVADIS_THEMES = [
  {
    id: 'env',
    label: 'Environnement',
    icon: '🌿',
    poids: 0.40,
    colorCls: 'emerald',
    criteres: [
      { id: 'env-politique',  label: 'Politique environnementale',         description: 'Existence d\'une politique formalisée, engagement de la direction, objectifs chiffrés.' },
      { id: 'env-energie',    label: 'Énergie & GES',                      description: 'Mesure des consommations énergétiques et émissions de GES (scope 1, 2, 3), réduction.' },
      { id: 'env-eau',        label: 'Gestion de l\'eau',                  description: 'Mesure et réduction des consommations d\'eau, gestion des eaux usées.' },
      { id: 'env-dechets',    label: 'Déchets & Matières',                 description: 'Gestion des déchets, économie circulaire, réduction à la source.' },
      { id: 'env-pollution',  label: 'Pollution & Contamination',          description: 'Prévention des pollutions (air, sol, eau), gestion des substances dangereuses.' },
      { id: 'env-reporting',  label: 'Reporting Environnemental',          description: 'Publication de données environnementales vérifiées, certification (ISO 14001, etc.).' },
    ],
  },
  {
    id: 'social',
    label: 'Social & Droits Humains',
    icon: '👥',
    poids: 0.40,
    colorCls: 'blue',
    criteres: [
      { id: 'soc-politique',  label: 'Politique RH & Engagement',         description: 'Politique formalisée, charte éthique, conventions collectives.' },
      { id: 'soc-sante',      label: 'Santé & Sécurité',                  description: 'Système de management SST, taux accidents, actions de prévention.' },
      { id: 'soc-conditions', label: 'Conditions de travail',              description: 'Temps de travail, rémunération, qualité de vie au travail.' },
      { id: 'soc-formation',  label: 'Formation & Développement',         description: 'Heures de formation, plans de développement, égalité des chances.' },
      { id: 'soc-droits',     label: 'Droits Humains Fondamentaux',       description: 'Respect des droits fondamentaux, lutte contre le travail forcé et enfants.' },
      { id: 'soc-reporting',  label: 'Reporting Social',                   description: 'Publication d\'indicateurs sociaux vérifiés, certification (SA8000, etc.).' },
    ],
  },
  {
    id: 'ethique',
    label: 'Éthique des Affaires',
    icon: '⚖️',
    poids: 0.10,
    colorCls: 'purple',
    criteres: [
      { id: 'eth-corruption',   label: 'Anti-corruption & Pots-de-vin',   description: 'Programme anti-corruption, code de conduite, formation des employés.' },
      { id: 'eth-concurrence',  label: 'Pratiques anticoncurrentielles',  description: 'Politique de respect du droit de la concurrence, formation.' },
      { id: 'eth-ip',           label: 'Propriété Intellectuelle',        description: 'Protection des droits de PI, procédures internes.' },
      { id: 'eth-donnees',      label: 'Protection des Données',          description: 'Conformité RGPD, politique de confidentialité, sécurité des données.' },
      { id: 'eth-reporting',    label: 'Reporting Éthique',               description: 'Mécanismes d\'alerte (whistleblowing), publication du code éthique.' },
    ],
  },
  {
    id: 'achats',
    label: 'Achats Responsables',
    icon: '🤝',
    poids: 0.10,
    colorCls: 'amber',
    criteres: [
      { id: 'ach-politique',  label: 'Politique Achats Responsables',     description: 'Politique formalisée intégrant critères RSE fournisseurs, code de conduite.' },
      { id: 'ach-actions',    label: 'Actions & Évaluation Fournisseurs', description: 'Évaluation RSE des fournisseurs, audits, plans de progrès.' },
      { id: 'ach-reporting',  label: 'Reporting Achats',                  description: 'Publication d\'indicateurs achats responsables, % fournisseurs évalués.' },
    ],
  },
]

export interface EcoVadisNiveau {
  value: number; label: string; shortLabel: string; description: string
  color: string; bg: string; text: string; pct: number
}

export const NIVEAUX: EcoVadisNiveau[] = [
  { value: 0, label: 'NC',         shortLabel: 'NC',  description: 'Non communiqué ou absent',              color: '#9ca3af', bg: 'bg-gray-100 dark:bg-gray-800',   text: 'text-gray-600 dark:text-gray-400', pct: 0    },
  { value: 1, label: 'Basique',    shortLabel: '1',   description: 'Éléments de base en place',             color: '#ef4444', bg: 'bg-red-50 dark:bg-red-900/20',   text: 'text-red-600 dark:text-red-400',   pct: 0.25 },
  { value: 2, label: 'Avancé',     shortLabel: '2',   description: 'Système formalisé et déployé',          color: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', pct: 0.50 },
  { value: 3, label: 'Pro-actif',  shortLabel: '3',   description: 'Démarche proactive, mesurée & améliorée', color: '#3b82f6', bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', pct: 0.75 },
  { value: 4, label: 'Leader',     shortLabel: '4',   description: 'Excellence, certifié ou primé',         color: '#16a34a', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400', pct: 1.00 },
]

const BADGE_LEVELS = [
  { label: 'Platinum', min: 75, color: '#6366f1', icon: '💎' },
  { label: 'Gold',     min: 65, color: '#f59e0b', icon: '🥇' },
  { label: 'Silver',   min: 45, color: '#9ca3af', icon: '🥈' },
  { label: 'Bronze',   min: 25, color: '#cd7f32', icon: '🥉' },
  { label: 'Non noté', min: 0,  color: '#e5e7eb', icon: '—'  },
]

export function calculateScore(niveaux: Record<string, number>): number {
  let total = 0
  for (const theme of ECOVADIS_THEMES) {
    let themeScore = 0
    const nbCriteres = theme.criteres.length
    for (const c of theme.criteres) {
      const n = niveaux[c.id] ?? 0
      const pct = NIVEAUX[n]?.pct ?? 0
      themeScore += pct / nbCriteres
    }
    total += themeScore * theme.poids
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

const THEME_COLORS: Record<string, { ring: string; text: string; bg: string; bar: string }> = {
  env:     { ring: 'ring-emerald-400', text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', bar: 'bg-emerald-500' },
  social:  { ring: 'ring-blue-400',    text: 'text-blue-700 dark:text-blue-400',       bg: 'bg-blue-50 dark:bg-blue-900/20',       bar: 'bg-blue-500'    },
  ethique: { ring: 'ring-purple-400',  text: 'text-purple-700 dark:text-purple-400',   bg: 'bg-purple-50 dark:bg-purple-900/20',   bar: 'bg-purple-500'  },
  achats:  { ring: 'ring-amber-400',   text: 'text-amber-700 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-900/20',     bar: 'bg-amber-500'   },
}

function card(extra = '') { return `bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl ${extra}` }
function inputCls() { return 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500' }
function labelCls() { return 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1' }
function btnP(extra = '') { return `px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-50 ${extra}` }
function btnS(extra = '') { return `px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm transition-colors ${extra}` }

const PRIORITE_COLORS = {
  haute:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  moyenne: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  basse:   'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}
const STATUT_COLORS = {
  a_faire:   'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  en_cours:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  termine:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
}
const STATUT_LABELS = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' }
const PRIORITE_LABELS = { haute: '🔴 Haute', moyenne: '🟡 Moyenne', basse: '🟢 Basse' }

function critereLabel(id: string): string {
  for (const t of ECOVADIS_THEMES) {
    const c = t.criteres.find(x => x.id === id)
    if (c) return `${t.icon} ${c.label}`
  }
  return id
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

  // Calcul du % par thème
  const themeStats = ECOVADIS_THEMES.map(t => {
    const total = t.criteres.length
    const niveaux = t.criteres.map(c => reponses[c.id]?.niveau ?? 0)
    const pct = niveaux.reduce((s, n) => s + (NIVEAUX[n]?.pct ?? 0), 0) / total
    const renseignes = niveaux.filter(n => n > 0).length
    return { ...t, pct, renseignes, total }
  })

  // Radar SVG custom — même pattern que VSME EFRAG
  const N = themeStats.length
  const cx = 160, cy = 155, r = 110

  function polarToXY(i: number, radius: number) {
    const angle = (i / N) * 2 * Math.PI - Math.PI / 2
    return { x: +(cx + radius * Math.cos(angle)).toFixed(1), y: +(cy + radius * Math.sin(angle)).toFixed(1) }
  }

  const levels = [0.25, 0.5, 0.75, 1.0]
  const dataPolygon = themeStats.map((t, i) => {
    const { x, y } = polarToXY(i, r * Math.max(t.pct, 0.03))
    return `${x},${y}`
  }).join(' ')

  const RADAR_COLORS: Record<string, string> = {
    env: '#16a34a', social: '#2563eb', ethique: '#9333ea', achats: '#ea580c',
  }

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
          <div className="text-xs text-gray-400 mt-1">Seuils : 25 Bronze · 45 Silver · 65 Gold · 75 Platinum</div>
        </div>

        {/* Radar */}
        <div className={card('p-4 sm:col-span-2')}>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Radar de maturité par thème</h3>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <svg viewBox="0 0 320 310" className="w-full sm:w-64 flex-shrink-0" style={{ maxHeight: 240 }}>
              {/* Toile */}
              {levels.map(level => {
                const pts = themeStats.map((_, i) => { const { x, y } = polarToXY(i, r * level); return `${x},${y}` }).join(' ')
                return <polygon key={level} points={pts} fill="none" stroke="var(--border, #374151)" strokeWidth={level === 1 ? '1.5' : '0.7'} />
              })}
              {/* Axes */}
              {themeStats.map((_, i) => { const { x, y } = polarToXY(i, r); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--border, #374151)" strokeWidth="1" strokeDasharray="3,3" /> })}
              {/* Zone données */}
              <polygon points={dataPolygon} fill="#16a34a22" stroke="#16a34a" strokeWidth="2.5" strokeLinejoin="round" />
              {/* Points */}
              {themeStats.map((t, i) => { const { x, y } = polarToXY(i, r * Math.max(t.pct, 0.03)); return <circle key={i} cx={x} cy={y} r="5" fill={RADAR_COLORS[t.id] ?? '#16a34a'} stroke="white" strokeWidth="1.5" /> })}
              {/* Labels % */}
              {levels.map(level => { const { x, y } = polarToXY(0, r * level); return <text key={level} x={x} y={y - 5} textAnchor="middle" fontSize="8" fill="var(--text-muted, #6b7280)" fontWeight="500">{Math.round(level * 100)}%</text> })}
              {/* Labels thèmes */}
              {themeStats.map((t, i) => {
                const { x, y } = polarToXY(i, r + 26)
                const anchor = x < cx - 8 ? 'end' : x > cx + 8 ? 'start' : 'middle'
                return (
                  <text key={i} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontSize="12" fill={RADAR_COLORS[t.id] ?? '#6b7280'} fontWeight="700">
                    {t.icon}
                  </text>
                )
              })}
            </svg>

            {/* Légende */}
            <div className="space-y-2 flex-1 w-full">
              {themeStats.map(t => (
                <div key={t.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{t.icon}</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">{t.label}</span>
                      <span className="text-gray-400">({Math.round(t.poids * 100)}%)</span>
                    </div>
                    <span className="font-bold" style={{ color: RADAR_COLORS[t.id] }}>{Math.round(t.pct * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${Math.round(t.pct * 100)}%`, background: RADAR_COLORS[t.id] }} />
                  </div>
                  <div className="text-[10px] text-gray-400">{t.renseignes}/{t.total} critères évalués</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Détail par thème */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Détail par thème et critère</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {themeStats.map(t => (
            <div key={t.id} className={card('p-4 space-y-2')}>
              <div className="flex items-center gap-2">
                <span className="text-xl">{t.icon}</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{t.label}</div>
                  <div className="text-xs text-gray-400">Poids {Math.round(t.poids * 100)}% · Score thème : <span className="font-bold" style={{ color: RADAR_COLORS[t.id] }}>{Math.round(t.pct * 100)}%</span></div>
                </div>
              </div>
              <div className="space-y-1.5 ml-1">
                {t.criteres.map(c => {
                  const n = reponses[c.id]?.niveau ?? 0
                  const niv = NIVEAUX[n]
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
            { label: 'À faire',  count: actions.filter(a => a.statut === 'a_faire').length,  color: 'text-gray-600 dark:text-gray-400' },
            { label: 'En cours', count: actions.filter(a => a.statut === 'en_cours').length, color: 'text-blue-600 dark:text-blue-400' },
            { label: 'Terminées', count: actions.filter(a => a.statut === 'termine').length, color: 'text-emerald-600 dark:text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>
        {actions.length > 0 && (
          <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.round(actions.filter(a => a.statut === 'termine').length / actions.length * 100)}%` }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Vue Correspondances ──────────────────────────────────────────────────────

const CORRESPONDANCES = [
  {
    categorie: 'Applications RSE Sens\'ethO',
    icon: '🏠',
    color: 'indigo',
    items: [
      {
        ref: 'ISO 26000',      icon: '⚖️',  route: '/rse/iso26000',
        desc: 'Domaines RSE transverses — correspond aux 4 thèmes EcoVadis',
        liens: [
          { theme: 'env',     label: 'Environnement', iso: 'Domaine 6 — Environnement' },
          { theme: 'social',  label: 'Social & RH',   iso: 'Domaine 3 — Droits de l\'homme · Domaine 4 — Relations et conditions de travail' },
          { theme: 'ethique', label: 'Éthique',       iso: 'Domaine 2 — Gouvernance de l\'organisation · Domaine 7 — Loyauté des pratiques' },
          { theme: 'achats',  label: 'Achats',        iso: 'Domaine 5 — Bonnes pratiques des affaires' },
        ],
      },
      {
        ref: 'VSME EFRAG',     icon: '📊',  route: '/rse/vsme-efrag',
        desc: 'Standard PME européen — couvre les mêmes thématiques avec une approche ESRS',
        liens: [
          { theme: 'env',     label: 'Environnement', iso: 'Module ENV — Énergie, Eau, Déchets, Émissions GES' },
          { theme: 'social',  label: 'Social & RH',   iso: 'Module SOC — Travailleurs, Droits humains, Communauté' },
          { theme: 'ethique', label: 'Éthique',       iso: 'Module GOV — Gouvernance, Éthique, Corruption' },
        ],
      },
      {
        ref: 'Green Claims',   icon: '🌿',  route: '/rse/green-claims',
        desc: 'Directive européenne sur les allégations environnementales — impacte le reporting EcoVadis',
        liens: [
          { theme: 'env', label: 'Environnement', iso: 'Allégations environnementales vérifiables & reporting' },
        ],
      },
      {
        ref: 'Parties Prenantes', icon: '👥', route: '/rse/parties-prenantes',
        desc: 'Cartographie des parties prenantes — sous-traitants & fournisseurs → Achats Responsables',
        liens: [
          { theme: 'achats', label: 'Achats Responsables', iso: 'Identification des parties prenantes prioritaires' },
          { theme: 'social',  label: 'Social & RH',  iso: 'Dialogue social et engagement parties prenantes' },
        ],
      },
    ],
  },
  {
    categorie: 'Certifications & Labels',
    icon: '🏅',
    color: 'amber',
    items: [
      { ref: 'ISO 14001',   icon: '🌍', route: null, desc: 'Système de management environnemental — certification validée par EcoVadis', liens: [{ theme: 'env', label: 'Environnement', iso: 'Système de management (politique, objectifs, reporting)' }] },
      { ref: 'ISO 45001',   icon: '🦺', route: null, desc: 'Santé & Sécurité au travail — certification valorisée dans le thème Social', liens: [{ theme: 'social', label: 'Social & RH', iso: 'Santé & Sécurité au travail (management SST)' }] },
      { ref: 'SA8000',      icon: '👷', route: null, desc: 'Standard de responsabilité sociale des entreprises (audit fournisseurs)', liens: [{ theme: 'social', label: 'Social & RH', iso: 'Conditions de travail, droits humains, droit d\'association' }] },
      { ref: 'ISO 37001',   icon: '⚖️', route: null, desc: 'Système de management anti-corruption — fortement valorisé en Éthique', liens: [{ theme: 'ethique', label: 'Éthique', iso: 'Anti-corruption, pots-de-vin, programme de conformité' }] },
      { ref: 'B Corp',      icon: '⭕', route: null, desc: 'Certification entreprise à mission — exigences similaires aux 4 thèmes EcoVadis', liens: [{ theme: 'env', label: 'Env', iso: 'Impact environnemental' }, { theme: 'social', label: 'Social', iso: 'Impact travailleurs & communauté' }, { theme: 'ethique', label: 'Éthique', iso: 'Gouvernance transparente' }] },
      { ref: 'RGPD / GDPR', icon: '🔐', route: null, desc: 'Protection des données personnelles — critère clé de l\'Éthique EcoVadis', liens: [{ theme: 'ethique', label: 'Éthique', iso: 'Protection des données, vie privée, cybersécurité' }] },
    ],
  },
  {
    categorie: 'Référentiels de Reporting',
    icon: '📋',
    color: 'blue',
    items: [
      { ref: 'GRI Standards', icon: '📈', route: null, desc: 'Global Reporting Initiative — référence mondiale du reporting RSE, utilisé par EcoVadis pour le reporting', liens: [{ theme: 'env', label: 'Env', iso: 'GRI 300 Environnement' }, { theme: 'social', label: 'Social', iso: 'GRI 400 Social' }, { theme: 'ethique', label: 'Éthique', iso: 'GRI 200 Économie' }] },
      { ref: 'CDP',           icon: '🌡️', route: null, desc: 'Carbon Disclosure Project — divulgation carbone valorisée dans le reporting environnemental', liens: [{ theme: 'env', label: 'Environnement', iso: 'Émissions GES, Eau, Biodiversité, Chaîne d\'approvisionnement' }] },
      { ref: 'CSRD / ESRS',   icon: '🇪🇺', route: null, desc: 'Directive européenne sur le reporting de durabilité — alignée avec les thèmes EcoVadis', liens: [{ theme: 'env', label: 'Env', iso: 'ESRS E1-E5 (Climat, Eau, Biodiversité...)' }, { theme: 'social', label: 'Social', iso: 'ESRS S1-S4 (Travailleurs, Chaîne, Communauté)' }, { theme: 'ethique', label: 'Gouvernance', iso: 'ESRS G1 (Gouvernance, Éthique, Corruption)' }] },
      { ref: 'ODD / SDGs',    icon: '🎯', route: null, desc: 'Objectifs de Développement Durable ONU — EcoVadis aligne ses critères sur les ODD', liens: [{ theme: 'env', label: 'Env', iso: 'ODD 6, 7, 12, 13, 14, 15' }, { theme: 'social', label: 'Social', iso: 'ODD 3, 4, 5, 8, 10, 11' }, { theme: 'ethique', label: 'Éthique', iso: 'ODD 16, 17' }, { theme: 'achats', label: 'Achats', iso: 'ODD 12, 17' }] },
    ],
  },
]

const THEME_BADGE_CLS: Record<string, string> = {
  env:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  social:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  ethique: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  achats:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

function CorrespondancesView() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className={card('p-4')}>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          EcoVadis s&apos;inscrit dans un écosystème de standards RSE interconnectés. Les correspondances ci-dessous vous
          permettent de mutualiser vos efforts de conformité entre plusieurs référentiels et de renforcer votre score en
          capitalisant sur vos certifications existantes.
        </p>
      </div>

      {CORRESPONDANCES.map(cat => (
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
                          const theme = ECOVADIS_THEMES.find(t => t.id === l.theme)
                          return (
                            <div key={i} className="flex items-start gap-2 flex-wrap">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${THEME_BADGE_CLS[l.theme] ?? ''}`}>
                                {theme?.icon} {l.label}
                              </span>
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 flex-1">{l.iso}</span>
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

// ─── Vue Présentation ─────────────────────────────────────────────────────────

function PresentationView() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Hero */}
      <div className={card('p-6 space-y-3')}>
        <div className="flex items-center gap-3">
          <span className="text-4xl">🏆</span>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">EcoVadis — Diagnostic RSE</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Référence mondiale d&apos;évaluation des pratiques RSE des entreprises</p>
          </div>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          EcoVadis évalue chaque année des milliers d&apos;entreprises sur leurs pratiques de responsabilité sociale et environnementale.
          Un questionnaire détaillé couvre <strong>4 thèmes</strong>, vous obtenez un score de 0 à 100 et un badge (Bronze, Silver, Gold, Platinum).
          Cette application vous aide à préparer votre évaluation, identifier vos points faibles, construire un plan d&apos;actions et centraliser vos preuves documentaires.
        </p>
      </div>

      {/* Thèmes et poids */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Les 4 thèmes d&apos;évaluation</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ECOVADIS_THEMES.map(t => {
            const clr = THEME_COLORS[t.id]
            return (
              <div key={t.id} className={card('p-4')}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{t.icon}</span>
                  <div>
                    <div className={`font-semibold text-sm ${clr.text}`}>{t.label}</div>
                    <div className="text-xs text-gray-400">Poids : {Math.round(t.poids * 100)}%</div>
                  </div>
                  <div className={`ml-auto text-lg font-bold ${clr.text}`}>{Math.round(t.poids * 100)}%</div>
                </div>
                <div className="space-y-1">
                  {t.criteres.map(c => (
                    <div key={c.id} className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                      <span className="mt-0.5 text-gray-400">•</span>
                      <span>{c.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Niveaux de maturité */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Niveaux de maturité</h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {NIVEAUX.map(n => (
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
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Badges EcoVadis</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {BADGE_LEVELS.filter(b => b.label !== 'Non noté').map(b => (
            <div key={b.label} className={card('p-4 text-center')}>
              <div className="text-3xl">{b.icon}</div>
              <div className="font-bold text-sm mt-1" style={{ color: b.color }}>{b.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">≥ {b.min} / 100</div>
            </div>
          ))}
        </div>
      </div>

      {/* Comment utiliser */}
      <div className={card('p-5 space-y-3')}>
        <h3 className="font-semibold text-gray-900 dark:text-white">💡 Comment utiliser cette application</h3>
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          {[
            ['1', 'Diagnostic', 'Pour chaque critère, évaluez votre niveau de maturité (0 à 4), ajoutez un commentaire explicatif et créez des actions d\'amélioration.'],
            ['2', 'Plan d\'actions', 'Visualisez et gérez toutes vos actions d\'amélioration : priorité, responsable, échéance, statut d\'avancement.'],
            ['3', 'Documents & Preuves', 'Uploadez directement dans SharePoint vos preuves documentaires (politiques, rapports, certificats) classées par critère.'],
          ].map(([num, title, desc]) => (
            <div key={num} className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center text-xs font-bold">{num}</div>
              <div><span className="font-medium">{title}</span> — {desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Types thème/critère simples pour éviter les complexités TypeScript ──────

interface EcoTheme { id: string; label: string; icon: string; poids: number; colorCls: string; criteres: EcoCritere[] }
interface EcoCritere { id: string; label: string; description: string }

// ─── Panneau critère (Diagnostic) ─────────────────────────────────────────────

interface CriterePanelProps {
  theme: EcoTheme
  critere: EcoCritere
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
  theme, critere, reponse, actions,
  diagnosticId, allNotes, allNoteSections,
  onReponseChange, onActionsChange, onNoteChange, onNoteSectionsChange,
}: CriterePanelProps) {
  const [niveau, setNiveau] = useState(reponse?.niveau ?? 0)
  const [commentaire, setCommentaire] = useState(reponse?.commentaire ?? '')
  const [savingReponse, setSavingReponse] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Formulaire nouvelle action
  const [showActionForm, setShowActionForm] = useState(false)
  const [actionForm, setActionForm] = useState({ titre: '', description: '', priorite: 'moyenne', echeance: '', responsable: '' })
  const [savingAction, setSavingAction] = useState(false)

  // Edition inline d'une action existante
  const [editingActionId, setEditingActionId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<Action>>({})
  const [savingEdit, setSavingEdit] = useState(false)

  // Notes & docs ouvertes par action
  const [expandedActionNoteId, setExpandedActionNoteId] = useState<string | null>(null)

  const members = useDiagnosticMembers('ecovadis', diagnosticId)

  const clr = THEME_COLORS[theme.id]
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
    const res = await fetch(`/api/ecovadis/${diagnosticId}/actions`, {
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
    await fetch(`/api/ecovadis/${diagnosticId}/actions?action_id=${id}`, { method: 'DELETE' })
    onActionsChange(actions.filter(a => a.id !== id))
  }

  async function saveEdit(id: string) {
    setSavingEdit(true)
    const res = await fetch(`/api/ecovadis/${diagnosticId}/actions?action_id=${id}`, {
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
    const res = await fetch(`/api/ecovadis/${diagnosticId}/actions?action_id=${action.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: next }),
    })
    if (res.ok) {
      const { data } = await res.json()
      onActionsChange(actions.map(a => a.id === action.id ? data : a))
    }
  }

  const niv = NIVEAUX[niveau]

  return (
    <div className="space-y-5">
      {/* Header critère */}
      <div className={`${clr.bg} rounded-xl p-4 border border-gray-200 dark:border-gray-700`}>
        <h3 className={`font-bold text-base ${clr.text}`}>{critere.label}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{critere.description}</p>
      </div>

      {/* Niveau de maturité */}
      <div className={card('p-4 space-y-3')}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">Niveau de maturité</div>
          {savingReponse && <span className="text-xs text-gray-400 animate-pulse">Enregistrement…</span>}
          {savedOk && !savingReponse && <span className="text-xs text-emerald-600 dark:text-emerald-400">✓ Sauvegardé</span>}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {NIVEAUX.map(n => (
            <button key={n.value} onClick={() => handleNiveauChange(n.value)}
              className={`p-2 rounded-lg border-2 text-center transition-all ${niveau === n.value ? `${n.bg} ring-2 ring-offset-1` : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}
              style={{ borderColor: niveau === n.value ? n.color : undefined, outlineColor: n.color }}>
              <div className="text-lg font-bold" style={{ color: n.color }}>{n.shortLabel}</div>
              <div className="text-[10px] font-medium text-gray-600 dark:text-gray-400 mt-0.5">{n.label}</div>
            </button>
          ))}
        </div>
        {niv && <div className={`text-xs px-3 py-1.5 rounded-lg ${niv.bg} ${niv.text} font-medium`}>{niv.description} ({Math.round(niv.pct * 100)}%)</div>}
      </div>

      {/* Commentaire & contexte + Notes & documents attachés */}
      <div className={card('p-4 space-y-2')}>
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">📝 Commentaire & contexte</label>
        <p className="text-xs text-gray-500 dark:text-gray-400">Décrivez vos pratiques actuelles, les preuves existantes et les points d&apos;amélioration identifiés.</p>
        <textarea
          value={commentaire}
          onChange={e => handleCommentaireChange(e.target.value)}
          rows={4}
          placeholder="Ex : Nous disposons d'une politique environnementale formalisée depuis 2022, validée par la direction…"
          className={`${inputCls()} resize-y`}
        />
        {/* Module Notes & documents — attaché au commentaire */}
        <GuidedActionNotePanel
          diagnosticId={diagnosticId}
          actionKey={critere.id}
          apiBase="/api/ecovadis"
          noteTable="ecovadis_notes"
          readOnly={false}
          note={allNotes[critere.id] ?? ''}
          onNoteChange={v => onNoteChange(critere.id, v)}
          initialSections={allNoteSections[critere.id] ?? []}
          onSectionsChange={s => onNoteSectionsChange(critere.id, s)}
        />
      </div>

      {/* Actions d&apos;amélioration */}
      <div className={card('p-4 space-y-3')}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            🎯 Actions d&apos;amélioration
            {critereActions.length > 0 && (
              <span className="ml-2 text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-medium">
                {critereActions.filter(a => a.statut === 'termine').length}/{critereActions.length}
              </span>
            )}
          </div>
          <button onClick={() => setShowActionForm(v => !v)} className={btnP('text-xs py-1.5')}>+ Action</button>
        </div>

        {/* Formulaire nouvelle action */}
        {showActionForm && (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 space-y-2 border border-gray-200 dark:border-gray-700">
            <div><label className={labelCls()}>Titre *</label>
              <input className={inputCls()} value={actionForm.titre} onChange={e => setActionForm(f => ({ ...f, titre: e.target.value }))} placeholder="Ex : Réaliser le bilan carbone scope 3" />
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
          <p className="text-xs text-gray-400 text-center py-3">Aucune action — créez des points d&apos;amélioration concrets</p>
        )}

        <div className="space-y-3">
          {critereActions.map(a => {
            const actionNoteKey = `${critere.id}_action_${a.id}`
            const isEditing = editingActionId === a.id
            const isExpanded = expandedActionNoteId === a.id
            const incomplete = !a.responsable && !a.echeance
            return (
              <div key={a.id} className={`rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden ${incomplete ? 'ring-1 ring-amber-300 dark:ring-amber-500/40' : ''}`}>
                {/* Ligne d'action */}
                {isEditing ? (
                  /* Mode édition inline */
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
                  /* Mode affichage */
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
                        apiBase="/api/ecovadis"
                        noteTable="ecovadis_notes"
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
  const [activeTheme, setActiveTheme] = useState(ECOVADIS_THEMES[0].id)
  const [activeCritere, setActiveCritere] = useState<string | null>(ECOVADIS_THEMES[0].criteres[0].id)

  const niveaux: Record<string, number> = {}
  for (const [k, v] of Object.entries(reponses)) niveaux[k] = v.niveau
  const scoreGlobal = calculateScore(niveaux)
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
          <div className="grid grid-cols-4 gap-2">
            {ECOVADIS_THEMES.map(t => {
              const clr = THEME_COLORS[t.id]
              const themeNiveaux = t.criteres.map(c => niveaux[c.id] ?? 0)
              const themePct = Math.round(themeNiveaux.reduce((s, n) => s + NIVEAUX[n].pct, 0) / t.criteres.length * 100)
              const renseignes = t.criteres.filter(c => (niveaux[c.id] ?? 0) > 0).length
              return (
                <div key={t.id} className={`text-center p-2 rounded-lg ${clr.bg}`}>
                  <div className="text-base">{t.icon}</div>
                  <div className={`text-sm font-bold ${clr.text}`}>{themePct}%</div>
                  <div className="text-[9px] text-gray-400">{renseignes}/{t.criteres.length}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* Sidebar thèmes/critères */}
        <div className={card('overflow-hidden')}>
          <div className="space-y-1 p-2">
            {ECOVADIS_THEMES.map(theme => {
              const clr = THEME_COLORS[theme.id]
              const isOpen = activeTheme === theme.id
              const renseignes = theme.criteres.filter(c => (niveaux[c.id] ?? 0) > 0).length
              return (
                <div key={theme.id}>
                  <button
                    onClick={() => { setActiveTheme(theme.id); if (!isOpen) setActiveCritere(theme.criteres[0].id) }}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors ${isOpen ? `${clr.bg} ${clr.text}` : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300'}`}
                  >
                    <span className="text-base">{theme.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate">{theme.label}</div>
                      <div className="text-[10px] text-gray-400">{renseignes}/{theme.criteres.length} critères · complétude {Math.round(theme.criteres.reduce((s, c) => s + (niveaux[c.id] ?? 0) / 4, 0) / theme.criteres.length * 100)}%</div>
                    </div>
                    <span className="text-xs">{isOpen ? '▾' : '›'}</span>
                  </button>
                  {isOpen && (
                    <div className="ml-3 mt-1 space-y-0.5">
                      {theme.criteres.map(c => {
                        const n = niveaux[c.id] ?? 0
                        const niv = NIVEAUX[n]
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
            const theme = ECOVADIS_THEMES.find(t => t.criteres.some(c => c.id === activeCritere))!
            const critere = theme.criteres.find(c => c.id === activeCritere)!
            return (
              <CriterePanel
                key={activeCritere}
                theme={theme}
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
  const [filterTheme, setFilterTheme] = useState<string>('all')
  const [filterPriorite, setFilterPriorite] = useState<string>('all')
  const [filterStatut, setFilterStatut] = useState<string>('all')
  const [editId, setEditId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<Action>>({})
  const [saving, setSaving] = useState(false)

  const members = useDiagnosticMembers('ecovadis', diagnostic.id)

  const filtered = actions.filter(a => {
    const theme = ECOVADIS_THEMES.find(t => t.criteres.some(c => c.id === a.critere_id))
    if (filterTheme !== 'all' && theme?.id !== filterTheme) return false
    if (filterPriorite !== 'all' && a.priorite !== filterPriorite) return false
    if (filterStatut !== 'all' && a.statut !== filterStatut) return false
    return true
  })

  const total = actions.length
  const termines = actions.filter(a => a.statut === 'termine').length

  async function saveEdit(id: string) {
    setSaving(true)
    const res = await fetch(`/api/ecovadis/${diagnostic.id}/actions?action_id=${id}`, {
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
    await fetch(`/api/ecovadis/${diagnostic.id}/actions?action_id=${id}`, { method: 'DELETE' })
    onActionsChange(actions.filter(a => a.id !== id))
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total actions', value: total, color: 'text-gray-700 dark:text-gray-300' },
          { label: 'En cours', value: actions.filter(a => a.statut === 'en_cours').length, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Terminées', value: `${termines} (${total ? Math.round(termines / total * 100) : 0}%)`, color: 'text-emerald-600 dark:text-emerald-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className={card('p-4 text-center')}>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2">
        <select value={filterTheme} onChange={e => setFilterTheme(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 dark:bg-gray-700 dark:text-white focus:outline-none">
          <option value="all">Tous les thèmes</option>
          {ECOVADIS_THEMES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
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
          const theme = ECOVADIS_THEMES.find(t => t.criteres.some(c => c.id === a.critere_id))
          const isEditing = editId === a.id
          const incomplete = !a.responsable && !a.echeance
          return (
            <div key={a.id} className={`${card('p-4')} ${incomplete ? 'ring-1 ring-amber-300 dark:ring-amber-500/40' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5 text-base">{theme?.icon}</div>
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
  { id: 'presentation',   label: 'Présentation',     icon: '📋' },
  { id: 'dashboard',      label: 'Tableau de bord',  icon: '📊' },
  { id: 'diagnostic',     label: 'Diagnostic',        icon: '🎯' },
  { id: 'actions',        label: 'Plan d\'actions',   icon: '📝' },
  { id: 'correspondances', label: 'Correspondances',  icon: '🔗' },
]

interface EcoShare { id: string; permission: string; shared_with_user_id: string; profiles: { email: string; full_name: string | null } }
interface EcoAnnexe { id: string; nom: string; critere_id: string | null; type_doc: string | null; size: number | null; annexe_index: number | null; url?: string }

export default function EcoVadisDiagnosticApp({ ctx }: { ctx: RseContext }) {
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
  const [pdfData, setPdfData] = useState<EcoVadisPdfData | null>(null)
  const [showAnnexes, setShowAnnexes] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [annexes, setAnnexes] = useState<EcoAnnexe[]>([])
  const [annexesLoading, setAnnexesLoading] = useState(false)
  const [shares, setShares] = useState<EcoShare[]>([])
  const [shareEmail, setShareEmail] = useState('')
  const [sharePermission, setSharePermission] = useState<'read'|'edit'>('read')
  const [shareSaving, setShareSaving] = useState(false)
  const [shareError, setShareError] = useState('')

  const load = useCallback(async () => {
    if (!org || !year) return
    setLoading(true)
    try {
      // Chercher ou créer le diagnostic
      const res = await fetch(`/api/ecovadis?org_id=${org.id}&annee=${year}`)
      const { data: existingDiag } = await res.json()

      let diagId = existingDiag?.id
      if (!diagId) {
        setInitializing(true)
        const createRes = await fetch('/api/ecovadis', {
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

      // Charger réponses + actions + notes
      const [repRes, actRes, notesRes] = await Promise.all([
        fetch(`/api/ecovadis/${diagId}/reponses`),
        fetch(`/api/ecovadis/${diagId}/actions`),
        fetch(`/api/ecovadis/${diagId}/notes`),
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
    // Mise à jour optimiste
    setReponses(prev => ({ ...prev, [critere_id]: { critere_id, niveau, commentaire } }))
    // Sauvegarde
    await fetch(`/api/ecovadis/${diagnostic.id}/reponses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ critere_id, niveau, commentaire }),
    })
    // Recalcul du score global
    const newNiveaux: Record<string, number> = {}
    setReponses(current => {
      for (const [k, v] of Object.entries({ ...current, [critere_id]: { niveau } })) {
        newNiveaux[k] = (v as { niveau: number }).niveau
      }
      return current
    })
    // Légèrement différé pour avoir l'état à jour
    setTimeout(async () => {
      setReponses(current => {
        const n2: Record<string, number> = {}
        for (const [k, v] of Object.entries(current)) n2[k] = v.niveau
        const score = calculateScore(n2)
        if (diagnostic) {
          fetch(`/api/ecovadis/${diagnostic.id}`, {
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
    fetch(`/api/ecovadis/${diagnostic.id}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_key: critere_id, content }),
    }).catch(e => console.error('[ecovadis/notes]', e))
  }

  function handleNoteSectionsChange(critere_id: string, sections: NoteSection[]) {
    setNoteSections(prev => ({ ...prev, [critere_id]: sections }))
    if (!diagnostic) return
    fetch(`/api/ecovadis/${diagnostic.id}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_key: critere_id, sections }),
    }).catch(e => console.error('[ecovadis/notes/sections]', e))
  }

  // ── Handlers Export/Partage ───────────────────────────────────────────────
  async function handleExportExcel() {
    if (!diagnostic) return
    setExportingExcel(true)
    try {
      const res = await fetch(`/api/ecovadis/${diagnostic.id}/export-excel`)
      if (!res.ok) throw new Error('Échec export')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `EcoVadis_${org?.denomination ?? 'diagnostic'}_${year}.xlsx`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { alert('Erreur export Excel : ' + String(e)) }
    finally { setExportingExcel(false) }
  }

  function buildPdfData(): EcoVadisPdfData {
    const niveaux: Record<string, number> = {}
    const commentaires: Record<string, string> = {}
    for (const [k, v] of Object.entries(reponses)) {
      niveaux[k] = v.niveau
      if (v.commentaire) commentaires[k] = v.commentaire
    }
    const score = diagnostic?.score_global ?? calculateScore(niveaux)
    const badge = getBadge(score)
    return {
      organisation: org?.denomination ?? null,
      siren: org?.siren ?? null,
      ville: org?.ville ?? null,
      year,
      date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
      scoreLabel: 'Score simulé',
      scoreValue: score,
      badge: { label: badge.label, emoji: badge.icon, color: badge.color },
      themes: ECOVADIS_THEMES,
      niveaux: NIVEAUX,
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
        if (document.querySelector('#ecovadis-pdf-root [data-pdf-page]')) { resolve(); return }
        const observer = new MutationObserver(() => {
          if (document.querySelector('#ecovadis-pdf-root [data-pdf-page]')) {
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
      await exportReport('ecovadis-pdf-root', `Diagnostic-EcoVadis-${orgSlug}-${year}.pdf`)
    } catch (e) {
      console.error('[ecovadis/exportPDF]', e)
    } finally {
      setExportingPDF(false)
      setPdfData(null)
    }
  }

  async function handleOpenAnnexes() {
    if (!diagnostic) return
    setShowAnnexes(true)
    setAnnexesLoading(true)
    try {
      const res = await fetch(`/api/ecovadis/${diagnostic.id}/documents`)
      const { data } = await res.json()
      setAnnexes(data ?? [])
    } finally { setAnnexesLoading(false) }
  }

  async function handleOpenShare() {
    if (!diagnostic) return
    setShowShare(true)
    const res = await fetch(`/api/ecovadis/${diagnostic.id}/shares`)
    const { data } = await res.json()
    setShares(data ?? [])
  }

  async function handleAddShare() {
    if (!diagnostic || !shareEmail.trim()) return
    setShareSaving(true); setShareError('')
    try {
      const res = await fetch(`/api/ecovadis/${diagnostic.id}/shares`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: shareEmail.trim(), permission: sharePermission }),
      })
      const j = await res.json()
      if (!res.ok) { setShareError(j.error ?? 'Erreur'); return }
      setShares(prev => [...prev.filter(s => s.shared_with_user_id !== j.data.shared_with_user_id), j.data])
      setShareEmail('')
    } finally { setShareSaving(false) }
  }

  async function handleRemoveShare(shareId: string) {
    if (!diagnostic) return
    await fetch(`/api/ecovadis/${diagnostic.id}/shares?share_id=${shareId}`, { method: 'DELETE' })
    setShares(prev => prev.filter(s => s.id !== shareId))
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
        <button onClick={handleOpenAnnexes}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          📎 Annexes
        </button>
        <button onClick={handleOpenShare}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors">
          👥 Partager
        </button>
      </div>
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnostic, exportingExcel, exportingPDF])

  const lockedTabs = !org || !diagnostic ? ['dashboard', 'diagnostic', 'actions'] : []

  if (loading && !diagnostic) {
    return <div className="flex justify-center items-center py-20 text-gray-400 text-sm animate-pulse">
      {initializing ? 'Initialisation du diagnostic…' : 'Chargement…'}
    </div>
  }

  return (
    <div className="space-y-4">

      {/* ── Rapport PDF (monté hors-écran le temps de l'export) ─────────────── */}
      {pdfData && (
        <div style={{ position: 'absolute', left: -9999, top: 0 }} aria-hidden="true">
          <EcoVadisPDFReport id="ecovadis-pdf-root" data={pdfData} />
        </div>
      )}

      {/* ── Modale Annexes ──────────────────────────────────────────────────── */}
      {showAnnexes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowAnnexes(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-bold text-gray-900 dark:text-white">📎 Annexes & Pièces jointes</h2>
              <button onClick={() => setShowAnnexes(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {annexesLoading && <div className="text-center py-8 text-gray-400 text-sm animate-pulse">Chargement…</div>}
              {!annexesLoading && annexes.length === 0 && (
                <p className="text-center py-8 text-gray-400 text-sm">Aucune pièce jointe — uploadez des documents depuis le Diagnostic</p>
              )}
              <div className="space-y-2">
                {annexes.map(d => {
                  const theme = ECOVADIS_THEMES.find(t => t.criteres.some(c => c.id === d.critere_id))
                  const critere = theme?.criteres.find(c => c.id === d.critere_id)
                  const sizeKo = d.size ? `${Math.round(d.size / 1024)} Ko` : ''
                  return (
                    <div key={d.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="text-xs font-bold text-blue-600 dark:text-blue-400 w-10 text-center flex-shrink-0">
                        {d.annexe_index ? `A${String(d.annexe_index).padStart(3,'0')}` : '—'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{d.nom}</div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                          {theme && <span>{theme.icon} {critere?.label ?? d.critere_id}</span>}
                          {d.type_doc && <span>· {d.type_doc}</span>}
                          {sizeKo && <span>· {sizeKo}</span>}
                        </div>
                      </div>
                      {d.url ? (
                        <a href={d.url} target="_blank" rel="noopener noreferrer" download={d.nom}
                          className="text-xs px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0">
                          ⬇
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400 flex-shrink-0">URL indisponible</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-400">Téléchargement direct depuis SharePoint — zéro transit serveur</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Modale Partage ──────────────────────────────────────────────────── */}
      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowShare(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-bold text-gray-900 dark:text-white">👥 Partager le diagnostic</h2>
              <button onClick={() => setShowShare(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {/* Ajouter un partage */}
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

              {/* Liste des partages */}
              {shares.length > 0 && (
                <div className="space-y-2">
                  <div className={labelCls()}>Partagé avec</div>
                  {shares.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900/30 rounded-lg">
                      <div>
                        <div className="text-xs font-medium text-gray-900 dark:text-white">{s.profiles?.full_name ?? s.profiles?.email}</div>
                        <div className="text-[10px] text-gray-400">{s.profiles?.email} · {s.permission === 'edit' ? 'Édition' : 'Lecture seule'}</div>
                      </div>
                      <button onClick={() => handleRemoveShare(s.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                    </div>
                  ))}
                </div>
              )}
              {shares.length === 0 && <p className="text-xs text-gray-400 text-center py-2">Non partagé pour l&apos;instant</p>}
            </div>
          </div>
        </div>
      )}

      {/* Score dans le header */}
      {diagnostic && (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 justify-end">
          <span>Score simulé :</span>
          <span className="font-bold text-gray-900 dark:text-white">{diagnostic.score_global ?? calculateScore(Object.fromEntries(Object.entries(reponses).map(([k, v]) => [k, v.niveau])))}/100</span>
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
                view === v.id ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
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
          score={diagnostic.score_global ?? calculateScore(Object.fromEntries(Object.entries(reponses).map(([k, v]) => [k, v.niveau])))}
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

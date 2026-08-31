/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

/**
 * EcgtApp — Conformité ECGT (Empowering Consumers for the Green Transition)
 * Directive (UE) 2024/825 du 28 février 2024 — lutte contre le greenwashing.
 *
 * Singularité de l’application : au-delà du diagnostic de maturité en 5 axes × 4 critères
 * (marbre RSE), elle ANALYSE DES CONTENUS RÉELS (page web, document, image de publicité,
 * script de vidéo, texte collé), produit un rapport de non-conformités et propose des
 * réécritures conformes.
 *
 * Onglets (ordre du marbre) :
 *   1. 📋 Présentation
 *   2. 📊 Tableau de bord  (sous-onglets : Synthèse | Évaluation des 20 critères)
 *   3. 🔎 Analyse de contenus   ← l’onglet distinctif (3e position = slot « diagnostic »)
 *   4. 📝 Plan d’actions
 *   5. 🔗 Correspondances
 *
 * Aucun octet de fichier ne transite par nos serveurs : dépôt navigateur → SharePoint
 * (upload-session), lecture par URL signée (signed-url).
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { RseContext } from '@/components/rse/RseAppShell'
import ConfirmModal from '@/components/ui/ConfirmModal'
import ViewTabs, { type ViewTab } from '@/components/rse/ViewTabs'
import type { NoteSection } from '@/components/apps/GuidedActionNotePanel'
import ResponsableSelect, { useDiagnosticMembers, notifyMembersChanged } from '@/components/rse/ResponsableSelect'
import ShareAutocomplete from '@/components/apps/ShareAutocomplete'
import { ECGT_AXES, ECGT_NIVEAUX, ECGT_BADGES, ECGT_GRAVITES, calculateEcgtScore } from '@/lib/ecgt/referentiel'

const GuidedActionNotePanel = dynamic(() => import('@/components/apps/GuidedActionNotePanel'), {
  ssr: false,
  loading: () => <div className="py-3 text-xs text-gray-400 animate-pulse">Chargement éditeur…</div>,
})

// ─── Types ────────────────────────────────────────────────────────────────────

type View = 'presentation' | 'dashboard' | 'analyse' | 'actions' | 'correspondances'
type DashSub = 'synthese' | 'evaluation'

interface DiagnosticData { id: string; annee: number; statut: string; score_global: number | null }
interface Reponse { id?: string; critere_id: string; niveau: number; commentaire: string | null }
interface Action {
  id: string; critere_id: string; titre: string; description: string | null
  priorite: 'haute' | 'moyenne' | 'basse'; statut: 'a_faire' | 'en_cours' | 'termine'
  echeance: string | null; responsable: string | null; created_at: string
}

type ContenuType = 'url' | 'document' | 'image' | 'video' | 'texte'
type ContenuStatut = 'a_analyser' | 'analyse' | 'erreur'

interface Contenu {
  id: string
  type: ContenuType
  titre: string
  url: string | null
  sharepoint_item_id: string | null
  mime: string | null
  statut: ContenuStatut
  analysed_at: string | null
  erreur: string | null
  /** Aperçu du texte source renvoyé par la liste (le texte complet n’est pas transporté). */
  texte_apercu?: string | null
  texte_longueur?: number
  /** Compteurs de constats précalculés côté serveur. */
  constats?: { total: number; ouverts: number; critique: number; majeur: number; mineur: number; vigilance: number }
}

type Gravite = 'critique' | 'majeur' | 'mineur' | 'vigilance'
type ConstatStatut = 'ouvert' | 'corrige' | 'ecarte'

interface Constat {
  id: string
  contenu_id: string
  critere_id: string
  gravite: Gravite
  extrait: string
  probleme: string
  article_vise: string
  suggestion: string
  justification: string
  statut: ConstatStatut
}

interface AxeLike {
  id: string; label: string; icon: string; color: string; colorLight: string
  weight: number; description: string
  criteres: { id: string; label: string; description: string }[]
}

const AXES = ECGT_AXES as unknown as AxeLike[]
const NIVEAUX = ECGT_NIVEAUX as unknown as { value: number; shortLabel: string; label: string; description: string; pct: number; color: string; bg: string; text: string }[]
const BADGES = ECGT_BADGES as unknown as { label: string; min: number; color: string; icon: string }[]

function getBadge(score: number) {
  return BADGES.find(b => score >= b.min) ?? BADGES[BADGES.length - 1]
}

function findAxe(critereId: string) { return AXES.find(a => a.criteres.some(c => c.id === critereId)) }
function findCritere(critereId: string) { return findAxe(critereId)?.criteres.find(c => c.id === critereId) }

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function card(extra = '') { return `bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl ${extra}` }
function inputCls() { return 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500' }
function labelCls() { return 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1' }
function btnP(extra = '') { return `px-3 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium transition-colors disabled:opacity-50 ${extra}` }
function btnS(extra = '') { return `px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm transition-colors disabled:opacity-50 ${extra}` }

const PRIORITE_COLORS: Record<Action['priorite'], string> = {
  haute: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  moyenne: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  basse: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}
const STATUT_COLORS: Record<Action['statut'], string> = {
  a_faire: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  en_cours: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  termine: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
}
const STATUT_LABELS: Record<Action['statut'], string> = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' }
const PRIORITE_LABELS: Record<Action['priorite'], string> = { haute: '🔴 Haute', moyenne: '🟡 Moyenne', basse: '🟢 Basse' }

/** Habillage visuel (icône, pastille, bandeau) — le fond documentaire vient du référentiel. */
const GRAVITE_UI: Record<Gravite, { icon: string; chip: string; band: string }> = {
  critique:  { icon: '⛔', chip: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',              band: 'border-red-300 dark:border-red-800/70 bg-red-50/60 dark:bg-red-900/15' },
  majeur:    { icon: '⚠️', chip: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',  band: 'border-orange-300 dark:border-orange-800/70 bg-orange-50/60 dark:bg-orange-900/15' },
  mineur:    { icon: '🔸', chip: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',  band: 'border-yellow-300 dark:border-yellow-800/70 bg-yellow-50/60 dark:bg-yellow-900/15' },
  vigilance: { icon: '👁️', chip: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',          band: 'border-blue-300 dark:border-blue-800/70 bg-blue-50/60 dark:bg-blue-900/15' },
}
const GRAVITES = ECGT_GRAVITES.map(g => ({
  id: g.value as Gravite, label: g.label, description: g.description, color: g.color, ...GRAVITE_UI[g.value as Gravite],
}))
function gravite(g: Gravite) { return GRAVITES.find(x => x.id === g) ?? GRAVITES[GRAVITES.length - 1] }

const TYPES_CONTENU: { id: ContenuType; label: string; icon: string; hint: string }[] = [
  { id: 'url',      label: 'Page web',   icon: '🌐', hint: 'Page produit, page « engagements », article de blog…' },
  { id: 'document', label: 'Document',   icon: '📄', hint: 'Plaquette, fiche produit, rapport, communiqué (PDF, Word…).' },
  { id: 'image',    label: 'Publicité',  icon: '🖼️', hint: 'Visuel publicitaire, packaging, affiche, post réseaux sociaux.' },
  { id: 'video',    label: 'Vidéo',      icon: '🎬', hint: 'Script ou sous-titres d’un film publicitaire.' },
  { id: 'texte',    label: 'Texte collé', icon: '✍️', hint: 'Accroche, slogan, paragraphe à vérifier avant publication.' },
]
function typeMeta(t: ContenuType) { return TYPES_CONTENU.find(x => x.id === t) ?? TYPES_CONTENU[4] }

const STATUT_CONTENU: Record<ContenuStatut, { label: string; cls: string }> = {
  a_analyser: { label: '⏳ À analyser', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  analyse:    { label: '✅ Analysé',    cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  erreur:     { label: '⛔ Erreur',     cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
}

// ─── Vue Présentation ─────────────────────────────────────────────────────────

function PresentationView() {
  return (
    <div className="space-y-5">
      <div className={card('p-6')}>
        <div className="flex items-start gap-4">
          <span className="text-4xl">🛡️</span>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Directive (UE) 2024/825 — Renforcer le rôle des consommateurs dans la transition verte
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Dite « ECGT » (Empowering Consumers for the Green Transition) : la directive qui rend illégal le greenwashing
              dans la communication commerciale adressée aux consommateurs.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-3">
              Adoptée le 28 février 2024, elle modifie deux textes fondateurs du droit de la consommation : la directive
              2005/29/CE sur les pratiques commerciales déloyales et la directive 2011/83/UE sur les droits des
              consommateurs. Concrètement, elle allonge la liste noire des pratiques réputées déloyales en toutes
              circonstances — celles-là n’ont pas à être prouvées trompeuses au cas par cas : elles sont interdites, point.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
              La règle de fond tient en une phrase : <strong>toute allégation environnementale adressée au consommateur doit
              être spécifique, étayée par des preuves accessibles et vérifiables, et ne doit pas laisser croire à une
              performance que l’organisation n’a pas.</strong> C’est exactement ce que cette application vérifie — non pas
              sur des déclarations d’intention, mais sur vos contenus réels.
            </p>
          </div>
        </div>
      </div>

      {/* Calendrier */}
      <div className={card('p-5')}>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">📅 Calendrier — le compte à rebours</h3>
        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3">
            <div className="font-semibold text-blue-800 dark:text-blue-300">28 février 2024 — adoption</div>
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">Publication au Journal officiel de l’Union européenne. Le texte est définitif, son contenu ne bougera plus.</p>
          </div>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
            <div className="font-semibold text-amber-800 dark:text-amber-300">27 mars 2026 — transposition</div>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">Date limite pour que chaque État membre inscrive la directive dans son droit national.</p>
          </div>
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
            <div className="font-semibold text-red-800 dark:text-red-300">27 septembre 2026 — application</div>
            <p className="text-xs text-red-700 dark:text-red-400 mt-1">Les règles deviennent opposables. Tout contenu commercial encore en ligne à cette date doit être conforme.</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
          Les sanctions relèvent du droit national de chaque État membre au titre des pratiques commerciales déloyales :
          en France, jusqu’à 300 000 € d’amende et deux ans d’emprisonnement pour les personnes physiques, avec une
          amende proportionnelle pouvant atteindre 80 % des dépenses engagées pour la pratique en cause, sans compter
          la publication de la décision et le retrait des contenus.
        </p>
      </div>

      {/* Ce qui devient interdit */}
      <div className={card('p-5')}>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">🚫 Ce qui devient interdit</h3>
        <div className="grid md:grid-cols-2 gap-3">
          {[
            {
              icon: '🌿', titre: 'Les allégations génériques non étayées',
              texte: "« Écologique », « vert », « respectueux de l’environnement », « éco-responsable », « climatiquement neutre », « biodégradable » employés seuls, sans preuve d’une excellence environnementale reconnue. La mention doit être spécifique et vérifiable, ou elle disparaît.",
            },
            {
              icon: '🏷️', titre: 'Les labels d’auto-déclaration',
              texte: "Afficher un label de durabilité qui n’est pas fondé sur un système de certification par un tiers ou établi par une autorité publique. Un logo maison « produit éco-conçu » créé par le service marketing devient une pratique déloyale.",
            },
            {
              icon: '⚖️', titre: 'La neutralité carbone par compensation',
              texte: "Affirmer qu’un produit a un impact neutre, réduit ou positif sur l’environnement au motif que ses émissions sont compensées. La compensation ne peut plus servir d’argument produit adressé au consommateur.",
            },
            {
              icon: '⏳', titre: 'Les informations trompeuses sur la durée de vie',
              texte: "Taire une mise à jour logicielle qui dégrade les performances, ou une caractéristique conçue pour limiter la durée de vie. Présenter comme un choix légal ce qui est une obligation légale est également interdit.",
            },
            {
              icon: '🔧', titre: 'Les entraves à la réparation',
              texte: "Passer sous silence l’impossibilité de réparer un bien, ou décourager l’usage de consommables, pièces ou services non fournis par la marque quand rien ne le justifie techniquement.",
            },
            {
              icon: '📈', titre: 'Les engagements futurs sans plan',
              texte: "Annoncer une performance environnementale future (« zéro émission en 2035 ») sans engagement clair, objectif, plan de mise en œuvre détaillé et vérification par un tiers indépendant.",
            },
          ].map(item => (
            <div key={item.titre} className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10 p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{item.icon}</span>
                <span className="font-semibold text-sm text-red-800 dark:text-red-300">{item.titre}</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300">{item.texte}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Les 5 axes */}
      <div className={card('p-5')}>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Les 5 axes du diagnostic</h3>
        <div className="grid md:grid-cols-2 gap-3">
          {AXES.map(axe => (
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
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Niveaux de maturité et badges</h3>
        <div className="grid md:grid-cols-5 gap-2">
          {NIVEAUX.map(n => (
            <div key={n.value} className={`rounded-lg p-3 text-center ${n.bg}`}>
              <div className={`text-lg font-bold ${n.text}`}>{n.shortLabel}</div>
              <div className={`text-xs font-medium ${n.text}`}>{n.label}</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">{n.description}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {BADGES.map(b => (
            <span key={b.label} className="text-xs px-2.5 py-1 rounded-full border" style={{ borderColor: b.color, color: b.color }}>
              {b.icon} {b.label} — dès {b.min}%
            </span>
          ))}
        </div>
      </div>

      {/* Analyse de contenus */}
      <div className={card('p-5')}>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">🔎 La singularité de cette application</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Les autres diagnostics de la plateforme évaluent des dispositifs. Celui-ci évalue aussi <strong>vos contenus
          réels</strong> : vous déposez une page web, un document, un visuel publicitaire, le script d’une vidéo ou un
          simple texte, et l’application produit un rapport de non-conformités — extrait fautif, problème expliqué,
          article visé, puis une <strong>proposition de réécriture conforme</strong> que vous pouvez copier telle quelle.
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Rappel de méthode : l’analyse signale ce qui est <em>déclaré</em>. Elle ne mesure rien à votre place — si une
          allégation exige une preuve, c’est à vous de l’apporter, et l’application vous dit laquelle. Une réécriture
          proposée n’est pas un avis juridique : elle prépare la décision, elle ne la remplace pas.
        </p>
        <div className="mt-3 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50/60 dark:bg-teal-900/15 p-3">
          <div className="text-sm font-semibold text-teal-800 dark:text-teal-300">À combiner avec « Diagnostic Green Claims »</div>
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
            L’application <strong>Diagnostic Green Claims</strong> de la plateforme couvre le volet allégations sous un autre
            angle : celui de la proposition de directive Green Claims, c’est-à-dire la <em>méthode de substantiation</em>
            (cycle de vie, vérification ex ante, gouvernance de la preuve). ECGT part de l’aval — ce qui est publié — et
            remonte vers la preuve manquante. Les deux se complètent : Green Claims construit le dossier de preuve, ECGT
            vérifie que la communication ne dit rien de plus que ce que ce dossier autorise.
          </p>
          <a href="/rse/green-claims" className="inline-block mt-2 text-xs text-teal-700 dark:text-teal-400 hover:underline">Ouvrir Diagnostic Green Claims ↗</a>
        </div>
      </div>
    </div>
  )
}

// ─── Radar + synthèse (Tableau de bord) ───────────────────────────────────────

function SyntheseView({ reponses, actions, score, contenus, constats }: {
  reponses: Record<string, Reponse>
  actions: Action[]
  score: number
  contenus: Contenu[]
  constats: Constat[]
}) {
  const badge = getBadge(score)

  const axeStats = AXES.map(axe => {
    const total = axe.criteres.length
    const niveaux = axe.criteres.map(c => reponses[c.id]?.niveau ?? 0)
    const pct = niveaux.reduce((s, n) => s + (NIVEAUX[n]?.pct ?? 0), 0) / total
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

  const analyses = contenus.filter(c => c.statut === 'analyse')
  const parGravite = GRAVITES.map(g => ({ ...g, count: constats.filter(c => c.gravite === g.id).length }))
  const maxGravite = Math.max(1, ...parGravite.map(g => g.count))
  const ouverts = constats.filter(c => c.statut === 'ouvert').length
  const corriges = constats.filter(c => c.statut === 'corrige').length
  const ecartes = constats.filter(c => c.statut === 'ecarte').length
  const critiques = constats.filter(c => c.gravite === 'critique' && c.statut === 'ouvert').slice(0, 5)

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
          <div className="text-xs text-gray-400 mt-1 text-center">Maturité de conformité ECGT</div>
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
              <polygon points={dataPolygon} fill="#0f766e22" stroke="#0f766e" strokeWidth="2.5" strokeLinejoin="round" />
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

      {/* Synthèse des analyses de contenus */}
      <div className={card('p-5 space-y-4')}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">🔎 Synthèse des analyses de contenus</h3>
          <span className="text-xs text-gray-400">{analyses.length} contenu{analyses.length > 1 ? 's' : ''} analysé{analyses.length > 1 ? 's' : ''} sur {contenus.length} déposé{contenus.length > 1 ? 's' : ''}</span>
        </div>

        {contenus.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">
            Aucun contenu déposé — rendez-vous dans l’onglet « Analyse de contenus » pour vérifier une page, un document ou un visuel.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Constats', v: constats.length, c: 'text-gray-900 dark:text-white' },
                { label: 'Ouverts', v: ouverts, c: 'text-red-600 dark:text-red-400' },
                { label: 'Corrigés', v: corriges, c: 'text-green-600 dark:text-green-400' },
                { label: 'Écartés', v: ecartes, c: 'text-gray-500 dark:text-gray-400' },
              ].map(s => (
                <div key={s.label} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
                  <div className={`text-2xl font-bold ${s.c}`}>{s.v}</div>
                  <div className="text-xs text-gray-400">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Constats par gravité</div>
              {parGravite.map(g => (
                <div key={g.id} className="flex items-center gap-2">
                  <span className="text-xs w-24 flex-shrink-0 text-gray-600 dark:text-gray-300">{g.icon} {g.label}</span>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div className="h-3 rounded-full transition-all duration-500" style={{ width: `${Math.round(g.count / maxGravite * 100)}%`, background: g.color, minWidth: g.count > 0 ? 6 : 0 }} />
                  </div>
                  <span className="text-xs font-bold w-8 text-right" style={{ color: g.color }}>{g.count}</span>
                </div>
              ))}
            </div>

            {constats.length > 0 && (
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="h-2 rounded-full bg-green-600 transition-all" style={{ width: `${Math.round(corriges / constats.length * 100)}%` }} />
              </div>
            )}

            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400">5 derniers constats critiques ouverts</div>
              {critiques.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">Aucun constat critique ouvert — c’est la bonne nouvelle du jour.</p>
              ) : critiques.map(c => {
                const contenu = contenus.find(x => x.id === c.contenu_id)
                return (
                  <div key={c.id} className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-900/10 p-3">
                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-gray-500 dark:text-gray-400">
                      <span className="px-1.5 py-0.5 rounded-full font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">⛔ Critique</span>
                      {contenu && <span>{typeMeta(contenu.type).icon} {contenu.titre}</span>}
                      <span>· {findCritere(c.critere_id)?.label ?? c.critere_id}</span>
                    </div>
                    <blockquote className="mt-1.5 text-xs italic text-gray-800 dark:text-gray-200 border-l-2 border-red-400 dark:border-red-600 pl-2">« {c.extrait} »</blockquote>
                    <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-1">{c.probleme}</p>
                  </div>
                )
              })}
            </div>
          </>
        )}
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
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Plan d’actions — synthèse</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'À faire', count: actions.filter(a => a.statut === 'a_faire').length, color: 'text-gray-600 dark:text-gray-400' },
            { label: 'En cours', count: actions.filter(a => a.statut === 'en_cours').length, color: 'text-blue-600 dark:text-blue-400' },
            { label: 'Terminées', count: actions.filter(a => a.statut === 'termine').length, color: 'text-green-600 dark:text-green-400' },
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

// ─── Panneau critère (évaluation) ─────────────────────────────────────────────

interface CriterePanelProps {
  axe: AxeLike
  critere: { id: string; label: string; description: string }
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
  const [actionToDelete, setActionToDelete] = useState<string | null>(null)

  const members = useDiagnosticMembers('ecgt', diagnosticId)
  const critereActions = actions.filter(a => a.critere_id === critere.id)

  useEffect(() => {
    setNiveau(reponse?.niveau ?? 0)
    setCommentaire(reponse?.commentaire ?? '')
  }, [reponse])

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
  function handleNiveauChange(n: number) { setNiveau(n); scheduleSave(n, commentaire) }
  function handleCommentaireChange(c: string) { setCommentaire(c); scheduleSave(niveau, c) }

  async function addAction() {
    if (!actionForm.titre.trim()) return
    setSavingAction(true)
    const res = await fetch(`/api/ecgt/${diagnosticId}/actions`, {
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

  async function deleteAction(id: string) {
    await fetch(`/api/ecgt/${diagnosticId}/actions?action_id=${id}`, { method: 'DELETE' })
    onActionsChange(actions.filter(a => a.id !== id))
  }

  async function saveEdit(id: string) {
    setSavingEdit(true)
    const res = await fetch(`/api/ecgt/${diagnosticId}/actions?action_id=${id}`, {
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
    const res = await fetch(`/api/ecgt/${diagnosticId}/actions?action_id=${action.id}`, {
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
      <div className="rounded-xl p-4 border border-gray-200 dark:border-gray-700" style={{ background: axe.colorLight + '80' }}>
        <h3 className="font-bold text-base dark:brightness-[1.7]" style={{ color: axe.color }}>{critere.label}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{critere.description}</p>
      </div>

      <div className={card('p-4 space-y-3')}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">Niveau de conformité</div>
          {savingReponse && <span className="text-xs text-gray-400 animate-pulse">Enregistrement…</span>}
          {savedOk && !savingReponse && <span className="text-xs text-green-600 dark:text-green-400">✓ Sauvegardé</span>}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {NIVEAUX.map(n => (
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
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">📝 Commentaire &amp; preuves</label>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Décrivez le dispositif en place, les preuves disponibles (études, certifications tierces, méthodologie de calcul)
          et les manques identifiés. Ce qui n’est pas mesuré s’écrit comme inconnu.
        </p>
        <textarea
          value={commentaire}
          onChange={e => handleCommentaireChange(e.target.value)}
          rows={4}
          placeholder="Ex : toutes les allégations produit passent par une revue juridique depuis 2025, mais le dossier de preuve n’est pas publié et n’est pas accessible au consommateur…"
          className={`${inputCls()} resize-y`}
        />
        <GuidedActionNotePanel
          diagnosticId={diagnosticId}
          actionKey={critere.id}
          apiBase="/api/ecgt"
          noteTable="ecgt_notes"
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
            🎯 Actions de mise en conformité
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
              <input className={inputCls()} value={actionForm.titre} onChange={e => setActionForm(f => ({ ...f, titre: e.target.value }))} placeholder="Ex : retirer la mention « produit écologique » de toutes les fiches produit et lui substituer l’allégation étayée" />
            </div>
            <div><label className={labelCls()}>Description</label>
              <textarea className={`${inputCls()} resize-none`} rows={2} value={actionForm.description} onChange={e => setActionForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
          <p className="text-xs text-gray-400 text-center py-3">Aucune action — planifiez les corrections avant l’échéance du 27 septembre 2026.</p>
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
                      <button className={btnS('text-xs py-1')} onClick={() => setEditingActionId(null)}>Annuler</button>
                      <button className={btnP('text-xs py-1')} onClick={() => saveEdit(a.id)} disabled={savingEdit}>{savingEdit ? '…' : '✓ Sauvegarder'}</button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3">
                    <div className="flex items-start gap-2">
                      <button onClick={() => toggleActionStatut(a)} className={`mt-0.5 text-[10px] px-2 py-1 rounded-full font-medium flex-shrink-0 ${STATUT_COLORS[a.statut]}`}>
                        {STATUT_LABELS[a.statut]}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-semibold ${a.statut === 'termine' ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>{a.titre}</div>
                        {a.description && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{a.description}</div>}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${PRIORITE_COLORS[a.priorite]}`}>{PRIORITE_LABELS[a.priorite]}</span>
                          {a.echeance && <span className="text-[10px] text-gray-400">📅 {a.echeance}</span>}
                          {a.responsable && <span className="text-[10px] text-gray-400">👤 {a.responsable}</span>}
                          {incomplete && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">⚠ À compléter</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => setExpandedActionNoteId(isExpanded ? null : a.id)} title="Notes &amp; annexes" className="text-gray-400 hover:text-teal-600 text-sm px-1.5 py-1 rounded hover:bg-teal-50 dark:hover:bg-teal-900/20">📎</button>
                        <button onClick={() => { setEditingActionId(a.id); setEditData({}) }} className="text-gray-400 hover:text-blue-500 text-sm px-1.5 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20">✏️</button>
                        <button onClick={() => setActionToDelete(a.id)} className="text-gray-300 hover:text-red-400 text-sm px-1.5 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20">✕</button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
                        <GuidedActionNotePanel
                          diagnosticId={diagnosticId}
                          actionKey={actionNoteKey}
                          apiBase="/api/ecgt"
                          noteTable="ecgt_notes"
                          readOnly={false}
                          note={allNotes[actionNoteKey] ?? ''}
                          onNoteChange={v => onNoteChange(actionNoteKey, v)}
                          initialSections={allNoteSections[actionNoteKey] ?? []}
                          onSectionsChange={s => onNoteSectionsChange(actionNoteKey, s)}
                        />
                      </div>
                    )}
                  </div>
                )}
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

// ─── Vue Évaluation (20 critères) ─────────────────────────────────────────────

function EvaluationView({ diagnostic, reponses, actions, allNotes, allNoteSections, onReponseChange, onActionsChange, onNoteChange, onNoteSectionsChange }: {
  diagnostic: DiagnosticData
  reponses: Record<string, Reponse>
  actions: Action[]
  allNotes: Record<string, string>
  allNoteSections: Record<string, NoteSection[]>
  onReponseChange: (critere_id: string, niveau: number, commentaire: string) => void
  onActionsChange: (actions: Action[]) => void
  onNoteChange: (key: string, content: string) => void
  onNoteSectionsChange: (key: string, sections: NoteSection[]) => void
}) {
  const [activeAxe, setActiveAxe] = useState<string>(AXES[0]?.id ?? '')
  const [activeCritere, setActiveCritere] = useState<string>(AXES[0]?.criteres[0]?.id ?? '')

  const niveaux: Record<string, number> = {}
  for (const [k, v] of Object.entries(reponses)) niveaux[k] = v.niveau

  return (
    <div className="space-y-4">
      <div className={card('p-4')}>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Évaluez les 20 critères de conformité ECGT. Chaque critère accepte un commentaire, des notes et des pièces
          justificatives ; les actions créées ici alimentent le plan d’actions.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <div className={card('overflow-hidden')}>
          <div className="space-y-1 p-2">
            {AXES.map(axe => {
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
                      <div className="text-[10px] text-gray-400">{renseignes}/{axe.criteres.length} critères</div>
                    </div>
                    <span className="text-xs">{isOpen ? '▾' : '›'}</span>
                  </button>
                  {isOpen && (
                    <div className="ml-3 mt-1 space-y-0.5">
                      {axe.criteres.map(c => {
                        const n = niveaux[c.id] ?? 0
                        const niv = NIVEAUX[n]
                        const isActive = activeCritere === c.id
                        const nbActions = actions.filter(a => a.critere_id === c.id).length
                        return (
                          <button key={c.id} onClick={() => setActiveCritere(c.id)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${isActive ? 'bg-gray-900 dark:bg-white/10 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'}`}>
                            <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0"
                              style={{ background: (niv?.color ?? '#9ca3af') + '33', color: niv?.color ?? '#9ca3af' }}>
                              {niv?.shortLabel ?? 'NC'}
                            </div>
                            <span className="text-[10px] font-medium truncate flex-1">{c.label}</span>
                            {nbActions > 0 && <span className="text-[9px] text-gray-400 flex-shrink-0">{nbActions}🎯</span>}
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
            const axe = findAxe(activeCritere)
            const critere = axe?.criteres.find(c => c.id === activeCritere)
            if (!axe || !critere) return null
            return (
              <CriterePanel key={activeCritere} axe={axe} critere={critere}
                reponse={reponses[activeCritere] ?? null} actions={actions}
                diagnosticId={diagnostic.id} allNotes={allNotes} allNoteSections={allNoteSections}
                onReponseChange={onReponseChange} onActionsChange={onActionsChange}
                onNoteChange={onNoteChange} onNoteSectionsChange={onNoteSectionsChange} />
            )
          })() : (
            <div className={card('p-8 text-center')}>
              <p className="text-gray-400 text-sm">Sélectionnez un critère pour commencer l’évaluation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Vue Analyse de contenus ──────────────────────────────────────────────────

function ConstatCard({ constat, onStatut, onCreateAction }: {
  constat: Constat
  onStatut: (id: string, statut: ConstatStatut) => void
  onCreateAction: (c: Constat) => void
}) {
  const g = gravite(constat.gravite)
  const [copied, setCopied] = useState(false)
  const critere = findCritere(constat.critere_id)
  const axe = findAxe(constat.critere_id)

  async function copySuggestion() {
    try {
      await navigator.clipboard.writeText(constat.suggestion)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* presse-papiers indisponible */ }
  }

  const barre = constat.statut !== 'ouvert'

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${g.band} ${barre ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span title={g.description} className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${g.chip}`}>{g.icon} {g.label}</span>
          {axe && critere && (
            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: axe.colorLight, color: axe.color }}>
              {axe.icon} {critere.label}
            </span>
          )}
          {constat.article_vise && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">📖 {constat.article_vise}</span>
          )}
        </div>
        {constat.statut === 'corrige' && <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">✅ Corrigé</span>}
        {constat.statut === 'ecarte' && <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300">➖ Écarté</span>}
      </div>

      <div>
        <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Extrait relevé</div>
        <blockquote
          className="text-sm italic text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 border-l-4"
          style={{ borderColor: g.color, background: g.color + '1f' }}
        >
          « {constat.extrait} »
        </blockquote>
      </div>

      <div>
        <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Pourquoi c’est un problème</div>
        <p className="text-sm text-gray-700 dark:text-gray-200">{constat.probleme}</p>
        {constat.justification && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{constat.justification}</p>
        )}
      </div>

      {constat.suggestion && (
        <div className="rounded-lg border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="text-[11px] font-semibold text-green-800 dark:text-green-300">✍️ Réécriture conforme proposée</div>
            <button onClick={copySuggestion}
              className="text-[11px] px-2 py-1 rounded-md border border-green-400 dark:border-green-700 text-green-800 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors">
              {copied ? '✓ Copié' : '📋 Copier la suggestion'}
            </button>
          </div>
          <p className="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap">{constat.suggestion}</p>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap pt-1">
        {constat.statut !== 'corrige' && (
          <button onClick={() => onStatut(constat.id, 'corrige')} className={btnS('text-xs py-1')}>✅ Marquer corrigé</button>
        )}
        {constat.statut !== 'ecarte' && (
          <button onClick={() => onStatut(constat.id, 'ecarte')} className={btnS('text-xs py-1')}>➖ Écarter</button>
        )}
        {constat.statut !== 'ouvert' && (
          <button onClick={() => onStatut(constat.id, 'ouvert')} className={btnS('text-xs py-1')}>↩ Rouvrir</button>
        )}
        <button onClick={() => onCreateAction(constat)} className={btnP('text-xs py-1')}>🎯 Créer une action</button>
      </div>
    </div>
  )
}

function AnalyseView({ diagnostic, contenus, constats, onContenusChange, onConstatsChange, onCreateAction }: {
  diagnostic: DiagnosticData
  contenus: Contenu[]
  constats: Constat[]
  onContenusChange: (c: Contenu[]) => void
  onConstatsChange: (fn: (prev: Constat[]) => Constat[]) => void
  onCreateAction: (c: Constat, contenu: Contenu | undefined) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [type, setType] = useState<ContenuType>('url')
  const [titre, setTitre] = useState('')
  const [url, setUrl] = useState('')
  const [texte, setTexte] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [analysing, setAnalysing] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<string | null>(null)
  const [filtreGravite, setFiltreGravite] = useState<'all' | Gravite>('all')
  const [masquerTraites, setMasquerTraites] = useState(false)
  const [avertissements, setAvertissements] = useState<Record<string, string[]>>({})

  function resetForm() {
    setTitre(''); setUrl(''); setTexte(''); setFormError(null); setUploadProgress(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function createContenu(payload: Record<string, unknown>) {
    const res = await fetch('/api/ecgt/contenus', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ diagnostic_id: diagnostic.id, ...payload }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({})) as Record<string, string>
      throw new Error(j.error ?? 'Erreur lors de l’ajout du contenu')
    }
    const { data } = await res.json()
    onContenusChange([data as Contenu, ...contenus])
  }

  async function handleAdd() {
    if (!titre.trim()) { setFormError('Donnez un titre à ce contenu.'); return }
    setSaving(true); setFormError(null)
    try {
      if (type === 'url') {
        if (!url.trim()) throw new Error('Renseignez l’adresse de la page à analyser.')
        await createContenu({ type, titre: titre.trim(), url: url.trim() })
      } else if (type === 'video' || type === 'texte') {
        if (!texte.trim()) throw new Error(type === 'video' ? 'Collez le script ou les sous-titres de la vidéo.' : 'Collez le texte à analyser.')
        await createContenu({ type, titre: titre.trim(), texte_source: texte })
      } else {
        throw new Error('Sélectionnez un fichier à déposer.')
      }
      resetForm(); setShowForm(false)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erreur')
    } finally { setSaving(false) }
  }

  // Dépôt navigateur → SharePoint (aucun octet ne transite par nos serveurs)
  async function handleFileSelect(files: FileList | null) {
    if (!files?.length) return
    const file = files[0]
    const mime = file.type || 'application/octet-stream'
    setUploading(true); setFormError(null); setUploadProgress(5)
    try {
      const sessionRes = await fetch('/api/ecgt/contenus/upload-session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagnostic_id: diagnostic.id, filename: file.name, size: file.size, mime }),
      })
      const sessionText = await sessionRes.text()
      let sessionJson: Record<string, unknown> = {}
      try { sessionJson = JSON.parse(sessionText) } catch { /* non-JSON */ }
      if (!sessionRes.ok) throw new Error((sessionJson.error as string) ?? `Erreur ${sessionRes.status}`)
      const { uploadUrl, finalName } = sessionJson as { uploadUrl: string; finalName?: string }

      const spItemId = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round(5 + (e.loaded / e.total) * 90))
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try { resolve((JSON.parse(xhr.responseText) as { id: string }).id) }
            catch { reject(new Error('Réponse SharePoint invalide')) }
          } else reject(new Error(`Erreur upload SharePoint ${xhr.status}`))
        }
        xhr.onerror = () => reject(new Error('Erreur réseau pendant le dépôt'))
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', mime)
        xhr.setRequestHeader('Content-Range', `bytes 0-${file.size - 1}/${file.size}`)
        xhr.send(file)
      })

      setUploadProgress(98)
      await createContenu({
        type, titre: (titre.trim() || finalName || file.name), sharepoint_item_id: spItemId, mime, taille: file.size,
      })
      setUploadProgress(100)
      resetForm(); setShowForm(false)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erreur de dépôt')
    } finally {
      setTimeout(() => { setUploading(false); setUploadProgress(0) }, 400)
    }
  }

  async function loadConstats(contenuId: string) {
    try {
      const res = await fetch(`/api/ecgt/constats?contenu_id=${contenuId}`)
      const { data } = await res.json()
      const list = (data ?? []) as Constat[]
      onConstatsChange(prev => [...prev.filter(c => c.contenu_id !== contenuId), ...list])
    } catch { /* ignore */ }
  }

  async function analyser(contenu: Contenu) {
    setAnalysing(contenu.id)
    setAvertissements(prev => { const n = { ...prev }; delete n[contenu.id]; return n })
    try {
      const res = await fetch(`/api/ecgt/contenus/${contenu.id}/analyser`, { method: 'POST' })
      const json = await res.json().catch(() => ({})) as {
        data?: { contenu?: Contenu; constats?: Constat[]; avertissements?: string[] }
        error?: string
        erreur?: string
      }
      const erreur = json.error ?? json.erreur
      if (!res.ok || erreur) {
        onContenusChange(contenus.map(c => c.id === contenu.id ? { ...c, statut: 'erreur', erreur: erreur ?? `Erreur ${res.status}` } : c))
        return
      }
      const list = json.data?.constats ?? []
      const maj = json.data?.contenu
      onConstatsChange(prev => [...prev.filter(c => c.contenu_id !== contenu.id), ...list])
      onContenusChange(contenus.map(c => c.id === contenu.id
        ? { ...c, ...(maj ?? {}), statut: 'analyse', erreur: null, analysed_at: maj?.analysed_at ?? new Date().toISOString() }
        : c))
      if (json.data?.avertissements?.length) {
        setAvertissements(prev => ({ ...prev, [contenu.id]: json.data!.avertissements! }))
      }
      setExpanded(contenu.id)
    } catch (e) {
      onContenusChange(contenus.map(c => c.id === contenu.id ? { ...c, statut: 'erreur', erreur: e instanceof Error ? e.message : 'Erreur' } : c))
    } finally { setAnalysing(null) }
  }

  async function supprimer(id: string) {
    await fetch(`/api/ecgt/contenus?id=${id}`, { method: 'DELETE' })
    onContenusChange(contenus.filter(c => c.id !== id))
    onConstatsChange(prev => prev.filter(c => c.contenu_id !== id))
    if (expanded === id) setExpanded(null)
  }

  async function setConstatStatut(id: string, statut: ConstatStatut) {
    onConstatsChange(prev => prev.map(c => c.id === id ? { ...c, statut } : c))
    await fetch(`/api/ecgt/constats?id=${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut }),
    }).catch(() => {})
  }

  async function ouvrirPiece(contenu: Contenu) {
    if (!contenu.sharepoint_item_id) return
    try {
      const res = await fetch(`/api/ecgt/contenus/signed-url?contenu_id=${encodeURIComponent(contenu.id)}`)
      const j = await res.json() as { url?: string; error?: string }
      if (j.url) window.open(j.url, '_blank', 'noopener,noreferrer')
    } catch { /* ignore */ }
  }

  const needFile = type === 'document' || type === 'image'

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Intro */}
      <div className={card('p-5')}>
        <div className="flex items-start gap-3">
          <span className="text-2xl">🔎</span>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white">Analyse de contenus réels</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Déposez ce que vos clients lisent vraiment : une page web, un document commercial, un visuel publicitaire,
              le script d’une vidéo ou une simple accroche. L’analyse relève les allégations à risque au regard de la
              directive (UE) 2024/825, explique le problème, cite l’article visé et propose une réécriture conforme.
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              L’analyse repose sur une lecture automatisée : elle vous prépare le travail, elle ne vaut pas avis juridique.
              Chaque constat reste à valider par la personne responsable de la publication.
            </p>
          </div>
          <button onClick={() => { setShowForm(v => !v); resetForm() }} className={btnP('flex-shrink-0')}>
            {showForm ? 'Fermer' : '+ Ajouter un contenu'}
          </button>
        </div>
      </div>

      {/* Formulaire d’ajout */}
      {showForm && (
        <div className={card('p-5 space-y-4')}>
          <div>
            <label className={labelCls()}>Type de contenu</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {TYPES_CONTENU.map(t => {
                const active = type === t.id
                return (
                  <button key={t.id} onClick={() => { setType(t.id); setFormError(null) }}
                    className={`p-3 rounded-lg border-2 text-center transition-all ${active
                      ? 'border-teal-600 bg-teal-50 dark:bg-teal-900/20 dark:border-teal-500'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                    <div className="text-xl">{t.icon}</div>
                    <div className={`text-[11px] font-semibold mt-0.5 ${active ? 'text-teal-800 dark:text-teal-300' : 'text-gray-600 dark:text-gray-300'}`}>{t.label}</div>
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">{typeMeta(type).hint}</p>
          </div>

          <div>
            <label className={labelCls()}>Titre du contenu *</label>
            <input className={inputCls()} value={titre} onChange={e => setTitre(e.target.value)}
              placeholder="Ex : page produit « Gamme Éco » — septembre 2026" />
          </div>

          {type === 'url' && (
            <div>
              <label className={labelCls()}>Adresse de la page</label>
              <input className={inputCls()} value={url} onChange={e => setUrl(e.target.value)}
                placeholder="https://www.exemple.fr/nos-engagements" />
              <p className="text-[11px] text-gray-400 mt-1">La page doit être publiquement accessible : le contenu est lu au moment de l’analyse.</p>
            </div>
          )}

          {needFile && (
            <div>
              <label className={labelCls()}>{type === 'image' ? 'Visuel publicitaire' : 'Document'}</label>
              <div className="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-4 text-center">
                <input ref={fileInputRef} type="file" className="hidden"
                  accept={type === 'image' ? 'image/*' : '.pdf,.doc,.docx,.ppt,.pptx,.txt,.md'}
                  onChange={e => handleFileSelect(e.target.files)} />
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading || !titre.trim()} className={btnS()}>
                  {uploading ? `Dépôt en cours… ${uploadProgress}%` : `📎 Choisir un ${type === 'image' ? 'visuel' : 'document'}`}
                </button>
                {!titre.trim() && <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2">⚠ Renseignez d’abord un titre.</p>}
                <p className="text-[11px] text-gray-400 mt-2">
                  Le fichier part directement de votre navigateur vers SharePoint : aucun octet ne transite par nos serveurs.
                </p>
                {uploading && (
                  <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="h-2 rounded-full bg-teal-600 transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                )}
              </div>
            </div>
          )}

          {type === 'video' && (
            <div>
              <label className={labelCls()}>Script ou sous-titres de la vidéo</label>
              <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 mb-2">
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  ⚠ La transcription automatique n’est pas disponible : l’application n’écoute pas la bande son.
                  Collez ci-dessous le script, la voix off ou le fichier de sous-titres — c’est ce texte qui sera analysé.
                </p>
              </div>
              <textarea className={`${inputCls()} resize-y font-mono text-xs`} rows={8} value={texte}
                onChange={e => setTexte(e.target.value)}
                placeholder="Voix off : « Chez nous, tout est 100 % écologique et neutre en carbone… »" />
            </div>
          )}

          {type === 'texte' && (
            <div>
              <label className={labelCls()}>Texte à analyser</label>
              <textarea className={`${inputCls()} resize-y`} rows={7} value={texte}
                onChange={e => setTexte(e.target.value)}
                placeholder="Collez ici l’accroche, le slogan ou le paragraphe à vérifier avant publication." />
            </div>
          )}

          {formError && <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>}

          {!needFile && (
            <div className="flex gap-2 justify-end">
              <button className={btnS()} onClick={() => { setShowForm(false); resetForm() }}>Annuler</button>
              <button className={btnP()} onClick={handleAdd} disabled={saving}>{saving ? '…' : '✓ Ajouter'}</button>
            </div>
          )}
        </div>
      )}

      {/* Liste des contenus */}
      {contenus.length === 0 ? (
        <div className={card('p-8 text-center')}>
          <div className="text-3xl mb-2">📭</div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Aucun contenu déposé.</p>
          <p className="text-xs text-gray-400 mt-1">Commencez par la page la plus exposée : celle qui porte vos allégations environnementales.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {contenus.map(contenu => {
            const meta = typeMeta(contenu.type)
            const st = STATUT_CONTENU[contenu.statut]
            const mesConstats = constats.filter(c => c.contenu_id === contenu.id)
            const isOpen = expanded === contenu.id
            const enCours = analysing === contenu.id
            const parG = GRAVITES.map(g => ({ ...g, count: mesConstats.filter(c => c.gravite === g.id).length })).filter(g => g.count > 0)
            const visibles = mesConstats
              .filter(c => filtreGravite === 'all' || c.gravite === filtreGravite)
              .filter(c => !masquerTraites || c.statut === 'ouvert')
              .sort((a, b) => GRAVITES.findIndex(g => g.id === a.gravite) - GRAVITES.findIndex(g => g.id === b.gravite))

            return (
              <div key={contenu.id} className={card('overflow-hidden')}>
                <div className="p-4 flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{contenu.titre}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                      <span className="text-[10px] text-gray-400">{meta.label}</span>
                    </div>
                    {contenu.url && (
                      <a href={contenu.url} target="_blank" rel="noopener noreferrer"
                        className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline break-all">{contenu.url} ↗</a>
                    )}
                    {contenu.sharepoint_item_id && (
                      <button onClick={() => ouvrirPiece(contenu)} className="block text-[11px] text-teal-600 dark:text-teal-400 hover:underline">Ouvrir le fichier ↗</button>
                    )}
                    {contenu.analysed_at && (
                      <div className="text-[11px] text-gray-400 mt-0.5">Analysé le {new Date(contenu.analysed_at).toLocaleString('fr-FR')}</div>
                    )}
                    {contenu.statut === 'erreur' && contenu.erreur && (
                      <div className="text-[11px] text-red-600 dark:text-red-400 mt-1">⛔ {contenu.erreur}</div>
                    )}
                    {contenu.texte_apercu && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {contenu.texte_apercu}
                        {typeof contenu.texte_longueur === 'number' && contenu.texte_longueur > 400 ? '…' : ''}
                      </p>
                    )}
                    {(avertissements[contenu.id] ?? []).length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {(avertissements[contenu.id] ?? []).map((a, i) => (
                          <li key={i} className="text-[11px] text-amber-700 dark:text-amber-400">⚠ {a}</li>
                        ))}
                      </ul>
                    )}
                    {parG.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {parG.map(g => (
                          <span key={g.id} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${g.chip}`}>{g.icon} {g.count} {g.label.toLowerCase()}</span>
                        ))}
                        <span className="text-[10px] text-gray-400">· {mesConstats.filter(c => c.statut === 'ouvert').length} ouvert{mesConstats.filter(c => c.statut === 'ouvert').length > 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                    <button onClick={() => analyser(contenu)} disabled={enCours} className={btnP('text-xs py-1.5')}>
                      {enCours ? '⟳ Analyse…' : contenu.statut === 'analyse' ? '🔎 Réanalyser' : '🔎 Analyser'}
                    </button>
                    {(mesConstats.length > 0 || contenu.statut === 'analyse') && (
                      <button onClick={() => { const next = isOpen ? null : contenu.id; setExpanded(next); if (next && mesConstats.length === 0) loadConstats(contenu.id) }}
                        className={btnS('text-xs py-1.5')}>
                        {isOpen ? '▾ Masquer' : '› Rapport'}
                      </button>
                    )}
                    <button onClick={() => setToDelete(contenu.id)} title="Supprimer"
                      className="text-gray-300 hover:text-red-500 text-sm px-1.5 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20">✕</button>
                  </div>
                </div>

                {enCours && (
                  <div className="px-4 pb-4">
                    <div className="rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 p-3 flex items-center gap-3">
                      <div className="animate-spin w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full flex-shrink-0" />
                      <p className="text-xs text-teal-800 dark:text-teal-300">
                        Lecture du contenu et confrontation aux interdictions de la directive… Comptez une trentaine de secondes.
                      </p>
                    </div>
                  </div>
                )}

                {isOpen && !enCours && (
                  <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-3 bg-gray-50/60 dark:bg-gray-900/30">
                    {mesConstats.length === 0 ? (
                      <div className="rounded-lg border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4 text-center">
                        <div className="text-2xl mb-1">✅</div>
                        <p className="text-sm text-green-800 dark:text-green-300 font-medium">Aucune non-conformité relevée sur ce contenu.</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Cela ne vaut pas certificat : la responsabilité de la publication reste la vôtre.</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <select className={inputCls() + ' !w-auto text-xs'} value={filtreGravite} onChange={e => setFiltreGravite(e.target.value as 'all' | Gravite)}>
                            <option value="all">Toutes gravités</option>
                            {GRAVITES.map(g => <option key={g.id} value={g.id}>{g.icon} {g.label}</option>)}
                          </select>
                          <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                            <input type="checkbox" checked={masquerTraites} onChange={e => setMasquerTraites(e.target.checked)} className="accent-teal-600" />
                            Masquer les constats traités
                          </label>
                          <span className="text-xs text-gray-400 ml-auto">{visibles.length} constat{visibles.length > 1 ? 's' : ''} affiché{visibles.length > 1 ? 's' : ''}</span>
                        </div>
                        {GRAVITES.map(g => {
                          const groupe = visibles.filter(c => c.gravite === g.id)
                          if (groupe.length === 0) return null
                          return (
                            <div key={g.id} className="space-y-2">
                              <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: g.color }} title={g.description}>
                                <span>{g.icon}</span>
                                <span>{g.label}</span>
                                <span className="text-gray-400 font-normal">— {groupe.length} constat{groupe.length > 1 ? 's' : ''}</span>
                              </div>
                              {groupe.map(c => (
                                <ConstatCard key={c.id} constat={c} onStatut={setConstatStatut}
                                  onCreateAction={cst => onCreateAction(cst, contenu)} />
                              ))}
                            </div>
                          )
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ConfirmModal
        open={!!toDelete}
        title="Supprimer le contenu"
        message="Le contenu et tous ses constats d’analyse seront définitivement supprimés."
        onConfirm={() => { if (toDelete) supprimer(toDelete); setToDelete(null) }}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}

// ─── Vue Plan d’actions ───────────────────────────────────────────────────────

interface ActionPrefill { critere_id: string; titre: string; description: string }

function ActionsView({ diagnostic, actions, onActionsChange, prefill, onPrefillConsumed }: {
  diagnostic: DiagnosticData
  actions: Action[]
  onActionsChange: (a: Action[]) => void
  prefill: ActionPrefill | null
  onPrefillConsumed: () => void
}) {
  const [filterAxe, setFilterAxe] = useState<string>('all')
  const [filterPriorite, setFilterPriorite] = useState<string>('all')
  const [filterStatut, setFilterStatut] = useState<string>('all')
  const [editId, setEditId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<Action>>({})
  const [saving, setSaving] = useState(false)
  const [actionToDelete, setActionToDelete] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ critere_id: AXES[0]?.criteres[0]?.id ?? '', titre: '', description: '', priorite: 'moyenne', echeance: '', responsable: '' })
  const [creating, setCreating] = useState(false)

  const members = useDiagnosticMembers('ecgt', diagnostic.id)

  useEffect(() => {
    if (!prefill) return
    setForm(f => ({ ...f, critere_id: prefill.critere_id, titre: prefill.titre, description: prefill.description, priorite: 'haute' }))
    setShowForm(true)
    onPrefillConsumed()
  }, [prefill, onPrefillConsumed])

  const filtered = actions.filter(a => {
    const axe = findAxe(a.critere_id)
    if (filterAxe !== 'all' && axe?.id !== filterAxe) return false
    if (filterPriorite !== 'all' && a.priorite !== filterPriorite) return false
    if (filterStatut !== 'all' && a.statut !== filterStatut) return false
    return true
  })
  const termines = actions.filter(a => a.statut === 'termine').length

  async function createAction() {
    if (!form.titre.trim()) return
    setCreating(true)
    const res = await fetch(`/api/ecgt/${diagnostic.id}/actions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const { data } = await res.json()
      onActionsChange([...actions, data])
      setForm({ critere_id: AXES[0]?.criteres[0]?.id ?? '', titre: '', description: '', priorite: 'moyenne', echeance: '', responsable: '' })
      setShowForm(false)
    }
    setCreating(false)
  }

  async function saveEdit(id: string) {
    setSaving(true)
    const res = await fetch(`/api/ecgt/${diagnostic.id}/actions?action_id=${id}`, {
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
    const res = await fetch(`/api/ecgt/${diagnostic.id}/actions?action_id=${action.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: next }),
    })
    if (res.ok) {
      const { data } = await res.json()
      onActionsChange(actions.map(a => a.id === action.id ? data : a))
    }
  }

  async function deleteAction(id: string) {
    await fetch(`/api/ecgt/${diagnostic.id}/actions?action_id=${id}`, { method: 'DELETE' })
    onActionsChange(actions.filter(a => a.id !== id))
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', v: actions.length, c: 'text-gray-900 dark:text-white' },
          { label: 'À faire', v: actions.filter(a => a.statut === 'a_faire').length, c: 'text-gray-600 dark:text-gray-400' },
          { label: 'En cours', v: actions.filter(a => a.statut === 'en_cours').length, c: 'text-blue-600 dark:text-blue-400' },
          { label: 'Terminées', v: termines, c: 'text-green-600 dark:text-green-400' },
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

      <div className={card('p-3 flex flex-wrap gap-2 items-center')}>
        <select className={inputCls() + ' !w-auto'} value={filterAxe} onChange={e => setFilterAxe(e.target.value)}>
          <option value="all">Tous les axes</option>
          {AXES.map(a => <option key={a.id} value={a.id}>{a.icon} {a.label}</option>)}
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
        <span className="text-xs text-gray-400">{filtered.length} action{filtered.length > 1 ? 's' : ''}</span>
        <button className={btnP('ml-auto text-xs py-1.5')} onClick={() => setShowForm(v => !v)}>{showForm ? 'Fermer' : '+ Nouvelle action'}</button>
      </div>

      {showForm && (
        <div className={card('p-4 space-y-2')}>
          <div><label className={labelCls()}>Critère concerné</label>
            <select className={inputCls()} value={form.critere_id} onChange={e => setForm(f => ({ ...f, critere_id: e.target.value }))}>
              {AXES.map(axe => (
                <optgroup key={axe.id} label={`${axe.icon} ${axe.label}`}>
                  {axe.criteres.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div><label className={labelCls()}>Titre *</label>
            <input className={inputCls()} value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} placeholder="Ex : réécrire l’accroche de la page d’accueil" />
          </div>
          <div><label className={labelCls()}>Description</label>
            <textarea className={`${inputCls()} resize-y`} rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div><label className={labelCls()}>Priorité</label>
              <select className={inputCls()} value={form.priorite} onChange={e => setForm(f => ({ ...f, priorite: e.target.value }))}>
                <option value="haute">🔴 Haute</option><option value="moyenne">🟡 Moyenne</option><option value="basse">🟢 Basse</option>
              </select>
            </div>
            <div><label className={labelCls()}>Échéance</label>
              <input type="date" className={inputCls()} value={form.echeance} onChange={e => setForm(f => ({ ...f, echeance: e.target.value }))} />
            </div>
            <div><label className={labelCls()}>Responsable</label>
              <ResponsableSelect className={inputCls()} value={form.responsable} members={members} onChange={v => setForm(f => ({ ...f, responsable: v }))} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button className={btnS()} onClick={() => setShowForm(false)}>Annuler</button>
            <button className={btnP()} onClick={createAction} disabled={creating || !form.titre.trim()}>{creating ? '…' : '✓ Créer'}</button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className={card('p-8 text-center')}>
          <p className="text-gray-400 text-sm">Aucune action — créez-les depuis un constat d’analyse ou depuis l’évaluation des critères.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => {
            const axe = findAxe(a.critere_id)
            const critere = findCritere(a.critere_id)
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
                    <button onClick={() => toggleStatut(a)} className={`mt-0.5 text-[10px] px-2 py-1 rounded-full font-medium flex-shrink-0 ${STATUT_COLORS[a.statut]}`}>
                      {STATUT_LABELS[a.statut]}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold ${a.statut === 'termine' ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>{a.titre}</div>
                      {a.description && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 whitespace-pre-wrap">{a.description}</div>}
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

// ─── Vue Correspondances ──────────────────────────────────────────────────────

interface CorrItem {
  ref: string; icon: string; route: string | null; desc: string
  correspondances: { axe: string; label: string; ref: string }[]
}

const AXE_IDS = AXES.map(a => a.id)
const A = (i: number) => AXE_IDS[i] ?? ''
const AL = (i: number) => AXES[i]?.label ?? ''

const CORR_APPS: CorrItem[] = [
  {
    ref: 'Diagnostic Green Claims', icon: '🌱', route: '/rse/green-claims',
    desc: "Le pendant amont d’ECGT : la méthode de substantiation des allégations environnementales (analyse de cycle de vie, vérification ex ante, gouvernance de la preuve). Green Claims construit le dossier de preuve ; ECGT vérifie que la communication ne dit rien de plus que ce que ce dossier autorise.",
    correspondances: [
      { axe: A(0), label: AL(0), ref: 'Allégations soumises aux mêmes exigences de substantiation' },
      { axe: A(2), label: AL(2), ref: 'Dossier de preuve accessible et vérifiable' },
    ],
  },
  {
    ref: 'Bilan GES', icon: '🌡️', route: '/rse/bilan-ges',
    desc: "Source de preuves pour toute allégation climat : sans inventaire d’émissions mesuré, une mention « bas carbone » ou « neutre » est une déclaration sans fondement — donc un constat critique.",
    correspondances: [
      { axe: A(1), label: AL(1), ref: 'Preuve chiffrée derrière les allégations climat' },
      { axe: A(2), label: AL(2), ref: 'Méthode de calcul publiable et opposable' },
    ],
  },
  {
    ref: 'VSME EFRAG — standard PME', icon: '📄', route: '/rse/vsme-efrag',
    desc: "Le rapport de durabilité volontaire fournit les indicateurs publiés que la communication commerciale ne doit pas contredire : la cohérence entre le rapport et la publicité est le premier point contrôlé.",
    correspondances: [
      { axe: A(1), label: AL(1), ref: 'Indicateurs publiés = socle de preuve' },
      { axe: A(4), label: AL(4), ref: 'Cohérence reporting ↔ communication' },
    ],
  },
  {
    ref: 'Diagnostic RSE ISO 26000', icon: '🔎', route: '/rse/iso26000',
    desc: "La question centrale « loyauté des pratiques » et le domaine d’action « information et pratiques loyales en matière de commercialisation » recouvrent exactement le champ d’ECGT.",
    correspondances: [
      { axe: A(0), label: AL(0), ref: 'Loyauté de l’information au consommateur' },
      { axe: A(4), label: AL(4), ref: 'Gouvernance des engagements sociétaux' },
    ],
  },
  {
    ref: 'EcoVadis', icon: '📊', route: '/rse/ecovadis',
    desc: "Le thème « Éthique des affaires » d’EcoVadis interroge les pratiques commerciales et la communication responsable : les preuves collectées ici y sont directement réutilisables.",
    correspondances: [
      { axe: A(4), label: AL(4), ref: 'Éthique des affaires et communication responsable' },
    ],
  },
  {
    ref: 'Collecte documentaire RSE', icon: '🗂️', route: '/rse/collecte-rse',
    desc: "Centralise les pièces justificatives (études, certificats tiers, méthodologies) qui étayent chaque allégation — le référentiel de preuves auquel renvoie l’analyse.",
    correspondances: [
      { axe: A(2), label: AL(2), ref: 'Archivage des preuves opposables' },
    ],
  },
]

const CORR_REFERENTIELS: CorrItem[] = [
  {
    ref: 'Directive (UE) 2024/825 — texte de référence', icon: '🇪🇺', route: null,
    desc: "Le texte lui-même : il modifie la directive 2005/29/CE (pratiques commerciales déloyales) et la directive 2011/83/UE (droits des consommateurs). Transposition au 27 mars 2026, application au 27 septembre 2026.",
    correspondances: [
      { axe: A(0), label: AL(0), ref: 'Annexe I — liste noire des pratiques déloyales' },
      { axe: A(1), label: AL(1), ref: 'Article 6 — allégations trompeuses et engagements futurs' },
    ],
  },
  {
    ref: 'CSRD / ESRS E1 — changement climatique', icon: '📘', route: null,
    desc: "ESRS E1 encadre la publication des cibles climat, des plans de transition et l’usage des crédits carbone. Une allégation commerciale climat doit s’appuyer sur ces mêmes données — et ne jamais les dépasser.",
    correspondances: [
      { axe: A(1), label: AL(1), ref: 'E1-4 cibles · E1-7 absorptions et crédits carbone' },
      { axe: A(4), label: AL(4), ref: 'Cohérence entre reporting réglementé et publicité' },
    ],
  },
  {
    ref: 'ISO 26000 — §6.7 loyauté des pratiques', icon: '📗', route: null,
    desc: "Le domaine d’action 6.7.4 (pratiques loyales de commercialisation, d’information et de contrat) et 6.7.5 (consommation durable) : l’information donnée au consommateur doit être exacte, vérifiable et non trompeuse.",
    correspondances: [
      { axe: A(0), label: AL(0), ref: '6.7.4 — information loyale et vérifiable' },
      { axe: A(3), label: AL(3), ref: '6.7.5 — consommation durable, durabilité et réparabilité' },
    ],
  },
  {
    ref: 'ISO 14021 — auto-déclarations environnementales', icon: '🏷️', route: null,
    desc: "La norme de référence des allégations de type II (auto-déclarées) : exigences de véracité, de vérifiabilité, d’absence de vague, et traitement des mentions « recyclable », « compostable », « durée de vie prolongée ».",
    correspondances: [
      { axe: A(0), label: AL(0), ref: 'Allégations spécifiques, vérifiables, non vagues' },
      { axe: A(2), label: AL(2), ref: 'Documentation d’appui de l’auto-déclaration' },
    ],
  },
  {
    ref: 'Loi Climat et Résilience — art. 12', icon: '🇫🇷', route: null,
    desc: "La France a devancé l’Europe : depuis 2023, il est interdit d’affirmer dans une publicité qu’un produit ou service est « neutre en carbone » (ou toute formulation équivalente) sans publier un bilan d’émissions, une trajectoire de réduction et les modalités de compensation résiduelle. ECGT durcit encore la règle en interdisant l’argument fondé sur la compensation.",
    correspondances: [
      { axe: A(1), label: AL(1), ref: 'Interdiction de « neutre en carbone » sans preuve publiée' },
      { axe: A(2), label: AL(2), ref: 'Publication du bilan et de la trajectoire' },
    ],
  },
  {
    ref: 'Règlement (UE) 2024/1781 — écoconception (ESPR)', icon: '🔧', route: null,
    desc: "Le passeport numérique de produit et les exigences de durabilité et de réparabilité fourniront les données factuelles qu’ECGT interdit de travestir : score de réparabilité, disponibilité des pièces, durée de vie.",
    correspondances: [
      { axe: A(3), label: AL(3), ref: 'Durée de vie, réparabilité, pièces détachées' },
    ],
  },
  {
    ref: 'GRI Standards & ODD 12', icon: '📋', route: null,
    desc: "GRI 417 (marketing et étiquetage) impose de rapporter les cas de non-conformité en matière d’information produit ; l’ODD 12.8 vise l’information du consommateur pour une consommation responsable.",
    correspondances: [
      { axe: A(4), label: AL(4), ref: 'GRI 417 — incidents de non-conformité marketing' },
    ],
  },
]

function CorrespondancesView() {
  const axeById = (id: string) => AXES.find(a => a.id === id)
  const renderItem = (item: CorrItem) => (
    <div key={item.ref} className={card('p-4')}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{item.icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-gray-900 dark:text-white">{item.ref}</span>
            {item.route && <a href={item.route} className="text-xs text-teal-600 dark:text-teal-400 hover:underline">Ouvrir ↗</a>}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.desc}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {item.correspondances.map((c, i) => {
              const axe = axeById(c.axe)
              return (
                <span key={i} className="text-[11px] px-2 py-0.5 rounded-full" title={c.ref}
                  style={{ backgroundColor: (axe?.colorLight ?? '#eeeeee') + '80', color: axe?.color ?? '#555555' }}>
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
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Où la conformité ECGT rencontre les autres applications Sens’ethO et les référentiels externes. Une allégation
          n’est jamais conforme « en soi » : elle l’est parce qu’une donnée mesurée, publiée et vérifiable la soutient.
        </p>
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Applications RSE Sens’ethO</h4>
        <div className="space-y-3">{CORR_APPS.map(renderItem)}</div>
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Référentiels et textes externes</h4>
        <div className="space-y-3">{CORR_REFERENTIELS.map(renderItem)}</div>
      </div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

const TABS: readonly ViewTab<View>[] = [
  { id: 'presentation',    label: 'Présentation',        icon: '📋' },
  { id: 'dashboard',       label: 'Tableau de bord',     icon: '📊' },
  { id: 'analyse',         label: 'Analyse de contenus', icon: '🔎' },
  { id: 'actions',         label: 'Plan d’actions',      icon: '📝' },
  { id: 'correspondances', label: 'Correspondances',     icon: '🔗' },
] as const

export default function EcgtApp({ ctx }: { ctx: RseContext }) {
  const { org, year, setActions: setHeaderActions } = ctx

  const [view, setView] = useState<View>('presentation')
  const [dashSub, setDashSub] = useState<DashSub>('synthese')
  const [diagnostic, setDiagnostic] = useState<DiagnosticData | null>(null)
  const [reponses, setReponses] = useState<Record<string, Reponse>>({})
  const [actions, setActions] = useState<Action[]>([])
  const [allNotes, setAllNotes] = useState<Record<string, string>>({})
  const [allNoteSections, setAllNoteSections] = useState<Record<string, NoteSection[]>>({})
  const [contenus, setContenus] = useState<Contenu[]>([])
  const [constats, setConstats] = useState<Constat[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exportingPDF, setExportingPDF] = useState(false)
  const [actionPrefill, setActionPrefill] = useState<ActionPrefill | null>(null)

  const [showShare, setShowShare] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [sharePermission, setSharePermission] = useState<'read' | 'edit'>('read')
  const [shareSaving, setShareSaving] = useState(false)
  const [shareError, setShareError] = useState('')
  const [shareList, setShareList] = useState<{ id: string; email: string; permission: 'read' | 'edit' }[]>([])

  // Charger / créer le diagnostic
  useEffect(() => {
    if (!org || !year) { setDiagnostic(null); return }
    setLoading(true); setError(null)
    const load = async () => {
      try {
        const getRes = await fetch(`/api/ecgt?org_id=${org.id}&annee=${year}`)
        const { data: existing } = await getRes.json()

        let diagId: string
        if (existing) {
          diagId = existing.id
          setDiagnostic(existing)
        } else {
          const postRes = await fetch('/api/ecgt', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ org_id: org.id, annee: year }),
          })
          const { data: created } = await postRes.json()
          setDiagnostic(created)
          diagId = created.id
        }

        const [diagFull, notesRes, contenusRes, constatsRes] = await Promise.all([
          fetch(`/api/ecgt/${diagId}`).then(r => r.json()),
          fetch(`/api/ecgt/${diagId}/notes`).then(r => r.json()),
          fetch(`/api/ecgt/contenus?diagnostic_id=${diagId}`).then(r => r.json()).catch(() => ({ data: [] })),
          fetch(`/api/ecgt/constats?diagnostic_id=${diagId}`).then(r => r.json()).catch(() => ({ data: [] })),
        ])

        const repMap: Record<string, Reponse> = {}
        for (const r of (diagFull.data?.reponses ?? [])) repMap[r.critere_id] = r
        setReponses(repMap)
        setActions(diagFull.data?.actions ?? [])

        if (notesRes.data) {
          setAllNotes(notesRes.data.notes ?? {})
          const sectMap: Record<string, NoteSection[]> = {}
          for (const [k, v] of Object.entries(notesRes.data.sections ?? {})) sectMap[k] = v as NoteSection[]
          setAllNoteSections(sectMap)
        }

        setContenus((contenusRes.data ?? []) as Contenu[])
        setConstats((constatsRes.data ?? []) as Constat[])
      } catch (e) {
        setError(String(e))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [org, year])

  const niveaux = useMemo(() => {
    const m: Record<string, number> = {}
    for (const [k, v] of Object.entries(reponses)) m[k] = v.niveau
    return m
  }, [reponses])
  const score = calculateEcgtScore(niveaux)

  // Mise à jour du score global
  useEffect(() => {
    if (!diagnostic) return
    if (score !== diagnostic.score_global) {
      fetch(`/api/ecgt/${diagnostic.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score_global: score }),
      }).catch(() => {})
    }
  }, [score, diagnostic])

  const handleExportExcel = useCallback(async () => {
    if (!diagnostic) return
    const res = await fetch(`/api/ecgt/${diagnostic.id}/export-excel`)
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ECGT_${org?.denomination ?? 'diagnostic'}_${year}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }, [diagnostic, org, year])

  // Rapport PDF vectoriel (jsPDF) — pas de capture d’écran, texte sélectionnable.
  const handleExportPDF = useCallback(async () => {
    if (!diagnostic || exportingPDF) return
    setExportingPDF(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const M = 16, W = 210, maxW = W - M * 2
      let y = 0

      const badge = getBadge(score)
      // Les polices standard jsPDF ne rendent pas les emoji : on les retire du texte.
      const strip = (s: string) => s
        .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
        .replace(/[\u2190-\u21FF\u2460-\u27BF\u2B00-\u2BFF\u2600-\u26FF\uFE0F\u20E3]/g, '')
        .trim()

      const newPage = () => { doc.addPage(); y = M }
      const need = (h: number) => { if (y + h > 285) newPage() }
      const text = (s: string, size: number, style: 'normal' | 'bold' = 'normal', color: [number, number, number] = [30, 41, 59], indent = 0) => {
        doc.setFontSize(size); doc.setFont('helvetica', style); doc.setTextColor(color[0], color[1], color[2])
        const lines = doc.splitTextToSize(strip(s), maxW - indent) as string[]
        for (const line of lines) { need(size * 0.55); doc.text(line, M + indent, y); y += size * 0.55 }
      }
      const rule = () => { need(4); doc.setDrawColor(203, 213, 225); doc.line(M, y, W - M, y); y += 4 }

      // Couverture
      doc.setFillColor(15, 118, 110); doc.rect(0, 0, W, 52, 'F')
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(20)
      doc.text('Conformite ECGT', M, 24)
      doc.setFontSize(11); doc.setFont('helvetica', 'normal')
      doc.text('Directive (UE) 2024/825 - lutte contre le greenwashing', M, 33)
      doc.setFontSize(9)
      doc.text('Application au 27 septembre 2026', M, 41)
      y = 66

      text(org?.denomination ?? 'Organisation', 16, 'bold')
      y += 2
      text(`Exercice ${year} — rapport genere le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`, 10, 'normal', [100, 116, 139])
      y += 6
      text(`Score de conformite : ${score} / 100 — ${strip(badge.label)}`, 14, 'bold')
      y += 4
      rule()

      // Synthèse par axe
      text('Synthese par axe', 13, 'bold'); y += 2
      for (const axe of AXES) {
        const pct = Math.round(axe.criteres.reduce((s, c) => s + (NIVEAUX[niveaux[c.id] ?? 0]?.pct ?? 0), 0) / axe.criteres.length * 100)
        text(`${strip(axe.label)} — ${pct}% (poids ${Math.round(axe.weight * 100)}%)`, 10, 'bold')
      }
      y += 4; rule()

      // Détail des critères
      text('Detail des criteres', 13, 'bold'); y += 2
      for (const axe of AXES) {
        need(12); text(strip(axe.label), 11, 'bold', [15, 118, 110])
        for (const c of axe.criteres) {
          const n = niveaux[c.id] ?? 0
          const niv = NIVEAUX[n]
          text(`- ${c.label} : ${niv?.shortLabel ?? 'NC'} — ${strip(niv?.label ?? '')}`, 9, 'normal', [30, 41, 59], 4)
          const com = reponses[c.id]?.commentaire
          if (com) text(com, 8, 'normal', [100, 116, 139], 8)
        }
        y += 2
      }
      rule()

      // Constats d’analyse
      text('Constats d’analyse de contenus', 13, 'bold'); y += 2
      if (constats.length === 0) {
        text('Aucun contenu analyse a ce jour.', 9, 'normal', [100, 116, 139])
      } else {
        for (const g of GRAVITES) {
          const groupe = constats.filter(c => c.gravite === g.id)
          if (groupe.length === 0) continue
          need(10); text(`${g.label} (${groupe.length})`, 11, 'bold', [15, 118, 110])
          for (const c of groupe) {
            const contenu = contenus.find(x => x.id === c.contenu_id)
            text(`- ${contenu?.titre ?? 'Contenu'} — ${findCritere(c.critere_id)?.label ?? c.critere_id} [${c.statut}]`, 9, 'bold', [30, 41, 59], 4)
            text(`Extrait : « ${c.extrait} »`, 8, 'normal', [100, 116, 139], 8)
            text(`Probleme : ${c.probleme}`, 8, 'normal', [100, 116, 139], 8)
            if (c.article_vise) text(`Article vise : ${c.article_vise}`, 8, 'normal', [100, 116, 139], 8)
            if (c.suggestion) text(`Reecriture proposee : ${c.suggestion}`, 8, 'normal', [22, 101, 52], 8)
            y += 1
          }
        }
      }
      rule()

      // Plan d’actions
      text('Plan d’actions', 13, 'bold'); y += 2
      if (actions.length === 0) {
        text('Aucune action enregistree.', 9, 'normal', [100, 116, 139])
      } else {
        for (const a of actions) {
          text(`- ${a.titre}`, 9, 'bold')
          text(`${strip(STATUT_LABELS[a.statut])} · ${strip(PRIORITE_LABELS[a.priorite])} · ${a.echeance ?? 'sans echeance'} · ${a.responsable ?? 'non assigne'}`, 8, 'normal', [100, 116, 139], 4)
          if (a.description) text(a.description, 8, 'normal', [100, 116, 139], 4)
        }
      }

      const orgSlug = (org?.denomination ?? 'diagnostic').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
      doc.save(`Conformite-ECGT-${orgSlug}-${year}.pdf`)
    } catch (e) {
      console.error('[ecgt/exportPDF]', e)
    } finally {
      setExportingPDF(false)
    }
  }, [diagnostic, exportingPDF, score, niveaux, reponses, actions, constats, contenus, org, year])

  // Boutons du header
  useEffect(() => {
    if (view === 'presentation' || !diagnostic) { setHeaderActions(null); return }
    setHeaderActions(
      <div className="flex items-center gap-2">
        <button onClick={handleExportExcel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium transition-colors">
          ⬇ Excel
        </button>
        <button onClick={handleExportPDF} disabled={exportingPDF}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs font-medium transition-colors disabled:opacity-50">
          {exportingPDF ? '⟳' : '📄'} PDF
        </button>
        <button onClick={() => setShowShare(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs font-medium transition-colors">
          👥 Partager
        </button>
      </div>
    )
    return () => setHeaderActions(null)
  }, [view, diagnostic, setHeaderActions, handleExportExcel, handleExportPDF, exportingPDF])

  const handleReponseChange = useCallback(async (critere_id: string, niveau: number, commentaire: string) => {
    if (!diagnostic) return
    const res = await fetch(`/api/ecgt/${diagnostic.id}/reponses`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ critere_id, niveau, commentaire }),
    })
    if (res.ok) {
      const { data } = await res.json()
      setReponses(prev => ({ ...prev, [critere_id]: data }))
    }
  }, [diagnostic])

  const handleCreateActionFromConstat = useCallback((c: Constat, contenu: Contenu | undefined) => {
    const critere = findCritere(c.critere_id)
    setActionPrefill({
      critere_id: c.critere_id,
      titre: `Corriger : ${c.extrait.slice(0, 70)}${c.extrait.length > 70 ? '…' : ''}`,
      description: [
        contenu ? `Contenu : ${contenu.titre}${contenu.url ? ` (${contenu.url})` : ''}` : '',
        critere ? `Critère : ${critere.label}` : '',
        `Gravité : ${gravite(c.gravite).label}`,
        c.article_vise ? `Article visé : ${c.article_vise}` : '',
        '',
        `Extrait relevé : « ${c.extrait} »`,
        `Problème : ${c.probleme}`,
        c.suggestion ? `Réécriture proposée : ${c.suggestion}` : '',
      ].filter(Boolean).join('\n'),
    })
    setView('actions')
  }, [])

  const loadShares = useCallback(async () => {
    if (!diagnostic) return
    try {
      const res = await fetch(`/api/ecgt/${diagnostic.id}/shares`)
      const { data } = await res.json()
      setShareList(data ?? [])
    } catch { /* ignore */ }
  }, [diagnostic])

  useEffect(() => { if (showShare) loadShares() }, [showShare, loadShares])

  async function handleAddShare() {
    if (!diagnostic || !shareEmail.trim()) return
    setShareSaving(true); setShareError('')
    try {
      const res = await fetch(`/api/ecgt/${diagnostic.id}/shares`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: shareEmail.trim(), permission: sharePermission }),
      })
      if (!res.ok) {
        const { error: err } = await res.json().catch(() => ({ error: 'Erreur de partage' }))
        setShareError(err || 'Erreur de partage')
        return
      }
      setShareEmail('')
      await loadShares()
      notifyMembersChanged('ecgt', diagnostic.id)
    } catch {
      setShareError('Erreur de partage')
    } finally { setShareSaving(false) }
  }

  async function handleRemoveShare(shareId: string) {
    if (!diagnostic) return
    try {
      await fetch(`/api/ecgt/${diagnostic.id}/shares?shareId=${shareId}`, { method: 'DELETE' })
      await loadShares()
      notifyMembersChanged('ecgt', diagnostic.id)
    } catch { /* ignore */ }
  }

  const lockedTabs = !org ? TABS.filter(t => t.id !== 'presentation').map(t => t.id) : []

  if (!org) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <ViewTabs tabs={TABS} active="presentation" onChange={() => {}} disabledIds={lockedTabs} />
        <div className={card('p-6 text-center')}>
          <div className="text-4xl mb-4">🛡️</div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Conformité ECGT — directive (UE) 2024/825</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Sélectionnez une organisation pour accéder au diagnostic et à l’analyse de contenus.</p>
        </div>
        <PresentationView />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ViewTabs tabs={TABS} active={view} onChange={setView} disabledIds={lockedTabs} />

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
            <div className="space-y-4">
              <div className="flex gap-2">
                {([
                  { id: 'synthese' as DashSub, label: '📊 Synthèse & analyses' },
                  { id: 'evaluation' as DashSub, label: '🎯 Évaluation des 20 critères' },
                ]).map(s => (
                  <button key={s.id} onClick={() => setDashSub(s.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${dashSub === s.id
                      ? 'bg-teal-700 text-white'
                      : 'border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
              {dashSub === 'synthese' ? (
                <SyntheseView reponses={reponses} actions={actions} score={score} contenus={contenus} constats={constats} />
              ) : (
                <EvaluationView
                  diagnostic={diagnostic} reponses={reponses} actions={actions}
                  allNotes={allNotes} allNoteSections={allNoteSections}
                  onReponseChange={handleReponseChange}
                  onActionsChange={setActions}
                  onNoteChange={(key, content) => setAllNotes(prev => ({ ...prev, [key]: content }))}
                  onNoteSectionsChange={(key, sections) => setAllNoteSections(prev => ({ ...prev, [key]: sections }))}
                />
              )}
            </div>
          )}

          {view === 'analyse' && diagnostic && (
            <AnalyseView
              diagnostic={diagnostic} contenus={contenus} constats={constats}
              onContenusChange={setContenus}
              onConstatsChange={fn => setConstats(prev => fn(prev))}
              onCreateAction={handleCreateActionFromConstat}
            />
          )}

          {view === 'actions' && diagnostic && (
            <ActionsView
              diagnostic={diagnostic} actions={actions} onActionsChange={setActions}
              prefill={actionPrefill} onPrefillConsumed={() => setActionPrefill(null)}
            />
          )}

          {view === 'correspondances' && <CorrespondancesView />}
        </>
      )}

      {/* Modale Partage */}
      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowShare(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-bold text-gray-900 dark:text-white">👥 Partager le diagnostic ECGT</h2>
              <button onClick={() => setShowShare(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-3">
                <div>
                  <label className={labelCls()}>Email de l’utilisateur</label>
                  <ShareAutocomplete value={shareEmail} onChange={setShareEmail} onEnter={handleAddShare} inputClassName={inputCls()} />
                </div>
                <div>
                  <label className={labelCls()}>Niveau d’accès</label>
                  <select value={sharePermission} onChange={e => setSharePermission(e.target.value as 'read' | 'edit')} className={inputCls()}>
                    <option value="read">Lecture seule</option>
                    <option value="edit">Édition</option>
                  </select>
                </div>
                {shareError && <p className="text-xs text-red-500">{shareError}</p>}
                <button onClick={handleAddShare} disabled={shareSaving || !shareEmail.trim()} className={btnP('w-full text-center')}>
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
                        <button onClick={() => handleRemoveShare(s.id)} title="Retirer l’accès" className="text-gray-400 hover:text-red-500 transition-colors">✕</button>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-gray-400 text-center">Le collaborateur doit avoir un compte Sens’ethO. Il retrouvera le dossier en sélectionnant la même organisation et la même année.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

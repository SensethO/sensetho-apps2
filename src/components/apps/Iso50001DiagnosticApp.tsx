/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import type { RseContext } from '@/components/rse/RseAppShell'
import ConfirmModal from '@/components/ui/ConfirmModal'
import ShareAutocomplete from '@/components/apps/ShareAutocomplete'
import type { NoteSection } from '@/components/apps/GuidedActionNotePanel'
import type { Iso50001PdfData } from '@/components/apps/Iso50001PDFReport'
import ResponsableSelect, { useDiagnosticMembers } from '@/components/rse/ResponsableSelect'

// GuidedActionNotePanel chargé en lazy — même pattern que les autres apps RSE
const GuidedActionNotePanel = dynamic(() => import('@/components/apps/GuidedActionNotePanel'), {
  ssr: false,
  loading: () => <div className="py-3 text-xs text-gray-400 animate-pulse">Chargement éditeur…</div>
})

// Rapport PDF chargé en lazy (html2canvas + jspdf hors du bundle principal)
const Iso50001PDFReport = dynamic(() => import('@/components/apps/Iso50001PDFReport'), {
  ssr: false,
  loading: () => null,
})

// ─── Données statiques Diagnostic ISO 50001 ──────────────────────────────────

export const ISO50001_AXES = [
  {
    id: 'leadership', label: 'Leadership & Politique énergétique', icon: '🧭',
    color: '#ca8a04', colorLight: '#fef9c3', weight: 0.20,
    description: "Engagement de la direction, politique énergétique, équipe de management de l'énergie, ressources (art. 5).",
    criteres: [
      { id: 'i50-lead-engagement', label: "Engagement de la direction et intégration de l'énergie dans la stratégie", description: "La direction démontre son leadership et son engagement vis-à-vis du système de management de l'énergie (SMÉ) : elle assume la responsabilité de l'efficacité du SMÉ et de l'amélioration continue de la performance énergétique. L'énergie est intégrée à la stratégie de l'organisme et aux processus de décision, au même titre que la qualité ou les coûts. La direction s'assure que les objectifs énergétiques sont compatibles avec les orientations stratégiques et que les résultats sont communiqués et suivis au plus haut niveau." },
      { id: 'i50-lead-politique',  label: 'Politique énergétique formalisée, communiquée et revue', description: "Une politique énergétique est formalisée, signée par la direction et adaptée à la finalité et au contexte de l'organisme. Elle inclut les engagements requis par la norme : amélioration continue de la performance énergétique, mise à disposition des informations et des ressources nécessaires à l'atteinte des objectifs, conformité aux exigences légales et autres exigences, et soutien à l'achat de produits et services économes en énergie. Elle est communiquée à l'ensemble du personnel, tenue à disposition des parties intéressées et revue périodiquement pour rester pertinente." },
      { id: 'i50-lead-equipe',     label: "Équipe de management de l'énergie (référent énergie, rôles, compétences)", description: "Une équipe de management de l'énergie est constituée et dispose de l'autorité et des compétences nécessaires : référent énergie identifié, rôles et responsabilités attribués et communiqués à tous les niveaux pertinents de l'organisme. L'équipe veille à la conformité du SMÉ aux exigences de la norme, rend compte à la direction de la performance énergétique et anime la démarche au quotidien. Sa composition reflète la diversité des fonctions concernées : exploitation, maintenance, achats, finances et direction." },
      { id: 'i50-lead-perimetre',  label: "Domaine d'application et périmètre du SMÉ définis et documentés", description: "Le domaine d'application et le périmètre du système de management de l'énergie sont déterminés, documentés et tenus à jour : sites, bâtiments, procédés, équipements et types d'énergie couverts (électricité, gaz, fioul, chaleur, carburants). L'organisme s'assure qu'il dispose de l'autorité nécessaire pour maîtriser sa performance énergétique sur l'ensemble du périmètre retenu et n'exclut aucun type d'énergie significatif. Cette délimitation claire conditionne la pertinence de la revue énergétique et la crédibilité de la certification." },
    ],
  },
  {
    id: 'planification', label: 'Revue énergétique & Planification', icon: '📋',
    color: '#dc2626', colorLight: '#fee2e2', weight: 0.20,
    description: "Revue énergétique, usages énergétiques significatifs (UES), IPÉ, situation énergétique de référence, objectifs et cibles (art. 6).",
    criteres: [
      { id: 'i50-plan-revue',     label: "Revue énergétique : analyse des usages et consommations d'énergie", description: "Une revue énergétique est élaborée et tenue à jour selon une méthodologie et des critères définis : analyse des usages et des consommations d'énergie à partir des données de mesure (factures, comptages, relevés), identification des évolutions passées et estimation des usages futurs. La revue couvre l'ensemble des types d'énergie du périmètre et est actualisée à intervalles définis ainsi qu'en cas de modification majeure des installations, des procédés ou des bâtiments. Elle constitue le socle factuel de toute la démarche : sans revue énergétique fiable, ni les UES ni les objectifs ne peuvent être pertinents." },
      { id: 'i50-plan-ues',       label: 'Identification des usages énergétiques significatifs (UES) et de leurs facteurs pertinents', description: "Les usages énergétiques significatifs (UES) — installations, équipements, systèmes ou procédés représentant une part importante de la consommation ou présentant un potentiel d'amélioration considérable — sont identifiés et hiérarchisés à partir de la revue énergétique. Pour chaque UES, l'organisme détermine les facteurs pertinents qui influencent la consommation (production, météo, occupation, horaires) ainsi que les personnes dont le travail a une incidence sur ces usages. Les UES font l'objet d'une surveillance renforcée et orientent les priorités du plan d'actions et du plan de comptage." },
      { id: 'i50-plan-ipe',       label: "Indicateurs de performance énergétique (IPÉ) et situation énergétique de référence (SER)", description: "Des indicateurs de performance énergétique (IPÉ) sont déterminés pour mesurer et démontrer l'amélioration de la performance : consommations spécifiques (kWh/unité produite, kWh/m²), rendements, ratios normalisés des facteurs pertinents. Une situation énergétique de référence (SER) est établie à partir de la revue énergétique sur une période représentative ; elle est ajustée de manière normalisée lorsque les facteurs pertinents évoluent ou en cas de changement majeur. La comparaison des IPÉ à la SER permet de démontrer objectivement l'amélioration continue de la performance énergétique exigée par la norme." },
      { id: 'i50-plan-objectifs', label: "Objectifs, cibles énergétiques et plans d'actions pour les atteindre", description: "Des objectifs et des cibles énergétiques mesurables sont établis aux fonctions et niveaux pertinents, en cohérence avec la politique énergétique et les résultats de la revue énergétique. Chaque objectif est décliné en plans d'actions précisant les actions à mener, les ressources, les responsabilités, les échéances et la méthode d'évaluation des résultats — y compris la vérification de l'amélioration de la performance énergétique obtenue. L'avancement est revu périodiquement et les plans d'actions sont actualisés en fonction des résultats, des opportunités identifiées et des évolutions du contexte." },
    ],
  },
  {
    id: 'support', label: 'Support & Compétences', icon: '🛠️',
    color: '#2563eb', colorLight: '#dbeafe', weight: 0.20,
    description: "Ressources, compétences, sensibilisation, communication, informations documentées (art. 7).",
    criteres: [
      { id: 'i50-sup-ressources',      label: 'Ressources allouées au SMÉ (humaines, techniques, financières, comptage)', description: "L'organisme détermine et fournit les ressources nécessaires à l'établissement, à la mise en œuvre, à la tenue à jour et à l'amélioration continue du SMÉ et de la performance énergétique. Cela couvre les moyens humains (référent énergie, temps dédié des équipes), les moyens techniques (instruments de comptage et de mesurage, outils de suivi des consommations, logiciels de management de l'énergie) et les budgets d'investissement pour les actions d'efficacité énergétique. L'adéquation des ressources est réexaminée lors des revues de direction au regard des objectifs et des gains obtenus." },
      { id: 'i50-sup-competences',     label: "Compétences et formations des personnes influant sur la performance énergétique", description: "Les compétences nécessaires sont identifiées pour les personnes dont le travail a une incidence sur la performance énergétique et sur le SMÉ : exploitation des UES, maintenance, conduite des installations techniques, achats, pilotage des données. Ces personnes sont compétentes sur la base d'une formation initiale ou professionnelle, d'un savoir-faire ou d'une expérience appropriés, et des formations complémentaires sont planifiées lorsque des écarts sont constatés. L'efficacité des actions de montée en compétences est évaluée et les preuves sont conservées en tant qu'informations documentées." },
      { id: 'i50-sup-sensibilisation', label: "Sensibilisation du personnel aux écogestes et à la politique énergétique", description: "L'ensemble du personnel est sensibilisé à la politique énergétique, à sa contribution à l'efficacité du SMÉ et à l'impact de ses activités sur la performance énergétique : écogestes au poste de travail, consignes d'extinction et de régulation, signalement des dérives et des gaspillages. Des campagnes de communication régulières (affichage des consommations, challenges, journées énergie) entretiennent la mobilisation et valorisent les résultats obtenus. La remontée des idées d'économies d'énergie depuis le terrain est encouragée et alimente le plan d'actions." },
      { id: 'i50-sup-documentation',   label: "Informations documentées du SMÉ (procédures, données énergétiques, traçabilité)", description: "Les informations documentées exigées par la norme et nécessaires à l'efficacité du SMÉ sont créées, mises à jour et maîtrisées : périmètre, politique, revue énergétique, UES, IPÉ et SER, objectifs et plans d'actions, procédures d'exploitation et de maintenance des UES. Les données de consommation et de mesurage sont collectées, conservées et protégées pour garantir leur traçabilité et permettre la comparaison à la situation de référence. La documentation est accessible aux personnes qui en ont besoin et protégée contre les modifications non autorisées, afin de démontrer la conformité lors des audits." },
    ],
  },
  {
    id: 'operations', label: 'Réalisation opérationnelle', icon: '⚙️',
    color: '#16a34a', colorLight: '#dcfce7', weight: 0.20,
    description: "Maîtrise opérationnelle des UES, conception, achats d'énergie et d'équipements efficaces (art. 8).",
    criteres: [
      { id: 'i50-ope-maitrise',   label: "Maîtrise opérationnelle des usages énergétiques significatifs (critères, maintenance, consignes)", description: "Les processus liés aux usages énergétiques significatifs sont planifiés, mis en œuvre et maîtrisés : critères opératoires définis (températures de consigne, pressions, horaires de fonctionnement, points de réglage), exploitation et maintenance des installations conformément à ces critères, et communication des consignes aux personnes concernées, y compris les prestataires. Les dérives par rapport aux critères sont détectées et corrigées, et les conséquences des écarts sont analysées. La maintenance préventive des équipements énergétiques (chaufferies, groupes froid, air comprimé, moteurs) est intégrée à la maîtrise opérationnelle car elle conditionne directement les rendements." },
      { id: 'i50-ope-conception', label: "Prise en compte de la performance énergétique dans la conception (bâtiments, procédés, équipements)", description: "Les opportunités d'amélioration de la performance énergétique et la maîtrise opérationnelle sont prises en compte dès la conception des installations, équipements, systèmes et procédés énergivores, nouveaux ou modifiés, ayant un impact significatif sur la performance énergétique sur leur durée de vie. Les spécifications de conception intègrent des exigences d'efficacité énergétique (dimensionnement, récupération de chaleur, régulation, isolation) et les résultats de ces études sont intégrés dans les cahiers des charges et les projets. Cette anticipation évite de figer des surconsommations pour des décennies, le coût d'exploitation énergétique dépassant souvent largement le coût d'investissement." },
      { id: 'i50-ope-achats',     label: "Achats d'énergie et d'équipements selon des critères de performance énergétique", description: "Le processus d'achat intègre des critères de performance énergétique pour les produits, équipements et services susceptibles d'avoir un impact significatif : évaluation sur la durée de vie (coût global incluant la consommation), classes d'efficacité, exigences énergétiques dans les cahiers des charges et information des fournisseurs que l'achat est en partie évalué sur la performance énergétique. L'approvisionnement en énergie est lui-même défini et documenté : spécifications d'achat d'énergie (puissance souscrite, qualité, origine renouvelable le cas échéant) et optimisation des contrats de fourniture. Cette approche garantit la cohérence du SMÉ sur toute la chaîne d'approvisionnement." },
      { id: 'i50-ope-mesure',     label: "Plan de comptage et de mesurage de l'énergie (sous-comptage des UES, télérelève)", description: "Un plan de comptage et de mesurage proportionné à la taille et à la complexité de l'organisme est défini et mis en œuvre : compteurs généraux et sous-comptages des usages énergétiques significatifs, télérelève et historisation des données, fréquences de relevé adaptées au pilotage. Les équipements de mesure sont étalonnés ou vérifiés pour garantir des données exactes et reproductibles, et les anomalies de comptage sont traitées. Ce dispositif fournit les données indispensables au suivi des IPÉ, à la détection des dérives et à la démonstration de l'amélioration de la performance énergétique." },
    ],
  },
  {
    id: 'evaluation', label: 'Évaluation & Amélioration', icon: '📈',
    color: '#9333ea', colorLight: '#f3e8ff', weight: 0.20,
    description: "Surveillance des IPÉ, conformité, audits internes, revue de direction, amélioration continue de la performance énergétique (art. 9-10).",
    criteres: [
      { id: 'i50-eval-surveillance', label: "Surveillance, mesure et analyse des IPÉ et des consommations (dérives, alertes)", description: "La performance énergétique et le SMÉ sont surveillés et mesurés à intervalles planifiés : suivi des IPÉ et comparaison à la situation énergétique de référence, analyse des consommations des UES et de leurs facteurs pertinents, évaluation de l'efficacité réelle des plans d'actions. Les écarts significatifs de performance énergétique sont identifiés, font l'objet d'alertes et d'une recherche de causes, et les réponses apportées sont documentées. Les résultats sont analysés, comparés aux objectifs et communiqués à la direction et aux équipes concernées pour entretenir la dynamique d'amélioration." },
      { id: 'i50-eval-conformite',   label: "Évaluation de la conformité aux exigences légales (audit énergétique réglementaire, décret tertiaire)", description: "L'organisme identifie les exigences légales et autres exigences applicables à son efficacité, ses usages et sa consommation énergétiques, et évalue périodiquement sa conformité : audit énergétique réglementaire (art. L233-1 du code de l'énergie, dont l'ISO 50001 exempte), décret tertiaire et déclarations OPERAT pour les bâtiments tertiaires, exigences CEE, réglementations des installations classées le cas échéant. Une veille réglementaire structurée permet de détecter les évolutions (directive efficacité énergétique UE 2023/1791) et de mettre à jour les pratiques. Les écarts de conformité font l'objet d'actions correctives tracées et suivies jusqu'à leur clôture." },
      { id: 'i50-eval-audits',       label: "Audits internes du SMÉ", description: "Un programme d'audits internes couvre l'ensemble du système de management de l'énergie à intervalles planifiés, en tenant compte de l'importance des processus, des UES et des résultats des audits précédents. Les audits vérifient à la fois la conformité du SMÉ aux exigences de la norme et l'amélioration effective de la performance énergétique démontrée par les IPÉ. Les auditeurs sont compétents et impartiaux vis-à-vis des activités auditées, les conclusions sont rapportées à la direction et les non-conformités donnent lieu à des actions correctives suivies jusqu'à la vérification de leur efficacité." },
      { id: 'i50-eval-amelioration', label: "Revue de direction et amélioration continue de la performance énergétique démontrée", description: "La direction procède à la revue du SMÉ à intervalles planifiés pour s'assurer qu'il demeure approprié, adapté et efficace : analyse des IPÉ et de l'atteinte des objectifs, résultats d'audits, conformité réglementaire, adéquation des ressources et opportunités d'amélioration. Les décisions de la revue portent sur l'évolution de la politique, des objectifs, des IPÉ et de la SER, ainsi que sur l'allocation des ressources. L'organisme démontre l'amélioration continue de sa performance énergétique — exigence distinctive de l'ISO 50001 par rapport aux autres normes de systèmes de management — et entretient une culture de sobriété et d'efficacité énergétiques." },
    ],
  },
]

export const ISO50001_NIVEAUX = [
  { value: 0, shortLabel: 'NC', label: 'Non traité', description: "Exigence non traitée, aucune démarche engagée sur ce critère",                 pct: 0,    color: '#9ca3af', bg: 'bg-gray-100 dark:bg-gray-700',         text: 'text-gray-600 dark:text-gray-400'   },
  { value: 1, shortLabel: '1',  label: 'Initié',     description: "Premières actions ponctuelles, démarche non structurée",                      pct: 0.25, color: '#ef4444', bg: 'bg-red-50 dark:bg-red-900/20',         text: 'text-red-700 dark:text-red-400'     },
  { value: 2, shortLabel: '2',  label: 'Défini',     description: "Processus défini et documenté, déploiement en cours",                         pct: 0.50, color: '#f97316', bg: 'bg-orange-50 dark:bg-orange-900/20',   text: 'text-orange-700 dark:text-orange-400' },
  { value: 3, shortLabel: '3',  label: 'Maîtrisé',   description: "Pratiques systématiques, mesurées et conformes à la norme",                   pct: 0.75, color: '#eab308', bg: 'bg-yellow-50 dark:bg-yellow-900/20',   text: 'text-yellow-700 dark:text-yellow-400' },
  { value: 4, shortLabel: '4',  label: 'Optimisé',   description: "Amélioration continue de la performance énergétique démontrée par les IPÉ",   pct: 1.0,  color: '#16a34a', bg: 'bg-green-50 dark:bg-green-900/20',     text: 'text-green-700 dark:text-green-400' },
]

const BADGE_LEVELS = [
  { label: 'Performance énergétique exemplaire', min: 85, color: '#ca8a04', icon: '⭐' },
  { label: "Conforme — prêt pour l'audit",       min: 60, color: '#16a34a', icon: '✅' },
  { label: 'En construction',                    min: 30, color: '#f97316', icon: '🔄' },
  { label: 'Non engagé',                         min: 0,  color: '#dc2626', icon: '❌' },
]

export function calculateIso50001Score(niveaux: Record<string, number>): number {
  let total = 0
  for (const axe of ISO50001_AXES) {
    let axeScore = 0
    const nb = axe.criteres.length
    for (const c of axe.criteres) {
      const n = niveaux[c.id] ?? 0
      axeScore += (ISO50001_NIVEAUX[n]?.pct ?? 0) / nb
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
function inputCls() { return 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500' }
function labelCls() { return 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1' }
function btnP(extra = '') { return `px-3 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium transition-colors disabled:opacity-50 ${extra}` }
function btnS(extra = '') { return `px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm transition-colors ${extra}` }

const PRIORITE_COLORS = {
  haute:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  moyenne: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
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
  for (const axe of ISO50001_AXES) {
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
          <span className="text-4xl">⚡</span>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Diagnostic ISO 50001</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Évaluez votre système de management de l&apos;énergie selon ISO 50001:2018</p>
          </div>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          La norme internationale <strong>ISO 50001:2018</strong> « Systèmes de management de l&apos;énergie » aide les
          organismes de toute taille à structurer leur démarche d&apos;efficacité énergétique : revue énergétique, usages
          énergétiques significatifs (UES), indicateurs de performance énergétique (IPÉ) et situation énergétique de
          référence. Son exigence distinctive : <strong>l&apos;amélioration continue de la performance énergétique,
          démontrée par les IPÉ</strong> — au-delà de la simple conformité du système de management.
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          Bâtie sur la <strong>structure HLS</strong> (High Level Structure) commune aux normes ISO de systèmes de
          management, elle s&apos;intègre naturellement avec <strong>ISO 9001</strong> (qualité), <strong>ISO 14001</strong>
          (environnement) et <strong>ISO 45001</strong> (SST) pour construire des systèmes de management intégrés.
          La <strong>certification par tierce partie</strong> s&apos;effectue sur un <strong>cycle de 3 ans</strong> :
          audit initial de certification puis audits de suivi annuels, avant renouvellement.
        </p>
      </div>

      {/* Contexte + référentiels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={card('p-5 border-l-4 border-yellow-600')}>
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">⚡ Le parcours de certification ISO 50001</h3>
          <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
            <div className="flex items-start gap-2">
              <span className="text-yellow-600 font-bold flex-shrink-0">📋</span>
              <span><strong>Diagnostic initial</strong> : évaluation de la maturité du SMÉ sur les exigences de la norme (leadership, revue énergétique et planification, support, réalisation opérationnelle, évaluation et amélioration).</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-yellow-600 font-bold flex-shrink-0">🔍</span>
              <span><strong>Audit de certification</strong> par un organisme accrédité (étape 1 : revue documentaire, étape 2 : audit sur site avec vérification des IPÉ et de l&apos;amélioration de la performance énergétique).</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-yellow-600 font-bold flex-shrink-0">🔄</span>
              <span><strong>Cycle de 3 ans</strong> : audits de suivi annuels puis audit de renouvellement — la démarche s&apos;inscrit dans l&apos;amélioration continue de la performance énergétique.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-yellow-600 font-bold flex-shrink-0">💶</span>
              <span><strong>Aides financières</strong> : CEE bonifiés via la charte, prime PRO-SMEn (jusqu&apos;à 40 000 €) pour la mise en place d&apos;un SMÉ certifié ISO 50001.</span>
            </div>
          </div>
        </div>

        <div className={card('p-5 border-l-4 border-blue-500')}>
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">📋 Référentiels mobilisés</h3>
          <div className="space-y-1">
            {[
              ['⚡', "ISO 50001:2018 — Systèmes de management de l'énergie"],
              ['🔗', 'ISO 9001 / 14001 / 45001 — Structure HLS, systèmes intégrés'],
              ['🔍', 'EN 16247 — Audit énergétique réglementaire (art. L233-1)'],
              ['🏢', 'Décret tertiaire — Éco Énergie Tertiaire (-40/-50/-60 %)'],
              ['🇪🇺', "Directive efficacité énergétique (UE) 2023/1791"],
              ['💶', "CEE — Certificats d'économies d'énergie, prime PRO-SMEn"],
              ['🏛️', 'ISO 26000 — Responsabilité sociétale'],
              ['📋', 'GRI 302 / CSRD ESRS E1 — Reporting énergie et climat'],
              ['🌍', 'ODD 7, 9, 12 et 13 — Nations Unies'],
            ].map(([icon, label]) => (
              <div key={label} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <span>{icon}</span><span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Contexte réglementaire France/UE */}
      <div className={card('p-5 bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800')}>
        <h3 className="font-bold text-yellow-700 dark:text-yellow-400 mb-3">⚖️ Contexte réglementaire France / UE — Pourquoi l&apos;ISO 50001</h3>
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          {[
            "Audit énergétique réglementaire (art. L233-1 du code de l'énergie, directive 2012/27/UE révisée 2023/1791) : obligatoire tous les 4 ans pour les grandes entreprises — exemption pour les organismes certifiés ISO 50001",
            "Décret tertiaire (dispositif Éco Énergie Tertiaire) : réduction des consommations des bâtiments tertiaires > 1 000 m² de -40 % en 2030, -50 % en 2040 et -60 % en 2050, avec déclaration annuelle sur OPERAT",
            "Directive efficacité énergétique (UE) 2023/1791 : renforcement des obligations d'audit énergétique et de systèmes de management de l'énergie selon les seuils de consommation",
            "Aides financières : CEE bonifiés via la charte, prime PRO-SMEn jusqu'à 40 000 € pour la certification ISO 50001",
            "Au-delà de la conformité : l'ISO 50001 structure la réduction des factures d'énergie, des émissions de GES (scopes 1 et 2) et démontre l'engagement de l'organisme envers ses clients et donneurs d'ordre",
          ].map((line, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="font-bold text-yellow-600 flex-shrink-0">•</span>
              <span>{line}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Les 5 axes */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Les 5 axes du diagnostic ISO 50001</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ISO50001_AXES.map(axe => (
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
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Niveaux de maturité ISO 50001</h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {ISO50001_NIVEAUX.map(n => (
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
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Badge de maturité ISO 50001</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {BADGE_LEVELS.map(b => (
            <div key={b.label} className={card('p-4 text-center')}>
              <div className="text-3xl">{b.icon}</div>
              <div className="font-bold text-sm mt-1" style={{ color: b.color }}>{b.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">≥ {b.min}%</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">Seuils : 0-30% Non engagé · 30-60% En construction · 60-85% Conforme — prêt pour l&apos;audit · 85-100% Performance énergétique exemplaire</p>
      </div>

      {/* Comment utiliser */}
      <div className={card('p-5 space-y-3')}>
        <h3 className="font-semibold text-gray-900 dark:text-white">💡 Comment utiliser cette application</h3>
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          {[
            ['1', 'Diagnostic ISO 50001', "Pour chaque critère, évaluez votre niveau de maturité (NC à 4), documentez vos pratiques et créez des actions d'amélioration ciblées."],
            ['2', "Plan d'actions", "Visualisez et gérez toutes vos actions énergie : priorité, responsable, échéance, statut d'avancement."],
            ['3', 'Documents & Preuves', "Uploadez directement dans SharePoint vos preuves documentaires (revue énergétique, politique énergétique, IPÉ et SER, plan de comptage, rapports d'audits) classées par critère."],
            ['4', 'Export Excel', "Générez un rapport Excel structuré avec 6 onglets pour préparer votre audit de certification et alimenter votre reporting RSE."],
          ].map(([num, title, desc]) => (
            <div key={num} className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 flex items-center justify-center text-xs font-bold">{num}</div>
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

  const axeStats = ISO50001_AXES.map(axe => {
    const total = axe.criteres.length
    const niveaux = axe.criteres.map(c => reponses[c.id]?.niveau ?? 0)
    const pct = niveaux.reduce((s, n) => s + (ISO50001_NIVEAUX[n]?.pct ?? 0), 0) / total
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
          <div className="text-xs text-gray-400 mt-1">Seuils : 30% En construction · 60% Conforme — prêt pour l&apos;audit · 85% Performance énergétique exemplaire</div>
        </div>

        {/* Radar */}
        <div className={card('p-4 sm:col-span-2')}>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Radar de maturité ISO 50001 par axe</h3>
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
              <polygon points={dataPolygon} fill="#ca8a0422" stroke="#ca8a04" strokeWidth="2.5" strokeLinejoin="round" />
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
                  const niv = ISO50001_NIVEAUX[n]
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
            <div className="h-2 rounded-full bg-yellow-600 transition-all" style={{ width: `${Math.round(actions.filter(a => a.statut === 'termine').length / actions.length * 100)}%` }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Vue Correspondances ──────────────────────────────────────────────────────

const CORRESPONDANCES_ISO50001 = [
  {
    categorie: "Applications RSE Sens'ethO",
    icon: '🏠',
    color: 'indigo',
    items: [
      {
        ref: 'Bilan GES', icon: '🌍', route: '/rse/bilan-ges',
        desc: "Bilan GES — l'énergie est le premier poste d'émissions de nombreux organismes : les consommations suivies dans le SMÉ alimentent directement les scopes 1 (combustibles) et 2 (électricité, chaleur) du bilan, et les actions d'efficacité énergétique réduisent mécaniquement l'empreinte carbone",
        liens: [
          { axe: 'planification', label: 'Planification', ref: 'Bilan GES — Revue énergétique : données de consommation des scopes 1 et 2' },
          { axe: 'evaluation',    label: 'Évaluation',    ref: 'Bilan GES — Suivi des consommations et des facteurs d’émission associés' },
        ],
      },
      {
        ref: 'ACT Bas-Carbone', icon: '🎯', route: '/rse/act-carbone',
        desc: "ACT Bas-Carbone — la stratégie de décarbonation s'appuie sur la maîtrise de l'énergie : les objectifs et plans d'actions énergétiques du SMÉ constituent un levier majeur de la trajectoire bas-carbone évaluée par la méthodologie ACT",
        liens: [
          { axe: 'leadership',    label: 'Leadership',    ref: 'ACT — Gouvernance et intégration de l’énergie-climat dans la stratégie' },
          { axe: 'planification', label: 'Planification', ref: 'ACT — Objectifs et plans d’actions de réduction des consommations' },
        ],
      },
      {
        ref: 'Diagnostic initial ISO 26000', icon: '⚙️', route: '/rse/iso26000',
        desc: "ISO 26000 — l'utilisation durable des ressources (dont l'énergie) est un domaine d'action central de la question « Environnement » : le diagnostic ISO 50001 approfondit et structure cette dimension",
        liens: [
          { axe: 'leadership', label: 'Leadership', ref: 'ISO 26000 — Gouvernance de l’organisation et redevabilité environnementale' },
          { axe: 'operations', label: 'Opérations', ref: 'ISO 26000 — DA Utilisation durable des ressources : efficacité énergétique' },
        ],
      },
      {
        ref: 'EcoVadis Diagnostic', icon: '🥇', route: '/rse/ecovadis',
        desc: "EcoVadis — le pilier Environnement évalue l'énergie et les GES (politiques, actions, certifications, indicateurs) : la certification ISO 50001 est une preuve majeure valorisée dans la notation",
        liens: [
          { axe: 'leadership', label: 'Leadership', ref: 'EcoVadis — Politique énergie formalisée et endossée par la direction' },
          { axe: 'evaluation', label: 'Évaluation', ref: 'EcoVadis — Indicateurs énergie/GES et couverture de certification' },
        ],
      },
      {
        ref: 'Label Numérique Responsable', icon: '💻', route: '/rse/label-nr',
        desc: "Label NR — l'efficacité énergétique du numérique (hébergement, datacenters, postes de travail) recoupe la maîtrise des UES du SMÉ : PUE des salles serveurs, politique d'achats IT économes, extinction des équipements",
        liens: [
          { axe: 'operations', label: 'Opérations', ref: 'Label NR — Hébergement et datacenters : PUE, efficacité des salles serveurs' },
          { axe: 'support',    label: 'Support',    ref: 'Label NR — Sensibilisation aux écogestes numériques' },
        ],
      },
      {
        ref: 'Diagnostic ISO 45001', icon: '🦺', route: '/rse/iso45001',
        desc: "ISO 45001 — même structure HLS : les processus communs (politique, objectifs, audits internes, revue de direction, maîtrise opérationnelle) peuvent être mutualisés dans un système de management intégré QSE-Énergie",
        liens: [
          { axe: 'leadership', label: 'Leadership', ref: 'HLS art. 5 — Leadership et engagement communs aux normes de SM' },
          { axe: 'evaluation', label: 'Évaluation', ref: 'HLS art. 9-10 — Audits internes et revue de direction mutualisables' },
        ],
      },
    ],
  },
  {
    categorie: 'Référentiels énergie et systèmes de management',
    icon: '⚡',
    color: 'yellow',
    items: [
      {
        ref: 'ISO 14001 — SMI Environnement-Énergie', icon: '🔗', route: null,
        desc: "Structure HLS commune : contexte, leadership, planification, support, réalisation opérationnelle, évaluation des performances, amélioration — l'ISO 50001 se combine naturellement avec l'ISO 14001 dans un système de management intégré environnement-énergie",
        liens: [
          { axe: 'leadership', label: 'Leadership', ref: 'ISO 14001 — Politique et leadership communs (HLS art. 5)' },
          { axe: 'evaluation', label: 'Évaluation', ref: 'ISO 14001 — Audits, conformité et revue de direction mutualisables' },
        ],
      },
      {
        ref: 'Audit énergétique réglementaire — EN 16247', icon: '🔍', route: null,
        desc: "Audit énergétique obligatoire tous les 4 ans pour les grandes entreprises (art. L233-1 du code de l'énergie, directive 2012/27/UE révisée 2023/1791) selon la norme EN 16247 — les organismes certifiés ISO 50001 en sont exemptés",
        liens: [
          { axe: 'planification', label: 'Planification', ref: 'EN 16247 — Revue énergétique : analyse des usages et gisements d’économies' },
          { axe: 'evaluation',    label: 'Évaluation',    ref: 'L233-1 — Exemption d’audit énergétique pour les certifiés ISO 50001' },
        ],
      },
      {
        ref: 'Décret tertiaire — Éco Énergie Tertiaire', icon: '🏢', route: null,
        desc: "Obligation de réduction des consommations des bâtiments tertiaires > 1 000 m² : -40 % en 2030, -50 % en 2040, -60 % en 2050 (déclaration annuelle OPERAT) — le SMÉ structure le suivi des consommations et le plan d'actions pour atteindre ces objectifs",
        liens: [
          { axe: 'planification', label: 'Planification', ref: 'Décret tertiaire — Objectifs de réduction et trajectoire des bâtiments' },
          { axe: 'evaluation',    label: 'Évaluation',    ref: 'OPERAT — Déclaration annuelle et suivi de la conformité' },
        ],
      },
      {
        ref: 'Directive efficacité énergétique (UE) 2023/1791', icon: '🇪🇺', route: null,
        desc: "Révision de la directive 2012/27/UE : renforcement des obligations d'audit énergétique et de mise en place de systèmes de management de l'énergie selon les seuils de consommation — l'ISO 50001 devient la réponse de référence pour les gros consommateurs",
        liens: [
          { axe: 'leadership', label: 'Leadership', ref: 'UE 2023/1791 — Obligation de SMÉ pour les consommateurs > 85 TJ/an' },
          { axe: 'evaluation', label: 'Évaluation', ref: 'UE 2023/1791 — Audits énergétiques obligatoires selon les seuils' },
        ],
      },
      {
        ref: 'CEE & PRO-SMEn', icon: '💶', route: null,
        desc: "Certificats d'économies d'énergie : financement des actions d'efficacité énergétique (CEE bonifiés via la charte) et prime PRO-SMEn jusqu'à 40 000 € pour la mise en place d'un SMÉ certifié ISO 50001",
        liens: [
          { axe: 'operations', label: 'Opérations', ref: 'CEE — Financement des actions d’efficacité énergétique du plan d’actions' },
          { axe: 'leadership', label: 'Leadership', ref: 'PRO-SMEn — Prime à la certification ISO 50001 (jusqu’à 40 000 €)' },
        ],
      },
    ],
  },
  {
    categorie: 'Standards de reporting et référentiels généralistes',
    icon: '📐',
    color: 'blue',
    items: [
      {
        ref: 'ISO 26000', icon: '🏛️', route: null,
        desc: "ISO 26000 — lignes directrices de la responsabilité sociétale : l'utilisation durable des ressources et l'atténuation du changement climatique sont des domaines d'action de la question centrale « Environnement »",
        liens: [
          { axe: 'leadership', label: 'Leadership', ref: 'ISO 26000 — Gouvernance et redevabilité environnementale' },
          { axe: 'operations', label: 'Opérations', ref: 'ISO 26000 — Utilisation durable des ressources : énergie' },
        ],
      },
      {
        ref: 'CSRD — ESRS E1', icon: '📜', route: null,
        desc: "CSRD/ESRS — le standard E1 « Changement climatique » exige le reporting de la consommation d'énergie et du mix énergétique (E1-5), des plans de transition et des objectifs de réduction : le SMÉ fournit des données fiables et auditées",
        liens: [
          { axe: 'evaluation',    label: 'Évaluation',    ref: 'ESRS E1-5 — Consommation d’énergie, mix énergétique et intensité' },
          { axe: 'planification', label: 'Planification', ref: 'ESRS E1 — Objectifs de réduction et plan de transition climatique' },
        ],
      },
      {
        ref: 'GRI 302 — Énergie', icon: '📋', route: null,
        desc: "GRI 302 — standard dédié à l'énergie : consommation au sein de l'organisation (302-1) et en dehors (302-2), intensité énergétique (302-3), réduction de la consommation (302-4) et des besoins énergétiques des produits et services (302-5)",
        liens: [
          { axe: 'planification', label: 'Planification', ref: 'GRI 302-3 — Intensité énergétique : équivalent des IPÉ du SMÉ' },
          { axe: 'evaluation',    label: 'Évaluation',    ref: 'GRI 302-4 — Réduction de la consommation d’énergie démontrée' },
        ],
      },
      {
        ref: 'ODD 7, 9, 12 et 13 — Nations Unies', icon: '🌍', route: null,
        desc: "Objectifs de Développement Durable — ODD 7 (énergie propre et d'un coût abordable, cible 7.3 : doubler le taux d'amélioration de l'efficacité énergétique), ODD 9 (industrie durable), ODD 12 (consommation responsable) et ODD 13 (lutte contre le changement climatique)",
        liens: [
          { axe: 'leadership', label: 'Leadership', ref: 'ODD 7.3 — Amélioration de l’efficacité énergétique mondiale' },
          { axe: 'operations', label: 'Opérations', ref: 'ODD 12 — Modes de consommation et de production durables' },
        ],
      },
    ],
  },
]

const AXE_BADGE_CLS: Record<string, string> = {
  leadership:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  planification: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  support:       'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  operations:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  evaluation:    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
}

function CorrespondancesView() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className={card('p-4')}>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          La démarche ISO 50001 s&apos;articule avec l&apos;ensemble de votre démarche RSE.
          Les correspondances ci-dessous permettent de mutualiser vos efforts entre la norme ISO 50001,
          les systèmes de management intégrés (ISO 9001, ISO 14001, ISO 45001), l&apos;audit énergétique
          réglementaire EN 16247, le décret tertiaire, la CSRD/ESRS E1, le GRI 302, les ODD
          et les dispositifs CEE/PRO-SMEn.
        </p>
      </div>

      {CORRESPONDANCES_ISO50001.map(cat => (
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
                          const axe = ISO50001_AXES.find(a => a.id === l.axe)
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

  const members = useDiagnosticMembers('iso50001', diagnosticId)

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
    const res = await fetch(`/api/iso50001/${diagnosticId}/actions`, {
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
    await fetch(`/api/iso50001/${diagnosticId}/actions?action_id=${id}`, { method: 'DELETE' })
    onActionsChange(actions.filter(a => a.id !== id))
  }

  async function saveEdit(id: string) {
    setSavingEdit(true)
    const res = await fetch(`/api/iso50001/${diagnosticId}/actions?action_id=${id}`, {
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
    const res = await fetch(`/api/iso50001/${diagnosticId}/actions?action_id=${action.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: next }),
    })
    if (res.ok) {
      const { data } = await res.json()
      onActionsChange(actions.map(a => a.id === action.id ? data : a))
    }
  }

  const niv = ISO50001_NIVEAUX[niveau]

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
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">Niveau de maturité ISO 50001</div>
          {savingReponse && <span className="text-xs text-gray-400 animate-pulse">Enregistrement…</span>}
          {savedOk && !savingReponse && <span className="text-xs text-green-600 dark:text-green-400">✓ Sauvegardé</span>}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {ISO50001_NIVEAUX.map(n => (
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
        <p className="text-xs text-gray-500 dark:text-gray-400">Décrivez vos pratiques actuelles, les preuves disponibles pour l&apos;audit (revue énergétique, politique énergétique, IPÉ, plan de comptage) et les points d&apos;amélioration identifiés.</p>
        <textarea
          value={commentaire}
          onChange={e => handleCommentaireChange(e.target.value)}
          rows={4}
          placeholder="Ex : Revue énergétique mise à jour en janvier 2026. Référent énergie nommé, sous-comptage des UES déployé. Consommation au m² en baisse de 8%…"
          className={`${inputCls()} resize-y`}
        />
        <GuidedActionNotePanel
          diagnosticId={diagnosticId}
          actionKey={critere.id}
          apiBase="/api/iso50001"
          noteTable="iso50001_notes"
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
            🎯 Actions énergie
            {critereActions.length > 0 && (
              <span className="ml-2 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded-full font-medium">
                {critereActions.filter(a => a.statut === 'termine').length}/{critereActions.length}
              </span>
            )}
          </div>
          <button onClick={() => setShowActionForm(v => !v)} className={btnP('text-xs py-1.5')}>+ Action</button>
        </div>

        {showActionForm && (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 space-y-2 border border-gray-200 dark:border-gray-700">
            <div><label className={labelCls()}>Titre *</label>
              <input className={inputCls()} value={actionForm.titre} onChange={e => setActionForm(f => ({ ...f, titre: e.target.value }))} placeholder="Ex : Mettre en place le sous-comptage des usages énergétiques significatifs" />
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
          <p className="text-xs text-gray-400 text-center py-3">Aucune action — créez des mesures concrètes pour améliorer votre performance énergétique et progresser vers la conformité ISO 50001</p>
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
                        apiBase="/api/iso50001"
                        noteTable="iso50001_notes"
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
  const [activeAxe, setActiveAxe] = useState(ISO50001_AXES[0].id)
  const [activeCritere, setActiveCritere] = useState<string | null>(ISO50001_AXES[0].criteres[0].id)

  const niveaux: Record<string, number> = {}
  for (const [k, v] of Object.entries(reponses)) niveaux[k] = v.niveau
  const scoreGlobal = calculateIso50001Score(niveaux)
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
            {ISO50001_AXES.map(axe => {
              const axeNiveaux = axe.criteres.map(c => niveaux[c.id] ?? 0)
              const axePct = Math.round(axeNiveaux.reduce((s, n) => s + ISO50001_NIVEAUX[n].pct, 0) / axe.criteres.length * 100)
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
            {ISO50001_AXES.map(axe => {
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
                        const niv = ISO50001_NIVEAUX[n]
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
            const axe = ISO50001_AXES.find(a => a.criteres.some(c => c.id === activeCritere))!
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

// Helpers d'échéance (fr-FR + alertes retard / bientôt)
const PRIORITE_RANK: Record<Action['priorite'], number> = { haute: 0, moyenne: 1, basse: 2 }
const STATUT_RANK: Record<Action['statut'], number> = { a_faire: 0, en_cours: 1, termine: 2 }

function axeOf(critereId: string) {
  return ISO50001_AXES.find(x => x.criteres.some(c => c.id === critereId))
}

function echeanceInfo(a: Action): { kind: 'retard' | 'bientot' | 'normal' | 'none'; label: string; cls: string } {
  if (!a.echeance) return { kind: 'none', label: '', cls: '' }
  const d = new Date(a.echeance)
  if (isNaN(d.getTime())) return { kind: 'none', label: a.echeance, cls: '' }
  const fr = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  if (a.statut === 'termine') return { kind: 'normal', label: fr, cls: 'text-gray-400' }
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diffDays = Math.ceil((d.getTime() - today.getTime()) / 86400000)
  if (diffDays < 0) return { kind: 'retard', label: fr, cls: 'text-red-600 dark:text-red-400 font-semibold' }
  if (diffDays < 7) return { kind: 'bientot', label: fr, cls: 'text-orange-600 dark:text-orange-400 font-medium' }
  return { kind: 'normal', label: fr, cls: 'text-gray-400' }
}

type SortKey = 'priorite' | 'echeance' | 'statut' | 'axe'

function ActionsView({ diagnostic, actions, onActionsChange }: { diagnostic: DiagnosticData; actions: Action[]; onActionsChange: (a: Action[]) => void }) {
  const [filterAxe, setFilterAxe] = useState<string>('all')
  const [filterPriorite, setFilterPriorite] = useState<string>('all')
  const [filterStatut, setFilterStatut] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('priorite')
  const [editId, setEditId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<Action>>({})
  const [saving, setSaving] = useState(false)
  const [collapsedAxes, setCollapsedAxes] = useState<Record<string, boolean>>({})
  const members = useDiagnosticMembers('iso50001', diagnostic.id)

  const filtered = actions.filter(a => {
    const axe = axeOf(a.critere_id)
    if (filterAxe !== 'all' && axe?.id !== filterAxe) return false
    if (filterPriorite !== 'all' && a.priorite !== filterPriorite) return false
    if (filterStatut !== 'all' && a.statut !== filterStatut) return false
    return true
  })

  const total = actions.length
  const termines = actions.filter(a => a.statut === 'termine').length
  const aFaire = actions.filter(a => a.statut === 'a_faire').length
  const enCours = actions.filter(a => a.statut === 'en_cours').length
  const enRetard = actions.filter(a => echeanceInfo(a).kind === 'retard').length

  // Tri commun (appliqué à l'intérieur de chaque groupe d'axe)
  function sortActions(list: Action[]): Action[] {
    const arr = [...list]
    const byEcheance = (a: Action) => (a.echeance ? new Date(a.echeance).getTime() : Number.POSITIVE_INFINITY)
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'echeance': return byEcheance(a) - byEcheance(b)
        case 'statut': return STATUT_RANK[a.statut] - STATUT_RANK[b.statut]
        case 'axe': {
          const ia = ISO50001_AXES.findIndex(x => x.id === axeOf(a.critere_id)?.id)
          const ib = ISO50001_AXES.findIndex(x => x.id === axeOf(b.critere_id)?.id)
          return ia - ib
        }
        case 'priorite':
        default:
          // priorité haute puis échéance la plus proche
          if (PRIORITE_RANK[a.priorite] !== PRIORITE_RANK[b.priorite]) return PRIORITE_RANK[a.priorite] - PRIORITE_RANK[b.priorite]
          return byEcheance(a) - byEcheance(b)
      }
    })
    return arr
  }

  // Regroupement par axe (ordre des axes), chaque groupe trié
  const groups = ISO50001_AXES
    .map(axe => ({ axe, items: sortActions(filtered.filter(a => axeOf(a.critere_id)?.id === axe.id)) }))
    .filter(g => g.items.length > 0)

  async function saveEdit(id: string) {
    setSaving(true)
    const res = await fetch(`/api/iso50001/${diagnostic.id}/actions?action_id=${id}`, {
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
    const res = await fetch(`/api/iso50001/${diagnostic.id}/actions?action_id=${action.id}`, {
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
    await fetch(`/api/iso50001/${diagnostic.id}/actions?action_id=${id}`, { method: 'DELETE' })
    onActionsChange(actions.filter(a => a.id !== id))
  }

  return (
    <div className="space-y-4">
      {/* Barre de progression globale */}
      <div className={card('p-4')}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">Avancement du plan d&apos;actions</div>
          <div className="text-sm font-bold text-green-600 dark:text-green-400">{total ? Math.round(termines / total * 100) : 0}%</div>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
          <div className="h-2.5 rounded-full bg-green-500 transition-all duration-500" style={{ width: `${total ? Math.round(termines / total * 100) : 0}%` }} />
        </div>
        <div className="text-xs text-gray-400 mt-1">{termines} terminée{termines !== 1 ? 's' : ''} sur {total}</div>
      </div>

      {/* Compteurs enrichis */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total',     value: total,    color: 'text-gray-700 dark:text-gray-300' },
          { label: 'À faire',   value: aFaire,   color: 'text-gray-600 dark:text-gray-400' },
          { label: 'En cours',  value: enCours,  color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Terminées', value: termines, color: 'text-green-600 dark:text-green-400' },
          { label: 'En retard', value: enRetard, color: 'text-red-600 dark:text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className={card('p-3 text-center')}>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Filtres + Tri */}
      <div className="flex flex-wrap gap-2">
        <select value={filterAxe} onChange={e => setFilterAxe(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 dark:bg-gray-700 dark:text-white focus:outline-none">
          <option value="all">Tous les axes</option>
          {ISO50001_AXES.map(a => <option key={a.id} value={a.id}>{a.icon} {a.label}</option>)}
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
        <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 dark:bg-gray-700 dark:text-white focus:outline-none">
          <option value="priorite">↕ Tri : priorité + échéance</option>
          <option value="echeance">↕ Tri : échéance</option>
          <option value="statut">↕ Tri : statut</option>
          <option value="axe">↕ Tri : axe</option>
        </select>
        <div className="text-xs text-gray-400 flex items-center">{filtered.length} action{filtered.length !== 1 ? 's' : ''}</div>
      </div>

      {/* Liste regroupée par axe */}
      {filtered.length === 0 && (
        <div className={card('p-8 text-center')}>
          <p className="text-gray-400 text-sm">Aucune action — créez-en depuis la vue Diagnostic, critère par critère</p>
        </div>
      )}

      <div className="space-y-4">
        {groups.map(({ axe, items }) => {
          const grpTermines = items.filter(a => a.statut === 'termine').length
          const collapsed = collapsedAxes[axe.id]
          return (
            <div key={axe.id} className="space-y-2">
              {/* En-tête d'axe repliable */}
              <button
                onClick={() => setCollapsedAxes(prev => ({ ...prev, [axe.id]: !prev[axe.id] }))}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left"
                style={{ background: axe.colorLight }}
              >
                <span className="text-base">{axe.icon}</span>
                <span className="text-sm font-semibold flex-1" style={{ color: axe.color }}>{axe.label}</span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/70 dark:bg-gray-800/70" style={{ color: axe.color }}>
                  {grpTermines}/{items.length} terminées
                </span>
                <span className="text-xs" style={{ color: axe.color }}>{collapsed ? '›' : '▾'}</span>
              </button>

              {!collapsed && items.map(a => {
                const isEditing = editId === a.id
                const ech = echeanceInfo(a)
                const incomplete = !a.responsable && !a.echeance
                return (
                  <div key={a.id} className={`${card('p-4')}${incomplete ? ' ring-1 ring-amber-300 dark:ring-amber-500/40' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5 text-base">{axe.icon}</div>
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
                              {/* Toggle statut en un clic */}
                              <button onClick={() => toggleStatut(a)} title="Changer le statut (clic)"
                                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium hover:ring-2 hover:ring-offset-1 hover:ring-yellow-300 transition ${STATUT_COLORS[a.statut]}`}>
                                {STATUT_LABELS[a.statut]}
                              </button>
                              <span className="text-[10px] text-gray-400">{critereLabel(a.critere_id)}</span>
                              {ech.kind !== 'none' && (
                                <span className={`text-[10px] ${ech.cls}`}>📅 {ech.label}
                                  {ech.kind === 'retard' && <span className="ml-1 px-1 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 font-semibold">En retard</span>}
                                  {ech.kind === 'bientot' && <span className="ml-1 px-1 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 font-medium">Bientôt</span>}
                                </span>
                              )}
                              {a.responsable && <span className="text-[10px] text-gray-400">👤 {a.responsable}</span>}
                              {incomplete && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">⚠ À compléter</span>}
                            </div>
                          </>
                        )}
                      </div>
                      {!isEditing && (
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => { setEditId(a.id); setEditData({}) }} className="text-xs text-gray-400 hover:text-blue-500 px-1" title="Modifier">✏️</button>
                          <button onClick={() => setActionToDelete(a.id)} className="text-xs text-gray-400 hover:text-red-500 px-1" title="Supprimer">✕</button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
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
  { id: 'presentation',    label: 'Présentation',         icon: '📋' },
  { id: 'dashboard',       label: 'Tableau de bord',      icon: '📊' },
  { id: 'diagnostic',      label: 'Diagnostic ISO 50001', icon: '⚡' },
  { id: 'actions',         label: "Plan d'actions",       icon: '📝' },
  { id: 'correspondances', label: 'Correspondances',      icon: '🔗' },
]

export default function Iso50001DiagnosticApp({ ctx }: { ctx: RseContext }) {
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
  const [pdfData, setPdfData] = useState<Iso50001PdfData | null>(null)
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
      const res = await fetch(`/api/iso50001?org_id=${org.id}&annee=${year}`)
      const { data: existingDiag } = await res.json()

      let diagId = existingDiag?.id
      if (!diagId) {
        setInitializing(true)
        const createRes = await fetch('/api/iso50001', {
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
        fetch(`/api/iso50001/${diagId}/reponses`),
        fetch(`/api/iso50001/${diagId}/actions`),
        fetch(`/api/iso50001/${diagId}/notes`),
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
    await fetch(`/api/iso50001/${diagnostic.id}/reponses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ critere_id, niveau, commentaire }),
    })
    setTimeout(async () => {
      setReponses(current => {
        const n2: Record<string, number> = {}
        for (const [k, v] of Object.entries(current)) n2[k] = v.niveau
        const score = calculateIso50001Score(n2)
        if (diagnostic) {
          fetch(`/api/iso50001/${diagnostic.id}`, {
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
    fetch(`/api/iso50001/${diagnostic.id}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_key: critere_id, content }),
    }).catch(e => console.error('[iso50001/notes]', e))
  }

  function handleNoteSectionsChange(critere_id: string, sections: NoteSection[]) {
    setNoteSections(prev => ({ ...prev, [critere_id]: sections }))
    if (!diagnostic) return
    fetch(`/api/iso50001/${diagnostic.id}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_key: critere_id, sections }),
    }).catch(e => console.error('[iso50001/notes/sections]', e))
  }

  async function handleExportExcel() {
    if (!diagnostic) return
    setExportingExcel(true)
    try {
      const res = await fetch(`/api/iso50001/${diagnostic.id}/export-excel`)
      if (!res.ok) throw new Error('Échec export')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `ISO50001_${org?.denomination ?? 'diagnostic'}_${year}.xlsx`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { alert('Erreur export Excel : ' + String(e)) }
    finally { setExportingExcel(false) }
  }

  function buildPdfData(): Iso50001PdfData {
    const niveaux: Record<string, number> = {}
    const commentaires: Record<string, string> = {}
    for (const [k, v] of Object.entries(reponses)) {
      niveaux[k] = v.niveau
      if (v.commentaire) commentaires[k] = v.commentaire
    }
    const scoreValue = diagnostic?.score_global ?? calculateIso50001Score(niveaux)
    const b = getBadge(scoreValue)
    return {
      organisation: org?.denomination ?? null,
      siren: org?.siren ?? null,
      ville: org?.ville ?? null,
      year,
      date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
      scoreLabel: 'Score de maturité ISO 50001',
      scoreValue,
      badge: { label: b.label, emoji: b.icon, color: b.color },
      axes: ISO50001_AXES,
      niveaux: ISO50001_NIVEAUX,
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
        if (document.querySelector('#iso50001-pdf-root [data-pdf-page]')) { resolve(); return }
        const observer = new MutationObserver(() => {
          if (document.querySelector('#iso50001-pdf-root [data-pdf-page]')) {
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
      await exportReport('iso50001-pdf-root', `Diagnostic-ISO-50001-${orgSlug}-${year}.pdf`)
    } catch (e) {
      console.error('[iso50001/exportPDF]', e)
    } finally {
      setExportingPDF(false)
      setPdfData(null)
    }
  }

  const loadShares = useCallback(async () => {
    if (!diagnostic) return
    try {
      const res = await fetch(`/api/iso50001/${diagnostic.id}/shares`)
      const { data } = await res.json()
      setShareList(data ?? [])
    } catch { /* ignore */ }
  }, [diagnostic])

  useEffect(() => { if (showShare) loadShares() }, [showShare, loadShares])

  async function handleAddShare() {
    if (!diagnostic || !shareEmail.trim()) return
    setShareSaving(true); setShareError('')
    try {
      const res = await fetch(`/api/iso50001/${diagnostic.id}/shares`, {
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
    } catch {
      setShareError('Erreur de partage')
    } finally { setShareSaving(false) }
  }

  async function handleRemoveShare(shareId: string) {
    if (!diagnostic) return
    try {
      await fetch(`/api/iso50001/${diagnostic.id}/shares?shareId=${shareId}`, { method: 'DELETE' })
      await loadShares()
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-medium transition-colors">
          👥 Partager
        </button>
      </div>
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnostic, exportingExcel, exportingPDF])

  const lockedTabs = !org || !diagnostic ? ['dashboard', 'diagnostic', 'actions'] : []

  if (loading && !diagnostic) {
    return <div className="flex justify-center items-center py-20 text-gray-400 text-sm animate-pulse">
      {initializing ? 'Initialisation du diagnostic ISO 50001…' : 'Chargement…'}
    </div>
  }

  return (
    <div className="space-y-4">

      {/* ── Rapport PDF (monté hors-écran le temps de l'export) ─────────────── */}
      {pdfData && (
        <div style={{ position: 'absolute', left: -9999, top: 0 }} aria-hidden="true">
          <Iso50001PDFReport id="iso50001-pdf-root" data={pdfData} />
        </div>
      )}

      {/* ── Modale Partage ──────────────────────────────────────────────────── */}
      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowShare(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-bold text-gray-900 dark:text-white">👥 Partager le diagnostic ISO 50001</h2>
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
          <span>Score de maturité ISO 50001 :</span>
          <span className="font-bold text-gray-900 dark:text-white">{diagnostic.score_global ?? calculateIso50001Score(Object.fromEntries(Object.entries(reponses).map(([k, v]) => [k, v.niveau])))}/100</span>
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
                view === v.id ? 'border-yellow-600 text-yellow-600 dark:text-yellow-400'
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
          score={diagnostic.score_global ?? calculateIso50001Score(Object.fromEntries(Object.entries(reponses).map(([k, v]) => [k, v.niveau])))}
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

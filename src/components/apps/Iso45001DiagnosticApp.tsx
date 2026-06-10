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

// ─── Données statiques Diagnostic ISO 45001 ──────────────────────────────────

export const ISO45001_AXES = [
  {
    id: 'leadership', label: 'Leadership & Participation des travailleurs', icon: '🧭',
    color: '#ea580c', colorLight: '#ffedd5', weight: 0.20,
    description: "Engagement de la direction, politique SST, rôles et responsabilités, consultation et participation des travailleurs (art. 5).",
    criteres: [
      { id: 'i45-lead-engagement',    label: 'Engagement et redevabilité de la direction en matière de SST', description: "La direction assume la responsabilité globale et la redevabilité de la prévention des accidents du travail et des maladies professionnelles. Elle démontre son leadership de façon visible : présence sur le terrain, allocation des moyens, intégration de la SST dans la stratégie et les processus d'affaires. La performance SST est portée au plus haut niveau et fait partie des critères de décision au même titre que la qualité ou les coûts." },
      { id: 'i45-lead-politique',     label: "Politique SST formalisée, communiquée et adaptée à l'organisme", description: "Une politique de santé et de sécurité au travail est formalisée, signée par la direction et adaptée à la finalité, à la taille et au contexte de l'organisme ainsi qu'à la nature de ses risques. Elle inclut les engagements requis par la norme : fournir des conditions de travail sûres et saines, satisfaire aux exigences légales, éliminer les dangers et réduire les risques, améliorer en continu et consulter les travailleurs. Elle est communiquée à l'ensemble du personnel et tenue à disposition des parties intéressées." },
      { id: 'i45-lead-roles',         label: 'Rôles, responsabilités et autorités SST définis à tous les niveaux', description: "Les rôles, responsabilités et autorités en matière de SST sont attribués, documentés et communiqués à tous les niveaux de l'organisme : direction, encadrement, fonctions support et opérateurs. Chaque manager connaît son périmètre de responsabilité sécurité et dispose de l'autorité et des moyens pour l'exercer. Les délégations de pouvoir sont formalisées et la chaîne de responsabilité est claire, y compris pour les sites multiples ou le travail à distance." },
      { id: 'i45-lead-participation', label: 'Consultation et participation des travailleurs (CSE, représentants, remontées terrain)', description: "Les travailleurs et leurs représentants (CSE, CSSCT, représentants de proximité) sont consultés et participent activement au développement, à la planification, à la mise en œuvre et à l'évaluation du système de management SST. Des processus concrets permettent la remontée des situations dangereuses et des suggestions d'amélioration depuis le terrain, sans crainte de représailles. La participation des travailleurs non encadrants est particulièrement recherchée, conformément à l'exigence distinctive de l'ISO 45001." },
    ],
  },
  {
    id: 'planification', label: 'Planification & Maîtrise des risques', icon: '📋',
    color: '#dc2626', colorLight: '#fee2e2', weight: 0.20,
    description: "Identification des dangers, évaluation des risques (DUERP), opportunités, exigences légales, objectifs SST (art. 6).",
    criteres: [
      { id: 'i45-plan-dangers',     label: 'Identification des dangers et évaluation des risques professionnels (DUERP à jour)', description: "Un processus systématique et proactif d'identification des dangers est en place : il couvre les activités routinières et non routinières, les facteurs humains et organisationnels, les situations d'urgence et les personnes ayant accès au lieu de travail. Les risques professionnels sont évalués selon une méthodologie définie et hiérarchisés, et le Document Unique d'Évaluation des Risques Professionnels (DUERP) est à jour, accessible et accompagné de son plan d'actions de prévention. Les risques psychosociaux, ergonomiques et chimiques sont intégrés à l'évaluation au même titre que les risques physiques." },
      { id: 'i45-plan-legal',       label: 'Veille et conformité aux exigences légales et réglementaires SST', description: "L'organisme a identifié l'ensemble des exigences légales et autres exigences applicables à ses activités en matière de SST : code du travail, décrets, arrêtés, normes, exigences clients et conventions collectives. Une veille réglementaire structurée permet de détecter les évolutions et de mettre à jour les pratiques en conséquence. La conformité est évaluée périodiquement et les écarts font l'objet d'actions correctives tracées (vérifications périodiques, habilitations, contrôles obligatoires)." },
      { id: 'i45-plan-objectifs',   label: 'Objectifs SST mesurables et planification des actions pour les atteindre', description: "Des objectifs SST mesurables sont établis aux fonctions et niveaux pertinents, en cohérence avec la politique SST, les résultats de l'évaluation des risques et la consultation des travailleurs. Chaque objectif est décliné en plan d'actions précisant les responsabilités, les ressources, les échéances et les indicateurs de suivi. L'avancement est revu périodiquement et les objectifs sont actualisés en fonction des résultats et des évolutions du contexte." },
      { id: 'i45-plan-changements', label: 'Maîtrise des risques liés aux changements (organisationnels, techniques, humains)', description: "Les changements planifiés — nouveaux équipements, nouveaux procédés, réorganisations, évolutions d'effectifs ou de conditions de travail — font l'objet d'une analyse préalable de leurs impacts sur la santé et la sécurité. Le processus de management du changement associe les travailleurs concernés et prévoit la mise à jour de l'évaluation des risques, des formations et des consignes avant la mise en œuvre. Les conséquences des changements imprévus sont examinées et des mesures d'atténuation sont prises si nécessaire." },
    ],
  },
  {
    id: 'support', label: 'Support & Ressources', icon: '🛠️',
    color: '#2563eb', colorLight: '#dbeafe', weight: 0.20,
    description: "Ressources, compétences, sensibilisation, communication, informations documentées (art. 7).",
    criteres: [
      { id: 'i45-sup-ressources',      label: 'Ressources humaines, techniques et financières allouées à la SST', description: "L'organisme détermine et fournit les ressources nécessaires à l'établissement, à la mise en œuvre, à la tenue à jour et à l'amélioration continue du système de management SST. Cela couvre les moyens humains (préventeur, animateur sécurité, services de santé au travail), les moyens techniques (équipements de protection, matériel conforme, aménagements ergonomiques) et les budgets dédiés à la prévention. L'adéquation des ressources est réexaminée lors des revues de direction." },
      { id: 'i45-sup-competences',     label: 'Compétences, formations et habilitations SST (accueil sécurité, recyclages)', description: "Les compétences nécessaires pour travailler en sécurité sont identifiées pour chaque poste et les travailleurs sont formés en conséquence : accueil sécurité des nouveaux arrivants et intérimaires, formations réglementaires (CACES, habilitations électriques, travail en hauteur, gestes et postures), recyclages planifiés. Un plan de formation SST est suivi et les habilitations sont gérées avec leurs dates de validité. L'efficacité des formations est évaluée et les besoins sont actualisés au regard des risques et des évolutions de postes." },
      { id: 'i45-sup-sensibilisation', label: 'Sensibilisation et culture sécurité (causeries, minutes sécurité, remontée des presqu’accidents)', description: "Au-delà des formations obligatoires, l'organisme développe une véritable culture sécurité partagée : causeries et minutes sécurité régulières, campagnes de sensibilisation, partage des retours d'expérience et des bonnes pratiques. Les travailleurs sont sensibilisés aux dangers de leur poste, aux conséquences d'un écart aux consignes et à leur droit de retrait face à un danger grave et imminent. La remontée des presqu'accidents et des situations dangereuses est encouragée et valorisée comme source d'apprentissage, jamais sanctionnée." },
      { id: 'i45-sup-documentation',   label: 'Informations documentées du système SST (procédures, consignes, traçabilité)', description: "Les informations documentées exigées par la norme et nécessaires à l'efficacité du système SST sont créées, mises à jour et maîtrisées : procédures, modes opératoires, consignes de sécurité aux postes, fiches de données de sécurité, registres et enregistrements. La documentation est accessible aux personnes qui en ont besoin, dans un format compréhensible, et protégée contre les modifications non autorisées. La traçabilité des vérifications, formations, contrôles et événements est assurée pour démontrer la conformité lors des audits." },
    ],
  },
  {
    id: 'operations', label: 'Réalisation opérationnelle', icon: '⚙️',
    color: '#16a34a', colorLight: '#dcfce7', weight: 0.20,
    description: "Maîtrise opérationnelle, hiérarchie des moyens de prévention, achats/sous-traitance, préparation aux urgences (art. 8).",
    criteres: [
      { id: 'i45-ope-prevention',  label: 'Maîtrise opérationnelle selon la hiérarchie de prévention (élimination → EPI)', description: "Les mesures de prévention sont définies et mises en œuvre selon la hiérarchie des moyens de maîtrise de l'ISO 45001 : élimination du danger, substitution par des procédés moins dangereux, mesures de protection collective et contrôles techniques, mesures organisationnelles et administratives, et en dernier recours équipements de protection individuelle. Les activités à risques particuliers (travaux en hauteur, espaces confinés, consignations, permis de feu) sont encadrées par des autorisations et des procédures spécifiques. L'application effective des mesures est vérifiée sur le terrain par des visites et observations de sécurité." },
      { id: 'i45-ope-entreprises', label: 'Coordination avec les entreprises extérieures et sous-traitants (plans de prévention, protocoles)', description: "Les risques liés à la coactivité avec les entreprises extérieures sont identifiés et maîtrisés : plans de prévention pour les interventions, protocoles de sécurité pour les opérations de chargement-déchargement, permis de travail le cas échéant. Les sous-traitants et prestataires sont sélectionnés aussi sur leurs performances SST, informés des dangers du site et accueillis en sécurité avant intervention. La coordination est suivie dans la durée : visites communes, audits des interventions et retour d'expérience partagé." },
      { id: 'i45-ope-achats',      label: 'Intégration de la SST dans les achats (équipements, produits, prestations)', description: "Le processus d'achat intègre des critères de santé-sécurité en amont : conformité des équipements de travail et machines (marquage CE, notices), choix de produits chimiques moins dangereux avec leurs fiches de données de sécurité, exigences SST dans les cahiers des charges des prestations. Les nouveaux équipements et produits sont évalués avant leur mise en service et les utilisateurs sont formés à leur usage en sécurité. Cette approche évite d'introduire de nouveaux dangers dans l'organisme et garantit la cohérence du système SST sur toute la chaîne d'approvisionnement." },
      { id: 'i45-ope-urgences',    label: "Préparation et réponse aux situations d'urgence (incendie, secours, exercices)", description: "Les situations d'urgence potentielles sont identifiées (incendie, accident grave, fuite de produit, malaise, intrusion) et des plans de réponse sont établis et tenus à jour : consignes d'évacuation, points de rassemblement, moyens d'extinction et de secours vérifiés, sauveteurs secouristes du travail formés en nombre suffisant. Des exercices périodiques (évacuation, simulation d'accident) testent l'efficacité des dispositifs et les enseignements sont intégrés. L'information des travailleurs, des visiteurs et des entreprises extérieures sur la conduite à tenir est assurée." },
    ],
  },
  {
    id: 'evaluation', label: 'Évaluation & Amélioration', icon: '📈',
    color: '#9333ea', colorLight: '#f3e8ff', weight: 0.20,
    description: "Surveillance et mesure, audits internes, revue de direction, événements indésirables, amélioration continue (art. 9-10).",
    criteres: [
      { id: 'i45-eval-indicateurs',  label: 'Surveillance, mesure et analyse de la performance SST (TF, TG, indicateurs proactifs)', description: "La performance SST est surveillée et mesurée à l'aide d'indicateurs réactifs (taux de fréquence TF, taux de gravité TG, nombre d'accidents avec et sans arrêt, maladies professionnelles) et proactifs (visites de sécurité réalisées, presqu'accidents remontés, taux de réalisation du plan d'actions, formations effectuées). Les résultats sont analysés, comparés aux objectifs et communiqués aux travailleurs et à la direction. Les équipements de mesure et de surveillance (métrologie, contrôles d'ambiance) sont étalonnés et entretenus lorsque nécessaire." },
      { id: 'i45-eval-audits',       label: 'Audits internes du système de management SST', description: "Un programme d'audits internes couvre l'ensemble du système de management SST à intervalles planifiés, en tenant compte de l'importance des processus et des résultats des audits précédents. Les auditeurs sont compétents et impartiaux vis-à-vis des activités auditées, et les conclusions sont rapportées à l'encadrement concerné et aux représentants des travailleurs. Les non-conformités détectées donnent lieu à des actions correctives suivies jusqu'à leur clôture et à la vérification de leur efficacité." },
      { id: 'i45-eval-evenements',   label: 'Gestion des événements indésirables : accidents, presqu’accidents, analyses des causes', description: "Tous les événements indésirables — accidents du travail, maladies professionnelles, presqu'accidents et situations dangereuses — sont déclarés, enregistrés et analysés dans des délais définis. L'analyse recherche les causes profondes (méthode de l'arbre des causes, 5 pourquoi) avec la participation des travailleurs concernés et de leurs représentants, sans recherche de coupable. Les actions correctives sont définies pour éviter la récurrence, leur efficacité est vérifiée et les enseignements sont partagés à l'ensemble de l'organisme." },
      { id: 'i45-eval-amelioration', label: 'Revue de direction et amélioration continue du système SST', description: "La direction procède à la revue du système de management SST à intervalles planifiés pour s'assurer qu'il demeure approprié, adapté et efficace : analyse des indicateurs, des résultats d'audits, de la conformité réglementaire, des consultations des travailleurs et de l'atteinte des objectifs. Les décisions de la revue portent sur les opportunités d'amélioration continue, les besoins de changement et les ressources nécessaires. L'organisme améliore en permanence la pertinence et la performance de son système SST, en développant une culture positive de santé-sécurité." },
    ],
  },
]

export const ISO45001_NIVEAUX = [
  { value: 0, shortLabel: 'NC', label: 'Non conforme', description: "Exigence non traitée, aucune démarche engagée sur ce critère",      pct: 0,    color: '#9ca3af', bg: 'bg-gray-100 dark:bg-gray-700',         text: 'text-gray-600 dark:text-gray-400'   },
  { value: 1, shortLabel: '1',  label: 'Initié',       description: "Premières actions ponctuelles, démarche non structurée",            pct: 0.25, color: '#ef4444', bg: 'bg-red-50 dark:bg-red-900/20',         text: 'text-red-700 dark:text-red-400'     },
  { value: 2, shortLabel: '2',  label: 'Défini',       description: "Processus défini et documenté, déploiement en cours",               pct: 0.50, color: '#f97316', bg: 'bg-orange-50 dark:bg-orange-900/20',   text: 'text-orange-700 dark:text-orange-400' },
  { value: 3, shortLabel: '3',  label: 'Maîtrisé',     description: "Pratiques systématiques, mesurées et conformes à la norme",         pct: 0.75, color: '#eab308', bg: 'bg-yellow-50 dark:bg-yellow-900/20',   text: 'text-yellow-700 dark:text-yellow-400' },
  { value: 4, shortLabel: '4',  label: 'Optimisé',     description: "Amélioration continue démontrée, culture sécurité exemplaire",      pct: 1.0,  color: '#16a34a', bg: 'bg-green-50 dark:bg-green-900/20',     text: 'text-green-700 dark:text-green-400' },
]

const BADGE_LEVELS = [
  { label: 'Culture sécurité exemplaire',  min: 85, color: '#ea580c', icon: '⭐' },
  { label: "Conforme — prêt pour l'audit", min: 60, color: '#16a34a', icon: '✅' },
  { label: 'En construction',              min: 30, color: '#f97316', icon: '🔄' },
  { label: 'Non conforme',                 min: 0,  color: '#dc2626', icon: '❌' },
]

export function calculateIso45001Score(niveaux: Record<string, number>): number {
  let total = 0
  for (const axe of ISO45001_AXES) {
    let axeScore = 0
    const nb = axe.criteres.length
    for (const c of axe.criteres) {
      const n = niveaux[c.id] ?? 0
      axeScore += (ISO45001_NIVEAUX[n]?.pct ?? 0) / nb
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
function inputCls() { return 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500' }
function labelCls() { return 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1' }
function btnP(extra = '') { return `px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium transition-colors disabled:opacity-50 ${extra}` }
function btnS(extra = '') { return `px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm transition-colors ${extra}` }

const PRIORITE_COLORS = {
  haute:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  moyenne: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
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
  for (const axe of ISO45001_AXES) {
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
          <span className="text-4xl">🦺</span>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Diagnostic ISO 45001</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Évaluez votre système de management de la santé et de la sécurité au travail selon ISO 45001:2018</p>
          </div>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          La norme internationale <strong>ISO 45001:2018</strong> « Systèmes de management de la santé et de la sécurité
          au travail » est la <strong>première norme internationale SST</strong> : elle remplace le référentiel britannique
          <strong> OHSAS 18001</strong>, retiré en <strong>2021</strong>. Elle aide les organismes de toute taille à fournir
          des lieux de travail sûrs et sains, à prévenir les accidents du travail et les maladies professionnelles et à
          améliorer en continu leur performance SST, avec une exigence distinctive : la <strong>consultation et la
          participation des travailleurs</strong>.
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          Bâtie sur la <strong>structure HLS</strong> (High Level Structure) commune aux normes ISO de systèmes de
          management (<strong>ISO 9001</strong> qualité, <strong>ISO 14001</strong> environnement), elle permet de
          construire des <strong>systèmes de management intégrés QSE</strong>. La <strong>certification par tierce
          partie</strong> s&apos;effectue sur un <strong>cycle de 3 ans</strong> : audit initial de certification puis
          audits de suivi annuels, avant renouvellement.
        </p>
      </div>

      {/* Contexte France + référentiels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={card('p-5 border-l-4 border-orange-600')}>
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">🦺 Le parcours de certification ISO 45001</h3>
          <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
            <div className="flex items-start gap-2">
              <span className="text-orange-600 font-bold flex-shrink-0">📋</span>
              <span><strong>Diagnostic initial</strong> : évaluation de la maturité du système SST sur les exigences de la norme (leadership, planification, support, opérations, évaluation, amélioration).</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-orange-600 font-bold flex-shrink-0">🔍</span>
              <span><strong>Audit de certification</strong> par un organisme accrédité (étape 1 : revue documentaire, étape 2 : audit sur site avec observation des pratiques et entretiens avec les travailleurs).</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-orange-600 font-bold flex-shrink-0">🔄</span>
              <span><strong>Cycle de 3 ans</strong> : audits de suivi annuels puis audit de renouvellement — la démarche s&apos;inscrit dans l&apos;amélioration continue.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-orange-600 font-bold flex-shrink-0">🤝</span>
              <span><strong>Participation des travailleurs</strong> : exigence centrale de la norme — consultation du CSE, remontées terrain, association aux décisions SST.</span>
            </div>
          </div>
        </div>

        <div className={card('p-5 border-l-4 border-blue-500')}>
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">📋 Référentiels mobilisés</h3>
          <div className="space-y-1">
            {[
              ['🦺', 'ISO 45001:2018 — Management de la santé et de la sécurité au travail'],
              ['🔗', 'ISO 9001 / ISO 14001 — Structure HLS, systèmes intégrés QSE'],
              ['📜', 'OHSAS 18001 — Référentiel historique, retiré en 2021'],
              ['🌐', 'ILO-OSH 2001 — Principes directeurs de l’OIT'],
              ['🏭', 'MASE — Référentiel SSE des donneurs d’ordre industriels'],
              ['⚖️', 'Code du travail — Art. L4121-1, DUERP'],
              ['🏛️', 'ISO 26000 — Responsabilité sociétale'],
              ['📋', 'GRI 403 / CSRD ESRS S1 — Reporting santé-sécurité'],
              ['🌍', 'ODD 3 et 8 — Nations Unies'],
            ].map(([icon, label]) => (
              <div key={label} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <span>{icon}</span><span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Contexte réglementaire France */}
      <div className={card('p-5 bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800')}>
        <h3 className="font-bold text-orange-700 dark:text-orange-400 mb-3">⚖️ Contexte réglementaire français — Obligations de l&apos;employeur</h3>
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          {[
            "Obligation générale de sécurité de l'employeur (art. L4121-1 du code du travail) : prendre les mesures nécessaires pour assurer la sécurité et protéger la santé physique et mentale des travailleurs",
            "DUERP (Document Unique d'Évaluation des Risques Professionnels) obligatoire dès le 1er salarié, accompagné de son plan d'actions de prévention et mis à jour régulièrement",
            "Responsabilité pénale de l'employeur en cas de manquement, et reconnaissance de la faute inexcusable en cas d'accident lorsque le danger était connu et non traité",
            "Environ 2 accidents du travail mortels par jour en France : la prévention est un enjeu humain, juridique et économique majeur",
            "La certification ISO 45001 n'est pas obligatoire mais structure la conformité réglementaire et démontre l'engagement de l'organisme envers ses travailleurs, clients et donneurs d'ordre",
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
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Les 5 axes du diagnostic ISO 45001</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ISO45001_AXES.map(axe => (
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
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Niveaux de maturité ISO 45001</h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {ISO45001_NIVEAUX.map(n => (
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
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Badge de maturité ISO 45001</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {BADGE_LEVELS.map(b => (
            <div key={b.label} className={card('p-4 text-center')}>
              <div className="text-3xl">{b.icon}</div>
              <div className="font-bold text-sm mt-1" style={{ color: b.color }}>{b.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">≥ {b.min}%</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">Seuils : 0-30% Non conforme · 30-60% En construction · 60-85% Conforme — prêt pour l&apos;audit · 85-100% Culture sécurité exemplaire</p>
      </div>

      {/* Comment utiliser */}
      <div className={card('p-5 space-y-3')}>
        <h3 className="font-semibold text-gray-900 dark:text-white">💡 Comment utiliser cette application</h3>
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          {[
            ['1', 'Diagnostic ISO 45001', "Pour chaque critère, évaluez votre niveau de maturité (NC à 4), documentez vos pratiques et créez des actions d'amélioration ciblées."],
            ['2', "Plan d'actions", "Visualisez et gérez toutes vos actions SST : priorité, responsable, échéance, statut d'avancement."],
            ['3', 'Documents & Preuves', "Uploadez directement dans SharePoint vos preuves documentaires (DUERP, politique SST, plans de prévention, rapports d'audits, analyses d'accidents) classées par critère."],
            ['4', 'Export Excel', "Générez un rapport Excel structuré avec 6 onglets pour préparer votre audit de certification et alimenter votre reporting RSE."],
          ].map(([num, title, desc]) => (
            <div key={num} className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center text-xs font-bold">{num}</div>
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

  const axeStats = ISO45001_AXES.map(axe => {
    const total = axe.criteres.length
    const niveaux = axe.criteres.map(c => reponses[c.id]?.niveau ?? 0)
    const pct = niveaux.reduce((s, n) => s + (ISO45001_NIVEAUX[n]?.pct ?? 0), 0) / total
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
          <div className="text-xs text-gray-400 mt-1">Seuils : 30% En construction · 60% Conforme — prêt pour l&apos;audit · 85% Culture sécurité exemplaire</div>
        </div>

        {/* Radar */}
        <div className={card('p-4 sm:col-span-2')}>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Radar de maturité ISO 45001 par axe</h3>
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
              <polygon points={dataPolygon} fill="#ea580c22" stroke="#ea580c" strokeWidth="2.5" strokeLinejoin="round" />
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
                  const niv = ISO45001_NIVEAUX[n]
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
            <div className="h-2 rounded-full bg-orange-600 transition-all" style={{ width: `${Math.round(actions.filter(a => a.statut === 'termine').length / actions.length * 100)}%` }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Vue Correspondances ──────────────────────────────────────────────────────

const CORRESPONDANCES_ISO45001 = [
  {
    categorie: "Applications RSE Sens'ethO",
    icon: '🏠',
    color: 'indigo',
    items: [
      {
        ref: 'Diagnostic initial ISO 26000', icon: '⚙️', route: '/rse/iso26000',
        desc: "ISO 26000 — la santé et la sécurité au travail est un domaine d'action central de la question « Relations et conditions de travail » : le diagnostic ISO 45001 approfondit et structure cette dimension",
        liens: [
          { axe: 'leadership',    label: 'Leadership',    ref: 'ISO 26000 — Gouvernance de l’organisation et dialogue social' },
          { axe: 'planification', label: 'Planification', ref: 'ISO 26000 — DA Santé et sécurité au travail : prévention des risques' },
          { axe: 'support',       label: 'Support',       ref: 'ISO 26000 — Développement du capital humain, formation' },
        ],
      },
      {
        ref: 'EcoVadis Diagnostic', icon: '🥇', route: '/rse/ecovadis',
        desc: "EcoVadis — le pilier Social & Droits humains évalue la santé-sécurité des employés (politiques, actions, certifications, indicateurs) : la certification ISO 45001 est une preuve majeure valorisée dans la notation",
        liens: [
          { axe: 'leadership', label: 'Leadership', ref: 'EcoVadis — Politiques santé-sécurité formalisées et endossées par la direction' },
          { axe: 'evaluation', label: 'Évaluation', ref: 'EcoVadis — Indicateurs et résultats SST (taux d’accidents, couverture certification)' },
        ],
      },
      {
        ref: 'Devoir de Vigilance', icon: '⚖️', route: '/rse/vigilance',
        desc: "Devoir de Vigilance — le plan de vigilance couvre les atteintes graves à la santé et à la sécurité des personnes, dans l'entreprise comme chez les sous-traitants : la maîtrise SST des entreprises extérieures alimente directement la cartographie des risques",
        liens: [
          { axe: 'operations',    label: 'Opérations',    ref: 'Vigilance — Santé-sécurité chez les sous-traitants et fournisseurs' },
          { axe: 'planification', label: 'Planification', ref: 'Vigilance — Cartographie des risques d’atteintes graves à la santé-sécurité' },
        ],
      },
      {
        ref: 'Label Engagé RSE AFNOR', icon: '🏅', route: '/rse/afnor-rse',
        desc: "Label Engagé RSE (AFNOR) — la maturité du système SST nourrit l'évaluation AFNOR sur les ressources humaines, les conditions de travail et les résultats sociaux",
        liens: [
          { axe: 'support',    label: 'Support',    ref: 'AFNOR — Ressources humaines : compétences, conditions de travail' },
          { axe: 'evaluation', label: 'Évaluation', ref: 'AFNOR — Résultats sociaux : indicateurs santé-sécurité' },
        ],
      },
      {
        ref: 'Diagnostic B Corp', icon: '🏅', route: '/rse/bcorp',
        desc: "B Corp — l'aire Collaborateurs du B Impact Assessment évalue la santé, la sécurité et le bien-être au travail : le diagnostic ISO 45001 documente ces pratiques en profondeur",
        liens: [
          { axe: 'leadership', label: 'Leadership', ref: 'B Corp — Aire Collaborateurs : santé, sécurité et bien-être au travail' },
        ],
      },
      {
        ref: 'VSME / EFRAG', icon: '📊', route: '/rse/vsme-efrag',
        desc: "VSME — le standard volontaire EFRAG pour les PME demande des indicateurs santé-sécurité (accidents du travail, taux de fréquence) : le diagnostic ISO 45001 structure leur collecte et leur fiabilité",
        liens: [
          { axe: 'evaluation', label: 'Évaluation', ref: 'VSME — Module Basic : indicateurs accidents du travail et santé-sécurité' },
        ],
      },
    ],
  },
  {
    categorie: 'Référentiels SST et systèmes de management',
    icon: '🦺',
    color: 'orange',
    items: [
      {
        ref: 'ISO 9001 / ISO 14001 — SMI QSE', icon: '🔗', route: null,
        desc: "Structure HLS commune aux normes ISO de systèmes de management : contexte, leadership, planification, support, réalisation opérationnelle, évaluation des performances, amélioration — permet de construire un système de management intégré Qualité-Sécurité-Environnement",
        liens: [
          { axe: 'leadership', label: 'Leadership', ref: 'HLS art. 5 — Leadership et engagement communs aux trois normes' },
          { axe: 'evaluation', label: 'Évaluation', ref: 'HLS art. 9-10 — Audits internes, revue de direction et amélioration mutualisables' },
        ],
      },
      {
        ref: 'MASE', icon: '🏭', route: null,
        desc: "Manuel d'Amélioration Sécurité des Entreprises — référentiel SSE français exigé par de nombreux donneurs d'ordre industriels (chimie, pétrochimie, énergie) : forte convergence avec ISO 45001, passerelles de reconnaissance entre les deux certifications",
        liens: [
          { axe: 'operations', label: 'Opérations', ref: 'MASE — Maîtrise des interventions et coactivité chez les donneurs d’ordre' },
          { axe: 'support',    label: 'Support',    ref: 'MASE — Compétences et habilitations des intervenants' },
        ],
      },
      {
        ref: 'OHSAS 18001 (historique)', icon: '📜', route: null,
        desc: "Référentiel SST britannique remplacé par l'ISO 45001 et retiré en 2021 — les organismes certifiés OHSAS 18001 ont migré vers ISO 45001, qui reprend et renforce ses exigences (leadership, participation des travailleurs, intégration aux processus d'affaires)",
        liens: [
          { axe: 'leadership', label: 'Leadership', ref: 'ISO 45001 — Renforcement du leadership par rapport à OHSAS 18001' },
        ],
      },
      {
        ref: 'ILO-OSH 2001 (OIT)', icon: '🌐', route: null,
        desc: "Principes directeurs de l'Organisation Internationale du Travail concernant les systèmes de gestion de la sécurité et de la santé au travail — source d'inspiration de l'ISO 45001, notamment sur la participation des travailleurs",
        liens: [
          { axe: 'leadership', label: 'Leadership', ref: 'ILO-OSH — Participation des travailleurs et dialogue social' },
        ],
      },
      {
        ref: 'Code du travail (L4121-1, DUERP)', icon: '⚖️', route: null,
        desc: "Obligation générale de sécurité de l'employeur (art. L4121-1) et DUERP obligatoire dès le 1er salarié avec son plan d'actions : le diagnostic ISO 45001 structure la conformité réglementaire française et la prévention de la faute inexcusable",
        liens: [
          { axe: 'planification', label: 'Planification', ref: 'Code du travail — DUERP et principes généraux de prévention (L4121-2)' },
          { axe: 'operations',    label: 'Opérations',    ref: 'Code du travail — Plans de prévention, protocoles de sécurité (coactivité)' },
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
        desc: "ISO 26000 — lignes directrices de la responsabilité sociétale : la santé et la sécurité au travail est un domaine d'action de la question centrale « Relations et conditions de travail »",
        liens: [
          { axe: 'leadership', label: 'Leadership', ref: 'ISO 26000 — Relations et conditions de travail, dialogue social' },
          { axe: 'support',    label: 'Support',    ref: 'ISO 26000 — Développement du capital humain' },
        ],
      },
      {
        ref: 'CSRD — ESRS S1', icon: '📜', route: null,
        desc: "CSRD/ESRS — le standard S1 « Effectifs de l'entreprise » exige le reporting santé-sécurité (S1-14) : couverture du système de management SST, accidents du travail, décès, maladies professionnelles et jours perdus",
        liens: [
          { axe: 'evaluation', label: 'Évaluation', ref: 'ESRS S1-14 — Indicateurs de santé et de sécurité : accidents, couverture SMS' },
          { axe: 'leadership', label: 'Leadership', ref: 'ESRS S1 — Politiques et processus d’engagement avec les travailleurs' },
        ],
      },
      {
        ref: 'GRI 403 — Santé et sécurité au travail', icon: '📋', route: null,
        desc: "GRI 403 — standard dédié à la santé-sécurité : système de management SST (403-1), identification des dangers (403-2), services de santé au travail (403-3), participation des travailleurs (403-4), formation (403-5), accidents du travail (403-9)",
        liens: [
          { axe: 'planification', label: 'Planification', ref: 'GRI 403-2 — Identification des dangers et évaluation des risques' },
          { axe: 'evaluation',    label: 'Évaluation',    ref: 'GRI 403-9/403-10 — Accidents du travail et maladies professionnelles' },
        ],
      },
      {
        ref: 'ODD 3 et 8 — Nations Unies', icon: '🌍', route: null,
        desc: "Objectifs de Développement Durable — ODD 3 (bonne santé et bien-être) et ODD 8 (travail décent et croissance économique, cible 8.8 : défendre les droits des travailleurs et promouvoir la sécurité sur le lieu de travail)",
        liens: [
          { axe: 'leadership', label: 'Leadership', ref: 'ODD 8.8 — Sécurité sur le lieu de travail pour tous les travailleurs' },
          { axe: 'support',    label: 'Support',    ref: 'ODD 3 — Santé et bien-être : prévention, santé au travail' },
        ],
      },
    ],
  },
]

const AXE_BADGE_CLS: Record<string, string> = {
  leadership:    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
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
          La démarche ISO 45001 s&apos;articule avec l&apos;ensemble de votre démarche RSE.
          Les correspondances ci-dessous permettent de mutualiser vos efforts entre la norme ISO 45001,
          les systèmes de management intégrés QSE (ISO 9001, ISO 14001), le MASE, l&apos;ISO 26000,
          la CSRD/ESRS S1, le GRI 403, les ODD et le code du travail français.
        </p>
      </div>

      {CORRESPONDANCES_ISO45001.map(cat => (
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
                          const axe = ISO45001_AXES.find(a => a.id === l.axe)
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
    const res = await fetch(`/api/iso45001/${diagnosticId}/actions`, {
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
    await fetch(`/api/iso45001/${diagnosticId}/actions?action_id=${id}`, { method: 'DELETE' })
    onActionsChange(actions.filter(a => a.id !== id))
  }

  async function saveEdit(id: string) {
    setSavingEdit(true)
    const res = await fetch(`/api/iso45001/${diagnosticId}/actions?action_id=${id}`, {
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
    const res = await fetch(`/api/iso45001/${diagnosticId}/actions?action_id=${action.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: next }),
    })
    if (res.ok) {
      const { data } = await res.json()
      onActionsChange(actions.map(a => a.id === action.id ? data : a))
    }
  }

  const niv = ISO45001_NIVEAUX[niveau]

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
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">Niveau de maturité ISO 45001</div>
          {savingReponse && <span className="text-xs text-gray-400 animate-pulse">Enregistrement…</span>}
          {savedOk && !savingReponse && <span className="text-xs text-green-600 dark:text-green-400">✓ Sauvegardé</span>}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {ISO45001_NIVEAUX.map(n => (
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
        <p className="text-xs text-gray-500 dark:text-gray-400">Décrivez vos pratiques actuelles, les preuves disponibles pour l&apos;audit (DUERP, politique SST, plans de prévention, indicateurs) et les points d&apos;amélioration identifiés.</p>
        <textarea
          value={commentaire}
          onChange={e => handleCommentaireChange(e.target.value)}
          rows={4}
          placeholder="Ex : DUERP mis à jour en janvier 2026. CSSCT en place, causeries sécurité hebdomadaires. TF en baisse de 12%…"
          className={`${inputCls()} resize-y`}
        />
        <GuidedActionNotePanel
          diagnosticId={diagnosticId}
          actionKey={critere.id}
          apiBase="/api/iso45001"
          noteTable="iso45001_notes"
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
            🎯 Actions SST
            {critereActions.length > 0 && (
              <span className="ml-2 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-1.5 py-0.5 rounded-full font-medium">
                {critereActions.filter(a => a.statut === 'termine').length}/{critereActions.length}
              </span>
            )}
          </div>
          <button onClick={() => setShowActionForm(v => !v)} className={btnP('text-xs py-1.5')}>+ Action</button>
        </div>

        {showActionForm && (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 space-y-2 border border-gray-200 dark:border-gray-700">
            <div><label className={labelCls()}>Titre *</label>
              <input className={inputCls()} value={actionForm.titre} onChange={e => setActionForm(f => ({ ...f, titre: e.target.value }))} placeholder="Ex : Mettre à jour le DUERP avec les risques psychosociaux" />
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
          <p className="text-xs text-gray-400 text-center py-3">Aucune action — créez des mesures concrètes pour progresser vers la conformité ISO 45001</p>
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
                        apiBase="/api/iso45001"
                        noteTable="iso45001_notes"
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
  const [activeAxe, setActiveAxe] = useState(ISO45001_AXES[0].id)
  const [activeCritere, setActiveCritere] = useState<string | null>(ISO45001_AXES[0].criteres[0].id)

  const niveaux: Record<string, number> = {}
  for (const [k, v] of Object.entries(reponses)) niveaux[k] = v.niveau
  const scoreGlobal = calculateIso45001Score(niveaux)
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
            {ISO45001_AXES.map(axe => {
              const axeNiveaux = axe.criteres.map(c => niveaux[c.id] ?? 0)
              const axePct = Math.round(axeNiveaux.reduce((s, n) => s + ISO45001_NIVEAUX[n].pct, 0) / axe.criteres.length * 100)
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
            {ISO45001_AXES.map(axe => {
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
                        const niv = ISO45001_NIVEAUX[n]
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
            const axe = ISO45001_AXES.find(a => a.criteres.some(c => c.id === activeCritere))!
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
    const axe = ISO45001_AXES.find(x => x.criteres.some(c => c.id === a.critere_id))
    if (filterAxe !== 'all' && axe?.id !== filterAxe) return false
    if (filterPriorite !== 'all' && a.priorite !== filterPriorite) return false
    if (filterStatut !== 'all' && a.statut !== filterStatut) return false
    return true
  })

  const total = actions.length
  const termines = actions.filter(a => a.statut === 'termine').length

  async function saveEdit(id: string) {
    setSaving(true)
    const res = await fetch(`/api/iso45001/${diagnostic.id}/actions?action_id=${id}`, {
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
    await fetch(`/api/iso45001/${diagnostic.id}/actions?action_id=${id}`, { method: 'DELETE' })
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
          {ISO45001_AXES.map(a => <option key={a.id} value={a.id}>{a.icon} {a.label}</option>)}
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
          const axe = ISO45001_AXES.find(x => x.criteres.some(c => c.id === a.critere_id))
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
  { id: 'presentation',    label: 'Présentation',         icon: '📋' },
  { id: 'dashboard',       label: 'Tableau de bord',      icon: '📊' },
  { id: 'diagnostic',      label: 'Diagnostic ISO 45001', icon: '🦺' },
  { id: 'actions',         label: "Plan d'actions",       icon: '📝' },
  { id: 'correspondances', label: 'Correspondances',      icon: '🔗' },
]

export default function Iso45001DiagnosticApp({ ctx }: { ctx: RseContext }) {
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
      const res = await fetch(`/api/iso45001?org_id=${org.id}&annee=${year}`)
      const { data: existingDiag } = await res.json()

      let diagId = existingDiag?.id
      if (!diagId) {
        setInitializing(true)
        const createRes = await fetch('/api/iso45001', {
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
        fetch(`/api/iso45001/${diagId}/reponses`),
        fetch(`/api/iso45001/${diagId}/actions`),
        fetch(`/api/iso45001/${diagId}/notes`),
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
    await fetch(`/api/iso45001/${diagnostic.id}/reponses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ critere_id, niveau, commentaire }),
    })
    setTimeout(async () => {
      setReponses(current => {
        const n2: Record<string, number> = {}
        for (const [k, v] of Object.entries(current)) n2[k] = v.niveau
        const score = calculateIso45001Score(n2)
        if (diagnostic) {
          fetch(`/api/iso45001/${diagnostic.id}`, {
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
    fetch(`/api/iso45001/${diagnostic.id}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_key: critere_id, content }),
    }).catch(e => console.error('[iso45001/notes]', e))
  }

  function handleNoteSectionsChange(critere_id: string, sections: NoteSection[]) {
    setNoteSections(prev => ({ ...prev, [critere_id]: sections }))
    if (!diagnostic) return
    fetch(`/api/iso45001/${diagnostic.id}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_key: critere_id, sections }),
    }).catch(e => console.error('[iso45001/notes/sections]', e))
  }

  async function handleExportExcel() {
    if (!diagnostic) return
    setExportingExcel(true)
    try {
      const res = await fetch(`/api/iso45001/${diagnostic.id}/export-excel`)
      if (!res.ok) throw new Error('Échec export')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `ISO45001_${org?.nom ?? 'diagnostic'}_${year}.xlsx`; a.click()
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium transition-colors">
          👥 Partager
        </button>
      </div>
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnostic, exportingExcel])

  const lockedTabs = !org || !diagnostic ? ['dashboard', 'diagnostic', 'actions'] : []

  if (loading && !diagnostic) {
    return <div className="flex justify-center items-center py-20 text-gray-400 text-sm animate-pulse">
      {initializing ? 'Initialisation du diagnostic ISO 45001…' : 'Chargement…'}
    </div>
  }

  return (
    <div className="space-y-4">

      {/* ── Modale Partage ──────────────────────────────────────────────────── */}
      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowShare(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-bold text-gray-900 dark:text-white">👥 Partager le diagnostic ISO 45001</h2>
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
          <span>Score de maturité ISO 45001 :</span>
          <span className="font-bold text-gray-900 dark:text-white">{diagnostic.score_global ?? calculateIso45001Score(Object.fromEntries(Object.entries(reponses).map(([k, v]) => [k, v.niveau])))}/100</span>
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
                view === v.id ? 'border-orange-600 text-orange-600 dark:text-orange-400'
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
          score={diagnostic.score_global ?? calculateIso45001Score(Object.fromEntries(Object.entries(reponses).map(([k, v]) => [k, v.niveau])))}
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

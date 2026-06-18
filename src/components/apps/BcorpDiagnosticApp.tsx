/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import type { RseContext } from '@/components/rse/RseAppShell'
import ConfirmModal from '@/components/ui/ConfirmModal'
import ShareAutocomplete from '@/components/apps/ShareAutocomplete'
import type { NoteSection } from '@/components/apps/GuidedActionNotePanel'
import type { BcorpPdfData } from '@/components/apps/BcorpPDFReport'

// GuidedActionNotePanel chargé en lazy — même pattern que les autres apps RSE
const GuidedActionNotePanel = dynamic(() => import('@/components/apps/GuidedActionNotePanel'), {
  ssr: false,
  loading: () => <div className="py-3 text-xs text-gray-400 animate-pulse">Chargement éditeur…</div>
})

// Rapport PDF chargé en lazy (html2canvas/jsPDF côté client uniquement)
const BcorpPDFReport = dynamic(() => import('@/components/apps/BcorpPDFReport'), { ssr: false, loading: () => null })

// ─── Données statiques Diagnostic B Corp ──────────────────────────────────────

export const BCORP_AXES = [
  {
    id: 'gouvernance', label: 'Gouvernance', icon: '🏛️',
    color: '#b45309', colorLight: '#fef3c7', weight: 0.20,
    description: "Mission, éthique, transparence et redevabilité ; ancrage juridique de la mission.",
    criteres: [
      { id: 'bc-gov-mission',      label: 'Mission à impact formalisée et intégrée à la prise de décision', description: "L'organisation a formalisé une mission à impact social et environnemental, connue de tous et déclinée en objectifs mesurables. Cette mission est intégrée à la prise de décision stratégique et opérationnelle : les arbitrages majeurs (investissements, produits, partenariats) sont évalués au regard de leur contribution à la mission. Des indicateurs d'impact sont suivis et présentés régulièrement aux instances de gouvernance." },
      { id: 'bc-gov-ethique',      label: 'Éthique des affaires, anticorruption et code de conduite', description: "Un code de conduite et d'éthique des affaires est formalisé, diffusé et signé par les collaborateurs et les partenaires clés. Il couvre la prévention de la corruption, les conflits d'intérêts, la concurrence loyale et les cadeaux/invitations. Des dispositifs concrets l'accompagnent : formation, canal d'alerte protégé, traitement documenté des signalements et sanctions appliquées en cas de manquement." },
      { id: 'bc-gov-transparence', label: 'Transparence (résultats financiers et extra-financiers, gouvernance ouverte)', description: "L'organisation pratique une transparence exigeante envers ses parties prenantes : publication de résultats financiers et extra-financiers fiables, communication des impacts sociaux et environnementaux, méthodologies explicitées. La gouvernance est ouverte : les parties prenantes (collaborateurs, clients, communauté) disposent de canaux pour s'exprimer et sont associées aux orientations, par exemple via un comité de mission ou des consultations régulières." },
      { id: 'bc-gov-statut',       label: 'Ancrage juridique de la mission (société à mission, statuts, « mission lock » B Corp)', description: "La mission est juridiquement ancrée dans les statuts de l'entreprise, conformément à l'exigence légale de B Corp (« mission lock »). En France, cela passe par la qualité de société à mission (loi PACTE) avec raison d'être, objectifs statutaires et comité de mission, ou par une clause statutaire de prise en compte des intérêts élargis des parties prenantes. Cet ancrage protège la mission dans la durée, y compris en cas de changement d'actionnariat ou de dirigeants." },
    ],
  },
  {
    id: 'collaborateurs', label: 'Collaborateurs', icon: '👥',
    color: '#2563eb', colorLight: '#dbeafe', weight: 0.20,
    description: "Rémunération équitable, avantages, santé-sécurité-bien-être, développement et participation.",
    criteres: [
      { id: 'bc-col-remuneration',  label: 'Rémunération équitable (salaire décent, écarts de rémunération, partage de la valeur)', description: "La politique de rémunération garantit à chaque collaborateur un salaire décent, au-delà des minima légaux, et veille à l'équité interne : grille salariale transparente, suivi des écarts de rémunération (notamment femmes-hommes et ratio dirigeants/médiane). Des mécanismes de partage de la valeur (intéressement, participation, primes collectives) associent les collaborateurs aux résultats de l'entreprise." },
      { id: 'bc-col-sante',         label: 'Santé, sécurité et bien-être au travail', description: "L'organisation protège la santé physique et mentale de ses collaborateurs : évaluation des risques professionnels actualisée, prévention des accidents et des risques psychosociaux, couverture santé et prévoyance de qualité. Le bien-être au travail fait l'objet d'une attention structurée : équilibre vie professionnelle-vie personnelle, droit à la déconnexion, aménagements de travail flexibles et écoute régulière des équipes." },
      { id: 'bc-col-developpement', label: 'Formation, développement des compétences et gestion de carrière', description: "Chaque collaborateur bénéficie d'un accès effectif à la formation et d'un accompagnement dans son développement professionnel : plan de formation, entretiens de carrière réguliers, mobilité interne encouragée. L'organisation investit dans l'employabilité de ses équipes au-delà des besoins immédiats du poste, y compris sur les compétences de demain (transition écologique, numérique, management responsable)." },
      { id: 'bc-col-engagement',    label: 'Engagement, satisfaction et participation des collaborateurs (dont actionnariat salarié)', description: "L'engagement et la satisfaction des collaborateurs sont mesurés régulièrement (enquêtes, baromètres, eNPS) et donnent lieu à des plans d'actions suivis. Les collaborateurs participent à la vie et aux décisions de l'entreprise : instances représentatives actives, groupes de travail, démarches participatives. Les dispositifs d'actionnariat salarié ou de partage de la gouvernance renforcent cet alignement entre les équipes et le projet d'entreprise." },
    ],
  },
  {
    id: 'communaute', label: 'Communauté', icon: '🤝',
    color: '#9333ea', colorLight: '#f3e8ff', weight: 0.20,
    description: "Diversité-équité-inclusion, impact économique local, chaîne d'approvisionnement responsable, engagement civique.",
    criteres: [
      { id: 'bc-com-dei',          label: 'Diversité, équité et inclusion (recrutement, gouvernance, fournisseurs)', description: "L'organisation conduit une politique active de diversité, d'équité et d'inclusion : processus de recrutement non discriminants, objectifs de mixité dans les équipes et les instances de gouvernance, accessibilité des postes aux personnes en situation de handicap. Cette démarche s'étend à l'écosystème : achats auprès d'entreprises inclusives ou détenues par des publics sous-représentés, et mesure régulière des progrès réalisés." },
      { id: 'bc-com-local',        label: 'Impact économique local (emploi, achats locaux, ancrage territorial)', description: "L'entreprise contribue au développement économique de son territoire : création d'emplois locaux durables, recours privilégié à des fournisseurs et prestataires de proximité, partenariats avec les acteurs économiques et éducatifs locaux. Cet ancrage territorial est mesuré (part des achats locaux, emplois directs et indirects) et constitue un critère valorisé dans le B Impact Assessment." },
      { id: 'bc-com-fournisseurs', label: "Chaîne d'approvisionnement responsable (critères sociaux/environnementaux, audits)", description: "Les fournisseurs sont sélectionnés et évalués sur des critères sociaux et environnementaux formalisés : code de conduite fournisseurs, clauses RSE contractuelles, questionnaires d'évaluation et audits pour les achats à risque. L'organisation cartographie sa chaîne d'approvisionnement, identifie les risques (droits humains, environnement) et accompagne ses fournisseurs stratégiques dans leur progression plutôt que de simplement les exclure." },
      { id: 'bc-com-civique',      label: 'Engagement civique et dons (mécénat, bénévolat, partenariats associatifs)', description: "L'entreprise s'engage concrètement pour l'intérêt général : politique de mécénat financier ou en nature, mécénat de compétences, congés solidaires et bénévolat des collaborateurs sur le temps de travail. Des partenariats durables avec des associations et acteurs de l'économie sociale et solidaire structurent cet engagement, dont les résultats sont suivis et communiqués de manière transparente." },
    ],
  },
  {
    id: 'environnement', label: 'Environnement', icon: '🌍',
    color: '#16a34a', colorLight: '#dcfce7', weight: 0.20,
    description: "Management environnemental, énergie-climat, ressources-circularité, impact environnemental des produits.",
    criteres: [
      { id: 'bc-env-management', label: 'Système de management environnemental et politique formalisée', description: "L'organisation a formalisé une politique environnementale portée par la direction et déployée via un système de management structuré : objectifs chiffrés, responsabilités définies, indicateurs suivis et revues périodiques. Cette démarche couvre les sites, les opérations et les équipes, et s'appuie le cas échéant sur des référentiels reconnus (ISO 14001, EMAS) ou une démarche équivalente proportionnée à la taille de l'entreprise." },
      { id: 'bc-env-climat',     label: 'Énergie et climat (consommations, énergies renouvelables, bilan GES, trajectoire de réduction)', description: "Les consommations d'énergie sont mesurées et optimisées, avec une part croissante d'énergies renouvelables. L'entreprise réalise un bilan de ses émissions de gaz à effet de serre (scopes 1, 2 et 3 significatifs) et s'est fixé une trajectoire de réduction crédible, idéalement alignée sur la science (SBTi). Les actions de réduction sont priorisées, budgétées et leurs résultats suivis dans le temps." },
      { id: 'bc-env-ressources', label: 'Eau, déchets et circularité (réduction, réemploi, recyclage)', description: "L'organisation gère sobrement ses ressources : suivi des consommations d'eau, prévention et tri des déchets, réduction des emballages et lutte contre le gaspillage. Une logique d'économie circulaire est engagée : réemploi des équipements et matériaux, réparation, recyclage via des filières adaptées, et écoconception des flux pour limiter les ressources entrantes comme les déchets sortants." },
      { id: 'bc-env-produits',   label: 'Impact environnemental des produits/services (écoconception, ACV, bénéfice environnemental)', description: "L'impact environnemental des produits et services est évalué sur l'ensemble de leur cycle de vie (matières premières, fabrication, usage, fin de vie), via des analyses de cycle de vie ou des outils adaptés. L'écoconception est intégrée dès le développement de l'offre. Les produits ou services apportant un bénéfice environnemental démontrable (réduction d'émissions, préservation des ressources) sont particulièrement valorisés par le B Impact Assessment." },
    ],
  },
  {
    id: 'clients', label: 'Clients', icon: '🎯',
    color: '#dc2626', colorLight: '#fee2e2', weight: 0.20,
    description: "Valeur apportée aux clients, qualité, protection des données, marketing responsable, modèles à impact.",
    criteres: [
      { id: 'bc-cli-valeur',    label: 'Valeur et qualité des produits/services (satisfaction, réclamations, amélioration continue)', description: "L'entreprise s'assure que ses produits et services apportent une valeur réelle et durable à ses clients : qualité maîtrisée, sécurité, fiabilité et juste prix. La satisfaction client est mesurée régulièrement (enquêtes, NPS), les réclamations sont traitées de manière structurée et tracée, et les retours clients alimentent une boucle d'amélioration continue de l'offre." },
      { id: 'bc-cli-donnees',   label: 'Protection des données clients et cybersécurité (RGPD)', description: "Les données personnelles des clients sont protégées conformément au RGPD et au-delà : minimisation des données collectées, durées de conservation maîtrisées, information claire et consentement loyal, registre des traitements à jour. La cybersécurité fait l'objet de mesures proportionnées (analyse de risques, protection des systèmes, plan de réponse aux incidents) et les éventuelles violations de données sont gérées avec transparence." },
      { id: 'bc-cli-marketing', label: 'Marketing et information responsables (transparence, anti-greenwashing)', description: "La communication commerciale est loyale, transparente et vérifiable : pas d'allégations trompeuses, notamment environnementales (anti-greenwashing), information complète sur la composition, l'origine et les conditions d'utilisation des produits et services. L'entreprise s'interdit les pratiques de pression commerciale abusive et veille à l'accessibilité et à la clarté de son information pour tous les publics." },
      { id: 'bc-cli-impact',    label: "Modèles d'affaires à impact (clients mal desservis, bénéfice sociétal du produit)", description: "Le modèle d'affaires lui-même génère un impact positif : produits ou services répondant à un besoin sociétal (santé, éducation, inclusion financière, transition écologique) ou rendus accessibles à des clients mal desservis (publics fragiles, territoires délaissés, petites structures). Ces modèles d'affaires à impact (« Impact Business Models ») constituent un levier majeur de points dans le B Impact Assessment et démontrent l'alignement entre performance économique et mission." },
    ],
  },
]

export const BCORP_NIVEAUX = [
  { value: 0, shortLabel: 'NC', label: 'Non engagé', description: "Aucune démarche engagée sur ce critère",                       pct: 0,    color: '#9ca3af', bg: 'bg-gray-100 dark:bg-gray-700',       text: 'text-gray-600 dark:text-gray-400'   },
  { value: 1, shortLabel: '1',  label: 'Découverte', description: "Prise de conscience, premières actions ponctuelles",           pct: 0.25, color: '#ef4444', bg: 'bg-red-50 dark:bg-red-900/20',       text: 'text-red-700 dark:text-red-400'     },
  { value: 2, shortLabel: '2',  label: 'Structuré',  description: "Démarche structurée, plan d'actions en cours de déploiement",  pct: 0.50, color: '#f97316', bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-400' },
  { value: 3, shortLabel: '3',  label: 'Performant', description: "Pratiques systématiques, mesurées et suivies dans le temps",   pct: 0.75, color: '#eab308', bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-400' },
  { value: 4, shortLabel: '4',  label: 'Exemplaire', description: "Pratiques exemplaires, résultats prouvés et partagés",         pct: 1.0,  color: '#b45309', bg: 'bg-amber-50 dark:bg-amber-900/20',   text: 'text-amber-700 dark:text-amber-400' },
]

const BADGE_LEVELS = [
  { label: 'Niveau certification',         min: 85, color: '#b45309', icon: '⭐' },
  { label: 'Proche du seuil BIA (80 pts)', min: 60, color: '#16a34a', icon: '✅' },
  { label: 'En chemin',                    min: 30, color: '#f97316', icon: '🔄' },
  { label: 'Non engagé',                   min: 0,  color: '#dc2626', icon: '❌' },
]

export function calculateBcorpScore(niveaux: Record<string, number>): number {
  let total = 0
  for (const axe of BCORP_AXES) {
    let axeScore = 0
    const nb = axe.criteres.length
    for (const c of axe.criteres) {
      const n = niveaux[c.id] ?? 0
      axeScore += (BCORP_NIVEAUX[n]?.pct ?? 0) / nb
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
function inputCls() { return 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500' }
function labelCls() { return 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1' }
function btnP(extra = '') { return `px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium transition-colors disabled:opacity-50 ${extra}` }
function btnS(extra = '') { return `px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm transition-colors ${extra}` }

const PRIORITE_COLORS = {
  haute:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  moyenne: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  basse:   'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}
const STATUT_COLORS = {
  a_faire:  'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  en_cours: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  termine:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
}
const STATUT_LABELS = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' }
const PRIORITE_LABELS = { haute: '🔴 Haute', moyenne: '🟡 Moyenne', basse: '🟢 Basse' }

function critereLabel(id: string): string {
  for (const axe of BCORP_AXES) {
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
          <span className="text-4xl">🏅</span>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Diagnostic B Corp</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Préparez votre certification B Corp en évaluant vos 5 aires d&apos;impact du B Impact Assessment</p>
          </div>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          La certification <strong>B Corp</strong> est délivrée par <strong>B Lab</strong>, ONG à l&apos;origine d&apos;un mouvement
          né en <strong>2006 aux États-Unis</strong> et qui rassemble aujourd&apos;hui environ <strong>9 000 entreprises certifiées</strong> dans
          le monde. Elle distingue les entreprises qui conjuguent performance économique et impact positif pour la société et
          l&apos;environnement. Historiquement, l&apos;évaluation repose sur le <strong>B Impact Assessment (BIA)</strong> :
          un questionnaire noté sur <strong>200 points</strong> couvrant 5 aires d&apos;impact, avec un <strong>seuil de
          certification fixé à 80 points</strong>, une <strong>vérification par B Lab</strong> et une
          <strong> recertification tous les 3 ans</strong>.
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          Le référentiel évolue : les <strong>nouveaux standards B Lab</strong>, publiés en <strong>2025</strong>, remplacent
          progressivement le score unique par des <strong>exigences à satisfaire sur 7 thématiques d&apos;impact</strong> (mission
          et gouvernance, conduite éthique, droits humains, action climatique, gestion environnementale, justice-équité-diversité-inclusion,
          affaires publiques et action collective). Ce diagnostic vous prépare <strong>aux deux approches</strong> : il structure vos
          pratiques sur les 5 aires historiques du BIA tout en couvrant les fondamentaux attendus par les nouveaux standards.
        </p>
      </div>

      {/* Certification + exigence juridique */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={card('p-5 border-l-4 border-amber-600')}>
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">🏅 Le parcours de certification B Corp</h3>
          <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
            <div className="flex items-start gap-2">
              <span className="text-amber-700 font-bold flex-shrink-0">📊</span>
              <span><strong>B Impact Assessment (BIA)</strong> : auto-évaluation sur 200 points couvrant Gouvernance, Collaborateurs, Communauté, Environnement et Clients. Seuil de certification : <strong>80 points</strong>.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-amber-700 font-bold flex-shrink-0">🔍</span>
              <span><strong>Vérification par B Lab</strong> : analyse documentée des réponses, preuves à l&apos;appui, avant attribution de la certification.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-amber-700 font-bold flex-shrink-0">🔄</span>
              <span><strong>Recertification tous les 3 ans</strong> : la démarche s&apos;inscrit dans l&apos;amélioration continue, avec des exigences progressivement renforcées.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-amber-700 font-bold flex-shrink-0">🆕</span>
              <span><strong>Nouveaux standards (2025)</strong> : exigences à satisfaire sur 7 thématiques d&apos;impact, en remplacement progressif du score unique.</span>
            </div>
          </div>
        </div>

        <div className={card('p-5 border-l-4 border-blue-500')}>
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">📋 Référentiels mobilisés</h3>
          <div className="space-y-1">
            {[
              ['🏅', 'B Impact Assessment (BIA) — 200 points, 5 aires d’impact'],
              ['🆕', 'Nouveaux standards B Lab (2025) — 7 thématiques d’impact'],
              ['⚖️', 'Société à mission (loi PACTE) — ancrage juridique de la mission'],
              ['🏛️', 'ISO 26000 — Responsabilité sociétale'],
              ['📜', 'CSRD/ESRS — Reporting de durabilité'],
              ['📋', 'GRI Standards — Reporting extra-financier'],
              ['🥇', 'EcoVadis — Notation RSE'],
              ['🌍', 'ODD 8, 10, 12 et 13 — Nations Unies'],
            ].map(([icon, label]) => (
              <div key={label} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <span>{icon}</span><span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Exigence juridique */}
      <div className={card('p-5 bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800')}>
        <h3 className="font-bold text-orange-700 dark:text-orange-400 mb-3">⚖️ Exigence juridique — Ancrer la mission dans les statuts</h3>
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          {[
            "La certification B Corp exige une modification des statuts de l'entreprise pour ancrer juridiquement la mission (« mission lock ») : les intérêts des parties prenantes doivent être pris en compte dans la prise de décision",
            "En France, deux voies principales : la qualité de société à mission (loi PACTE, 2019) — raison d'être, objectifs sociaux et environnementaux statutaires, comité de mission et vérification par un organisme tiers indépendant",
            "Ou l'insertion d'une clause statutaire de prise en compte des intérêts élargis des parties prenantes (collaborateurs, clients, fournisseurs, communauté, environnement)",
            "Cet ancrage protège la mission dans la durée, y compris en cas de levée de fonds, de cession ou de changement de dirigeants",
            "Ouvert à toutes les entreprises à but lucratif, de la TPE au grand groupe, avec des modalités d'évaluation adaptées à la taille et au secteur",
          ].map((line, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="font-bold text-orange-600 flex-shrink-0">•</span>
              <span>{line}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Les 5 aires d'impact */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Les 5 aires d&apos;impact du B Impact Assessment</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {BCORP_AXES.map(axe => (
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
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Niveaux de maturité B Corp</h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {BCORP_NIVEAUX.map(n => (
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
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Badge de maturité B Corp</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {BADGE_LEVELS.map(b => (
            <div key={b.label} className={card('p-4 text-center')}>
              <div className="text-3xl">{b.icon}</div>
              <div className="font-bold text-sm mt-1" style={{ color: b.color }}>{b.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">≥ {b.min}%</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">Seuils : 0-30% Non engagé · 30-60% En chemin · 60-85% Proche du seuil BIA (80 pts) · 85-100% Niveau certification</p>
      </div>

      {/* Comment utiliser */}
      <div className={card('p-5 space-y-3')}>
        <h3 className="font-semibold text-gray-900 dark:text-white">💡 Comment utiliser cette application</h3>
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          {[
            ['1', 'Diagnostic B Corp', "Pour chaque critère, évaluez votre niveau de maturité (NC à 4), documentez vos pratiques et créez des actions d'amélioration ciblées."],
            ['2', "Plan d'actions", "Visualisez et gérez toutes vos actions B Corp : priorité, responsable, échéance, statut d'avancement."],
            ['3', 'Documents & Preuves', "Uploadez directement dans SharePoint vos preuves documentaires (statuts modifiés, bilan GES, enquêtes collaborateurs, politique achats responsables) classées par critère."],
            ['4', 'Export Excel', "Générez un rapport Excel structuré avec 6 onglets pour préparer votre dossier B Impact Assessment et alimenter votre reporting RSE."],
          ].map(([num, title, desc]) => (
            <div key={num} className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex items-center justify-center text-xs font-bold">{num}</div>
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

  const axeStats = BCORP_AXES.map(axe => {
    const total = axe.criteres.length
    const niveaux = axe.criteres.map(c => reponses[c.id]?.niveau ?? 0)
    const pct = niveaux.reduce((s, n) => s + (BCORP_NIVEAUX[n]?.pct ?? 0), 0) / total
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
          <div className="text-xs text-gray-400 mt-1">Seuils : 30% En chemin · 60% Proche du seuil BIA · 85% Niveau certification</div>
        </div>

        {/* Radar */}
        <div className={card('p-4 sm:col-span-2')}>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Radar de maturité B Corp par aire d&apos;impact</h3>
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
              <polygon points={dataPolygon} fill="#b4530922" stroke="#b45309" strokeWidth="2.5" strokeLinejoin="round" />
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

      {/* Détail par aire */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Détail par aire d&apos;impact et critère</h3>
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
                  const niv = BCORP_NIVEAUX[n]
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
            { label: 'Terminées', count: actions.filter(a => a.statut === 'termine').length,  color: 'text-amber-700 dark:text-amber-400' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>
        {actions.length > 0 && (
          <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div className="h-2 rounded-full bg-amber-600 transition-all" style={{ width: `${Math.round(actions.filter(a => a.statut === 'termine').length / actions.length * 100)}%` }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Vue Correspondances ──────────────────────────────────────────────────────

const CORRESPONDANCES_BCORP = [
  {
    categorie: "Applications RSE Sens'ethO",
    icon: '🏠',
    color: 'indigo',
    items: [
      {
        ref: 'Diagnostic initial ISO 26000', icon: '⚙️', route: '/rse/iso26000',
        desc: "ISO 26000 — les 5 aires d'impact B Corp recouvrent les 7 questions centrales de la responsabilité sociétale : gouvernance, droits de l'Homme, relations de travail, environnement, loyauté des pratiques, consommateurs et communautés",
        liens: [
          { axe: 'gouvernance',    label: 'Gouvernance',    ref: "ISO 26000 — Gouvernance de l'organisation et loyauté des pratiques" },
          { axe: 'collaborateurs', label: 'Collaborateurs', ref: 'ISO 26000 — Relations et conditions de travail' },
          { axe: 'communaute',     label: 'Communauté',     ref: 'ISO 26000 — Communautés et développement local, droits de l’Homme' },
        ],
      },
      {
        ref: 'EcoVadis Diagnostic', icon: '🥇', route: '/rse/ecovadis',
        desc: "EcoVadis — les politiques, actions et résultats documentés pour B Corp alimentent directement les 4 thèmes de la notation EcoVadis : Environnement, Social & Droits humains, Éthique et Achats responsables",
        liens: [
          { axe: 'environnement', label: 'Environnement',  ref: 'EcoVadis — Thème Environnement : politiques, actions, résultats' },
          { axe: 'gouvernance',   label: 'Gouvernance',    ref: 'EcoVadis — Thème Éthique : anticorruption, pratiques loyales' },
          { axe: 'communaute',    label: 'Communauté',     ref: 'EcoVadis — Achats responsables : critères ESG dans la chaîne d’approvisionnement' },
        ],
      },
      {
        ref: 'Label Engagé RSE AFNOR', icon: '🏅', route: '/rse/afnor-rse',
        desc: "Label Engagé RSE (AFNOR) — la maturité B Corp nourrit l'évaluation AFNOR sur la vision, la gouvernance, l'ancrage territorial et les résultats sociaux et environnementaux",
        liens: [
          { axe: 'gouvernance', label: 'Gouvernance', ref: 'AFNOR — Vision et gouvernance : mission, parties prenantes, redevabilité' },
          { axe: 'communaute',  label: 'Communauté',  ref: 'AFNOR — Ancrage territorial et contribution au développement local' },
        ],
      },
      {
        ref: 'Bilan GES', icon: '🌱', route: '/rse/bilan-ges',
        desc: "Bilan GES — le bilan d'émissions de gaz à effet de serre (scopes 1, 2, 3) et la trajectoire de réduction alimentent l'aire Environnement du BIA et l'exigence d'action climatique des nouveaux standards B Lab",
        liens: [
          { axe: 'environnement', label: 'Environnement', ref: 'Bilan GES — Mesure des émissions et trajectoire de réduction (critère énergie-climat)' },
        ],
      },
      {
        ref: 'Label Numérique Responsable', icon: '💻', route: '/rse/label-nr',
        desc: "Label NR — les pratiques de numérique responsable (équipements durables, écoconception, protection des données) valorisent les aires Environnement et Clients du B Impact Assessment",
        liens: [
          { axe: 'environnement', label: 'Environnement', ref: 'Label NR — Cycle de vie des équipements IT et sobriété numérique' },
          { axe: 'clients',       label: 'Clients',       ref: 'Label NR — Protection des données et éthique numérique' },
        ],
      },
      {
        ref: 'Devoir de Vigilance', icon: '⚖️', route: '/rse/vigilance',
        desc: "Devoir de Vigilance — la cartographie des risques et le plan de vigilance sur la chaîne d'approvisionnement répondent aux attentes B Corp sur les fournisseurs et les droits humains",
        liens: [
          { axe: 'communaute', label: 'Communauté', ref: 'Vigilance — Chaîne d’approvisionnement responsable : risques sociaux et environnementaux' },
        ],
      },
    ],
  },
  {
    categorie: 'Référentiels B Corp et mission',
    icon: '🏅',
    color: 'amber',
    items: [
      {
        ref: 'B Impact Assessment (BIA) — B Lab', icon: '🏅', route: null,
        desc: "B Impact Assessment — outil historique d'évaluation B Corp : 200 points sur 5 aires d'impact (Gouvernance, Collaborateurs, Communauté, Environnement, Clients), seuil de certification à 80 points, vérification par B Lab et recertification tous les 3 ans",
        liens: [
          { axe: 'gouvernance',    label: 'Gouvernance',    ref: 'BIA — Aire Governance : mission, éthique, transparence, mission lock' },
          { axe: 'collaborateurs', label: 'Collaborateurs', ref: 'BIA — Aire Workers : rémunération, avantages, bien-être, développement' },
          { axe: 'clients',        label: 'Clients',        ref: 'BIA — Aire Customers : valeur, protection des données, modèles à impact' },
        ],
      },
      {
        ref: 'Nouveaux standards B Lab (2025)', icon: '🆕', route: null,
        desc: "Nouveaux standards B Lab publiés en 2025 — exigences à satisfaire sur 7 thématiques d'impact (mission et gouvernance, conduite éthique, droits humains, action climatique, gestion environnementale, JEDI, affaires publiques), remplaçant progressivement le score unique de 80 points",
        liens: [
          { axe: 'gouvernance',   label: 'Gouvernance',   ref: 'Standards 2025 — Purpose & Stakeholder Governance, Fair Work' },
          { axe: 'environnement', label: 'Environnement', ref: 'Standards 2025 — Climate Action et Environmental Stewardship' },
          { axe: 'communaute',    label: 'Communauté',    ref: 'Standards 2025 — Human Rights et Justice, Equity, Diversity & Inclusion (JEDI)' },
        ],
      },
      {
        ref: 'Société à mission — loi PACTE', icon: '⚖️', route: null,
        desc: "Qualité de société à mission (loi PACTE, 2019) — raison d'être, objectifs sociaux et environnementaux statutaires, comité de mission et vérification par organisme tiers indépendant : la voie française privilégiée pour satisfaire l'exigence juridique B Corp",
        liens: [
          { axe: 'gouvernance', label: 'Gouvernance', ref: 'Loi PACTE — Ancrage statutaire de la mission, comité de mission, vérification OTI' },
        ],
      },
      {
        ref: 'EcoVadis', icon: '🥇', route: null,
        desc: "EcoVadis — notation RSE des entreprises sur 4 thèmes (Environnement, Social & Droits humains, Éthique, Achats responsables) : forte convergence documentaire avec le B Impact Assessment",
        liens: [
          { axe: 'environnement', label: 'Environnement', ref: 'EcoVadis — Politiques, actions et résultats environnementaux' },
          { axe: 'gouvernance',   label: 'Gouvernance',   ref: 'EcoVadis — Éthique des affaires et anticorruption' },
        ],
      },
      {
        ref: 'Science Based Targets (SBTi)', icon: '🎯', route: null,
        desc: "SBTi — trajectoire de réduction des émissions GES alignée sur la science : renforce l'aire Environnement du BIA et répond à l'exigence d'action climatique des nouveaux standards B Lab",
        liens: [
          { axe: 'environnement', label: 'Environnement', ref: 'SBTi — Objectifs de réduction validés, compatibles 1,5°C' },
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
        desc: "ISO 26000 — lignes directrices de la responsabilité sociétale : les 5 aires d'impact B Corp déclinent les 7 questions centrales de la norme sur un format orienté certification",
        liens: [
          { axe: 'collaborateurs', label: 'Collaborateurs', ref: 'ISO 26000 — Relations et conditions de travail, dialogue social' },
          { axe: 'clients',        label: 'Clients',        ref: 'ISO 26000 — Questions relatives aux consommateurs : loyauté, données, accès' },
        ],
      },
      {
        ref: 'CSRD — ESRS', icon: '📜', route: null,
        desc: "CSRD/ESRS — le diagnostic B Corp alimente le reporting de durabilité : ESRS 2 (gouvernance), S1 (effectifs), S2-S3 (chaîne de valeur, communautés), E1-E5 (climat, ressources), G1 (conduite des affaires)",
        liens: [
          { axe: 'collaborateurs', label: 'Collaborateurs', ref: 'ESRS S1 — Effectifs : conditions de travail, rémunération, formation' },
          { axe: 'environnement',  label: 'Environnement',  ref: 'ESRS E1-E5 — Climat, pollution, eau, biodiversité, économie circulaire' },
          { axe: 'gouvernance',    label: 'Gouvernance',    ref: 'ESRS G1 — Conduite des affaires : éthique, anticorruption, lobbying' },
        ],
      },
      {
        ref: 'GRI Standards', icon: '📋', route: null,
        desc: "GRI Standards — GRI 2 (gouvernance), 205 (anticorruption), 401-404 (emploi, santé-sécurité, formation), 305-306 (émissions, déchets), 413 (communautés locales), 418 (protection des données clients)",
        liens: [
          { axe: 'collaborateurs', label: 'Collaborateurs', ref: 'GRI 401-404 — Emploi, santé-sécurité au travail, formation et éducation' },
          { axe: 'clients',        label: 'Clients',        ref: 'GRI 418 — Protection des données et de la vie privée des clients' },
        ],
      },
      {
        ref: 'ODD 8, 10, 12 et 13 — Nations Unies', icon: '🌍', route: null,
        desc: "Objectifs de Développement Durable — ODD 8 (travail décent et croissance économique), ODD 10 (réduction des inégalités), ODD 12 (consommation et production responsables), ODD 13 (action climatique)",
        liens: [
          { axe: 'collaborateurs', label: 'Collaborateurs', ref: 'ODD 8 — Travail décent : emploi de qualité, droits du travail, sécurité' },
          { axe: 'communaute',     label: 'Communauté',     ref: 'ODD 10 — Réduction des inégalités : inclusion, équité, diversité' },
          { axe: 'environnement',  label: 'Environnement',  ref: 'ODD 12 et 13 — Production responsable et lutte contre le changement climatique' },
        ],
      },
    ],
  },
]

const AXE_BADGE_CLS: Record<string, string> = {
  gouvernance:    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  collaborateurs: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  communaute:     'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  environnement:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  clients:        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

function CorrespondancesView() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className={card('p-4')}>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          La certification B Corp s&apos;articule avec l&apos;ensemble de votre démarche RSE.
          Les correspondances ci-dessous permettent de mutualiser vos efforts entre le B Impact Assessment,
          les nouveaux standards B Lab, la société à mission (loi PACTE), l&apos;ISO 26000, la CSRD/ESRS,
          les GRI Standards, les ODD, EcoVadis et la trajectoire SBTi.
        </p>
      </div>

      {CORRESPONDANCES_BCORP.map(cat => (
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
                          const axe = BCORP_AXES.find(a => a.id === l.axe)
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
    const res = await fetch(`/api/bcorp/${diagnosticId}/actions`, {
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
    await fetch(`/api/bcorp/${diagnosticId}/actions?action_id=${id}`, { method: 'DELETE' })
    onActionsChange(actions.filter(a => a.id !== id))
  }

  async function saveEdit(id: string) {
    setSavingEdit(true)
    const res = await fetch(`/api/bcorp/${diagnosticId}/actions?action_id=${id}`, {
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
    const res = await fetch(`/api/bcorp/${diagnosticId}/actions?action_id=${action.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: next }),
    })
    if (res.ok) {
      const { data } = await res.json()
      onActionsChange(actions.map(a => a.id === action.id ? data : a))
    }
  }

  const niv = BCORP_NIVEAUX[niveau]

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
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">Niveau de maturité B Corp</div>
          {savingReponse && <span className="text-xs text-gray-400 animate-pulse">Enregistrement…</span>}
          {savedOk && !savingReponse && <span className="text-xs text-amber-700 dark:text-amber-400">✓ Sauvegardé</span>}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {BCORP_NIVEAUX.map(n => (
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
        <p className="text-xs text-gray-500 dark:text-gray-400">Décrivez vos pratiques actuelles, les preuves disponibles pour le B Impact Assessment (politiques, indicateurs, statuts) et les points d&apos;amélioration identifiés.</p>
        <textarea
          value={commentaire}
          onChange={e => handleCommentaireChange(e.target.value)}
          rows={4}
          placeholder="Ex : Statuts modifiés en société à mission en 2025. Comité de mission installé. Score BIA estimé : 68 pts…"
          className={`${inputCls()} resize-y`}
        />
        <GuidedActionNotePanel
          diagnosticId={diagnosticId}
          actionKey={critere.id}
          apiBase="/api/bcorp"
          noteTable="bcorp_notes"
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
            🎯 Actions B Corp
            {critereActions.length > 0 && (
              <span className="ml-2 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">
                {critereActions.filter(a => a.statut === 'termine').length}/{critereActions.length}
              </span>
            )}
          </div>
          <button onClick={() => setShowActionForm(v => !v)} className={btnP('text-xs py-1.5')}>+ Action</button>
        </div>

        {showActionForm && (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 space-y-2 border border-gray-200 dark:border-gray-700">
            <div><label className={labelCls()}>Titre *</label>
              <input className={inputCls()} value={actionForm.titre} onChange={e => setActionForm(f => ({ ...f, titre: e.target.value }))} placeholder="Ex : Adopter la qualité de société à mission lors de la prochaine AG" />
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
          <p className="text-xs text-gray-400 text-center py-3">Aucune action — créez des mesures concrètes pour progresser vers la certification B Corp</p>
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
                        apiBase="/api/bcorp"
                        noteTable="bcorp_notes"
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
  const [activeAxe, setActiveAxe] = useState(BCORP_AXES[0].id)
  const [activeCritere, setActiveCritere] = useState<string | null>(BCORP_AXES[0].criteres[0].id)

  const niveaux: Record<string, number> = {}
  for (const [k, v] of Object.entries(reponses)) niveaux[k] = v.niveau
  const scoreGlobal = calculateBcorpScore(niveaux)
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
            {BCORP_AXES.map(axe => {
              const axeNiveaux = axe.criteres.map(c => niveaux[c.id] ?? 0)
              const axePct = Math.round(axeNiveaux.reduce((s, n) => s + BCORP_NIVEAUX[n].pct, 0) / axe.criteres.length * 100)
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
            {BCORP_AXES.map(axe => {
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
                        const niv = BCORP_NIVEAUX[n]
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
            const axe = BCORP_AXES.find(a => a.criteres.some(c => c.id === activeCritere))!
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

// Helpers d'échéance (fr-FR + alertes retard / bientôt) et de tri
const PRIORITE_RANK: Record<Action['priorite'], number> = { haute: 0, moyenne: 1, basse: 2 }
const STATUT_RANK: Record<Action['statut'], number> = { a_faire: 0, en_cours: 1, termine: 2 }

function axeOf(critereId: string) {
  return BCORP_AXES.find(x => x.criteres.some(c => c.id === critereId))
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
          const ia = BCORP_AXES.findIndex(x => x.id === axeOf(a.critere_id)?.id)
          const ib = BCORP_AXES.findIndex(x => x.id === axeOf(b.critere_id)?.id)
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
  const groups = BCORP_AXES
    .map(axe => ({ axe, items: sortActions(filtered.filter(a => axeOf(a.critere_id)?.id === axe.id)) }))
    .filter(g => g.items.length > 0)

  async function saveEdit(id: string) {
    setSaving(true)
    const res = await fetch(`/api/bcorp/${diagnostic.id}/actions?action_id=${id}`, {
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
    const res = await fetch(`/api/bcorp/${diagnostic.id}/actions?action_id=${action.id}`, {
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
    await fetch(`/api/bcorp/${diagnostic.id}/actions?action_id=${id}`, { method: 'DELETE' })
    onActionsChange(actions.filter(a => a.id !== id))
  }

  return (
    <div className="space-y-4">
      {/* Barre de progression globale */}
      <div className={card('p-4')}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">Avancement du plan d&apos;actions</div>
          <div className="text-sm font-bold text-amber-700 dark:text-amber-400">{total ? Math.round(termines / total * 100) : 0}%</div>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
          <div className="h-2.5 rounded-full bg-amber-600 transition-all duration-500" style={{ width: `${total ? Math.round(termines / total * 100) : 0}%` }} />
        </div>
        <div className="text-xs text-gray-400 mt-1">{termines} terminée{termines !== 1 ? 's' : ''} sur {total}</div>
      </div>

      {/* Compteurs enrichis */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total',     value: total,    color: 'text-gray-700 dark:text-gray-300' },
          { label: 'À faire',   value: aFaire,   color: 'text-gray-600 dark:text-gray-400' },
          { label: 'En cours',  value: enCours,  color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Terminées', value: termines, color: 'text-amber-700 dark:text-amber-400' },
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
          <option value="all">Toutes les aires d&apos;impact</option>
          {BCORP_AXES.map(a => <option key={a.id} value={a.id}>{a.icon} {a.label}</option>)}
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
          <option value="axe">↕ Tri : aire d&apos;impact</option>
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
                return (
                  <div key={a.id} className={card('p-4')}>
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
                              {/* Toggle statut en un clic */}
                              <button onClick={() => toggleStatut(a)} title="Changer le statut (clic)"
                                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium hover:ring-2 hover:ring-offset-1 hover:ring-amber-300 transition ${STATUT_COLORS[a.statut]}`}>
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
  { id: 'presentation',    label: 'Présentation',      icon: '📋' },
  { id: 'dashboard',       label: 'Tableau de bord',   icon: '📊' },
  { id: 'diagnostic',      label: 'Diagnostic B Corp', icon: '🏅' },
  { id: 'actions',         label: "Plan d'actions",    icon: '📝' },
  { id: 'correspondances', label: 'Correspondances',   icon: '🔗' },
]

export default function BcorpDiagnosticApp({ ctx }: { ctx: RseContext }) {
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
  const [pdfData, setPdfData] = useState<BcorpPdfData | null>(null)
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
      const res = await fetch(`/api/bcorp?org_id=${org.id}&annee=${year}`)
      const { data: existingDiag } = await res.json()

      let diagId = existingDiag?.id
      if (!diagId) {
        setInitializing(true)
        const createRes = await fetch('/api/bcorp', {
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
        fetch(`/api/bcorp/${diagId}/reponses`),
        fetch(`/api/bcorp/${diagId}/actions`),
        fetch(`/api/bcorp/${diagId}/notes`),
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
    await fetch(`/api/bcorp/${diagnostic.id}/reponses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ critere_id, niveau, commentaire }),
    })
    setTimeout(async () => {
      setReponses(current => {
        const n2: Record<string, number> = {}
        for (const [k, v] of Object.entries(current)) n2[k] = v.niveau
        const score = calculateBcorpScore(n2)
        if (diagnostic) {
          fetch(`/api/bcorp/${diagnostic.id}`, {
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
    fetch(`/api/bcorp/${diagnostic.id}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_key: critere_id, content }),
    }).catch(e => console.error('[bcorp/notes]', e))
  }

  function handleNoteSectionsChange(critere_id: string, sections: NoteSection[]) {
    setNoteSections(prev => ({ ...prev, [critere_id]: sections }))
    if (!diagnostic) return
    fetch(`/api/bcorp/${diagnostic.id}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_key: critere_id, sections }),
    }).catch(e => console.error('[bcorp/notes/sections]', e))
  }

  async function handleExportExcel() {
    if (!diagnostic) return
    setExportingExcel(true)
    try {
      const res = await fetch(`/api/bcorp/${diagnostic.id}/export-excel`)
      if (!res.ok) throw new Error('Échec export')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `BCorp_${org?.denomination ?? 'diagnostic'}_${year}.xlsx`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { alert('Erreur export Excel : ' + String(e)) }
    finally { setExportingExcel(false) }
  }

  function buildPdfData(): BcorpPdfData {
    const niveaux: Record<string, number> = {}
    const commentaires: Record<string, string> = {}
    for (const [k, v] of Object.entries(reponses)) {
      niveaux[k] = v.niveau
      if (v.commentaire) commentaires[k] = v.commentaire
    }
    const score = diagnostic?.score_global ?? calculateBcorpScore(niveaux)
    const badge = getBadge(score)
    return {
      organisation: org?.denomination ?? null,
      siren: org?.siren ?? null,
      ville: org?.ville ?? null,
      year,
      date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
      scoreLabel: 'Score de maturité',
      scoreValue: score,
      badge: { label: badge.label, emoji: badge.icon, color: badge.color },
      axes: BCORP_AXES,
      niveaux: BCORP_NIVEAUX,
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
        if (document.querySelector('#bcorp-pdf-root [data-pdf-page]')) { resolve(); return }
        const observer = new MutationObserver(() => {
          if (document.querySelector('#bcorp-pdf-root [data-pdf-page]')) {
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
      await exportReport('bcorp-pdf-root', `Diagnostic-B-Corp-${orgSlug}-${year}.pdf`)
    } catch (e) {
      console.error('[bcorp/exportPDF]', e)
    } finally {
      setExportingPDF(false)
      setPdfData(null)
    }
  }

  const loadShares = useCallback(async () => {
    if (!diagnostic) return
    try {
      const res = await fetch(`/api/bcorp/${diagnostic.id}/shares`)
      const { data } = await res.json()
      setShareList(data ?? [])
    } catch { /* ignore */ }
  }, [diagnostic])

  useEffect(() => { if (showShare) loadShares() }, [showShare, loadShares])

  async function handleAddShare() {
    if (!diagnostic || !shareEmail.trim()) return
    setShareSaving(true); setShareError('')
    try {
      const res = await fetch(`/api/bcorp/${diagnostic.id}/shares`, {
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
      await fetch(`/api/bcorp/${diagnostic.id}/shares?shareId=${shareId}`, { method: 'DELETE' })
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-medium transition-colors">
          👥 Partager
        </button>
      </div>
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnostic, exportingExcel, exportingPDF])

  const lockedTabs = !org || !diagnostic ? ['dashboard', 'diagnostic', 'actions'] : []

  if (loading && !diagnostic) {
    return <div className="flex justify-center items-center py-20 text-gray-400 text-sm animate-pulse">
      {initializing ? 'Initialisation du diagnostic B Corp…' : 'Chargement…'}
    </div>
  }

  return (
    <div className="space-y-4">

      {/* ── Rapport PDF (monté hors-écran le temps de l'export) ─────────────── */}
      {pdfData && (
        <div style={{ position: 'absolute', left: -9999, top: 0 }} aria-hidden="true">
          <BcorpPDFReport id="bcorp-pdf-root" data={pdfData} />
        </div>
      )}

      {/* ── Modale Partage ──────────────────────────────────────────────────── */}
      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowShare(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-bold text-gray-900 dark:text-white">👥 Partager le diagnostic B Corp</h2>
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
          <span>Score de maturité B Corp :</span>
          <span className="font-bold text-gray-900 dark:text-white">{diagnostic.score_global ?? calculateBcorpScore(Object.fromEntries(Object.entries(reponses).map(([k, v]) => [k, v.niveau])))}/100</span>
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
                view === v.id ? 'border-amber-600 text-amber-700 dark:text-amber-400'
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
          score={diagnostic.score_global ?? calculateBcorpScore(Object.fromEntries(Object.entries(reponses).map(([k, v]) => [k, v.niveau])))}
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

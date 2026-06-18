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

// ─── Données statiques Label Numérique Responsable ───────────────────────────

export const LABEL_NR_AXES = [
  {
    id: 'gouvernance', label: 'Stratégie & Gouvernance NR', icon: '🧭',
    color: '#0d9488', colorLight: '#ccfbf1', weight: 0.20,
    description: "Engagement de la direction, stratégie Numérique Responsable formalisée, pilotage, indicateurs et amélioration continue.",
    criteres: [
      { id: 'nr-gov-strategie',       label: 'Stratégie Numérique Responsable formalisée et portée par la direction', description: "L'organisation a formalisé une stratégie Numérique Responsable, signée et portée par la direction générale, avec des objectifs chiffrés et un horizon de temps défini. Cette stratégie couvre les volets environnementaux, sociaux et éthiques du numérique et s'articule avec la politique RSE globale de l'organisation." },
      { id: 'nr-gov-pilotage',        label: 'Pilotage, référent NR et indicateurs de suivi', description: "Un référent Numérique Responsable est identifié, doté de moyens et d'un mandat clair pour piloter la démarche. Des indicateurs de suivi (empreinte du parc, taux de réemploi, consommation des services, accessibilité) sont définis, mesurés régulièrement et présentés aux instances de gouvernance." },
      { id: 'nr-gov-sensibilisation', label: 'Sensibilisation et formation des collaborateurs au NR', description: "Les collaborateurs sont sensibilisés aux enjeux du Numérique Responsable (impacts environnementaux, sobriété, inclusion) via des actions régulières : fresques du numérique, modules de formation, communication interne. Les équipes IT et métiers concernées bénéficient de formations approfondies (écoconception, achats responsables, accessibilité)." },
      { id: 'nr-gov-amelioration',    label: "Démarche d'amélioration continue et reporting NR", description: "La démarche NR s'inscrit dans une logique d'amélioration continue : revues périodiques, plan d'actions actualisé, objectifs réévalués annuellement. Les résultats et progrès sont publiés dans le reporting extra-financier de l'organisation (rapport RSE, DPEF, CSRD le cas échéant) avec transparence sur la méthodologie." },
    ],
  },
  {
    id: 'equipements', label: 'Achats & Équipements responsables', icon: '💻',
    color: '#2563eb', colorLight: '#dbeafe', weight: 0.20,
    description: "Allongement de la durée de vie des équipements, achats reconditionnés, critères environnementaux et sociaux dans les achats IT, gestion DEEE.",
    criteres: [
      { id: 'nr-equip-duree',         label: "Allongement de la durée de vie (réparation, réemploi, durée d'amortissement)", description: "L'organisation maximise la durée de vie de ses équipements numériques : politique de réparation systématique, réemploi interne, allongement des durées d'amortissement au-delà des standards (4-5 ans minimum pour les postes de travail). La fabrication représentant jusqu'à 80% de l'empreinte d'un terminal, cet axe est le levier environnemental majeur du NR." },
      { id: 'nr-equip-achats',        label: "Critères environnementaux et sociaux dans les achats IT (labels, reconditionné)", description: "Les achats IT intègrent des critères environnementaux et sociaux : labels exigeants (EPEAT, TCO Certified, Blue Angel), indice de réparabilité, part croissante d'équipements reconditionnés, vigilance sur les conditions d'extraction des minerais et la chaîne d'approvisionnement. Ces critères sont pondérés de manière significative dans les appels d'offres." },
      { id: 'nr-equip-deee',          label: 'Collecte et traitement des DEEE par des filières agréées', description: "Les équipements en fin de vie sont systématiquement collectés et traités via des filières agréées (éco-organismes, entreprises de l'ESS, reconditionneurs certifiés). L'organisation trace ses flux de DEEE, privilégie le don et le réemploi avant le recyclage, et obtient les certificats de traitement correspondants." },
      { id: 'nr-equip-mutualisation', label: "Rationalisation et mutualisation du parc (taux d'équipement par collaborateur)", description: "Le parc numérique est rationalisé : suivi du taux d'équipement par collaborateur, mutualisation des périphériques (impression, écrans, salles équipées), suppression des équipements redondants ou dormants. Un inventaire exhaustif et actualisé du parc permet de piloter ces optimisations et d'éviter le suréquipement." },
    ],
  },
  {
    id: 'ecoconception', label: 'Services numériques écoconçus', icon: '🌱',
    color: '#16a34a', colorLight: '#dcfce7', weight: 0.20,
    description: "Écoconception des sites, applications et services numériques (RGESN/GR491), sobriété fonctionnelle, mesure d'impact.",
    criteres: [
      { id: 'nr-eco-conception',  label: "Intégration de l'écoconception (RGESN, GR491) dans les projets numériques", description: "Les référentiels d'écoconception (RGESN — Référentiel Général d'Écoconception de Services Numériques, GR491 de l'INR) sont intégrés dès la conception des projets numériques : choix d'architecture sobres, optimisation des médias, limitation des requêtes et des dépendances. Les équipes de développement et les prestataires sont formés et contractuellement engagés sur ces exigences." },
      { id: 'nr-eco-sobriete',    label: 'Sobriété fonctionnelle et éditoriale (juste besoin, dette fonctionnelle)', description: "Chaque fonctionnalité est questionnée au regard du juste besoin des utilisateurs : suppression des fonctionnalités inutilisées (dette fonctionnelle), simplification des parcours, sobriété éditoriale des contenus publiés. Cette démarche de sobriété réduit à la fois l'empreinte environnementale, la complexité de maintenance et la charge cognitive des utilisateurs." },
      { id: 'nr-eco-mesure',      label: "Mesure de l'empreinte des services numériques (EcoIndex, ACV)", description: "L'empreinte environnementale des services numériques est mesurée avec des outils reconnus (EcoIndex, GreenIT-Analysis, analyses de cycle de vie) sur les parcours principaux. Des budgets environnementaux (poids de page, requêtes, EcoIndex cible) sont fixés, suivis dans le temps et intégrés aux critères de recette des projets." },
      { id: 'nr-eco-hebergement', label: 'Hébergement responsable (datacenters efficients, énergies renouvelables, PUE)', description: "Les services sont hébergés dans des datacenters performants sur le plan énergétique : PUE maîtrisé, alimentation en énergies renouvelables, engagement des hébergeurs (Code of Conduct européen, ISO/IEC 30134). La localisation des données, la juste allocation des ressources (dimensionnement, extinction des environnements inutiles) et la durée de rétention sont optimisées." },
    ],
  },
  {
    id: 'usages', label: 'Usages & Données responsables', icon: '📡',
    color: '#9333ea', colorLight: '#f3e8ff', weight: 0.20,
    description: "Sobriété des usages (mails, stockage, visio), gestion du cycle de vie des données, protection des données et cybersécurité.",
    criteres: [
      { id: 'nr-usage-sobriete', label: 'Sobriété des usages numériques (messagerie, stockage, streaming, visio)', description: "Des pratiques de sobriété numérique sont diffusées et outillées : bonnes pratiques de messagerie, nettoyage périodique des espaces de stockage, paramétrage raisonné de la visioconférence et du streaming. L'organisation mesure et communique sur l'évolution de ces usages pour ancrer durablement les comportements sobres." },
      { id: 'nr-usage-donnees',  label: 'Gestion du cycle de vie des données (archivage, suppression, dédoublonnage)', description: "Le cycle de vie des données est géré de bout en bout : politique d'archivage et de suppression définie par typologie de données, dédoublonnage, limitation des copies multiples et des sauvegardes redondantes. Cette gouvernance des données réduit l'empreinte du stockage tout en améliorant la qualité et la conformité du patrimoine informationnel." },
      { id: 'nr-usage-rgpd',     label: 'Protection des données personnelles (RGPD) et minimisation', description: "La conformité RGPD est assurée et dépasse la simple obligation légale : minimisation des données collectées, durées de conservation limitées et appliquées, registre des traitements à jour, information loyale des personnes. Le principe de minimisation rejoint directement la sobriété numérique en réduisant les volumes de données stockées et traitées." },
      { id: 'nr-usage-securite', label: 'Cybersécurité responsable et proportionnée', description: "La sécurité des systèmes d'information est assurée de manière proportionnée aux enjeux : analyse de risques, mesures de protection adaptées, sensibilisation des utilisateurs, plan de réponse aux incidents. Cette approche responsable évite à la fois la sous-protection (risques pour les parties prenantes) et la sur-sécurisation coûteuse en ressources et en énergie." },
    ],
  },
  {
    id: 'inclusion', label: 'Numérique inclusif & éthique', icon: '🤝',
    color: '#ea580c', colorLight: '#ffedd5', weight: 0.20,
    description: "Accessibilité numérique (RGAA), lutte contre la fracture numérique, éthique (IA, conception attentionnelle), contribution sociétale.",
    criteres: [
      { id: 'nr-incl-accessibilite', label: 'Accessibilité numérique des services (RGAA, WCAG)', description: "Les services numériques sont accessibles aux personnes en situation de handicap conformément au RGAA et aux WCAG : audits d'accessibilité réguliers, corrections priorisées, déclaration d'accessibilité publiée, formation des équipes de conception et de développement. L'accessibilité est intégrée dès la conception et vérifiée en recette, pas traitée a posteriori." },
      { id: 'nr-incl-fracture',      label: "Lutte contre l'exclusion et la fracture numérique", description: "L'organisation veille à ne pas exclure les publics éloignés du numérique : maintien d'alternatives non numériques pour les démarches essentielles, compatibilité des services avec des équipements anciens et des connexions limitées, actions de médiation numérique. Elle contribue, à son échelle, à la montée en compétence numérique de ses collaborateurs et de ses parties prenantes." },
      { id: 'nr-incl-ethique',       label: 'Éthique numérique (conception attentionnelle, IA responsable, transparence)', description: "Les services sont conçus dans le respect de l'attention et de l'autonomie des utilisateurs : absence de dark patterns et de mécanismes de captation attentionnelle, transparence des algorithmes et des traitements. Les usages de l'intelligence artificielle font l'objet d'un cadre éthique : cas d'usage justifiés, supervision humaine, vigilance sur les biais et sur l'empreinte environnementale des modèles." },
      { id: 'nr-incl-contribution',  label: 'Contribution sociétale et territoriale du numérique', description: "Le numérique de l'organisation contribue positivement au territoire et à la société : dons d'équipements aux structures de l'ESS, partenariats avec des acteurs de l'inclusion numérique, contribution aux communs numériques (open source, open data), partage de bonnes pratiques NR avec l'écosystème. Cette contribution est structurée, suivie et valorisée dans le reporting de l'organisation." },
    ],
  },
]

export const LABEL_NR_NIVEAUX = [
  { value: 0, shortLabel: 'NC', label: 'Non initié',  description: "Aucune démarche engagée sur ce critère",                          pct: 0,    color: '#9ca3af', bg: 'bg-gray-100 dark:bg-gray-700',        text: 'text-gray-600 dark:text-gray-400'   },
  { value: 1, shortLabel: '1',  label: 'Découverte',  description: "Prise de conscience, premières actions ponctuelles",              pct: 0.25, color: '#ef4444', bg: 'bg-red-50 dark:bg-red-900/20',        text: 'text-red-700 dark:text-red-400'     },
  { value: 2, shortLabel: '2',  label: 'Engagé',      description: "Démarche structurée, plan d'actions en cours de déploiement",     pct: 0.50, color: '#f97316', bg: 'bg-orange-50 dark:bg-orange-900/20',  text: 'text-orange-700 dark:text-orange-400' },
  { value: 3, shortLabel: '3',  label: 'Maîtrisé',    description: "Pratiques systématiques, mesurées et suivies dans le temps",      pct: 0.75, color: '#eab308', bg: 'bg-yellow-50 dark:bg-yellow-900/20',  text: 'text-yellow-700 dark:text-yellow-400' },
  { value: 4, shortLabel: '4',  label: 'Exemplaire',  description: "Pratiques exemplaires, résultats prouvés et partagés",            pct: 1.0,  color: '#14b8a6', bg: 'bg-teal-50 dark:bg-teal-900/20',      text: 'text-teal-700 dark:text-teal-400' },
]

const BADGE_LEVELS = [
  { label: 'Éligible Label NR niveau 2', min: 85, color: '#0d9488', icon: '⭐' },
  { label: 'Éligible Label NR niveau 1', min: 60, color: '#16a34a', icon: '✅' },
  { label: 'En démarche',                min: 30, color: '#f97316', icon: '🔄' },
  { label: 'Non initié',                 min: 0,  color: '#dc2626', icon: '❌' },
]

export function calculateLabelNrScore(niveaux: Record<string, number>): number {
  let total = 0
  for (const axe of LABEL_NR_AXES) {
    let axeScore = 0
    const nb = axe.criteres.length
    for (const c of axe.criteres) {
      const n = niveaux[c.id] ?? 0
      axeScore += (LABEL_NR_NIVEAUX[n]?.pct ?? 0) / nb
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
function btnP(extra = '') { return `px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors disabled:opacity-50 ${extra}` }
function btnS(extra = '') { return `px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm transition-colors ${extra}` }

const PRIORITE_COLORS = {
  haute:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  moyenne: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  basse:   'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}
const STATUT_COLORS = {
  a_faire:  'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  en_cours: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  termine:  'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
}
const STATUT_LABELS = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' }
const PRIORITE_LABELS = { haute: '🔴 Haute', moyenne: '🟡 Moyenne', basse: '🟢 Basse' }

function critereLabel(id: string): string {
  for (const axe of LABEL_NR_AXES) {
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
          <span className="text-4xl">💻</span>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Label Numérique Responsable (Label NR)</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Évaluez votre maturité Numérique Responsable et préparez votre labellisation NR</p>
          </div>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          Le <strong>Label Numérique Responsable (Label NR)</strong> est porté par l&apos;<strong>Agence LUCIE</strong> en partenariat avec
          l&apos;<strong>INR (Institut du Numérique Responsable)</strong>. Issu de la déclaration commune <strong>WeGreenIT</strong> et de la
          charte Numérique Responsable, il s&apos;appuie sur les référentiels <strong>GR491</strong> (guide de référence de conception responsable
          de services numériques) et <strong>RGESN</strong>. Il atteste qu&apos;une organisation réduit l&apos;empreinte environnementale de son
          numérique, conçoit des services plus sobres et accessibles, et met le numérique au service de l&apos;humain et des territoires.
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          Le label comporte <strong>2 paliers officiels</strong> : <strong>NR niveau 1</strong> (engagement dans la démarche, valable 18 mois)
          et <strong>NR niveau 2</strong> (démarche confirmée, valable 3 ans). L&apos;attribution repose sur un
          <strong> audit par un organisme tiers indépendant</strong>, garantissant la crédibilité de la labellisation.
        </p>
      </div>

      {/* Paliers du label + objectifs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={card('p-5 border-l-4 border-teal-500')}>
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">🏅 Les 2 paliers officiels du Label NR</h3>
          <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
            <div className="flex items-start gap-2">
              <span className="text-teal-600 font-bold flex-shrink-0">✅</span>
              <span><strong>Label NR niveau 1 — Engagement</strong> : la démarche est structurée et lancée, gouvernance en place, premiers plans d&apos;actions engagés. Valable <strong>18 mois</strong>.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-teal-600 font-bold flex-shrink-0">⭐</span>
              <span><strong>Label NR niveau 2 — Confirmé</strong> : la démarche est mature, mesurée et produit des résultats démontrables sur l&apos;ensemble des axes. Valable <strong>3 ans</strong>.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-teal-600 font-bold flex-shrink-0">🔍</span>
              <span><strong>Audit tiers indépendant</strong> : l&apos;attribution et le renouvellement reposent sur un audit documenté réalisé par un organisme tiers.</span>
            </div>
          </div>
        </div>

        <div className={card('p-5 border-l-4 border-blue-500')}>
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">📋 Référentiels mobilisés</h3>
          <div className="space-y-1">
            {[
              ['📗', 'GR491 — Guide de référence de conception responsable (INR)'],
              ['🌱', "RGESN — Référentiel général d'écoconception de services numériques"],
              ['♿', 'RGAA / WCAG — Accessibilité numérique'],
              ['🤝', 'Charte Numérique Responsable / déclaration WeGreenIT'],
              ['🏛️', 'ISO 26000 — Responsabilité sociétale'],
              ['📜', 'CSRD/ESRS — Reporting de durabilité (E1-E5)'],
              ['🏢', 'ISO/IEC 30134 — Indicateurs de performance datacenters'],
              ['🌍', 'ODD 9, 12 et 13 — Nations Unies'],
            ].map(([icon, label]) => (
              <div key={label} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <span>{icon}</span><span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Contexte réglementaire */}
      <div className={card('p-5 bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800')}>
        <h3 className="font-bold text-orange-700 dark:text-orange-400 mb-3">⚖️ Contexte — Qui est concerné et cadre réglementaire</h3>
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          {[
            "Entreprises et organisations de toute taille : TPE/PME, ETI, grands groupes, collectivités, associations — le Label NR est accessible à tous, avec des modalités adaptées à la taille",
            "Loi REEN (n°2021-1485) visant à réduire l'empreinte environnementale du numérique : stratégie numérique responsable obligatoire pour les communes et EPCI de plus de 50 000 habitants depuis 2025",
            "Loi AGEC : lutte contre l'obsolescence, indice de réparabilité des équipements électroniques, obligation d'achats reconditionnés dans la commande publique",
            "CSRD/ESRS : le numérique alimente le volet environnemental du reporting de durabilité (ESRS E1 climat, E5 économie circulaire notamment) pour les entreprises assujetties",
            "Le numérique représente environ 2,5% de l'empreinte carbone de la France, en forte croissance — la fabrication des terminaux en constitue près de 80%",
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
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Les 5 axes du diagnostic Numérique Responsable</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {LABEL_NR_AXES.map(axe => (
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
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Niveaux de maturité Numérique Responsable</h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {LABEL_NR_NIVEAUX.map(n => (
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
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Badge de maturité Numérique Responsable</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {BADGE_LEVELS.map(b => (
            <div key={b.label} className={card('p-4 text-center')}>
              <div className="text-3xl">{b.icon}</div>
              <div className="font-bold text-sm mt-1" style={{ color: b.color }}>{b.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">≥ {b.min}%</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">Seuils : 0-30% Non initié · 30-60% En démarche · 60-85% Éligible Label NR niveau 1 · 85-100% Éligible Label NR niveau 2</p>
      </div>

      {/* Comment utiliser */}
      <div className={card('p-5 space-y-3')}>
        <h3 className="font-semibold text-gray-900 dark:text-white">💡 Comment utiliser cette application</h3>
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          {[
            ['1', 'Diagnostic NR', "Pour chaque critère, évaluez votre niveau de maturité (NC à 4), documentez vos pratiques et créez des actions d'amélioration ciblées."],
            ['2', "Plan d'actions", "Visualisez et gérez toutes vos actions Numérique Responsable : priorité, responsable, échéance, statut d'avancement."],
            ['3', 'Documents & Preuves', "Uploadez directement dans SharePoint vos preuves documentaires (charte NR signée, inventaire du parc, audits RGAA/EcoIndex, certificats DEEE) classées par critère."],
            ['4', 'Export Excel', "Générez un rapport Excel structuré avec 6 onglets pour préparer votre dossier de labellisation NR et alimenter votre reporting RSE."],
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

function TableauDeBordView({
  reponses, actions, score,
}: {
  reponses: Record<string, Reponse>
  actions: Action[]
  score: number
}) {
  const badge = getBadge(score)

  const axeStats = LABEL_NR_AXES.map(axe => {
    const total = axe.criteres.length
    const niveaux = axe.criteres.map(c => reponses[c.id]?.niveau ?? 0)
    const pct = niveaux.reduce((s, n) => s + (LABEL_NR_NIVEAUX[n]?.pct ?? 0), 0) / total
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
          <div className="text-xs text-gray-400 mt-1">Seuils : 30% En démarche · 60% Niveau 1 · 85% Niveau 2</div>
        </div>

        {/* Radar */}
        <div className={card('p-4 sm:col-span-2')}>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Radar de maturité NR par axe</h3>
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
              <polygon points={dataPolygon} fill="#0d948822" stroke="#0d9488" strokeWidth="2.5" strokeLinejoin="round" />
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
                  const niv = LABEL_NR_NIVEAUX[n]
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
            { label: 'Terminées', count: actions.filter(a => a.statut === 'termine').length,  color: 'text-teal-600 dark:text-teal-400' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>
        {actions.length > 0 && (
          <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div className="h-2 rounded-full bg-teal-500 transition-all" style={{ width: `${Math.round(actions.filter(a => a.statut === 'termine').length / actions.length * 100)}%` }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Vue Correspondances ──────────────────────────────────────────────────────

const CORRESPONDANCES_NR = [
  {
    categorie: "Applications RSE Sens'ethO",
    icon: '🏠',
    color: 'indigo',
    items: [
      {
        ref: 'Diagnostic initial ISO 26000', icon: '⚙️', route: '/rse/iso26000',
        desc: "ISO 26000 — La démarche Numérique Responsable couvre les questions centrales Environnement, Loyauté des pratiques et Questions relatives aux consommateurs appliquées au système d'information",
        liens: [
          { axe: 'gouvernance',   label: 'Gouvernance',   ref: 'ISO 26000 — Gouvernance de l\'organisation appliquée au numérique' },
          { axe: 'equipements',   label: 'Équipements',   ref: 'ISO 26000 — Environnement : utilisation durable des ressources, cycle de vie' },
          { axe: 'inclusion',     label: 'Inclusion',     ref: 'ISO 26000 — Questions consommateurs : accès aux services essentiels, protection des données' },
        ],
      },
      {
        ref: 'ACT Bas-Carbone', icon: '🌱', route: '/rse/act-carbone',
        desc: "ACT Bas-Carbone (ADEME/CDP) — l'empreinte carbone du numérique (équipements, hébergement, usages) alimente le bilan GES Scopes 2 et 3 et le plan de transition climatique",
        liens: [
          { axe: 'equipements',   label: 'Équipements',   ref: 'ACT — Scope 3 achats : empreinte de fabrication des équipements IT' },
          { axe: 'ecoconception', label: 'Écoconception', ref: 'ACT — Réduction des émissions liées à l\'hébergement et aux services' },
          { axe: 'usages',        label: 'Usages',        ref: 'ACT — Sobriété des usages : réduction des consommations énergétiques numériques' },
        ],
      },
      {
        ref: 'EcoVadis Diagnostic', icon: '🥇', route: '/rse/ecovadis',
        desc: "EcoVadis — la démarche NR alimente les thèmes Environnement et Achats responsables de la notation EcoVadis (politiques, actions, résultats sur le numérique durable)",
        liens: [
          { axe: 'gouvernance',   label: 'Gouvernance',   ref: 'EcoVadis — Politiques et reporting environnementaux documentés' },
          { axe: 'equipements',   label: 'Équipements',   ref: 'EcoVadis — Achats responsables : critères ESG dans les achats IT' },
        ],
      },
      {
        ref: 'Label Engagé RSE AFNOR', icon: '🏅', route: '/rse/afnor-rse',
        desc: "Label Engagé RSE (AFNOR) — la maturité Numérique Responsable nourrit l'évaluation AFNOR sur l'ancrage de la RSE dans les processus support et les achats",
        liens: [
          { axe: 'gouvernance',   label: 'Gouvernance',   ref: 'AFNOR — Vision et gouvernance : intégration du NR dans la stratégie RSE' },
          { axe: 'inclusion',     label: 'Inclusion',     ref: 'AFNOR — Ancrage territorial et contribution sociétale du numérique' },
        ],
      },
      {
        ref: 'ODD — Objectifs de Développement Durable', icon: '🌍', route: '/rse/odd-iso26000',
        desc: "ODD — le Numérique Responsable contribue directement aux ODD 9 (infrastructures durables), 12 (consommation responsable) et 13 (action climatique)",
        liens: [
          { axe: 'equipements',   label: 'Équipements',   ref: 'ODD 12 — Modes de consommation et de production durables (cycle de vie IT)' },
          { axe: 'ecoconception', label: 'Écoconception', ref: 'ODD 9 — Infrastructures résilientes et innovation durable' },
          { axe: 'usages',        label: 'Usages',        ref: 'ODD 13 — Lutte contre les changements climatiques (sobriété énergétique)' },
        ],
      },
    ],
  },
  {
    categorie: 'Référentiels Numérique Responsable',
    icon: '📗',
    color: 'teal',
    items: [
      {
        ref: 'GR491 — Guide de référence INR', icon: '📗', route: null,
        desc: "GR491 (INR) — guide de référence de conception responsable de services numériques : 516 critères couvrant stratégie, UX, contenus, frontend, backend, hébergement",
        liens: [
          { axe: 'ecoconception', label: 'Écoconception', ref: 'GR491 — Familles Architecture, Frontend, Backend, Contenus, Hébergement' },
          { axe: 'gouvernance',   label: 'Gouvernance',   ref: 'GR491 — Famille Stratégie : pilotage et engagement de la conception responsable' },
        ],
      },
      {
        ref: 'RGESN — Écoconception de services numériques', icon: '🌱', route: null,
        desc: "RGESN (ARCEP/DINUM/ADEME) — référentiel général d'écoconception de services numériques : 78 critères et déclaration d'écoconception",
        liens: [
          { axe: 'ecoconception', label: 'Écoconception', ref: 'RGESN — Critères stratégie, spécifications, UX/UI, contenus, frontend, backend, hébergement' },
        ],
      },
      {
        ref: 'RGAA — Accessibilité numérique', icon: '♿', route: null,
        desc: "RGAA (Référentiel Général d'Amélioration de l'Accessibilité) — 106 critères de conformité WCAG pour rendre les services numériques accessibles à tous",
        liens: [
          { axe: 'inclusion', label: 'Inclusion', ref: 'RGAA — Audit, déclaration d\'accessibilité et schéma pluriannuel de mise en conformité' },
        ],
      },
      {
        ref: 'Loi REEN (n°2021-1485)', icon: '⚖️', route: null,
        desc: "Loi visant à Réduire l'Empreinte Environnementale du Numérique — stratégie NR obligatoire pour les collectivités de plus de 50 000 habitants, lutte contre l'obsolescence",
        liens: [
          { axe: 'gouvernance', label: 'Gouvernance', ref: 'Loi REEN — Stratégie numérique responsable territoriale et plan d\'actions' },
          { axe: 'equipements', label: 'Équipements', ref: 'Loi REEN / AGEC — Allongement de la durée de vie, réemploi, indice de réparabilité' },
        ],
      },
      {
        ref: 'ISO/IEC 30134 — Datacenters', icon: '🏢', route: null,
        desc: "ISO/IEC 30134 — indicateurs de performance des datacenters : PUE (efficacité énergétique), REF (énergies renouvelables), WUE (eau), ITEU (utilisation des équipements)",
        liens: [
          { axe: 'ecoconception', label: 'Écoconception', ref: 'ISO/IEC 30134-2 — PUE : Power Usage Effectiveness des hébergements' },
        ],
      },
    ],
  },
  {
    categorie: 'Standards de reporting et labels généralistes',
    icon: '📐',
    color: 'blue',
    items: [
      {
        ref: 'CSRD — ESRS E1 à E5', icon: '📜', route: null,
        desc: "CSRD/ESRS — le numérique alimente le reporting de durabilité : E1 (énergie/GES du SI), E5 (économie circulaire des équipements), et les volets sociaux (accessibilité, données)",
        liens: [
          { axe: 'equipements',   label: 'Équipements',   ref: 'ESRS E5 — Ressources entrantes/sortantes : équipements IT, DEEE, réemploi' },
          { axe: 'ecoconception', label: 'Écoconception', ref: 'ESRS E1 — Consommation énergétique des services numériques et de l\'hébergement' },
        ],
      },
      {
        ref: 'GRI Standards', icon: '📋', route: null,
        desc: "GRI Standards — GRI 301 (matières), GRI 302 (énergie), GRI 305 (émissions), GRI 306 (déchets/DEEE) et GRI 418 (protection des données des clients)",
        liens: [
          { axe: 'equipements', label: 'Équipements', ref: 'GRI 301/306 — Matières premières des équipements et gestion des DEEE' },
          { axe: 'usages',      label: 'Usages',      ref: 'GRI 418 — Protection des données et de la vie privée des clients' },
        ],
      },
      {
        ref: 'ODD 9, 12 et 13 — Nations Unies', icon: '🌍', route: null,
        desc: "Objectifs de Développement Durable — ODD 9 (industrie, innovation, infrastructures), ODD 12 (consommation et production responsables), ODD 13 (action climatique)",
        liens: [
          { axe: 'equipements', label: 'Équipements', ref: 'ODD 12.5 — Réduction de la production de déchets (prévention, réduction, recyclage, réemploi)' },
          { axe: 'inclusion',   label: 'Inclusion',   ref: 'ODD 9.c — Accès universel aux technologies de l\'information et de la communication' },
        ],
      },
      {
        ref: 'B Corp', icon: '🅱️', route: null,
        desc: "Certification B Corp — le volet Environnement et le volet Clients (protection des données, accessibilité) du B Impact Assessment valorisent les pratiques NR",
        liens: [
          { axe: 'gouvernance', label: 'Gouvernance', ref: 'B Corp — Gouvernance à mission : intégration des impacts du numérique' },
          { axe: 'usages',      label: 'Usages',      ref: 'B Corp — Clients : éthique des données et protection de la vie privée' },
        ],
      },
      {
        ref: 'ISO 26000', icon: '🏛️', route: null,
        desc: "ISO 26000 — lignes directrices de la responsabilité sociétale : le NR décline l'environnement, la loyauté des pratiques et les questions consommateurs sur le périmètre numérique",
        liens: [
          { axe: 'inclusion', label: 'Inclusion', ref: 'ISO 26000 — Implication auprès des communautés et développement local (inclusion numérique)' },
        ],
      },
    ],
  },
]

const AXE_BADGE_CLS: Record<string, string> = {
  gouvernance:   'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  equipements:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  ecoconception: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  usages:        'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  inclusion:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
}

function CorrespondancesView() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className={card('p-4')}>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Le Label Numérique Responsable s&apos;articule avec l&apos;ensemble de votre démarche RSE.
          Les correspondances ci-dessous permettent de mutualiser vos efforts entre le Label NR, l&apos;ISO 26000,
          la CSRD/ESRS, les GRI Standards, les ODD et les référentiels spécifiques du numérique durable
          (GR491, RGESN, RGAA, ISO/IEC 30134, loi REEN, B Corp).
        </p>
      </div>

      {CORRESPONDANCES_NR.map(cat => (
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
                          const axe = LABEL_NR_AXES.find(a => a.id === l.axe)
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
    const res = await fetch(`/api/label-nr/${diagnosticId}/actions`, {
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
    await fetch(`/api/label-nr/${diagnosticId}/actions?action_id=${id}`, { method: 'DELETE' })
    onActionsChange(actions.filter(a => a.id !== id))
  }

  async function saveEdit(id: string) {
    setSavingEdit(true)
    const res = await fetch(`/api/label-nr/${diagnosticId}/actions?action_id=${id}`, {
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
    const res = await fetch(`/api/label-nr/${diagnosticId}/actions?action_id=${action.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: next }),
    })
    if (res.ok) {
      const { data } = await res.json()
      onActionsChange(actions.map(a => a.id === action.id ? data : a))
    }
  }

  const niv = LABEL_NR_NIVEAUX[niveau]

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
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">Niveau de maturité NR</div>
          {savingReponse && <span className="text-xs text-gray-400 animate-pulse">Enregistrement…</span>}
          {savedOk && !savingReponse && <span className="text-xs text-teal-600 dark:text-teal-400">✓ Sauvegardé</span>}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {LABEL_NR_NIVEAUX.map(n => (
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
        <p className="text-xs text-gray-500 dark:text-gray-400">Décrivez vos pratiques actuelles, les données de votre inventaire numérique, les audits réalisés (EcoIndex, RGAA) et les points d&apos;amélioration identifiés.</p>
        <textarea
          value={commentaire}
          onChange={e => handleCommentaireChange(e.target.value)}
          rows={4}
          placeholder="Ex : Charte NR signée en 2025. Inventaire du parc réalisé : 1,4 équipement/collaborateur. Audit RGAA prévu au T3…"
          className={`${inputCls()} resize-y`}
        />
        <GuidedActionNotePanel
          diagnosticId={diagnosticId}
          actionKey={critere.id}
          apiBase="/api/label-nr"
          noteTable="label_nr_notes"
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
            🎯 Actions Numérique Responsable
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
              <input className={inputCls()} value={actionForm.titre} onChange={e => setActionForm(f => ({ ...f, titre: e.target.value }))} placeholder="Ex : Porter la durée d'amortissement des laptops à 5 ans dès 2026" />
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
          <p className="text-xs text-gray-400 text-center py-3">Aucune action — créez des mesures concrètes pour progresser vers le Label NR</p>
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
                        apiBase="/api/label-nr"
                        noteTable="label_nr_notes"
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
  const [activeAxe, setActiveAxe] = useState(LABEL_NR_AXES[0].id)
  const [activeCritere, setActiveCritere] = useState<string | null>(LABEL_NR_AXES[0].criteres[0].id)

  const niveaux: Record<string, number> = {}
  for (const [k, v] of Object.entries(reponses)) niveaux[k] = v.niveau
  const scoreGlobal = calculateLabelNrScore(niveaux)
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
            {LABEL_NR_AXES.map(axe => {
              const axeNiveaux = axe.criteres.map(c => niveaux[c.id] ?? 0)
              const axePct = Math.round(axeNiveaux.reduce((s, n) => s + LABEL_NR_NIVEAUX[n].pct, 0) / axe.criteres.length * 100)
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
            {LABEL_NR_AXES.map(axe => {
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
                        const niv = LABEL_NR_NIVEAUX[n]
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
            const axe = LABEL_NR_AXES.find(a => a.criteres.some(c => c.id === activeCritere))!
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
    const axe = LABEL_NR_AXES.find(x => x.criteres.some(c => c.id === a.critere_id))
    if (filterAxe !== 'all' && axe?.id !== filterAxe) return false
    if (filterPriorite !== 'all' && a.priorite !== filterPriorite) return false
    if (filterStatut !== 'all' && a.statut !== filterStatut) return false
    return true
  })

  const total = actions.length
  const termines = actions.filter(a => a.statut === 'termine').length

  async function saveEdit(id: string) {
    setSaving(true)
    const res = await fetch(`/api/label-nr/${diagnostic.id}/actions?action_id=${id}`, {
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
    await fetch(`/api/label-nr/${diagnostic.id}/actions?action_id=${id}`, { method: 'DELETE' })
    onActionsChange(actions.filter(a => a.id !== id))
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total actions', value: total,    color: 'text-gray-700 dark:text-gray-300' },
          { label: 'En cours',      value: actions.filter(a => a.statut === 'en_cours').length, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Terminées',     value: `${termines} (${total ? Math.round(termines / total * 100) : 0}%)`, color: 'text-teal-600 dark:text-teal-400' },
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
          {LABEL_NR_AXES.map(a => <option key={a.id} value={a.id}>{a.icon} {a.label}</option>)}
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
          const axe = LABEL_NR_AXES.find(x => x.criteres.some(c => c.id === a.critere_id))
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
  { id: 'diagnostic',      label: 'Diagnostic NR',   icon: '💻' },
  { id: 'actions',         label: "Plan d'actions",  icon: '📝' },
  { id: 'correspondances', label: 'Correspondances', icon: '🔗' },
]

export default function LabelNrDiagnosticApp({ ctx }: { ctx: RseContext }) {
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
  const [shareList, setShareList] = useState<{ id: string; email: string; permission: 'read'|'edit' }[]>([])

  const load = useCallback(async () => {
    if (!org || !year) return
    setLoading(true)
    try {
      const res = await fetch(`/api/label-nr?org_id=${org.id}&annee=${year}`)
      const { data: existingDiag } = await res.json()

      let diagId = existingDiag?.id
      if (!diagId) {
        setInitializing(true)
        const createRes = await fetch('/api/label-nr', {
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
        fetch(`/api/label-nr/${diagId}/reponses`),
        fetch(`/api/label-nr/${diagId}/actions`),
        fetch(`/api/label-nr/${diagId}/notes`),
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
    await fetch(`/api/label-nr/${diagnostic.id}/reponses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ critere_id, niveau, commentaire }),
    })
    setTimeout(async () => {
      setReponses(current => {
        const n2: Record<string, number> = {}
        for (const [k, v] of Object.entries(current)) n2[k] = v.niveau
        const score = calculateLabelNrScore(n2)
        if (diagnostic) {
          fetch(`/api/label-nr/${diagnostic.id}`, {
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
    fetch(`/api/label-nr/${diagnostic.id}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_key: critere_id, content }),
    }).catch(e => console.error('[label-nr/notes]', e))
  }

  function handleNoteSectionsChange(critere_id: string, sections: NoteSection[]) {
    setNoteSections(prev => ({ ...prev, [critere_id]: sections }))
    if (!diagnostic) return
    fetch(`/api/label-nr/${diagnostic.id}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_key: critere_id, sections }),
    }).catch(e => console.error('[label-nr/notes/sections]', e))
  }

  async function handleExportExcel() {
    if (!diagnostic) return
    setExportingExcel(true)
    try {
      const res = await fetch(`/api/label-nr/${diagnostic.id}/export-excel`)
      if (!res.ok) throw new Error('Échec export')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `Label_NR_${org?.nom ?? 'diagnostic'}_${year}.xlsx`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { alert('Erreur export Excel : ' + String(e)) }
    finally { setExportingExcel(false) }
  }

  function handleExportPDF() {
    window.print()
  }

  const loadShares = useCallback(async () => {
    if (!diagnostic) return
    try {
      const res = await fetch(`/api/label-nr/${diagnostic.id}/shares`)
      const { data } = await res.json()
      setShareList(data ?? [])
    } catch { /* ignore */ }
  }, [diagnostic])

  useEffect(() => { if (showShare) loadShares() }, [showShare, loadShares])

  async function handleAddShare() {
    if (!diagnostic || !shareEmail.trim()) return
    setShareSaving(true); setShareError('')
    try {
      const res = await fetch(`/api/label-nr/${diagnostic.id}/shares`, {
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
      await fetch(`/api/label-nr/${diagnostic.id}/shares?shareId=${shareId}`, { method: 'DELETE' })
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
        <button onClick={handleExportPDF}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          📄 PDF
        </button>
        <button onClick={() => setShowShare(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium transition-colors">
          👥 Partager
        </button>
      </div>
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnostic, exportingExcel])

  const lockedTabs = !org || !diagnostic ? ['dashboard', 'diagnostic', 'actions'] : []

  if (loading && !diagnostic) {
    return <div className="flex justify-center items-center py-20 text-gray-400 text-sm animate-pulse">
      {initializing ? 'Initialisation du diagnostic Label NR…' : 'Chargement…'}
    </div>
  }

  return (
    <div className="space-y-4">

      {/* ── Modale Partage ──────────────────────────────────────────────────── */}
      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowShare(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-bold text-gray-900 dark:text-white">👥 Partager le diagnostic Label NR</h2>
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
          <span>Score de maturité NR :</span>
          <span className="font-bold text-gray-900 dark:text-white">{diagnostic.score_global ?? calculateLabelNrScore(Object.fromEntries(Object.entries(reponses).map(([k, v]) => [k, v.niveau])))}/100</span>
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
                view === v.id ? 'border-teal-500 text-teal-600 dark:text-teal-400'
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
          score={diagnostic.score_global ?? calculateLabelNrScore(Object.fromEntries(Object.entries(reponses).map(([k, v]) => [k, v.niveau])))}
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

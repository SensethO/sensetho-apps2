/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import type { RseContext } from '@/components/rse/RseAppShell'
import ConfirmModal from '@/components/ui/ConfirmModal'
import ShareAutocomplete from '@/components/apps/ShareAutocomplete'
import type { NoteSection } from '@/components/apps/GuidedActionNotePanel'
import type { GpsrPdfData } from '@/components/apps/GpsrPDFReport'

// GuidedActionNotePanel chargé en lazy — même pattern que les autres apps RSE
const GuidedActionNotePanel = dynamic(() => import('@/components/apps/GuidedActionNotePanel'), {
  ssr: false,
  loading: () => <div className="py-3 text-xs text-gray-400 animate-pulse">Chargement éditeur…</div>
})

// Rapport PDF chargé en lazy (html2canvas + jspdf hors du bundle principal)
const GpsrPDFReport = dynamic(() => import('@/components/apps/GpsrPDFReport'), {
  ssr: false,
  loading: () => null,
})

// ─── Données statiques Diagnostic GPSR ────────────────────────────────────────

export const GPSR_AXES = [
  {
    id: 'gouvernance', label: 'Gouvernance & Documentation produit', icon: '🧭',
    color: '#0284c7', colorLight: '#e0f2fe', weight: 0.20,
    description: "Organisation de la conformité produit, analyse interne des risques, documentation technique, traçabilité et marquage.",
    criteres: [
      { id: 'gpsr-gov-organisation', label: "Organisation de la conformité produit (responsable identifié, processus, veille réglementaire)", description: "L'organisation a structuré sa conformité au règlement (UE) 2023/988 : un responsable de la sécurité des produits est clairement identifié, des processus internes couvrent l'ensemble du cycle de mise sur le marché et une veille réglementaire suit l'évolution des exigences européennes et nationales (normes harmonisées, lignes directrices de la Commission, doctrine DGCCRF). Cette gouvernance garantit que chaque nouvelle référence produit fait l'objet d'un passage en revue de conformité avant sa commercialisation. Les responsabilités sont documentées, les équipes concernées (achats, qualité, juridique, e-commerce) sont formées et les arbitrages de sécurité remontent au bon niveau de décision." },
      { id: 'gpsr-gov-analyse', label: "Analyse interne des risques documentée pour chaque produit (art. 9)", description: "Conformément à l'article 9 du GPSR, le fabricant procède à une analyse interne des risques pour chaque produit mis sur le marché : identification des dangers, estimation des risques pour les utilisateurs (y compris les usages raisonnablement prévisibles et les mésusages), et mesures de réduction des risques retenues. Cette analyse est formalisée, datée et versionnée : elle constitue la pièce maîtresse de la documentation technique et la preuve de la diligence du fabricant. Elle est actualisée en cas de modification du produit, d'évolution des normes ou de retour d'expérience du marché (réclamations, accidents, alertes Safety Gate)." },
      { id: 'gpsr-gov-documentation', label: "Documentation technique constituée et tenue à jour (10 ans)", description: "Une documentation technique est constituée pour chaque produit : description générale, caractéristiques essentielles de sécurité, analyse des risques, liste des normes européennes appliquées ou autres solutions retenues pour satisfaire à l'obligation générale de sécurité. Cette documentation est tenue à jour et conservée pendant dix ans à compter de la mise sur le marché, à la disposition des autorités de surveillance. Un processus interne garantit sa complétude, sa traçabilité documentaire (versions, dates) et sa disponibilité rapide en cas de demande de la DGCCRF ou d'une autorité d'un autre État membre." },
      { id: 'gpsr-gov-tracabilite', label: "Identification et traçabilité des produits (lot, type, marquages, coordonnées fabricant)", description: "Chaque produit porte les éléments d'identification exigés par le GPSR : numéro de type, de lot ou de série permettant son identification, nom et coordonnées (adresse postale et électronique) du fabricant et, le cas échéant, de la personne responsable dans l'UE. Ces mentions figurent sur le produit ou, à défaut, sur l'emballage ou un document d'accompagnement, de manière visible et lisible. La traçabilité interne permet de relier chaque lot à ses fournisseurs, ses contrôles et ses circuits de distribution, condition indispensable pour cibler efficacement un rappel ou un retrait du marché." },
    ],
  },
  {
    id: 'evaluation', label: 'Évaluation de la sécurité des produits', icon: '🔬',
    color: '#dc2626', colorLight: '#fee2e2', weight: 0.20,
    description: "Critères de sécurité de l'art. 6 : caractéristiques, interactions, cybersécurité, consommateurs vulnérables, normes et essais.",
    criteres: [
      { id: 'gpsr-eval-criteres', label: "Évaluation selon les critères de l'art. 6 (caractéristiques, présentation, étiquetage, interaction avec d'autres produits)", description: "La sécurité de chaque produit est évaluée au regard des critères de l'article 6 du GPSR : caractéristiques du produit (conception, composition, emballage, conditions d'assemblage, d'installation et d'entretien), effet sur d'autres produits en cas d'utilisation conjointe raisonnablement prévisible, présentation, étiquetage, avertissements et instructions d'utilisation et d'élimination. Cette évaluation couvre l'ensemble du cycle de vie du produit et tient compte des catégories d'utilisateurs visées. Les conclusions sont tracées dans l'analyse des risques et orientent la conception, l'étiquetage et la notice de chaque référence." },
      { id: 'gpsr-eval-normes', label: "Application des normes européennes et référentiels pertinents (présomption de sécurité)", description: "L'organisation identifie et applique les normes européennes pertinentes dont les références sont publiées au JOUE au titre du GPSR : un produit conforme à ces normes bénéficie d'une présomption de conformité à l'obligation générale de sécurité. En l'absence de norme européenne, d'autres référentiels sont mobilisés : normes nationales, recommandations de la Commission, codes de bonne conduite, état de l'art et de la technique. Des essais (internes ou en laboratoire accrédité) valident la conformité aux exigences normatives et les rapports d'essais sont intégrés à la documentation technique." },
      { id: 'gpsr-eval-connectes', label: "Sécurité des produits connectés : cybersécurité et fonctionnalités évolutives (mises à jour logicielles)", description: "Pour les produits intégrant des fonctions numériques, l'évaluation de sécurité couvre les exigences nouvelles du GPSR : propriétés de cybersécurité appropriées pour protéger le produit contre les influences extérieures malveillantes, et prise en compte des fonctionnalités évolutives, d'apprentissage et prédictives. Les mises à jour logicielles sont gérées comme des modifications du produit : une mise à jour substantielle peut requalifier le produit et déclencher une nouvelle analyse des risques. L'organisation maîtrise la durée de support logiciel, la distribution sécurisée des correctifs et l'information des utilisateurs sur les mises à jour de sécurité." },
      { id: 'gpsr-eval-vulnerables', label: "Prise en compte des consommateurs vulnérables (enfants, personnes âgées, handicap) et produits d'apparence alimentaire", description: "L'évaluation des risques intègre explicitement les catégories de consommateurs vulnérables : enfants, personnes âgées, personnes en situation de handicap, dont l'utilisation du produit doit être anticipée même lorsqu'ils ne constituent pas la cible commerciale. Les exigences spécifiques (sécurité des jouets d'apparence, petites pièces, accès aux piles bouton, points de coincement) sont vérifiées. Le GPSR intègre par ailleurs l'ancienne directive 87/357/CEE : les produits d'apparence alimentaire, qui peuvent être confondus avec des denrées et portés à la bouche, font l'objet d'une vigilance renforcée, notamment pour les cosmétiques, objets décoratifs et fournitures ludiques." },
    ],
  },
  {
    id: 'operateurs', label: 'Chaîne de valeur & Opérateurs économiques', icon: '🔗',
    color: '#7c3aed', colorLight: '#ede9fe', weight: 0.20,
    description: "Obligations fabricant/importateur/distributeur, personne responsable UE, prestataires d'exécution.",
    criteres: [
      { id: 'gpsr-ope-roles', label: "Qualification du rôle (fabricant, importateur, distributeur, mandataire) et obligations associées", description: "Pour chaque référence produit, l'organisation a qualifié son rôle au sens du GPSR — fabricant, importateur, distributeur ou mandataire — et applique les obligations correspondantes : le fabricant réalise l'analyse des risques et la documentation technique, l'importateur vérifie que le fabricant a satisfait à ses obligations avant la mise sur le marché, le distributeur vérifie les marquages et informations avant la mise à disposition. Les cas particuliers sont identifiés : l'opérateur qui modifie substantiellement un produit ou le commercialise sous sa propre marque devient fabricant avec l'intégralité des obligations associées. Cette cartographie des rôles est documentée et revue lors de tout changement de la chaîne d'approvisionnement." },
      { id: 'gpsr-ope-responsable', label: "Personne responsable établie dans l'UE pour chaque produit (art. 16 — condition de mise sur le marché)", description: "Conformément à l'article 16 du GPSR, aucun produit n'est mis sur le marché de l'Union sans qu'un opérateur économique établi dans l'UE soit responsable de ce produit : fabricant établi dans l'UE, importateur, mandataire désigné par mandat écrit, ou prestataire de services d'exécution de commandes. Cette personne responsable vérifie la documentation technique, la tient à disposition des autorités, coopère avec elles et informe le fabricant en cas de risque identifié. Son nom et ses coordonnées figurent sur le produit ou son emballage. Cette exigence s'applique aussi aux produits vendus en ligne depuis des pays tiers : l'organisation a vérifié ce point pour l'ensemble de son catalogue." },
      { id: 'gpsr-ope-fournisseurs', label: "Maîtrise des fournisseurs et sous-traitants (exigences sécurité, contrôles, audits)", description: "Les exigences de sécurité produit sont contractualisées avec les fournisseurs et sous-traitants : cahiers des charges intégrant les normes applicables, obligation de signalement des modifications de composition ou de procédé, droit d'audit et exigences documentaires (rapports d'essais, certificats, déclarations). Des contrôles proportionnés au risque sont réalisés : qualification initiale des fournisseurs, inspections en cours de production, contrôles à réception et essais par sondage. Les non-conformités fournisseurs sont tracées et donnent lieu à des plans d'actions correctives, voire au déréférencement, et la performance sécurité des fournisseurs est revue périodiquement." },
      { id: 'gpsr-ope-fulfilment', label: "Coordination avec les prestataires d'exécution de commandes et la logistique", description: "Les prestataires de services d'exécution de commandes (fulfilment) sont identifiés comme des opérateurs économiques à part entière du GPSR : lorsqu'aucun fabricant, importateur ou mandataire n'est établi dans l'UE, c'est le prestataire d'exécution qui devient la personne responsable du produit. L'organisation a cartographié ses flux logistiques (entrepôts, prestataires, dropshipping) et contractualisé les responsabilités : conditions de stockage et de manutention préservant la sécurité des produits, blocage des lots non conformes, exécution rapide des retraits et rappels. La coordination opérationnelle permet d'arrêter la distribution d'un produit dangereux dans toute la chaîne en quelques heures." },
    ],
  },
  {
    id: 'vad', label: 'Vente en ligne & Information consommateur', icon: '🛒',
    color: '#16a34a', colorLight: '#dcfce7', weight: 0.20,
    description: "Exigences de la vente à distance (art. 19), places de marché, informations et avertissements obligatoires.",
    criteres: [
      { id: 'gpsr-vad-fiches', label: "Offres en ligne conformes (art. 19) : identité du fabricant, personne responsable UE, identification du produit, avertissements en langue locale", description: "Conformément à l'article 19 du GPSR, chaque offre de produit en ligne comporte de manière claire et visible : le nom, la raison sociale et les coordonnées (adresse postale et électronique) du fabricant, celles de la personne responsable établie dans l'UE si le fabricant n'y est pas établi, les informations permettant d'identifier le produit (photographie, type, identifiant), ainsi que les avertissements et informations de sécurité dans une langue facilement compréhensible par les consommateurs de l'État membre de commercialisation. Les fiches produit du site marchand et des canaux tiers sont auditées régulièrement et un processus garantit la complétude de ces mentions à la création de chaque nouvelle fiche." },
      { id: 'gpsr-vad-marketplaces', label: "Conformité sur les places de marché (obligations des fournisseurs de marketplaces, retrait en 2 jours ouvrés)", description: "Lorsque les produits sont vendus via des places de marché en ligne, l'organisation maîtrise les obligations croisées du GPSR : les fournisseurs de marketplaces doivent s'enregistrer au Safety Gate, désigner un point de contact unique, organiser leurs interfaces pour permettre l'affichage des informations de sécurité, et retirer les offres de produits dangereux notifiées par les autorités dans un délai de deux jours ouvrés. En tant que vendeur, l'organisation fournit aux plateformes les informations exigées (identité, personne responsable UE, avertissements), surveille les notifications de retrait la concernant et traite sans délai les signalements transmis par les marketplaces." },
      { id: 'gpsr-vad-avertissements', label: "Avertissements et instructions de sécurité clairs, dans les langues des États membres de commercialisation", description: "Chaque produit est accompagné d'instructions claires et d'avertissements de sécurité rédigés dans la ou les langues officielles des États membres où il est commercialisé, déterminées conformément aux exigences nationales. Les avertissements sont visibles, lisibles et compréhensibles : pictogrammes normalisés, mentions d'âge, précautions d'emploi, consignes d'installation, d'entretien et d'élimination. La gestion multilingue est industrialisée : matrice langues/pays par référence, traductions validées, mise à jour synchronisée des notices, emballages et fiches produit en ligne lors de chaque évolution du produit ou de la réglementation." },
      { id: 'gpsr-vad-publicite', label: "Loyauté de la présentation et de la publicité (pas de minimisation des risques)", description: "La présentation des produits, leur publicité et leur marketing ne minimisent pas les risques et n'induisent pas le consommateur en erreur sur la sécurité : pas de visuels montrant un usage dangereux ou non conforme aux instructions (enfant sans équipement de protection, détournement d'usage), pas d'allégations suggérant une sécurité absolue, pas de présentation laissant croire qu'un produit convient à une catégorie d'utilisateurs qu'il pourrait mettre en danger. Les contenus commerciaux (packaging, site, réseaux sociaux, fiches marketplaces, influence) sont relus sous l'angle sécurité avant publication, en cohérence avec les avertissements du produit et les exigences de loyauté vis-à-vis du consommateur." },
    ],
  },
  {
    id: 'surveillance', label: 'Surveillance, Incidents & Rappels', icon: '🚨',
    color: '#ea580c', colorLight: '#ffedd5', weight: 0.20,
    description: "Obligations de suivi du marché, signalement des accidents, Safety Gate / Safety Business Gateway, rappels et recours des consommateurs.",
    criteres: [
      { id: 'gpsr-surv-veille', label: "Surveillance des produits mis sur le marché (réclamations, registre des plaintes, tests par sondage)", description: "L'organisation surveille activement la sécurité des produits qu'elle a mis sur le marché : registre des réclamations et plaintes relatives à la sécurité, analyse des retours SAV et des avis consommateurs, tests par sondage sur les produits commercialisés et suivi des alertes Safety Gate concernant des produits similaires. Les enseignements de cette surveillance alimentent la mise à jour des analyses de risques et déclenchent si nécessaire des mesures correctives : modification du produit, renforcement des avertissements, information des distributeurs. Les distributeurs et la personne responsable UE participent à cette boucle de remontée d'informations conformément à leurs obligations respectives." },
      { id: 'gpsr-surv-signalement', label: "Signalement des accidents aux autorités via le Safety Business Gateway (sans retard injustifié)", description: "En cas d'accident causé par un produit (décès ou effets néfastes graves sur la santé, y compris blessures ayant nécessité une intervention médicale), le fabricant le notifie sans retard injustifié aux autorités compétentes des États membres où le produit a été mis à disposition, via le portail Safety Business Gateway. Le processus interne est formalisé : critères de qualification des incidents notifiables, circuit de décision rapide, modèles de notification, information simultanée des distributeurs et de la place de marché le cas échéant. Les importateurs et distributeurs informés d'un accident en avisent le fabricant, qui peut charger la personne responsable UE d'effectuer la notification." },
      { id: 'gpsr-surv-rappels', label: "Procédure de rappel efficace : avis de rappel normalisé (art. 36), contact direct des consommateurs identifiables", description: "Une procédure de rappel opérationnelle est en place et testée : décision et qualification du risque, information des autorités, retrait de la chaîne de distribution et communication vers les consommateurs. Conformément à l'article 36 du GPSR, l'avis de rappel utilise le modèle normalisé : titre « Rappel de sécurité d'un produit », description claire du produit rappelé et du danger, sans éléments minimisant le risque (pas de « par précaution » ou de mise en avant commerciale). Lorsque les consommateurs sont identifiables (comptes clients, programmes de fidélité, enregistrements produit, données de livraison), ils sont contactés directement ; à défaut, l'information est diffusée par tous les canaux pertinents, y compris le site et les réseaux sociaux." },
      { id: 'gpsr-surv-recours', label: "Recours offerts aux consommateurs en cas de rappel : réparation, remplacement ou remboursement (art. 37)", description: "En cas de rappel, l'organisation propose au consommateur un recours effectif, gratuit et rapide conformément à l'article 37 du GPSR : au moins deux options parmi la réparation du produit, son remplacement par un produit sûr équivalent, ou le remboursement adéquat de sa valeur (au minimum le prix payé), sauf lorsqu'une seule option est possible. Le retour ou la neutralisation du produit dangereux est organisé sans frais ni contrainte disproportionnée pour le consommateur. Le dispositif est dimensionné (logistique retour, budget, suivi des taux de retour du rappel) et son efficacité est mesurée et communiquée aux autorités, le taux de retour étant l'indicateur clé de la réussite d'un rappel." },
    ],
  },
]

export const GPSR_NIVEAUX = [
  { value: 0, shortLabel: 'NC', label: 'Non traité', description: "Exigence non traitée, aucune pratique ni document en place",                          pct: 0,    color: '#9ca3af', bg: 'bg-gray-100 dark:bg-gray-700',       text: 'text-gray-600 dark:text-gray-400'   },
  { value: 1, shortLabel: '1',  label: 'Initié',     description: "Premières actions engagées, pratiques ponctuelles non formalisées",                  pct: 0.25, color: '#ef4444', bg: 'bg-red-50 dark:bg-red-900/20',       text: 'text-red-700 dark:text-red-400'     },
  { value: 2, shortLabel: '2',  label: 'Défini',     description: "Processus défini et documenté, déploiement partiel sur le catalogue",                pct: 0.50, color: '#f97316', bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-400' },
  { value: 3, shortLabel: '3',  label: 'Conforme',   description: "Exigence GPSR satisfaite et démontrable sur l'ensemble des produits concernés",      pct: 0.75, color: '#0284c7', bg: 'bg-sky-50 dark:bg-sky-900/20',       text: 'text-sky-700 dark:text-sky-400'     },
  { value: 4, shortLabel: '4',  label: 'Exemplaire', description: "Maîtrise exemplaire : amélioration continue, anticipation et bonnes pratiques diffusées", pct: 1.0, color: '#16a34a', bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400' },
]

const BADGE_LEVELS = [
  { label: 'Maîtrise exemplaire', min: 85, color: '#0284c7', icon: '⭐' },
  { label: 'Conforme GPSR',       min: 60, color: '#16a34a', icon: '✅' },
  { label: 'Mise en conformité',  min: 30, color: '#f97316', icon: '🔄' },
  { label: 'Non conforme',        min: 0,  color: '#dc2626', icon: '❌' },
]

export function calculateGpsrScore(niveaux: Record<string, number>): number {
  let total = 0
  for (const axe of GPSR_AXES) {
    let axeScore = 0
    const nb = axe.criteres.length
    for (const c of axe.criteres) {
      const n = niveaux[c.id] ?? 0
      axeScore += (GPSR_NIVEAUX[n]?.pct ?? 0) / nb
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
function inputCls() { return 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500' }
function labelCls() { return 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1' }
function btnP(extra = '') { return `px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors disabled:opacity-50 ${extra}` }
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
  for (const axe of GPSR_AXES) {
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
          <span className="text-4xl">🛡️</span>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Diagnostic GPSR</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Règlement (UE) 2023/988 du 10 mai 2023 relatif à la sécurité générale des produits — applicable depuis le 13 décembre 2024</p>
          </div>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          Le <strong>règlement (UE) 2023/988</strong> relatif à la sécurité générale des produits (<strong>GPSR</strong> —
          General Product Safety Regulation) est <strong>applicable depuis le 13 décembre 2024</strong>. Il remplace la
          directive 2001/95/CE (GPSD) et la directive 87/357/CEE relative aux produits d&apos;apparence alimentaire. Son
          champ couvre <strong>tous les produits de consommation non alimentaires</strong> — neufs, d&apos;occasion ou
          reconditionnés, y compris vendus en ligne — dès lors qu&apos;ils ne relèvent pas d&apos;une réglementation
          sectorielle complète.
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          Le GPSR impose une <strong>analyse interne des risques</strong> et une <strong>documentation technique</strong> pour
          chaque produit, exige qu&apos;une <strong>personne responsable établie dans l&apos;UE</strong> soit désignée pour
          tout produit (même vendu depuis un pays tiers via le e-commerce), renforce les obligations de la
          <strong> vente à distance et des places de marché</strong>, organise le <strong>signalement des accidents</strong> via
          le Safety Business Gateway et encadre les <strong>rappels</strong> avec des recours obligatoires pour les
          consommateurs. Cette application vous permet d&apos;auto-évaluer votre conformité sur 5 axes et 20 critères, de
          documenter vos preuves et de piloter votre plan de mise en conformité.
        </p>
      </div>

      {/* Points clés + référentiels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={card('p-5 border-l-4 border-sky-600')}>
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">🛡️ Points clés du règlement GPSR</h3>
          <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
            <div className="flex items-start gap-2">
              <span className="text-sky-600 font-bold flex-shrink-0">📋</span>
              <span><strong>Analyse interne des risques et documentation technique</strong> obligatoires pour chaque produit (art. 9), conservées 10 ans et tenues à disposition des autorités.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sky-600 font-bold flex-shrink-0">🇪🇺</span>
              <span><strong>Personne responsable établie dans l&apos;UE</strong> obligatoire pour tout produit mis sur le marché (art. 16) — y compris les produits vendus depuis des pays tiers via le e-commerce.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sky-600 font-bold flex-shrink-0">🛒</span>
              <span><strong>Vente à distance et marketplaces</strong> : informations obligatoires sur les offres en ligne (art. 19) et retrait des produits dangereux notifiés en 2 jours ouvrés par les places de marché.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sky-600 font-bold flex-shrink-0">🚨</span>
              <span><strong>Signalement des accidents</strong> via le Safety Business Gateway sans retard injustifié, et <strong>rappels</strong> avec avis normalisé (art. 36) et recours obligatoires : réparation, remplacement ou remboursement (art. 37).</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sky-600 font-bold flex-shrink-0">⚖️</span>
              <span><strong>Sanctions</strong> fixées par les États membres — en France, contrôles de la <strong>DGCCRF</strong>, amendes administratives et sanctions pénales.</span>
            </div>
          </div>
        </div>

        <div className={card('p-5 border-l-4 border-blue-500')}>
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">📋 Référentiels mobilisés</h3>
          <div className="space-y-1">
            {[
              ['🛡️', 'Règlement (UE) 2023/988 — sécurité générale des produits (GPSR)'],
              ['🔍', 'Règlement (UE) 2019/1020 — surveillance du marché'],
              ['💻', 'DSA — Digital Services Act (places de marché en ligne)'],
              ['📜', 'Directive 2001/95/CE (GPSD) — cadre historique remplacé'],
              ['🚨', "Safety Gate / RAPEX — système d'alerte rapide de l'UE"],
              ['🔬', 'ISO 10377 — sécurité des produits de consommation'],
              ['📣', 'ISO 10393 — rappels de produits de consommation'],
              ['🏛️', 'ISO 26000 §6.7 — questions relatives aux consommateurs'],
              ['📋', 'CSRD/ESRS S4 et GRI 416 — reporting consommateurs'],
            ].map(([icon, label]) => (
              <div key={label} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <span>{icon}</span><span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Champ d'application */}
      <div className={card('p-5 bg-sky-50 dark:bg-sky-900/10 border-sky-200 dark:border-sky-800')}>
        <h3 className="font-bold text-sky-700 dark:text-sky-400 mb-3">🏗️ Champ d&apos;application et calendrier</h3>
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          {[
            "Règlement (UE) 2023/988 du Parlement européen et du Conseil du 10 mai 2023 — applicable dans tous les États membres depuis le 13 décembre 2024, sans transposition nationale",
            "Remplace la directive 2001/95/CE relative à la sécurité générale des produits (GPSD) et la directive 87/357/CEE sur les produits d'apparence alimentaire",
            "Champ : tous les produits de consommation non alimentaires — neufs, d'occasion, réparés ou reconditionnés — mis ou rendus disponibles sur le marché de l'UE, y compris via la vente en ligne",
            "Exclusions : produits couverts par une réglementation sectorielle complète (médicaments, denrées alimentaires, dispositifs médicaux…) — le GPSR s'applique en filet de sécurité pour les risques non couverts par les réglementations harmonisées",
            "Opérateurs concernés : fabricants, importateurs, distributeurs, mandataires, prestataires d'exécution de commandes et fournisseurs de places de marché en ligne",
          ].map((line, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="font-bold text-sky-600 flex-shrink-0">•</span>
              <span>{line}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Les 5 axes */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Les 5 axes du Diagnostic GPSR</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {GPSR_AXES.map(axe => (
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
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Niveaux d&apos;évaluation GPSR</h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {GPSR_NIVEAUX.map(n => (
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
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Badge de conformité GPSR</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {BADGE_LEVELS.map(b => (
            <div key={b.label} className={card('p-4 text-center')}>
              <div className="text-3xl">{b.icon}</div>
              <div className="font-bold text-sm mt-1" style={{ color: b.color }}>{b.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">≥ {b.min}%</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">Seuils : 0-30% ❌ Non conforme · 30-60% 🔄 Mise en conformité · 60-85% ✅ Conforme GPSR · 85-100% ⭐ Maîtrise exemplaire</p>
      </div>

      {/* Comment utiliser */}
      <div className={card('p-5 space-y-3')}>
        <h3 className="font-semibold text-gray-900 dark:text-white">💡 Comment utiliser cette application</h3>
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          {[
            ['1', 'Diagnostic GPSR', "Pour chaque critère, évaluez votre niveau (NC à 4), documentez vos pratiques et vos preuves, et créez des actions de mise en conformité ciblées."],
            ['2', "Plan d'actions", "Visualisez et gérez toutes vos actions de conformité produit : priorité, responsable, échéance, statut d'avancement."],
            ['3', 'Documents & Preuves', "Uploadez directement dans SharePoint vos preuves documentaires (analyses de risques, documentation technique, rapports d'essais, procédures de rappel) classées par critère."],
            ['4', 'Export Excel', "Générez un rapport Excel structuré avec 6 onglets pour documenter votre conformité GPSR auprès de la direction, des distributeurs et des autorités."],
          ].map(([num, title, desc]) => (
            <div key={num} className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 flex items-center justify-center text-xs font-bold">{num}</div>
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

  const axeStats = GPSR_AXES.map(axe => {
    const total = axe.criteres.length
    const niveaux = axe.criteres.map(c => reponses[c.id]?.niveau ?? 0)
    const pct = niveaux.reduce((s, n) => s + (GPSR_NIVEAUX[n]?.pct ?? 0), 0) / total
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
          <div className="text-xs text-gray-400 mt-1">Seuils : 30% Mise en conformité · 60% Conforme GPSR · 85% Maîtrise exemplaire</div>
        </div>

        {/* Radar */}
        <div className={card('p-4 sm:col-span-2')}>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Radar GPSR par axe</h3>
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
              <polygon points={dataPolygon} fill="#0284c722" stroke="#0284c7" strokeWidth="2.5" strokeLinejoin="round" />
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
                  const niv = GPSR_NIVEAUX[n]
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
            <div className="h-2 rounded-full bg-sky-600 transition-all" style={{ width: `${Math.round(actions.filter(a => a.statut === 'termine').length / actions.length * 100)}%` }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Vue Correspondances ──────────────────────────────────────────────────────

const CORRESPONDANCES_GPSR = [
  {
    categorie: "Applications RSE Sens'ethO",
    icon: '🏠',
    color: 'indigo',
    items: [
      {
        ref: 'Diagnostic Green Claims', icon: '🌿', route: '/rse/green-claims',
        desc: "Green Claims — l'information loyale du consommateur est commune aux deux règlements : le GPSR interdit de minimiser les risques dans la présentation et la publicité des produits, la directive Green Claims encadre les allégations environnementales — les processus de relecture des contenus commerciaux se mutualisent",
        liens: [
          { axe: 'vad',          label: 'Vente en ligne', ref: 'Green Claims — Loyauté des allégations et de la présentation des produits' },
          { axe: 'gouvernance',  label: 'Gouvernance',    ref: 'Green Claims — Justification documentée des allégations (preuves)' },
        ],
      },
      {
        ref: 'Devoir de Vigilance', icon: '⚖️', route: '/rse/vigilance',
        desc: "Devoir de Vigilance — la maîtrise de la chaîne de valeur est un socle commun : la cartographie des fournisseurs et sous-traitants, les audits et les plans d'actions du devoir de vigilance alimentent directement la maîtrise des fournisseurs exigée pour la sécurité des produits",
        liens: [
          { axe: 'operateurs',   label: 'Chaîne de valeur', ref: 'Vigilance — Cartographie et évaluation des fournisseurs et sous-traitants' },
          { axe: 'surveillance', label: 'Surveillance',     ref: 'Vigilance — Mécanisme d’alerte et suivi des mesures correctives' },
        ],
      },
      {
        ref: 'EUDR Sans Déforestation', icon: '🌳', route: '/rse/eudr',
        desc: "EUDR — même logique de conformité produit UE : analyse de risques par référence, traçabilité, déclaration de diligence raisonnée et personne référente — les dispositifs de due diligence produit GPSR et EUDR partagent gouvernance, outils et documentation",
        liens: [
          { axe: 'gouvernance', label: 'Gouvernance',      ref: 'EUDR — Diligence raisonnée et documentation par référence produit' },
          { axe: 'operateurs',  label: 'Chaîne de valeur', ref: 'EUDR — Traçabilité amont et qualification des opérateurs' },
        ],
      },
      {
        ref: 'Diagnostic initial guidé ISO 26000', icon: '🧭', route: '/rse/diagnostic-initial',
        desc: "Diagnostic initial ISO 26000 — la question centrale « Questions relatives aux consommateurs » (protection de la santé et de la sécurité, information loyale, service après-vente) structure la dimension RSE de la sécurité produit que le GPSR rend juridiquement contraignante",
        liens: [
          { axe: 'evaluation',   label: 'Évaluation',   ref: 'ISO 26000 §6.7.4 — Protection de la santé et de la sécurité des consommateurs' },
          { axe: 'surveillance', label: 'Surveillance', ref: 'ISO 26000 §6.7.6 — Service après-vente, assistance et traitement des réclamations' },
        ],
      },
      {
        ref: 'EcoVadis Diagnostic', icon: '🥇', route: '/rse/ecovadis',
        desc: "EcoVadis — la notation EcoVadis valorise les dispositifs de qualité et de sécurité produit dans les piliers Environnement et Achats responsables : les preuves GPSR (analyses de risques, contrôles fournisseurs, procédures de rappel) renforcent le dossier EcoVadis",
        liens: [
          { axe: 'operateurs',  label: 'Chaîne de valeur', ref: 'EcoVadis — Pilier Achats responsables : exigences et audits fournisseurs' },
          { axe: 'gouvernance', label: 'Gouvernance',      ref: 'EcoVadis — Politiques, procédures et certifications documentées' },
        ],
      },
    ],
  },
  {
    categorie: 'Référentiels externes',
    icon: '📐',
    color: 'sky',
    items: [
      {
        ref: 'ISO 26000 — questions relatives aux consommateurs', icon: '🏛️', route: null,
        desc: "ISO 26000 §6.7 — la question centrale « Questions relatives aux consommateurs » couvre la protection de la santé et de la sécurité des consommateurs, les pratiques loyales de commercialisation et d'information, le service après-vente et le traitement des réclamations : le socle RSE dont le GPSR est la traduction réglementaire européenne",
        liens: [
          { axe: 'evaluation', label: 'Évaluation',     ref: 'ISO 26000 §6.7.4 — Protection de la santé et de la sécurité des consommateurs' },
          { axe: 'vad',        label: 'Vente en ligne', ref: 'ISO 26000 §6.7.3 — Pratiques loyales de commercialisation et d’information' },
        ],
      },
      {
        ref: 'ISO 10377 — sécurité des produits de consommation', icon: '🔬', route: null,
        desc: "ISO 10377 — lignes directrices pour la sécurité des produits de consommation : évaluation et maîtrise des risques de la conception à la distribution, culture sécurité, traçabilité — le référentiel opérationnel pour documenter l'analyse interne des risques exigée par l'art. 9 du GPSR",
        liens: [
          { axe: 'gouvernance', label: 'Gouvernance', ref: 'ISO 10377 — Analyse et documentation des risques produit' },
          { axe: 'evaluation',  label: 'Évaluation',  ref: 'ISO 10377 — Sécurité dans la conception et les essais' },
        ],
      },
      {
        ref: 'ISO 10393 — rappels de produits', icon: '📣', route: null,
        desc: "ISO 10393 — lignes directrices pour le rappel des produits de consommation : préparation (plan de rappel), déclenchement, communication aux consommateurs et évaluation de l'efficacité — complète les exigences d'avis normalisé (art. 36) et de recours (art. 37) du GPSR",
        liens: [
          { axe: 'surveillance', label: 'Surveillance', ref: 'ISO 10393 — Plan de rappel, communication et mesure d’efficacité' },
        ],
      },
      {
        ref: 'CSRD — ESRS S4 (consommateurs et utilisateurs finals)', icon: '📜', route: null,
        desc: "CSRD/ESRS — le standard thématique ESRS S4 couvre les impacts sur les consommateurs et utilisateurs finals, dont la sécurité des produits : politiques, actions, cibles et indicateurs de sécurité produit alimentent le reporting de durabilité européen",
        liens: [
          { axe: 'gouvernance',  label: 'Gouvernance',  ref: 'ESRS S4 — Politiques et gouvernance relatives aux consommateurs' },
          { axe: 'surveillance', label: 'Surveillance', ref: 'ESRS S4 — Canaux de remontée des préoccupations et mesures correctives' },
        ],
      },
      {
        ref: 'GRI 416 — santé et sécurité des consommateurs', icon: '📋', route: null,
        desc: "GRI 416 — le standard de reporting santé-sécurité des consommateurs : GRI 416-1 (évaluation des impacts santé-sécurité des catégories de produits) et GRI 416-2 (incidents de non-conformité concernant la santé-sécurité) documentent la performance sécurité produit",
        liens: [
          { axe: 'evaluation',   label: 'Évaluation',   ref: 'GRI 416-1 — Évaluation des impacts santé-sécurité des produits' },
          { axe: 'surveillance', label: 'Surveillance', ref: 'GRI 416-2 — Incidents de non-conformité produit' },
        ],
      },
      {
        ref: 'ODD 12 — consommation et production responsables', icon: '🌍', route: null,
        desc: "ODD 12 — la sécurité et la durabilité des produits de consommation contribuent à l'objectif de modes de consommation et de production durables : information des consommateurs, produits sûrs et pratiques responsables tout au long du cycle de vie",
        liens: [
          { axe: 'vad', label: 'Vente en ligne', ref: 'ODD 12.8 — Information et sensibilisation des consommateurs' },
        ],
      },
      {
        ref: 'Règlement (UE) 2019/1020 — surveillance du marché', icon: '🔍', route: null,
        desc: "Règlement surveillance du marché — cadre européen des contrôles de conformité : pouvoirs des autorités, contrôles aux frontières, coopération entre États membres — le GPSR s'y articule directement pour les produits non couverts par une législation d'harmonisation",
        liens: [
          { axe: 'surveillance', label: 'Surveillance',     ref: '2019/1020 — Contrôles, injonctions et mesures des autorités' },
          { axe: 'operateurs',   label: 'Chaîne de valeur', ref: '2019/1020 — Opérateur économique responsable des tâches de conformité' },
        ],
      },
      {
        ref: 'DSA — Digital Services Act', icon: '💻', route: null,
        desc: "DSA — le règlement sur les services numériques impose aux places de marché la traçabilité des vendeurs professionnels (KYBC) et le retrait des contenus illicites : le GPSR le complète par des obligations spécifiques de sécurité produit (enregistrement Safety Gate, retrait en 2 jours ouvrés)",
        liens: [
          { axe: 'vad', label: 'Vente en ligne', ref: 'DSA — Traçabilité des vendeurs et conformité dès la conception des interfaces' },
        ],
      },
      {
        ref: 'Directive 2001/95/CE (GPSD) — historique', icon: '📜', route: null,
        desc: "GPSD — la directive relative à la sécurité générale des produits, abrogée le 13 décembre 2024 : le GPSR en reprend l'obligation générale de sécurité en la renforçant (traçabilité, e-commerce, personne responsable UE, rappels, accidents) et intègre la directive 87/357/CEE sur les produits d'apparence alimentaire",
        liens: [
          { axe: 'gouvernance', label: 'Gouvernance', ref: 'GPSD → GPSR — Continuité de l’obligation générale de sécurité' },
        ],
      },
      {
        ref: 'Safety Gate / RAPEX', icon: '🚨', route: null,
        desc: "Safety Gate — le système d'alerte rapide de l'UE pour les produits non alimentaires dangereux : publication des alertes des autorités, portail Safety Business Gateway pour les notifications des entreprises (accidents, mesures volontaires) et module de signalement des consommateurs",
        liens: [
          { axe: 'surveillance', label: 'Surveillance',   ref: 'Safety Business Gateway — Notification des accidents et mesures correctives' },
          { axe: 'vad',          label: 'Vente en ligne', ref: 'Safety Gate — Retrait des offres notifiées par les marketplaces (2 jours ouvrés)' },
        ],
      },
    ],
  },
]

const AXE_BADGE_CLS: Record<string, string> = {
  gouvernance:  'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  evaluation:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  operateurs:   'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  vad:          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  surveillance: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
}

function CorrespondancesView() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className={card('p-4')}>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          La conformité GPSR s&apos;articule avec l&apos;ensemble de votre démarche RSE et de conformité produit.
          Les correspondances ci-dessous permettent de mutualiser vos efforts entre la sécurité générale des
          produits (règlement (UE) 2023/988), la surveillance du marché (règlement (UE) 2019/1020), le DSA pour
          les places de marché, les normes ISO 10377 et ISO 10393, l&apos;ISO 26000 (questions relatives aux
          consommateurs), la CSRD/ESRS S4, le GRI 416 et l&apos;ODD 12.
        </p>
      </div>

      {CORRESPONDANCES_GPSR.map(cat => (
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
                          const axe = GPSR_AXES.find(a => a.id === l.axe)
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
    const res = await fetch(`/api/gpsr/${diagnosticId}/actions`, {
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
    await fetch(`/api/gpsr/${diagnosticId}/actions?action_id=${id}`, { method: 'DELETE' })
    onActionsChange(actions.filter(a => a.id !== id))
  }

  async function saveEdit(id: string) {
    setSavingEdit(true)
    const res = await fetch(`/api/gpsr/${diagnosticId}/actions?action_id=${id}`, {
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
    const res = await fetch(`/api/gpsr/${diagnosticId}/actions?action_id=${action.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: next }),
    })
    if (res.ok) {
      const { data } = await res.json()
      onActionsChange(actions.map(a => a.id === action.id ? data : a))
    }
  }

  const niv = GPSR_NIVEAUX[niveau]

  return (
    <div className="space-y-5">
      {/* Header critère */}
      <div className="rounded-xl p-4 border border-gray-200 dark:border-gray-700" style={{ background: axe.colorLight + '80' }}>
        <h3 className="font-bold text-base" style={{ color: axe.color }}>{critere.label}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{critere.description}</p>
      </div>

      {/* Niveau d'évaluation */}
      <div className={card('p-4 space-y-3')}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">Niveau de conformité GPSR</div>
          {savingReponse && <span className="text-xs text-gray-400 animate-pulse">Enregistrement…</span>}
          {savedOk && !savingReponse && <span className="text-xs text-green-600 dark:text-green-400">✓ Sauvegardé</span>}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {GPSR_NIVEAUX.map(n => (
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
        <p className="text-xs text-gray-500 dark:text-gray-400">Décrivez vos pratiques actuelles, les preuves disponibles (analyses de risques, documentation technique, rapports d&apos;essais, procédures, registres) et les points d&apos;amélioration identifiés au regard du règlement (UE) 2023/988.</p>
        <textarea
          value={commentaire}
          onChange={e => handleCommentaireChange(e.target.value)}
          rows={4}
          placeholder="Ex : Analyse des risques formalisée pour 80% du catalogue, documentation technique centralisée, personne responsable UE désignée pour les imports…"
          className={`${inputCls()} resize-y`}
        />
        <GuidedActionNotePanel
          diagnosticId={diagnosticId}
          actionKey={critere.id}
          apiBase="/api/gpsr"
          noteTable="gpsr_notes"
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
            🎯 Actions de mise en conformité
            {critereActions.length > 0 && (
              <span className="ml-2 text-xs bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 px-1.5 py-0.5 rounded-full font-medium">
                {critereActions.filter(a => a.statut === 'termine').length}/{critereActions.length}
              </span>
            )}
          </div>
          <button onClick={() => setShowActionForm(v => !v)} className={btnP('text-xs py-1.5')}>+ Action</button>
        </div>

        {showActionForm && (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 space-y-2 border border-gray-200 dark:border-gray-700">
            <div><label className={labelCls()}>Titre *</label>
              <input className={inputCls()} value={actionForm.titre} onChange={e => setActionForm(f => ({ ...f, titre: e.target.value }))} placeholder="Ex : Formaliser l'analyse interne des risques pour chaque référence produit" />
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
          <p className="text-xs text-gray-400 text-center py-3">Aucune action — créez des mesures concrètes pour satisfaire cette exigence du règlement GPSR</p>
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
                        apiBase="/api/gpsr"
                        noteTable="gpsr_notes"
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
  const [activeAxe, setActiveAxe] = useState(GPSR_AXES[0].id)
  const [activeCritere, setActiveCritere] = useState<string | null>(GPSR_AXES[0].criteres[0].id)

  const niveaux: Record<string, number> = {}
  for (const [k, v] of Object.entries(reponses)) niveaux[k] = v.niveau
  const scoreGlobal = calculateGpsrScore(niveaux)
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
            {GPSR_AXES.map(axe => {
              const axeNiveaux = axe.criteres.map(c => niveaux[c.id] ?? 0)
              const axePct = Math.round(axeNiveaux.reduce((s, n) => s + GPSR_NIVEAUX[n].pct, 0) / axe.criteres.length * 100)
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
            {GPSR_AXES.map(axe => {
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
                        const niv = GPSR_NIVEAUX[n]
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
            const axe = GPSR_AXES.find(a => a.criteres.some(c => c.id === activeCritere))!
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
              <p className="text-gray-400 text-sm">Sélectionnez un critère pour commencer le diagnostic</p>
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
  return GPSR_AXES.find(x => x.criteres.some(c => c.id === critereId))
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
          const ia = GPSR_AXES.findIndex(x => x.id === axeOf(a.critere_id)?.id)
          const ib = GPSR_AXES.findIndex(x => x.id === axeOf(b.critere_id)?.id)
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
  const groups = GPSR_AXES
    .map(axe => ({ axe, items: sortActions(filtered.filter(a => axeOf(a.critere_id)?.id === axe.id)) }))
    .filter(g => g.items.length > 0)

  async function saveEdit(id: string) {
    setSaving(true)
    const res = await fetch(`/api/gpsr/${diagnostic.id}/actions?action_id=${id}`, {
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
    const res = await fetch(`/api/gpsr/${diagnostic.id}/actions?action_id=${action.id}`, {
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
    await fetch(`/api/gpsr/${diagnostic.id}/actions?action_id=${id}`, { method: 'DELETE' })
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
          {GPSR_AXES.map(a => <option key={a.id} value={a.id}>{a.icon} {a.label}</option>)}
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
          <p className="text-gray-400 text-sm">Aucune action — créez-en depuis la vue Diagnostic GPSR, critère par critère</p>
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
                                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium hover:ring-2 hover:ring-offset-1 hover:ring-sky-300 transition ${STATUT_COLORS[a.statut]}`}>
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
  { id: 'presentation',    label: 'Présentation',    icon: '📋' },
  { id: 'dashboard',       label: 'Tableau de bord', icon: '📊' },
  { id: 'diagnostic',      label: 'Diagnostic GPSR', icon: '🛡️' },
  { id: 'actions',         label: "Plan d'actions",  icon: '📝' },
  { id: 'correspondances', label: 'Correspondances', icon: '🔗' },
]

export default function GpsrDiagnosticApp({ ctx }: { ctx: RseContext }) {
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
  const [pdfData, setPdfData] = useState<GpsrPdfData | null>(null)
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
      const res = await fetch(`/api/gpsr?org_id=${org.id}&annee=${year}`)
      const { data: existingDiag } = await res.json()

      let diagId = existingDiag?.id
      if (!diagId) {
        setInitializing(true)
        const createRes = await fetch('/api/gpsr', {
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
        fetch(`/api/gpsr/${diagId}/reponses`),
        fetch(`/api/gpsr/${diagId}/actions`),
        fetch(`/api/gpsr/${diagId}/notes`),
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
    await fetch(`/api/gpsr/${diagnostic.id}/reponses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ critere_id, niveau, commentaire }),
    })
    setTimeout(async () => {
      setReponses(current => {
        const n2: Record<string, number> = {}
        for (const [k, v] of Object.entries(current)) n2[k] = v.niveau
        const score = calculateGpsrScore(n2)
        if (diagnostic) {
          fetch(`/api/gpsr/${diagnostic.id}`, {
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
    fetch(`/api/gpsr/${diagnostic.id}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_key: critere_id, content }),
    }).catch(e => console.error('[gpsr/notes]', e))
  }

  function handleNoteSectionsChange(critere_id: string, sections: NoteSection[]) {
    setNoteSections(prev => ({ ...prev, [critere_id]: sections }))
    if (!diagnostic) return
    fetch(`/api/gpsr/${diagnostic.id}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_key: critere_id, sections }),
    }).catch(e => console.error('[gpsr/notes/sections]', e))
  }

  async function handleExportExcel() {
    if (!diagnostic) return
    setExportingExcel(true)
    try {
      const res = await fetch(`/api/gpsr/${diagnostic.id}/export-excel`)
      if (!res.ok) throw new Error('Échec export')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `GPSR_${org?.denomination ?? 'diagnostic'}_${year}.xlsx`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { alert('Erreur export Excel : ' + String(e)) }
    finally { setExportingExcel(false) }
  }

  function buildPdfData(): GpsrPdfData {
    const niveaux: Record<string, number> = {}
    const commentaires: Record<string, string> = {}
    for (const [k, v] of Object.entries(reponses)) {
      niveaux[k] = v.niveau
      if (v.commentaire) commentaires[k] = v.commentaire
    }
    const score = diagnostic?.score_global ?? calculateGpsrScore(niveaux)
    const badge = getBadge(score)
    return {
      organisation: org?.denomination ?? null,
      siren: org?.siren ?? null,
      ville: org?.ville ?? null,
      year,
      date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
      scoreLabel: 'Score de maturité',
      scoreValue: score,
      badge: { label: badge.label, icon: badge.icon, color: badge.color },
      axes: GPSR_AXES,
      niveaux: GPSR_NIVEAUX,
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
        if (document.querySelector('#gpsr-pdf-root [data-pdf-page]')) { resolve(); return }
        const observer = new MutationObserver(() => {
          if (document.querySelector('#gpsr-pdf-root [data-pdf-page]')) {
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
      await exportReport('gpsr-pdf-root', `Diagnostic-GPSR-${orgSlug}-${year}.pdf`)
    } catch (e) {
      console.error('[gpsr/exportPDF]', e)
    } finally {
      setExportingPDF(false)
      setPdfData(null)
    }
  }

  const loadShares = useCallback(async () => {
    if (!diagnostic) return
    try {
      const res = await fetch(`/api/gpsr/${diagnostic.id}/shares`)
      const { data } = await res.json()
      setShareList(data ?? [])
    } catch { /* ignore */ }
  }, [diagnostic])

  useEffect(() => { if (showShare) loadShares() }, [showShare, loadShares])

  async function handleAddShare() {
    if (!diagnostic || !shareEmail.trim()) return
    setShareSaving(true); setShareError('')
    try {
      const res = await fetch(`/api/gpsr/${diagnostic.id}/shares`, {
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
      await fetch(`/api/gpsr/${diagnostic.id}/shares?shareId=${shareId}`, { method: 'DELETE' })
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium transition-colors">
          👥 Partager
        </button>
      </div>
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnostic, exportingExcel, exportingPDF])

  const lockedTabs = !org || !diagnostic ? ['dashboard', 'diagnostic', 'actions'] : []

  if (loading && !diagnostic) {
    return <div className="flex justify-center items-center py-20 text-gray-400 text-sm animate-pulse">
      {initializing ? 'Initialisation du Diagnostic GPSR…' : 'Chargement…'}
    </div>
  }

  return (
    <div className="space-y-4">

      {/* ── Rapport PDF (monté hors-écran le temps de l'export) ─────────────── */}
      {pdfData && (
        <div style={{ position: 'absolute', left: -9999, top: 0 }} aria-hidden="true">
          <GpsrPDFReport id="gpsr-pdf-root" data={pdfData} />
        </div>
      )}

      {/* ── Modale Partage ──────────────────────────────────────────────────── */}
      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowShare(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-bold text-gray-900 dark:text-white">👥 Partager le Diagnostic GPSR</h2>
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
          <span>Score GPSR :</span>
          <span className="font-bold text-gray-900 dark:text-white">{diagnostic.score_global ?? calculateGpsrScore(Object.fromEntries(Object.entries(reponses).map(([k, v]) => [k, v.niveau])))}/100</span>
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
                view === v.id ? 'border-sky-600 text-sky-600 dark:text-sky-400'
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
          score={diagnostic.score_global ?? calculateGpsrScore(Object.fromEntries(Object.entries(reponses).map(([k, v]) => [k, v.niveau])))}
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

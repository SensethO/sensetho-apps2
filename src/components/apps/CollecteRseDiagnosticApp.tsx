/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import type { RseContext } from '@/components/rse/RseAppShell'
import ConfirmModal from '@/components/ui/ConfirmModal'
import ShareAutocomplete from '@/components/apps/ShareAutocomplete'
import type { NoteSection } from '@/components/apps/GuidedActionNotePanel'
import type { CollectePdfData } from '@/components/apps/CollecteRsePDFReport'

// GuidedActionNotePanel chargé en lazy — même pattern que les autres apps RSE
const GuidedActionNotePanel = dynamic(() => import('@/components/apps/GuidedActionNotePanel'), {
  ssr: false,
  loading: () => <div className="py-3 text-xs text-gray-400 animate-pulse">Chargement éditeur…</div>
})

// Rapport PDF chargé en lazy (html2canvas + jspdf hors du bundle principal)
const CollecteRsePDFReport = dynamic(() => import('@/components/apps/CollecteRsePDFReport'), {
  ssr: false,
  loading: () => null,
})

// ─── Données statiques Collecte documentaire RSE ──────────────────────────────

export const COLLECTE_RSE_AXES = [
  {
    id: 'gouvernance', label: 'Gouvernance & Stratégie', icon: '🧭',
    color: '#4f46e5', colorLight: '#e0e7ff', weight: 0.20,
    description: "Documents de pilotage RSE et de gouvernance : organisation juridique, stratégie et politique RSE, matérialité, éthique et gestion des risques.",
    criteres: [
      { id: 'col-gov-juridique', label: "Documents juridiques & organisation (Kbis, statuts, organigramme, raison d'être / clause de mission)", description: "Rassemblez les documents juridiques fondamentaux de la structure : extrait Kbis récent, statuts à jour, organigramme nominatif et, le cas échéant, la formalisation de la raison d'être ou de la clause de mission (société à mission). Ces pièces situent l'entreprise (forme juridique, dirigeants, périmètre) et constituent le socle de tout diagnostic : elles permettent au consultant de vérifier la gouvernance et de cadrer le périmètre de l'évaluation. Privilégiez les versions datées et signées, et signalez tout document en cours d'actualisation." },
      { id: 'col-gov-strategie', label: "Stratégie & politique RSE (feuille de route, politique RSE signée, comptes rendus de comité RSE)", description: "Réunissez les documents qui matérialisent l'engagement RSE de la direction : feuille de route ou plan d'actions RSE, politique RSE formellement signée par la direction, comptes rendus du comité RSE ou de pilotage de la démarche. Ces preuves démontrent que la RSE est portée au niveau stratégique et déclinée en objectifs : elles sont déterminantes pour évaluer la maturité de la gouvernance de la démarche. Une politique datée et signée vaut davantage qu'une intention non formalisée." },
      { id: 'col-gov-materialite', label: "Analyse de matérialité & cartographie des parties prenantes", description: "Fournissez l'analyse de matérialité (hiérarchisation des enjeux RSE significatifs) et la cartographie des parties prenantes (clients, salariés, fournisseurs, riverains, collectivités…) avec leurs attentes. Ces documents montrent que l'entreprise a identifié ses enjeux prioritaires et ses interlocuteurs clés, condition d'une démarche RSE ciblée et crédible. Même une version simplifiée (atelier interne, tableau d'enjeux) est utile : elle oriente la suite du diagnostic et le choix des indicateurs à suivre." },
      { id: 'col-gov-ethique', label: "Éthique & gestion des risques (code de conduite/éthique, cartographie des risques RSE, rapports RSE antérieurs)", description: "Collectez les documents relatifs à l'éthique et à la maîtrise des risques : code de conduite ou charte éthique, cartographie des risques RSE (sociaux, environnementaux, de réputation), et tout rapport ou bilan RSE des exercices antérieurs. Ces pièces témoignent d'une culture du risque et d'une dynamique d'amélioration continue. Les rapports antérieurs permettent de mesurer la trajectoire de progrès et d'éviter de repartir de zéro lors du diagnostic." },
    ],
  },
  {
    id: 'social', label: 'Social & Conditions de travail', icon: '👥',
    color: '#2563eb', colorLight: '#dbeafe', weight: 0.20,
    description: "Données sociales, santé-sécurité au travail, dialogue social, compétences, égalité, diversité et droits humains.",
    criteres: [
      { id: 'col-soc-donnees', label: "Données sociales (bilan social, DSN, registre du personnel, pyramide des âges)", description: "Rassemblez les données sociales structurantes : bilan social (si applicable), déclarations sociales nominatives (DSN), registre unique du personnel, pyramide des âges et données d'effectifs (CDI/CDD, temps plein/partiel, turnover). Ces éléments dressent le portrait social de l'entreprise et fournissent les indicateurs de base du diagnostic RSE. Des données récentes et cohérentes (dernier exercice clos) facilitent grandement l'évaluation et le calcul d'indicateurs comparables." },
      { id: 'col-soc-sst', label: "Santé & sécurité au travail (DUERP et plan d'actions, politique SST, taux de fréquence/gravité, registre AT/MP)", description: "Fournissez les preuves de la maîtrise des risques professionnels : document unique d'évaluation des risques (DUERP) à jour et son plan d'actions, politique santé-sécurité, indicateurs (taux de fréquence et de gravité des accidents), registre des accidents du travail et maladies professionnelles (AT/MP). Ces documents, dont le DUERP est une obligation légale, démontrent l'attention portée à la protection des salariés. Un DUERP daté de moins d'un an et assorti d'actions concrètes est un marqueur fort de maturité." },
      { id: 'col-soc-dialogue', label: "Dialogue social & compétences (accords d'entreprise, PV du CSE, plan de développement des compétences, entretiens annuels)", description: "Collectez les preuves du dialogue social et du développement des compétences : accords d'entreprise, procès-verbaux du CSE (ou trace des réunions du personnel), plan de développement des compétences et formations réalisées, supports d'entretiens annuels ou professionnels. Ces documents attestent de la qualité des relations sociales et de l'investissement dans le capital humain. Ils nourrissent l'évaluation des questions « relations et conditions de travail » de l'ISO 26000." },
      { id: 'col-soc-egalite', label: "Égalité, diversité & droits humains (index égalité F/H, politique handicap/DOETH, politique droits humains, dispositif d'alerte)", description: "Réunissez les preuves d'engagement sur l'égalité et les droits humains : index de l'égalité professionnelle femmes-hommes (et plan associé), déclaration DOETH et politique handicap, politique ou engagement sur les droits humains, dispositif d'alerte (lanceurs d'alerte). Ces documents démontrent la prise en compte de la diversité, de la non-discrimination et du respect des droits fondamentaux. Selon la taille de la PME, certains documents (index F/H) ne sont obligatoires qu'au-delà de seuils d'effectif — signalez le cas échéant." },
    ],
  },
  {
    id: 'environnement', label: 'Environnement', icon: '🌍',
    color: '#16a34a', colorLight: '#dcfce7', weight: 0.20,
    description: "Preuves de la gestion environnementale : politique et certifications, énergie et climat, déchets et circularité, écoconception.",
    criteres: [
      { id: 'col-env-politique', label: "Politique & certifications environnementales (politique, ISO 14001/50001 le cas échéant, conformité ICPE)", description: "Fournissez les documents cadrant la gestion environnementale : politique environnementale, certificats ISO 14001 (management environnemental) ou ISO 50001 (énergie) le cas échéant, et les preuves de conformité réglementaire (autorisations ou déclarations ICPE si l'activité y est soumise). Ces pièces situent le niveau de formalisation et de conformité de la démarche environnementale. À défaut de certification, une politique signée et des preuves de veille réglementaire restent des éléments probants." },
      { id: 'col-env-climat', label: "Énergie & climat (bilan GES / Bilan Carbone scopes 1-2-3, plan de transition, factures et suivis de consommations, audit énergétique)", description: "Rassemblez les données énergie-climat : bilan d'émissions de gaz à effet de serre ou Bilan Carbone (scopes 1, 2 et idéalement 3), plan de transition ou de réduction, factures et suivis de consommations (énergie, carburants), et audit énergétique réglementaire le cas échéant. Ces documents permettent de quantifier l'empreinte de l'entreprise et de mesurer sa trajectoire bas-carbone. Ils alimentent directement l'application Bilan GES et sont au cœur des attentes RSE et CSRD/VSME actuelles." },
      { id: 'col-env-dechets', label: "Déchets & circularité (registre des déchets, BSD, contrats de collecte, taux de valorisation)", description: "Collectez les preuves de gestion des déchets et d'économie circulaire : registre des déchets, bordereaux de suivi des déchets (BSD) pour les déchets dangereux, contrats avec les prestataires de collecte et de traitement, et indicateurs de valorisation (taux de recyclage, réemploi). Ces documents démontrent la maîtrise des flux de déchets et la conformité réglementaire (tri 5/7 flux). Des taux de valorisation suivis dans le temps témoignent d'une démarche de progrès vers la circularité." },
      { id: 'col-env-ecoconception', label: "Écoconception & achats responsables (ACV produits, démarche d'écoconception, politique achats verts)", description: "Fournissez les preuves d'intégration de l'environnement dans les produits et les achats : analyses du cycle de vie (ACV) de produits, démarche ou outils d'écoconception, politique d'achats responsables ou « verts » (critères environnementaux dans les appels d'offres). Ces documents montrent que l'entreprise agit à la source de ses impacts, au-delà de la seule gestion de site. Même partielle (un produit pilote, une grille de critères d'achat), cette démarche est un signal de maturité environnementale avancée." },
    ],
  },
  {
    id: 'loyaute', label: 'Loyauté & Clients', icon: '🤝',
    color: '#ea580c', colorLight: '#ffedd5', weight: 0.20,
    description: "Loyauté des pratiques et questions consommateurs : anticorruption, achats responsables, conformité produits, protection des données.",
    criteres: [
      { id: 'col-loy-anticorruption', label: "Anticorruption (code/politique anticorruption, cartographie des risques de corruption, dispositif Sapin II le cas échéant)", description: "Réunissez les documents de prévention de la corruption : code ou politique anticorruption, cartographie des risques de corruption, et les éléments du dispositif Sapin II (procédure d'évaluation des tiers, dispositif d'alerte, formation) pour les entreprises assujetties. Ces pièces attestent de l'intégrité des pratiques d'affaires, pilier de la loyauté des pratiques de l'ISO 26000. Précisez si l'entreprise est sous le seuil d'assujettissement à Sapin II : une démarche volontaire reste alors un point fort." },
      { id: 'col-loy-achats', label: "Achats responsables (charte fournisseurs, clauses RSE des contrats, suivi des délais de paiement)", description: "Collectez les preuves d'achats et de relations fournisseurs responsables : charte fournisseurs ou code de conduite des achats, clauses RSE intégrées aux contrats, et suivi des délais de paiement (indicateur de loyauté des relations commerciales). Ces documents démontrent que l'entreprise étend ses exigences RSE à sa chaîne de valeur. Le respect des délais de paiement est un marqueur concret et facilement vérifiable de loyauté envers les partenaires." },
      { id: 'col-loy-produits', label: "Conformité produits & satisfaction clients (marquage CE/GPSR, politique qualité, suivi satisfaction et réclamations, procédure de rappel)", description: "Fournissez les preuves de conformité produit et d'écoute client : marquages réglementaires (CE, conformité GPSR), politique ou certification qualité, dispositifs de suivi de la satisfaction et de traitement des réclamations, et procédure de rappel produit. Ces documents couvrent la question « consommateurs » de l'ISO 26000 : sécurité, information loyale et service après-vente. Un suivi documenté des réclamations et de leur traitement témoigne d'une véritable orientation client." },
      { id: 'col-loy-rgpd', label: "Protection des données personnelles (registre des traitements RGPD, mentions d'information, désignation DPO)", description: "Rassemblez les preuves de conformité au RGPD : registre des activités de traitement, mentions d'information et politiques de confidentialité, désignation d'un délégué à la protection des données (DPO) le cas échéant, et procédures de gestion des droits des personnes. Ces documents attestent du respect de la vie privée des clients, salariés et partenaires. Un registre des traitements tenu à jour est l'élément central exigé par la réglementation et un bon indicateur de maturité sur le sujet." },
    ],
  },
  {
    id: 'territoire', label: 'Territoire & Reporting', icon: '📊',
    color: '#9333ea', colorLight: '#f3e8ff', weight: 0.20,
    description: "Ancrage local, engagement sociétal, cadrage économique de l'entreprise et reporting extra-financier.",
    criteres: [
      { id: 'col-ter-ancrage', label: "Ancrage territorial & partenariats locaux (part d'achats locaux, partenariats, conventions)", description: "Collectez les preuves d'ancrage territorial : indicateurs d'achats locaux ou de proximité, conventions et partenariats avec des acteurs du territoire (collectivités, écoles, associations, réseaux d'entreprises). Ces documents illustrent la contribution de l'entreprise au développement économique local, une des questions centrales de l'ISO 26000 (communautés et développement local). Même informels, des partenariats récurrents et documentés valorisent l'enracinement territorial de la PME." },
      { id: 'col-ter-mecenat', label: "Mécénat & engagement sociétal (dons, bénévolat de compétences, actions ESS/insertion)", description: "Fournissez les preuves d'engagement sociétal : dons et mécénat (financier, en nature, de compétences), actions de bénévolat ou de mécénat de compétences, partenariats avec l'économie sociale et solidaire ou des structures d'insertion. Ces documents témoignent de la solidarité de l'entreprise et de sa contribution à l'intérêt général. Conservez les justificatifs (reçus fiscaux, conventions de mécénat) qui matérialisent et valorisent ces engagements." },
      { id: 'col-ter-cadrage', label: "Cadrage de l'entreprise (présentation activité/effectif/CA, chaîne de valeur, bilans et comptes de résultat 2-3 exercices)", description: "Réunissez les documents de cadrage économique : présentation de l'activité, des effectifs et du chiffre d'affaires, description de la chaîne de valeur (fournisseurs, processus, clients), et les bilans et comptes de résultat des 2 à 3 derniers exercices. Ces pièces situent le poids et le modèle économique de l'entreprise, indispensables pour proportionner les attentes RSE à sa réalité. Elles donnent au consultant le contexte nécessaire pour interpréter les autres données du diagnostic." },
      { id: 'col-ter-reporting', label: "Reporting & labels (DPEF/CSRD/VSME, notation EcoVadis, labels obtenus, obligations réglementaires applicables)", description: "Collectez les documents de reporting et de reconnaissance externe : déclaration de performance extra-financière (DPEF), rapport CSRD ou rapport volontaire VSME, notation EcoVadis ou autres évaluations, labels RSE obtenus (Lucie, Engagé RSE, B Corp…), et l'identification des obligations réglementaires applicables. Ces preuves attestent de la transparence de l'entreprise et de sa reconnaissance par des tiers. Elles permettent de relier la collecte aux référentiels de reporting et d'anticiper les obligations à venir." },
    ],
  },
]

export const COLLECTE_RSE_NIVEAUX = [
  { value: 0, shortLabel: 'NC', label: 'Absent',          description: "Document inexistant ou non identifié",                                      pct: 0,    color: '#9ca3af', bg: 'bg-gray-100 dark:bg-gray-700',       text: 'text-gray-600 dark:text-gray-400'   },
  { value: 1, shortLabel: '1',  label: 'À constituer',    description: "Document à créer ou à demander, démarche non engagée",                    pct: 0.25, color: '#ef4444', bg: 'bg-red-50 dark:bg-red-900/20',       text: 'text-red-700 dark:text-red-400'     },
  { value: 2, shortLabel: '2',  label: 'Partiel',         description: "Document existant mais incomplet ou obsolète",                            pct: 0.50, color: '#f97316', bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-400' },
  { value: 3, shortLabel: '3',  label: 'Disponible',      description: "Document complet et disponible pour le diagnostic",                       pct: 0.75, color: '#4f46e5', bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-700 dark:text-indigo-400' },
  { value: 4, shortLabel: '4',  label: 'À jour & validé', description: "Document à jour, daté, signé/validé et transmis",                        pct: 1.0,  color: '#16a34a', bg: 'bg-green-50 dark:bg-green-900/20',   text: 'text-green-700 dark:text-green-400' },
]

const BADGE_LEVELS = [
  { label: 'Dossier exemplaire',              min: 85, color: '#4f46e5', icon: '⭐' },
  { label: 'Dossier prêt pour le diagnostic', min: 60, color: '#16a34a', icon: '✅' },
  { label: 'Collecte en cours',               min: 30, color: '#f97316', icon: '🔄' },
  { label: 'Dossier insuffisant',             min: 0,  color: '#dc2626', icon: '❌' },
]

export function calculateCollecteRseScore(niveaux: Record<string, number>): number {
  let total = 0
  for (const axe of COLLECTE_RSE_AXES) {
    let axeScore = 0
    const nb = axe.criteres.length
    for (const c of axe.criteres) {
      const n = niveaux[c.id] ?? 0
      axeScore += (COLLECTE_RSE_NIVEAUX[n]?.pct ?? 0) / nb
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
interface Member { user_id: string; email: string; full_name: string | null; isOwner: boolean; permission: 'read' | 'edit' | null }

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function card(extra = '') { return `bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl ${extra}` }
function inputCls() { return 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500' }
function labelCls() { return 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1' }
function btnP(extra = '') { return `px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-50 ${extra}` }
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

function memberLabel(m: Member): string {
  return (m.full_name && m.full_name.trim()) || m.email
}

/**
 * Sélecteur de responsable d'action : liste stricte des membres du dossier
 * (propriétaire + utilisateurs partagés). La valeur stockée est le libellé affiché
 * (full_name, sinon email). Une valeur déjà saisie absente de la liste est
 * conservée en tant qu'« ancienne valeur » pour ne pas perdre l'existant.
 */
function ResponsableSelect({ value, members, onChange, className }: {
  value: string
  members: Member[]
  onChange: (v: string) => void
  className?: string
}) {
  const labels = members.map(memberLabel)
  const hasLegacy = value.trim() !== '' && !labels.includes(value)
  return (
    <select className={className} value={value} onChange={e => onChange(e.target.value)}>
      <option value="">— Non assigné —</option>
      {members.map(m => {
        const lbl = memberLabel(m)
        return <option key={m.user_id} value={lbl}>{lbl}{m.isOwner ? ' (propriétaire)' : ''}</option>
      })}
      {hasLegacy && <option value={value}>{value} (ancienne valeur)</option>}
    </select>
  )
}

function critereLabel(id: string): string {
  for (const axe of COLLECTE_RSE_AXES) {
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
          <span className="text-4xl">🗂️</span>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Collecte documentaire RSE</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Outil de préparation au diagnostic initial de maturité RSE selon l&apos;ISO 26000</p>
          </div>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          La <strong>Collecte documentaire RSE</strong> guide la PME pour <strong>rassembler les preuves documentaires</strong> attendues
          en vue d&apos;un diagnostic initial de maturité RSE. Les catégories de documents sont organisées selon les
          <strong> 7 questions centrales de l&apos;ISO 26000</strong>, regroupées en 5 axes, et l&apos;outil mesure le
          <strong> taux de complétude du dossier</strong> avant l&apos;évaluation. Plutôt qu&apos;une maturité, chaque niveau exprime
          l&apos;<strong>état du document</strong> : absent, à constituer, partiel, disponible, ou à jour et validé.
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          L&apos;<strong>absence d&apos;un document est elle-même une donnée de maturité</strong> : elle révèle les chantiers à ouvrir.
          Privilégiez les <strong>preuves datées et signées</strong>, et adaptez la collecte au profil de la PME — tous les documents
          ne concernent pas toutes les structures. Les pièces se déposent <strong>directement sur SharePoint</strong>, classées par
          catégorie, et <strong>alimentent ensuite les autres apps RSE</strong> de la plateforme (Diagnostic initial ISO 26000,
          AFAQ 26000, Bilan GES…). Cette application centralise ainsi votre dossier de preuves et pilote sa préparation.
        </p>
      </div>

      {/* Points clés + référentiels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={card('p-5 border-l-4 border-indigo-600')}>
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">🗂️ Principes de la collecte documentaire</h3>
          <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
            <div className="flex items-start gap-2">
              <span className="text-indigo-600 font-bold flex-shrink-0">📑</span>
              <span><strong>Un dossier de preuves structuré</strong> selon les 7 questions centrales de l&apos;ISO 26000, regroupées en 5 axes et 20 catégories de documents.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-indigo-600 font-bold flex-shrink-0">📊</span>
              <span><strong>Un taux de complétude</strong> qui mesure votre niveau de préparation au diagnostic — l&apos;absence d&apos;un document est elle-même une donnée de maturité.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-indigo-600 font-bold flex-shrink-0">✍️</span>
              <span><strong>Des preuves datées et signées</strong> à privilégier : un document à jour, validé et transmis vaut davantage qu&apos;une intention non formalisée.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-indigo-600 font-bold flex-shrink-0">☁️</span>
              <span><strong>Dépôt direct sur SharePoint</strong> : les pièces se classent par catégorie dans « Notes & documents », sans transiter par la plateforme.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-indigo-600 font-bold flex-shrink-0">🔗</span>
              <span><strong>Un socle réutilisable</strong> : le dossier alimente les autres apps RSE (Diagnostic initial ISO 26000, AFAQ 26000, EcoVadis, Bilan GES, VSME…).</span>
            </div>
          </div>
        </div>

        <div className={card('p-5 border-l-4 border-blue-500')}>
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">📋 Référentiels mobilisés</h3>
          <div className="space-y-1">
            {[
              ['🏛️', 'ISO 26000 — 7 questions centrales de la responsabilité sociétale'],
              ['📜', 'CSRD / ESRS — reporting de durabilité européen'],
              ['📋', 'GRI Standards — reporting extra-financier international'],
              ['🌍', 'ODD / SDGs — Objectifs de développement durable'],
              ['⚖️', 'Loi Sapin II — prévention de la corruption'],
              ['🔒', 'RGPD — protection des données personnelles'],
              ['🛡️', 'GPSR — sécurité générale des produits'],
              ['⚖️', 'Index égalité F/H — égalité professionnelle'],
              ['🦺', 'DUERP — code du travail (risques professionnels)'],
            ].map(([icon, label]) => (
              <div key={label} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <span>{icon}</span><span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Les 5 axes */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Les 5 axes de collecte documentaire</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {COLLECTE_RSE_AXES.map(axe => (
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

      {/* États du document */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">États du document</h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {COLLECTE_RSE_NIVEAUX.map(n => (
            <div key={n.value} className={card('p-3 text-center')}>
              <div className="text-2xl font-bold" style={{ color: n.color }}>{n.shortLabel}</div>
              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mt-0.5">{n.label}</div>
              <div className="text-[10px] text-gray-400 mt-1 leading-tight">{n.description}</div>
              <div className="mt-2 text-xs font-medium" style={{ color: n.color }}>{Math.round(n.pct * 100)}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Badge de complétude */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Badge de complétude du dossier</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {BADGE_LEVELS.map(b => (
            <div key={b.label} className={card('p-4 text-center')}>
              <div className="text-3xl">{b.icon}</div>
              <div className="font-bold text-sm mt-1" style={{ color: b.color }}>{b.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">≥ {b.min}%</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">Seuils : 0-30% ❌ Dossier insuffisant · 30-60% 🔄 Collecte en cours · 60-85% ✅ Dossier prêt pour le diagnostic · 85-100% ⭐ Dossier exemplaire</p>
      </div>

      {/* Comment utiliser */}
      <div className={card('p-5 space-y-3')}>
        <h3 className="font-semibold text-gray-900 dark:text-white">💡 Comment utiliser cette application</h3>
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          {[
            ['1', "Cocher l'état de chaque document", "Pour chaque catégorie, indiquez l'état du document (Absent à À jour & validé) et précisez en commentaire les pièces réellement disponibles."],
            ['2', 'Déposer les pièces', "Dans « Notes & documents » de chaque catégorie, uploadez directement sur SharePoint les documents collectés, classés par catégorie."],
            ['3', 'Créer des actions', "Pour les documents manquants ou à actualiser, créez des actions ciblées (responsable, échéance) afin de constituer le dossier."],
            ['4', 'Exporter la check-list', "Générez la check-list documentaire en Excel (6 onglets) pour suivre la collecte et la partager avec votre consultant."],
          ].map(([num, title, desc]) => (
            <div key={num} className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold">{num}</div>
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

  const axeStats = COLLECTE_RSE_AXES.map(axe => {
    const total = axe.criteres.length
    const niveaux = axe.criteres.map(c => reponses[c.id]?.niveau ?? 0)
    const pct = niveaux.reduce((s, n) => s + (COLLECTE_RSE_NIVEAUX[n]?.pct ?? 0), 0) / total
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
          <div className="text-sm text-gray-400">% de complétude</div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold" style={{ background: `${badge.color}22`, color: badge.color }}>
            {badge.icon} {badge.label}
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
            <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${score}%`, background: badge.color }} />
          </div>
          <div className="text-xs text-gray-400 mt-1">Seuils : 30% Collecte en cours · 60% Dossier prêt · 85% Dossier exemplaire</div>
        </div>

        {/* Radar */}
        <div className={card('p-4 sm:col-span-2')}>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Complétude par axe</h3>
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
              <polygon points={dataPolygon} fill="#4f46e522" stroke="#4f46e5" strokeWidth="2.5" strokeLinejoin="round" />
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
                  <div className="text-[10px] text-gray-400">{axe.renseignes}/{axe.total} catégories renseignées</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Détail par axe */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Détail par axe et catégorie de documents</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {axeStats.map(axe => (
            <div key={axe.id} className={card('p-4 space-y-2')}>
              <div className="flex items-center gap-2">
                <span className="text-xl">{axe.icon}</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{axe.label}</div>
                  <div className="text-xs text-gray-400">Poids {Math.round(axe.weight * 100)}% · Complétude : <span className="font-bold" style={{ color: axe.color }}>{Math.round(axe.pct * 100)}%</span></div>
                </div>
              </div>
              <div className="space-y-1.5 ml-1">
                {axe.criteres.map(c => {
                  const n = reponses[c.id]?.niveau ?? 0
                  const niv = COLLECTE_RSE_NIVEAUX[n]
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
            <div className="h-2 rounded-full bg-indigo-600 transition-all" style={{ width: `${Math.round(actions.filter(a => a.statut === 'termine').length / actions.length * 100)}%` }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Vue Correspondances ──────────────────────────────────────────────────────

const CORRESPONDANCES_COLLECTE = [
  {
    categorie: "Applications RSE Sens'ethO",
    icon: '🏠',
    color: 'indigo',
    items: [
      {
        ref: 'Diagnostic initial guidé ISO 26000', icon: '🧭', route: '/rse/diagnostic-initial',
        desc: "Lien fort — la collecte documentaire alimente directement le diagnostic initial : chaque preuve rassemblée vient étayer l'auto-évaluation de maturité et fiabiliser les réponses",
        liens: [
          { axe: 'gouvernance', label: 'Gouvernance',  ref: 'Diagnostic initial — Gouvernance, stratégie et engagement de la direction' },
          { axe: 'territoire',  label: 'Reporting',     ref: 'Diagnostic initial — Synthèse de maturité et plan de progrès' },
        ],
      },
      {
        ref: 'Diagnostic RSE ISO 26000 complet', icon: '🏛️', route: '/rse/iso26000',
        desc: "Le dossier documentaire constitue le socle de preuves du diagnostic RSE ISO 26000 complet : les pièces collectées par question centrale y sont directement réutilisées",
        liens: [
          { axe: 'social',        label: 'Social',        ref: 'ISO 26000 — Relations et conditions de travail' },
          { axe: 'environnement', label: 'Environnement', ref: 'ISO 26000 — L\'environnement' },
        ],
      },
      {
        ref: 'Évaluation AFAQ 26000', icon: '🥇', route: '/rse/afaq26000',
        desc: "L'évaluation AFAQ 26000 s'appuie sur les mêmes preuves documentaires — politiques signées, indicateurs et comptes rendus — pour scorer pratiques et résultats",
        liens: [
          { axe: 'gouvernance', label: 'Gouvernance', ref: 'AFAQ 26000 — Vision, gouvernance et déploiement de la démarche' },
          { axe: 'loyaute',     label: 'Loyauté',     ref: 'AFAQ 26000 — Loyauté des pratiques et relations consommateurs' },
        ],
      },
      {
        ref: 'EcoVadis', icon: '🏅', route: '/rse/ecovadis',
        desc: "La notation EcoVadis exige des preuves documentaires par pilier (Environnement, Social, Éthique, Achats) : la collecte les centralise et les tient à jour pour le dossier d'évaluation",
        liens: [
          { axe: 'loyaute',       label: 'Loyauté',       ref: 'EcoVadis — Éthique et achats responsables (preuves)' },
          { axe: 'environnement', label: 'Environnement', ref: 'EcoVadis — Pilier Environnement (politiques et indicateurs)' },
        ],
      },
      {
        ref: 'Bilan GES', icon: '🌱', route: '/rse/bilan-ges',
        desc: "Le Bilan GES réutilise les factures, suivis de consommations et le bilan carbone collectés dans l'axe Environnement pour calculer l'empreinte et le plan de transition",
        liens: [
          { axe: 'environnement', label: 'Environnement', ref: 'Bilan GES — Données d\'activité, consommations et émissions scopes 1-2-3' },
        ],
      },
      {
        ref: 'VSME / EFRAG', icon: '📈', route: '/rse/vsme-efrag',
        desc: "Le standard volontaire VSME pour PME mobilise les mêmes documents de reporting et indicateurs : la collecte préfigure les datapoints attendus par le module de base et complet",
        liens: [
          { axe: 'territoire', label: 'Reporting', ref: 'VSME — Indicateurs de durabilité et informations narratives' },
          { axe: 'social',     label: 'Social',    ref: 'VSME — Indicateurs sociaux (effectifs, santé-sécurité, formation)' },
        ],
      },
    ],
  },
  {
    categorie: 'Référentiels externes',
    icon: '📐',
    color: 'blue',
    items: [
      {
        ref: 'ISO 26000 — 7 questions centrales', icon: '🏛️', route: null,
        desc: "L'ISO 26000 structure toute la collecte : gouvernance, droits humains, relations et conditions de travail, environnement, loyauté des pratiques, questions consommateurs, communautés et développement local — chaque catégorie de documents s'y rattache",
        liens: [
          { axe: 'gouvernance', label: 'Gouvernance', ref: 'ISO 26000 §6.2 — Gouvernance de l\'organisation' },
          { axe: 'social',      label: 'Social',      ref: 'ISO 26000 §6.3 / §6.4 — Droits humains et conditions de travail' },
        ],
      },
      {
        ref: 'CSRD / ESRS', icon: '📜', route: null,
        desc: "Les standards ESRS structurent les datapoints de durabilité (E, S, G) : les documents collectés préfigurent le reporting CSRD pour les entreprises assujetties ou le rapport volontaire VSME pour les PME",
        liens: [
          { axe: 'territoire',    label: 'Reporting',     ref: 'ESRS 2 / ESRS S & G — Informations générales et thématiques' },
          { axe: 'environnement', label: 'Environnement', ref: 'ESRS E1-E5 — Climat, pollution, ressources, biodiversité' },
        ],
      },
      {
        ref: 'GRI Standards', icon: '📋', route: null,
        desc: "Référentiel international de reporting extra-financier : les indicateurs, politiques et données collectés alimentent les standards GRI thématiques (200 économiques, 300 environnementaux, 400 sociaux)",
        liens: [
          { axe: 'social',  label: 'Social',  ref: 'GRI 400 — Standards sociaux (emploi, santé-sécurité, diversité)' },
          { axe: 'loyaute', label: 'Loyauté', ref: 'GRI 205 / 418 — Lutte anticorruption et confidentialité des données' },
        ],
      },
      {
        ref: 'ODD / SDGs', icon: '🌍', route: null,
        desc: "Les 17 Objectifs de développement durable des Nations Unies : les preuves d'engagement collectées (sociales, environnementales, territoriales) documentent la contribution de la PME aux ODD",
        liens: [
          { axe: 'territoire', label: 'Territoire', ref: 'ODD 8, 11, 17 — Travail décent, territoires durables, partenariats' },
        ],
      },
      {
        ref: 'Loi Sapin II', icon: '⚖️', route: null,
        desc: "Dispositif anticorruption : code de conduite, cartographie des risques de corruption, évaluation des tiers et dispositif d'alerte — collectés dans l'axe Loyauté pour les entreprises assujetties",
        liens: [
          { axe: 'loyaute', label: 'Loyauté', ref: 'Sapin II — Programme de conformité anticorruption' },
        ],
      },
      {
        ref: 'RGPD', icon: '🔒', route: null,
        desc: "Protection des données personnelles : registre des traitements, mentions d'information, désignation DPO et gestion des droits — collectés dans l'axe Loyauté pour démontrer le respect de la vie privée",
        liens: [
          { axe: 'loyaute', label: 'Loyauté', ref: 'RGPD — Registre des traitements et conformité des données' },
        ],
      },
      {
        ref: 'GPSR — Règlement (UE) 2023/988', icon: '🛡️', route: null,
        desc: "Sécurité générale des produits : marquage CE/GPSR, procédure de rappel et suivi des réclamations — collectés dans l'axe Loyauté au titre des questions consommateurs",
        liens: [
          { axe: 'loyaute', label: 'Loyauté', ref: 'GPSR — Conformité produit et information du consommateur' },
        ],
      },
      {
        ref: 'Index égalité F/H', icon: '⚖️', route: null,
        desc: "Index de l'égalité professionnelle femmes-hommes (obligatoire au-delà d'un seuil d'effectif) : collecté dans l'axe Social au titre de l'égalité, de la diversité et des droits humains",
        liens: [
          { axe: 'social', label: 'Social', ref: 'Index F/H — Mesure et plan de réduction des écarts de rémunération' },
        ],
      },
      {
        ref: 'DUERP — Code du travail', icon: '🦺', route: null,
        desc: "Document unique d'évaluation des risques professionnels et plan d'actions associé (obligation légale) : collecté dans l'axe Social au titre de la santé et de la sécurité au travail",
        liens: [
          { axe: 'social', label: 'Social', ref: 'DUERP — Évaluation des risques professionnels et prévention' },
        ],
      },
    ],
  },
]

const AXE_BADGE_CLS: Record<string, string> = {
  gouvernance:   'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  social:        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  environnement: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  loyaute:       'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  territoire:    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
}

function CorrespondancesView() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className={card('p-4')}>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          La collecte documentaire RSE est un <strong>socle réutilisable</strong> : les preuves rassemblées alimentent
          l&apos;ensemble de vos démarches RSE. Les correspondances ci-dessous montrent comment le dossier nourrit les autres
          applications Sens&apos;ethO (Diagnostic initial ISO 26000, Diagnostic RSE complet, AFAQ 26000, EcoVadis, Bilan GES,
          VSME) et se rattache aux grands référentiels externes (ISO 26000, CSRD/ESRS, GRI, ODD, ainsi que des cadres
          spécifiques : Sapin II, RGPD, GPSR, index égalité F/H, DUERP).
        </p>
      </div>

      {CORRESPONDANCES_COLLECTE.map(cat => (
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
                          const axe = COLLECTE_RSE_AXES.find(a => a.id === l.axe)
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
  members: Member[]
  diagnosticId: string
  allNotes: Record<string, string>
  allNoteSections: Record<string, NoteSection[]>
  onReponseChange: (critere_id: string, niveau: number, commentaire: string) => void
  onActionsChange: (actions: Action[]) => void
  onNoteChange: (key: string, content: string) => void
  onNoteSectionsChange: (key: string, sections: NoteSection[]) => void
}

function CriterePanel({
  axe, critere, reponse, actions, members,
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
    const res = await fetch(`/api/collecte-rse/${diagnosticId}/actions`, {
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
    await fetch(`/api/collecte-rse/${diagnosticId}/actions?action_id=${id}`, { method: 'DELETE' })
    onActionsChange(actions.filter(a => a.id !== id))
  }

  async function saveEdit(id: string) {
    setSavingEdit(true)
    const res = await fetch(`/api/collecte-rse/${diagnosticId}/actions?action_id=${id}`, {
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
    const res = await fetch(`/api/collecte-rse/${diagnosticId}/actions?action_id=${action.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: next }),
    })
    if (res.ok) {
      const { data } = await res.json()
      onActionsChange(actions.map(a => a.id === action.id ? data : a))
    }
  }

  const niv = COLLECTE_RSE_NIVEAUX[niveau]

  return (
    <div className="space-y-5">
      {/* Header critère */}
      <div className="rounded-xl p-4 border border-gray-200 dark:border-gray-700" style={{ background: axe.colorLight + '80' }}>
        <h3 className="font-bold text-base" style={{ color: axe.color }}>{critere.label}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{critere.description}</p>
      </div>

      {/* État du document */}
      <div className={card('p-4 space-y-3')}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">État du document</div>
          {savingReponse && <span className="text-xs text-gray-400 animate-pulse">Enregistrement…</span>}
          {savedOk && !savingReponse && <span className="text-xs text-green-600 dark:text-green-400">✓ Sauvegardé</span>}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {COLLECTE_RSE_NIVEAUX.map(n => (
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
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">📝 Commentaire & documents à fournir</label>
        <p className="text-xs text-gray-500 dark:text-gray-400">Précisez les pièces réellement disponibles, leur date et leur niveau de validation, ainsi que les documents manquants à constituer ou à demander. Déposez ensuite les fichiers correspondants dans « Notes & documents » ci-dessous (dépôt direct sur SharePoint).</p>
        <textarea
          value={commentaire}
          onChange={e => handleCommentaireChange(e.target.value)}
          rows={4}
          placeholder="Ex : Politique RSE signée en 2024 disponible ; feuille de route à actualiser ; comptes rendus de comité RSE des 2 derniers exercices à rassembler…"
          className={`${inputCls()} resize-y`}
        />
        <GuidedActionNotePanel
          diagnosticId={diagnosticId}
          actionKey={critere.id}
          apiBase="/api/collecte-rse"
          noteTable="collecte_rse_notes"
          readOnly={false}
          note={allNotes[critere.id] ?? ''}
          onNoteChange={v => onNoteChange(critere.id, v)}
          initialSections={allNoteSections[critere.id] ?? []}
          onSectionsChange={s => onNoteSectionsChange(critere.id, s)}
        />
      </div>

      {/* Actions */}
      <div className={card('p-4 space-y-3')}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            🎯 Actions de collecte
            {critereActions.length > 0 && (
              <span className="ml-2 text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-1.5 py-0.5 rounded-full font-medium">
                {critereActions.filter(a => a.statut === 'termine').length}/{critereActions.length}
              </span>
            )}
          </div>
          <button onClick={() => setShowActionForm(v => !v)} className={btnP('text-xs py-1.5')}>+ Action</button>
        </div>

        {showActionForm && (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 space-y-2 border border-gray-200 dark:border-gray-700">
            <div><label className={labelCls()}>Titre *</label>
              <input className={inputCls()} value={actionForm.titre} onChange={e => setActionForm(f => ({ ...f, titre: e.target.value }))} placeholder="Ex : Demander le DUERP à jour au responsable QHSE" />
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
          <p className="text-xs text-gray-400 text-center py-3">Aucune action — créez des tâches concrètes pour constituer ou actualiser les documents de cette catégorie</p>
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
                        apiBase="/api/collecte-rse"
                        noteTable="collecte_rse_notes"
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
  members: Member[]
  allNotes: Record<string, string>
  allNoteSections: Record<string, NoteSection[]>
  onReponseChange: (critere_id: string, niveau: number, commentaire: string) => void
  onActionsChange: (a: Action[]) => void
  onNoteChange: (key: string, v: string) => void
  onNoteSectionsChange: (key: string, s: NoteSection[]) => void
}

function DiagnosticView({ diagnostic, reponses, actions, members, allNotes, allNoteSections, onReponseChange, onActionsChange, onNoteChange, onNoteSectionsChange }: DiagViewProps) {
  const [activeAxe, setActiveAxe] = useState(COLLECTE_RSE_AXES[0].id)
  const [activeCritere, setActiveCritere] = useState<string | null>(COLLECTE_RSE_AXES[0].criteres[0].id)

  const niveaux: Record<string, number> = {}
  for (const [k, v] of Object.entries(reponses)) niveaux[k] = v.niveau
  const scoreGlobal = calculateCollecteRseScore(niveaux)
  const badge = getBadge(scoreGlobal)

  return (
    <div className="space-y-4">
      {/* Score simulé */}
      <div className={card('p-4')}>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Taux de complétude</div>
            <div className="flex items-center gap-3">
              <div className="text-3xl font-black text-gray-900 dark:text-white">{scoreGlobal}</div>
              <div className="text-sm text-gray-400">%</div>
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: `${badge.color}22`, color: badge.color }}>
                {badge.icon} {badge.label}
              </div>
            </div>
            <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${scoreGlobal}%`, background: badge.color }} />
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {COLLECTE_RSE_AXES.map(axe => {
              const axeNiveaux = axe.criteres.map(c => niveaux[c.id] ?? 0)
              const axePct = Math.round(axeNiveaux.reduce((s, n) => s + COLLECTE_RSE_NIVEAUX[n].pct, 0) / axe.criteres.length * 100)
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
            {COLLECTE_RSE_AXES.map(axe => {
              const isOpen = activeAxe === axe.id
              const renseignes = axe.criteres.filter(c => (niveaux[c.id] ?? 0) > 0).length
              const axePct = Math.round(
                axe.criteres.reduce((s, c) => s + (niveaux[c.id] ?? 0) / 4, 0) / axe.criteres.length * 100
              )
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
                      <div className="text-[10px] text-gray-400">{renseignes}/{axe.criteres.length} catégories · complétude {axePct}%</div>
                    </div>
                    <span className="text-xs">{isOpen ? '▾' : '›'}</span>
                  </button>
                  {isOpen && (
                    <div className="ml-3 mt-1 space-y-0.5">
                      {axe.criteres.map(c => {
                        const n = niveaux[c.id] ?? 0
                        const niv = COLLECTE_RSE_NIVEAUX[n]
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
            const axe = COLLECTE_RSE_AXES.find(a => a.criteres.some(c => c.id === activeCritere))!
            const critere = axe.criteres.find(c => c.id === activeCritere)!
            return (
              <CriterePanel
                key={activeCritere}
                axe={axe}
                critere={critere}
                reponse={reponses[activeCritere] ?? null}
                actions={actions}
                members={members}
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
              <p className="text-gray-400 text-sm">Sélectionnez une catégorie de documents pour commencer la collecte</p>
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
  return COLLECTE_RSE_AXES.find(x => x.criteres.some(c => c.id === critereId))
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

function ActionsView({ diagnostic, actions, members, onActionsChange }: { diagnostic: DiagnosticData; actions: Action[]; members: Member[]; onActionsChange: (a: Action[]) => void }) {
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
          const ia = COLLECTE_RSE_AXES.findIndex(x => x.id === axeOf(a.critere_id)?.id)
          const ib = COLLECTE_RSE_AXES.findIndex(x => x.id === axeOf(b.critere_id)?.id)
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
  const groups = COLLECTE_RSE_AXES
    .map(axe => ({ axe, items: sortActions(filtered.filter(a => axeOf(a.critere_id)?.id === axe.id)) }))
    .filter(g => g.items.length > 0)

  async function saveEdit(id: string) {
    setSaving(true)
    const res = await fetch(`/api/collecte-rse/${diagnostic.id}/actions?action_id=${id}`, {
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
    const res = await fetch(`/api/collecte-rse/${diagnostic.id}/actions?action_id=${action.id}`, {
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
    await fetch(`/api/collecte-rse/${diagnostic.id}/actions?action_id=${id}`, { method: 'DELETE' })
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
          {COLLECTE_RSE_AXES.map(a => <option key={a.id} value={a.id}>{a.icon} {a.label}</option>)}
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
          <p className="text-gray-400 text-sm">Aucune action — créez-en depuis la vue Collecte, catégorie par catégorie</p>
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
                                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium hover:ring-2 hover:ring-offset-1 hover:ring-indigo-300 transition ${STATUT_COLORS[a.statut]}`}>
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
  { id: 'diagnostic',      label: 'Collecte',        icon: '🗂️' },
  { id: 'actions',         label: "Plan d'actions",  icon: '📝' },
  { id: 'correspondances', label: 'Correspondances', icon: '🔗' },
]

export default function CollecteRseDiagnosticApp({ ctx }: { ctx: RseContext }) {
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
  const [pdfData, setPdfData] = useState<CollectePdfData | null>(null)
  const [showShare, setShowShare] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [sharePermission, setSharePermission] = useState<'read'|'edit'>('read')
  const [shareSaving, setShareSaving] = useState(false)
  const [shareError, setShareError] = useState('')
  const [shareList, setShareList] = useState<{ id: string; email: string; permission: 'read'|'edit' }[]>([])
  const [members, setMembers] = useState<Member[]>([])

  const load = useCallback(async () => {
    if (!org || !year) return
    setLoading(true)
    try {
      const res = await fetch(`/api/collecte-rse?org_id=${org.id}&annee=${year}`)
      const { data: existingDiag } = await res.json()

      let diagId = existingDiag?.id
      if (!diagId) {
        setInitializing(true)
        const createRes = await fetch('/api/collecte-rse', {
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
        fetch(`/api/collecte-rse/${diagId}/reponses`),
        fetch(`/api/collecte-rse/${diagId}/actions`),
        fetch(`/api/collecte-rse/${diagId}/notes`),
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
    await fetch(`/api/collecte-rse/${diagnostic.id}/reponses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ critere_id, niveau, commentaire }),
    })
    setTimeout(async () => {
      setReponses(current => {
        const n2: Record<string, number> = {}
        for (const [k, v] of Object.entries(current)) n2[k] = v.niveau
        const score = calculateCollecteRseScore(n2)
        if (diagnostic) {
          fetch(`/api/collecte-rse/${diagnostic.id}`, {
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
    fetch(`/api/collecte-rse/${diagnostic.id}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_key: critere_id, content }),
    }).catch(e => console.error('[collecte-rse/notes]', e))
  }

  function handleNoteSectionsChange(critere_id: string, sections: NoteSection[]) {
    setNoteSections(prev => ({ ...prev, [critere_id]: sections }))
    if (!diagnostic) return
    fetch(`/api/collecte-rse/${diagnostic.id}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_key: critere_id, sections }),
    }).catch(e => console.error('[collecte-rse/notes/sections]', e))
  }

  async function handleExportExcel() {
    if (!diagnostic) return
    setExportingExcel(true)
    try {
      const res = await fetch(`/api/collecte-rse/${diagnostic.id}/export-excel`)
      if (!res.ok) throw new Error('Échec export')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `Collecte_RSE_${org?.denomination ?? 'dossier'}_${year}.xlsx`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { alert('Erreur export Excel : ' + String(e)) }
    finally { setExportingExcel(false) }
  }

  function buildPdfData(): CollectePdfData {
    const niveaux: Record<string, number> = {}
    const commentaires: Record<string, string> = {}
    for (const [k, v] of Object.entries(reponses)) {
      niveaux[k] = v.niveau
      if (v.commentaire) commentaires[k] = v.commentaire
    }
    const completude = diagnostic?.score_global ?? calculateCollecteRseScore(niveaux)
    return {
      organisation: org?.denomination ?? null,
      siren: org?.siren ?? null,
      ville: org?.ville ?? null,
      year,
      date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
      completude,
      axes: COLLECTE_RSE_AXES,
      niveaux: COLLECTE_RSE_NIVEAUX,
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
        if (document.querySelector('#collecte-pdf-root [data-pdf-page]')) { resolve(); return }
        const observer = new MutationObserver(() => {
          if (document.querySelector('#collecte-pdf-root [data-pdf-page]')) {
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
      const orgSlug = (org?.denomination ?? 'dossier').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
      await exportReport('collecte-pdf-root', `Collecte-documentaire-RSE-${orgSlug}-${year}.pdf`)
    } catch (e) {
      console.error('[collecte-rse/exportPDF]', e)
    } finally {
      setExportingPDF(false)
      setPdfData(null)
    }
  }

  const loadShares = useCallback(async () => {
    if (!diagnostic) return
    try {
      const res = await fetch(`/api/collecte-rse/${diagnostic.id}/shares`)
      const { data } = await res.json()
      setShareList(data ?? [])
    } catch { /* ignore */ }
  }, [diagnostic])

  useEffect(() => { if (showShare) loadShares() }, [showShare, loadShares])

  // Membres du dossier (propriétaire + partagés) — pour la liste des responsables d'actions
  const loadMembers = useCallback(async () => {
    if (!diagnostic) { setMembers([]); return }
    try {
      const res = await fetch(`/api/collecte-rse/${diagnostic.id}/members`)
      const { data } = await res.json()
      setMembers(data ?? [])
    } catch { /* ignore */ }
  }, [diagnostic])

  useEffect(() => { loadMembers() }, [loadMembers])

  async function handleAddShare() {
    if (!diagnostic || !shareEmail.trim()) return
    setShareSaving(true); setShareError('')
    try {
      const res = await fetch(`/api/collecte-rse/${diagnostic.id}/shares`, {
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
      await loadMembers()
    } catch {
      setShareError('Erreur de partage')
    } finally { setShareSaving(false) }
  }

  async function handleRemoveShare(shareId: string) {
    if (!diagnostic) return
    try {
      await fetch(`/api/collecte-rse/${diagnostic.id}/shares?shareId=${shareId}`, { method: 'DELETE' })
      await loadShares()
      await loadMembers()
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors">
          👥 Partager
        </button>
      </div>
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnostic, exportingExcel, exportingPDF])

  const lockedTabs = !org || !diagnostic ? ['dashboard', 'diagnostic', 'actions'] : []

  if (loading && !diagnostic) {
    return <div className="flex justify-center items-center py-20 text-gray-400 text-sm animate-pulse">
      {initializing ? 'Initialisation de la Collecte documentaire RSE…' : 'Chargement…'}
    </div>
  }

  return (
    <div className="space-y-4">

      {/* ── Rapport PDF (monté hors-écran le temps de l'export) ─────────────── */}
      {pdfData && (
        <div style={{ position: 'absolute', left: -9999, top: 0 }} aria-hidden="true">
          <CollecteRsePDFReport id="collecte-pdf-root" data={pdfData} />
        </div>
      )}

      {/* ── Modale Partage ──────────────────────────────────────────────────── */}
      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowShare(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-bold text-gray-900 dark:text-white">👥 Partager la Collecte documentaire RSE</h2>
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
          <span>Complétude du dossier :</span>
          <span className="font-bold text-gray-900 dark:text-white">{diagnostic.score_global ?? calculateCollecteRseScore(Object.fromEntries(Object.entries(reponses).map(([k, v]) => [k, v.niveau])))}%</span>
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
                view === v.id ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
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
          score={diagnostic.score_global ?? calculateCollecteRseScore(Object.fromEntries(Object.entries(reponses).map(([k, v]) => [k, v.niveau])))}
        />
      )}
      {view === 'diagnostic' && org && diagnostic && (
        <DiagnosticView
          diagnostic={diagnostic}
          reponses={reponses}
          actions={actions}
          members={members}
          allNotes={notes}
          allNoteSections={noteSections}
          onReponseChange={handleReponseChange}
          onActionsChange={setActions}
          onNoteChange={handleNoteChange}
          onNoteSectionsChange={handleNoteSectionsChange}
        />
      )}
      {view === 'actions' && diagnostic && (
        <ActionsView diagnostic={diagnostic} actions={actions} members={members} onActionsChange={setActions} />
      )}
    </div>
  )
}

/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import type { RseContext } from '@/components/rse/RseAppShell'
import ConfirmModal from '@/components/ui/ConfirmModal'
import ShareAutocomplete from '@/components/apps/ShareAutocomplete'
import type { NoteSection } from '@/components/apps/GuidedActionNotePanel'
import type { Afaq26000PdfData } from '@/components/apps/Afaq26000PDFReport'

// GuidedActionNotePanel chargé en lazy — même pattern que les autres apps RSE
const GuidedActionNotePanel = dynamic(() => import('@/components/apps/GuidedActionNotePanel'), {
  ssr: false,
  loading: () => <div className="py-3 text-xs text-gray-400 animate-pulse">Chargement éditeur…</div>
})

// Rapport PDF chargé en lazy (html2canvas + jspdf hors du bundle principal)
const Afaq26000PDFReport = dynamic(() => import('@/components/apps/Afaq26000PDFReport'), {
  ssr: false,
  loading: () => null,
})

// ─── Données statiques Évaluation AFAQ 26000 ──────────────────────────────────

export const AFAQ26000_AXES = [
  {
    id: 'gouvernance', label: 'Vision & Gouvernance', icon: '🧭',
    color: '#7c3aed', colorLight: '#ede9fe', weight: 0.20,
    description: "Critère 1 AFAQ 26000 : vision RSE, stratégie, gouvernance, éthique des affaires et déploiement de la responsabilité sociétale.",
    criteres: [
      { id: 'afq-vis-strategie', label: "Vision et stratégie RSE intégrées au modèle d'affaires", description: "La direction a formalisé une vision de la responsabilité sociétale qui donne du sens à l'activité de l'organisation et l'a traduite dans une stratégie intégrée au modèle d'affaires : la RSE n'est pas une démarche périphérique mais un axe structurant de la création de valeur. Les principes de l'ISO 26000 (redevabilité, transparence, comportement éthique, respect des intérêts des parties prenantes, légalité, normes internationales de comportement, droits de l'Homme) irriguent les décisions stratégiques. La cohérence entre le discours, les engagements et les pratiques observées est un point d'attention majeur de l'évaluateur AFAQ 26000." },
      { id: 'afq-vis-gouvernance', label: "Gouvernance, éthique des affaires et loyauté des pratiques", description: "Les instances de gouvernance (direction, comité de pilotage RSE, conseil) intègrent la responsabilité sociétale dans leurs processus de décision et de contrôle : responsabilités attribuées, redevabilité organisée, remontée des sujets RSE au plus haut niveau. L'éthique des affaires et la loyauté des pratiques sont encadrées : prévention de la corruption et des conflits d'intérêts, concurrence loyale, respect des droits de propriété, dispositif d'alerte. La gouvernance veille également au respect du devoir de vigilance dans la sphère d'influence de l'organisation." },
      { id: 'afq-vis-deploiement', label: "Déploiement de la stratégie RSE (objectifs, plans d'actions, pilotage)", description: "La stratégie RSE est déclinée en objectifs mesurables aux fonctions et niveaux pertinents, avec des plans d'actions précisant responsabilités, ressources, échéances et indicateurs de suivi. Un dispositif de pilotage (revues périodiques, tableaux de bord, comité RSE) permet de mesurer l'avancement, d'arbitrer et d'ajuster la trajectoire. L'évaluation AFAQ 26000 vérifie que le déploiement atteint l'ensemble des activités, des sites et des équipes — et pas seulement le siège ou les fonctions support." },
      { id: 'afq-vis-risques', label: "Analyse des enjeux, risques et opportunités RSE (matérialité, parties prenantes)", description: "L'organisation a identifié et hiérarchisé ses enjeux de responsabilité sociétale à partir d'une analyse de matérialité croisant l'importance pour les parties prenantes et l'impact sur l'activité. Les risques et opportunités liés à chaque enjeu (réglementaires, climatiques, sociaux, réputationnels, marchés) sont analysés et intégrés à la gestion globale des risques. Cette analyse est actualisée périodiquement et fonde la priorisation de la stratégie RSE et l'allocation des ressources." },
    ],
  },
  {
    id: 'integration', label: 'Intégration RSE & Communication', icon: '📣',
    color: '#2563eb', colorLight: '#dbeafe', weight: 0.20,
    description: "Critère 2 AFAQ 26000 : intégration de la RSE dans les processus et métiers, dialogue avec les parties prenantes, communication responsable, achats responsables.",
    criteres: [
      { id: 'afq-int-processus', label: "Intégration de la RSE dans les processus et métiers (qualité, innovation, support)", description: "Les exigences de responsabilité sociétale sont intégrées dans les processus opérationnels et support de l'organisation : conception et innovation, production, qualité, ressources humaines, finances, systèmes d'information. Chaque métier identifie sa contribution aux enjeux RSE et dispose de critères, de consignes et d'indicateurs adaptés. L'évaluateur AFAQ 26000 recherche des preuves d'appropriation par les équipes terrain : la RSE doit être vécue dans les pratiques quotidiennes, pas seulement décrite dans les procédures." },
      { id: 'afq-int-parties', label: "Identification et dialogue avec les parties prenantes", description: "L'organisation a cartographié ses parties prenantes (salariés, clients, fournisseurs, riverains, collectivités, actionnaires, associations…) et qualifié leurs attentes ainsi que leur influence sur l'activité. Des modalités de dialogue structurées et proportionnées sont mises en place : enquêtes, comités, rencontres, consultations, partenariats. Les résultats de ce dialogue sont analysés et pris en compte dans les décisions, et l'organisation rend compte aux parties prenantes des suites données à leurs attentes." },
      { id: 'afq-int-communication', label: "Communication interne et externe responsable (transparence, anti-greenwashing)", description: "La communication de l'organisation sur ses engagements et résultats RSE est sincère, factuelle et vérifiable : les allégations environnementales et sociales sont étayées par des preuves, conformément aux exigences de loyauté de l'ISO 26000 et aux réglementations anti-greenwashing. En interne, la communication mobilise les équipes autour de la démarche : sens, objectifs, résultats, valorisation des initiatives. Le reporting extra-financier (rapport RSE, déclarations) est fiable, équilibré — y compris sur les points faibles — et accessible aux parties prenantes." },
      { id: 'afq-int-achats', label: "Achats responsables et relations fournisseurs équitables", description: "La politique d'achats intègre des critères sociaux, environnementaux et éthiques dans la sélection et l'évaluation des fournisseurs et sous-traitants : clauses RSE, questionnaires, audits, plans de progrès partagés. Les relations fournisseurs sont équitables et conformes aux bonnes pratiques : délais de paiement respectés, juste répartition de la valeur, prévention de la dépendance économique, accompagnement des petits fournisseurs. L'organisation exerce son devoir de vigilance sur sa chaîne d'approvisionnement et promeut la responsabilité sociétale dans sa sphère d'influence." },
    ],
  },
  {
    id: 'rh', label: 'Ressources humaines & Relations de travail', icon: '👥',
    color: '#16a34a', colorLight: '#dcfce7', weight: 0.20,
    description: "Critère 3 AFAQ 26000 : politique RH responsable, conditions de travail, santé-sécurité, dialogue social et développement du capital humain.",
    criteres: [
      { id: 'afq-rh-emploi', label: "Politique d'emploi responsable (recrutement, diversité, insertion)", description: "La politique d'emploi de l'organisation est responsable et non discriminatoire : processus de recrutement objectivés, promotion de la diversité et de l'égalité professionnelle (femmes-hommes, handicap, âges, origines), insertion des publics éloignés de l'emploi (alternance, insertion, partenariats locaux). La sécurisation des parcours est recherchée : recours mesuré aux contrats précaires, anticipation des évolutions des métiers, gestion des fins de carrière. Des indicateurs (index égalité, taux d'emploi de travailleurs handicapés, turnover) mesurent les résultats de cette politique." },
      { id: 'afq-rh-conditions', label: "Conditions de travail, santé-sécurité et qualité de vie au travail", description: "L'organisation protège la santé et la sécurité de ses salariés et des intervenants extérieurs : évaluation des risques professionnels (DUERP), plans de prévention, formation sécurité, analyse des accidents et presque-accidents, prévention des risques psychosociaux. La qualité de vie et des conditions de travail est une préoccupation active : ergonomie, équilibre vie professionnelle-vie personnelle, télétravail encadré, prévention de la pénibilité. Les résultats (accidentologie, absentéisme, baromètres sociaux) sont suivis et orientent les actions d'amélioration." },
      { id: 'afq-rh-dialogue', label: "Dialogue social et participation des salariés", description: "Le dialogue social est loyal et constructif : instances représentatives du personnel informées et consultées au-delà des obligations légales, négociations collectives régulières, traitement des désaccords dans le respect des parties. Les salariés sont associés à la vie et aux décisions de l'organisation : dispositifs participatifs, groupes de travail, boîtes à idées, intéressement et participation aux résultats. L'évaluation AFAQ 26000 apprécie la qualité réelle du climat social et la liberté d'expression effective des équipes." },
      { id: 'afq-rh-competences', label: "Développement des compétences et employabilité", description: "L'organisation développe le capital humain : plan de développement des compétences structuré, entretiens professionnels effectifs, accès équitable à la formation pour toutes les catégories de personnel. L'employabilité des salariés est entretenue au-delà du poste occupé : qualifications transférables, mobilité interne, accompagnement des reconversions, transmission des savoir-faire. Les compétences liées à la responsabilité sociétale (achats responsables, écoconception, prévention) font l'objet d'un effort de formation spécifique pour ancrer la démarche dans les métiers." },
    ],
  },
  {
    id: 'environnement', label: 'Production, Consommation durables & Environnement', icon: '🌍',
    color: '#0d9488', colorLight: '#ccfbf1', weight: 0.20,
    description: "Critère 4 AFAQ 26000 : modes de production et de consommation responsables, protection de l'environnement, ressources, climat et cycle de vie des produits.",
    criteres: [
      { id: 'afq-env-management', label: "Management environnemental (politique, conformité, prévention des pollutions)", description: "L'organisation a structuré son management environnemental : politique formalisée, identification et évaluation des aspects et impacts environnementaux significatifs, veille et conformité réglementaire (ICPE, déchets, eau, air), prévention des pollutions et des situations d'urgence. Les responsabilités sont attribuées et les moyens alloués, avec un suivi périodique des plans d'actions environnementaux. Une certification ISO 14001 ou une démarche équivalente constitue un point d'appui valorisé par l'évaluation AFAQ 26000." },
      { id: 'afq-env-ressources', label: "Utilisation durable des ressources (énergie, eau, matières, économie circulaire)", description: "Les consommations de ressources (énergie, eau, matières premières) sont mesurées, analysées et font l'objet d'objectifs de réduction et de plans d'efficacité. L'organisation s'inscrit dans une logique d'économie circulaire : écoconception, réemploi, réparation, recyclage, valorisation des déchets, approvisionnements en matières recyclées ou renouvelables. La sobriété est recherchée à toutes les étapes : achats, production, logistique, usage des bâtiments et des équipements." },
      { id: 'afq-env-climat', label: "Atténuation et adaptation au changement climatique (GES, trajectoire)", description: "L'organisation connaît ses émissions de gaz à effet de serre (bilan GES couvrant les scopes pertinents, y compris les principaux postes du scope 3) et s'est fixé une trajectoire de réduction cohérente avec les objectifs climatiques nationaux et internationaux. Des plans d'actions concrets sont déployés : efficacité énergétique, énergies renouvelables, mobilité, fret, écoconception, engagement des fournisseurs. L'adaptation au changement climatique est également traitée : analyse des vulnérabilités physiques des sites et de la chaîne de valeur, et mesures d'adaptation associées." },
      { id: 'afq-env-produits', label: "Écoconception, cycle de vie des produits/services et consommation responsable", description: "Les impacts environnementaux et sociaux des produits et services sont évalués sur l'ensemble de leur cycle de vie : extraction des matières, fabrication, distribution, usage et fin de vie. L'écoconception est intégrée au développement des offres : réduction des matières et des emballages, durabilité, réparabilité, recyclabilité, sobriété à l'usage. L'organisation promeut une consommation responsable auprès de ses clients : information environnementale loyale, affichage, services de réparation et de reprise, lutte contre l'obsolescence." },
    ],
  },
  {
    id: 'territorial', label: 'Ancrage territorial & Résultats', icon: '📊',
    color: '#ea580c', colorLight: '#ffedd5', weight: 0.20,
    description: "Critère 5 AFAQ 26000 (ancrage territorial et développement local) et critères 6-7-8 : résultats environnementaux, sociaux et économiques mesurés.",
    criteres: [
      { id: 'afq-ter-ancrage', label: "Ancrage territorial : contribution au développement local, emploi, partenariats", description: "L'organisation contribue activement au développement de son territoire : emploi local et insertion, recours aux fournisseurs et prestataires de proximité, participation aux dynamiques économiques locales (filières, clusters, associations d'entreprises). Elle entretient des partenariats avec les acteurs du territoire : collectivités, établissements d'enseignement, structures d'insertion, associations, et soutient des initiatives d'intérêt général (mécénat, bénévolat de compétences). Son implantation est conduite en dialogue avec les communautés locales, dans le respect de leurs intérêts." },
      { id: 'afq-ter-resultats-env', label: "Résultats environnementaux mesurés et tendances (indicateurs, comparaisons)", description: "L'organisation dispose d'indicateurs environnementaux pertinents, fiables et suivis dans la durée : consommations d'énergie et d'eau, émissions de GES, production et valorisation des déchets, incidents environnementaux. Les résultats sont analysés en tendance sur plusieurs exercices, comparés aux objectifs fixés et, lorsque c'est possible, à des références externes (secteur, réglementation, meilleures pratiques). Conformément aux critères de résultats de la grille AFAQ 26000, c'est la performance démontrée — et pas seulement les pratiques — qui est évaluée." },
      { id: 'afq-ter-resultats-soc', label: "Résultats sociaux mesurés (climat social, accidentologie, formation, diversité)", description: "Les résultats sociaux de l'organisation sont mesurés et analysés en tendance : accidentologie (taux de fréquence et de gravité), absentéisme et turnover, accès à la formation, index d'égalité professionnelle, emploi de travailleurs handicapés, baromètres de climat social et d'engagement. Ces indicateurs sont comparés aux objectifs et aux références disponibles, et les écarts font l'objet d'analyses de causes et d'actions correctives. La perception des salariés et des parties prenantes sociales est recueillie et intégrée à l'évaluation de la performance." },
      { id: 'afq-ter-resultats-eco', label: "Résultats économiques et redistribution de la valeur aux parties prenantes", description: "La performance économique de l'organisation est suivie dans une perspective de durabilité : rentabilité, solidité financière, investissements dans la transition, part de l'activité liée aux offres responsables. La valeur créée est équitablement redistribuée aux parties prenantes : salaires et intéressement, dividendes mesurés, paiement des fournisseurs dans les délais, contribution fiscale assumée sur les territoires, soutien aux communautés. L'évaluation AFAQ 26000 apprécie la capacité de l'organisation à concilier performance économique et responsabilité sociétale dans la durée." },
    ],
  },
]

export const AFAQ26000_NIVEAUX = [
  { value: 0, shortLabel: 'NC', label: 'Non engagé',          description: "Aucune pratique ni résultat sur ce critère, démarche non engagée",          pct: 0,    color: '#9ca3af', bg: 'bg-gray-100 dark:bg-gray-700',         text: 'text-gray-600 dark:text-gray-400'   },
  { value: 1, shortLabel: '1',  label: 'Engagement initial',  description: "Premières actions engagées, pratiques ponctuelles non systématisées",       pct: 0.25, color: '#ef4444', bg: 'bg-red-50 dark:bg-red-900/20',         text: 'text-red-700 dark:text-red-400'     },
  { value: 2, shortLabel: '2',  label: 'Progression',         description: "Démarche structurée et déployée, premiers résultats mesurés",               pct: 0.50, color: '#f97316', bg: 'bg-orange-50 dark:bg-orange-900/20',   text: 'text-orange-700 dark:text-orange-400' },
  { value: 3, shortLabel: '3',  label: 'Confirmé',            description: "Pratiques systématiques et matures, résultats probants en tendance",        pct: 0.75, color: '#8b5cf6', bg: 'bg-violet-50 dark:bg-violet-900/20',   text: 'text-violet-700 dark:text-violet-400' },
  { value: 4, shortLabel: '4',  label: 'Exemplaire',          description: "Performance exemplaire et inspirante, RSE pleinement intégrée à la stratégie", pct: 1.0, color: '#16a34a', bg: 'bg-green-50 dark:bg-green-900/20',     text: 'text-green-700 dark:text-green-400' },
]

const BADGE_LEVELS = [
  { label: 'Exemplaire',         min: 85, color: '#7c3aed', icon: '⭐' },
  { label: 'Confirmé',           min: 60, color: '#16a34a', icon: '✅' },
  { label: 'Progression',        min: 30, color: '#f97316', icon: '🔄' },
  { label: 'Engagement initial', min: 0,  color: '#dc2626', icon: '🌱' },
]

export function calculateAfaq26000Score(niveaux: Record<string, number>): number {
  let total = 0
  for (const axe of AFAQ26000_AXES) {
    let axeScore = 0
    const nb = axe.criteres.length
    for (const c of axe.criteres) {
      const n = niveaux[c.id] ?? 0
      axeScore += (AFAQ26000_NIVEAUX[n]?.pct ?? 0) / nb
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
function inputCls() { return 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500' }
function labelCls() { return 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1' }
function btnP(extra = '') { return `px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-50 ${extra}` }
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
  for (const axe of AFAQ26000_AXES) {
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
          <span className="text-4xl">🎖️</span>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Évaluation AFAQ 26000</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Le modèle d&apos;évaluation RSE d&apos;AFNOR Certification fondé sur l&apos;ISO 26000 — notation sur 1000 points</p>
          </div>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          <strong>AFAQ 26000</strong> est le modèle d&apos;évaluation de la responsabilité sociétale d&apos;<strong>AFNOR
          Certification</strong>, fondé sur les lignes directrices de l&apos;<strong>ISO 26000</strong>. Il repose sur
          une évaluation sur site conduite par des évaluateurs AFNOR et une notation sur <strong>1000 points</strong> :
          <strong> 5 critères de pratiques</strong> (vision et gouvernance, intégration de la RSE et communication,
          ressources humaines et relations de travail, production-consommation durables et environnement, ancrage
          territorial) et <strong>3 critères de résultats</strong> (environnementaux, sociaux, économiques).
          C&apos;est le <strong>moteur d&apos;évaluation du label Engagé RSE</strong>.
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          Le score obtenu détermine <strong>4 niveaux</strong> : <strong>Engagement initial</strong> (&lt; 300 points),
          <strong> Progression</strong> (300 à 500), <strong>Confirmé</strong> (500 à 700) et
          <strong> Exemplaire</strong> (&gt; 700 points). L&apos;évaluation est <strong>valable 3 ans</strong>, avec
          un <strong>suivi à 18 mois</strong> pour vérifier la dynamique de progrès. Cette application vous permet
          d&apos;auto-évaluer vos pratiques et vos résultats selon la grille AFAQ 26000 pour préparer l&apos;évaluation
          sur site.
        </p>
        <div className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/10 p-3 text-sm text-gray-700 dark:text-gray-300">
          🤝 <strong>Complémentarité</strong> : cette application évalue vos pratiques et vos résultats selon la
          <strong> grille AFAQ 26000</strong> (le moteur de notation sur 1000 points), tandis que l&apos;application{' '}
          <a href="/rse/afnor-rse" className="text-violet-600 dark:text-violet-400 font-semibold underline">Label Engagé RSE AFNOR ↗</a>{' '}
          couvre le <strong>parcours de labellisation</strong> (préparation, candidature, évaluation, suivi). Utilisez
          les deux conjointement pour préparer votre label Engagé RSE.
        </div>
      </div>

      {/* Contexte + référentiels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={card('p-5 border-l-4 border-violet-600')}>
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">🎖️ L&apos;évaluation AFAQ 26000 en pratique</h3>
          <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
            <div className="flex items-start gap-2">
              <span className="text-violet-600 font-bold flex-shrink-0">📋</span>
              <span><strong>Auto-évaluation préalable</strong> : positionnement sur les 5 critères de pratiques et les 3 critères de résultats pour identifier les points forts et les axes de progrès avant l&apos;évaluation sur site.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-violet-600 font-bold flex-shrink-0">🔍</span>
              <span><strong>Évaluation sur site</strong> par des évaluateurs AFNOR Certification : entretiens avec la direction, les équipes et des parties prenantes, analyse documentaire, observation des pratiques — plusieurs jours selon la taille de l&apos;organisation.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-violet-600 font-bold flex-shrink-0">🏆</span>
              <span><strong>Notation sur 1000 points</strong> : Engagement initial (&lt; 300), Progression (300-500), Confirmé (500-700), Exemplaire (&gt; 700) — le niveau atteint conditionne le label Engagé RSE délivré.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-violet-600 font-bold flex-shrink-0">🔄</span>
              <span><strong>Validité 3 ans</strong> avec une évaluation de suivi à 18 mois pour vérifier la dynamique de progrès et la consolidation des résultats.</span>
            </div>
          </div>
        </div>

        <div className={card('p-5 border-l-4 border-blue-500')}>
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">📋 Référentiels mobilisés</h3>
          <div className="space-y-1">
            {[
              ['🎖️', "AFAQ 26000 — Modèle d'évaluation RSE d'AFNOR Certification"],
              ['🏅', "Label Engagé RSE — label AFNOR fondé sur AFAQ 26000"],
              ['🏛️', 'ISO 26000:2010 — Lignes directrices de la responsabilité sociétale'],
              ['📜', 'CSRD / ESRS — Reporting de durabilité européen'],
              ['📋', 'GRI Standards — Reporting extra-financier international'],
              ['🌍', 'ODD — 17 Objectifs de Développement Durable des Nations Unies'],
              ['🏆', "EFQM — Modèle d'excellence et logique pratiques/résultats"],
              ['💜', 'Lucie 26000 — Label RSE alternatif fondé sur ISO 26000'],
              ['🌐', "B Corp — Certification d'entreprises à impact"],
            ].map(([icon, label]) => (
              <div key={label} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <span>{icon}</span><span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* La grille 1000 points */}
      <div className={card('p-5 bg-violet-50 dark:bg-violet-900/10 border-violet-200 dark:border-violet-800')}>
        <h3 className="font-bold text-violet-700 dark:text-violet-400 mb-3">🏗️ La grille AFAQ 26000 — 1000 points, pratiques et résultats</h3>
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          {[
            "5 critères de « Pratiques » : vision et gouvernance ; intégration de la RSE et communication ; ressources humaines et relations de travail ; modes de production, consommation durables et environnement ; ancrage territorial",
            "3 critères de « Résultats » : résultats environnementaux, résultats sociaux et résultats économiques — mesurés en tendance, comparés aux objectifs et aux références disponibles",
            "Dans cette application, l'ancrage territorial et les 3 critères de résultats sont regroupés dans le 5e axe « Ancrage territorial & Résultats » pour conserver la structure 5 axes × 4 critères de la plateforme",
            "4 niveaux selon le score sur 1000 : Engagement initial (< 300 pts), Progression (300-500), Confirmé (500-700), Exemplaire (> 700) — les badges de cette application (paliers 30/60/85 %) sont calés sur ces seuils 300/500/700",
            "Évaluation valable 3 ans avec un suivi à 18 mois — le label Engagé RSE d'AFNOR Certification s'appuie sur cette évaluation",
          ].map((line, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="font-bold text-violet-600 flex-shrink-0">•</span>
              <span>{line}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Les 5 axes */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Les 5 axes de l&apos;évaluation AFAQ 26000</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {AFAQ26000_AXES.map(axe => (
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
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Niveaux d&apos;évaluation AFAQ 26000</h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {AFAQ26000_NIVEAUX.map(n => (
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
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Badge AFAQ 26000 (calé sur les paliers 300 / 500 / 700 points sur 1000)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {BADGE_LEVELS.map(b => (
            <div key={b.label} className={card('p-4 text-center')}>
              <div className="text-3xl">{b.icon}</div>
              <div className="font-bold text-sm mt-1" style={{ color: b.color }}>{b.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">≥ {b.min}%</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">Seuils : 0-30% 🌱 Engagement initial (&lt; 300 pts) · 30-60% 🔄 Progression (300-500 pts) · 60-85% ✅ Confirmé (500-700 pts) · 85-100% ⭐ Exemplaire (&gt; 700 pts)</p>
      </div>

      {/* Comment utiliser */}
      <div className={card('p-5 space-y-3')}>
        <h3 className="font-semibold text-gray-900 dark:text-white">💡 Comment utiliser cette application</h3>
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          {[
            ['1', 'Évaluation AFAQ 26000', "Pour chaque critère, évaluez votre niveau (NC à 4), documentez vos pratiques et vos résultats, et créez des actions d'amélioration ciblées."],
            ['2', "Plan d'actions", "Visualisez et gérez toutes vos actions RSE : priorité, responsable, échéance, statut d'avancement."],
            ['3', 'Documents & Preuves', "Uploadez directement dans SharePoint vos preuves documentaires (stratégie RSE, matrice de matérialité, bilan GES, indicateurs sociaux, rapports) classées par critère."],
            ['4', 'Export Excel', "Générez un rapport Excel structuré avec 6 onglets pour préparer votre évaluation AFAQ 26000 sur site et alimenter votre dossier de labellisation Engagé RSE."],
          ].map(([num, title, desc]) => (
            <div key={num} className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 flex items-center justify-center text-xs font-bold">{num}</div>
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

  const axeStats = AFAQ26000_AXES.map(axe => {
    const total = axe.criteres.length
    const niveaux = axe.criteres.map(c => reponses[c.id]?.niveau ?? 0)
    const pct = niveaux.reduce((s, n) => s + (AFAQ26000_NIVEAUX[n]?.pct ?? 0), 0) / total
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
          <div className="text-sm text-gray-400">/ 100 (≈ {score * 10} / 1000 pts)</div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold" style={{ background: `${badge.color}22`, color: badge.color }}>
            {badge.icon} {badge.label}
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
            <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${score}%`, background: badge.color }} />
          </div>
          <div className="text-xs text-gray-400 mt-1">Seuils : 30% Progression (300 pts) · 60% Confirmé (500 pts) · 85% Exemplaire (700 pts)</div>
        </div>

        {/* Radar */}
        <div className={card('p-4 sm:col-span-2')}>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Radar AFAQ 26000 par axe</h3>
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
                  const niv = AFAQ26000_NIVEAUX[n]
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
            <div className="h-2 rounded-full bg-violet-600 transition-all" style={{ width: `${Math.round(actions.filter(a => a.statut === 'termine').length / actions.length * 100)}%` }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Vue Correspondances ──────────────────────────────────────────────────────

const CORRESPONDANCES_AFAQ26000 = [
  {
    categorie: "Applications RSE Sens'ethO",
    icon: '🏠',
    color: 'indigo',
    items: [
      {
        ref: 'Label Engagé RSE AFNOR', icon: '🏅', route: '/rse/afnor-rse',
        desc: "Label Engagé RSE — lien fort : même référentiel AFNOR. Cette application évalue vos pratiques et vos résultats selon la grille AFAQ 26000 (notation sur 1000 points) tandis que l'app Label Engagé RSE couvre le parcours de labellisation (préparation, candidature, évaluation sur site, suivi à 18 mois). Les deux applications se complètent pour construire votre dossier",
        liens: [
          { axe: 'gouvernance',   label: 'Gouvernance',   ref: 'Engagé RSE — Vision, gouvernance et pilotage de la démarche de labellisation' },
          { axe: 'territorial',   label: 'Résultats',     ref: 'Engagé RSE — Niveaux du label déterminés par le score AFAQ 26000 (300/500/700 pts)' },
        ],
      },
      {
        ref: 'Diagnostic initial guidé ISO 26000', icon: '🧭', route: '/rse/diagnostic-initial',
        desc: "Diagnostic initial ISO 26000 — première marche de la démarche : l'AFAQ 26000 étant fondée sur l'ISO 26000, le diagnostic initial guidé prépare naturellement l'auto-évaluation AFAQ en structurant la découverte des 7 questions centrales",
        liens: [
          { axe: 'gouvernance', label: 'Gouvernance', ref: 'ISO 26000 — Gouvernance de l’organisation : première question centrale' },
          { axe: 'integration', label: 'Intégration', ref: 'ISO 26000 — Identification des parties prenantes et de la sphère d’influence' },
        ],
      },
      {
        ref: 'Diagnostic RSE ISO 26000 complet', icon: '🏛️', route: '/rse/iso26000',
        desc: "Diagnostic ISO 26000 complet — l'approfondissement des 7 questions centrales et des domaines d'action alimente directement les critères de pratiques de la grille AFAQ 26000, qui en est l'application opérationnelle pour l'évaluation",
        liens: [
          { axe: 'rh',            label: 'RH',            ref: 'ISO 26000 — Relations et conditions de travail : 5 domaines d’action' },
          { axe: 'environnement', label: 'Environnement', ref: 'ISO 26000 — Question centrale Environnement : 4 domaines d’action' },
        ],
      },
      {
        ref: 'EcoVadis Diagnostic', icon: '🥇', route: '/rse/ecovadis',
        desc: "EcoVadis — la notation EcoVadis (Environnement, Social & Droits humains, Éthique, Achats responsables) recoupe largement la grille AFAQ 26000 : les preuves constituées pour l'une servent l'autre, et une évaluation AFAQ 26000 est une preuve valorisée par EcoVadis",
        liens: [
          { axe: 'integration', label: 'Intégration', ref: 'EcoVadis — Pilier Achats responsables : politiques et évaluation fournisseurs' },
          { axe: 'territorial', label: 'Résultats',   ref: 'EcoVadis — Indicateurs de résultats (KPI 360°) sur les 4 piliers' },
        ],
      },
      {
        ref: 'Diagnostic B Corp', icon: '🌐', route: '/rse/bcorp',
        desc: "B Corp — le B Impact Assessment (gouvernance, collaborateurs, communauté, environnement, clients) partage avec AFAQ 26000 la logique d'évaluation chiffrée des pratiques et des résultats, avec un seuil de certification (80 points BIA)",
        liens: [
          { axe: 'gouvernance', label: 'Gouvernance', ref: 'B Corp — Gouvernance et mission : raison d’être et redevabilité' },
          { axe: 'territorial', label: 'Territorial', ref: 'B Corp — Communauté : ancrage local, diversité, impact sociétal' },
        ],
      },
      {
        ref: 'Bilan GES', icon: '🌍', route: '/rse/bilan-ges',
        desc: "Bilan GES — la mesure des émissions de gaz à effet de serre alimente le critère climat des pratiques environnementales et les résultats environnementaux mesurés de la grille AFAQ 26000",
        liens: [
          { axe: 'environnement', label: 'Environnement', ref: 'Bilan GES — Atténuation : émissions scopes 1, 2 et 3 et trajectoire' },
          { axe: 'territorial',   label: 'Résultats',     ref: 'Bilan GES — Résultats environnementaux : tendances d’émissions' },
        ],
      },
    ],
  },
  {
    categorie: 'Référentiels externes',
    icon: '📐',
    color: 'violet',
    items: [
      {
        ref: 'ISO 26000:2010 — fondement', icon: '🏛️', route: null,
        desc: "ISO 26000 — lignes directrices de la responsabilité sociétale : le fondement de la grille AFAQ 26000. Les 7 questions centrales (gouvernance, droits de l'Homme, relations et conditions de travail, environnement, loyauté des pratiques, consommateurs, communautés et développement local) sont réparties dans les 8 critères AFAQ",
        liens: [
          { axe: 'gouvernance', label: 'Gouvernance', ref: 'ISO 26000 §6.2 — Gouvernance de l’organisation' },
          { axe: 'integration', label: 'Intégration', ref: 'ISO 26000 §5 et §7 — Parties prenantes et intégration de la RS' },
        ],
      },
      {
        ref: 'Label Engagé RSE / AFAQ 26000', icon: '🏅', route: null,
        desc: "Label Engagé RSE — label d'AFNOR Certification délivré sur la base de l'évaluation AFAQ 26000 : notation sur 1000 points, 4 niveaux (Engagement initial, Progression, Confirmé, Exemplaire), validité 3 ans avec suivi à 18 mois",
        liens: [
          { axe: 'gouvernance', label: 'Gouvernance', ref: 'Engagé RSE — Critère 1 : vision et gouvernance' },
          { axe: 'territorial', label: 'Résultats',   ref: 'Engagé RSE — Critères 6-7-8 : résultats environnementaux, sociaux, économiques' },
        ],
      },
      {
        ref: 'CSRD — ESRS', icon: '📜', route: null,
        desc: "CSRD/ESRS — le reporting de durabilité européen (double matérialité, ESRS E, S et G) structure la collecte des données que la grille AFAQ 26000 valorise dans les critères de résultats : les deux démarches se renforcent mutuellement",
        liens: [
          { axe: 'gouvernance', label: 'Gouvernance', ref: 'ESRS 2 — Gouvernance, stratégie et double matérialité' },
          { axe: 'territorial', label: 'Résultats',   ref: 'ESRS E/S — Indicateurs de résultats environnementaux et sociaux' },
        ],
      },
      {
        ref: 'GRI Standards', icon: '📋', route: null,
        desc: "GRI Standards — le référentiel international de reporting extra-financier fournit les indicateurs (GRI 200 économiques, GRI 300 environnementaux, GRI 400 sociaux) qui documentent les critères de résultats de l'AFAQ 26000",
        liens: [
          { axe: 'territorial',   label: 'Résultats',     ref: 'GRI 300/400 — Indicateurs environnementaux et sociaux en tendance' },
          { axe: 'environnement', label: 'Environnement', ref: 'GRI 302/305 — Énergie et émissions de GES' },
        ],
      },
      {
        ref: 'ODD — Nations Unies', icon: '🌍', route: null,
        desc: "Objectifs de Développement Durable — les 17 ODD donnent un cadre universel de contribution : la grille AFAQ 26000 valorise la capacité de l'organisation à relier sa stratégie RSE et ses résultats aux ODD pertinents pour son activité",
        liens: [
          { axe: 'gouvernance', label: 'Gouvernance', ref: 'ODD — Alignement de la stratégie RSE sur les ODD matériels' },
          { axe: 'territorial', label: 'Territorial', ref: 'ODD 8 et 11 — Travail décent, croissance et territoires durables' },
        ],
      },
      {
        ref: 'EFQM — Modèle d’excellence', icon: '🏆', route: null,
        desc: "EFQM — le modèle d'excellence européen partage avec AFAQ 26000 la structure pratiques/résultats et la notation sur 1000 points : direction-exécution-résultats, logique RADAR d'évaluation de la maturité et des tendances",
        liens: [
          { axe: 'gouvernance', label: 'Gouvernance', ref: 'EFQM — Direction : raison d’être, vision et leadership' },
          { axe: 'territorial', label: 'Résultats',   ref: 'EFQM — Résultats : perception des parties prenantes et performance' },
        ],
      },
      {
        ref: 'Lucie 26000', icon: '💜', route: null,
        desc: "Label Lucie 26000 — label RSE alternatif également fondé sur l'ISO 26000 : 7 engagements et 28 principes d'action, évaluation par un organisme tiers — une organisation labellisée Lucie dispose d'acquis directement transposables vers AFAQ 26000",
        liens: [
          { axe: 'integration', label: 'Intégration', ref: 'Lucie — Engagements parties prenantes et achats responsables' },
          { axe: 'rh',          label: 'RH',          ref: 'Lucie — Valorisation du capital humain' },
        ],
      },
      {
        ref: 'B Corp', icon: '🌐', route: null,
        desc: "Certification B Corp — le B Impact Assessment évalue l'impact global (gouvernance, collaborateurs, communauté, environnement, clients) avec un seuil de 80 points : une logique de scoring d'impact comparable à la notation AFAQ 26000",
        liens: [
          { axe: 'gouvernance', label: 'Gouvernance', ref: 'B Corp — Mission verrouillée et redevabilité élargie' },
          { axe: 'territorial', label: 'Territorial', ref: 'B Corp — Impact communauté et ancrage local' },
        ],
      },
    ],
  },
]

const AXE_BADGE_CLS: Record<string, string> = {
  gouvernance:   'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  integration:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  rh:            'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  environnement: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  territorial:   'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
}

function CorrespondancesView() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className={card('p-4')}>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          L&apos;évaluation AFAQ 26000 s&apos;articule avec l&apos;ensemble de votre démarche RSE. Lien fort avec
          l&apos;application <a href="/rse/afnor-rse" className="text-violet-600 dark:text-violet-400 font-semibold underline">Label Engagé RSE AFNOR ↗</a> :
          même référentiel — cette application porte la grille d&apos;évaluation sur 1000 points, l&apos;autre le
          parcours de labellisation. Les correspondances ci-dessous permettent de mutualiser vos efforts entre
          l&apos;ISO 26000 (fondement), la CSRD/ESRS, les GRI Standards, les ODD, le modèle EFQM, le label
          Lucie 26000 et la certification B Corp.
        </p>
      </div>

      {CORRESPONDANCES_AFAQ26000.map(cat => (
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
                          const axe = AFAQ26000_AXES.find(a => a.id === l.axe)
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
    const res = await fetch(`/api/afaq26000/${diagnosticId}/actions`, {
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
    await fetch(`/api/afaq26000/${diagnosticId}/actions?action_id=${id}`, { method: 'DELETE' })
    onActionsChange(actions.filter(a => a.id !== id))
  }

  async function saveEdit(id: string) {
    setSavingEdit(true)
    const res = await fetch(`/api/afaq26000/${diagnosticId}/actions?action_id=${id}`, {
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
    const res = await fetch(`/api/afaq26000/${diagnosticId}/actions?action_id=${action.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: next }),
    })
    if (res.ok) {
      const { data } = await res.json()
      onActionsChange(actions.map(a => a.id === action.id ? data : a))
    }
  }

  const niv = AFAQ26000_NIVEAUX[niveau]

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
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">Niveau d&apos;évaluation AFAQ 26000</div>
          {savingReponse && <span className="text-xs text-gray-400 animate-pulse">Enregistrement…</span>}
          {savedOk && !savingReponse && <span className="text-xs text-green-600 dark:text-green-400">✓ Sauvegardé</span>}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {AFAQ26000_NIVEAUX.map(n => (
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
        <p className="text-xs text-gray-500 dark:text-gray-400">Décrivez vos pratiques actuelles, les résultats mesurés et les preuves disponibles pour l&apos;évaluateur AFNOR (stratégie RSE, matrice de matérialité, indicateurs, rapports) ainsi que les points d&apos;amélioration identifiés.</p>
        <textarea
          value={commentaire}
          onChange={e => handleCommentaireChange(e.target.value)}
          rows={4}
          placeholder="Ex : Stratégie RSE validée par le COMEX en 2025, matrice de matérialité actualisée, comité RSE trimestriel. Indicateurs suivis sur 3 exercices…"
          className={`${inputCls()} resize-y`}
        />
        <GuidedActionNotePanel
          diagnosticId={diagnosticId}
          actionKey={critere.id}
          apiBase="/api/afaq26000"
          noteTable="afaq26000_notes"
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
            🎯 Actions RSE
            {critereActions.length > 0 && (
              <span className="ml-2 text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 px-1.5 py-0.5 rounded-full font-medium">
                {critereActions.filter(a => a.statut === 'termine').length}/{critereActions.length}
              </span>
            )}
          </div>
          <button onClick={() => setShowActionForm(v => !v)} className={btnP('text-xs py-1.5')}>+ Action</button>
        </div>

        {showActionForm && (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 space-y-2 border border-gray-200 dark:border-gray-700">
            <div><label className={labelCls()}>Titre *</label>
              <input className={inputCls()} value={actionForm.titre} onChange={e => setActionForm(f => ({ ...f, titre: e.target.value }))} placeholder="Ex : Formaliser la matrice de matérialité avec les parties prenantes" />
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
          <p className="text-xs text-gray-400 text-center py-3">Aucune action — créez des mesures concrètes pour renforcer vos pratiques et vos résultats et progresser dans la grille AFAQ 26000</p>
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
                        apiBase="/api/afaq26000"
                        noteTable="afaq26000_notes"
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
  const [activeAxe, setActiveAxe] = useState(AFAQ26000_AXES[0].id)
  const [activeCritere, setActiveCritere] = useState<string | null>(AFAQ26000_AXES[0].criteres[0].id)

  const niveaux: Record<string, number> = {}
  for (const [k, v] of Object.entries(reponses)) niveaux[k] = v.niveau
  const scoreGlobal = calculateAfaq26000Score(niveaux)
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
              <div className="text-sm text-gray-400">/ 100 (≈ {scoreGlobal * 10} / 1000 pts)</div>
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: `${badge.color}22`, color: badge.color }}>
                {badge.icon} {badge.label}
              </div>
            </div>
            <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${scoreGlobal}%`, background: badge.color }} />
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {AFAQ26000_AXES.map(axe => {
              const axeNiveaux = axe.criteres.map(c => niveaux[c.id] ?? 0)
              const axePct = Math.round(axeNiveaux.reduce((s, n) => s + AFAQ26000_NIVEAUX[n].pct, 0) / axe.criteres.length * 100)
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
            {AFAQ26000_AXES.map(axe => {
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
                        const niv = AFAQ26000_NIVEAUX[n]
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
            const axe = AFAQ26000_AXES.find(a => a.criteres.some(c => c.id === activeCritere))!
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
  return AFAQ26000_AXES.find(x => x.criteres.some(c => c.id === critereId))
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
          const ia = AFAQ26000_AXES.findIndex(x => x.id === axeOf(a.critere_id)?.id)
          const ib = AFAQ26000_AXES.findIndex(x => x.id === axeOf(b.critere_id)?.id)
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
  const groups = AFAQ26000_AXES
    .map(axe => ({ axe, items: sortActions(filtered.filter(a => axeOf(a.critere_id)?.id === axe.id)) }))
    .filter(g => g.items.length > 0)

  async function saveEdit(id: string) {
    setSaving(true)
    const res = await fetch(`/api/afaq26000/${diagnostic.id}/actions?action_id=${id}`, {
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
    const res = await fetch(`/api/afaq26000/${diagnostic.id}/actions?action_id=${action.id}`, {
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
    await fetch(`/api/afaq26000/${diagnostic.id}/actions?action_id=${id}`, { method: 'DELETE' })
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
          {AFAQ26000_AXES.map(a => <option key={a.id} value={a.id}>{a.icon} {a.label}</option>)}
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
          <p className="text-gray-400 text-sm">Aucune action — créez-en depuis la vue Évaluation, critère par critère</p>
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
                                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium hover:ring-2 hover:ring-offset-1 hover:ring-violet-300 transition ${STATUT_COLORS[a.statut]}`}>
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
  { id: 'presentation',    label: 'Présentation',          icon: '📋' },
  { id: 'dashboard',       label: 'Tableau de bord',       icon: '📊' },
  { id: 'diagnostic',      label: 'Évaluation AFAQ 26000', icon: '🎖️' },
  { id: 'actions',         label: "Plan d'actions",        icon: '📝' },
  { id: 'correspondances', label: 'Correspondances',       icon: '🔗' },
]

export default function Afaq26000DiagnosticApp({ ctx }: { ctx: RseContext }) {
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
  const [pdfData, setPdfData] = useState<Afaq26000PdfData | null>(null)
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
      const res = await fetch(`/api/afaq26000?org_id=${org.id}&annee=${year}`)
      const { data: existingDiag } = await res.json()

      let diagId = existingDiag?.id
      if (!diagId) {
        setInitializing(true)
        const createRes = await fetch('/api/afaq26000', {
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
        fetch(`/api/afaq26000/${diagId}/reponses`),
        fetch(`/api/afaq26000/${diagId}/actions`),
        fetch(`/api/afaq26000/${diagId}/notes`),
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
    await fetch(`/api/afaq26000/${diagnostic.id}/reponses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ critere_id, niveau, commentaire }),
    })
    setTimeout(async () => {
      setReponses(current => {
        const n2: Record<string, number> = {}
        for (const [k, v] of Object.entries(current)) n2[k] = v.niveau
        const score = calculateAfaq26000Score(n2)
        if (diagnostic) {
          fetch(`/api/afaq26000/${diagnostic.id}`, {
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
    fetch(`/api/afaq26000/${diagnostic.id}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_key: critere_id, content }),
    }).catch(e => console.error('[afaq26000/notes]', e))
  }

  function handleNoteSectionsChange(critere_id: string, sections: NoteSection[]) {
    setNoteSections(prev => ({ ...prev, [critere_id]: sections }))
    if (!diagnostic) return
    fetch(`/api/afaq26000/${diagnostic.id}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_key: critere_id, sections }),
    }).catch(e => console.error('[afaq26000/notes/sections]', e))
  }

  async function handleExportExcel() {
    if (!diagnostic) return
    setExportingExcel(true)
    try {
      const res = await fetch(`/api/afaq26000/${diagnostic.id}/export-excel`)
      if (!res.ok) throw new Error('Échec export')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `AFAQ26000_${org?.denomination ?? 'evaluation'}_${year}.xlsx`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { alert('Erreur export Excel : ' + String(e)) }
    finally { setExportingExcel(false) }
  }

  function buildPdfData(): Afaq26000PdfData {
    const niveaux: Record<string, number> = {}
    const commentaires: Record<string, string> = {}
    for (const [k, v] of Object.entries(reponses)) {
      niveaux[k] = v.niveau
      if (v.commentaire) commentaires[k] = v.commentaire
    }
    const scoreValue = diagnostic?.score_global ?? calculateAfaq26000Score(niveaux)
    const b = getBadge(scoreValue)
    return {
      organisation: org?.denomination ?? null,
      siren: org?.siren ?? null,
      ville: org?.ville ?? null,
      year,
      date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
      scoreLabel: 'Score de maturité AFAQ 26000',
      scoreValue,
      badge: { label: b.label, emoji: b.icon, color: b.color },
      axes: AFAQ26000_AXES,
      niveaux: AFAQ26000_NIVEAUX,
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
        if (document.querySelector('#afaq26000-pdf-root [data-pdf-page]')) { resolve(); return }
        const observer = new MutationObserver(() => {
          if (document.querySelector('#afaq26000-pdf-root [data-pdf-page]')) {
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
      const orgSlug = (org?.denomination ?? 'evaluation').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
      await exportReport('afaq26000-pdf-root', `Evaluation-AFAQ-26000-${orgSlug}-${year}.pdf`)
    } catch (e) {
      console.error('[afaq26000/exportPDF]', e)
    } finally {
      setExportingPDF(false)
      setPdfData(null)
    }
  }

  const loadShares = useCallback(async () => {
    if (!diagnostic) return
    try {
      const res = await fetch(`/api/afaq26000/${diagnostic.id}/shares`)
      const { data } = await res.json()
      setShareList(data ?? [])
    } catch { /* ignore */ }
  }, [diagnostic])

  useEffect(() => { if (showShare) loadShares() }, [showShare, loadShares])

  async function handleAddShare() {
    if (!diagnostic || !shareEmail.trim()) return
    setShareSaving(true); setShareError('')
    try {
      const res = await fetch(`/api/afaq26000/${diagnostic.id}/shares`, {
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
      await fetch(`/api/afaq26000/${diagnostic.id}/shares?shareId=${shareId}`, { method: 'DELETE' })
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium transition-colors">
          👥 Partager
        </button>
      </div>
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnostic, exportingExcel, exportingPDF])

  const lockedTabs = !org || !diagnostic ? ['dashboard', 'diagnostic', 'actions'] : []

  if (loading && !diagnostic) {
    return <div className="flex justify-center items-center py-20 text-gray-400 text-sm animate-pulse">
      {initializing ? 'Initialisation de l’évaluation AFAQ 26000…' : 'Chargement…'}
    </div>
  }

  return (
    <div className="space-y-4">

      {/* ── Rapport PDF (monté hors-écran le temps de l'export) ─────────────── */}
      {pdfData && (
        <div style={{ position: 'absolute', left: -9999, top: 0 }} aria-hidden="true">
          <Afaq26000PDFReport id="afaq26000-pdf-root" data={pdfData} />
        </div>
      )}

      {/* ── Modale Partage ──────────────────────────────────────────────────── */}
      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowShare(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-bold text-gray-900 dark:text-white">👥 Partager l&apos;évaluation AFAQ 26000</h2>
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
          <span>Score AFAQ 26000 :</span>
          <span className="font-bold text-gray-900 dark:text-white">{diagnostic.score_global ?? calculateAfaq26000Score(Object.fromEntries(Object.entries(reponses).map(([k, v]) => [k, v.niveau])))}/100</span>
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
                view === v.id ? 'border-violet-600 text-violet-600 dark:text-violet-400'
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
          score={diagnostic.score_global ?? calculateAfaq26000Score(Object.fromEntries(Object.entries(reponses).map(([k, v]) => [k, v.niveau])))}
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

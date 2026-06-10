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

// Calculateur d'émissions tCO2e (port v1) — chargé en lazy, client only
const BilanGesCalculateur = dynamic(() => import('@/components/apps/BilanGesCalculateur'), {
  ssr: false,
  loading: () => <div className="py-10 text-center text-sm text-gray-400 animate-pulse">Chargement du calculateur…</div>
})

// ─── Données statiques Bilan GES (BEGES réglementaire) ────────────────────────

export const BILAN_GES_AXES = [
  {
    id: 'gouvernance', label: 'Gouvernance & Méthodologie', icon: '🧭',
    color: '#0369a1', colorLight: '#e0f2fe', weight: 0.20,
    description: "Organisation de la démarche bilan GES, choix méthodologique, périmètres, qualité des données.",
    criteres: [
      { id: 'ges-gov-organisation', label: 'Organisation et pilotage de la démarche bilan GES (référent, moyens, calendrier)', description: "La démarche de bilan GES est organisée et pilotée : un référent carbone est identifié, doté de moyens et d'un mandat clair, un calendrier de réalisation est défini en cohérence avec les échéances réglementaires. La direction est impliquée dans la validation des résultats et le comité de pilotage associe les fonctions clés (achats, logistique, énergie, finance, RH)." },
      { id: 'ges-gov-methode', label: 'Choix et maîtrise de la méthode (Bilan Carbone ADEME, GHG Protocol, ISO 14064-1)', description: "L'organisation a choisi et documenté sa méthode de comptabilité carbone : méthode réglementaire BEGES V5 de l'ADEME, Bilan Carbone, GHG Protocol ou ISO 14064-1. Les facteurs d'émission utilisés proviennent de sources reconnues (Base Empreinte ADEME) et leur version est tracée. Les équipes en charge sont formées à la méthode et à ses règles de calcul et d'incertitude." },
      { id: 'ges-gov-perimetre', label: 'Définition des périmètres organisationnel et opérationnel', description: "Les périmètres organisationnel (entités juridiques, sites, approche contrôle opérationnel/financier ou part du capital) et opérationnel (catégories et postes d'émission couverts) sont définis, justifiés et documentés. Les exclusions éventuelles sont explicitées et argumentées, conformément aux exigences du format réglementaire BEGES et aux principes de pertinence et d'exhaustivité." },
      { id: 'ges-gov-donnees', label: "Qualité, traçabilité et collecte des données d'activité", description: "Un processus structuré de collecte des données d'activité (énergie, carburants, achats, fret, déplacements) est en place : sources identifiées, responsables désignés, formats harmonisés, contrôles de cohérence. La traçabilité des données et des hypothèses est assurée d'un exercice à l'autre, et le niveau d'incertitude de chaque poste est évalué et documenté." },
    ],
  },
  {
    id: 'scope1', label: 'Scope 1 — Émissions directes', icon: '🏭',
    color: '#dc2626', colorLight: '#fee2e2', weight: 0.20,
    description: "Combustion fixe et mobile, procédés industriels, émissions fugitives, biomasse.",
    criteres: [
      { id: 'ges-s1-combustion-fixe', label: 'Émissions des sources fixes de combustion (chaudières, fours, groupes électrogènes)', description: "Les émissions directes des sources fixes de combustion (chaudières gaz/fioul, fours, groupes électrogènes, brûleurs) sont comptabilisées à partir des consommations réelles de combustibles. L'inventaire des installations est exhaustif, les relevés sont fiabilisés (factures, compteurs) et les facteurs d'émission appliqués distinguent les combustibles et leur contenu biogénique le cas échéant." },
      { id: 'ges-s1-combustion-mobile', label: 'Émissions des sources mobiles (flotte de véhicules, engins)', description: "Les émissions de la flotte de véhicules et des engins détenus ou contrôlés par l'organisation (voitures, utilitaires, poids lourds, engins de chantier ou agricoles) sont comptabilisées à partir des litres de carburant consommés ou, à défaut, des kilomètres parcourus. Le suivi des consommations est outillé (cartes carburant, télématique) et alimente le plan de verdissement de la flotte." },
      { id: 'ges-s1-procedes', label: 'Émissions directes des procédés hors énergie', description: "Les émissions directes des procédés industriels hors combustion (décarbonatation, réactions chimiques, fermentation, traitement des effluents) sont identifiées et quantifiées lorsqu'elles existent. Les méthodes de calcul spécifiques (bilans matière, mesures directes) sont documentées et les incertitudes associées évaluées. Si l'organisation n'est pas concernée, cette analyse d'applicabilité est formalisée." },
      { id: 'ges-s1-fugitives', label: 'Émissions fugitives (fluides frigorigènes, fuites, épandages)', description: "Les émissions fugitives sont comptabilisées : fuites de fluides frigorigènes des installations de froid et de climatisation (à partir des recharges constatées sur les registres d'entretien), fuites de gaz, émissions liées aux épandages ou à la gestion des effluents d'élevage le cas échéant. Le PRG (pouvoir de réchauffement global) propre à chaque fluide est appliqué et un plan de réduction des fuites est engagé." },
    ],
  },
  {
    id: 'scope2', label: 'Scope 2 — Énergie indirecte', icon: '⚡',
    color: '#d97706', colorLight: '#fef3c7', weight: 0.20,
    description: "Électricité, chaleur, froid achetés ; approches location-based et market-based ; actions de réduction énergétique.",
    criteres: [
      { id: 'ges-s2-electricite', label: "Comptabilisation des émissions liées à l'électricité achetée", description: "Les émissions indirectes liées à l'électricité achetée sont comptabilisées sur l'ensemble des sites du périmètre, à partir des consommations réelles (kWh facturés ou télérelevés). Les facteurs d'émission utilisés sont à jour (mix national, facteurs par usage), les pertes en ligne sont traitées conformément à la méthode retenue, et les consommations sont suivies site par site pour identifier les gisements de réduction." },
      { id: 'ges-s2-chaleur-froid', label: 'Comptabilisation chaleur/vapeur/froid achetés', description: "Les achats de chaleur, de vapeur et de froid (réseaux de chaleur urbains, vapeur industrielle, réseaux de froid) sont identifiés et leurs émissions comptabilisées à partir des contenus carbone publiés par les exploitants de réseaux ou des facteurs réglementaires. Le verdissement de ces réseaux (taux d'EnR&R) est suivi et intégré aux choix d'approvisionnement énergétique de l'organisation." },
      { id: 'ges-s2-approches', label: 'Double approche location-based / market-based (contrats verts, GO)', description: "L'organisation calcule et publie son scope 2 selon la double approche : location-based (facteur moyen du réseau) et market-based (instruments contractuels : contrats d'électricité verte, garanties d'origine, PPA). Les instruments contractuels mobilisés sont documentés et conformes aux critères de qualité du GHG Protocol Scope 2 Guidance, sans double comptage." },
      { id: 'ges-s2-efficacite', label: "Plan d'efficacité énergétique et sobriété", description: "Un plan d'efficacité énergétique et de sobriété est déployé et articulé avec le bilan GES : audits énergétiques (décret tertiaire, ISO 50001 le cas échéant), actions de réduction des consommations (isolation, pilotage, relamping, récupération de chaleur), objectifs chiffrés et suivi des gains réalisés. Les résultats alimentent la trajectoire de réduction du scope 2." },
    ],
  },
  {
    id: 'scope3', label: 'Scope 3 — Autres émissions indirectes', icon: '🔗',
    color: '#7c3aed', colorLight: '#ede9fe', weight: 0.20,
    description: "Postes amont/aval significatifs : achats, fret, déplacements, immobilisations, usage et fin de vie des produits.",
    criteres: [
      { id: 'ges-s3-achats', label: 'Achats de biens et services (postes amont)', description: "Les émissions liées aux achats de biens et de services — souvent le premier poste du bilan — sont évaluées : cartographie des achats par catégorie, application de ratios monétaires ou de données physiques, identification des fournisseurs les plus contributeurs. La démarche progresse vers des données primaires fournisseurs et les enjeux carbone sont intégrés dans la politique achats." },
      { id: 'ges-s3-transport', label: 'Fret amont/aval et déplacements (domicile-travail, professionnels)', description: "Les émissions du transport de marchandises amont et aval (routier, maritime, aérien, ferroviaire) et des déplacements de personnes (domicile-travail via enquête mobilité, déplacements professionnels) sont quantifiées. Des leviers de réduction sont activés : optimisation logistique, report modal, plan de mobilité employeur, politique voyages et visioconférence." },
      { id: 'ges-s3-immobilisations', label: 'Immobilisations, déchets, énergie amont', description: "Les autres postes amont significatifs sont comptabilisés : amortissement carbone des immobilisations (bâtiments, machines, véhicules, parc informatique), traitement des déchets générés par l'activité, et émissions amont de l'énergie (extraction, raffinage, transport des combustibles et pertes du réseau). Les méthodes d'allocation et les durées d'amortissement retenues sont documentées." },
      { id: 'ges-s3-produits', label: 'Usage et fin de vie des produits vendus', description: "Pour les organisations qui mettent des produits sur le marché, les émissions liées à l'utilisation des produits vendus (consommation d'énergie en phase d'usage) et à leur fin de vie (collecte, recyclage, mise en décharge) sont évaluées. Ces résultats alimentent l'écoconception des produits et services, levier majeur de réduction du scope 3 aval." },
    ],
  },
  {
    id: 'plan', label: 'Plan de transition & Publication', icon: '📈',
    color: '#16a34a', colorLight: '#dcfce7', weight: 0.20,
    description: "Plan de transition (obligatoire depuis le décret 2022-982), objectifs de réduction, publication ADEME, suivi annuel.",
    criteres: [
      { id: 'ges-plan-objectifs', label: 'Objectifs de réduction chiffrés et datés (cohérence SNBC / SBTi)', description: "L'organisation s'est fixé des objectifs de réduction de ses émissions chiffrés, datés et couvrant les trois scopes, en cohérence avec la Stratégie Nationale Bas-Carbone (SNBC) et, idéalement, validés ou alignés sur la Science Based Targets initiative (SBTi). La trajectoire de référence, l'année de base et les jalons intermédiaires sont formalisés et suivis." },
      { id: 'ges-plan-actions', label: 'Plan de transition documenté avec actions, moyens et responsables', description: "Un plan de transition pour réduire les émissions — rendu obligatoire par le décret n°2022-982 en remplacement de la simple synthèse d'actions — est documenté : actions de réduction par poste, moyens humains et financiers alloués, responsables désignés, échéances et volumes de réduction attendus. Ce plan est validé par la direction et articulé avec la stratégie de l'organisation." },
      { id: 'ges-plan-publication', label: 'Publication sur la plateforme ADEME (bilans-ges.ademe.fr) dans les délais', description: "Le bilan GES et son plan de transition sont publiés sur la plateforme officielle de l'ADEME (bilans-ges.ademe.fr) dans le format réglementaire et dans les délais impartis. Les informations publiées sont complètes (périmètres, postes, méthodologie, plan de transition) et cohérentes avec les autres publications de l'organisation (DPEF, rapport de durabilité CSRD le cas échéant)." },
      { id: 'ges-plan-suivi', label: 'Suivi annuel, mise à jour tous les 4 ans (3 ans secteur public) et amélioration continue', description: "Le bilan GES s'inscrit dans une dynamique d'amélioration continue : suivi annuel des indicateurs d'émissions et de l'avancement du plan de transition, mise à jour réglementaire du bilan tous les 4 ans (3 ans pour le secteur public), amélioration progressive de la qualité des données et de la couverture du scope 3. Les écarts à la trajectoire sont analysés et les actions réajustées." },
    ],
  },
]

export const BILAN_GES_NIVEAUX = [
  { value: 0, shortLabel: 'NC', label: 'Non traité', description: "Poste non identifié ou non traité dans le bilan",                       pct: 0,    color: '#9ca3af', bg: 'bg-gray-100 dark:bg-gray-700',       text: 'text-gray-600 dark:text-gray-400'     },
  { value: 1, shortLabel: '1',  label: 'Partiel',    description: "Couverture partielle, données incomplètes ou hypothèses majeures",     pct: 0.25, color: '#ef4444', bg: 'bg-red-50 dark:bg-red-900/20',       text: 'text-red-700 dark:text-red-400'       },
  { value: 2, shortLabel: '2',  label: 'Estimé',     description: "Poste estimé par ratios ou extrapolations, incertitude élevée",        pct: 0.50, color: '#f97316', bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-400' },
  { value: 3, shortLabel: '3',  label: 'Mesuré',     description: "Données d'activité réelles, calcul fiable et traçable",                pct: 0.75, color: '#eab308', bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-400' },
  { value: 4, shortLabel: '4',  label: 'Maîtrisé',   description: "Poste mesuré, piloté et en réduction avec actions suivies",            pct: 1.0,  color: '#0369a1', bg: 'bg-sky-50 dark:bg-sky-900/20',       text: 'text-sky-700 dark:text-sky-400'       },
]

const BADGE_LEVELS = [
  { label: 'Démarche exemplaire', min: 85, color: '#0369a1', icon: '⭐' },
  { label: 'Conforme BEGES',      min: 60, color: '#16a34a', icon: '✅' },
  { label: 'Bilan partiel',       min: 30, color: '#f97316', icon: '🔄' },
  { label: 'Non conforme',        min: 0,  color: '#dc2626', icon: '❌' },
]

export function calculateBilanGesScore(niveaux: Record<string, number>): number {
  let total = 0
  for (const axe of BILAN_GES_AXES) {
    let axeScore = 0
    const nb = axe.criteres.length
    for (const c of axe.criteres) {
      const n = niveaux[c.id] ?? 0
      axeScore += (BILAN_GES_NIVEAUX[n]?.pct ?? 0) / nb
    }
    total += axeScore * axe.weight
  }
  return Math.round(total * 100)
}

function getBadge(score: number) {
  return BADGE_LEVELS.find(b => score >= b.min) ?? BADGE_LEVELS[BADGE_LEVELS.length - 1]
}

// ─── Types ────────────────────────────────────────────────────────────────────

type View = 'presentation' | 'calculateur' | 'dashboard' | 'diagnostic' | 'actions' | 'correspondances'

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
function btnP(extra = '') { return `px-3 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-sm font-medium transition-colors disabled:opacity-50 ${extra}` }
function btnS(extra = '') { return `px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm transition-colors ${extra}` }

const PRIORITE_COLORS = {
  haute:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  moyenne: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  basse:   'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}
const STATUT_COLORS = {
  a_faire:  'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  en_cours: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  termine:  'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
}
const STATUT_LABELS = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' }
const PRIORITE_LABELS = { haute: '🔴 Haute', moyenne: '🟡 Moyenne', basse: '🟢 Basse' }

function critereLabel(id: string): string {
  for (const axe of BILAN_GES_AXES) {
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
          <span className="text-4xl">🏭</span>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Bilan d&apos;Émissions de Gaz à Effet de Serre (BEGES)</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Pilotez votre bilan GES réglementaire et votre plan de transition climat</p>
          </div>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          Le <strong>Bilan d&apos;Émissions de Gaz à Effet de Serre (BEGES)</strong> est l&apos;obligation réglementaire instituée par
          l&apos;<strong>article L229-25 du code de l&apos;environnement</strong> et renforcée par le <strong>décret n°2022-982 du 1er juillet 2022</strong>,
          qui rend obligatoires la couverture des <strong>émissions indirectes significatives (scope 3)</strong> et l&apos;élaboration
          d&apos;un <strong>plan de transition</strong>. La <strong>méthode réglementaire V5 de l&apos;ADEME</strong> structure l&apos;exercice,
          en cohérence avec les standards internationaux <strong>Bilan Carbone</strong>, <strong>GHG Protocol</strong> et <strong>ISO 14064-1</strong>.
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          Au-delà de la conformité, le bilan GES est l&apos;outil fondateur de toute stratégie climat : il identifie les postes
          d&apos;émissions majeurs, fonde les <strong>objectifs de réduction</strong> (SNBC, SBTi) et alimente le reporting de durabilité
          (CSRD/ESRS E1, CDP). Cette application vous permet d&apos;évaluer la maturité de votre démarche sur les
          <strong> 3 scopes</strong>, la gouvernance méthodologique et le plan de transition, puis de piloter vos actions d&apos;amélioration.
        </p>
      </div>

      {/* Obligés + cadre */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={card('p-5 border-l-4 border-sky-700')}>
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">🏛️ Qui est obligé ?</h3>
          <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
            <div className="flex items-start gap-2">
              <span className="text-sky-700 font-bold flex-shrink-0">🏢</span>
              <span><strong>Entreprises de plus de 500 salariés</strong> (250 salariés dans les régions et départements d&apos;outre-mer).</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sky-700 font-bold flex-shrink-0">🏘️</span>
              <span><strong>Collectivités territoriales de plus de 50 000 habitants</strong> et leurs groupements.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sky-700 font-bold flex-shrink-0">🏛️</span>
              <span><strong>Établissements publics de plus de 250 agents</strong> et <strong>services de l&apos;État</strong>.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sky-700 font-bold flex-shrink-0">🔁</span>
              <span>Mise à jour <strong>tous les 4 ans</strong> (3 ans pour le secteur public), publication sur <strong>bilans-ges.ademe.fr</strong>.</span>
            </div>
          </div>
        </div>

        <div className={card('p-5 border-l-4 border-red-500')}>
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">⚖️ Cadre réglementaire et sanctions</h3>
          <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
            <div className="flex items-start gap-2">
              <span className="text-red-600 font-bold flex-shrink-0">📜</span>
              <span><strong>Art. L229-25</strong> du code de l&apos;environnement (loi Grenelle II, renforcé par les lois TECV et Énergie-Climat).</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-red-600 font-bold flex-shrink-0">📜</span>
              <span><strong>Décret n°2022-982 du 1er juillet 2022</strong> : scope 3 (émissions indirectes significatives) et <strong>plan de transition</strong> obligatoires.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-red-600 font-bold flex-shrink-0">⚠️</span>
              <span>Sanction : amende jusqu&apos;à <strong>50 000 €</strong>, portée à <strong>100 000 €</strong> en cas de récidive.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-red-600 font-bold flex-shrink-0">📐</span>
              <span><strong>Méthode réglementaire V5 ADEME</strong>, cohérente avec Bilan Carbone, GHG Protocol et ISO 14064-1.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Calculateur intégré */}
      <div className={card('p-5 space-y-4 border-l-4 border-emerald-500')}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">🧮</span>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">Calculateur intégré — vos émissions en tCO₂e</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Saisissez vos données d&apos;activité et obtenez vos émissions en tCO₂e — facteurs ADEME Base Carbone 2023.
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          L&apos;onglet <strong>🧮 Calculateur</strong> vous permet de créer des sessions de bilan GES, de saisir vos lignes
          d&apos;émissions par <strong>scope 1, 2 et 3</strong> (15 catégories Scope 3), de documenter chaque ligne
          (notes et pièces jointes) et de suivre vos objectifs de réduction — selon trois méthodes au choix :
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 p-4">
            <div className="text-sm font-bold text-gray-900 dark:text-white mb-1">GHG Protocol</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Standard international (WRI/WBCSD) — référence mondiale pour le reporting carbone</div>
          </div>
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10 p-4">
            <div className="text-sm font-bold text-gray-900 dark:text-white mb-1">Bilan Carbone®</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Méthode ADEME/ABC — référence française, facteurs Base Carbone, scopes 1-2-3</div>
          </div>
          <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10 p-4">
            <div className="text-sm font-bold text-gray-900 dark:text-white mb-1">CSRD / ESRS E1</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Reporting obligatoire selon ESRS E1 — objectifs E1-4, énergie E1-5, GES E1-6, absorptions E1-7</div>
          </div>
        </div>
      </div>

      {/* Les 5 axes */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Les 5 axes du diagnostic Bilan GES</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {BILAN_GES_AXES.map(axe => (
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
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Niveaux de maturité par critère</h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {BILAN_GES_NIVEAUX.map(n => (
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
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Badge de maturité Bilan GES</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {BADGE_LEVELS.map(b => (
            <div key={b.label} className={card('p-4 text-center')}>
              <div className="text-3xl">{b.icon}</div>
              <div className="font-bold text-sm mt-1" style={{ color: b.color }}>{b.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">≥ {b.min}%</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">Seuils : 0-30% Non conforme · 30-60% Bilan partiel · 60-85% Conforme BEGES · 85-100% Démarche exemplaire</p>
      </div>

      {/* Comment utiliser */}
      <div className={card('p-5 space-y-3')}>
        <h3 className="font-semibold text-gray-900 dark:text-white">💡 Comment utiliser cette application</h3>
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          {[
            ['1', 'Diagnostic BEGES', "Pour chaque critère, évaluez votre niveau de maturité (NC à 4), documentez vos pratiques et créez des actions d'amélioration ciblées."],
            ['2', "Plan d'actions", "Visualisez et gérez toutes vos actions de réduction : priorité, responsable, échéance, statut d'avancement — l'embryon de votre plan de transition."],
            ['3', 'Documents & Preuves', "Uploadez directement dans SharePoint vos preuves documentaires (rapport de bilan GES, tableaux de facteurs d'émission, registres frigorigènes, attestation de publication ADEME) classées par critère."],
            ['4', 'Export Excel', "Générez un rapport Excel structuré avec 6 onglets pour documenter votre conformité BEGES et alimenter votre reporting climat (CSRD, CDP)."],
          ].map(([num, title, desc]) => (
            <div key={num} className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 flex items-center justify-center text-xs font-bold">{num}</div>
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

  const axeStats = BILAN_GES_AXES.map(axe => {
    const total = axe.criteres.length
    const niveaux = axe.criteres.map(c => reponses[c.id]?.niveau ?? 0)
    const pct = niveaux.reduce((s, n) => s + (BILAN_GES_NIVEAUX[n]?.pct ?? 0), 0) / total
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
          <div className="text-xs text-gray-400 mt-1">Seuils : 30% Bilan partiel · 60% Conforme · 85% Exemplaire</div>
        </div>

        {/* Radar */}
        <div className={card('p-4 sm:col-span-2')}>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Radar de maturité Bilan GES par axe</h3>
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
              <polygon points={dataPolygon} fill="#0369a122" stroke="#0369a1" strokeWidth="2.5" strokeLinejoin="round" />
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
                  const niv = BILAN_GES_NIVEAUX[n]
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
            { label: 'Terminées', count: actions.filter(a => a.statut === 'termine').length,  color: 'text-sky-700 dark:text-sky-400' },
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

const CORRESPONDANCES_GES = [
  {
    categorie: "Applications RSE Sens'ethO",
    icon: '🏠',
    color: 'indigo',
    items: [
      {
        ref: 'ACT Bas-Carbone', icon: '🌱', route: '/rse/act-carbone',
        desc: "Démarche ACT (ADEME/CDP) — lien fort : le bilan GES est la donnée d'entrée de l'évaluation ACT, qui mesure l'alignement de la stratégie de l'entreprise avec une trajectoire bas-carbone",
        liens: [
          { axe: 'scope1', label: 'Scope 1',  ref: 'ACT — Trajectoire d\'émissions directes et intensité carbone' },
          { axe: 'scope3', label: 'Scope 3',  ref: 'ACT — Engagement de la chaîne de valeur et émissions évitées' },
          { axe: 'plan',   label: 'Plan',     ref: 'ACT — Plan de transition, gouvernance climat et cohérence des investissements' },
        ],
      },
      {
        ref: 'Diagnostic initial ISO 26000', icon: '⚙️', route: '/rse/iso26000',
        desc: "ISO 26000 — le bilan GES documente la question centrale Environnement (atténuation du changement climatique) du diagnostic de responsabilité sociétale",
        liens: [
          { axe: 'gouvernance', label: 'Gouvernance', ref: 'ISO 26000 — Gouvernance de l\'organisation : pilotage des enjeux climat' },
          { axe: 'plan',        label: 'Plan',        ref: 'ISO 26000 — Environnement : atténuation et adaptation au changement climatique' },
        ],
      },
      {
        ref: 'EcoVadis Diagnostic', icon: '🥇', route: '/rse/ecovadis',
        desc: "EcoVadis — le bilan GES et le plan de transition sont des preuves majeures du thème Environnement de la notation EcoVadis (politiques, actions, résultats énergie & GES)",
        liens: [
          { axe: 'gouvernance', label: 'Gouvernance', ref: 'EcoVadis — Politique environnementale documentée et reporting GES' },
          { axe: 'scope2',      label: 'Scope 2',     ref: 'EcoVadis — Actions énergie et consommations renouvelables' },
        ],
      },
      {
        ref: 'Label Numérique Responsable', icon: '💻', route: '/rse/label-nr',
        desc: "Label NR — l'empreinte du numérique (équipements, hébergement, usages) alimente les scopes 2 et 3 du bilan GES ; les actions NR sont des leviers de réduction",
        liens: [
          { axe: 'scope2', label: 'Scope 2', ref: 'Label NR — Consommation électrique du SI et hébergement responsable' },
          { axe: 'scope3', label: 'Scope 3', ref: 'Label NR — Empreinte de fabrication des équipements IT (achats, immobilisations)' },
        ],
      },
      {
        ref: 'VSME / EFRAG', icon: '📒', route: '/rse/vsme-efrag',
        desc: "VSME (norme volontaire EFRAG pour les PME) — les métriques B3 (énergie et émissions de GES) du module de base reprennent directement les résultats du bilan GES",
        liens: [
          { axe: 'scope1', label: 'Scope 1', ref: 'VSME B3 — Émissions brutes scope 1 en tCO2e' },
          { axe: 'scope2', label: 'Scope 2', ref: 'VSME B3 — Émissions scope 2 location-based et consommation d\'énergie' },
        ],
      },
    ],
  },
  {
    categorie: 'Référentiels et méthodes carbone',
    icon: '📐',
    color: 'sky',
    items: [
      {
        ref: 'Bilan Carbone — ADEME / ABC', icon: '🧮', route: null,
        desc: "Méthode Bilan Carbone (ADEME / Association pour la transition Bas-Carbone) — méthode française de référence pour la comptabilité carbone complète, compatible avec le format réglementaire BEGES V5",
        liens: [
          { axe: 'gouvernance', label: 'Gouvernance', ref: 'Bilan Carbone — Cadrage, périmètres et sensibilisation des acteurs' },
          { axe: 'scope3',      label: 'Scope 3',     ref: 'Bilan Carbone — Couverture exhaustive des postes amont et aval' },
        ],
      },
      {
        ref: 'GHG Protocol', icon: '🌐', route: null,
        desc: "GHG Protocol (WRI/WBCSD) — standard international de comptabilité des GES : Corporate Standard, Scope 2 Guidance (location/market-based) et Corporate Value Chain (Scope 3) Standard",
        liens: [
          { axe: 'scope2', label: 'Scope 2', ref: 'GHG Protocol Scope 2 Guidance — double reporting location-based / market-based' },
          { axe: 'scope3', label: 'Scope 3', ref: 'GHG Protocol Scope 3 Standard — 15 catégories d\'émissions amont/aval' },
        ],
      },
      {
        ref: 'ISO 14064-1', icon: '🏛️', route: null,
        desc: "ISO 14064-1 — norme internationale de quantification et de déclaration des émissions et suppressions de GES au niveau de l'organisation, base des vérifications par tierce partie",
        liens: [
          { axe: 'gouvernance', label: 'Gouvernance', ref: 'ISO 14064-1 — Principes de pertinence, exhaustivité, cohérence, exactitude et transparence' },
        ],
      },
      {
        ref: 'SNBC — Stratégie Nationale Bas-Carbone', icon: '🇫🇷', route: null,
        desc: "SNBC — feuille de route climat de la France (neutralité carbone 2050) : les objectifs de réduction du plan de transition doivent s'inscrire en cohérence avec les budgets carbone nationaux",
        liens: [
          { axe: 'plan', label: 'Plan', ref: 'SNBC — Trajectoires sectorielles de décarbonation et budgets carbone' },
        ],
      },
      {
        ref: 'SBTi — Science Based Targets', icon: '🎯', route: null,
        desc: "Science Based Targets initiative — cadre de validation scientifique des objectifs de réduction alignés sur l'Accord de Paris (1,5°C), exigeant un bilan GES complet scopes 1, 2 et 3",
        liens: [
          { axe: 'plan',   label: 'Plan',    ref: 'SBTi — Objectifs court terme et net-zéro validés scientifiquement' },
          { axe: 'scope3', label: 'Scope 3', ref: 'SBTi — Objectif scope 3 requis quand il dépasse 40% des émissions totales' },
        ],
      },
      {
        ref: 'CDP Climate Change', icon: '📊', route: null,
        desc: "CDP — questionnaire climat international noté de A à D- : le bilan GES, la double approche scope 2 et le plan de transition alimentent directement la réponse CDP",
        liens: [
          { axe: 'gouvernance', label: 'Gouvernance', ref: 'CDP — Gouvernance climat et gestion des risques' },
          { axe: 'plan',        label: 'Plan',        ref: 'CDP — Objectifs, trajectoires et plan de transition climatique' },
        ],
      },
    ],
  },
  {
    categorie: 'Standards de reporting généralistes',
    icon: '📋',
    color: 'blue',
    items: [
      {
        ref: 'CSRD — ESRS E1 Changement climatique', icon: '📜', route: null,
        desc: "CSRD/ESRS — la norme ESRS E1 exige la publication des émissions GES scopes 1, 2 et 3, des objectifs de réduction et du plan de transition climatique pour les entreprises assujetties",
        liens: [
          { axe: 'scope1', label: 'Scope 1', ref: 'ESRS E1-6 — Émissions brutes de GES scopes 1, 2, 3 et émissions totales' },
          { axe: 'plan',   label: 'Plan',    ref: 'ESRS E1-1 — Plan de transition pour l\'atténuation du changement climatique' },
        ],
      },
      {
        ref: 'GRI Standards — GRI 305', icon: '📋', route: null,
        desc: "GRI 305 Émissions — publication des émissions directes (305-1), indirectes énergie (305-2), autres indirectes (305-3), intensité (305-4) et réductions (305-5)",
        liens: [
          { axe: 'scope1', label: 'Scope 1', ref: 'GRI 305-1 — Émissions directes de GES (scope 1)' },
          { axe: 'scope2', label: 'Scope 2', ref: 'GRI 305-2 — Émissions indirectes liées à l\'énergie (scope 2)' },
          { axe: 'scope3', label: 'Scope 3', ref: 'GRI 305-3 — Autres émissions indirectes de GES (scope 3)' },
        ],
      },
      {
        ref: 'ODD 7, 12 et 13 — Nations Unies', icon: '🌍', route: null,
        desc: "Objectifs de Développement Durable — ODD 7 (énergie propre et abordable), ODD 12 (consommation et production responsables), ODD 13 (mesures relatives au changement climatique)",
        liens: [
          { axe: 'scope2', label: 'Scope 2', ref: 'ODD 7 — Efficacité énergétique et énergies renouvelables' },
          { axe: 'plan',   label: 'Plan',    ref: 'ODD 13 — Lutte contre les changements climatiques et leurs répercussions' },
        ],
      },
      {
        ref: 'ISO 26000', icon: '🏛️', route: null,
        desc: "ISO 26000 — lignes directrices de la responsabilité sociétale : le bilan GES documente le domaine d'action « Atténuation des changements climatiques et adaptation » de la question centrale Environnement",
        liens: [
          { axe: 'gouvernance', label: 'Gouvernance', ref: 'ISO 26000 — 6.5.5 Atténuation des changements climatiques et adaptation' },
        ],
      },
    ],
  },
]

const AXE_BADGE_CLS: Record<string, string> = {
  gouvernance: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  scope1:      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  scope2:      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  scope3:      'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  plan:        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
}

function CorrespondancesView() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className={card('p-4')}>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Le bilan GES réglementaire est la pierre angulaire de votre stratégie climat. Les correspondances
          ci-dessous permettent de mutualiser vos efforts entre le BEGES, la démarche ACT Bas-Carbone, l&apos;ISO 26000,
          la CSRD/ESRS E1, les GRI Standards, les ODD et les méthodes carbone de référence
          (Bilan Carbone ADEME, GHG Protocol, ISO 14064-1, SNBC, SBTi, CDP).
        </p>
      </div>

      {CORRESPONDANCES_GES.map(cat => (
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
                          const axe = BILAN_GES_AXES.find(a => a.id === l.axe)
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
    const res = await fetch(`/api/bilan-ges/${diagnosticId}/actions`, {
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
    await fetch(`/api/bilan-ges/${diagnosticId}/actions?action_id=${id}`, { method: 'DELETE' })
    onActionsChange(actions.filter(a => a.id !== id))
  }

  async function saveEdit(id: string) {
    setSavingEdit(true)
    const res = await fetch(`/api/bilan-ges/${diagnosticId}/actions?action_id=${id}`, {
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
    const res = await fetch(`/api/bilan-ges/${diagnosticId}/actions?action_id=${action.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: next }),
    })
    if (res.ok) {
      const { data } = await res.json()
      onActionsChange(actions.map(a => a.id === action.id ? data : a))
    }
  }

  const niv = BILAN_GES_NIVEAUX[niveau]

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
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">Niveau de maturité du poste</div>
          {savingReponse && <span className="text-xs text-gray-400 animate-pulse">Enregistrement…</span>}
          {savedOk && !savingReponse && <span className="text-xs text-sky-700 dark:text-sky-400">✓ Sauvegardé</span>}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {BILAN_GES_NIVEAUX.map(n => (
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
        <p className="text-xs text-gray-500 dark:text-gray-400">Décrivez les données d&apos;activité disponibles, les facteurs d&apos;émission utilisés, les tonnages CO2e calculés et les incertitudes identifiées sur ce poste.</p>
        <textarea
          value={commentaire}
          onChange={e => handleCommentaireChange(e.target.value)}
          rows={4}
          placeholder="Ex : Consommations gaz collectées sur les 3 sites (factures 2025) : 420 tCO2e. Facteur Base Empreinte v23.1. Incertitude ±5%…"
          className={`${inputCls()} resize-y`}
        />
        <GuidedActionNotePanel
          diagnosticId={diagnosticId}
          actionKey={critere.id}
          apiBase="/api/bilan-ges"
          noteTable="bilan_ges_notes"
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
            🎯 Actions de réduction & conformité
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
              <input className={inputCls()} value={actionForm.titre} onChange={e => setActionForm(f => ({ ...f, titre: e.target.value }))} placeholder="Ex : Mettre en place le suivi mensuel des recharges de fluides frigorigènes" />
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
          <p className="text-xs text-gray-400 text-center py-3">Aucune action — créez des mesures concrètes pour fiabiliser et réduire ce poste d&apos;émissions</p>
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
                        apiBase="/api/bilan-ges"
                        noteTable="bilan_ges_notes"
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
  const [activeAxe, setActiveAxe] = useState(BILAN_GES_AXES[0].id)
  const [activeCritere, setActiveCritere] = useState<string | null>(BILAN_GES_AXES[0].criteres[0].id)

  const niveaux: Record<string, number> = {}
  for (const [k, v] of Object.entries(reponses)) niveaux[k] = v.niveau
  const scoreGlobal = calculateBilanGesScore(niveaux)
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
            {BILAN_GES_AXES.map(axe => {
              const axeNiveaux = axe.criteres.map(c => niveaux[c.id] ?? 0)
              const axePct = Math.round(axeNiveaux.reduce((s, n) => s + BILAN_GES_NIVEAUX[n].pct, 0) / axe.criteres.length * 100)
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
            {BILAN_GES_AXES.map(axe => {
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
                        const niv = BILAN_GES_NIVEAUX[n]
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
            const axe = BILAN_GES_AXES.find(a => a.criteres.some(c => c.id === activeCritere))!
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
    const axe = BILAN_GES_AXES.find(x => x.criteres.some(c => c.id === a.critere_id))
    if (filterAxe !== 'all' && axe?.id !== filterAxe) return false
    if (filterPriorite !== 'all' && a.priorite !== filterPriorite) return false
    if (filterStatut !== 'all' && a.statut !== filterStatut) return false
    return true
  })

  const total = actions.length
  const termines = actions.filter(a => a.statut === 'termine').length

  async function saveEdit(id: string) {
    setSaving(true)
    const res = await fetch(`/api/bilan-ges/${diagnostic.id}/actions?action_id=${id}`, {
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
    await fetch(`/api/bilan-ges/${diagnostic.id}/actions?action_id=${id}`, { method: 'DELETE' })
    onActionsChange(actions.filter(a => a.id !== id))
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total actions', value: total,    color: 'text-gray-700 dark:text-gray-300' },
          { label: 'En cours',      value: actions.filter(a => a.statut === 'en_cours').length, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Terminées',     value: `${termines} (${total ? Math.round(termines / total * 100) : 0}%)`, color: 'text-sky-700 dark:text-sky-400' },
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
          {BILAN_GES_AXES.map(a => <option key={a.id} value={a.id}>{a.icon} {a.label}</option>)}
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
          const axe = BILAN_GES_AXES.find(x => x.criteres.some(c => c.id === a.critere_id))
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
  { id: 'calculateur',     label: 'Calculateur',     icon: '🧮' },
  { id: 'dashboard',       label: 'Tableau de bord', icon: '📊' },
  { id: 'diagnostic',      label: 'Diagnostic BEGES', icon: '🏭' },
  { id: 'actions',         label: "Plan d'actions",  icon: '📝' },
  { id: 'correspondances', label: 'Correspondances', icon: '🔗' },
]

export default function BilanGesDiagnosticApp({ ctx }: { ctx: RseContext }) {
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
      const res = await fetch(`/api/bilan-ges?org_id=${org.id}&annee=${year}`)
      const { data: existingDiag } = await res.json()

      let diagId = existingDiag?.id
      if (!diagId) {
        setInitializing(true)
        const createRes = await fetch('/api/bilan-ges', {
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
        fetch(`/api/bilan-ges/${diagId}/reponses`),
        fetch(`/api/bilan-ges/${diagId}/actions`),
        fetch(`/api/bilan-ges/${diagId}/notes`),
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
    await fetch(`/api/bilan-ges/${diagnostic.id}/reponses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ critere_id, niveau, commentaire }),
    })
    setTimeout(async () => {
      setReponses(current => {
        const n2: Record<string, number> = {}
        for (const [k, v] of Object.entries(current)) n2[k] = v.niveau
        const score = calculateBilanGesScore(n2)
        if (diagnostic) {
          fetch(`/api/bilan-ges/${diagnostic.id}`, {
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
    fetch(`/api/bilan-ges/${diagnostic.id}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_key: critere_id, content }),
    }).catch(e => console.error('[bilan-ges/notes]', e))
  }

  function handleNoteSectionsChange(critere_id: string, sections: NoteSection[]) {
    setNoteSections(prev => ({ ...prev, [critere_id]: sections }))
    if (!diagnostic) return
    fetch(`/api/bilan-ges/${diagnostic.id}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_key: critere_id, sections }),
    }).catch(e => console.error('[bilan-ges/notes/sections]', e))
  }

  async function handleExportExcel() {
    if (!diagnostic) return
    setExportingExcel(true)
    try {
      const res = await fetch(`/api/bilan-ges/${diagnostic.id}/export-excel`)
      if (!res.ok) throw new Error('Échec export')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `Bilan_GES_${org?.nom ?? 'diagnostic'}_${year}.xlsx`; a.click()
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-medium transition-colors">
          👥 Partager
        </button>
      </div>
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnostic, exportingExcel])

  const lockedTabs = !org || !diagnostic ? ['dashboard', 'diagnostic', 'actions'] : []

  if (loading && !diagnostic) {
    return <div className="flex justify-center items-center py-20 text-gray-400 text-sm animate-pulse">
      {initializing ? 'Initialisation du diagnostic Bilan GES…' : 'Chargement…'}
    </div>
  }

  return (
    <div className="space-y-4">

      {/* ── Modale Partage ──────────────────────────────────────────────────── */}
      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowShare(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-bold text-gray-900 dark:text-white">👥 Partager le diagnostic Bilan GES</h2>
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
          <span>Score de maturité BEGES :</span>
          <span className="font-bold text-gray-900 dark:text-white">{diagnostic.score_global ?? calculateBilanGesScore(Object.fromEntries(Object.entries(reponses).map(([k, v]) => [k, v.niveau])))}/100</span>
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
                view === v.id ? 'border-sky-600 text-sky-700 dark:text-sky-400'
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
      {view === 'calculateur' && <BilanGesCalculateur org={org} year={year} />}
      {view === 'correspondances' && <CorrespondancesView />}
      {view === 'dashboard' && org && diagnostic && (
        <TableauDeBordView
          reponses={reponses}
          actions={actions}
          score={diagnostic.score_global ?? calculateBilanGesScore(Object.fromEntries(Object.entries(reponses).map(([k, v]) => [k, v.niveau])))}
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

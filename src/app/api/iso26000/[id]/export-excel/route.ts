/**
 * GET /api/iso26000/[id]/export-excel
 * Génère un fichier Excel structuré du Diagnostic RSE ISO 26000 (37 domaines, 7 QC).
 *
 * Onglets :
 *  1. Couverture         — présentation du rapport, score moyen
 *  2. Synthèse par QC    — 7 questions centrales, score moyen, domaines listés
 *  3. Domaines détaillés — 37 domaines, score, % actions réalisées
 *  4. Plan d'actions     — toutes les actions : avancée, N/A, note
 *  5. Analyse IA         — si disponible
 *  6. Annexes            — liste des pièces jointes SharePoint
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─── Colors (ARGB) ────────────────────────────────────────────────────────────
const C = {
  indigo:   'FF4338CA',
  indigoL:  'FFE0E7FF',
  teal:     'FF0E3D4D',
  tealL:    'FFDBF0F5',
  red:      'FFDC2626',
  redL:     'FFFEE2E2',
  orange:   'FFEA580C',
  orangeL:  'FFFFEDD5',
  green:    'FF16A34A',
  greenL:   'FFDCFCE7',
  purple:   'FF7C3AED',
  purpleL:  'FFEDE9FE',
  yellow:   'FFF59E0B',
  yellowL:  'FFFEF9C3',
  cyan:     'FF0891B2',
  cyanL:    'FFE0F7FA',
  gray:     'FF6B7280',
  grayM:    'FF9CA3AF',
  grayL:    'FFF3F4F6',
  white:    'FFFFFFFF',
  black:    'FF111827',
  border:   'FFE5E7EB',
}

type CS = {
  bg?: string; fg?: string; bold?: boolean; sz?: number
  ha?: 'left' | 'right' | 'center'; it?: boolean; wrap?: boolean; indent?: number
}

function sc(ws: ExcelJS.Worksheet, r: number, c: number, val: ExcelJS.CellValue, s: CS = {}) {
  const cell = ws.getCell(r, c)
  cell.value = val
  if (s.bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: s.bg } }
  cell.font = {
    name: 'Calibri', size: s.sz ?? 10, bold: s.bold ?? false,
    italic: s.it ?? false, color: { argb: s.fg ?? C.black },
  }
  cell.alignment = {
    horizontal: s.ha ?? 'left', vertical: 'middle',
    wrapText: s.wrap ?? false, indent: s.indent ?? 0,
  }
  cell.border = {
    top: { style: 'thin', color: { argb: C.border } },
    bottom: { style: 'thin', color: { argb: C.border } },
    left: { style: 'thin', color: { argb: C.border } },
    right: { style: 'thin', color: { argb: C.border } },
  }
  return cell
}

function merge(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number) {
  try { ws.mergeCells(r1, c1, r2, c2) } catch { /* already merged */ }
}

function titleRow(ws: ExcelJS.Worksheet, r: number, text: string, cols: number, bg = C.teal) {
  merge(ws, r, 1, r, cols)
  sc(ws, r, 1, text, { bg, fg: C.white, bold: true, sz: 13, ha: 'center' })
  ws.getRow(r).height = 28
}

function sectionRow(ws: ExcelJS.Worksheet, r: number, text: string, cols: number, bg: string) {
  merge(ws, r, 1, r, cols)
  sc(ws, r, 1, text, { bg, fg: C.white, bold: true, sz: 10 })
  ws.getRow(r).height = 18
}

function hdRow(ws: ExcelJS.Worksheet, r: number, headers: string[], bg = C.indigo) {
  headers.forEach((h, i) => {
    sc(ws, r, i + 1, h, { bg, fg: C.white, bold: true, sz: 9, ha: i === 0 ? 'left' : 'center' })
  })
  ws.getRow(r).height = 16
}

function blank(ws: ExcelJS.Worksheet, r: number, h = 8) { ws.getRow(r).height = h }

function scoreColor(score: number): string {
  if (score === 0) return C.gray
  if (score <= 1) return C.red
  if (score <= 2) return C.orange
  if (score <= 3) return C.yellow
  if (score <= 4) return C.green
  return C.cyan
}
function scoreColorL(score: number): string {
  if (score === 0) return C.grayL
  if (score <= 1) return C.redL
  if (score <= 2) return C.orangeL
  if (score <= 3) return C.yellowL
  if (score <= 4) return C.greenL
  return C.cyanL
}
function scoreName(score: number): string {
  if (score === 0) return 'Non évalué'
  if (score === 1) return 'Inexistant'
  if (score === 2) return 'Initié'
  if (score === 3) return 'En développement'
  if (score === 4) return 'Maîtrisé'
  return 'Exemplaire'
}

function htmlToText(html: string): string {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n').trim()
}

interface NoteSection { id: string; title: string; content: string }

// ─── Données ISO 26000 ─────────────────────────────────────────────────────────

interface DomainDef {
  id: string
  nom: string
  isoRef: string
  qcId: string
  actions: string[]
}

interface QcDef {
  id: string
  nom: string
  icone: string
  couleur: string
  argb: string
  argbL: string
  domains: DomainDef[]
}

const QC_LIST: QcDef[] = [
  {
    id: 'QC1', nom: "Gouvernance de l'organisation", icone: '🏛️',
    couleur: '#60a5fa', argb: 'FF60A5FA', argbL: 'FFE0EFFE',
    domains: [
      { id: 'DA1.1', nom: 'Gouvernance organisationnelle', isoRef: '6.2', qcId: 'QC1', actions: [
        'Définir et formaliser les valeurs, vision et stratégie RSE',
        'Identifier et cartographier les parties prenantes',
        'Mettre en place des mécanismes de décision transparents',
        'Établir un reporting RSE régulier (annuel au minimum)',
        'Intégrer la RSE dans les objectifs stratégiques et la feuille de route',
        'Désigner un responsable RSE ou un comité dédié avec mandat officiel',
        'Promouvoir la diversité dans les instances de décision',
        'Évaluer et améliorer en continu les pratiques de gouvernance',
        "Former les dirigeants et administrateurs aux enjeux de responsabilité sociétale",
        'Publier un rapport de durabilité selon un référentiel reconnu (GRI, CSRD…)',
      ]},
    ],
  },
  {
    id: 'QC2', nom: "Droits de l'Homme", icone: '🤝',
    couleur: '#f87171', argb: 'FFF87171', argbL: 'FFFEE2E2',
    domains: [
      { id: 'DA2.1', nom: 'Devoir de vigilance', isoRef: '6.3.3', qcId: 'QC2', actions: [
        "Cartographier les risques droits de l'Homme dans les activités et la chaîne d'approvisionnement",
        'Mettre en place un plan de vigilance selon la loi Sapin 2 et les Principes directeurs ONU',
        "Évaluer régulièrement les fournisseurs et partenaires sur le respect des droits de l'Homme",
        'Définir des procédures de remédiation en cas d\'atteinte identifiée',
        'Former les équipes à la vigilance et à la détection des violations',
        "Intégrer les droits de l'Homme dans les due diligences lors d'acquisitions",
      ]},
      { id: 'DA2.2', nom: "Situations à risque pour les droits de l'Homme", isoRef: '6.3.4', qcId: 'QC2', actions: [
        'Analyser le contexte géographique et politique des activités dans les pays à risque',
        'Éviter d\'opérer dans des zones à très haut risque ou prendre des mesures renforcées',
        "Collaborer avec des ONG locales et des experts en droits de l'Homme",
        'Établir des mécanismes de signalement locaux accessibles aux communautés',
        'Adapter les politiques RH aux contextes locaux tout en respectant les standards internationaux',
      ]},
      { id: 'DA2.3', nom: 'Prévention de la complicité', isoRef: '6.3.5', qcId: 'QC2', actions: [
        'Adopter une politique tolérance zéro sur la complicité avec les violations des droits',
        'Auditer régulièrement la chaîne de valeur pour détecter les risques de complicité',
        "Intégrer des clauses contractuelles droits de l'Homme dans tous les contrats importants",
        "Définir des critères droits de l'Homme dans les appels d'offres et la sélection des fournisseurs",
        'Mettre fin aux partenariats en cas de violations graves non corrigées',
      ]},
      { id: 'DA2.4', nom: "Remédier aux atteintes aux droits de l'Homme", isoRef: '6.3.6', qcId: 'QC2', actions: [
        'Créer un mécanisme de réclamations accessible à toutes les parties prenantes affectées',
        "Garantir la confidentialité et la protection des lanceurs d'alerte",
        'Documenter et suivre systématiquement chaque réclamation reçue',
        'Publier des rapports annuels sur le traitement des réclamations',
        'Former les équipes à l\'utilisation et à la gestion du mécanisme',
      ]},
      { id: 'DA2.5', nom: 'Discrimination et groupes vulnérables', isoRef: '6.3.7', qcId: 'QC2', actions: [
        'Adopter une politique de non-discrimination couvrant tous les critères légaux et éthiques',
        'Mettre en place des actions positives pour les groupes sous-représentés',
        'Former l\'ensemble des managers à la lutte contre les discriminations et les biais inconscients',
        'Réaliser des audits de rémunération réguliers pour détecter les inégalités',
        'Mettre en place des aménagements raisonnables pour les personnes handicapées',
        'Mesurer la diversité dans les recrutements, promotions et rémunérations',
      ]},
      { id: 'DA2.6', nom: 'Droits civils et politiques', isoRef: '6.3.8', qcId: 'QC2', actions: [
        "Garantir la liberté d'expression au travail, y compris la possibilité de critiquer les pratiques",
        "Protéger et promouvoir le droit d'association syndicale",
        'Ne pas exercer de pression politique sur les employés ou parties prenantes',
        'Protéger la vie privée des salariés dans le cadre du travail',
        'Respecter la liberté de conscience et de religion dans le cadre du travail',
      ]},
      { id: 'DA2.7', nom: 'Droits économiques, sociaux et culturels', isoRef: '6.3.9', qcId: 'QC2', actions: [
        'Assurer des rémunérations permettant un niveau de vie décent (au-delà du SMIC)',
        'Favoriser la formation continue et le développement des compétences',
        'Respecter et promouvoir le droit à la santé au travail et en dehors',
        'Soutenir l\'accès aux services essentiels pour les travailleurs et leurs familles',
        'Respecter les traditions culturelles des communautés dans lesquelles l\'organisation opère',
      ]},
      { id: 'DA2.8', nom: 'Principes fondamentaux et droits au travail', isoRef: '6.3.10', qcId: 'QC2', actions: [
        "Garantir l'absence totale de travail forcé ou obligatoire dans l'organisation et sa chaîne",
        'Interdire formellement le travail des enfants dans toute la chaîne de valeur',
        "Promouvoir activement la liberté syndicale et la négociation collective",
        'Assurer l\'égalité de rémunération entre les femmes et les hommes pour un travail de valeur égale',
        'Intégrer les conventions OIT dans les exigences contractuelles fournisseurs',
      ]},
    ],
  },
  {
    id: 'QC3', nom: 'Relations et conditions de travail', icone: '👷',
    couleur: '#34d399', argb: 'FF34D399', argbL: 'FFD1FAE5',
    domains: [
      { id: 'DA3.1', nom: 'Emploi et relations employeur/employé', isoRef: '6.4.3', qcId: 'QC3', actions: [
        'Établir des contrats de travail clairs conformes à la législation et aux conventions collectives',
        'Assurer des rémunérations justes, équitables et en lien avec les qualifications',
        'Mettre en place un processus de recrutement non discriminatoire et transparent',
        'Définir des procédures de licenciement justes respectant les droits des travailleurs',
        "Favoriser la stabilité de l'emploi en limitant le recours aux contrats précaires",
        "Privilégier l'emploi local dans les zones où l'organisation opère",
      ]},
      { id: 'DA3.2', nom: 'Conditions de travail et protection sociale', isoRef: '6.4.4', qcId: 'QC3', actions: [
        'Respecter strictement les temps de travail légaux et conventionnels',
        'Assurer une protection sociale complète (retraite, santé, prévoyance) pour tous',
        'Proposer une politique de congés flexible adaptée aux besoins des salariés',
        "Mettre en place une charte du droit à la déconnexion numérique",
        'Faciliter le télétravail et les modes de travail flexibles',
        'Accompagner le retour au travail post-congé maternité/paternité/parental',
      ]},
      { id: 'DA3.3', nom: 'Dialogue social', isoRef: '6.4.5', qcId: 'QC3', actions: [
        "Encourager activement la représentation syndicale et protéger les représentants élus",
        'Tenir des réunions régulières et substantielles avec les représentants du personnel',
        "Informer et consulter les salariés sur les décisions ayant un impact sur leur travail",
        "Conclure des accords d'entreprise sur des sujets stratégiques",
        "Réaliser des enquêtes régulières d'engagement et de satisfaction des employés",
      ]},
      { id: 'DA3.4', nom: 'Santé et sécurité au travail', isoRef: '6.4.6', qcId: 'QC3', actions: [
        "Réaliser et mettre à jour régulièrement le Document Unique d'Évaluation des Risques (DUER)",
        'Former l\'ensemble des salariés aux gestes de premiers secours (SST)',
        'Déployer une politique de prévention des risques psychosociaux (RPS) efficace',
        'Assurer un suivi médical régulier et une médecine du travail de qualité',
        'Viser la certification ISO 45001 (Santé et sécurité au travail)',
        'Analyser systématiquement tous les accidents du travail et presqu\'accidents',
        'Réaliser des aménagements ergonomiques des postes de travail',
      ]},
      { id: 'DA3.5', nom: 'Développement du capital humain', isoRef: '6.4.7', qcId: 'QC3', actions: [
        "Mener des entretiens annuels et des entretiens professionnels de qualité",
        'Élaborer et exécuter un plan de développement des compétences ambitieux',
        "Encourager et faciliter la mobilité interne",
        'Garantir l\'accès à la formation continue et au CPF pour tous',
        'Mettre en place un programme de mentorat et/ou de coaching',
        'Évaluer en continu les besoins en compétences futures (GPEC/GEPP)',
      ]},
    ],
  },
  {
    id: 'QC4', nom: 'Environnement', icone: '🌱',
    couleur: '#4ade80', argb: 'FF4ADE80', argbL: 'FFDCFCE7',
    domains: [
      { id: 'DA4.1', nom: 'Prévention de la pollution', isoRef: '6.5.3', qcId: 'QC4', actions: [
        'Réaliser un bilan complet des émissions polluantes (air, eau, sol, déchets)',
        'Mettre en place et investir dans des technologies propres et moins polluantes',
        "Réduire progressivement l'utilisation des substances dangereuses",
        'Gérer et valoriser les déchets selon la hiérarchie de gestion des déchets',
        'Traiter les effluents avant tout rejet dans l\'environnement',
        'Viser et maintenir la certification ISO 14001 (Management environnemental)',
        'Former l\'ensemble des collaborateurs aux bonnes pratiques environnementales',
      ]},
      { id: 'DA4.2', nom: 'Utilisation durable des ressources', isoRef: '6.5.4', qcId: 'QC4', actions: [
        'Réaliser un bilan énergétique complet et définir un plan de réduction',
        "Améliorer l'efficacité énergétique des bâtiments, équipements et processus",
        'Installer des sources d\'énergie renouvelable sur les sites',
        "Mesurer et réduire la consommation d'eau et gérer les eaux usées",
        "Intégrer l'éco-conception dans le développement des produits et services",
        'Optimiser les achats en favorisant les circuits courts et les produits durables',
        'Déployer une démarche d\'économie circulaire (réparation, réemploi, recyclage)',
        'Viser la certification ISO 50001 (Management de l\'énergie)',
      ]},
      { id: 'DA4.3', nom: 'Atténuation des changements climatiques et adaptation', isoRef: '6.5.5', qcId: 'QC4', actions: [
        'Réaliser un Bilan Carbone® complet couvrant les scopes 1, 2 et 3',
        "Définir une trajectoire de réduction ambitieuse alignée sur les Accords de Paris",
        'Élaborer et mettre en oeuvre un plan de transition bas-carbone',
        'Compenser les émissions résiduelles par des projets de séquestration carbone vérifiés',
        'Analyser les risques et opportunités climatiques selon le cadre TCFD',
        'Réduire les déplacements professionnels et développer les alternatives',
        'Adopter une politique d\'achats bas-carbone sur toute la chaîne de valeur',
      ]},
      { id: 'DA4.4', nom: "Protection de l'environnement, biodiversité et habitats naturels", isoRef: '6.5.6', qcId: 'QC4', actions: [
        "Réaliser un diagnostic de biodiversité sur tous les sites d'activité",
        'Appliquer systématiquement la séquence ERC (Éviter-Réduire-Compenser)',
        'Adopter une politique zéro déforestation dans les achats',
        'Végétaliser les sites et favoriser la biodiversité locale',
        'Engager des programmes de restauration écologique',
        'Évaluer les dépendances écosystémiques selon le cadre TNFD',
      ]},
    ],
  },
  {
    id: 'QC5', nom: 'Loyauté des pratiques', icone: '⚖️',
    couleur: '#fbbf24', argb: 'FFFBBF24', argbL: 'FFFEF9C3',
    domains: [
      { id: 'DA5.1', nom: 'Lutte contre la corruption', isoRef: '6.6.3', qcId: 'QC5', actions: [
        'Adopter et diffuser un code éthique et une politique anti-corruption clairs',
        'Déployer un programme de conformité anti-corruption (mapping risques, contrôles, procédures)',
        'Former régulièrement les collaborateurs exposés aux risques de corruption',
        "Mettre en place un dispositif de signalement des alertes éthiques protégé",
        'Réaliser des audits internes anti-corruption périodiques',
        'Évaluer les risques de corruption chez les tiers (fournisseurs, agents, intermédiaires)',
      ]},
      { id: 'DA5.2', nom: 'Engagement politique responsable', isoRef: '6.6.4', qcId: 'QC5', actions: [
        'Adopter une politique de transparence dans les relations avec les institutions publiques',
        "Déclarer les représentants d'intérêts dans les registres officiels",
        "Éviter tout financement politique opaque ou contraire à l'éthique",
        'Participer aux consultations publiques de manière transparente et constructive',
      ]},
      { id: 'DA5.3', nom: 'Concurrence loyale', isoRef: '6.6.5', qcId: 'QC5', actions: [
        'Former régulièrement les équipes commerciales et achats au droit de la concurrence',
        'Déployer un programme de conformité antitrust avec des procédures claires',
        'Refuser systématiquement les accords de fixation de prix ou de partage de marchés',
        'Éviter tout abus de position dominante vis-à-vis des clients et fournisseurs',
        'Mettre en place un système de veille et de détection des comportements anticoncurrentiels',
      ]},
      { id: 'DA5.4', nom: 'Promotion de la RSE dans la chaîne de valeur', isoRef: '6.6.6', qcId: 'QC5', actions: [
        "Intégrer des critères RSE formels dans les appels d'offres et la sélection des fournisseurs",
        'Évaluer régulièrement les fournisseurs stratégiques sur leurs pratiques RSE',
        'Accompagner concrètement les fournisseurs dans le développement de leur démarche RSE',
        'Favoriser les achats locaux, équitables et durables',
        "Publier et diffuser une politique d'achats responsables ambitieuse",
      ]},
      { id: 'DA5.5', nom: 'Respect des droits de propriété', isoRef: '6.6.7', qcId: 'QC5', actions: [
        'Adopter une politique formelle de respect de la propriété intellectuelle',
        'Former les équipes R&D, marketing et achats aux droits de propriété intellectuelle',
        'Respecter strictement les licences logicielles et les droits d\'auteur',
        "Mettre en place des procédures pour éviter l'usage non autorisé de brevets tiers",
      ]},
    ],
  },
  {
    id: 'QC6', nom: 'Questions relatives aux consommateurs', icone: '🛒',
    couleur: '#c084fc', argb: 'FFC084FC', argbL: 'FFEDE9FE',
    domains: [
      { id: 'DA6.1', nom: "Pratiques loyales en matière de commercialisation", isoRef: '6.7.3', qcId: 'QC6', actions: [
        "Garantir la véracité, la clarté et l'objectivité des allégations publicitaires",
        "Éviter d'inclure des clauses contractuelles abusives dans les contrats",
        'Fournir des informations complètes et transparentes sur les produits et services',
        'Lutter activement contre le greenwashing et les allégations environnementales trompeuses',
        'Informer clairement sur les prix, les conditions et les engagements',
      ]},
      { id: 'DA6.2', nom: 'Protection de la santé et de la sécurité des consommateurs', isoRef: '6.7.4', qcId: 'QC6', actions: [
        'Mettre en place et certifier un système de management de la qualité (ISO 9001)',
        'Réaliser des analyses de risques complètes sur tous les produits et services',
        'Définir et tester des procédures de retrait et de rappel de produits',
        "Communiquer clairement sur les risques d'utilisation et les précautions à prendre",
        'Suivre et analyser systématiquement les incidents consommateurs liés à la sécurité',
      ]},
      { id: 'DA6.3', nom: 'Consommation durable', isoRef: '6.7.5', qcId: 'QC6', actions: [
        "Développer et promouvoir des alternatives éco-responsables dans l'offre",
        "Intégrer l'éco-conception dès le début du développement des produits",
        "Informer les consommateurs sur l'impact environnemental et social des produits",
        'Faciliter et encourager la réparation, le réemploi et le recyclage',
        'Mettre en place un affichage environnemental des produits',
      ]},
      { id: 'DA6.4', nom: 'Service après-vente, assistance et résolution des réclamations', isoRef: '6.7.6', qcId: 'QC6', actions: [
        'Offrir un service client accessible, réactif et multicanal (téléphone, email, chat, boutique)',
        'Définir et appliquer des procédures claires de gestion des réclamations',
        "Former régulièrement les équipes à l'excellence de la relation client",
        'Mesurer et améliorer en continu la satisfaction (NPS, CSAT, CES)',
        'Proposer et promouvoir des modes alternatifs de résolution des litiges (médiation)',
      ]},
      { id: 'DA6.5', nom: 'Protection des données et de la vie privée des consommateurs', isoRef: '6.7.7', qcId: 'QC6', actions: [
        'Assurer la pleine conformité au RGPD et aux réglementations applicables',
        "Nommer un Délégué à la Protection des Données (DPO) qualifié",
        "Réaliser des Analyses d'Impact sur la Protection des Données (AIPD/DPIA) pour les traitements à risque",
        'Mettre en place des mesures de sécurité informatique robustes (chiffrement, accès, audits)',
        "Informer clairement et simplement les consommateurs sur l'utilisation de leurs données",
        "Permettre et faciliter l'exercice effectif des droits RGPD",
      ]},
      { id: 'DA6.6', nom: 'Accès aux services essentiels', isoRef: '6.7.8', qcId: 'QC6', actions: [
        'Proposer des tarifs accessibles ou des dispositifs spécifiques pour les publics vulnérables',
        'Assurer l\'accessibilité physique et numérique pour les personnes handicapées (RGAA)',
        "Participer aux programmes d'accès universel aux services essentiels",
        'Adapter les conditions de paiement pour faciliter l\'accès',
      ]},
      { id: 'DA6.7', nom: 'Éducation et sensibilisation', isoRef: '6.7.9', qcId: 'QC6', actions: [
        "Produire et diffuser des contenus éducatifs sur l'utilisation responsable des produits",
        "Développer des programmes d'éducation à la consommation durable",
        "Communiquer activement sur les enjeux environnementaux et sociaux liés à l'offre",
      ]},
    ],
  },
  {
    id: 'QC7', nom: 'Communautés et développement local', icone: '🏘️',
    couleur: '#22d3ee', argb: 'FF22D3EE', argbL: 'FFE0F7FA',
    domains: [
      { id: 'DA7.1', nom: 'Implication auprès des communautés', isoRef: '6.8.3', qcId: 'QC7', actions: [
        'Organiser des consultations régulières avec les riverains et parties prenantes locales',
        "Participer activement aux instances de concertation et de gouvernance locale",
        'Mettre en place un mécanisme accessible de traitement des plaintes communautaires',
        "Communiquer de manière transparente et régulière sur les impacts locaux de l'activité",
      ]},
      { id: 'DA7.2', nom: 'Éducation et culture', isoRef: '6.8.4', qcId: 'QC7', actions: [
        "Financer ou co-financer des programmes d'éducation locale",
        'Proposer des stages, apprentissages et alternances en priorité aux jeunes locaux',
        'Soutenir des projets culturels, artistiques et patrimoniaux locaux',
        "Développer des partenariats durables avec les établissements scolaires locaux",
      ]},
      { id: 'DA7.3', nom: "Création d'emplois et développement des compétences", isoRef: '6.8.5', qcId: 'QC7', actions: [
        'Favoriser systématiquement le recrutement local pour tous les postes',
        "Travailler en partenariat avec France Travail, missions locales et acteurs de l'emploi",
        "Soutenir des initiatives d'insertion professionnelle pour les publics éloignés de l'emploi",
        'Intégrer des clauses d\'insertion dans les marchés publics et privés',
        'Contribuer aux GPEC territoriales',
      ]},
      { id: 'DA7.4', nom: 'Développement des technologies et accès à la technologie', isoRef: '6.8.6', qcId: 'QC7', actions: [
        'Partager les technologies, savoir-faire et innovations avec les acteurs locaux',
        "Soutenir l'innovation sociale et technologique locale",
        'Contribuer à réduire la fracture numérique (formation, équipements, accès)',
        "Participer à des clusters locaux et à des écosystèmes d'innovation",
      ]},
      { id: 'DA7.5', nom: 'Création de richesses et de revenus', isoRef: '6.8.7', qcId: 'QC7', actions: [
        'Privilégier les fournisseurs et sous-traitants locaux dans les achats',
        'Mesurer et communiquer la valeur économique créée et distribuée localement',
        'Soutenir activement les TPE/PME locales par des partenariats durables',
      ]},
      { id: 'DA7.6', nom: 'La santé', isoRef: '6.8.8', qcId: 'QC7', actions: [
        'Soutenir des associations et initiatives de santé locales',
        'Développer des programmes de mécénat social liés à la santé',
        'Participer à des campagnes de santé publique (prévention, dépistage…)',
        'Contribuer au développement ou au maintien des infrastructures de santé locales',
      ]},
      { id: 'DA7.7', nom: 'Investissement à impact social', isoRef: '6.8.9', qcId: 'QC7', actions: [
        'Mesurer et communiquer l\'impact social de l\'organisation (méthode SROI ou équivalent)',
        "Développer des partenariats stratégiques avec des acteurs de l'ESS",
        "Intégrer des critères d'impact social dans la stratégie d'investissement",
        "Soutenir des initiatives de développement communautaire à fort impact",
      ]},
    ],
  },
]

const ALL_DOMAINS = QC_LIST.flatMap(qc => qc.domains)

// ─── Contrôle d'accès ────────────────────────────────────────────────────────

async function canRead(userId: string, diagnosticId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('iso26000_diagnostics')
    .select('user_id, iso26000_diagnostic_shares(shared_with_user_id)')
    .eq('id', diagnosticId)
    .single()
  if (!data) return false
  if (data.user_id === userId) return true
  const shares = (data as Record<string, unknown>).iso26000_diagnostic_shares as Array<{ shared_with_user_id: string }> | undefined
  return shares?.some(s => s.shared_with_user_id === userId) ?? false
}

// ─── Sheet 1 : Couverture ─────────────────────────────────────────────────────

function buildCouvertureSheet(
  wb: ExcelJS.Workbook, orgName: string, year: number,
  avgScore: number, evaluatedCount: number, exportDate: string,
) {
  const ws = wb.addWorksheet('Couverture')
  ws.properties.tabColor = { argb: C.teal }
  ws.columns = [{ width: 32 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }]
  let r = 1

  titleRow(ws, r++, 'Diagnostic RSE ISO 26000 — 37 domaines, 7 Questions Centrales', 5)
  blank(ws, r++, 8)

  const infos: [string, string][] = [
    ['Organisation', orgName],
    ['Année', String(year)],
    ["Date d'export", exportDate],
    ['Domaines évalués', `${evaluatedCount} / ${ALL_DOMAINS.length}`],
    ['Score moyen de maturité', evaluatedCount > 0 ? `${avgScore.toFixed(2)} / 5` : 'Aucun domaine évalué'],
    ['Niveau global', scoreName(Math.round(avgScore))],
    ['Référentiel', 'ISO 26000:2010 — Lignes directrices RSE'],
    ['Questions centrales', '7 (QC1 à QC7)'],
    ['Généré par', "Sens'ethO Apps"],
  ]
  for (const [k, v] of infos) {
    sc(ws, r, 1, k, { bg: C.tealL, bold: true })
    merge(ws, r, 2, r, 5)
    sc(ws, r, 2, v, { bold: ["Score moyen de maturité", 'Niveau global'].includes(k), ha: 'center', sz: 11 })
    ws.getRow(r).height = 16; r++
  }

  blank(ws, r++, 10)
  sectionRow(ws, r++, 'Niveaux de maturité ISO 26000', 5, C.gray)
  const legend: [number, string, string][] = [
    [1, 'Inexistant', 'Aucune pratique formalisée'],
    [2, 'Initié', 'Premières actions engagées'],
    [3, 'En développement', 'Pratiques documentées et déployées'],
    [4, 'Maîtrisé', 'Mesure des résultats et amélioration continue'],
    [5, 'Exemplaire', 'Excellence RSE et benchmark sectoriel'],
  ]
  for (const [score, name, desc] of legend) {
    sc(ws, r, 1, `${score}/5 — ${name}`, { bg: scoreColorL(score), fg: scoreColor(score), bold: true })
    merge(ws, r, 2, r, 5)
    sc(ws, r, 2, desc, { it: true })
    ws.getRow(r).height = 14; r++
  }

  blank(ws, r++, 10)
  sectionRow(ws, r++, 'Les 7 Questions Centrales ISO 26000', 5, C.indigo)
  for (const qc of QC_LIST) {
    sc(ws, r, 1, `${qc.id} — ${qc.nom}`, { bg: qc.argbL, bold: true })
    merge(ws, r, 2, r, 5)
    sc(ws, r, 2, `${qc.icone}  ${qc.domains.length} domaines`, { ha: 'center' })
    ws.getRow(r).height = 14; r++
  }
}

// ─── Sheet 2 : Synthèse par QC ────────────────────────────────────────────────

function buildSyntheseSheet(
  wb: ExcelJS.Workbook,
  scores: Record<string, number>,
  actionProgress: Record<string, number>,
  actionNa: Record<string, boolean>,
) {
  const ws = wb.addWorksheet('Synthèse par QC')
  ws.properties.tabColor = { argb: C.indigo }
  ws.columns = [{ width: 30 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 20 }]
  let r = 1

  titleRow(ws, r++, 'Synthèse par Question Centrale — ISO 26000 (7 QC)', 5, C.indigo)
  blank(ws, r++, 8)

  for (const qc of QC_LIST) {
    const evaluated = qc.domains.filter(d => (scores[d.id] ?? 0) > 0)
    const qcAvg = evaluated.length > 0
      ? evaluated.reduce((s, d) => s + (scores[d.id] ?? 0), 0) / qc.domains.length
      : 0

    // En-tête QC
    const phRow = r
    merge(ws, phRow, 1, phRow, 5)
    ws.getCell(phRow, 1).value = `${qc.icone}  ${qc.id} — ${qc.nom}`
    ws.getCell(phRow, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: qc.argbL } }
    ws.getCell(phRow, 1).font = { name: 'Calibri', size: 11, bold: true, color: { argb: C.black } }
    ws.getCell(phRow, 1).alignment = { horizontal: 'left', vertical: 'middle' }
    ws.getRow(phRow).height = 20; r++

    // Score QC
    sc(ws, r, 1, 'Score moyen QC :', { bold: true, bg: scoreColorL(Math.round(qcAvg)) })
    merge(ws, r, 2, r, 3)
    sc(ws, r, 2, qcAvg > 0 ? Math.round(qcAvg * 10) / 10 : '—', {
      ha: 'center', bold: true, sz: 13, bg: scoreColorL(Math.round(qcAvg)), fg: scoreColor(Math.round(qcAvg)),
    })
    merge(ws, r, 4, r, 5)
    sc(ws, r, 4, scoreName(Math.round(qcAvg)), { ha: 'center', it: qcAvg === 0, fg: scoreColor(Math.round(qcAvg)) })
    ws.getRow(r).height = 18; r++

    hdRow(ws, r++, ['Domaine', 'Score', 'Niveau', 'Actions', '% réalisées'], qc.argb)

    for (const domain of qc.domains) {
      const score = scores[domain.id] ?? 0
      let dDone = 0, dTotal = 0
      domain.actions.forEach((_, idx) => {
        const key = `${domain.id}_${idx}`
        if (actionNa[key]) return
        dTotal++
        if ((actionProgress[key] ?? 0) >= 10) dDone++
      })
      const pct = dTotal > 0 ? `${Math.round((dDone / dTotal) * 100)} %` : '—'

      ws.getRow(r).height = 14
      sc(ws, r, 1, `${domain.id} — ${domain.nom}`, { indent: 1 })
      sc(ws, r, 2, score > 0 ? score : '—', { ha: 'center', bg: scoreColorL(score), fg: scoreColor(score), bold: score > 0 })
      sc(ws, r, 3, scoreName(score), { it: score === 0, fg: score === 0 ? C.grayM : C.black })
      sc(ws, r, 4, domain.actions.length, { ha: 'center' })
      sc(ws, r, 5, pct, { ha: 'center', bold: dDone === dTotal && dTotal > 0, fg: dTotal === 0 ? C.grayM : dDone === dTotal ? C.green : dDone > 0 ? C.yellow : C.grayM })
      r++
    }
    blank(ws, r++, 8)
  }
}

// ─── Sheet 3 : Domaines détaillés ────────────────────────────────────────────

function buildDomainesSheet(
  wb: ExcelJS.Workbook,
  scores: Record<string, number>,
  actionProgress: Record<string, number>,
  actionNa: Record<string, boolean>,
) {
  const ws = wb.addWorksheet('Domaines détaillés')
  ws.properties.tabColor = { argb: C.teal }
  ws.columns = [
    { width: 7 }, { width: 28 }, { width: 22 }, { width: 10 }, { width: 17 }, { width: 12 }, { width: 12 },
  ]
  let r = 1

  titleRow(ws, r++, 'Résultats détaillés par domaine — 37 domaines ISO 26000', 7)
  blank(ws, r++, 8)
  hdRow(ws, r++, ['QC', 'Domaine', 'Référence ISO', 'Score', 'Niveau', 'Actions', '% réalisées'])

  for (const qc of QC_LIST) {
    for (const domain of qc.domains) {
      const score = scores[domain.id] ?? 0
      let doneCount = 0, totalCount = 0
      domain.actions.forEach((_, idx) => {
        const key = `${domain.id}_${idx}`
        if (actionNa[key]) return
        totalCount++
        if ((actionProgress[key] ?? 0) >= 10) doneCount++
      })
      const pctDone = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

      sc(ws, r, 1, qc.id, { bg: qc.argbL, ha: 'center', bold: true })
      sc(ws, r, 2, `${domain.id} — ${domain.nom}`, { bold: score > 0 })
      sc(ws, r, 3, domain.isoRef, { sz: 9, fg: C.grayM })
      sc(ws, r, 4, score > 0 ? score : '—', { ha: 'center', bold: score > 0, bg: scoreColorL(score), fg: scoreColor(score) })
      sc(ws, r, 5, scoreName(score), { it: score === 0, fg: score === 0 ? C.grayM : C.black })
      sc(ws, r, 6, domain.actions.length, { ha: 'center' })
      sc(ws, r, 7, totalCount > 0 ? `${pctDone} %` : '—', {
        ha: 'center', bold: pctDone === 100,
        fg: pctDone === 100 ? C.green : pctDone >= 50 ? C.yellow : C.grayM,
      })
      ws.getRow(r).height = 15; r++
    }
  }
}

// ─── Sheet 4 : Plan d'actions ─────────────────────────────────────────────────

function buildActionsSheet(
  wb: ExcelJS.Workbook,
  scores: Record<string, number>,
  actionProgress: Record<string, number>,
  actionNa: Record<string, boolean>,
  notes: Record<string, string>,
  sections: Record<string, NoteSection[]>,
  annexesPerAction: Record<string, number>,
) {
  const ws = wb.addWorksheet("Plan d'actions")
  ws.properties.tabColor = { argb: C.green }
  ws.columns = [
    { width: 26 }, { width: 9 }, { width: 46 }, { width: 11 }, { width: 15 }, { width: 44 }, { width: 10 },
  ]
  let r = 1

  titleRow(ws, r++, "Plan d'actions — ISO 26000 (37 domaines)", 7, C.green)
  blank(ws, r++, 8)
  hdRow(ws, r++, ['Domaine', 'Score', 'Action', 'Avancement', 'Statut', 'Notes et sections', 'Annexes'], C.green)

  for (const qc of QC_LIST) {
    // Séparateur QC
    merge(ws, r, 1, r, 7)
    ws.getCell(r, 1).value = `  ${qc.icone}  ${qc.id} — ${qc.nom}`
    ws.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: qc.argbL } }
    ws.getCell(r, 1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.black } }
    ws.getCell(r, 1).alignment = { horizontal: 'left', vertical: 'middle' }
    ws.getRow(r).height = 16; r++

    for (const domain of qc.domains) {
      const score = scores[domain.id] ?? 0
      for (let actionIdx = 0; actionIdx < domain.actions.length; actionIdx++) {
        const actionText = domain.actions[actionIdx]
        const key = `${domain.id}_${actionIdx}`
        const progress = actionProgress[key] ?? 0
        const na = actionNa[key] ?? false

        const noteLines: string[] = []
        const rawNote = notes[key]
        if (rawNote) noteLines.push(rawNote)
        const sects = sections[key] ?? []
        for (const sect of sects) {
          const titleTxt = htmlToText(sect.title)
          const contentTxt = htmlToText(sect.content)
          if (titleTxt) noteLines.push(`▸ ${titleTxt}`)
          if (contentTxt) noteLines.push(contentTxt)
        }
        const noteText = noteLines.join('\n').trim()
        const annexeCount = annexesPerAction[key] ?? 0

        const progressStr = na ? 'N/A' : progress === 0 ? '0 %' : `${progress * 10} %`
        const statut = na ? 'Non applicable'
          : progress >= 10 ? 'Terminé'
          : progress >= 5 ? 'En cours'
          : progress > 0 ? 'Démarré'
          : 'À faire'
        const statutBg = na ? C.grayL
          : progress >= 10 ? C.greenL
          : progress >= 5 ? C.tealL
          : progress > 0 ? C.indigoL
          : C.white

        sc(ws, r, 1, `${domain.id} — ${domain.nom}`, { indent: 1, sz: 9 })
        sc(ws, r, 2, score > 0 ? score : '—', { ha: 'center', bg: scoreColorL(score), fg: scoreColor(score), bold: score > 0 })
        sc(ws, r, 3, actionText, { wrap: true, sz: 9 })
        sc(ws, r, 4, progressStr, { ha: 'center', bold: progress >= 10, fg: na ? C.grayM : C.black })
        sc(ws, r, 5, statut, { ha: 'center', bg: statutBg, sz: 9 })
        sc(ws, r, 6, noteText || '', { wrap: true, sz: 8, it: !noteText, fg: noteText ? C.black : C.grayM })
        sc(ws, r, 7, annexeCount > 0 ? annexeCount : '—', { ha: 'center', bold: annexeCount > 0, fg: annexeCount > 0 ? C.indigo : C.grayM })

        const hasContent = noteText || annexeCount > 0
        ws.getRow(r).height = hasContent ? Math.max(30, Math.min(100, Math.ceil(noteText.length / 55) * 14)) : 18
        r++
      }
    }
  }
}

// ─── Sheet 5 : Analyse IA ─────────────────────────────────────────────────────

function buildAnalyseSheet(wb: ExcelJS.Workbook, analysis: string) {
  const ws = wb.addWorksheet('Analyse IA')
  ws.properties.tabColor = { argb: C.purple }
  ws.columns = [{ width: 120 }]
  let r = 1

  titleRow(ws, r++, 'Analyse RSE par Intelligence Artificielle — ISO 26000', 1, C.purple)
  blank(ws, r++, 10)

  const paragraphs = analysis.split(/\n\n+/).filter(p => p.trim())
  for (const para of paragraphs) {
    const text = para.trim()
    const starIdx = text.indexOf('**')
    const starEnd = starIdx >= 0 ? text.indexOf('**', starIdx + 2) : -1
    const isBold = starIdx === 0 && starEnd > 2

    if (isBold) {
      const title = text.slice(2, starEnd).trim()
      const body = text.slice(starEnd + 2).trim()
      sc(ws, r, 1, title, { bold: true, sz: 11, bg: C.purpleL, fg: C.purple })
      ws.getRow(r).height = 18; r++
      if (body) {
        sc(ws, r, 1, body, { wrap: true, sz: 10 })
        ws.getRow(r).height = Math.max(20, Math.ceil(body.length / 100) * 14); r++
      }
    } else {
      sc(ws, r, 1, text, { wrap: true, sz: 10 })
      ws.getRow(r).height = Math.max(20, Math.ceil(text.length / 100) * 14); r++
    }
    blank(ws, r++, 6)
  }
}

// ─── Sheet 6 : Annexes ───────────────────────────────────────────────────────

interface AttachmentRow {
  name: string; action_key: string; mime: string | null; size: number | null; annexe_index: number | null
}

function buildAnnexesSheet(wb: ExcelJS.Workbook, attachments: AttachmentRow[]) {
  const ws = wb.addWorksheet('Annexes')
  ws.properties.tabColor = { argb: C.purple }
  ws.columns = [{ width: 8 }, { width: 40 }, { width: 16 }, { width: 30 }, { width: 16 }, { width: 12 }]
  let r = 1

  titleRow(ws, r++, 'Pièces jointes — Annexes du diagnostic ISO 26000', 6, C.purple)
  blank(ws, r++, 8)

  if (attachments.length === 0) {
    merge(ws, r, 1, r, 6)
    sc(ws, r, 1, 'Aucune pièce jointe pour ce diagnostic.', { fg: C.grayM, it: true, ha: 'center' })
    return ws
  }

  hdRow(ws, r++, ['Annexe #', 'Nom du fichier', 'Action clé', 'Domaine', 'Type MIME', 'Taille'], C.purple)

  for (const att of attachments) {
    const domainId = att.action_key.split('_').slice(0, -1).join('_')
    const domain = ALL_DOMAINS.find(d => d.id === domainId)
    const domainName = domain ? `${domain.id} — ${domain.nom}` : domainId
    const sizeStr = att.size
      ? att.size >= 1024 * 1024 ? `${(att.size / (1024 * 1024)).toFixed(1)} Mo` : `${Math.round(att.size / 1024)} Ko`
      : '—'

    sc(ws, r, 1, att.annexe_index != null ? `A${String(att.annexe_index).padStart(3, '0')}` : '—', {
      ha: 'center', bold: true, bg: C.purpleL, fg: C.purple,
    })
    sc(ws, r, 2, att.name)
    sc(ws, r, 3, att.action_key, { sz: 9, fg: C.grayM })
    sc(ws, r, 4, domainName, { sz: 9 })
    sc(ws, r, 5, att.mime ?? '—', { sz: 9, fg: C.grayM })
    sc(ws, r, 6, sizeStr, { ha: 'right', sz: 9 })
    ws.getRow(r).height = 15; r++
  }
  return ws
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    if (!await canRead(user.id, params.id)) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const admin = createAdminClient()
    const { data: diag, error: diagErr } = await admin
      .from('iso26000_diagnostics')
      .select('id, organisation_id, year, scores, action_progress, action_na, ai_analysis')
      .eq('id', params.id)
      .single()

    if (diagErr || !diag) return NextResponse.json({ error: 'Diagnostic introuvable' }, { status: 404 })

    let orgName = 'Organisation'
    if (diag.organisation_id) {
      const { data: org } = await admin.from('organisations').select('nom').eq('id', diag.organisation_id).single()
      if (org?.nom) orgName = org.nom
    }

    const { data: notesRows } = await admin
      .from('iso26000_action_notes')
      .select('action_key, content, sections')
      .eq('diagnostic_id', params.id)

    const notes: Record<string, string> = {}
    const sections: Record<string, NoteSection[]> = {}
    for (const row of (notesRows ?? [])) {
      if (row.content) notes[row.action_key] = row.content
      if (row.sections) sections[row.action_key] = row.sections as NoteSection[]
    }

    const { data: attachmentRows } = await admin
      .from('iso26000_attachments')
      .select('name, action_key, mime, size, annexe_index')
      .eq('diagnostic_id', params.id)
      .order('annexe_index', { ascending: true, nullsFirst: false })

    const attachments = (attachmentRows ?? []) as AttachmentRow[]
    const annexesPerAction: Record<string, number> = {}
    for (const att of attachments) {
      annexesPerAction[att.action_key] = (annexesPerAction[att.action_key] ?? 0) + 1
    }

    const scores: Record<string, number> = (diag.scores as Record<string, number>) ?? {}
    const actionProgress: Record<string, number> = (diag.action_progress as Record<string, number>) ?? {}
    const actionNa: Record<string, boolean> = (diag.action_na as Record<string, boolean>) ?? {}
    const year: number = diag.year ?? new Date().getFullYear()
    const aiAnalysis: string | null = diag.ai_analysis ?? null

    const evaluatedDomains = ALL_DOMAINS.filter(d => (scores[d.id] ?? 0) > 0)
    const avgScore = evaluatedDomains.length > 0
      ? evaluatedDomains.reduce((s, d) => s + (scores[d.id] ?? 0), 0) / evaluatedDomains.length
      : 0

    const exportDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

    const wb = new ExcelJS.Workbook()
    wb.creator = "Sens'ethO Apps"
    wb.lastModifiedBy = "Sens'ethO Apps"
    wb.created = new Date()
    wb.modified = new Date()

    buildCouvertureSheet(wb, orgName, year, avgScore, evaluatedDomains.length, exportDate)
    buildSyntheseSheet(wb, scores, actionProgress, actionNa)
    buildDomainesSheet(wb, scores, actionProgress, actionNa)
    buildActionsSheet(wb, scores, actionProgress, actionNa, notes, sections, annexesPerAction)
    if (aiAnalysis) buildAnalyseSheet(wb, aiAnalysis)
    buildAnnexesSheet(wb, attachments)

    const buffer = await wb.xlsx.writeBuffer()
    const safeName = orgName.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').slice(0, 40)
    const filename = `Diagnostic-ISO26000-${safeName}-${year}.xlsx`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[iso26000/export-excel] error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

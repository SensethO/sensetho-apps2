/**
 * GET /api/guided-diagnostic/[id]/export-excel
 * Génère un fichier Excel structuré du Diagnostic Initial Guidé.
 *
 * Onglets :
 *  1. Couverture         — présentation du rapport, score moyen
 *  2. Synthèse par phase — 4 phases, score moyen, domaines listés
 *  3. Domaines détaillés — 13 domaines, score, % actions réalisées
 *  4. Plan d'actions     — toutes les actions focus : avancée, N/A, note
 *  5. Analyse IA         — si disponible
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
  return 'FF22D3EE'
}
function scoreColorL(score: number): string {
  if (score === 0) return C.grayL
  if (score <= 1) return C.redL
  if (score <= 2) return C.orangeL
  if (score <= 3) return C.yellowL
  if (score <= 4) return C.greenL
  return 'FFE0F7FA'
}
function scoreName(score: number): string {
  if (score === 0) return 'Non évalué'
  if (score <= 1) return 'Initial'
  if (score <= 2) return 'En développement'
  if (score <= 3) return 'Défini'
  if (score <= 4) return 'Géré'
  return 'Optimisé'
}

// ─── Données métier : phases et domaines ─────────────────────────────────────

const PHASES = [
  { id: 1 as const, label: 'Fondamentaux' },
  { id: 2 as const, label: 'Piliers sociaux' },
  { id: 3 as const, label: 'Environnement' },
  { id: 4 as const, label: 'Enjeux complémentaires' },
]

const PHASE_COLORS: Record<number, string> = {
  1: 'FFFEE2E2', // redL
  2: 'FFFFEDD5', // orangeL
  3: 'FFDCFCE7', // greenL
  4: 'FFEDE9FE', // purpleL
}

interface DomainDef {
  id: string
  nom: string
  isoRef: string
  phase: 1 | 2 | 3 | 4
  qcNom: string
  qcIcone: string
  rationale: string
  focusActionIndices: number[]
  actions: string[]
}

const DOMAINS: DomainDef[] = [
  // Phase 1 : Fondamentaux
  {
    id: 'DA1.1', nom: 'Gouvernance organisationnelle', isoRef: '6.2', phase: 1,
    qcNom: "Gouvernance de l'organisation", qcIcone: '🏛️',
    rationale: 'La gouvernance est le socle transversal de toute démarche RSE. Sans structures de décision claires et un engagement de la direction, les autres actions restent isolées et sans pilotage.',
    focusActionIndices: [0, 1, 5, 8],
    actions: [
      'Définir et formaliser les valeurs, vision et stratégie RSE',
      'Identifier et cartographier les parties prenantes',
      'Mettre en place des mécanismes de décision transparents',
      'Établir un reporting RSE régulier (annuel au minimum)',
      'Intégrer la RSE dans les objectifs stratégiques et la feuille de route',
      'Désigner un responsable RSE ou un comité dédié avec mandat officiel',
      'Promouvoir la diversité dans les instances de décision',
      'Évaluer et améliorer en continu les pratiques de gouvernance',
      'Former les dirigeants et administrateurs aux enjeux de responsabilité sociétale',
      'Publier un rapport de durabilité selon un référentiel reconnu (GRI, CSRD…)',
    ],
  },
  {
    id: 'DA3.4', nom: 'Santé et sécurité au travail', isoRef: '6.4.6', phase: 1,
    qcNom: 'Relations et conditions de travail', qcIcone: '👷',
    rationale: "Premier enjeu social et légal. La santé et la sécurité au travail impactent chaque collaborateur quotidiennement.",
    focusActionIndices: [0, 1, 2, 3],
    actions: [
      'Évaluer les risques professionnels et mettre à jour le document unique (DUER)',
      'Mettre en place un comité SSCT (Santé, Sécurité et Conditions de Travail)',
      'Former régulièrement les collaborateurs aux gestes et postures et aux risques spécifiques',
      'Définir des indicateurs de suivi : taux de fréquence, taux de gravité des accidents',
      "Promouvoir la remontée d'incidents et de presqu'accidents (culture de sécurité)",
      'Intégrer le bien-être mental dans la politique santé (prévention des RPS)',
      'Auditer régulièrement les conditions de travail et agir sur les résultats',
    ],
  },
  {
    id: 'DA4.3', nom: 'Atténuation des changements climatiques', isoRef: '6.5.5', phase: 1,
    qcNom: 'Environnement', qcIcone: '🌱',
    rationale: "Pression réglementaire croissante (CSRD, taxonomie verte). Mesurer son empreinte carbone est désormais incontournable.",
    focusActionIndices: [0, 1, 2, 5],
    actions: [
      'Réaliser un bilan des émissions de gaz à effet de serre (Bilan Carbone® ou GHG Protocol)',
      'Fixer des objectifs de réduction des émissions à court et moyen terme',
      'Optimiser la consommation énergétique des bâtiments et équipements',
      "Développer l'usage des énergies renouvelables",
      "Intégrer le critère carbone dans les décisions d'achats et d'investissements",
      'Communiquer transparentement sur les émissions et les progrès réalisés',
      'Étudier les compensations carbone comme levier complémentaire (pas substitutif)',
    ],
  },
  {
    id: 'DA5.1', nom: 'Lutte contre la corruption', isoRef: '6.6.3', phase: 1,
    qcNom: 'Loyauté des pratiques', qcIcone: '⚖️',
    rationale: 'Obligation légale (Loi Sapin 2). Le risque réputationnel et pénal en cas de corruption est majeur pour toute organisation, quelle que soit sa taille.',
    focusActionIndices: [0, 1, 2, 3],
    actions: [
      'Adopter et diffuser un code de conduite anti-corruption',
      "Cartographier les risques de corruption et d'atteinte à la probité",
      'Former les collaborateurs exposés aux risques de corruption',
      "Mettre en place un dispositif d'alerte interne (whistleblowing)",
      'Évaluer les tiers (clients, fournisseurs, intermédiaires) sur leur intégrité',
      'Auditer régulièrement les processus à risque (achats, commercial, partenariats)',
    ],
  },
  // Phase 2 : Piliers sociaux
  {
    id: 'DA3.1', nom: 'Emploi et relations de travail', isoRef: '6.4.3', phase: 2,
    qcNom: 'Relations et conditions de travail', qcIcone: '👷',
    rationale: "Des conditions d'emploi équitables sont le premier levier d'attractivité et de fidélisation des talents.",
    focusActionIndices: [0, 1, 2, 4],
    actions: [
      'Établir une politique de rémunération équitable et transparente',
      'Garantir la stabilité des contrats et limiter la précarité',
      'Favoriser le dialogue social et la consultation des représentants du personnel',
      'Mettre en place des entretiens individuels réguliers et des parcours de carrière',
      'Développer la flexibilité du travail (télétravail, aménagement horaires)',
      "Mesurer et améliorer le taux d'engagement et de satisfaction des collaborateurs",
    ],
  },
  {
    id: 'DA3.5', nom: 'Formation et éducation', isoRef: '6.4.7', phase: 2,
    qcNom: 'Relations et conditions de travail', qcIcone: '👷',
    rationale: 'La formation est un droit pour chaque salarié et un investissement à ROI prouvé. La CSRD impose désormais de mesurer et communiquer cet engagement.',
    focusActionIndices: [0, 1, 2, 5],
    actions: [
      'Définir un plan de développement des compétences annuel',
      "Garantir l'accès à la formation pour tous les niveaux hiérarchiques",
      'Intégrer la RSE dans les parcours de formation',
      'Développer le mentorat et le transfert de compétences internes',
      "Mesurer l'impact des formations sur les performances",
      'Favoriser les certifications professionnelles et la validation des acquis',
    ],
  },
  {
    id: 'DA3.6', nom: 'Égalité professionnelle', isoRef: '6.4.4', phase: 2,
    qcNom: 'Relations et conditions de travail', qcIcone: '👷',
    rationale: "L'Index Égalité Professionnelle est obligatoire dès 50 salariés. L'égalité femmes/hommes est un facteur de performance mesurable.",
    focusActionIndices: [0, 1, 2, 3],
    actions: [
      "Calculer et publier l'Index d'égalité professionnelle femmes/hommes",
      "Analyser les écarts de rémunération et définir un plan d'action correctif",
      'Fixer des objectifs de mixité à tous les niveaux hiérarchiques, notamment en direction',
      'Prévenir et traiter les situations de harcèlement moral et sexuel',
      'Faciliter la conciliation vie professionnelle / vie personnelle',
      'Former les managers et recruteurs aux biais inconscients',
    ],
  },
  {
    id: 'DA5.4', nom: "Pratiques d'achat responsables", isoRef: '6.6.6', phase: 2,
    qcNom: 'Loyauté des pratiques', qcIcone: '⚖️',
    rationale: "Vos fournisseurs et partenaires engagent votre responsabilité sociale et environnementale. Les grands donneurs d'ordres vous imposent de plus en plus des exigences RSE.",
    focusActionIndices: [0, 1, 2, 3],
    actions: [
      "Définir une politique d'achats responsables intégrant des critères RSE",
      'Évaluer les fournisseurs sur des critères sociaux, environnementaux et éthiques',
      'Intégrer des clauses RSE dans les contrats fournisseurs',
      "Privilégier les fournisseurs locaux et les entreprises de l'ESS",
      'Accompagner les fournisseurs dans leur démarche RSE',
      "Mesurer et réduire l'empreinte carbone de la chaîne d'approvisionnement",
    ],
  },
  // Phase 3 : Environnement
  {
    id: 'DA4.1', nom: 'Prévention de la pollution', isoRef: '6.5.3', phase: 3,
    qcNom: 'Environnement', qcIcone: '🌱',
    rationale: "Réduire les déchets et les émissions polluantes génère souvent des économies immédiates. C'est aussi le domaine environnemental le plus visible pour les riverains.",
    focusActionIndices: [0, 2, 3, 6],
    actions: [
      'Cartographier et quantifier les pollutions générées (air, eau, sol, déchets)',
      'Mettre en conformité les installations avec les réglementations environnementales',
      'Réduire à la source les émissions polluantes et les déchets produits',
      'Trier et valoriser les déchets (réemploi, recyclage, compostage)',
      'Former les collaborateurs aux bonnes pratiques environnementales',
      'Travailler avec les fournisseurs pour réduire les emballages et matières dangereuses',
      "Mesurer l'évolution des indicateurs pollution et fixer des objectifs de réduction",
    ],
  },
  {
    id: 'DA4.2', nom: 'Utilisation durable des ressources', isoRef: '6.5.4', phase: 3,
    qcNom: 'Environnement', qcIcone: '🌱',
    rationale: "Énergie et eau : des économies directes et une réduction de l'exposition aux prix volatils. L'efficacité des ressources est souvent le chemin le plus court vers la rentabilité verte.",
    focusActionIndices: [0, 1, 2, 6],
    actions: [
      "Réaliser un audit des consommations énergétiques et identifier les gisements d'économies",
      "Mettre en oeuvre un plan d'efficacité énergétique (isolation, équipements, process)",
      "Mesurer et réduire les consommations d'eau",
      "Développer l'économie circulaire dans les processus de production",
      "Réduire l'utilisation de matières premières vierges (recyclées, biosourcées)",
      'Mettre en place un suivi des consommations en temps réel',
      'Fixer des objectifs annuels de réduction des consommations et les suivre',
    ],
  },
  // Phase 4 : Enjeux complémentaires
  {
    id: 'DA2.1', nom: 'Devoir de vigilance', isoRef: '6.3.3', phase: 4,
    qcNom: "Droits de l'Homme", qcIcone: '🤝',
    rationale: "La loi française sur le devoir de vigilance s'applique aux grandes entreprises et s'étend progressivement via la CSDDD européenne.",
    focusActionIndices: [0, 1, 2, 4],
    actions: [
      "Cartographier les risques d'atteintes aux droits humains dans la chaîne de valeur",
      'Élaborer et publier un plan de vigilance conforme à la loi',
      "Mettre en oeuvre des procédures d'évaluation et d'audit fournisseurs sur les droits humains",
      'Former les acheteurs et responsables commerciaux au devoir de vigilance',
      "Établir un mécanisme d'alerte pour les victimes de violations",
      "Assurer le suivi et l'amélioration continue du plan de vigilance",
    ],
  },
  {
    id: 'DA6.5', nom: 'Protection des données', isoRef: '6.7.7', phase: 4,
    qcNom: 'Questions relatives aux consommateurs', qcIcone: '🛒',
    rationale: 'La conformité RGPD est une obligation légale depuis 2018. La protection des données clients est un avantage concurrentiel fort dans un contexte de méfiance croissante.',
    focusActionIndices: [0, 1, 3, 4],
    actions: [
      'Désigner un délégué à la protection des données (DPO) ou un référent RGPD',
      'Réaliser un registre des traitements de données personnelles',
      'Mettre en place les mentions légales et les consentements conformes au RGPD',
      'Former les collaborateurs aux bonnes pratiques de protection des données',
      "Réaliser des analyses d'impact (AIPD) pour les traitements à risque",
      "Gérer les demandes d'exercice des droits des personnes (accès, suppression…)",
    ],
  },
  {
    id: 'DA7.1', nom: 'Implication auprès des communautés', isoRef: '6.8.3', phase: 4,
    qcNom: 'Communautés et développement local', qcIcone: '🏘️',
    rationale: "L'ancrage territorial est un avantage compétitif et une attente forte des parties prenantes locales. Il différencie durablement les organisations responsables.",
    focusActionIndices: [0, 1, 2, 3],
    actions: [
      'Cartographier et dialoguer régulièrement avec les communautés locales',
      'Soutenir des initiatives locales (emploi, culture, sport, éducation)',
      "Développer des partenariats avec les associations et acteurs de l'ESS locaux",
      "Favoriser l'emploi local dans les recrutements et sous-traitances",
      "Mesurer l'impact territorial de l'organisation (emplois induits, achats locaux…)",
      'Participer aux concertations et décisions qui affectent le territoire',
    ],
  },
]

// ─── Helpers pour vérifier l'accès ───────────────────────────────────────────


async function canRead(userId: string, diagnosticId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('guided_diagnostics')
    .select('user_id, guided_diagnostic_shares(shared_with_user_id)')
    .eq('id', diagnosticId)
    .single()
  if (!data) return false
  if (data.user_id === userId) return true
  const shares = (data as Record<string, unknown>).guided_diagnostic_shares as Array<{ shared_with_user_id: string }> | undefined
  return shares?.some(s => s.shared_with_user_id === userId) ?? false
}

// ─── Sheet 1 : Couverture ─────────────────────────────────────────────────────

function buildCouvertureSheet(
  wb: ExcelJS.Workbook,
  orgName: string,
  year: number,
  avgScore: number,
  evaluatedCount: number,
  exportDate: string,
) {
  const ws = wb.addWorksheet('Couverture')
  ws.properties.tabColor = { argb: C.teal }
  ws.columns = [{ width: 32 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }]
  let r = 1

  titleRow(ws, r++, 'Diagnostic RSE Initial Guide — ISO 26000', 5)
  blank(ws, r++, 8)

  const infos: [string, string][] = [
    ['Organisation', orgName],
    ['Année', String(year)],
    ['Date d\'export', exportDate],
    ['Domaines évalués', `${evaluatedCount} / ${DOMAINS.length}`],
    ['Score moyen de maturité', evaluatedCount > 0 ? `${avgScore.toFixed(2)} / 5` : 'Aucun domaine évalué'],
    ['Niveau global', scoreName(avgScore)],
    ['Référentiel', 'ISO 26000:2010 — Lignes directrices RSE'],
    ['Généré par', "Sens'ethO Apps"],
  ]
  for (const [k, v] of infos) {
    sc(ws, r, 1, k, { bg: C.tealL, bold: true })
    merge(ws, r, 2, r, 5)
    sc(ws, r, 2, v, { bold: ['Score moyen de maturité', 'Niveau global'].includes(k), ha: 'center', sz: 11 })
    ws.getRow(r).height = 16; r++
  }

  blank(ws, r++, 10)
  sectionRow(ws, r++, 'Niveaux de maturité ISO 26000', 5, C.gray)
  const legend: [number, string, string][] = [
    [1, 'Initial', 'Aucune pratique formalisée'],
    [2, 'En développement', 'Premières actions engagées'],
    [3, 'Défini', 'Pratiques documentées et déployées'],
    [4, 'Géré', 'Mesure des résultats et amélioration continue'],
    [5, 'Optimisé', 'Excellence RSE et benchmark sectoriel'],
  ]
  for (const [score, name, desc] of legend) {
    sc(ws, r, 1, `${score}/5 — ${name}`, { bg: scoreColorL(score), fg: scoreColor(score), bold: true })
    merge(ws, r, 2, r, 5)
    sc(ws, r, 2, desc, { it: true })
    ws.getRow(r).height = 14; r++
  }
  return ws
}

// ─── Sheet 2 : Synthèse par phase ────────────────────────────────────────────

function buildSyntheseSheet(
  wb: ExcelJS.Workbook,
  scores: Record<string, number>,
) {
  const ws = wb.addWorksheet('Synthèse par phase')
  ws.properties.tabColor = { argb: C.indigo }
  ws.columns = [{ width: 30 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 20 }]
  let r = 1

  titleRow(ws, r++, 'Synthèse par phase — Diagnostic RSE guidé ISO 26000', 5, C.indigo)
  blank(ws, r++, 8)

  for (const phase of PHASES) {
    const domainsInPhase = DOMAINS.filter(d => d.phase === phase.id)
    const evaluated = domainsInPhase.filter(d => (scores[d.id] ?? 0) > 0)
    const phaseAvg = evaluated.length > 0
      ? evaluated.reduce((s, d) => s + (scores[d.id] ?? 0), 0) / domainsInPhase.length
      : 0
    const phaseAvgR = Math.round(phaseAvg * 10) / 10

    // En-tête de phase
    sectionRow(ws, r++, `Phase ${phase.id} — ${phase.label}`, 5, PHASE_COLORS[phase.id].startsWith('FF') ? C.teal : C.teal)
    merge(ws, r - 1, 1, r - 1, 5)

    // Ligne recap phase — on refait manuellement avec les bonnes couleurs
    const phRow = r - 1
    ws.getCell(phRow, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PHASE_COLORS[phase.id] } }
    ws.getCell(phRow, 1).font = { name: 'Calibri', size: 11, bold: true, color: { argb: C.black } }
    ws.getCell(phRow, 1).value = `Phase ${phase.id} — ${phase.label}`
    ws.getCell(phRow, 1).alignment = { horizontal: 'left', vertical: 'middle' }
    ws.getRow(phRow).height = 20

    // Score de phase
    sc(ws, r, 1, 'Score moyen de la phase :', { bold: true, bg: scoreColorL(phaseAvgR) })
    merge(ws, r, 2, r, 3)
    sc(ws, r, 2, phaseAvgR > 0 ? phaseAvgR : '—', {
      ha: 'center', bold: true, sz: 13, bg: scoreColorL(phaseAvgR), fg: scoreColor(phaseAvgR),
    })
    merge(ws, r, 4, r, 5)
    sc(ws, r, 4, scoreName(phaseAvgR), { ha: 'center', it: phaseAvgR === 0, fg: scoreColor(phaseAvgR) })
    ws.getRow(r).height = 18; r++

    // En-tête colonnes domaines
    hdRow(ws, r++, ['Domaine', 'Score', 'Niveau', 'Actions focus', '% réalisées'])

    // Lignes domaines
    for (const domain of domainsInPhase) {
      const score = scores[domain.id] ?? 0
      const totalFocus = domain.focusActionIndices.length
      ws.getRow(r).height = 14
      sc(ws, r, 1, `${domain.id} — ${domain.nom}`, { indent: 1 })
      sc(ws, r, 2, score > 0 ? score : '—', {
        ha: 'center', bg: scoreColorL(score), fg: scoreColor(score), bold: score > 0,
      })
      sc(ws, r, 3, scoreName(score), { it: score === 0, fg: score === 0 ? C.grayM : C.black })
      sc(ws, r, 4, totalFocus, { ha: 'center' })
      sc(ws, r, 5, '—', { ha: 'center', fg: C.grayM, it: true })
      r++
    }
    blank(ws, r++, 8)
  }
  return ws
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
    { width: 8 }, { width: 28 }, { width: 22 }, { width: 10 }, { width: 17 }, { width: 14 }, { width: 14 },
  ]
  let r = 1

  titleRow(ws, r++, 'Résultats détaillés par domaine — 13 domaines prioritaires ISO 26000', 7)
  blank(ws, r++, 8)
  hdRow(ws, r++, ['Phase', 'Domaine', 'Question centrale', 'Score', 'Niveau', 'Actions focus', '% réalisées'])

  for (const domain of DOMAINS) {
    const score = scores[domain.id] ?? 0
    const focusIndices = domain.focusActionIndices

    // Calculer % actions réalisées (progress >= 10 = terminé, ou na = skip)
    let doneCount = 0
    let totalCount = 0
    for (const idx of focusIndices) {
      const key = `${domain.id}_${idx}`
      const na = actionNa[key] ?? false
      if (na) continue
      totalCount++
      const prog = actionProgress[key] ?? 0
      if (prog >= 10) doneCount++
    }
    const pctDone = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

    sc(ws, r, 1, `Ph.${domain.phase}`, {
      bg: PHASE_COLORS[domain.phase], ha: 'center', bold: true,
    })
    sc(ws, r, 2, `${domain.id} — ${domain.nom}`, { bold: score > 0 })
    sc(ws, r, 3, `${domain.qcIcone} ${domain.qcNom}`, { sz: 9 })
    sc(ws, r, 4, score > 0 ? score : '—', {
      ha: 'center', bold: score > 0, bg: scoreColorL(score), fg: scoreColor(score),
    })
    sc(ws, r, 5, scoreName(score), { it: score === 0, fg: score === 0 ? C.grayM : C.black })
    sc(ws, r, 6, focusIndices.length, { ha: 'center' })
    sc(ws, r, 7, totalCount > 0 ? `${pctDone} %` : '—', {
      ha: 'center', bold: pctDone === 100,
      fg: pctDone === 100 ? C.green : pctDone >= 50 ? C.yellow : C.grayM,
    })
    ws.getRow(r).height = 15; r++
  }
  return ws
}

// ─── Sheet 4 : Plan d'actions ─────────────────────────────────────────────────

function buildActionsSheet(
  wb: ExcelJS.Workbook,
  scores: Record<string, number>,
  actionProgress: Record<string, number>,
  actionNa: Record<string, boolean>,
  notes: Record<string, string>,
) {
  const ws = wb.addWorksheet("Plan d'actions")
  ws.properties.tabColor = { argb: C.green }
  ws.columns = [
    { width: 26 }, { width: 9 }, { width: 46 }, { width: 11 }, { width: 15 }, { width: 40 },
  ]
  let r = 1

  titleRow(ws, r++, "Plan d'actions — Domaines prioritaires ISO 26000", 6, C.green)
  blank(ws, r++, 8)
  hdRow(ws, r++, ['Domaine', 'Score', 'Action prioritaire', 'Avancement', 'Statut', 'Note'], C.green)

  for (const phase of PHASES) {
    const domainsInPhase = DOMAINS.filter(d => d.phase === phase.id)
    if (domainsInPhase.length === 0) continue

    // Séparateur de phase
    merge(ws, r, 1, r, 6)
    ws.getCell(r, 1).value = `  Phase ${phase.id} — ${phase.label}`
    ws.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PHASE_COLORS[phase.id] } }
    ws.getCell(r, 1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.black } }
    ws.getCell(r, 1).alignment = { horizontal: 'left', vertical: 'middle' }
    ws.getRow(r).height = 16; r++

    for (const domain of domainsInPhase) {
      const score = scores[domain.id] ?? 0
      for (const actionIdx of domain.focusActionIndices) {
        const actionText = domain.actions[actionIdx] ?? ''
        const key = `${domain.id}_${actionIdx}`
        const progress = actionProgress[key] ?? 0
        const na = actionNa[key] ?? false
        const note = notes[key] ?? ''

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
        sc(ws, r, 2, score > 0 ? score : '—', {
          ha: 'center', bg: scoreColorL(score), fg: scoreColor(score), bold: score > 0,
        })
        sc(ws, r, 3, actionText, { wrap: true, sz: 9 })
        sc(ws, r, 4, progressStr, { ha: 'center', bold: progress >= 10, fg: na ? C.grayM : C.black })
        sc(ws, r, 5, statut, { ha: 'center', bg: statutBg, sz: 9 })
        sc(ws, r, 6, note || '', { wrap: true, sz: 8, it: !note, fg: note ? C.black : C.grayM })

        ws.getRow(r).height = note ? 38 : 20; r++
      }
    }
  }
  return ws
}

// ─── Sheet 5 : Analyse IA ────────────────────────────────────────────────────

function buildAnalyseSheet(wb: ExcelJS.Workbook, analysis: string) {
  const ws = wb.addWorksheet('Analyse IA')
  ws.properties.tabColor = { argb: C.purple }
  ws.columns = [{ width: 120 }]
  let r = 1

  titleRow(ws, r++, 'Analyse RSE par Intelligence Artificielle — Diagnostic Initial Guidé', 1, C.purple)
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
  return ws
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Auth
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    if (!await canRead(user.id, params.id)) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    // Charger le diagnostic
    const admin = createAdminClient()
    const { data: diag, error: diagErr } = await admin
      .from('guided_diagnostics')
      .select('id, organisation_id, year, scores, action_progress, action_na, ai_analysis')
      .eq('id', params.id)
      .single()

    if (diagErr || !diag) {
      return NextResponse.json({ error: 'Diagnostic introuvable' }, { status: 404 })
    }

    // Charger le nom d'organisation
    let orgName = 'Organisation'
    if (diag.organisation_id) {
      const { data: org } = await admin
        .from('organisations')
        .select('nom')
        .eq('id', diag.organisation_id)
        .single()
      if (org?.nom) orgName = org.nom
    }

    // Charger les notes
    const { data: notesRows } = await admin
      .from('guided_action_notes')
      .select('action_key, content')
      .eq('diagnostic_id', params.id)

    const notes: Record<string, string> = {}
    for (const row of (notesRows ?? [])) {
      notes[row.action_key] = row.content ?? ''
    }

    // Données du diagnostic
    const scores: Record<string, number> = (diag.scores as Record<string, number>) ?? {}
    const actionProgress: Record<string, number> = (diag.action_progress as Record<string, number>) ?? {}
    const actionNa: Record<string, boolean> = (diag.action_na as Record<string, boolean>) ?? {}
    const year: number = diag.year ?? new Date().getFullYear()
    const aiAnalysis: string | null = diag.ai_analysis ?? null

    // Calcul score moyen
    const evaluatedDomains = DOMAINS.filter(d => (scores[d.id] ?? 0) > 0)
    const avgScore = evaluatedDomains.length > 0
      ? evaluatedDomains.reduce((s, d) => s + (scores[d.id] ?? 0), 0) / evaluatedDomains.length
      : 0

    const exportDate = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
    })

    // Construction du workbook
    const wb = new ExcelJS.Workbook()
    wb.creator = "Sens'ethO Apps"
    wb.lastModifiedBy = "Sens'ethO Apps"
    wb.created = new Date()
    wb.modified = new Date()

    buildCouvertureSheet(wb, orgName, year, avgScore, evaluatedDomains.length, exportDate)
    buildSyntheseSheet(wb, scores)
    buildDomainesSheet(wb, scores, actionProgress, actionNa)
    buildActionsSheet(wb, scores, actionProgress, actionNa, notes)
    if (aiAnalysis) buildAnalyseSheet(wb, aiAnalysis)

    const buffer = await wb.xlsx.writeBuffer()

    const safeName = orgName.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').slice(0, 40)
    const filename = `Diagnostic-RSE-${safeName}-${year}.xlsx`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[export-excel] error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

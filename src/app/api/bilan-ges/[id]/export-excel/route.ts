/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/bilan-ges/[id]/export-excel
 * Génère un fichier Excel structuré du diagnostic Bilan GES (BEGES réglementaire).
 *
 * Onglets :
 *  1. Couverture         — org, année, score global, badge de maturité
 *  2. Tableau de bord    — scores par axe, progression
 *  3. Critères détaillés — 20 critères, niveau, commentaire
 *  4. Plan d'actions     — toutes les actions, statut, échéance
 *  5. Notes & Annexes    — documents SharePoint (métadonnées seulement)
 *  6. Correspondances    — liens ISO 26000, CSRD/ESRS E1, GRI 305, ODD, Bilan Carbone, GHG Protocol, ISO 14064-1, SNBC, SBTi, CDP
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─── Colors (palette bleu pétrole / cyan) ────────────────────────────────────
const C = {
  sky:     'FF0369A1', skyL:    'FFE0F2FE',
  green:   'FF16A34A', greenL:  'FFDCFCE7',
  red:     'FFDC2626', redL:    'FFFEE2E2',
  amber:   'FFD97706', amberL:  'FFFEF3C7',
  violet:  'FF7C3AED', violetL: 'FFEDE9FE',
  gray:    'FF6B7280', grayL:   'FFF3F4F6',
  white:   'FFFFFFFF', black:   'FF111827', border: 'FFE5E7EB',
}

const AXE_COLORS: Record<string, { h: string; l: string }> = {
  gouvernance: { h: C.sky,    l: C.skyL    },
  scope1:      { h: C.red,    l: C.redL    },
  scope2:      { h: C.amber,  l: C.amberL  },
  scope3:      { h: C.violet, l: C.violetL },
  plan:        { h: C.green,  l: C.greenL  },
}

type CS = { bg?: string; fg?: string; bold?: boolean; sz?: number; ha?: 'left'|'right'|'center'; it?: boolean; wrap?: boolean; indent?: number }

function sc(ws: ExcelJS.Worksheet, r: number, c: number, val: ExcelJS.CellValue, s: CS = {}) {
  const cell = ws.getCell(r, c)
  cell.value = val
  if (s.bg)     cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: s.bg } }
  if (s.bold || s.sz || s.fg || s.it) {
    cell.font = { ...(s.bold && { bold: true }), ...(s.sz && { size: s.sz }), ...(s.fg && { color: { argb: s.fg } }), ...(s.it && { italic: true }) }
  }
  cell.alignment = { horizontal: s.ha ?? 'left', vertical: 'middle', wrapText: s.wrap ?? false, indent: s.indent }
  cell.border = { top: { style: 'thin', color: { argb: C.border } }, bottom: { style: 'thin', color: { argb: C.border } }, left: { style: 'thin', color: { argb: C.border } }, right: { style: 'thin', color: { argb: C.border } } }
}

function merge(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number) {
  ws.mergeCells(r1, c1, r2, c2)
}

// ─── Données statiques Bilan GES ──────────────────────────────────────────────
const BILAN_GES_AXES = [
  { id: 'gouvernance', label: 'Gouvernance & Méthodologie',          icon: '🧭', weight: 0.20, criteres: [
    { id: 'ges-gov-organisation', label: 'Organisation et pilotage de la démarche bilan GES (référent, moyens, calendrier)' },
    { id: 'ges-gov-methode',      label: 'Choix et maîtrise de la méthode (Bilan Carbone ADEME, GHG Protocol, ISO 14064-1)' },
    { id: 'ges-gov-perimetre',    label: 'Définition des périmètres organisationnel et opérationnel' },
    { id: 'ges-gov-donnees',      label: "Qualité, traçabilité et collecte des données d'activité" },
  ]},
  { id: 'scope1', label: 'Scope 1 — Émissions directes',             icon: '🏭', weight: 0.20, criteres: [
    { id: 'ges-s1-combustion-fixe',   label: 'Émissions des sources fixes de combustion (chaudières, fours, groupes électrogènes)' },
    { id: 'ges-s1-combustion-mobile', label: 'Émissions des sources mobiles (flotte de véhicules, engins)' },
    { id: 'ges-s1-procedes',          label: 'Émissions directes des procédés hors énergie' },
    { id: 'ges-s1-fugitives',         label: 'Émissions fugitives (fluides frigorigènes, fuites, épandages)' },
  ]},
  { id: 'scope2', label: 'Scope 2 — Énergie indirecte',              icon: '⚡', weight: 0.20, criteres: [
    { id: 'ges-s2-electricite',   label: "Comptabilisation des émissions liées à l'électricité achetée" },
    { id: 'ges-s2-chaleur-froid', label: 'Comptabilisation chaleur/vapeur/froid achetés' },
    { id: 'ges-s2-approches',     label: 'Double approche location-based / market-based (contrats verts, GO)' },
    { id: 'ges-s2-efficacite',    label: "Plan d'efficacité énergétique et sobriété" },
  ]},
  { id: 'scope3', label: 'Scope 3 — Autres émissions indirectes',    icon: '🔗', weight: 0.20, criteres: [
    { id: 'ges-s3-achats',          label: 'Achats de biens et services (postes amont)' },
    { id: 'ges-s3-transport',       label: 'Fret amont/aval et déplacements (domicile-travail, professionnels)' },
    { id: 'ges-s3-immobilisations', label: 'Immobilisations, déchets, énergie amont' },
    { id: 'ges-s3-produits',        label: 'Usage et fin de vie des produits vendus' },
  ]},
  { id: 'plan', label: 'Plan de transition & Publication',           icon: '📈', weight: 0.20, criteres: [
    { id: 'ges-plan-objectifs',   label: 'Objectifs de réduction chiffrés et datés (cohérence SNBC / SBTi)' },
    { id: 'ges-plan-actions',     label: 'Plan de transition documenté avec actions, moyens et responsables' },
    { id: 'ges-plan-publication', label: 'Publication sur la plateforme ADEME (bilans-ges.ademe.fr) dans les délais' },
    { id: 'ges-plan-suivi',       label: 'Suivi annuel, mise à jour tous les 4 ans (3 ans secteur public) et amélioration continue' },
  ]},
]

const BILAN_GES_NIVEAUX = [
  { value: 0, label: 'Non traité', pct: 0    },
  { value: 1, label: 'Partiel',    pct: 0.25 },
  { value: 2, label: 'Estimé',     pct: 0.50 },
  { value: 3, label: 'Mesuré',     pct: 0.75 },
  { value: 4, label: 'Maîtrisé',   pct: 1.00 },
]

const BADGE_LEVELS = [
  { label: 'Démarche exemplaire', min: 85 },
  { label: 'Conforme BEGES',      min: 60 },
  { label: 'Bilan partiel',       min: 30 },
  { label: 'Non conforme',        min: 0  },
]

function calculateScore(niveaux: Record<string, number>): number {
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

// ─── Access check ─────────────────────────────────────────────────────────────
async function canAccess(userId: string, diagnosticId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data } = await admin.from('bilan_ges_diagnostics').select('user_id').eq('id', diagnosticId).single()
  return data?.user_id === userId
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createAdminClient()

    // Charger toutes les données
    const [diagRes, repRes, actRes] = await Promise.all([
      admin.from('bilan_ges_diagnostics').select('*, organisations(nom, siret, pays)').eq('id', params.id).single(),
      admin.from('bilan_ges_reponses').select('*').eq('diagnostic_id', params.id),
      admin.from('bilan_ges_actions').select('*').eq('diagnostic_id', params.id).order('created_at'),
    ])

    const diag = diagRes.data as any
    if (!diag) return NextResponse.json({ error: 'Diagnostic non trouvé' }, { status: 404 })

    const reponses: Record<string, number> = {}
    const commentaires: Record<string, string> = {}
    for (const r of (repRes.data ?? [])) {
      reponses[r.critere_id] = r.niveau
      if (r.commentaire) commentaires[r.critere_id] = r.commentaire
    }
    const actions = actRes.data ?? []

    const scoreGlobal = calculateScore(reponses)
    const badge = BADGE_LEVELS.find(b => scoreGlobal >= b.min)?.label ?? 'Non conforme'
    const org = diag.organisations as { nom?: string; siret?: string; pays?: string } | null
    const orgNom = org?.nom ?? 'Organisation'
    const dateExport = new Date().toLocaleDateString('fr-FR')

    // ─── Workbook ────────────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook()
    wb.creator = "Sens'ethO Apps — Bilan GES (BEGES réglementaire)"
    wb.created = new Date()

    // ─── Onglet 1 : Couverture ────────────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Couverture', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 40 }, { width: 25 }, { width: 25 }]
      ws.getRow(1).height = 20
      ws.getRow(2).height = 50

      merge(ws, 2, 2, 2, 4)
      sc(ws, 2, 2, "Bilan d'Émissions de Gaz à Effet de Serre (BEGES) — art. L229-25 / décret n°2022-982", { bg: C.sky, fg: C.white, bold: true, sz: 13, ha: 'center' })

      let row = 4
      for (const [label, val] of [
        ['Organisation', orgNom],
        ['SIRET', org?.siret ?? '—'],
        ['Pays', org?.pays ?? '—'],
        ['Année', String(diag.annee)],
        ['Date export', dateExport],
      ]) {
        sc(ws, row, 2, label, { bold: true, bg: C.grayL, fg: C.black })
        sc(ws, row, 3, val, { bg: C.white })
        row++
      }

      row++
      sc(ws, row, 2, 'Score de maturité Bilan GES', { bold: true, sz: 14, bg: C.sky, fg: C.white, ha: 'center' })
      sc(ws, row, 3, scoreGlobal, { bold: true, sz: 18, bg: C.sky, fg: C.white, ha: 'center' })
      sc(ws, row, 4, `/ 100 — ${badge}`, { bold: true, bg: C.sky, fg: C.white, ha: 'center' })
      ws.getRow(row).height = 35

      row += 2
      sc(ws, row, 2, 'Cadre réglementaire BEGES', { bold: true, sz: 11, bg: C.grayL })
      merge(ws, row, 2, row, 4)
      row++
      const legalLines = [
        "Article L229-25 du code de l'environnement : bilan d'émissions de gaz à effet de serre obligatoire",
        'Décret n°2022-982 du 1er juillet 2022 : émissions indirectes significatives (scope 3) et plan de transition obligatoires',
        'Méthode réglementaire V5 ADEME, cohérente avec Bilan Carbone, GHG Protocol et ISO 14064-1',
        "Obligés : entreprises > 500 salariés (250 en outre-mer), collectivités > 50 000 habitants, établissements publics > 250 agents, services de l'État",
        'Mise à jour tous les 4 ans (3 ans secteur public), publication sur bilans-ges.ademe.fr',
        "Sanction : amende jusqu'à 50 000 € (100 000 € en cas de récidive)",
        'Niveaux : NC (Non traité) → 1 (Partiel) → 2 (Estimé) → 3 (Mesuré) → 4 (Maîtrisé)',
      ]
      for (const line of legalLines) {
        sc(ws, row, 2, `• ${line}`, { sz: 9, bg: C.white, wrap: true, indent: 1 })
        merge(ws, row, 2, row, 4)
        ws.getRow(row).height = 25
        row++
      }
    }

    // ─── Onglet 2 : Tableau de bord ───────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Tableau de bord', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 35 }, { width: 12 }, { width: 18 }, { width: 20 }, { width: 18 }]

      sc(ws, 2, 2, 'Synthèse par axe du diagnostic Bilan GES', { bold: true, sz: 14, bg: C.sky, fg: C.white, ha: 'center' })
      merge(ws, 2, 2, 2, 6)
      ws.getRow(2).height = 30

      const headers = ['Axe', 'Poids', 'Score axe', 'Critères évalués', 'Niveau moyen']
      headers.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const axe of BILAN_GES_AXES) {
        const clr = AXE_COLORS[axe.id]
        const niveaux = axe.criteres.map(c => reponses[c.id] ?? 0)
        const pct = Math.round(niveaux.reduce((s, n) => s + (BILAN_GES_NIVEAUX[n]?.pct ?? 0), 0) / axe.criteres.length * 100)
        const renseignes = niveaux.filter(n => n > 0).length
        const moy = niveaux.reduce((s, n) => s + n, 0) / axe.criteres.length

        sc(ws, row, 2, `${axe.icon} ${axe.label}`, { bg: clr.l, bold: true, sz: 10 })
        sc(ws, row, 3, `${Math.round(axe.weight * 100)}%`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 4, `${pct}%`, { bg: clr.l, bold: true, ha: 'center', fg: pct >= 60 ? C.sky : pct >= 30 ? C.amber : C.red })
        sc(ws, row, 5, `${renseignes} / ${axe.criteres.length}`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 6, BILAN_GES_NIVEAUX[Math.round(moy)]?.label ?? 'Non traité', { bg: clr.l, ha: 'center' })
        ws.getRow(row).height = 22
        row++
      }

      row += 2
      sc(ws, row, 2, 'Résumé', { bold: true, sz: 12, bg: C.grayL })
      sc(ws, row, 3, `Score global : ${scoreGlobal}/100 — ${badge}`, { bold: true, bg: C.skyL, fg: C.sky })
      merge(ws, row, 3, row, 6)
      ws.getRow(row).height = 22
    }

    // ─── Onglet 3 : Critères détaillés ───────────────────────────────────────
    {
      const ws = wb.addWorksheet('Critères détaillés', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 28 }, { width: 45 }, { width: 18 }, { width: 12 }, { width: 50 }]

      sc(ws, 2, 2, 'Détail par critère — Diagnostic Bilan GES', { bold: true, sz: 14, bg: C.sky, fg: C.white })
      merge(ws, 2, 2, 2, 6)
      ws.getRow(2).height = 30

      const hdrs = ['Axe', 'Critère', 'Niveau', 'Score (%)', 'Commentaire']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const axe of BILAN_GES_AXES) {
        const clr = AXE_COLORS[axe.id]
        for (const c of axe.criteres) {
          const n = reponses[c.id] ?? 0
          const niv = BILAN_GES_NIVEAUX[n]
          const pct = Math.round((niv?.pct ?? 0) * 100)
          sc(ws, row, 2, `${axe.icon} ${axe.label}`, { bg: clr.l, sz: 9 })
          sc(ws, row, 3, c.label, { bg: C.white, sz: 9 })
          sc(ws, row, 4, niv?.label ?? 'Non traité', { bg: C.white, ha: 'center', sz: 9, bold: n > 0 })
          sc(ws, row, 5, pct === 0 ? '—' : `${pct}%`, { bg: C.white, ha: 'center', sz: 9, fg: pct >= 75 ? C.sky : pct >= 50 ? C.amber : C.red })
          sc(ws, row, 6, commentaires[c.id] ?? '—', { bg: C.white, sz: 8, wrap: true, indent: 1 })
          ws.getRow(row).height = commentaires[c.id] ? 30 : 18
          row++
        }
      }
    }

    // ─── Onglet 4 : Plan d'actions ────────────────────────────────────────────
    {
      const ws = wb.addWorksheet("Plan d'actions", { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 25 }, { width: 30 }, { width: 11 }, { width: 12 }, { width: 14 }, { width: 16 }, { width: 40 }]

      sc(ws, 2, 2, "Plan d'actions — Diagnostic Bilan GES", { bold: true, sz: 14, bg: C.sky, fg: C.white })
      merge(ws, 2, 2, 2, 8)
      ws.getRow(2).height = 30

      const hdrs = ['Axe', 'Action', 'Priorité', 'Statut', 'Échéance', 'Responsable', 'Description']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      const STATUT_LABELS: Record<string, string> = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' }
      const PRIORITE_LABELS: Record<string, string> = { haute: '🔴 Haute', moyenne: '🟡 Moyenne', basse: '🟢 Basse' }

      for (const a of actions as any[]) {
        const axe = BILAN_GES_AXES.find(x => x.criteres.some(c => c.id === a.critere_id))
        const clr = axe ? (AXE_COLORS[axe.id] ?? { l: C.grayL }) : { l: C.grayL }
        const statBg = a.statut === 'termine' ? C.skyL : a.statut === 'en_cours' ? C.amberL : C.grayL

        sc(ws, row, 2, axe ? `${axe.icon} ${axe.label}` : a.critere_id, { bg: clr.l, sz: 9 })
        sc(ws, row, 3, a.titre, { bg: C.white, sz: 9, bold: true })
        sc(ws, row, 4, PRIORITE_LABELS[a.priorite] ?? a.priorite, { bg: C.white, ha: 'center', sz: 9 })
        sc(ws, row, 5, STATUT_LABELS[a.statut] ?? a.statut, { bg: statBg, ha: 'center', sz: 9 })
        sc(ws, row, 6, a.echeance ?? '—', { bg: C.white, ha: 'center', sz: 9 })
        sc(ws, row, 7, a.responsable ?? '—', { bg: C.white, ha: 'center', sz: 9 })
        sc(ws, row, 8, a.description ?? '—', { bg: C.white, sz: 8, wrap: true })
        ws.getRow(row).height = 20
        row++
      }

      if (actions.length === 0) {
        sc(ws, 5, 2, 'Aucune action créée', { it: true, fg: C.gray, ha: 'center' })
        merge(ws, 5, 2, 5, 8)
      }
    }

    // ─── Onglet 5 : Notes & Annexes ───────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Notes & Annexes', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 30 }, { width: 20 }]

      sc(ws, 2, 2, 'Notes & Documents', { bold: true, sz: 14, bg: C.sky, fg: C.white })
      merge(ws, 2, 2, 2, 3)
      ws.getRow(2).height = 30

      sc(ws, 3, 2, 'Note : Les documents sont stockés dans SharePoint. Accédez aux URLs de téléchargement depuis l\'application.', { it: true, fg: C.gray, sz: 9 })
      merge(ws, 3, 2, 3, 3)

      sc(ws, 5, 2, 'Consultez l\'application pour accéder aux pièces jointes par critère.', { it: true, fg: C.gray, sz: 10 })
      merge(ws, 5, 2, 5, 3)
    }

    // ─── Onglet 6 : Correspondances ───────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Correspondances', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 30 }, { width: 30 }, { width: 60 }]

      sc(ws, 2, 2, 'Correspondances avec les référentiels — Bilan GES', { bold: true, sz: 13, bg: C.sky, fg: C.white })
      merge(ws, 2, 2, 2, 4)
      ws.getRow(2).height = 28

      const hdrs = ['Référentiel', 'Axe Bilan GES', 'Correspondance']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      const correspondances = [
        { ref: 'BEGES réglementaire (art. L229-25)', axe: 'Tous les axes', corr: "Format réglementaire V5 ADEME : périmètres, 6 catégories et 22 postes d'émissions, plan de transition, publication sur bilans-ges.ademe.fr" },
        { ref: 'Bilan Carbone — ADEME / ABC', axe: 'Gouvernance & Méthodologie', corr: 'Méthode française de référence pour la comptabilité carbone complète, compatible avec le format réglementaire BEGES' },
        { ref: 'GHG Protocol', axe: 'Scope 2 / Scope 3', corr: 'Corporate Standard, Scope 2 Guidance (location-based / market-based) et Corporate Value Chain (Scope 3) Standard — 15 catégories' },
        { ref: 'ISO 14064-1', axe: 'Gouvernance & Méthodologie', corr: 'Norme internationale de quantification et de déclaration des émissions de GES au niveau de l\'organisation, base des vérifications tierce partie' },
        { ref: 'SNBC', axe: 'Plan de transition & Publication', corr: 'Stratégie Nationale Bas-Carbone : trajectoires sectorielles et budgets carbone, cadre de cohérence des objectifs de réduction' },
        { ref: 'SBTi — Science Based Targets', axe: 'Plan de transition & Publication', corr: "Validation scientifique des objectifs de réduction alignés 1,5°C ; objectif scope 3 requis lorsqu'il dépasse 40% des émissions totales" },
        { ref: 'CDP Climate Change', axe: 'Tous les axes', corr: 'Questionnaire climat international (notation A à D-) : gouvernance, émissions scopes 1-2-3, objectifs et plan de transition' },
        { ref: 'CSRD — ESRS E1 Climat', axe: 'Tous les axes', corr: 'ESRS E1 : publication des émissions GES scopes 1, 2, 3 (E1-6), objectifs de réduction (E1-4) et plan de transition climatique (E1-1)' },
        { ref: 'GRI Standards — GRI 305', axe: 'Scope 1 / Scope 2 / Scope 3', corr: 'GRI 305-1 (émissions directes), 305-2 (indirectes énergie), 305-3 (autres indirectes), 305-4 (intensité), 305-5 (réductions)' },
        { ref: 'ISO 26000', axe: 'Gouvernance & Méthodologie', corr: "Question centrale Environnement — domaine d'action 6.5.5 : atténuation des changements climatiques et adaptation" },
        { ref: 'ODD 7, 12 et 13', axe: 'Tous les axes', corr: 'ODD 7 (énergie propre et abordable), ODD 12 (consommation et production responsables), ODD 13 (action climatique)' },
        { ref: 'ACT Bas-Carbone — ADEME/CDP', axe: 'Plan de transition & Publication', corr: "Le bilan GES est la donnée d'entrée de l'évaluation ACT, qui mesure l'alignement de la stratégie avec une trajectoire bas-carbone" },
      ]

      let row = 5
      for (const c of correspondances) {
        sc(ws, row, 2, c.ref, { bg: C.white, sz: 9, bold: true })
        sc(ws, row, 3, c.axe, { bg: C.skyL, sz: 9 })
        sc(ws, row, 4, c.corr, { bg: C.white, sz: 8, wrap: true })
        ws.getRow(row).height = 22
        row++
      }
    }

    // ─── Export ───────────────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer()
    const filename = `Bilan_GES_${orgNom.replace(/[^a-z0-9]/gi, '_')}_${diag.annee}.xlsx`

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('[bilan-ges/export-excel]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

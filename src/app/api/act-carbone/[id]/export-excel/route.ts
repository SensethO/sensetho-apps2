/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/act-carbone/[id]/export-excel
 * Génère un fichier Excel structuré du diagnostic ACT Bas-Carbone (ADEME/CDP).
 *
 * Onglets :
 *  1. Couverture         — org, année, score global, badge de maturité
 *  2. Tableau de bord    — scores par axe, progression
 *  3. Critères détaillés — 20 critères, niveau, commentaire
 *  4. Plan d'actions     — toutes les actions, statut, échéance
 *  5. Notes & Annexes    — documents SharePoint (métadonnées seulement)
 *  6. Correspondances    — liens ISO 26000, CSRD ESRS E1, GRI 305, ODD 13, SBTi, CDP
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─── Colors ──────────────────────────────────────────────────────────────────
const C = {
  green:   'FF16A34A', greenL:  'FFDCFCE7',
  orange:  'FFEA580C', orangeL: 'FFFFEDD5',
  blue:    'FF2563EB', blueL:   'FFDBEAFE',
  purple:  'FF7C3AED', purpleL: 'FFEDE9FE',
  cyan:    'FF0891B2', cyanL:   'FFE0F2FE',
  gray:    'FF6B7280', grayL:   'FFF3F4F6',
  white:   'FFFFFFFF', black:   'FF111827', border: 'FFE5E7EB',
  red:     'FFDC2626', redL:    'FFFEE2E2',
  amber:   'FFD97706', amberL:  'FFFEF9C3',
}

const AXE_COLORS: Record<string, { h: string; l: string }> = {
  ambition:      { h: C.green,  l: C.greenL  },
  mesure:        { h: C.blue,   l: C.blueL   },
  reduction:     { h: C.orange, l: C.orangeL },
  engagement:    { h: C.purple, l: C.purpleL },
  neutralite:    { h: C.cyan,   l: C.cyanL   },
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

// ─── Données statiques ACT Bas-Carbone ───────────────────────────────────────
const ACT_CARBONE_AXES = [
  { id: 'ambition',   label: 'Ambition climatique',          icon: '🎯', weight: 0.20, criteres: [
    { id: 'act-amb-objectifs',   label: 'Objectifs de réduction GES alignés sur la science (SBTi)' },
    { id: 'act-amb-netzero',     label: 'Trajectoire Net-Zéro et neutralité carbone long terme' },
    { id: 'act-amb-gouvernance', label: 'Gouvernance climatique et pilotage au plus haut niveau' },
    { id: 'act-amb-strategie',   label: 'Intégration dans la stratégie et le modèle d\'affaires' },
  ]},
  { id: 'mesure',     label: 'Mesure & Reporting',           icon: '📊', weight: 0.20, criteres: [
    { id: 'act-mes-scope12',     label: 'Bilan GES Scopes 1 et 2 — mesure et maîtrise' },
    { id: 'act-mes-scope3',      label: 'Émissions Scope 3 — chaîne de valeur amont et aval' },
    { id: 'act-mes-reporting',   label: 'Reporting climatique et transparence (CDP, CSRD, GRI)' },
    { id: 'act-mes-verification', label: 'Vérification externe des données GES' },
  ]},
  { id: 'reduction',  label: 'Réduction des émissions',      icon: '⚡', weight: 0.20, criteres: [
    { id: 'act-red-energie',     label: 'Efficacité énergétique et transition vers les énergies renouvelables' },
    { id: 'act-red-procedes',    label: 'Décarbonation des procédés industriels et opérations' },
    { id: 'act-red-scope3act',   label: 'Réduction active des émissions Scope 3' },
    { id: 'act-red-innovation',  label: 'Innovation bas-carbone et R&D décarbonation' },
  ]},
  { id: 'engagement', label: 'Engagement & Transition',      icon: '🤝', weight: 0.20, criteres: [
    { id: 'act-eng-fournisseurs',   label: 'Engagement fournisseurs et achats bas-carbone' },
    { id: 'act-eng-collaborateurs', label: 'Mobilisation et formation des collaborateurs' },
    { id: 'act-eng-finance',        label: 'Plan de financement de la transition et finance durable' },
    { id: 'act-eng-partenaires',    label: 'Dialogue parties prenantes et contribution territoriale' },
  ]},
  { id: 'neutralite', label: 'Compensation & Neutralité',    icon: '🌱', weight: 0.20, criteres: [
    { id: 'act-neu-sequestration', label: 'Séquestration carbone et puits naturels' },
    { id: 'act-neu-compensation',  label: 'Compensation carbone certifiée et crédible' },
    { id: 'act-neu-biodiversite',  label: 'Préservation des écosystèmes et co-bénéfices biodiversité' },
    { id: 'act-neu-neutralite',    label: 'Trajectoire crédible vers la neutralité carbone 2050' },
  ]},
]

const ACT_CARBONE_NIVEAUX = [
  { value: 0, label: 'Non initié',        pct: 0    },
  { value: 1, label: 'Sensibilisé',       pct: 0.25 },
  { value: 2, label: 'Planifié',          pct: 0.50 },
  { value: 3, label: 'En transition',     pct: 0.75 },
  { value: 4, label: 'Leader climatique', pct: 1.00 },
]

const BADGE_LEVELS = [
  { label: 'Leader climatique', min: 85 },
  { label: 'En transition',     min: 60 },
  { label: 'Planifié',          min: 30 },
  { label: 'Non initié',        min: 0  },
]

function calculateScore(niveaux: Record<string, number>): number {
  let total = 0
  for (const axe of ACT_CARBONE_AXES) {
    let axeScore = 0
    const nb = axe.criteres.length
    for (const c of axe.criteres) {
      const n = niveaux[c.id] ?? 0
      axeScore += (ACT_CARBONE_NIVEAUX[n]?.pct ?? 0) / nb
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
  const { data } = await admin.from('act_carbone_diagnostics').select('user_id').eq('id', diagnosticId).single()
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
      admin.from('act_carbone_diagnostics').select('*, organisations(nom, siret, pays)').eq('id', params.id).single(),
      admin.from('act_carbone_reponses').select('*').eq('diagnostic_id', params.id),
      admin.from('act_carbone_actions').select('*').eq('diagnostic_id', params.id).order('created_at'),
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
    const badge = BADGE_LEVELS.find(b => scoreGlobal >= b.min)?.label ?? 'Non initié'
    const org = diag.organisations as { nom?: string; siret?: string; pays?: string } | null
    const orgNom = org?.nom ?? 'Organisation'
    const dateExport = new Date().toLocaleDateString('fr-FR')

    // ─── Workbook ────────────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook()
    wb.creator = "Sens'ethO Apps — ACT Bas-Carbone Diagnostic"
    wb.created = new Date()

    // ─── Onglet 1 : Couverture ────────────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Couverture', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 40 }, { width: 25 }, { width: 25 }]
      ws.getRow(1).height = 20
      ws.getRow(2).height = 50

      merge(ws, 2, 2, 2, 4)
      sc(ws, 2, 2, 'ACT Bas-Carbone — Démarche ADEME/CDP Accelerate Climate Transition', { bg: C.green, fg: C.white, bold: true, sz: 13, ha: 'center' })

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
      sc(ws, row, 2, 'Score de maturité climatique ACT', { bold: true, sz: 14, bg: C.green, fg: C.white, ha: 'center' })
      sc(ws, row, 3, scoreGlobal, { bold: true, sz: 18, bg: C.green, fg: C.white, ha: 'center' })
      sc(ws, row, 4, `/ 100 — ${badge}`, { bold: true, bg: C.green, fg: C.white, ha: 'center' })
      ws.getRow(row).height = 35

      row += 2
      sc(ws, row, 2, 'Cadre de référence ACT', { bold: true, sz: 11, bg: C.grayL })
      merge(ws, row, 2, row, 4)
      row++
      const legalLines = [
        'Démarche ACT (Accelerate Climate Transition) — initiative ADEME et CDP',
        'Alignement avec les Accords de Paris : trajectoire de limitation du réchauffement à 1,5°C',
        'Compatible Science Based Targets initiative (SBTi) et Net-Zero Standard',
        'Reporting CSRD/ESRS E1 — Changement climatique, GRI 305, CDP Climate',
        'Niveaux : NC (Non initié) → 1 (Sensibilisé) → 2 (Planifié) → 3 (En transition) → 4 (Leader)',
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

      sc(ws, 2, 2, 'Synthèse par axe du diagnostic ACT Bas-Carbone', { bold: true, sz: 14, bg: C.green, fg: C.white, ha: 'center' })
      merge(ws, 2, 2, 2, 6)
      ws.getRow(2).height = 30

      const headers = ['Axe', 'Poids', 'Score axe', 'Critères évalués', 'Niveau moyen']
      headers.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const axe of ACT_CARBONE_AXES) {
        const clr = AXE_COLORS[axe.id]
        const niveaux = axe.criteres.map(c => reponses[c.id] ?? 0)
        const pct = Math.round(niveaux.reduce((s, n) => s + (ACT_CARBONE_NIVEAUX[n]?.pct ?? 0), 0) / axe.criteres.length * 100)
        const renseignes = niveaux.filter(n => n > 0).length
        const moy = niveaux.reduce((s, n) => s + n, 0) / axe.criteres.length

        sc(ws, row, 2, `${axe.icon} ${axe.label}`, { bg: clr.l, bold: true, sz: 10 })
        sc(ws, row, 3, `${Math.round(axe.weight * 100)}%`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 4, `${pct}%`, { bg: clr.l, bold: true, ha: 'center', fg: pct >= 60 ? C.green : pct >= 30 ? C.amber : C.red })
        sc(ws, row, 5, `${renseignes} / ${axe.criteres.length}`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 6, ACT_CARBONE_NIVEAUX[Math.round(moy)]?.label ?? 'Non initié', { bg: clr.l, ha: 'center' })
        ws.getRow(row).height = 22
        row++
      }

      row += 2
      sc(ws, row, 2, 'Résumé', { bold: true, sz: 12, bg: C.grayL })
      sc(ws, row, 3, `Score global : ${scoreGlobal}/100 — ${badge}`, { bold: true, bg: C.greenL, fg: C.green })
      merge(ws, row, 3, row, 6)
      ws.getRow(row).height = 22
    }

    // ─── Onglet 3 : Critères détaillés ───────────────────────────────────────
    {
      const ws = wb.addWorksheet('Critères détaillés', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 28 }, { width: 45 }, { width: 18 }, { width: 12 }, { width: 50 }]

      sc(ws, 2, 2, 'Détail par critère — Diagnostic ACT Bas-Carbone', { bold: true, sz: 14, bg: C.green, fg: C.white })
      merge(ws, 2, 2, 2, 6)
      ws.getRow(2).height = 30

      const hdrs = ['Axe', 'Critère', 'Niveau', 'Score (%)', 'Commentaire']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const axe of ACT_CARBONE_AXES) {
        const clr = AXE_COLORS[axe.id]
        for (const c of axe.criteres) {
          const n = reponses[c.id] ?? 0
          const niv = ACT_CARBONE_NIVEAUX[n]
          const pct = Math.round((niv?.pct ?? 0) * 100)
          sc(ws, row, 2, `${axe.icon} ${axe.label}`, { bg: clr.l, sz: 9 })
          sc(ws, row, 3, c.label, { bg: C.white, sz: 9 })
          sc(ws, row, 4, niv?.label ?? 'Non initié', { bg: C.white, ha: 'center', sz: 9, bold: n > 0 })
          sc(ws, row, 5, pct === 0 ? '—' : `${pct}%`, { bg: C.white, ha: 'center', sz: 9, fg: pct >= 75 ? C.green : pct >= 50 ? C.amber : C.red })
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

      sc(ws, 2, 2, "Plan d'actions — Diagnostic ACT Bas-Carbone", { bold: true, sz: 14, bg: C.green, fg: C.white })
      merge(ws, 2, 2, 2, 8)
      ws.getRow(2).height = 30

      const hdrs = ['Axe', 'Action', 'Priorité', 'Statut', 'Échéance', 'Responsable', 'Description']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      const STATUT_LABELS: Record<string, string> = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' }
      const PRIORITE_LABELS: Record<string, string> = { haute: '🔴 Haute', moyenne: '🟡 Moyenne', basse: '🟢 Basse' }

      for (const a of actions as any[]) {
        const axe = ACT_CARBONE_AXES.find(x => x.criteres.some(c => c.id === a.critere_id))
        const clr = axe ? (AXE_COLORS[axe.id] ?? { l: C.grayL }) : { l: C.grayL }
        const statBg = a.statut === 'termine' ? C.greenL : a.statut === 'en_cours' ? C.blueL : C.grayL

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

      sc(ws, 2, 2, 'Notes & Documents', { bold: true, sz: 14, bg: C.green, fg: C.white })
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

      sc(ws, 2, 2, 'Correspondances avec les référentiels — ACT Bas-Carbone', { bold: true, sz: 13, bg: C.green, fg: C.white })
      merge(ws, 2, 2, 2, 4)
      ws.getRow(2).height = 28

      const hdrs = ['Référentiel', 'Axe ACT', 'Correspondance']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      const correspondances = [
        { ref: 'Démarche ACT ADEME/CDP', axe: 'Tous les axes', corr: 'Accelerate Climate Transition (ACT) — méthode sectorielle ADEME/CDP de pilotage de la transition bas-carbone' },
        { ref: 'SBTi — Science Based Targets', axe: 'Ambition climatique', corr: 'Science Based Targets initiative — validation des objectifs de réduction GES alignés 1,5°C (Net-Zero Standard)' },
        { ref: 'CSRD — ESRS E1', axe: 'Mesure & Reporting', corr: 'ESRS E1 — Changement climatique : bilan GES Scopes 1-2-3, trajectoire de réduction, risques TCFD' },
        { ref: 'GRI 305 — Émissions', axe: 'Mesure & Reporting', corr: 'GRI 305 — Émissions : Scope 1 (305-1), Scope 2 (305-2), Scope 3 (305-3), intensité GES (305-4)' },
        { ref: 'CDP Climate Change', axe: 'Mesure & Reporting', corr: 'CDP Climate Change — questionnaire de reporting climatique, notation A-D, alignement secteurs' },
        { ref: 'Accord de Paris — 1,5°C', axe: 'Ambition climatique', corr: 'Accord de Paris (2015) — objectif de limitation du réchauffement à 1,5°C : trajectoire de référence pour les SBTi' },
        { ref: 'ISO 14064 / ISO 14068', axe: 'Mesure & Reporting', corr: 'ISO 14064 — Quantification et déclaration des GES. ISO 14068 — Neutralité carbone (définition crédible)' },
        { ref: 'ISO 26000 — DA3.4/DA3.6/DA7.1', axe: 'Engagement & Transition', corr: 'ISO 26000 : DA3.4 Environnement (atténuation CC), DA3.6 Consommation durable, DA7.1 Droits de l\'Homme chaîne valeur' },
        { ref: 'Bilan Carbone® ADEME', axe: 'Mesure & Reporting', corr: 'Méthode Bilan Carbone® (ADEME) — outil de référence pour quantifier les GES et élaborer un plan de réduction' },
        { ref: 'ODD 13 — Lutte contre les CC', axe: 'Tous les axes', corr: 'Objectif de Développement Durable 13 — Prendre d\'urgence des mesures pour lutter contre les changements climatiques' },
        { ref: 'EU Taxonomy — Objectif 1', axe: 'Financement transition', corr: 'Taxonomie européenne — Objectif 1 : atténuation du changement climatique. Green bonds, prêts verts' },
        { ref: 'TCFD — Task Force Climat', axe: 'Ambition climatique', corr: 'TCFD (désormais intégré dans IFRS S2/CSRD) — gouvernance, stratégie, gestion des risques, indicateurs climatiques' },
      ]

      let row = 5
      for (const c of correspondances) {
        sc(ws, row, 2, c.ref, { bg: C.white, sz: 9, bold: true })
        sc(ws, row, 3, c.axe, { bg: C.greenL, sz: 9 })
        sc(ws, row, 4, c.corr, { bg: C.white, sz: 8, wrap: true })
        ws.getRow(row).height = 22
        row++
      }
    }

    // ─── Export ───────────────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer()
    const filename = `ACT_Carbone_${orgNom.replace(/[^a-z0-9]/gi, '_')}_${diag.annee}.xlsx`

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('[act-carbone/export-excel]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

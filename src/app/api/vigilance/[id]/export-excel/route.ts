/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/vigilance/[id]/export-excel
 * Génère un fichier Excel structuré du Plan de Vigilance (loi n°2017-399).
 *
 * Onglets :
 *  1. Couverture         — org, année, score global, badge de maturité
 *  2. Tableau de bord    — scores par axe, progression
 *  3. Critères détaillés — 20 critères, niveau, commentaire
 *  4. Plan d'actions     — toutes les actions, statut, échéance
 *  5. Notes & Annexes    — documents SharePoint (métadonnées seulement)
 *  6. Correspondances    — liens ISO 26000, CSRD, UN GPBHR, OCDE, GRI
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─── Colors ──────────────────────────────────────────────────────────────────
const C = {
  red:     'FFDC2626', redL:    'FFFEE2E2',
  orange:  'FFEA580C', orangeL: 'FFFFEDD5',
  green:   'FF16A34A', greenL:  'FFDCFCE7',
  purple:  'FF7C3AED', purpleL: 'FFEDE9FE',
  blue:    'FF2563EB', blueL:   'FFDBEAFE',
  gray:    'FF6B7280', grayL:   'FFF3F4F6',
  white:   'FFFFFFFF', black:   'FF111827', border: 'FFE5E7EB',
  emerald: 'FF16A34A', emeraldL: 'FFD1FAE5',
  amber:   'FFF59E0B',
}

const AXE_COLORS: Record<string, { h: string; l: string }> = {
  carto:   { h: C.red,    l: C.redL    },
  eval:    { h: C.orange, l: C.orangeL },
  actions: { h: C.green,  l: C.greenL  },
  alerte:  { h: C.purple, l: C.purpleL },
  suivi:   { h: C.blue,   l: C.blueL   },
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

// ─── Données statiques ────────────────────────────────────────────────────────
const VIGILANCE_AXES = [
  { id: 'carto',   label: 'Cartographie des risques', icon: '🗺️', weight: 0.20, criteres: [
    { id: 'carto-identification', label: 'Identification des risques' },
    { id: 'carto-perimetre',      label: 'Périmètre de la cartographie' },
    { id: 'carto-priorisation',   label: 'Priorisation des risques' },
    { id: 'carto-maj',            label: 'Actualisation régulière' },
  ]},
  { id: 'eval',    label: 'Évaluation des acteurs',   icon: '🔍', weight: 0.20, criteres: [
    { id: 'eval-filiales',     label: 'Évaluation des filiales' },
    { id: 'eval-fournisseurs', label: 'Évaluation des fournisseurs directs' },
    { id: 'eval-soustraitants',label: 'Évaluation des sous-traitants' },
    { id: 'eval-methode',      label: "Méthodes et critères d'évaluation" },
  ]},
  { id: 'actions', label: "Actions d'atténuation",    icon: '⚡', weight: 0.20, criteres: [
    { id: 'actions-politiques', label: 'Politiques et engagements internes' },
    { id: 'actions-formation',  label: 'Formation et sensibilisation' },
    { id: 'actions-clauses',    label: 'Clauses contractuelles' },
    { id: 'actions-correctifs', label: "Plans d'actions correctifs" },
  ]},
  { id: 'alerte',  label: "Mécanisme d'alerte",       icon: '🔔', weight: 0.20, criteres: [
    { id: 'alerte-existence',    label: 'Existence du dispositif' },
    { id: 'alerte-accessibilite',label: 'Accessibilité et visibilité' },
    { id: 'alerte-traitement',   label: 'Traitement et suivi des alertes' },
    { id: 'alerte-lanceurs',     label: 'Protection des lanceurs d\'alerte' },
  ]},
  { id: 'suivi',   label: 'Dispositif de suivi',      icon: '📊', weight: 0.20, criteres: [
    { id: 'suivi-indicateurs', label: 'Indicateurs de performance (KPI)' },
    { id: 'suivi-gouvernance', label: 'Gouvernance du plan' },
    { id: 'suivi-reporting',   label: 'Publication et transparence' },
    { id: 'suivi-integration', label: 'Intégration dans le rapport de gestion' },
  ]},
]

const VIGILANCE_NIVEAUX = [
  { value: 0, label: 'Non conforme',    pct: 0    },
  { value: 1, label: 'Initial',          pct: 0.25 },
  { value: 2, label: 'En développement', pct: 0.50 },
  { value: 3, label: 'Appliqué',         pct: 0.75 },
  { value: 4, label: 'Leader',           pct: 1.00 },
]

const BADGE_LEVELS = [
  { label: 'Exemplaire',      min: 85 },
  { label: 'Conforme',        min: 60 },
  { label: 'En développement', min: 30 },
  { label: 'Insuffisant',     min: 0  },
]

function calculateScore(niveaux: Record<string, number>): number {
  let total = 0
  for (const axe of VIGILANCE_AXES) {
    let axeScore = 0
    const nb = axe.criteres.length
    for (const c of axe.criteres) {
      const n = niveaux[c.id] ?? 0
      axeScore += (VIGILANCE_NIVEAUX[n]?.pct ?? 0) / nb
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
  const { data } = await admin.from('vigilance_diagnostics').select('user_id').eq('id', diagnosticId).single()
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
      admin.from('vigilance_diagnostics').select('*, organisations(denomination, siret_siege, ville)').eq('id', params.id).single(),
      admin.from('vigilance_reponses').select('*').eq('diagnostic_id', params.id),
      admin.from('vigilance_actions').select('*').eq('diagnostic_id', params.id).order('created_at'),
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
    const badge = BADGE_LEVELS.find(b => scoreGlobal >= b.min)?.label ?? 'Insuffisant'
    const org = diag.organisations as { denomination?: string; siret_siege?: string; ville?: string } | null
    const orgNom = org?.denomination ?? 'Organisation'
    const dateExport = new Date().toLocaleDateString('fr-FR')

    // ─── Workbook ────────────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook()
    wb.creator = "Sens'ethO Apps — Devoir de Vigilance"
    wb.created = new Date()

    // ─── Onglet 1 : Couverture ────────────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Couverture', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 40 }, { width: 25 }, { width: 25 }]
      ws.getRow(1).height = 20
      ws.getRow(2).height = 50

      merge(ws, 2, 2, 2, 4)
      sc(ws, 2, 2, 'Devoir de Vigilance — Loi n°2017-399', { bg: C.red, fg: C.white, bold: true, sz: 16, ha: 'center' })

      let row = 4
      for (const [label, val] of [
        ['Organisation', orgNom],
        ['SIRET', org?.siret_siege ?? '—'],
        ['Ville', org?.ville ?? '—'],
        ['Année', String(diag.annee)],
        ['Date export', dateExport],
      ]) {
        sc(ws, row, 2, label, { bold: true, bg: C.grayL, fg: C.black })
        sc(ws, row, 3, val, { bg: C.white })
        row++
      }

      row++
      sc(ws, row, 2, 'Score de maturité global', { bold: true, sz: 14, bg: C.red, fg: C.white, ha: 'center' })
      sc(ws, row, 3, scoreGlobal, { bold: true, sz: 18, bg: C.red, fg: C.white, ha: 'center' })
      sc(ws, row, 4, `/ 100 — ${badge}`, { bold: true, bg: C.red, fg: C.white, ha: 'center' })
      ws.getRow(row).height = 35

      row += 2
      sc(ws, row, 2, 'Cadre légal', { bold: true, sz: 11, bg: C.grayL })
      merge(ws, row, 2, row, 4)
      row++
      const legalLines = [
        'Loi n°2017-399 du 27 mars 2017 relative au devoir de vigilance des sociétés mères et donneurs d\'ordre',
        'Entreprises concernées : >5 000 salariés en France OU >10 000 salariés dans le monde (filiales incluses)',
        'Sanctions : injonction judiciaire + amende jusqu\'à 10 M€ (30 M€ en cas de manquement avéré causant un dommage)',
        'Contenu obligatoire : 5 axes — Cartographie, Évaluation, Actions, Alerte, Suivi',
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
      ws.columns = [{ width: 4 }, { width: 30 }, { width: 12 }, { width: 18 }, { width: 20 }, { width: 16 }]

      sc(ws, 2, 2, 'Synthèse par axe du plan de vigilance', { bold: true, sz: 14, bg: C.red, fg: C.white, ha: 'center' })
      merge(ws, 2, 2, 2, 6)
      ws.getRow(2).height = 30

      const headers = ['Axe', 'Poids', 'Score axe', 'Critères évalués', 'Niveau moyen']
      headers.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const axe of VIGILANCE_AXES) {
        const clr = AXE_COLORS[axe.id]
        const niveaux = axe.criteres.map(c => reponses[c.id] ?? 0)
        const pct = Math.round(niveaux.reduce((s, n) => s + (VIGILANCE_NIVEAUX[n]?.pct ?? 0), 0) / axe.criteres.length * 100)
        const renseignes = niveaux.filter(n => n > 0).length
        const moy = niveaux.reduce((s, n) => s + n, 0) / axe.criteres.length

        sc(ws, row, 2, `${axe.icon} ${axe.label}`, { bg: clr.l, bold: true, sz: 10 })
        sc(ws, row, 3, `${Math.round(axe.weight * 100)}%`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 4, `${pct}%`, { bg: clr.l, bold: true, ha: 'center', fg: pct >= 60 ? C.green : pct >= 30 ? C.amber : C.red })
        sc(ws, row, 5, `${renseignes} / ${axe.criteres.length}`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 6, VIGILANCE_NIVEAUX[Math.round(moy)]?.label ?? 'Non conforme', { bg: clr.l, ha: 'center' })
        ws.getRow(row).height = 22
        row++
      }

      row += 2
      sc(ws, row, 2, 'Résumé', { bold: true, sz: 12, bg: C.grayL })
      sc(ws, row, 3, `Score global : ${scoreGlobal}/100 — ${badge}`, { bold: true, bg: C.redL, fg: C.red })
      merge(ws, row, 3, row, 6)
      ws.getRow(row).height = 22
    }

    // ─── Onglet 3 : Critères détaillés ───────────────────────────────────────
    {
      const ws = wb.addWorksheet('Critères détaillés', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 25 }, { width: 30 }, { width: 14 }, { width: 12 }, { width: 50 }]

      sc(ws, 2, 2, 'Détail par critère — Plan de Vigilance', { bold: true, sz: 14, bg: C.red, fg: C.white })
      merge(ws, 2, 2, 2, 6)
      ws.getRow(2).height = 30

      const hdrs = ['Axe', 'Critère', 'Niveau', 'Score (%)', 'Commentaire']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const axe of VIGILANCE_AXES) {
        const clr = AXE_COLORS[axe.id]
        for (const c of axe.criteres) {
          const n = reponses[c.id] ?? 0
          const niv = VIGILANCE_NIVEAUX[n]
          const pct = Math.round((niv?.pct ?? 0) * 100)
          sc(ws, row, 2, `${axe.icon} ${axe.label}`, { bg: clr.l, sz: 9 })
          sc(ws, row, 3, c.label, { bg: C.white, sz: 9 })
          sc(ws, row, 4, niv?.label ?? 'Non conforme', { bg: C.white, ha: 'center', sz: 9, bold: n > 0 })
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
      ws.columns = [{ width: 4 }, { width: 22 }, { width: 30 }, { width: 11 }, { width: 12 }, { width: 14 }, { width: 16 }, { width: 40 }]

      sc(ws, 2, 2, "Plan d'actions — Devoir de Vigilance", { bold: true, sz: 14, bg: C.red, fg: C.white })
      merge(ws, 2, 2, 2, 8)
      ws.getRow(2).height = 30

      const hdrs = ['Axe', 'Action', 'Priorité', 'Statut', 'Échéance', 'Responsable', 'Description']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      const STATUT_LABELS: Record<string, string> = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' }
      const PRIORITE_LABELS: Record<string, string> = { haute: '🔴 Haute', moyenne: '🟡 Moyenne', basse: '🟢 Basse' }

      for (const a of actions as any[]) {
        const axe = VIGILANCE_AXES.find(x => x.criteres.some(c => c.id === a.critere_id))
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

      sc(ws, 2, 2, 'Notes & Documents', { bold: true, sz: 14, bg: C.red, fg: C.white })
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
      ws.columns = [{ width: 4 }, { width: 30 }, { width: 25 }, { width: 55 }]

      sc(ws, 2, 2, 'Correspondances avec les référentiels internationaux', { bold: true, sz: 13, bg: C.red, fg: C.white })
      merge(ws, 2, 2, 2, 4)
      ws.getRow(2).height = 28

      const hdrs = ['Référentiel', 'Axe Vigilance', 'Correspondance']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      const correspondances = [
        { ref: 'ISO 26000',       axe: 'Droits humains / Chaîne appro', corr: 'Domaine 3 — Droits de l\'homme · Domaine 5 — Bonnes pratiques des affaires · Domaine 6 — Environnement' },
        { ref: 'CSRD — ESRS S1',  axe: 'Actions d\'atténuation',        corr: 'Travailleurs de l\'entreprise — conditions de travail, droits fondamentaux' },
        { ref: 'CSRD — ESRS S2',  axe: 'Évaluation des acteurs',        corr: 'Travailleurs de la chaîne de valeur — évaluation fournisseurs et sous-traitants' },
        { ref: 'CSRD — ESRS S3',  axe: 'Mécanisme d\'alerte',           corr: 'Communautés affectées — mécanismes de recours et de signalement' },
        { ref: 'CSRD — ESRS S4',  axe: 'Cartographie des risques',      corr: 'Consommateurs et utilisateurs finaux — identification des risques' },
        { ref: 'CSRD — ESRS G1',  axe: 'Dispositif de suivi',           corr: 'Gouvernance, éthique, culture d\'entreprise — reporting et transparence' },
        { ref: 'Directive UE Vigilance 2024', axe: 'Tous les axes',     corr: 'Corporate Sustainability Due Diligence Directive (CS3D) — alignement obligatoire' },
        { ref: 'UN GPBHR',         axe: 'Cartographie + Alerte',        corr: 'UN Guiding Principles on Business and Human Rights (Ruggie Principles) — piliers 2 et 3' },
        { ref: 'OCDE Guidelines',  axe: 'Évaluation + Actions',         corr: 'Principes directeurs OCDE à l\'intention des entreprises multinationales — chapitre IV Droits humains' },
        { ref: 'GRI 410',          axe: 'Droits humains',               corr: 'GRI 410 — Pratiques en matière de sécurité et droits de l\'homme' },
        { ref: 'GRI 411',          axe: 'Cartographie des risques',     corr: 'GRI 411 — Droits des peuples autochtones' },
        { ref: 'GRI 412',          axe: 'Évaluation des acteurs',       corr: 'GRI 412 — Évaluation des droits de l\'homme (due diligence)' },
        { ref: 'GRI 413',          axe: 'Mécanisme d\'alerte',          corr: 'GRI 413 — Communautés locales — mécanismes de recours' },
        { ref: 'GRI 414',          axe: 'Évaluation des acteurs',       corr: 'GRI 414 — Évaluation sociale des fournisseurs' },
        { ref: 'GRI 415',          axe: 'Dispositif de suivi',          corr: 'GRI 415 — Contributions politiques et reporting de gouvernance' },
        { ref: 'SASB',             axe: 'Tous les axes',                corr: 'SASB Standards sectoriels — indicateurs de durabilité matériels par secteur' },
      ]

      let row = 5
      for (const c of correspondances) {
        sc(ws, row, 2, c.ref, { bg: C.white, sz: 9, bold: true })
        sc(ws, row, 3, c.axe, { bg: C.redL, sz: 9 })
        sc(ws, row, 4, c.corr, { bg: C.white, sz: 8, wrap: true })
        ws.getRow(row).height = 22
        row++
      }
    }

    // ─── Export ───────────────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer()
    const filename = `DevoirVigilance_${orgNom.replace(/[^a-z0-9]/gi, '_')}_${diag.annee}.xlsx`

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('[vigilance/export-excel]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

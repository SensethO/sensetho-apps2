/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/eudr/[id]/export-excel
 * Génère un fichier Excel structuré du diagnostic EUDR (Règlement (UE) 2023/1115).
 *
 * Onglets :
 *  1. Couverture         — org, année, score global, badge de maturité
 *  2. Tableau de bord    — scores par axe, progression
 *  3. Critères détaillés — 20 critères, niveau, commentaire
 *  4. Plan d'actions     — toutes les actions, statut, échéance
 *  5. Notes & Annexes    — documents SharePoint (métadonnées seulement)
 *  6. Correspondances    — liens Règlement EUDR, FSC/PEFC, RSPO, CSRD, GRI, SDG 15
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
  amber:   'FFD97706', amberL:  'FFFEF9C3',
  gray:    'FF6B7280', grayL:   'FFF3F4F6',
  white:   'FFFFFFFF', black:   'FF111827', border: 'FFE5E7EB',
  red:     'FFDC2626', redL:    'FFFEE2E2',
}

const AXE_COLORS: Record<string, { h: string; l: string }> = {
  tracabilite:  { h: C.green,  l: C.greenL  },
  risques:      { h: C.orange, l: C.orangeL },
  declarations: { h: C.blue,   l: C.blueL   },
  fournisseurs: { h: C.purple, l: C.purpleL },
  gouvernance:  { h: C.amber,  l: C.amberL  },
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
const EUDR_AXES = [
  { id: 'tracabilite',  label: 'Traçabilité des matières premières', icon: '🌳', weight: 0.20, criteres: [
    { id: 'trac-produits',  label: 'Identification des produits concernés' },
    { id: 'trac-parcelles', label: 'Traçabilité jusqu\'à la parcelle (GPS)' },
    { id: 'trac-chaine',    label: 'Documentation de la chaîne d\'approvisionnement' },
    { id: 'trac-systeme',   label: 'Système d\'information pour la traçabilité' },
  ]},
  { id: 'risques',      label: 'Évaluation des risques',             icon: '⚠️', weight: 0.20, criteres: [
    { id: 'risq-pays',         label: 'Analyse des pays et zones de production' },
    { id: 'risq-deforestation', label: 'Évaluation du risque de déforestation' },
    { id: 'risq-legalite',     label: 'Évaluation du risque de non-conformité légale' },
    { id: 'risq-attenuation',  label: 'Mesures d\'atténuation des risques' },
  ]},
  { id: 'declarations', label: 'Diligence raisonnée & Déclarations', icon: '📋', weight: 0.20, criteres: [
    { id: 'decl-procedures', label: 'Procédures de diligence raisonnée' },
    { id: 'decl-depot',      label: 'Dépôt des déclarations EU' },
    { id: 'decl-gestion',    label: 'Gestion du système de déclarations' },
    { id: 'decl-archivage',  label: 'Archivage et traçabilité documentaire' },
  ]},
  { id: 'fournisseurs', label: 'Engagement fournisseurs',            icon: '🤝', weight: 0.20, criteres: [
    { id: 'fourn-politiques', label: 'Politiques et exigences envers les fournisseurs' },
    { id: 'fourn-evaluation', label: 'Évaluation et audit des fournisseurs' },
    { id: 'fourn-formation',  label: 'Formation et accompagnement' },
    { id: 'fourn-clauses',    label: 'Clauses contractuelles EUDR' },
  ]},
  { id: 'gouvernance',  label: 'Gouvernance & Conformité',           icon: '🏛️', weight: 0.20, criteres: [
    { id: 'gouv-responsabilites', label: 'Responsabilités et gouvernance interne' },
    { id: 'gouv-surveillance',    label: 'Systèmes de surveillance et contrôle' },
    { id: 'gouv-communication',   label: 'Communication et transparence' },
    { id: 'gouv-controles',       label: 'Préparation aux contrôles officiels' },
  ]},
]

const EUDR_NIVEAUX = [
  { value: 0, label: 'Non conforme',     pct: 0    },
  { value: 1, label: 'Initial',           pct: 0.25 },
  { value: 2, label: 'En développement',  pct: 0.50 },
  { value: 3, label: 'Conforme',          pct: 0.75 },
  { value: 4, label: 'Exemplaire',        pct: 1.00 },
]

const BADGE_LEVELS = [
  { label: 'Exemplaire',       min: 85 },
  { label: 'Conforme',         min: 60 },
  { label: 'En développement', min: 30 },
  { label: 'Non conforme',     min: 0  },
]

function calculateScore(niveaux: Record<string, number>): number {
  let total = 0
  for (const axe of EUDR_AXES) {
    let axeScore = 0
    const nb = axe.criteres.length
    for (const c of axe.criteres) {
      const n = niveaux[c.id] ?? 0
      axeScore += (EUDR_NIVEAUX[n]?.pct ?? 0) / nb
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
  const { data } = await admin.from('eudr_diagnostics').select('user_id').eq('id', diagnosticId).single()
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
      admin.from('eudr_diagnostics').select('*, organisations(denomination, siret_siege, ville)').eq('id', params.id).single(),
      admin.from('eudr_reponses').select('*').eq('diagnostic_id', params.id),
      admin.from('eudr_actions').select('*').eq('diagnostic_id', params.id).order('created_at'),
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
    const org = diag.organisations as { denomination?: string; siret_siege?: string; ville?: string } | null
    const orgNom = org?.denomination ?? 'Organisation'
    const dateExport = new Date().toLocaleDateString('fr-FR')

    // ─── Workbook ────────────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook()
    wb.creator = "Sens'ethO Apps — EUDR Diagnostic"
    wb.created = new Date()

    // ─── Onglet 1 : Couverture ────────────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Couverture', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 40 }, { width: 25 }, { width: 25 }]
      ws.getRow(1).height = 20
      ws.getRow(2).height = 50

      merge(ws, 2, 2, 2, 4)
      sc(ws, 2, 2, 'EUDR — Règlement (UE) 2023/1115 Sans Déforestation', { bg: C.green, fg: C.white, bold: true, sz: 14, ha: 'center' })

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
      sc(ws, row, 2, 'Score de conformité EUDR', { bold: true, sz: 14, bg: C.green, fg: C.white, ha: 'center' })
      sc(ws, row, 3, scoreGlobal, { bold: true, sz: 18, bg: C.green, fg: C.white, ha: 'center' })
      sc(ws, row, 4, `/ 100 — ${badge}`, { bold: true, bg: C.green, fg: C.white, ha: 'center' })
      ws.getRow(row).height = 35

      row += 2
      sc(ws, row, 2, 'Cadre réglementaire', { bold: true, sz: 11, bg: C.grayL })
      merge(ws, row, 2, row, 4)
      row++
      const legalLines = [
        'Règlement (UE) 2023/1115 du 31 mai 2023 relatif aux produits et marchandises associés à la déforestation',
        'Entrée en vigueur : 30 décembre 2024 (grandes entreprises) — 30 juin 2025 (PME)',
        'Produits concernés : bœuf, cacao, café, huile de palme, soja, bois, caoutchouc et produits dérivés',
        'Date de référence déforestation : 31 décembre 2020',
        'Sanctions : jusqu\'à 4% du CA annuel UE + confiscation + exclusion marchés publics',
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
      ws.columns = [{ width: 4 }, { width: 35 }, { width: 12 }, { width: 18 }, { width: 20 }, { width: 16 }]

      sc(ws, 2, 2, 'Synthèse par axe du diagnostic EUDR', { bold: true, sz: 14, bg: C.green, fg: C.white, ha: 'center' })
      merge(ws, 2, 2, 2, 6)
      ws.getRow(2).height = 30

      const headers = ['Axe', 'Poids', 'Score axe', 'Critères évalués', 'Niveau moyen']
      headers.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const axe of EUDR_AXES) {
        const clr = AXE_COLORS[axe.id]
        const niveaux = axe.criteres.map(c => reponses[c.id] ?? 0)
        const pct = Math.round(niveaux.reduce((s, n) => s + (EUDR_NIVEAUX[n]?.pct ?? 0), 0) / axe.criteres.length * 100)
        const renseignes = niveaux.filter(n => n > 0).length
        const moy = niveaux.reduce((s, n) => s + n, 0) / axe.criteres.length

        sc(ws, row, 2, `${axe.icon} ${axe.label}`, { bg: clr.l, bold: true, sz: 10 })
        sc(ws, row, 3, `${Math.round(axe.weight * 100)}%`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 4, `${pct}%`, { bg: clr.l, bold: true, ha: 'center', fg: pct >= 60 ? C.green : pct >= 30 ? C.amber : C.red })
        sc(ws, row, 5, `${renseignes} / ${axe.criteres.length}`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 6, EUDR_NIVEAUX[Math.round(moy)]?.label ?? 'Non conforme', { bg: clr.l, ha: 'center' })
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
      ws.columns = [{ width: 4 }, { width: 28 }, { width: 35 }, { width: 16 }, { width: 12 }, { width: 50 }]

      sc(ws, 2, 2, 'Détail par critère — Diagnostic EUDR', { bold: true, sz: 14, bg: C.green, fg: C.white })
      merge(ws, 2, 2, 2, 6)
      ws.getRow(2).height = 30

      const hdrs = ['Axe', 'Critère', 'Niveau', 'Score (%)', 'Commentaire']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const axe of EUDR_AXES) {
        const clr = AXE_COLORS[axe.id]
        for (const c of axe.criteres) {
          const n = reponses[c.id] ?? 0
          const niv = EUDR_NIVEAUX[n]
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
      ws.columns = [{ width: 4 }, { width: 25 }, { width: 30 }, { width: 11 }, { width: 12 }, { width: 14 }, { width: 16 }, { width: 40 }]

      sc(ws, 2, 2, "Plan d'actions — Diagnostic EUDR", { bold: true, sz: 14, bg: C.green, fg: C.white })
      merge(ws, 2, 2, 2, 8)
      ws.getRow(2).height = 30

      const hdrs = ['Axe', 'Action', 'Priorité', 'Statut', 'Échéance', 'Responsable', 'Description']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      const STATUT_LABELS: Record<string, string> = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' }
      const PRIORITE_LABELS: Record<string, string> = { haute: '🔴 Haute', moyenne: '🟡 Moyenne', basse: '🟢 Basse' }

      for (const a of actions as any[]) {
        const axe = EUDR_AXES.find(x => x.criteres.some(c => c.id === a.critere_id))
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
      ws.columns = [{ width: 4 }, { width: 30 }, { width: 25 }, { width: 60 }]

      sc(ws, 2, 2, 'Correspondances avec les référentiels — EUDR', { bold: true, sz: 13, bg: C.green, fg: C.white })
      merge(ws, 2, 2, 2, 4)
      ws.getRow(2).height = 28

      const hdrs = ['Référentiel', 'Axe EUDR', 'Correspondance']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      const correspondances = [
        { ref: 'Règlement EUDR 2023/1115', axe: 'Tous les axes', corr: 'Règlement (UE) 2023/1115 du Parlement européen et du Conseil du 31 mai 2023 — base légale directe' },
        { ref: 'FSC / PEFC',              axe: 'Traçabilité + Fournisseurs', corr: 'Certifications forestières (FSC, PEFC) reconnues pour démontrer la légalité et la durabilité' },
        { ref: 'RSPO',                    axe: 'Traçabilité + Fournisseurs', corr: 'Roundtable on Sustainable Palm Oil — certification huile de palme durable' },
        { ref: 'RTRS',                    axe: 'Traçabilité + Fournisseurs', corr: 'Roundtable on Responsible Soy — certification soja responsable' },
        { ref: 'EU Taxonomy',             axe: 'Gouvernance',               corr: 'Taxonomie européenne (financement durable) — EUDR contribue aux critères biodiversité' },
        { ref: 'CSRD — ESRS E4',          axe: 'Évaluation des risques',    corr: 'ESRS E4 — Biodiversité et écosystèmes : déforestation = impact matériel à documenter' },
        { ref: 'GRI 304',                 axe: 'Évaluation des risques',    corr: 'GRI 304 — Biodiversité : impacts sur les zones protégées et les forêts' },
        { ref: 'UN SDG 15',               axe: 'Tous les axes',             corr: 'ODD 15 — Vie terrestre : stopper la déforestation, restaurer les forêts d\'ici 2030' },
        { ref: 'Accord de Paris',         axe: 'Gouvernance',               corr: 'Forêts = puits de carbone essentiels — EUDR contribue aux objectifs climatiques' },
        { ref: 'ISO 26000',               axe: 'Fournisseurs + Gouvernance', corr: 'Domaine 6 — Environnement : devoir de vigilance environnementale dans la chaîne d\'appro' },
        { ref: 'VSME EFRAG (plateforme)', axe: 'Traçabilité + Déclarations', corr: 'Standard VSME — Norme volontaire PME : EUDR s\'intègre dans le reporting VSME E4' },
        { ref: 'Green Claims (plateforme)', axe: 'Gouvernance + Déclarations', corr: 'Directive Green Claims : allégations « sans déforestation » doivent être prouvées via EUDR' },
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
    const filename = `EUDR_${orgNom.replace(/[^a-z0-9]/gi, '_')}_${diag.annee}.xlsx`

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('[eudr/export-excel]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

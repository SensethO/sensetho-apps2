/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/afnor-rse/[id]/export-excel
 * Génère un fichier Excel structuré du diagnostic Label Engagé RSE (AFNOR).
 *
 * Onglets :
 *  1. Couverture         — org, année, score global, niveau de label
 *  2. Tableau de bord    — scores par axe, progression
 *  3. Critères détaillés — 20 critères, niveau (étoiles), commentaire
 *  4. Plan d'actions     — toutes les actions, statut, échéance
 *  5. Notes & Annexes    — documents SharePoint (métadonnées seulement)
 *  6. Correspondances    — liens ISO 26000, ODD, B Corp, CSRD, GRI, OCDE
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─── Colors ──────────────────────────────────────────────────────────────────
const C = {
  purple:  'FF7C3AED', purpleL: 'FFEDE9FE',
  blue:    'FF2563EB', blueL:   'FFDBEAFE',
  green:   'FF16A34A', greenL:  'FFDCFCE7',
  orange:  'FFEA580C', orangeL: 'FFFFEDD5',
  cyan:    'FF0891B2', cyanL:   'FFCFFAFE',
  amber:   'FFF59E0B', amberL:  'FFFEF3C7',
  gray:    'FF6B7280', grayL:   'FFF3F4F6',
  white:   'FFFFFFFF', black:   'FF111827', border: 'FFE5E7EB',
  red:     'FFDC2626', redL:    'FFFEE2E2',
}

const AXE_COLORS: Record<string, { h: string; l: string }> = {
  gouvernance:   { h: C.purple, l: C.purpleL },
  rh:            { h: C.blue,   l: C.blueL   },
  environnement: { h: C.green,  l: C.greenL  },
  achats:        { h: C.orange, l: C.orangeL },
  territoire:    { h: C.cyan,   l: C.cyanL   },
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
const AFNOR_AXES = [
  { id: 'gouvernance', label: 'Stratégie RSE & Gouvernance', icon: '🏛️', weight: 0.20, criteres: [
    { id: 'gouv-vision',    label: 'Vision et engagement RSE' },
    { id: 'gouv-parties',   label: 'Identification et dialogue parties prenantes' },
    { id: 'gouv-pilotage',  label: 'Gouvernance et pilotage RSE' },
    { id: 'gouv-reporting', label: 'Communication et reporting RSE' },
  ]},
  { id: 'rh', label: 'Capital Humain & Social', icon: '👥', weight: 0.20, criteres: [
    { id: 'rh-emploi',      label: 'Emploi et conditions de travail' },
    { id: 'rh-dialogue',    label: 'Dialogue social et participation' },
    { id: 'rh-sst',         label: 'Santé, sécurité et bien-être au travail' },
    { id: 'rh-competences', label: 'Développement des compétences' },
  ]},
  { id: 'environnement', label: 'Performance Environnementale', icon: '🌿', weight: 0.20, criteres: [
    { id: 'env-energie',      label: 'Énergie et lutte contre le changement climatique' },
    { id: 'env-ressources',   label: 'Gestion durable des ressources' },
    { id: 'env-dechets',      label: 'Prévention des pollutions et gestion des déchets' },
    { id: 'env-biodiversite', label: 'Biodiversité et impact sur les écosystèmes' },
  ]},
  { id: 'achats', label: 'Achats Responsables & Éthique', icon: '🤝', weight: 0.20, criteres: [
    { id: 'ach-politique',   label: 'Politique achats responsables' },
    { id: 'ach-fournisseurs',label: 'Évaluation et accompagnement des fournisseurs' },
    { id: 'ach-ethique',     label: 'Lutte contre la corruption et conformité' },
    { id: 'ach-commercial',  label: 'Pratiques commerciales loyales' },
  ]},
  { id: 'territoire', label: 'Territoire & Parties Prenantes', icon: '🏙️', weight: 0.20, criteres: [
    { id: 'terr-communaute',    label: 'Implication communautaire et territoire' },
    { id: 'terr-clients',       label: 'Responsabilité envers les clients' },
    { id: 'terr-transparence',  label: 'Transparence et dialogue parties prenantes' },
    { id: 'terr-developpement', label: 'Contribution au développement local' },
  ]},
]

const AFNOR_NIVEAUX = [
  { value: 0, label: 'Non initié',  pct: 0,    star: '' },
  { value: 1, label: 'Engagé',      pct: 0.25, star: '⭐' },
  { value: 2, label: 'Confirmé',    pct: 0.50, star: '⭐⭐' },
  { value: 3, label: 'Avancé',      pct: 0.75, star: '⭐⭐⭐' },
  { value: 4, label: 'Exemplaire',  pct: 1.00, star: '⭐⭐⭐⭐' },
]

const BADGE_LEVELS = [
  { label: 'Exemplaire',         min: 90 },
  { label: 'Avancé',             min: 75 },
  { label: 'Confirmé',           min: 50 },
  { label: 'Engagé',             min: 25 },
  { label: 'Démarche à initier', min: 0  },
]

function calculateScore(niveaux: Record<string, number>): number {
  let total = 0
  for (const axe of AFNOR_AXES) {
    let axeScore = 0
    const nb = axe.criteres.length
    for (const c of axe.criteres) {
      const n = niveaux[c.id] ?? 0
      axeScore += (AFNOR_NIVEAUX[n]?.pct ?? 0) / nb
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
  const { data } = await admin.from('afnor_diagnostics').select('user_id').eq('id', diagnosticId).single()
  return data?.user_id === userId
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createAdminClient()

    const [diagRes, repRes, actRes] = await Promise.all([
      admin.from('afnor_diagnostics').select('*, organisations(nom, siret, pays)').eq('id', params.id).single(),
      admin.from('afnor_reponses').select('*').eq('diagnostic_id', params.id),
      admin.from('afnor_actions').select('*').eq('diagnostic_id', params.id).order('created_at'),
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
    const badge = BADGE_LEVELS.find(b => scoreGlobal >= b.min)?.label ?? 'Démarche à initier'
    const org = diag.organisations as { nom?: string; siret?: string; pays?: string } | null
    const orgNom = org?.nom ?? 'Organisation'
    const dateExport = new Date().toLocaleDateString('fr-FR')

    // ─── Workbook ────────────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook()
    wb.creator = "Sens'ethO Apps — Label Engagé RSE (AFNOR)"
    wb.created = new Date()

    // ─── Onglet 1 : Couverture ────────────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Couverture', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 40 }, { width: 25 }, { width: 25 }]
      ws.getRow(1).height = 20
      ws.getRow(2).height = 50

      merge(ws, 2, 2, 2, 4)
      sc(ws, 2, 2, 'Label Engagé RSE — AFNOR Certification', { bg: C.purple, fg: C.white, bold: true, sz: 14, ha: 'center' })

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
      sc(ws, row, 2, 'Score de maturité RSE', { bold: true, sz: 14, bg: C.purple, fg: C.white, ha: 'center' })
      sc(ws, row, 3, scoreGlobal, { bold: true, sz: 18, bg: C.purple, fg: C.white, ha: 'center' })
      sc(ws, row, 4, `/ 100 — ${badge}`, { bold: true, bg: C.purple, fg: C.white, ha: 'center' })
      ws.getRow(row).height = 35

      row += 2
      sc(ws, row, 2, 'Label Engagé RSE — AFNOR Certification', { bold: true, sz: 11, bg: C.grayL })
      merge(ws, row, 2, row, 4)
      row++
      const infoLines = [
        'Certification française de maturité RSE fondée sur ISO 26000 — ouverte à toutes les organisations',
        '4 niveaux progressifs : ⭐ Engagé / ⭐⭐ Confirmé / ⭐⭐⭐ Avancé / ⭐⭐⭐⭐ Exemplaire',
        'Durée de validité : 3 ans (audit de suivi à 18 mois)',
        'Seuils : 0-25% Démarche à initier · 25-50% Engagé · 50-75% Confirmé · 75-90% Avancé · 90-100% Exemplaire',
        'Ancré dans : ISO 26000, UN SDGs, Principes Directeurs OCDE',
      ]
      for (const line of infoLines) {
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

      sc(ws, 2, 2, 'Synthèse par axe — Label Engagé RSE', { bold: true, sz: 14, bg: C.purple, fg: C.white, ha: 'center' })
      merge(ws, 2, 2, 2, 6)
      ws.getRow(2).height = 30

      const headers = ['Axe', 'Poids', 'Score axe', 'Critères évalués', 'Niveau moyen']
      headers.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const axe of AFNOR_AXES) {
        const clr = AXE_COLORS[axe.id]
        const niveaux = axe.criteres.map(c => reponses[c.id] ?? 0)
        const pct = Math.round(niveaux.reduce((s, n) => s + (AFNOR_NIVEAUX[n]?.pct ?? 0), 0) / axe.criteres.length * 100)
        const renseignes = niveaux.filter(n => n > 0).length
        const moy = niveaux.reduce((s, n) => s + n, 0) / axe.criteres.length
        const moyNiv = AFNOR_NIVEAUX[Math.round(moy)]

        sc(ws, row, 2, `${axe.icon} ${axe.label}`, { bg: clr.l, bold: true, sz: 10 })
        sc(ws, row, 3, `${Math.round(axe.weight * 100)}%`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 4, `${pct}%`, { bg: clr.l, bold: true, ha: 'center', fg: pct >= 75 ? C.green : pct >= 50 ? C.amber : C.red })
        sc(ws, row, 5, `${renseignes} / ${axe.criteres.length}`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 6, `${moyNiv?.star ?? ''} ${moyNiv?.label ?? 'Non initié'}`, { bg: clr.l, ha: 'center' })
        ws.getRow(row).height = 22
        row++
      }

      row += 2
      sc(ws, row, 2, 'Résumé', { bold: true, sz: 12, bg: C.grayL })
      sc(ws, row, 3, `Score global : ${scoreGlobal}/100 — ${badge}`, { bold: true, bg: C.purpleL, fg: C.purple })
      merge(ws, row, 3, row, 6)
      ws.getRow(row).height = 22
    }

    // ─── Onglet 3 : Critères détaillés ───────────────────────────────────────
    {
      const ws = wb.addWorksheet('Critères détaillés', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 28 }, { width: 35 }, { width: 18 }, { width: 12 }, { width: 50 }]

      sc(ws, 2, 2, 'Détail par critère — Label Engagé RSE', { bold: true, sz: 14, bg: C.purple, fg: C.white })
      merge(ws, 2, 2, 2, 6)
      ws.getRow(2).height = 30

      const hdrs = ['Axe', 'Critère', 'Niveau', 'Score (%)', 'Commentaire']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const axe of AFNOR_AXES) {
        const clr = AXE_COLORS[axe.id]
        for (const c of axe.criteres) {
          const n = reponses[c.id] ?? 0
          const niv = AFNOR_NIVEAUX[n]
          const pct = Math.round((niv?.pct ?? 0) * 100)
          sc(ws, row, 2, `${axe.icon} ${axe.label}`, { bg: clr.l, sz: 9 })
          sc(ws, row, 3, c.label, { bg: C.white, sz: 9 })
          sc(ws, row, 4, `${niv?.star ?? ''} ${niv?.label ?? 'Non initié'}`, { bg: C.white, ha: 'center', sz: 9, bold: n > 0 })
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

      sc(ws, 2, 2, "Plan d'actions — Label Engagé RSE", { bold: true, sz: 14, bg: C.purple, fg: C.white })
      merge(ws, 2, 2, 2, 8)
      ws.getRow(2).height = 30

      const hdrs = ['Axe', 'Action', 'Priorité', 'Statut', 'Échéance', 'Responsable', 'Description']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      const STATUT_LABELS: Record<string, string> = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' }
      const PRIORITE_LABELS: Record<string, string> = { haute: '🔴 Haute', moyenne: '🟡 Moyenne', basse: '🟢 Basse' }

      for (const a of actions as any[]) {
        const axe = AFNOR_AXES.find(x => x.criteres.some(c => c.id === a.critere_id))
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

      sc(ws, 2, 2, 'Notes & Documents', { bold: true, sz: 14, bg: C.purple, fg: C.white })
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

      sc(ws, 2, 2, 'Correspondances — Label Engagé RSE (AFNOR)', { bold: true, sz: 13, bg: C.purple, fg: C.white })
      merge(ws, 2, 2, 2, 4)
      ws.getRow(2).height = 28

      const hdrs = ['Référentiel', 'Axe AFNOR', 'Correspondance']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      const correspondances = [
        { ref: 'ISO 26000', axe: 'Tous les axes', corr: 'Norme internationale RSE — fondement du Label Engagé RSE. Les 7 domaines de l\'ISO 26000 sont intégralement couverts par les 5 axes AFNOR.' },
        { ref: 'UN SDGs / ODD', axe: 'Tous les axes', corr: '17 Objectifs de Développement Durable — le Label Engagé RSE contribue directement à ODD 8 (Travail décent), ODD 13 (Climat), ODD 15 (Vie terrestre), ODD 17 (Partenariats).' },
        { ref: 'Principes Directeurs OCDE', axe: 'Achats + Gouvernance', corr: 'Principes directeurs de l\'OCDE pour les entreprises multinationales — devoir de vigilance dans la chaîne de valeur.' },
        { ref: 'VSME EFRAG (plateforme)', axe: 'Tous les axes', corr: 'Standard volontaire PME EFRAG — le Label AFNOR prépare au reporting VSME (standards E, S, G).' },
        { ref: 'Diagnostic RSE Guidé (plateforme)', axe: 'Tous les axes', corr: 'Application de préparation audit RSE — complémentaire au Label Engagé RSE comme outil de préparation.' },
        { ref: 'EcoVadis (plateforme)', axe: 'Achats + Gouvernance', corr: 'Évaluation RSE des fournisseurs — les critères AFNOR "Achats responsables" s\'alignent avec EcoVadis.' },
        { ref: 'Devoir de Vigilance (plateforme)', axe: 'Achats + Gouvernance', corr: 'Loi française 2017-399 — le Label AFNOR constitue une démarche de vigilance structurée.' },
        { ref: 'B Corp', axe: 'Tous les axes', corr: 'Certification internationale B Corp — approche complémentaire, niveau d\'exigence supérieur, reconnaissance internationale.' },
        { ref: 'Global Compact ONU', axe: 'Gouvernance + RH', corr: '10 principes du Pacte Mondial ONU — travail décent, droits de l\'Homme, environnement, lutte anti-corruption.' },
        { ref: 'CSRD / ESRS', axe: 'Gouvernance + Environnement', corr: 'Directive européenne CSRD et standards ESRS — le Label AFNOR prépare aux obligations de reporting de durabilité.' },
        { ref: 'GRI Standards', axe: 'Tous les axes', corr: 'Global Reporting Initiative — référentiel international de reporting RSE. Le Label AFNOR s\'appuie sur des indicateurs alignés GRI.' },
        { ref: 'Loi PACTE', axe: 'Gouvernance', corr: 'Loi PACTE 2019 — entreprise à mission, raison d\'être. Le Label AFNOR valorise la formalisation d\'une raison d\'être RSE.' },
        { ref: 'Labels sectoriels (HVE, RSE Pro...)', axe: 'Environnement + Territoire', corr: 'Labels sectoriels complémentaires — HVE (agriculture), RSE Pro Commerce, labels territoriaux. Le Label AFNOR est transversal.' },
      ]

      let row = 5
      for (const c of correspondances) {
        sc(ws, row, 2, c.ref, { bg: C.white, sz: 9, bold: true })
        sc(ws, row, 3, c.axe, { bg: C.purpleL, sz: 9 })
        sc(ws, row, 4, c.corr, { bg: C.white, sz: 8, wrap: true })
        ws.getRow(row).height = 25
        row++
      }
    }

    // ─── Export ───────────────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer()
    const filename = `LabelRSE_AFNOR_${orgNom.replace(/[^a-z0-9]/gi, '_')}_${diag.annee}.xlsx`

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('[afnor-rse/export-excel]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

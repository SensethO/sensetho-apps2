/**
 * GET /api/ecovadis/[id]/export-excel
 * Génère un fichier Excel structuré du Diagnostic EcoVadis RSE.
 *
 * Onglets :
 *  1. Couverture         — org, année, score global, badge
 *  2. Tableau de bord    — scores par thème, progression
 *  3. Critères détaillés — 20 critères, niveau, commentaire
 *  4. Plan d'actions     — toutes les actions, statut, échéance
 *  5. Notes & Annexes    — documents SharePoint (métadonnées seulement)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─── Colors ──────────────────────────────────────────────────────────────────
const C = {
  emerald: 'FF16A34A', emeraldL: 'FFD1FAE5',
  blue:    'FF2563EB', blueL:    'FFDBEAFE',
  purple:  'FF9333EA', purpleL:  'FFEDE9FE',
  amber:   'FFEA580C', amberL:   'FFFFEDD5',
  gray:    'FF6B7280', grayL:    'FFF3F4F6',
  white:   'FFFFFFFF', black:    'FF111827', border: 'FFE5E7EB',
  green:   'FF16A34A', red: 'FFDC2626', orange: 'FFF59E0B',
}

const THEME_COLORS: Record<string, { h: string; l: string }> = {
  env:     { h: C.emerald, l: C.emeraldL },
  social:  { h: C.blue,    l: C.blueL    },
  ethique: { h: C.purple,  l: C.purpleL  },
  achats:  { h: C.amber,   l: C.amberL   },
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
const ECOVADIS_THEMES = [
  { id: 'env',     label: 'Environnement',        icon: '🌿', poids: 0.40, criteres: [
    { id: 'env-politique', label: 'Politique environnementale' }, { id: 'env-energie', label: 'Énergie & GES' },
    { id: 'env-eau', label: 'Gestion de l\'eau' }, { id: 'env-dechets', label: 'Déchets & Matières' },
    { id: 'env-pollution', label: 'Pollution & Contamination' }, { id: 'env-reporting', label: 'Reporting Environnemental' },
  ]},
  { id: 'social',  label: 'Social & Droits Humains', icon: '👥', poids: 0.40, criteres: [
    { id: 'soc-politique', label: 'Politique RH & Engagement' }, { id: 'soc-sante', label: 'Santé & Sécurité' },
    { id: 'soc-conditions', label: 'Conditions de travail' }, { id: 'soc-formation', label: 'Formation & Développement' },
    { id: 'soc-droits', label: 'Droits Humains Fondamentaux' }, { id: 'soc-reporting', label: 'Reporting Social' },
  ]},
  { id: 'ethique', label: 'Éthique des Affaires',    icon: '⚖️', poids: 0.10, criteres: [
    { id: 'eth-corruption', label: 'Anti-corruption & Pots-de-vin' }, { id: 'eth-concurrence', label: 'Pratiques anticoncurrentielles' },
    { id: 'eth-ip', label: 'Propriété Intellectuelle' }, { id: 'eth-donnees', label: 'Protection des Données' },
    { id: 'eth-reporting', label: 'Reporting Éthique' },
  ]},
  { id: 'achats',  label: 'Achats Responsables',     icon: '🤝', poids: 0.10, criteres: [
    { id: 'ach-politique', label: 'Politique Achats Responsables' }, { id: 'ach-actions', label: 'Actions & Évaluation Fournisseurs' },
    { id: 'ach-reporting', label: 'Reporting Achats' },
  ]},
]

const NIVEAUX = [
  { value: 0, label: 'NC',        pct: 0    },
  { value: 1, label: 'Basique',   pct: 0.25 },
  { value: 2, label: 'Avancé',    pct: 0.50 },
  { value: 3, label: 'Pro-actif', pct: 0.75 },
  { value: 4, label: 'Leader',    pct: 1.00 },
]

const BADGE_LEVELS = [
  { label: 'Platinum', min: 75 }, { label: 'Gold', min: 65 },
  { label: 'Silver', min: 45 }, { label: 'Bronze', min: 25 }, { label: 'Non noté', min: 0 },
]

function calculateScore(niveaux: Record<string, number>): number {
  let total = 0
  for (const t of ECOVADIS_THEMES) {
    let ts = 0
    const nb = t.criteres.length
    for (const c of t.criteres) {
      const n = niveaux[c.id] ?? 0
      ts += (NIVEAUX[n]?.pct ?? 0) / nb
    }
    total += ts * t.poids
  }
  return Math.round(total * 100)
}

// ─── Access check ─────────────────────────────────────────────────────────────
async function canAccess(userId: string, diagnosticId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data } = await admin.from('ecovadis_diagnostics').select('user_id').eq('id', diagnosticId).single()
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
    const [diagRes, repRes, actRes, docRes] = await Promise.all([
      admin.from('ecovadis_diagnostics').select('*, organisations(nom, siret, pays)').eq('id', params.id).single(),
      admin.from('ecovadis_reponses').select('*').eq('diagnostic_id', params.id),
      admin.from('ecovadis_actions').select('*').eq('diagnostic_id', params.id).order('created_at'),
      admin.from('ecovadis_documents').select('*').eq('diagnostic_id', params.id).order('annexe_index'),
    ])

    const diag = diagRes.data
    if (!diag) return NextResponse.json({ error: 'Diagnostic non trouvé' }, { status: 404 })

    const reponses: Record<string, number> = {}
    const commentaires: Record<string, string> = {}
    for (const r of (repRes.data ?? [])) {
      reponses[r.critere_id] = r.niveau
      if (r.commentaire) commentaires[r.critere_id] = r.commentaire
    }
    const actions = actRes.data ?? []
    const documents = docRes.data ?? []

    const scoreGlobal = calculateScore(reponses)
    const badge = BADGE_LEVELS.find(b => scoreGlobal >= b.min)?.label ?? 'Non noté'
    const org = (diag as Record<string, unknown>).organisations as { nom?: string; siret?: string; pays?: string } | null
    const orgNom = org?.nom ?? 'Organisation'
    const dateExport = new Date().toLocaleDateString('fr-FR')

    // ─── Workbook ────────────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Sens\'ethO Apps — EcoVadis Diagnostic RSE'
    wb.created = new Date()

    // ─── Onglet 1 : Couverture ────────────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Couverture', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 40 }, { width: 25 }, { width: 25 }]
      ws.getRow(1).height = 20
      ws.getRow(2).height = 50

      merge(ws, 2, 2, 2, 4)
      sc(ws, 2, 2, 'EcoVadis — Diagnostic RSE', { bg: C.emerald, fg: C.white, bold: true, sz: 18, ha: 'center' })

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
      sc(ws, row, 2, 'Score Global EcoVadis', { bold: true, sz: 14, bg: C.emerald, fg: C.white, ha: 'center' })
      sc(ws, row, 3, scoreGlobal, { bold: true, sz: 18, bg: C.emerald, fg: C.white, ha: 'center' })
      sc(ws, row, 4, `/ 100 — ${badge}`, { bold: true, bg: C.emerald, fg: C.white, ha: 'center' })
      ws.getRow(row).height = 35
    }

    // ─── Onglet 2 : Tableau de bord ───────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Tableau de bord', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 30 }, { width: 12 }, { width: 18 }, { width: 20 }, { width: 16 }]

      sc(ws, 2, 2, 'Synthèse par thème', { bold: true, sz: 14, bg: C.emerald, fg: C.white, ha: 'center' })
      merge(ws, 2, 2, 2, 6)
      ws.getRow(2).height = 30

      const headers = ['Thème', 'Poids', 'Score thème', 'Critères évalués', 'Niveau moyen']
      headers.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const t of ECOVADIS_THEMES) {
        const clr = THEME_COLORS[t.id]
        const niveaux = t.criteres.map(c => reponses[c.id] ?? 0)
        const pct = Math.round(niveaux.reduce((s, n) => s + (NIVEAUX[n]?.pct ?? 0), 0) / t.criteres.length * 100)
        const renseignes = niveaux.filter(n => n > 0).length
        const moy = niveaux.reduce((s, n) => s + n, 0) / t.criteres.length

        sc(ws, row, 2, `${t.icon} ${t.label}`, { bg: clr.l, bold: true, sz: 10 })
        sc(ws, row, 3, `${Math.round(t.poids * 100)}%`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 4, `${pct}%`, { bg: clr.l, bold: true, ha: 'center', fg: pct >= 50 ? C.green : C.orange })
        sc(ws, row, 5, `${renseignes} / ${t.criteres.length}`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 6, NIVEAUX[Math.round(moy)]?.label ?? 'NC', { bg: clr.l, ha: 'center' })
        ws.getRow(row).height = 22
        row++
      }

      row += 2
      sc(ws, row, 2, 'Résumé', { bold: true, sz: 12, bg: C.grayL })
      sc(ws, row, 3, `Score global : ${scoreGlobal}/100 — ${badge}`, { bold: true, bg: C.emeraldL, fg: C.emerald })
      merge(ws, row, 3, row, 6)
      ws.getRow(row).height = 22
    }

    // ─── Onglet 3 : Critères détaillés ───────────────────────────────────────
    {
      const ws = wb.addWorksheet('Critères détaillés', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 25 }, { width: 30 }, { width: 10 }, { width: 12 }, { width: 50 }]

      sc(ws, 2, 2, 'Détail par critère', { bold: true, sz: 14, bg: C.emerald, fg: C.white })
      merge(ws, 2, 2, 2, 6)
      ws.getRow(2).height = 30

      const hdrs = ['Thème', 'Critère', 'Niveau', 'Score (%)', 'Commentaire']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const t of ECOVADIS_THEMES) {
        const clr = THEME_COLORS[t.id]
        for (const c of t.criteres) {
          const n = reponses[c.id] ?? 0
          const niv = NIVEAUX[n]
          const pct = Math.round((niv?.pct ?? 0) * 100)
          sc(ws, row, 2, `${t.icon} ${t.label}`, { bg: clr.l, sz: 9 })
          sc(ws, row, 3, c.label, { bg: C.white, sz: 9 })
          sc(ws, row, 4, niv?.label ?? 'NC', { bg: C.white, ha: 'center', sz: 9, bold: n > 0 })
          sc(ws, row, 5, pct === 0 ? '—' : `${pct}%`, { bg: C.white, ha: 'center', sz: 9, fg: pct >= 75 ? C.green : pct >= 50 ? C.orange : C.red })
          sc(ws, row, 6, commentaires[c.id] ?? '—', { bg: C.white, sz: 8, wrap: true, indent: 1 })
          ws.getRow(row).height = commentaires[c.id] ? 30 : 18
          row++
        }
      }
    }

    // ─── Onglet 4 : Plan d'actions ────────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Plan d\'actions', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 22 }, { width: 30 }, { width: 11 }, { width: 12 }, { width: 14 }, { width: 16 }, { width: 40 }]

      sc(ws, 2, 2, 'Plan d\'actions EcoVadis', { bold: true, sz: 14, bg: C.emerald, fg: C.white })
      merge(ws, 2, 2, 2, 8)
      ws.getRow(2).height = 30

      const hdrs = ['Thème', 'Action', 'Priorité', 'Statut', 'Échéance', 'Responsable', 'Description']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      const STATUT_LABELS: Record<string, string> = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' }
      const PRIORITE_LABELS: Record<string, string> = { haute: '🔴 Haute', moyenne: '🟡 Moyenne', basse: '🟢 Basse' }

      for (const a of actions) {
        const theme = ECOVADIS_THEMES.find(t => t.criteres.some(c => c.id === a.critere_id))
        const clr = theme ? (THEME_COLORS[theme.id] ?? { l: C.grayL }) : { l: C.grayL }
        const statBg = a.statut === 'termine' ? C.emeraldL : a.statut === 'en_cours' ? C.blueL : C.grayL

        sc(ws, row, 2, theme ? `${theme.icon} ${theme.label}` : a.critere_id, { bg: clr.l, sz: 9 })
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
      ws.columns = [{ width: 4 }, { width: 6 }, { width: 30 }, { width: 22 }, { width: 12 }, { width: 20 }]

      sc(ws, 2, 2, 'Pièces jointes & Annexes', { bold: true, sz: 14, bg: C.emerald, fg: C.white })
      merge(ws, 2, 2, 2, 6)
      ws.getRow(2).height = 30

      sc(ws, 3, 2, 'Note : Les fichiers sont stockés dans SharePoint. Les URLs de téléchargement sont générées à la demande depuis l\'application.', { it: true, fg: C.gray, sz: 9 })
      merge(ws, 3, 2, 3, 6)

      const hdrs = ['Réf.', 'Nom du fichier', 'Critère', 'Type', 'Taille']
      hdrs.forEach((h, i) => sc(ws, 5, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 6
      for (const d of documents) {
        const theme = ECOVADIS_THEMES.find(t => t.criteres.some(c => c.id === d.critere_id))
        const critere = theme?.criteres.find(c => c.id === d.critere_id)
        const sizeKo = d.size ? `${Math.round(d.size / 1024)} Ko` : '—'
        sc(ws, row, 2, d.annexe_index ? `A${String(d.annexe_index).padStart(3,'0')}` : '—', { ha: 'center', sz: 9, bold: true, fg: C.blue })
        sc(ws, row, 3, d.nom, { sz: 9 })
        sc(ws, row, 4, critere ? `${theme?.icon} ${critere.label}` : (d.critere_id ?? '—'), { sz: 9 })
        sc(ws, row, 5, d.type_doc ?? '—', { ha: 'center', sz: 9 })
        sc(ws, row, 6, sizeKo, { ha: 'center', sz: 9 })
        ws.getRow(row).height = 18
        row++
      }

      if (documents.length === 0) {
        sc(ws, 6, 2, 'Aucun document uploadé', { it: true, fg: C.gray, ha: 'center' })
        merge(ws, 6, 2, 6, 6)
      }
    }

    // ─── Export ───────────────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer()
    const filename = `EcoVadis_${orgNom.replace(/[^a-z0-9]/gi, '_')}_${diag.annee}.xlsx`

    return new NextResponse(buffer as Buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('[ecovadis/export-excel]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

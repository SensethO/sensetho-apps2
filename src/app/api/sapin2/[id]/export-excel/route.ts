/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/sapin2/[id]/export-excel
 * Génère un fichier Excel structuré du diagnostic Loi Sapin II.
 *
 * Onglets :
 *  1. Couverture         — org, année, score global, badge de conformité
 *  2. Tableau de bord    — scores par axe, progression
 *  3. Critères détaillés — 20 critères, niveau, commentaire
 *  4. Plan d'actions     — toutes les actions, statut, échéance
 *  5. Notes & Annexes    — documents SharePoint (métadonnées)
 *  6. Correspondances    — liens ISO 37001, FCPA, UK Bribery Act, GRI 205, ODD 16
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const C = {
  teal:    'FF065F46', tealL:   'FFD1FAE5',
  red:     'FF991B1B', redL:    'FFFEE2E2',
  blue:    'FF1E40AF', blueL:   'FFDBEAFE',
  purple:  'FF5B21B6', purpleL: 'FFEDE9FE',
  amber:   'FFB45309', amberL:  'FFFEF3C7',
  gray:    'FF6B7280', grayL:   'FFF3F4F6',
  white:   'FFFFFFFF', black:   'FF111827', border: 'FFE5E7EB',
  green:   'FF16A34A', greenL:  'FFDCFCE7',
}

const AXE_COLORS: Record<string, { h: string; l: string }> = {
  gouvernance:   { h: C.teal,   l: C.tealL   },
  cartographie:  { h: C.red,    l: C.redL    },
  prevention:    { h: C.blue,   l: C.blueL   },
  tiers:         { h: C.purple, l: C.purpleL },
  detection:     { h: C.amber,  l: C.amberL  },
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

const SAPIN2_AXES = [
  { id: 'gouvernance',  label: 'Gouvernance & Engagement',      icon: '🏛️', weight: 0.20, criteres: [
    { id: 'gouv-code',         label: 'Code de conduite anti-corruption' },
    { id: 'gouv-direction',    label: 'Engagement de la direction générale' },
    { id: 'gouv-ressources',   label: 'Ressources et organisation dédiées (Compliance Officer)' },
    { id: 'gouv-strategie',    label: 'Intégration dans la stratégie d\'entreprise' },
  ]},
  { id: 'cartographie', label: 'Cartographie des risques',      icon: '🗺️', weight: 0.20, criteres: [
    { id: 'carto-processus',   label: 'Identification des processus et activités à risque' },
    { id: 'carto-evaluation',  label: 'Évaluation de la probabilité et de l\'impact' },
    { id: 'carto-hierarchie',  label: 'Hiérarchisation et plan de mise à jour' },
    { id: 'carto-couverture',  label: 'Couverture des filiales, sous-traitants et tiers' },
  ]},
  { id: 'prevention',   label: 'Prévention & Contrôles internes', icon: '🛡️', weight: 0.20, criteres: [
    { id: 'prev-formation',    label: 'Programme de formation et sensibilisation' },
    { id: 'prev-procedures',   label: 'Procédures internes (cadeaux, hospitalités, mécénat)' },
    { id: 'prev-comptable',    label: 'Procédures de contrôle comptable' },
    { id: 'prev-audit',        label: 'Contrôle interne et audit de conformité' },
  ]},
  { id: 'tiers',        label: 'Gestion des tiers',             icon: '🤝', weight: 0.20, criteres: [
    { id: 'tiers-carto',       label: 'Cartographie et identification des tiers à risque' },
    { id: 'tiers-diligence',   label: 'Due diligence et évaluation des tiers' },
    { id: 'tiers-contrats',    label: 'Clauses contractuelles anti-corruption' },
    { id: 'tiers-suivi',       label: 'Suivi, surveillance et réévaluation des tiers' },
  ]},
  { id: 'detection',    label: 'Détection & Remédiation',       icon: '🔍', weight: 0.20, criteres: [
    { id: 'det-alerte',        label: 'Dispositif d\'alerte interne (lanceurs d\'alerte)' },
    { id: 'det-incidents',     label: 'Gestion des incidents et enquêtes internes' },
    { id: 'det-sanctions',     label: 'Régime disciplinaire et sanctions' },
    { id: 'det-reporting',     label: 'Reporting, mesure d\'efficacité et amélioration continue' },
  ]},
]

const SAPIN2_NIVEAUX = [
  { value: 0, label: 'Non conforme',     pct: 0    },
  { value: 1, label: 'Initial',           pct: 0.25 },
  { value: 2, label: 'En développement',  pct: 0.50 },
  { value: 3, label: 'Conforme AFA',      pct: 0.75 },
  { value: 4, label: 'Leader',            pct: 1.00 },
]

const BADGE_LEVELS = [
  { label: 'Leader',          min: 85 },
  { label: 'Conforme AFA',    min: 60 },
  { label: 'En développement',min: 30 },
  { label: 'Non conforme',    min: 0  },
]

function calculateScore(niveaux: Record<string, number>): number {
  let total = 0
  for (const axe of SAPIN2_AXES) {
    let axeScore = 0
    const nb = axe.criteres.length
    for (const c of axe.criteres) {
      const n = niveaux[c.id] ?? 0
      axeScore += (SAPIN2_NIVEAUX[n]?.pct ?? 0) / nb
    }
    total += axeScore * axe.weight
  }
  return Math.round(total * 100)
}

async function canAccess(userId: string, diagnosticId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data } = await admin.from('sapin2_diagnostics').select('user_id').eq('id', diagnosticId).single()
  return data?.user_id === userId
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createAdminClient()
    const [diagRes, repRes, actRes, notesRes] = await Promise.all([
      admin.from('sapin2_diagnostics').select('*, organisations(denomination, siret_siege, ville)').eq('id', params.id).single(),
      admin.from('sapin2_reponses').select('*').eq('diagnostic_id', params.id),
      admin.from('sapin2_actions').select('*').eq('diagnostic_id', params.id).order('created_at'),
      admin.from('sapin2_notes').select('critere_id, sections').eq('diagnostic_id', params.id),
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

    const wb = new ExcelJS.Workbook()
    wb.creator = "Sens'ethO Apps — Sapin II Diagnostic"
    wb.created = new Date()

    // ─── Onglet 1 : Couverture ────────────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Couverture', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 40 }, { width: 25 }, { width: 25 }]
      ws.getRow(2).height = 50
      merge(ws, 2, 2, 2, 4)
      sc(ws, 2, 2, 'Loi Sapin II — Conformité Anti-Corruption (Loi n°2016-1691)', { bg: C.teal, fg: C.white, bold: true, sz: 13, ha: 'center' })

      let row = 4
      for (const [label, val] of [
        ['Organisation', orgNom], ['SIRET', org?.siret_siege ?? '—'],
        ['Ville', org?.ville ?? '—'], ['Année', String(diag.annee)], ['Date export', dateExport],
      ]) {
        sc(ws, row, 2, label, { bold: true, bg: C.grayL, fg: C.black })
        sc(ws, row, 3, val, { bg: C.white })
        row++
      }

      row++
      sc(ws, row, 2, 'Score de conformité Sapin II', { bold: true, sz: 13, bg: C.teal, fg: C.white, ha: 'center' })
      sc(ws, row, 3, scoreGlobal, { bold: true, sz: 18, bg: C.teal, fg: C.white, ha: 'center' })
      sc(ws, row, 4, `/ 100 — ${badge}`, { bold: true, bg: C.teal, fg: C.white, ha: 'center' })
      ws.getRow(row).height = 35

      row += 2
      sc(ws, row, 2, 'Cadre légal', { bold: true, sz: 11, bg: C.grayL })
      merge(ws, row, 2, row, 4); row++
      for (const line of [
        'Loi n°2016-1691 du 9 décembre 2016 relative à la transparence, à la lutte contre la corruption et à la modernisation de la vie économique',
        'Entreprises concernées : > 500 salariés ET > 100 M€ CA (ou entreprises d\'un groupe répondant à ces critères)',
        'Autorité de contrôle : Agence Française Anticorruption (AFA) — contrôles et mise en demeure',
        'Sanctions AFA : jusqu\'à 200 000 € (personnes physiques) et 1 000 000 € (personnes morales)',
        'Publication de la sanction AFA sur le site de l\'Agence (name & shame)',
      ]) {
        sc(ws, row, 2, `• ${line}`, { sz: 9, bg: C.white, wrap: true, indent: 1 })
        merge(ws, row, 2, row, 4)
        ws.getRow(row).height = 25; row++
      }
    }

    // ─── Onglet 2 : Tableau de bord ───────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Tableau de bord', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 35 }, { width: 12 }, { width: 18 }, { width: 20 }, { width: 16 }]
      sc(ws, 2, 2, 'Synthèse par axe du diagnostic Sapin II', { bold: true, sz: 14, bg: C.teal, fg: C.white, ha: 'center' })
      merge(ws, 2, 2, 2, 6); ws.getRow(2).height = 30

      const headers = ['Axe', 'Poids', 'Score axe', 'Critères évalués', 'Niveau moyen']
      headers.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const axe of SAPIN2_AXES) {
        const clr = AXE_COLORS[axe.id]
        const niveaux = axe.criteres.map(c => reponses[c.id] ?? 0)
        const pct = Math.round(niveaux.reduce((s, n) => s + (SAPIN2_NIVEAUX[n]?.pct ?? 0), 0) / axe.criteres.length * 100)
        const renseignes = niveaux.filter(n => n > 0).length
        const moy = niveaux.reduce((s, n) => s + n, 0) / axe.criteres.length
        sc(ws, row, 2, `${axe.icon} ${axe.label}`, { bg: clr.l, bold: true, sz: 10 })
        sc(ws, row, 3, `${Math.round(axe.weight * 100)}%`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 4, `${pct}%`, { bg: clr.l, bold: true, ha: 'center', fg: pct >= 60 ? C.green : pct >= 30 ? C.amber : C.red })
        sc(ws, row, 5, `${renseignes} / ${axe.criteres.length}`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 6, SAPIN2_NIVEAUX[Math.round(moy)]?.label ?? 'Non conforme', { bg: clr.l, ha: 'center' })
        ws.getRow(row).height = 22; row++
      }
      row += 2
      sc(ws, row, 2, 'Résumé', { bold: true, sz: 12, bg: C.grayL })
      sc(ws, row, 3, `Score global : ${scoreGlobal}/100 — ${badge}`, { bold: true, bg: C.tealL, fg: C.teal })
      merge(ws, row, 3, row, 6); ws.getRow(row).height = 22
    }

    // ─── Onglet 3 : Critères détaillés ───────────────────────────────────────
    {
      const ws = wb.addWorksheet('Critères détaillés', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 28 }, { width: 40 }, { width: 18 }, { width: 12 }, { width: 50 }]
      sc(ws, 2, 2, 'Détail par critère — Diagnostic Sapin II', { bold: true, sz: 14, bg: C.teal, fg: C.white })
      merge(ws, 2, 2, 2, 6); ws.getRow(2).height = 30

      const hdrs = ['Axe', 'Critère', 'Niveau', 'Score (%)', 'Commentaire']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const axe of SAPIN2_AXES) {
        const clr = AXE_COLORS[axe.id]
        for (const c of axe.criteres) {
          const n = reponses[c.id] ?? 0
          const niv = SAPIN2_NIVEAUX[n]
          const pct = Math.round((niv?.pct ?? 0) * 100)
          sc(ws, row, 2, `${axe.icon} ${axe.label}`, { bg: clr.l, sz: 9 })
          sc(ws, row, 3, c.label, { bg: C.white, sz: 9 })
          sc(ws, row, 4, niv?.label ?? 'Non conforme', { bg: C.white, ha: 'center', sz: 9, bold: n > 0 })
          sc(ws, row, 5, pct === 0 ? '—' : `${pct}%`, { bg: C.white, ha: 'center', sz: 9, fg: pct >= 75 ? C.green : pct >= 50 ? C.amber : C.red })
          sc(ws, row, 6, commentaires[c.id] ?? '—', { bg: C.white, sz: 8, wrap: true, indent: 1 })
          ws.getRow(row).height = commentaires[c.id] ? 30 : 18; row++
        }
      }
    }

    // ─── Onglet 4 : Plan d'actions ────────────────────────────────────────────
    {
      const ws = wb.addWorksheet("Plan d'actions", { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 25 }, { width: 35 }, { width: 11 }, { width: 12 }, { width: 14 }, { width: 16 }, { width: 40 }]
      sc(ws, 2, 2, "Plan d'actions — Diagnostic Sapin II", { bold: true, sz: 14, bg: C.teal, fg: C.white })
      merge(ws, 2, 2, 2, 8); ws.getRow(2).height = 30

      const hdrs = ['Axe', 'Action', 'Priorité', 'Statut', 'Échéance', 'Responsable', 'Description']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      const STATUT_LABELS: Record<string, string> = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' }
      const PRIORITE_LABELS: Record<string, string> = { haute: '🔴 Haute', moyenne: '🟡 Moyenne', basse: '🟢 Basse' }

      for (const a of actions as any[]) {
        const axe = SAPIN2_AXES.find(x => x.criteres.some(c => c.id === a.critere_id))
        const clr = axe ? (AXE_COLORS[axe.id] ?? { l: C.grayL }) : { l: C.grayL }
        const statBg = a.statut === 'termine' ? C.greenL : a.statut === 'en_cours' ? C.blueL : C.grayL
        sc(ws, row, 2, axe ? `${axe.icon} ${axe.label}` : a.critere_id, { bg: clr.l, sz: 9 })
        sc(ws, row, 3, a.titre, { bg: C.white, sz: 9, bold: true })
        sc(ws, row, 4, PRIORITE_LABELS[a.priorite] ?? a.priorite, { bg: C.white, ha: 'center', sz: 9 })
        sc(ws, row, 5, STATUT_LABELS[a.statut] ?? a.statut, { bg: statBg, ha: 'center', sz: 9 })
        sc(ws, row, 6, a.echeance ?? '—', { bg: C.white, ha: 'center', sz: 9 })
        sc(ws, row, 7, a.responsable ?? '—', { bg: C.white, ha: 'center', sz: 9 })
        sc(ws, row, 8, a.description ?? '—', { bg: C.white, sz: 8, wrap: true })
        ws.getRow(row).height = 20; row++
      }
      if (actions.length === 0) {
        sc(ws, 5, 2, 'Aucune action créée', { it: true, fg: C.gray, ha: 'center' })
        merge(ws, 5, 2, 5, 8)
      }
    }

    // ─── Onglet 5 : Notes & Annexes ───────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Notes & Annexes', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 8 }, { width: 40 }, { width: 32 }, { width: 16 }, { width: 10 }]

      sc(ws, 2, 2, 'Pièces jointes & Annexes', { bold: true, sz: 14, bg: C.teal, fg: C.white })
      merge(ws, 2, 2, 2, 6)
      ws.getRow(2).height = 30

      sc(ws, 3, 2, 'Note : Les fichiers sont stockés dans SharePoint. Les URLs de téléchargement sont générées à la demande depuis l’application.', { it: true, fg: C.gray, sz: 9 })
      merge(ws, 3, 2, 3, 6)

      const hdrs = ['Réf.', 'Nom du fichier', 'Critère', 'Type', 'Taille']
      hdrs.forEach((h, i) => sc(ws, 5, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      const annexes: { ref: string; name: string; critere: string; mime: string; size: number | null }[] = []
      for (const n of (notesRes.data ?? []) as any[]) {
        const axe = SAPIN2_AXES.find(a => a.criteres.some((c: any) => c.id === n.critere_id)) as any
        const crit = axe?.criteres.find((c: any) => c.id === n.critere_id)
        const critLabel = crit ? `${axe?.icon ?? ''} ${crit.label}`.trim() : (n.critere_id ?? '—')
        for (const s of ((n.sections ?? []) as any[])) {
          for (const att of ((s.attachments ?? []) as any[])) {
            if (att.deleted_at) continue
            const m = /^A(\d{3})_/.exec(att.name ?? '')
            annexes.push({ ref: m ? `A${m[1]}` : '—', name: att.name ?? '—', critere: critLabel, mime: att.mime ?? '—', size: att.size ?? null })
          }
        }
      }
      annexes.sort((a, b) => a.ref.localeCompare(b.ref))

      let row = 6
      for (const a of annexes) {
        sc(ws, row, 2, a.ref, { ha: 'center', sz: 9, bold: true })
        sc(ws, row, 3, a.name, { sz: 9 })
        sc(ws, row, 4, a.critere, { sz: 9 })
        sc(ws, row, 5, a.mime, { ha: 'center', sz: 9 })
        sc(ws, row, 6, a.size ? `${Math.round(a.size / 1024)} Ko` : '—', { ha: 'center', sz: 9 })
        ws.getRow(row).height = 18
        row++
      }
      if (annexes.length === 0) {
        sc(ws, 6, 2, 'Aucune pièce jointe', { it: true, fg: C.gray, ha: 'center' })
        merge(ws, 6, 2, 6, 6)
      }
    }

    // ─── Onglet 6 : Correspondances ───────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Correspondances', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 30 }, { width: 25 }, { width: 60 }]
      sc(ws, 2, 2, 'Correspondances avec les référentiels — Loi Sapin II', { bold: true, sz: 13, bg: C.teal, fg: C.white })
      merge(ws, 2, 2, 2, 4); ws.getRow(2).height = 28

      const hdrs = ['Référentiel', 'Axe Sapin II', 'Correspondance']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      const correspondances = [
        { ref: 'Loi Sapin II (n°2016-1691)',      axe: 'Tous les axes',         corr: 'Loi du 9 décembre 2016 — art. 17 : obligation de programme anti-corruption pour les grandes entreprises' },
        { ref: 'ISO 37001',                        axe: 'Gouvernance + Prévention', corr: 'Norme internationale de management anti-corruption — certification reconnue par l\'AFA comme bonne pratique' },
        { ref: 'Convention OCDE anti-corruption',  axe: 'Gouvernance + Tiers',   corr: 'Convention OCDE 1997 — prévention de la corruption d\'agents publics étrangers dans les transactions commerciales' },
        { ref: 'FCPA (États-Unis)',                axe: 'Gouvernance + Tiers',   corr: 'Foreign Corrupt Practices Act — applicable aux entreprises françaises cotées ou opérant aux États-Unis' },
        { ref: 'UK Bribery Act',                   axe: 'Tiers + Prévention',    corr: 'Loi britannique anti-corruption — applicable aux entreprises ayant des activités au Royaume-Uni' },
        { ref: 'GRI 205 — Anti-corruption',        axe: 'Détection + Gouvernance', corr: 'GRI 205 : disclosure sur les risques, formations, incidents et procédures disciplinaires liés à la corruption' },
        { ref: 'UN SDG 16',                        axe: 'Tous les axes',         corr: 'ODD 16 — Paix, Justice et Institutions efficaces : réduire la corruption et renforcer l\'état de droit' },
        { ref: 'CSRD — ESRS G1 Éthique',          axe: 'Gouvernance + Prévention', corr: 'ESRS G1-1 à G1-4 : politiques anti-corruption, formation, incidents, procédures de vigilance sur les tiers' },
        { ref: 'Devoir de Vigilance (plateforme)', axe: 'Cartographie + Tiers',  corr: 'Loi 2017-399 — cartographie des risques et due diligence tiers complémentaires à Sapin II' },
        { ref: 'EcoVadis (plateforme)',             axe: 'Gouvernance + Tiers',   corr: 'Thème Éthique EcoVadis — code de conduite, anti-corruption, procédures fournisseurs évaluées' },
        { ref: 'VSME EFRAG (plateforme)',          axe: 'Gouvernance',           corr: 'VSME G1 — Gouvernance, gestion des risques et contrôle interne : Sapin II contribue directement' },
      ]

      let row = 5
      for (const c of correspondances) {
        sc(ws, row, 2, c.ref, { bg: C.white, sz: 9, bold: true })
        sc(ws, row, 3, c.axe, { bg: C.tealL, sz: 9 })
        sc(ws, row, 4, c.corr, { bg: C.white, sz: 8, wrap: true })
        ws.getRow(row).height = 22; row++
      }
    }

    const buffer = await wb.xlsx.writeBuffer()
    const filename = `Sapin2_${orgNom.replace(/[^a-z0-9]/gi, '_')}_${diag.annee}.xlsx`

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('[sapin2/export-excel]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

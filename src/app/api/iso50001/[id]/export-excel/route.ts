/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/iso50001/[id]/export-excel
 * Génère un fichier Excel structuré du diagnostic ISO 50001 (Management de l'énergie — ISO 50001:2018).
 *
 * Onglets :
 *  1. Couverture         — org, année, score global, badge de maturité
 *  2. Tableau de bord    — scores par axe, progression
 *  3. Critères détaillés — 20 critères, niveau, commentaire
 *  4. Plan d'actions     — toutes les actions, statut, échéance
 *  5. Notes & Annexes    — documents SharePoint (métadonnées seulement)
 *  6. Correspondances    — liens ISO 26000, CSRD/ESRS E1, GRI 302, ODD, ISO 14001, EN 16247, décret tertiaire, CEE/PRO-SMEn
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─── Colors (palette jaune énergie ISO 50001) ─────────────────────────────────
const C = {
  yellow:  'FFCA8A04', yellowL: 'FFFEF9C3',
  green:   'FF16A34A', greenL:  'FFDCFCE7',
  blue:    'FF2563EB', blueL:   'FFDBEAFE',
  purple:  'FF9333EA', purpleL: 'FFF3E8FF',
  red:     'FFDC2626', redL:    'FFFEE2E2',
  gray:    'FF6B7280', grayL:   'FFF3F4F6',
  white:   'FFFFFFFF', black:   'FF111827', border: 'FFE5E7EB',
  amber:   'FFF97316',
}

const AXE_COLORS: Record<string, { h: string; l: string }> = {
  leadership:    { h: C.yellow, l: C.yellowL },
  planification: { h: C.red,    l: C.redL    },
  support:       { h: C.blue,   l: C.blueL   },
  operations:    { h: C.green,  l: C.greenL  },
  evaluation:    { h: C.purple, l: C.purpleL },
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

// ─── Données statiques ISO 50001 ──────────────────────────────────────────────
const ISO50001_AXES = [
  { id: 'leadership',    label: 'Leadership & Politique énergétique', icon: '🧭', weight: 0.20, criteres: [
    { id: 'i50-lead-engagement', label: "Engagement de la direction et intégration de l'énergie dans la stratégie" },
    { id: 'i50-lead-politique',  label: 'Politique énergétique formalisée, communiquée et revue' },
    { id: 'i50-lead-equipe',     label: "Équipe de management de l'énergie (référent énergie, rôles, compétences)" },
    { id: 'i50-lead-perimetre',  label: "Domaine d'application et périmètre du SMÉ définis et documentés" },
  ]},
  { id: 'planification', label: 'Revue énergétique & Planification', icon: '📋', weight: 0.20, criteres: [
    { id: 'i50-plan-revue',     label: "Revue énergétique : analyse des usages et consommations d'énergie" },
    { id: 'i50-plan-ues',       label: 'Identification des usages énergétiques significatifs (UES) et de leurs facteurs pertinents' },
    { id: 'i50-plan-ipe',       label: "Indicateurs de performance énergétique (IPÉ) et situation énergétique de référence (SER)" },
    { id: 'i50-plan-objectifs', label: "Objectifs, cibles énergétiques et plans d'actions pour les atteindre" },
  ]},
  { id: 'support',       label: 'Support & Compétences', icon: '🛠️', weight: 0.20, criteres: [
    { id: 'i50-sup-ressources',      label: 'Ressources allouées au SMÉ (humaines, techniques, financières, comptage)' },
    { id: 'i50-sup-competences',     label: 'Compétences et formations des personnes influant sur la performance énergétique' },
    { id: 'i50-sup-sensibilisation', label: 'Sensibilisation du personnel aux écogestes et à la politique énergétique' },
    { id: 'i50-sup-documentation',   label: 'Informations documentées du SMÉ (procédures, données énergétiques, traçabilité)' },
  ]},
  { id: 'operations',    label: 'Réalisation opérationnelle', icon: '⚙️', weight: 0.20, criteres: [
    { id: 'i50-ope-maitrise',   label: 'Maîtrise opérationnelle des usages énergétiques significatifs (critères, maintenance, consignes)' },
    { id: 'i50-ope-conception', label: 'Prise en compte de la performance énergétique dans la conception (bâtiments, procédés, équipements)' },
    { id: 'i50-ope-achats',     label: "Achats d'énergie et d'équipements selon des critères de performance énergétique" },
    { id: 'i50-ope-mesure',     label: "Plan de comptage et de mesurage de l'énergie (sous-comptage des UES, télérelève)" },
  ]},
  { id: 'evaluation',    label: 'Évaluation & Amélioration', icon: '📈', weight: 0.20, criteres: [
    { id: 'i50-eval-surveillance', label: 'Surveillance, mesure et analyse des IPÉ et des consommations (dérives, alertes)' },
    { id: 'i50-eval-conformite',   label: "Évaluation de la conformité aux exigences légales (audit énergétique réglementaire, décret tertiaire)" },
    { id: 'i50-eval-audits',       label: 'Audits internes du SMÉ' },
    { id: 'i50-eval-amelioration', label: 'Revue de direction et amélioration continue de la performance énergétique démontrée' },
  ]},
]

const ISO50001_NIVEAUX = [
  { value: 0, label: 'Non traité', pct: 0    },
  { value: 1, label: 'Initié',     pct: 0.25 },
  { value: 2, label: 'Défini',     pct: 0.50 },
  { value: 3, label: 'Maîtrisé',   pct: 0.75 },
  { value: 4, label: 'Optimisé',   pct: 1.00 },
]

const BADGE_LEVELS = [
  { label: 'Performance énergétique exemplaire', min: 85 },
  { label: "Conforme — prêt pour l'audit",       min: 60 },
  { label: 'En construction',                    min: 30 },
  { label: 'Non engagé',                         min: 0  },
]

function calculateScore(niveaux: Record<string, number>): number {
  let total = 0
  for (const axe of ISO50001_AXES) {
    let axeScore = 0
    const nb = axe.criteres.length
    for (const c of axe.criteres) {
      const n = niveaux[c.id] ?? 0
      axeScore += (ISO50001_NIVEAUX[n]?.pct ?? 0) / nb
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
  const { data } = await admin.from('iso50001_diagnostics').select('user_id').eq('id', diagnosticId).single()
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
    const [diagRes, repRes, actRes, notesRes] = await Promise.all([
      admin.from('iso50001_diagnostics').select('*, organisations(denomination, siret_siege, ville)').eq('id', params.id).single(),
      admin.from('iso50001_reponses').select('*').eq('diagnostic_id', params.id),
      admin.from('iso50001_actions').select('*').eq('diagnostic_id', params.id).order('created_at'),
      admin.from('iso50001_notes').select('critere_id, sections').eq('diagnostic_id', params.id),
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
    const badge = BADGE_LEVELS.find(b => scoreGlobal >= b.min)?.label ?? 'Non engagé'
    const org = diag.organisations as { denomination?: string; siret_siege?: string; ville?: string } | null
    const orgNom = org?.denomination ?? 'Organisation'
    const dateExport = new Date().toLocaleDateString('fr-FR')

    // ─── Workbook ────────────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook()
    wb.creator = "Sens'ethO Apps — Diagnostic ISO 50001"
    wb.created = new Date()

    // ─── Onglet 1 : Couverture ────────────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Couverture', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 40 }, { width: 25 }, { width: 25 }]
      ws.getRow(1).height = 20
      ws.getRow(2).height = 50

      merge(ws, 2, 2, 2, 4)
      sc(ws, 2, 2, "Diagnostic ISO 50001 — Management de l'énergie (ISO 50001:2018)", { bg: C.yellow, fg: C.white, bold: true, sz: 13, ha: 'center' })

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
      sc(ws, row, 2, 'Score de maturité ISO 50001', { bold: true, sz: 14, bg: C.yellow, fg: C.white, ha: 'center' })
      sc(ws, row, 3, scoreGlobal, { bold: true, sz: 18, bg: C.yellow, fg: C.white, ha: 'center' })
      sc(ws, row, 4, `/ 100 — ${badge}`, { bold: true, bg: C.yellow, fg: C.white, ha: 'center' })
      ws.getRow(row).height = 35

      row += 2
      sc(ws, row, 2, 'Cadre de référence ISO 50001', { bold: true, sz: 11, bg: C.grayL })
      merge(ws, row, 2, row, 4)
      row++
      const legalLines = [
        'ISO 50001:2018 « Systèmes de management de l’énergie » — exigence distinctive : amélioration continue de la performance énergétique démontrée par les IPÉ',
        'Structure HLS (High Level Structure) commune aux normes ISO 9001, 14001 et 45001 — permet les systèmes de management intégrés',
        'Certification par tierce partie sur un cycle de 3 ans : audit initial puis audits de suivi annuels',
        'France/UE : audit énergétique réglementaire (art. L233-1 code de l’énergie, directive 2012/27/UE révisée 2023/1791) obligatoire tous les 4 ans pour les grandes entreprises — exemption si certifié ISO 50001',
        'Décret tertiaire (Éco Énergie Tertiaire) : -40 % en 2030, -50 % en 2040, -60 % en 2050 pour les bâtiments tertiaires > 1 000 m² (déclaration OPERAT)',
        'Aides : CEE bonifiés via la charte, prime PRO-SMEn jusqu’à 40 000 € pour la certification ISO 50001',
        'Niveaux : NC (Non traité) → 1 (Initié) → 2 (Défini) → 3 (Maîtrisé) → 4 (Optimisé)',
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
      ws.columns = [{ width: 4 }, { width: 42 }, { width: 12 }, { width: 18 }, { width: 20 }, { width: 18 }]

      sc(ws, 2, 2, 'Synthèse par axe du diagnostic ISO 50001', { bold: true, sz: 14, bg: C.yellow, fg: C.white, ha: 'center' })
      merge(ws, 2, 2, 2, 6)
      ws.getRow(2).height = 30

      const headers = ['Axe', 'Poids', 'Score axe', 'Critères évalués', 'Niveau moyen']
      headers.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const axe of ISO50001_AXES) {
        const clr = AXE_COLORS[axe.id]
        const niveaux = axe.criteres.map(c => reponses[c.id] ?? 0)
        const pct = Math.round(niveaux.reduce((s, n) => s + (ISO50001_NIVEAUX[n]?.pct ?? 0), 0) / axe.criteres.length * 100)
        const renseignes = niveaux.filter(n => n > 0).length
        const moy = niveaux.reduce((s, n) => s + n, 0) / axe.criteres.length

        sc(ws, row, 2, `${axe.icon} ${axe.label}`, { bg: clr.l, bold: true, sz: 10 })
        sc(ws, row, 3, `${Math.round(axe.weight * 100)}%`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 4, `${pct}%`, { bg: clr.l, bold: true, ha: 'center', fg: pct >= 60 ? C.green : pct >= 30 ? C.amber : C.red })
        sc(ws, row, 5, `${renseignes} / ${axe.criteres.length}`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 6, ISO50001_NIVEAUX[Math.round(moy)]?.label ?? 'Non traité', { bg: clr.l, ha: 'center' })
        ws.getRow(row).height = 22
        row++
      }

      row += 2
      sc(ws, row, 2, 'Résumé', { bold: true, sz: 12, bg: C.grayL })
      sc(ws, row, 3, `Score global : ${scoreGlobal}/100 — ${badge}`, { bold: true, bg: C.yellowL, fg: C.yellow })
      merge(ws, row, 3, row, 6)
      ws.getRow(row).height = 22
    }

    // ─── Onglet 3 : Critères détaillés ───────────────────────────────────────
    {
      const ws = wb.addWorksheet('Critères détaillés', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 32 }, { width: 50 }, { width: 16 }, { width: 12 }, { width: 50 }]

      sc(ws, 2, 2, 'Détail par critère — Diagnostic ISO 50001', { bold: true, sz: 14, bg: C.yellow, fg: C.white })
      merge(ws, 2, 2, 2, 6)
      ws.getRow(2).height = 30

      const hdrs = ['Axe', 'Critère', 'Niveau', 'Score (%)', 'Commentaire']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const axe of ISO50001_AXES) {
        const clr = AXE_COLORS[axe.id]
        for (const c of axe.criteres) {
          const n = reponses[c.id] ?? 0
          const niv = ISO50001_NIVEAUX[n]
          const pct = Math.round((niv?.pct ?? 0) * 100)
          sc(ws, row, 2, `${axe.icon} ${axe.label}`, { bg: clr.l, sz: 9 })
          sc(ws, row, 3, c.label, { bg: C.white, sz: 9 })
          sc(ws, row, 4, niv?.label ?? 'Non traité', { bg: C.white, ha: 'center', sz: 9, bold: n > 0 })
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
      ws.columns = [{ width: 4 }, { width: 28 }, { width: 30 }, { width: 11 }, { width: 12 }, { width: 14 }, { width: 16 }, { width: 40 }]

      sc(ws, 2, 2, "Plan d'actions — Diagnostic ISO 50001", { bold: true, sz: 14, bg: C.yellow, fg: C.white })
      merge(ws, 2, 2, 2, 8)
      ws.getRow(2).height = 30

      const hdrs = ['Axe', 'Action', 'Priorité', 'Statut', 'Échéance', 'Responsable', 'Description']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      const STATUT_LABELS: Record<string, string> = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' }
      const PRIORITE_LABELS: Record<string, string> = { haute: '🔴 Haute', moyenne: '🟡 Moyenne', basse: '🟢 Basse' }

      for (const a of actions as any[]) {
        const axe = ISO50001_AXES.find(x => x.criteres.some(c => c.id === a.critere_id))
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
      ws.columns = [{ width: 4 }, { width: 8 }, { width: 40 }, { width: 32 }, { width: 16 }, { width: 10 }]

      sc(ws, 2, 2, 'Pièces jointes & Annexes', { bold: true, sz: 14, bg: C.yellow, fg: C.white })
      merge(ws, 2, 2, 2, 6)
      ws.getRow(2).height = 30

      sc(ws, 3, 2, 'Note : Les fichiers sont stockés dans SharePoint. Les URLs de téléchargement sont générées à la demande depuis l’application.', { it: true, fg: C.gray, sz: 9 })
      merge(ws, 3, 2, 3, 6)

      const hdrs = ['Réf.', 'Nom du fichier', 'Critère', 'Type', 'Taille']
      hdrs.forEach((h, i) => sc(ws, 5, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      const annexes: { ref: string; name: string; critere: string; mime: string; size: number | null }[] = []
      for (const n of (notesRes.data ?? []) as any[]) {
        const axe = ISO50001_AXES.find(a => a.criteres.some((c: any) => c.id === n.critere_id)) as any
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
      ws.columns = [{ width: 4 }, { width: 32 }, { width: 30 }, { width: 60 }]

      sc(ws, 2, 2, 'Correspondances avec les référentiels — Diagnostic ISO 50001', { bold: true, sz: 13, bg: C.yellow, fg: C.white })
      merge(ws, 2, 2, 2, 4)
      ws.getRow(2).height = 28

      const hdrs = ['Référentiel', 'Axe ISO 50001', 'Correspondance']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      const correspondances = [
        { ref: 'ISO 14001 / ISO 9001 / ISO 45001 — SMI', axe: 'Tous les axes', corr: 'Structure HLS commune : politique, planification, support, réalisation opérationnelle, évaluation des performances et amélioration — permet un système de management intégré environnement-énergie-qualité-SST' },
        { ref: 'ISO 26000', axe: 'Tous les axes', corr: 'Lignes directrices de la responsabilité sociétale — domaines d’action « utilisation durable des ressources » et « atténuation du changement climatique » de la question centrale Environnement' },
        { ref: 'CSRD — ESRS E1', axe: 'Tous les axes', corr: 'Reporting de durabilité : ESRS E1 Changement climatique — consommation d’énergie et mix énergétique (E1-5), plans de transition, objectifs de réduction' },
        { ref: 'GRI 302 — Énergie', axe: 'Tous les axes', corr: 'GRI 302 : consommation d’énergie (302-1, 302-2), intensité énergétique (302-3), réduction de la consommation (302-4) et des besoins énergétiques des produits et services (302-5)' },
        { ref: 'ODD 7, 9, 12 et 13 — Nations Unies', axe: 'Tous les axes', corr: 'ODD 7 (énergie propre, cible 7.3 : efficacité énergétique), ODD 9 (industrie durable), ODD 12 (consommation responsable) et ODD 13 (lutte contre le changement climatique)' },
        { ref: 'Audit énergétique EN 16247 (art. L233-1)', axe: 'Revue énergétique & Planification', corr: 'Audit énergétique réglementaire obligatoire tous les 4 ans pour les grandes entreprises (directive 2012/27/UE révisée 2023/1791) — exemption pour les organismes certifiés ISO 50001' },
        { ref: 'Décret tertiaire — Éco Énergie Tertiaire', axe: 'Évaluation & Amélioration', corr: 'Réduction des consommations des bâtiments tertiaires > 1 000 m² : -40 % en 2030, -50 % en 2040, -60 % en 2050 — déclaration annuelle OPERAT, le SMÉ structure le suivi et le plan d’actions' },
        { ref: 'Directive efficacité énergétique (UE) 2023/1791', axe: 'Tous les axes', corr: 'Renforcement des obligations d’audit énergétique et de systèmes de management de l’énergie selon les seuils de consommation — l’ISO 50001 est la réponse de référence pour les gros consommateurs' },
        { ref: 'CEE & PRO-SMEn', axe: 'Réalisation opérationnelle', corr: 'Certificats d’économies d’énergie : financement des actions d’efficacité énergétique (CEE bonifiés via la charte) et prime PRO-SMEn jusqu’à 40 000 € pour la certification ISO 50001' },
      ]

      let row = 5
      for (const c of correspondances) {
        sc(ws, row, 2, c.ref, { bg: C.white, sz: 9, bold: true })
        sc(ws, row, 3, c.axe, { bg: C.yellowL, sz: 9 })
        sc(ws, row, 4, c.corr, { bg: C.white, sz: 8, wrap: true })
        ws.getRow(row).height = 22
        row++
      }
    }

    // ─── Export ───────────────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer()
    const filename = `ISO50001_${orgNom.replace(/[^a-z0-9]/gi, '_')}_${diag.annee}.xlsx`

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('[iso50001/export-excel]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

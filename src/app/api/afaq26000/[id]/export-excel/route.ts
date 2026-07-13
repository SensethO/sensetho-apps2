/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/afaq26000/[id]/export-excel
 * Génère un fichier Excel structuré de l'évaluation AFAQ 26000 (modèle d'évaluation RSE AFNOR Certification, 1000 points).
 *
 * Onglets :
 *  1. Couverture         — org, année, score global, badge AFAQ 26000
 *  2. Tableau de bord    — scores par axe, progression
 *  3. Critères détaillés — 20 critères, niveau, commentaire
 *  4. Plan d'actions     — toutes les actions, statut, échéance
 *  5. Notes & Annexes    — documents SharePoint (métadonnées seulement)
 *  6. Correspondances    — liens label Engagé RSE, ISO 26000, CSRD/ESRS, GRI, ODD, EFQM, Lucie 26000, B Corp
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─── Colors (palette violette AFNOR AFAQ 26000) ───────────────────────────────
const C = {
  violet:  'FF7C3AED', violetL: 'FFEDE9FE',
  green:   'FF16A34A', greenL:  'FFDCFCE7',
  blue:    'FF2563EB', blueL:   'FFDBEAFE',
  teal:    'FF0D9488', tealL:   'FFCCFBF1',
  orange:  'FFEA580C', orangeL: 'FFFFEDD5',
  red:     'FFDC2626',
  gray:    'FF6B7280', grayL:   'FFF3F4F6',
  white:   'FFFFFFFF', black:   'FF111827', border: 'FFE5E7EB',
  amber:   'FFF97316',
}

const AXE_COLORS: Record<string, { h: string; l: string }> = {
  gouvernance:   { h: C.violet, l: C.violetL },
  integration:   { h: C.blue,   l: C.blueL   },
  rh:            { h: C.green,  l: C.greenL  },
  environnement: { h: C.teal,   l: C.tealL   },
  territorial:   { h: C.orange, l: C.orangeL },
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

// ─── Données statiques AFAQ 26000 ─────────────────────────────────────────────
const AFAQ26000_AXES = [
  { id: 'gouvernance',   label: 'Vision & Gouvernance', icon: '🧭', weight: 0.20, criteres: [
    { id: 'afq-vis-strategie',  label: "Vision et stratégie RSE intégrées au modèle d'affaires" },
    { id: 'afq-vis-gouvernance', label: 'Gouvernance, éthique des affaires et loyauté des pratiques' },
    { id: 'afq-vis-deploiement', label: "Déploiement de la stratégie RSE (objectifs, plans d'actions, pilotage)" },
    { id: 'afq-vis-risques',     label: 'Analyse des enjeux, risques et opportunités RSE (matérialité, parties prenantes)' },
  ]},
  { id: 'integration',   label: 'Intégration RSE & Communication', icon: '📣', weight: 0.20, criteres: [
    { id: 'afq-int-processus',     label: 'Intégration de la RSE dans les processus et métiers (qualité, innovation, support)' },
    { id: 'afq-int-parties',       label: 'Identification et dialogue avec les parties prenantes' },
    { id: 'afq-int-communication', label: 'Communication interne et externe responsable (transparence, anti-greenwashing)' },
    { id: 'afq-int-achats',        label: 'Achats responsables et relations fournisseurs équitables' },
  ]},
  { id: 'rh',            label: 'Ressources humaines & Relations de travail', icon: '👥', weight: 0.20, criteres: [
    { id: 'afq-rh-emploi',      label: "Politique d'emploi responsable (recrutement, diversité, insertion)" },
    { id: 'afq-rh-conditions',  label: 'Conditions de travail, santé-sécurité et qualité de vie au travail' },
    { id: 'afq-rh-dialogue',    label: 'Dialogue social et participation des salariés' },
    { id: 'afq-rh-competences', label: 'Développement des compétences et employabilité' },
  ]},
  { id: 'environnement', label: 'Production, Consommation durables & Environnement', icon: '🌍', weight: 0.20, criteres: [
    { id: 'afq-env-management', label: 'Management environnemental (politique, conformité, prévention des pollutions)' },
    { id: 'afq-env-ressources', label: 'Utilisation durable des ressources (énergie, eau, matières, économie circulaire)' },
    { id: 'afq-env-climat',     label: 'Atténuation et adaptation au changement climatique (GES, trajectoire)' },
    { id: 'afq-env-produits',   label: 'Écoconception, cycle de vie des produits/services et consommation responsable' },
  ]},
  { id: 'territorial',   label: 'Ancrage territorial & Résultats', icon: '📊', weight: 0.20, criteres: [
    { id: 'afq-ter-ancrage',       label: 'Ancrage territorial : contribution au développement local, emploi, partenariats' },
    { id: 'afq-ter-resultats-env', label: 'Résultats environnementaux mesurés et tendances (indicateurs, comparaisons)' },
    { id: 'afq-ter-resultats-soc', label: 'Résultats sociaux mesurés (climat social, accidentologie, formation, diversité)' },
    { id: 'afq-ter-resultats-eco', label: 'Résultats économiques et redistribution de la valeur aux parties prenantes' },
  ]},
]

const AFAQ26000_NIVEAUX = [
  { value: 0, label: 'Non engagé',         pct: 0    },
  { value: 1, label: 'Engagement initial', pct: 0.25 },
  { value: 2, label: 'Progression',        pct: 0.50 },
  { value: 3, label: 'Confirmé',           pct: 0.75 },
  { value: 4, label: 'Exemplaire',         pct: 1.00 },
]

const BADGE_LEVELS = [
  { label: 'Exemplaire',         min: 85 },
  { label: 'Confirmé',           min: 60 },
  { label: 'Progression',        min: 30 },
  { label: 'Engagement initial', min: 0  },
]

function calculateScore(niveaux: Record<string, number>): number {
  let total = 0
  for (const axe of AFAQ26000_AXES) {
    let axeScore = 0
    const nb = axe.criteres.length
    for (const c of axe.criteres) {
      const n = niveaux[c.id] ?? 0
      axeScore += (AFAQ26000_NIVEAUX[n]?.pct ?? 0) / nb
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
  const { data } = await admin.from('afaq26000_diagnostics').select('user_id').eq('id', diagnosticId).single()
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
      admin.from('afaq26000_diagnostics').select('*, organisations(denomination, siret_siege, ville)').eq('id', params.id).single(),
      admin.from('afaq26000_reponses').select('*').eq('diagnostic_id', params.id),
      admin.from('afaq26000_actions').select('*').eq('diagnostic_id', params.id).order('created_at'),
      admin.from('afaq26000_notes').select('critere_id, sections').eq('diagnostic_id', params.id),
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
    const badge = BADGE_LEVELS.find(b => scoreGlobal >= b.min)?.label ?? 'Engagement initial'
    const org = diag.organisations as { denomination?: string; siret_siege?: string; ville?: string } | null
    const orgNom = org?.denomination ?? 'Organisation'
    const dateExport = new Date().toLocaleDateString('fr-FR')

    // ─── Workbook ────────────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook()
    wb.creator = "Sens'ethO Apps — Évaluation AFAQ 26000"
    wb.created = new Date()

    // ─── Onglet 1 : Couverture ────────────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Couverture', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 40 }, { width: 25 }, { width: 25 }]
      ws.getRow(1).height = 20
      ws.getRow(2).height = 50

      merge(ws, 2, 2, 2, 4)
      sc(ws, 2, 2, "Évaluation AFAQ 26000 — Modèle d'évaluation RSE AFNOR Certification (1000 points)", { bg: C.violet, fg: C.white, bold: true, sz: 13, ha: 'center' })

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
      sc(ws, row, 2, 'Score AFAQ 26000', { bold: true, sz: 14, bg: C.violet, fg: C.white, ha: 'center' })
      sc(ws, row, 3, scoreGlobal, { bold: true, sz: 18, bg: C.violet, fg: C.white, ha: 'center' })
      sc(ws, row, 4, `/ 100 (≈ ${scoreGlobal * 10} / 1000 pts) — ${badge}`, { bold: true, bg: C.violet, fg: C.white, ha: 'center' })
      ws.getRow(row).height = 35

      row += 2
      sc(ws, row, 2, 'Cadre de référence AFAQ 26000', { bold: true, sz: 11, bg: C.grayL })
      merge(ws, row, 2, row, 4)
      row++
      const legalLines = [
        'AFAQ 26000 — modèle d’évaluation de la responsabilité sociétale d’AFNOR Certification, fondé sur les lignes directrices de l’ISO 26000:2010',
        'Notation sur 1000 points : 5 critères de pratiques (vision et gouvernance, intégration RSE et communication, RH et relations de travail, production-consommation durables et environnement, ancrage territorial) et 3 critères de résultats (environnementaux, sociaux, économiques)',
        '4 niveaux selon le score : Engagement initial (< 300 pts), Progression (300-500), Confirmé (500-700), Exemplaire (> 700)',
        'Évaluation sur site par des évaluateurs AFNOR Certification — entretiens, analyse documentaire, observation des pratiques',
        'Validité 3 ans avec une évaluation de suivi à 18 mois',
        'AFAQ 26000 est le moteur d’évaluation du label Engagé RSE d’AFNOR Certification',
        'Niveaux d’auto-évaluation : NC (Non engagé) → 1 (Engagement initial) → 2 (Progression) → 3 (Confirmé) → 4 (Exemplaire)',
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

      sc(ws, 2, 2, "Synthèse par axe de l'évaluation AFAQ 26000", { bold: true, sz: 14, bg: C.violet, fg: C.white, ha: 'center' })
      merge(ws, 2, 2, 2, 6)
      ws.getRow(2).height = 30

      const headers = ['Axe', 'Poids', 'Score axe', 'Critères évalués', 'Niveau moyen']
      headers.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const axe of AFAQ26000_AXES) {
        const clr = AXE_COLORS[axe.id]
        const niveaux = axe.criteres.map(c => reponses[c.id] ?? 0)
        const pct = Math.round(niveaux.reduce((s, n) => s + (AFAQ26000_NIVEAUX[n]?.pct ?? 0), 0) / axe.criteres.length * 100)
        const renseignes = niveaux.filter(n => n > 0).length
        const moy = niveaux.reduce((s, n) => s + n, 0) / axe.criteres.length

        sc(ws, row, 2, `${axe.icon} ${axe.label}`, { bg: clr.l, bold: true, sz: 10 })
        sc(ws, row, 3, `${Math.round(axe.weight * 100)}%`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 4, `${pct}%`, { bg: clr.l, bold: true, ha: 'center', fg: pct >= 60 ? C.green : pct >= 30 ? C.amber : C.red })
        sc(ws, row, 5, `${renseignes} / ${axe.criteres.length}`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 6, AFAQ26000_NIVEAUX[Math.round(moy)]?.label ?? 'Non engagé', { bg: clr.l, ha: 'center' })
        ws.getRow(row).height = 22
        row++
      }

      row += 2
      sc(ws, row, 2, 'Résumé', { bold: true, sz: 12, bg: C.grayL })
      sc(ws, row, 3, `Score global : ${scoreGlobal}/100 (≈ ${scoreGlobal * 10}/1000 pts) — ${badge}`, { bold: true, bg: C.violetL, fg: C.violet })
      merge(ws, row, 3, row, 6)
      ws.getRow(row).height = 22
    }

    // ─── Onglet 3 : Critères détaillés ───────────────────────────────────────
    {
      const ws = wb.addWorksheet('Critères détaillés', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 32 }, { width: 50 }, { width: 16 }, { width: 12 }, { width: 50 }]

      sc(ws, 2, 2, 'Détail par critère — Évaluation AFAQ 26000', { bold: true, sz: 14, bg: C.violet, fg: C.white })
      merge(ws, 2, 2, 2, 6)
      ws.getRow(2).height = 30

      const hdrs = ['Axe', 'Critère', 'Niveau', 'Score (%)', 'Commentaire']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const axe of AFAQ26000_AXES) {
        const clr = AXE_COLORS[axe.id]
        for (const c of axe.criteres) {
          const n = reponses[c.id] ?? 0
          const niv = AFAQ26000_NIVEAUX[n]
          const pct = Math.round((niv?.pct ?? 0) * 100)
          sc(ws, row, 2, `${axe.icon} ${axe.label}`, { bg: clr.l, sz: 9 })
          sc(ws, row, 3, c.label, { bg: C.white, sz: 9 })
          sc(ws, row, 4, niv?.label ?? 'Non engagé', { bg: C.white, ha: 'center', sz: 9, bold: n > 0 })
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

      sc(ws, 2, 2, "Plan d'actions — Évaluation AFAQ 26000", { bold: true, sz: 14, bg: C.violet, fg: C.white })
      merge(ws, 2, 2, 2, 8)
      ws.getRow(2).height = 30

      const hdrs = ['Axe', 'Action', 'Priorité', 'Statut', 'Échéance', 'Responsable', 'Description']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      const STATUT_LABELS: Record<string, string> = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' }
      const PRIORITE_LABELS: Record<string, string> = { haute: '🔴 Haute', moyenne: '🟡 Moyenne', basse: '🟢 Basse' }

      for (const a of actions as any[]) {
        const axe = AFAQ26000_AXES.find(x => x.criteres.some(c => c.id === a.critere_id))
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

      sc(ws, 2, 2, 'Pièces jointes & Annexes', { bold: true, sz: 14, bg: C.violet, fg: C.white })
      merge(ws, 2, 2, 2, 6)
      ws.getRow(2).height = 30

      sc(ws, 3, 2, 'Note : Les fichiers sont stockés dans SharePoint. Les URLs de téléchargement sont générées à la demande depuis l’application.', { it: true, fg: C.gray, sz: 9 })
      merge(ws, 3, 2, 3, 6)

      const hdrs = ['Réf.', 'Nom du fichier', 'Critère', 'Type', 'Taille']
      hdrs.forEach((h, i) => sc(ws, 5, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      const annexes: { ref: string; name: string; critere: string; mime: string; size: number | null }[] = []
      for (const n of (notesRes.data ?? []) as any[]) {
        const axe = AFAQ26000_AXES.find(a => a.criteres.some((c: any) => c.id === n.critere_id)) as any
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

      sc(ws, 2, 2, 'Correspondances avec les référentiels — Évaluation AFAQ 26000', { bold: true, sz: 13, bg: C.violet, fg: C.white })
      merge(ws, 2, 2, 2, 4)
      ws.getRow(2).height = 28

      const hdrs = ['Référentiel', 'Axe AFAQ 26000', 'Correspondance']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      const correspondances = [
        { ref: 'Label Engagé RSE — AFNOR Certification', axe: 'Tous les axes', corr: 'Lien fort : AFAQ 26000 est le moteur d’évaluation du label Engagé RSE — le score sur 1000 points détermine le niveau du label (Engagement initial < 300, Progression 300-500, Confirmé 500-700, Exemplaire > 700), validité 3 ans avec suivi à 18 mois' },
        { ref: 'ISO 26000:2010 — fondement', axe: 'Tous les axes', corr: 'Lignes directrices de la responsabilité sociétale : les 7 questions centrales (gouvernance, droits de l’Homme, relations et conditions de travail, environnement, loyauté des pratiques, consommateurs, communautés et développement local) fondent la grille AFAQ 26000' },
        { ref: 'CSRD — ESRS', axe: 'Vision & Gouvernance / Résultats', corr: 'Reporting de durabilité européen : double matérialité (ESRS 2), indicateurs environnementaux (ESRS E) et sociaux (ESRS S) — les données collectées documentent les critères de résultats AFAQ 26000' },
        { ref: 'GRI Standards', axe: 'Ancrage territorial & Résultats', corr: 'Référentiel international de reporting extra-financier : GRI 200 (économique), GRI 300 (environnement), GRI 400 (social) — fournit les indicateurs des critères de résultats' },
        { ref: 'ODD — Nations Unies', axe: 'Tous les axes', corr: 'Les 17 Objectifs de Développement Durable donnent un cadre universel de contribution — la grille AFAQ 26000 valorise l’alignement de la stratégie RSE et des résultats sur les ODD matériels' },
        { ref: 'EFQM — Modèle d’excellence', axe: 'Tous les axes', corr: 'Le modèle d’excellence européen partage la structure pratiques/résultats et la notation sur 1000 points : direction-exécution-résultats et logique RADAR d’évaluation de la maturité' },
        { ref: 'Lucie 26000', axe: 'Tous les axes', corr: 'Label RSE alternatif également fondé sur l’ISO 26000 : 7 engagements et 28 principes d’action — les acquis d’une labellisation Lucie sont transposables vers AFAQ 26000' },
        { ref: 'B Corp', axe: 'Vision & Gouvernance / Territorial', corr: 'Le B Impact Assessment (gouvernance, collaborateurs, communauté, environnement, clients, seuil 80 points) suit une logique de scoring d’impact comparable à la notation AFAQ 26000' },
        { ref: 'EcoVadis', axe: 'Intégration RSE / Résultats', corr: 'La notation EcoVadis (Environnement, Social & Droits humains, Éthique, Achats responsables) recoupe la grille AFAQ 26000 — une évaluation AFAQ 26000 est une preuve valorisée dans le questionnaire EcoVadis' },
      ]

      let row = 5
      for (const c of correspondances) {
        sc(ws, row, 2, c.ref, { bg: C.white, sz: 9, bold: true })
        sc(ws, row, 3, c.axe, { bg: C.violetL, sz: 9 })
        sc(ws, row, 4, c.corr, { bg: C.white, sz: 8, wrap: true })
        ws.getRow(row).height = 22
        row++
      }
    }

    // ─── Export ───────────────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer()
    const filename = `AFAQ26000_${orgNom.replace(/[^a-z0-9]/gi, '_')}_${diag.annee}.xlsx`

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('[afaq26000/export-excel]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

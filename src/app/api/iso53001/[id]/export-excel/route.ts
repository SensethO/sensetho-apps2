/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/iso53001/[id]/export-excel
 * Génère un fichier Excel structuré du diagnostic ISO 53001 — Management des ODD.
 *
 * Onglets :
 *  1. Couverture         — org, année, score global, badge de conformité
 *  2. Tableau de bord    — scores par axe, progression
 *  3. Critères détaillés — 20 critères, niveau, commentaire
 *  4. Plan d'actions     — toutes les actions, statut, échéance
 *  5. Notes & Annexes    — documents SharePoint (métadonnées)
 *  6. Correspondances    — liens Agenda 2030, PAS 53002, ISO 26000, CSRD/ESRS, GRI, SDG Compass
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
  contexte:      { h: C.teal,   l: C.tealL   },
  leadership:    { h: C.purple, l: C.purpleL },
  planification: { h: C.amber,  l: C.amberL  },
  operation:     { h: C.green,  l: C.greenL  },
  evaluation:    { h: C.red,    l: C.redL    },
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

// IDs alignés sur ISO53001_AXES du composant Iso53001DiagnosticApp.tsx (source de vérité)
const AXES = [
  { id: 'contexte',      label: 'Contexte & Parties prenantes', icon: '🌍', weight: 0.20, criteres: [
    { id: 'ctx-enjeux',        label: 'Compréhension des ODD et du contexte' },
    { id: 'ctx-impacts',       label: 'Identification des impacts sur les ODD' },
    { id: 'ctx-parties',       label: 'Parties prenantes et attentes' },
    { id: 'ctx-priorisation',  label: 'Priorisation des ODD matériels' },
  ]},
  { id: 'leadership',    label: 'Leadership & Gouvernance',     icon: '🧭', weight: 0.20, criteres: [
    { id: 'lead-engagement',   label: 'Engagement de la direction' },
    { id: 'lead-politique',    label: 'Politique ODD formalisée' },
    { id: 'lead-roles',        label: 'Rôles, responsabilités et ressources' },
    { id: 'lead-culture',      label: 'Culture, communication et exemplarité' },
  ]},
  { id: 'planification', label: 'Planification ODD',            icon: '📐', weight: 0.20, criteres: [
    { id: 'plan-risques',      label: 'Risques et opportunités' },
    { id: 'plan-objectifs',    label: 'Objectifs ODD mesurables' },
    { id: 'plan-integration',  label: 'Intégration à la stratégie' },
    { id: 'plan-moyens',       label: "Plans d'action et moyens" },
  ]},
  { id: 'operation',     label: 'Opération & Support',          icon: '⚙️', weight: 0.20, criteres: [
    { id: 'op-processus',      label: 'Maîtrise opérationnelle' },
    { id: 'op-competences',    label: 'Compétences, formation et sensibilisation' },
    { id: 'op-chaine',         label: 'Chaîne de valeur et achats responsables' },
    { id: 'op-innovation',     label: 'Partenariats et innovation (ODD 17)' },
  ]},
  { id: 'evaluation',    label: 'Évaluation & Amélioration',    icon: '📊', weight: 0.20, criteres: [
    { id: 'eval-indicateurs',  label: 'Indicateurs et mesure de la contribution' },
    { id: 'eval-surveillance', label: 'Surveillance et audit interne' },
    { id: 'eval-revue',        label: 'Revue de direction et reporting' },
    { id: 'eval-amelioration', label: 'Amélioration continue' },
  ]},
]

const NIVEAUX = [
  { value: 0, label: 'Inexistant',        pct: 0    },
  { value: 1, label: 'Initial',           pct: 0.25 },
  { value: 2, label: 'En développement',  pct: 0.50 },
  { value: 3, label: 'Conforme',          pct: 0.75 },
  { value: 4, label: 'Exemplaire',        pct: 1.00 },
]

const BADGE_LEVELS = [
  { label: 'Exemplaire',       min: 85 },
  { label: 'Conforme',         min: 60 },
  { label: 'En développement', min: 30 },
  { label: 'Insuffisant',      min: 0  },
]

function calculateScore(niveaux: Record<string, number>): number {
  let total = 0
  for (const axe of AXES) {
    let axeScore = 0
    const nb = axe.criteres.length
    for (const c of axe.criteres) {
      const n = niveaux[c.id] ?? 0
      axeScore += (NIVEAUX[n]?.pct ?? 0) / nb
    }
    total += axeScore * axe.weight
  }
  return Math.round(total * 100)
}

async function canAccess(userId: string, diagnosticId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data } = await admin.from('iso53001_diagnostics').select('user_id').eq('id', diagnosticId).single()
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
      admin.from('iso53001_diagnostics').select('*, organisations(denomination, siret_siege, ville)').eq('id', params.id).single(),
      admin.from('iso53001_reponses').select('*').eq('diagnostic_id', params.id),
      admin.from('iso53001_actions').select('*').eq('diagnostic_id', params.id).order('created_at'),
      admin.from('iso53001_notes').select('critere_id, sections').eq('diagnostic_id', params.id),
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

    const wb = new ExcelJS.Workbook()
    wb.creator = "Sens'ethO Apps — ISO 53001 Diagnostic"
    wb.created = new Date()

    // ─── Onglet 1 : Couverture ────────────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Couverture', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 40 }, { width: 25 }, { width: 25 }]
      ws.getRow(2).height = 50
      merge(ws, 2, 2, 2, 4)
      sc(ws, 2, 2, 'ISO/UNDP 53001 — Système de management des ODD (base PAS 53002:2024)', { bg: C.teal, fg: C.white, bold: true, sz: 13, ha: 'center' })

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
      sc(ws, row, 2, 'Score de maturité ODD', { bold: true, sz: 13, bg: C.teal, fg: C.white, ha: 'center' })
      sc(ws, row, 3, scoreGlobal, { bold: true, sz: 18, bg: C.teal, fg: C.white, ha: 'center' })
      sc(ws, row, 4, `/ 100 — ${badge}`, { bold: true, bg: C.teal, fg: C.white, ha: 'center' })
      ws.getRow(row).height = 35

      row += 2
      sc(ws, row, 2, 'Statut de la norme', { bold: true, sz: 11, bg: C.grayL })
      merge(ws, row, 2, row, 4); row++
      for (const line of [
        'PAS 53002:2024 — lignes directrices publiées (téléchargement gratuit), base du présent diagnostic',
        'ISO 53001 — norme certifiable co-écrite par l\'ISO et le PNUD, publication attendue en 2026 (enquête publique passée)',
        'Structure harmonisée HLS : compatible ISO 9001, ISO 14001, ISO 45001 — intégrable au système de management existant',
        'Démarche volontaire ouverte à toute organisation, quelle que soit sa taille ou son secteur',
        'Synergie reporting : les données du diagnostic alimentent CSRD/ESRS, VSME et le reporting GRI',
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
      sc(ws, 2, 2, 'Synthèse par axe du diagnostic ISO 53001', { bold: true, sz: 14, bg: C.teal, fg: C.white, ha: 'center' })
      merge(ws, 2, 2, 2, 6); ws.getRow(2).height = 30

      const headers = ['Axe', 'Poids', 'Score axe', 'Critères évalués', 'Niveau moyen']
      headers.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const axe of AXES) {
        const clr = AXE_COLORS[axe.id]
        const niveaux = axe.criteres.map(c => reponses[c.id] ?? 0)
        const pct = Math.round(niveaux.reduce((s, n) => s + (NIVEAUX[n]?.pct ?? 0), 0) / axe.criteres.length * 100)
        const renseignes = niveaux.filter(n => n > 0).length
        const moy = niveaux.reduce((s, n) => s + n, 0) / axe.criteres.length
        sc(ws, row, 2, `${axe.icon} ${axe.label}`, { bg: clr.l, bold: true, sz: 10 })
        sc(ws, row, 3, `${Math.round(axe.weight * 100)}%`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 4, `${pct}%`, { bg: clr.l, bold: true, ha: 'center', fg: pct >= 60 ? C.green : pct >= 30 ? C.amber : C.red })
        sc(ws, row, 5, `${renseignes} / ${axe.criteres.length}`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 6, NIVEAUX[Math.round(moy)]?.label ?? 'Inexistant', { bg: clr.l, ha: 'center' })
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
      sc(ws, 2, 2, 'Détail par critère — Diagnostic ISO 53001', { bold: true, sz: 14, bg: C.teal, fg: C.white })
      merge(ws, 2, 2, 2, 6); ws.getRow(2).height = 30

      const hdrs = ['Axe', 'Critère', 'Niveau', 'Score (%)', 'Commentaire']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const axe of AXES) {
        const clr = AXE_COLORS[axe.id]
        for (const c of axe.criteres) {
          const n = reponses[c.id] ?? 0
          const niv = NIVEAUX[n]
          const pct = Math.round((niv?.pct ?? 0) * 100)
          sc(ws, row, 2, `${axe.icon} ${axe.label}`, { bg: clr.l, sz: 9 })
          sc(ws, row, 3, c.label, { bg: C.white, sz: 9 })
          sc(ws, row, 4, niv?.label ?? 'Inexistant', { bg: C.white, ha: 'center', sz: 9, bold: n > 0 })
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
      sc(ws, 2, 2, "Plan d'actions — Diagnostic ISO 53001", { bold: true, sz: 14, bg: C.teal, fg: C.white })
      merge(ws, 2, 2, 2, 8); ws.getRow(2).height = 30

      const hdrs = ['Axe', 'Action', 'Priorité', 'Statut', 'Échéance', 'Responsable', 'Description']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      const STATUT_LABELS: Record<string, string> = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' }
      const PRIORITE_LABELS: Record<string, string> = { haute: '🔴 Haute', moyenne: '🟡 Moyenne', basse: '🟢 Basse' }

      for (const a of actions as any[]) {
        const axe = AXES.find(x => x.criteres.some(c => c.id === a.critere_id))
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
        const axe = AXES.find(a => a.criteres.some((c: any) => c.id === n.critere_id)) as any
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
      sc(ws, 2, 2, 'Correspondances avec les référentiels — ISO 53001 (ODD)', { bold: true, sz: 13, bg: C.teal, fg: C.white })
      merge(ws, 2, 2, 2, 4); ws.getRow(2).height = 28

      const hdrs = ['Référentiel', 'Axe ISO 53001', 'Correspondance']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      const correspondances = [
        { ref: 'Agenda 2030 — 17 ODD (ONU)',       axe: 'Tous les axes',              corr: 'Résolution ONU 2015 : les 17 Objectifs de Développement Durable et leurs 169 cibles — cadre de référence du diagnostic' },
        { ref: 'PAS 53002:2024',                   axe: 'Tous les axes',              corr: 'Lignes directrices publiées (gratuites) pour contribuer aux ODD — base directe des 20 critères du diagnostic' },
        { ref: 'ISO 26000',                        axe: 'Contexte + Leadership',      corr: 'Lignes directrices sur la responsabilité sociétale — les 7 questions centrales nourrissent l\'analyse de contexte et la gouvernance ODD' },
        { ref: 'CSRD — ESRS',                      axe: 'Planification + Évaluation', corr: 'Double matérialité ESRS et plans de transition : les objectifs et indicateurs ODD alimentent directement le reporting de durabilité' },
        { ref: 'GRI + SDG mapping',                axe: 'Évaluation',                 corr: 'Tables de correspondance officielles GRI ↔ ODD : chaque disclosure GRI est reliée aux cibles ODD pour le reporting' },
        { ref: 'SDG Compass',                      axe: 'Planification + Opération',  corr: 'Guide GRI / Pacte mondial / WBCSD en 5 étapes pour aligner la stratégie d\'entreprise sur les ODD' },
        { ref: 'ISO 26000 & ODD (plateforme)',     axe: 'Contexte',                   corr: 'Le diagnostic ISO 26000 de la plateforme identifie les domaines d\'action prioritaires reliés aux ODD' },
        { ref: 'VSME EFRAG (plateforme)',          axe: 'Évaluation',                 corr: 'Le rapport VSME structure les indicateurs de durabilité des PME — réutilise les données du diagnostic ODD' },
        { ref: 'Bilan GES (plateforme)',           axe: 'Opération + Évaluation',     corr: 'Mesure des émissions carbone — contribution directe aux ODD 7, 12 et 13 (énergie, consommation, climat)' },
        { ref: 'Devoir de Vigilance (plateforme)', axe: 'Opération',                  corr: 'Cartographie des risques chaîne de valeur — contribution aux ODD 8 et 12 (travail décent, production responsable)' },
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
    const filename = `Iso53001_${orgNom.replace(/[^a-z0-9]/gi, '_')}_${diag.annee}.xlsx`

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('[iso53001/export-excel]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

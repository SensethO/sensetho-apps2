/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/iso45001/[id]/export-excel
 * Génère un fichier Excel structuré du diagnostic ISO 45001 (SST — ISO 45001:2018).
 *
 * Onglets :
 *  1. Couverture         — org, année, score global, badge de maturité
 *  2. Tableau de bord    — scores par axe, progression
 *  3. Critères détaillés — 20 critères, niveau, commentaire
 *  4. Plan d'actions     — toutes les actions, statut, échéance
 *  5. Notes & Annexes    — documents SharePoint (métadonnées seulement)
 *  6. Correspondances    — liens ISO 26000, CSRD/ESRS, GRI 403, ODD, ISO 9001/14001, MASE, ILO-OSH
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─── Colors (palette orange sécurité ISO 45001) ───────────────────────────────
const C = {
  orange:  'FFEA580C', orangeL: 'FFFFEDD5',
  green:   'FF16A34A', greenL:  'FFDCFCE7',
  blue:    'FF2563EB', blueL:   'FFDBEAFE',
  purple:  'FF9333EA', purpleL: 'FFF3E8FF',
  red:     'FFDC2626', redL:    'FFFEE2E2',
  gray:    'FF6B7280', grayL:   'FFF3F4F6',
  white:   'FFFFFFFF', black:   'FF111827', border: 'FFE5E7EB',
  amber:   'FFF97316',
}

const AXE_COLORS: Record<string, { h: string; l: string }> = {
  leadership:    { h: C.orange, l: C.orangeL },
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

// ─── Données statiques ISO 45001 ──────────────────────────────────────────────
const ISO45001_AXES = [
  { id: 'leadership',    label: 'Leadership & Participation des travailleurs', icon: '🧭', weight: 0.20, criteres: [
    { id: 'i45-lead-engagement',    label: 'Engagement et redevabilité de la direction en matière de SST' },
    { id: 'i45-lead-politique',     label: "Politique SST formalisée, communiquée et adaptée à l'organisme" },
    { id: 'i45-lead-roles',         label: 'Rôles, responsabilités et autorités SST définis à tous les niveaux' },
    { id: 'i45-lead-participation', label: 'Consultation et participation des travailleurs (CSE, représentants, remontées terrain)' },
  ]},
  { id: 'planification', label: 'Planification & Maîtrise des risques', icon: '📋', weight: 0.20, criteres: [
    { id: 'i45-plan-dangers',     label: 'Identification des dangers et évaluation des risques professionnels (DUERP à jour)' },
    { id: 'i45-plan-legal',       label: 'Veille et conformité aux exigences légales et réglementaires SST' },
    { id: 'i45-plan-objectifs',   label: 'Objectifs SST mesurables et planification des actions pour les atteindre' },
    { id: 'i45-plan-changements', label: 'Maîtrise des risques liés aux changements (organisationnels, techniques, humains)' },
  ]},
  { id: 'support',       label: 'Support & Ressources', icon: '🛠️', weight: 0.20, criteres: [
    { id: 'i45-sup-ressources',      label: 'Ressources humaines, techniques et financières allouées à la SST' },
    { id: 'i45-sup-competences',     label: 'Compétences, formations et habilitations SST (accueil sécurité, recyclages)' },
    { id: 'i45-sup-sensibilisation', label: 'Sensibilisation et culture sécurité (causeries, minutes sécurité, remontée des presqu’accidents)' },
    { id: 'i45-sup-documentation',   label: 'Informations documentées du système SST (procédures, consignes, traçabilité)' },
  ]},
  { id: 'operations',    label: 'Réalisation opérationnelle', icon: '⚙️', weight: 0.20, criteres: [
    { id: 'i45-ope-prevention',  label: 'Maîtrise opérationnelle selon la hiérarchie de prévention (élimination → EPI)' },
    { id: 'i45-ope-entreprises', label: 'Coordination avec les entreprises extérieures et sous-traitants (plans de prévention, protocoles)' },
    { id: 'i45-ope-achats',      label: 'Intégration de la SST dans les achats (équipements, produits, prestations)' },
    { id: 'i45-ope-urgences',    label: "Préparation et réponse aux situations d'urgence (incendie, secours, exercices)" },
  ]},
  { id: 'evaluation',    label: 'Évaluation & Amélioration', icon: '📈', weight: 0.20, criteres: [
    { id: 'i45-eval-indicateurs',  label: 'Surveillance, mesure et analyse de la performance SST (TF, TG, indicateurs proactifs)' },
    { id: 'i45-eval-audits',       label: 'Audits internes du système de management SST' },
    { id: 'i45-eval-evenements',   label: 'Gestion des événements indésirables : accidents, presqu’accidents, analyses des causes' },
    { id: 'i45-eval-amelioration', label: 'Revue de direction et amélioration continue du système SST' },
  ]},
]

const ISO45001_NIVEAUX = [
  { value: 0, label: 'Non conforme', pct: 0    },
  { value: 1, label: 'Initié',       pct: 0.25 },
  { value: 2, label: 'Défini',       pct: 0.50 },
  { value: 3, label: 'Maîtrisé',     pct: 0.75 },
  { value: 4, label: 'Optimisé',     pct: 1.00 },
]

const BADGE_LEVELS = [
  { label: 'Culture sécurité exemplaire',  min: 85 },
  { label: "Conforme — prêt pour l'audit", min: 60 },
  { label: 'En construction',              min: 30 },
  { label: 'Non conforme',                 min: 0  },
]

function calculateScore(niveaux: Record<string, number>): number {
  let total = 0
  for (const axe of ISO45001_AXES) {
    let axeScore = 0
    const nb = axe.criteres.length
    for (const c of axe.criteres) {
      const n = niveaux[c.id] ?? 0
      axeScore += (ISO45001_NIVEAUX[n]?.pct ?? 0) / nb
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
  const { data } = await admin.from('iso45001_diagnostics').select('user_id').eq('id', diagnosticId).single()
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
      admin.from('iso45001_diagnostics').select('*, organisations(denomination, siret_siege, ville)').eq('id', params.id).single(),
      admin.from('iso45001_reponses').select('*').eq('diagnostic_id', params.id),
      admin.from('iso45001_actions').select('*').eq('diagnostic_id', params.id).order('created_at'),
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
    wb.creator = "Sens'ethO Apps — Diagnostic ISO 45001"
    wb.created = new Date()

    // ─── Onglet 1 : Couverture ────────────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Couverture', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 40 }, { width: 25 }, { width: 25 }]
      ws.getRow(1).height = 20
      ws.getRow(2).height = 50

      merge(ws, 2, 2, 2, 4)
      sc(ws, 2, 2, 'Diagnostic ISO 45001 — Santé et sécurité au travail (ISO 45001:2018)', { bg: C.orange, fg: C.white, bold: true, sz: 13, ha: 'center' })

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
      sc(ws, row, 2, 'Score de maturité ISO 45001', { bold: true, sz: 14, bg: C.orange, fg: C.white, ha: 'center' })
      sc(ws, row, 3, scoreGlobal, { bold: true, sz: 18, bg: C.orange, fg: C.white, ha: 'center' })
      sc(ws, row, 4, `/ 100 — ${badge}`, { bold: true, bg: C.orange, fg: C.white, ha: 'center' })
      ws.getRow(row).height = 35

      row += 2
      sc(ws, row, 2, 'Cadre de référence ISO 45001', { bold: true, sz: 11, bg: C.grayL })
      merge(ws, row, 2, row, 4)
      row++
      const legalLines = [
        'ISO 45001:2018 « Systèmes de management de la santé et de la sécurité au travail » — première norme internationale SST, remplace l’OHSAS 18001 (retirée en 2021)',
        'Structure HLS (High Level Structure) commune aux normes ISO 9001 et 14001 — permet les systèmes de management intégrés QSE',
        'Certification par tierce partie sur un cycle de 3 ans : audit initial puis audits de suivi annuels',
        'France : obligation générale de sécurité de l’employeur (art. L4121-1 du code du travail) et DUERP obligatoire dès le 1er salarié, avec son plan d’actions',
        'Responsabilité pénale de l’employeur en cas de faute inexcusable — environ 2 accidents du travail mortels par jour en France',
        'Niveaux : NC (Non conforme) → 1 (Initié) → 2 (Défini) → 3 (Maîtrisé) → 4 (Optimisé)',
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

      sc(ws, 2, 2, 'Synthèse par axe du diagnostic ISO 45001', { bold: true, sz: 14, bg: C.orange, fg: C.white, ha: 'center' })
      merge(ws, 2, 2, 2, 6)
      ws.getRow(2).height = 30

      const headers = ['Axe', 'Poids', 'Score axe', 'Critères évalués', 'Niveau moyen']
      headers.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const axe of ISO45001_AXES) {
        const clr = AXE_COLORS[axe.id]
        const niveaux = axe.criteres.map(c => reponses[c.id] ?? 0)
        const pct = Math.round(niveaux.reduce((s, n) => s + (ISO45001_NIVEAUX[n]?.pct ?? 0), 0) / axe.criteres.length * 100)
        const renseignes = niveaux.filter(n => n > 0).length
        const moy = niveaux.reduce((s, n) => s + n, 0) / axe.criteres.length

        sc(ws, row, 2, `${axe.icon} ${axe.label}`, { bg: clr.l, bold: true, sz: 10 })
        sc(ws, row, 3, `${Math.round(axe.weight * 100)}%`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 4, `${pct}%`, { bg: clr.l, bold: true, ha: 'center', fg: pct >= 60 ? C.green : pct >= 30 ? C.amber : C.red })
        sc(ws, row, 5, `${renseignes} / ${axe.criteres.length}`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 6, ISO45001_NIVEAUX[Math.round(moy)]?.label ?? 'Non conforme', { bg: clr.l, ha: 'center' })
        ws.getRow(row).height = 22
        row++
      }

      row += 2
      sc(ws, row, 2, 'Résumé', { bold: true, sz: 12, bg: C.grayL })
      sc(ws, row, 3, `Score global : ${scoreGlobal}/100 — ${badge}`, { bold: true, bg: C.orangeL, fg: C.orange })
      merge(ws, row, 3, row, 6)
      ws.getRow(row).height = 22
    }

    // ─── Onglet 3 : Critères détaillés ───────────────────────────────────────
    {
      const ws = wb.addWorksheet('Critères détaillés', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 32 }, { width: 50 }, { width: 16 }, { width: 12 }, { width: 50 }]

      sc(ws, 2, 2, 'Détail par critère — Diagnostic ISO 45001', { bold: true, sz: 14, bg: C.orange, fg: C.white })
      merge(ws, 2, 2, 2, 6)
      ws.getRow(2).height = 30

      const hdrs = ['Axe', 'Critère', 'Niveau', 'Score (%)', 'Commentaire']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const axe of ISO45001_AXES) {
        const clr = AXE_COLORS[axe.id]
        for (const c of axe.criteres) {
          const n = reponses[c.id] ?? 0
          const niv = ISO45001_NIVEAUX[n]
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
      ws.columns = [{ width: 4 }, { width: 28 }, { width: 30 }, { width: 11 }, { width: 12 }, { width: 14 }, { width: 16 }, { width: 40 }]

      sc(ws, 2, 2, "Plan d'actions — Diagnostic ISO 45001", { bold: true, sz: 14, bg: C.orange, fg: C.white })
      merge(ws, 2, 2, 2, 8)
      ws.getRow(2).height = 30

      const hdrs = ['Axe', 'Action', 'Priorité', 'Statut', 'Échéance', 'Responsable', 'Description']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      const STATUT_LABELS: Record<string, string> = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' }
      const PRIORITE_LABELS: Record<string, string> = { haute: '🔴 Haute', moyenne: '🟡 Moyenne', basse: '🟢 Basse' }

      for (const a of actions as any[]) {
        const axe = ISO45001_AXES.find(x => x.criteres.some(c => c.id === a.critere_id))
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

      sc(ws, 2, 2, 'Notes & Documents', { bold: true, sz: 14, bg: C.orange, fg: C.white })
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
      ws.columns = [{ width: 4 }, { width: 32 }, { width: 30 }, { width: 60 }]

      sc(ws, 2, 2, 'Correspondances avec les référentiels — Diagnostic ISO 45001', { bold: true, sz: 13, bg: C.orange, fg: C.white })
      merge(ws, 2, 2, 2, 4)
      ws.getRow(2).height = 28

      const hdrs = ['Référentiel', 'Axe ISO 45001', 'Correspondance']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      const correspondances = [
        { ref: 'ISO 9001 / ISO 14001 — SMI QSE', axe: 'Tous les axes', corr: 'Structure HLS commune : politique, planification, support, réalisation opérationnelle, évaluation des performances et amélioration — permet un système de management intégré Qualité-Sécurité-Environnement' },
        { ref: 'ISO 26000', axe: 'Tous les axes', corr: 'Lignes directrices de la responsabilité sociétale — domaine d’action « santé et sécurité au travail » de la question centrale Relations et conditions de travail' },
        { ref: 'CSRD — ESRS S1', axe: 'Tous les axes', corr: 'Reporting de durabilité : ESRS S1 Effectifs de l’entreprise — santé et sécurité (S1-14), couverture du système de management SST, accidents, maladies professionnelles' },
        { ref: 'GRI 403 — Santé et sécurité au travail', axe: 'Tous les axes', corr: 'GRI 403 : système de management SST (403-1), identification des dangers (403-2), participation des travailleurs (403-4), formation (403-5), accidents du travail (403-9)' },
        { ref: 'ODD 3 et 8 — Nations Unies', axe: 'Tous les axes', corr: 'ODD 3 (bonne santé et bien-être) et ODD 8 (travail décent — cible 8.8 : défense des droits des travailleurs et promotion de la sécurité sur le lieu de travail)' },
        { ref: 'MASE', axe: 'Réalisation opérationnelle', corr: 'Manuel d’Amélioration Sécurité des Entreprises — référentiel SSE français exigé par les donneurs d’ordre industriels, forte convergence avec ISO 45001 (passerelles reconnues)' },
        { ref: 'OHSAS 18001 (historique)', axe: 'Tous les axes', corr: 'Référentiel SST britannique retiré en 2021 — les organismes certifiés OHSAS 18001 ont migré vers ISO 45001 ; les exigences clés sont reprises et renforcées (leadership, participation)' },
        { ref: 'ILO-OSH 2001 (OIT)', axe: 'Tous les axes', corr: 'Principes directeurs de l’Organisation Internationale du Travail concernant les systèmes de gestion de la sécurité et de la santé au travail — source d’inspiration de l’ISO 45001' },
        { ref: 'Code du travail (L4121-1, DUERP)', axe: 'Planification & Maîtrise des risques', corr: 'Obligation générale de sécurité de l’employeur (art. L4121-1), DUERP obligatoire dès le 1er salarié avec plan d’actions — le diagnostic structure la conformité réglementaire française' },
      ]

      let row = 5
      for (const c of correspondances) {
        sc(ws, row, 2, c.ref, { bg: C.white, sz: 9, bold: true })
        sc(ws, row, 3, c.axe, { bg: C.orangeL, sz: 9 })
        sc(ws, row, 4, c.corr, { bg: C.white, sz: 8, wrap: true })
        ws.getRow(row).height = 22
        row++
      }
    }

    // ─── Export ───────────────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer()
    const filename = `ISO45001_${orgNom.replace(/[^a-z0-9]/gi, '_')}_${diag.annee}.xlsx`

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('[iso45001/export-excel]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

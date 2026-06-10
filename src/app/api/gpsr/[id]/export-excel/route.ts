/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/gpsr/[id]/export-excel
 * Génère un fichier Excel structuré du Diagnostic GPSR (règlement (UE) 2023/988 relatif à la sécurité générale des produits).
 *
 * Onglets :
 *  1. Couverture         — org, année, score global, badge GPSR
 *  2. Tableau de bord    — scores par axe, progression
 *  3. Critères détaillés — 20 critères, niveau, commentaire
 *  4. Plan d'actions     — toutes les actions, statut, échéance
 *  5. Notes & Annexes    — documents SharePoint (métadonnées seulement)
 *  6. Correspondances    — liens ISO 26000, ISO 10377/10393, CSRD/ESRS, GRI 416, ODD 12, règlement 2019/1020, DSA, Safety Gate
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─── Colors (palette bleu acier sécurité produit — GPSR) ─────────────────────
const C = {
  sky:     'FF0284C7', skyL:    'FFE0F2FE',
  red:     'FFDC2626', redL:    'FFFEE2E2',
  violet:  'FF7C3AED', violetL: 'FFEDE9FE',
  green:   'FF16A34A', greenL:  'FFDCFCE7',
  orange:  'FFEA580C', orangeL: 'FFFFEDD5',
  blue:    'FF2563EB', blueL:   'FFDBEAFE',
  gray:    'FF6B7280', grayL:   'FFF3F4F6',
  white:   'FFFFFFFF', black:   'FF111827', border: 'FFE5E7EB',
  amber:   'FFF97316',
}

const AXE_COLORS: Record<string, { h: string; l: string }> = {
  gouvernance:  { h: C.sky,    l: C.skyL    },
  evaluation:   { h: C.red,    l: C.redL    },
  operateurs:   { h: C.violet, l: C.violetL },
  vad:          { h: C.green,  l: C.greenL  },
  surveillance: { h: C.orange, l: C.orangeL },
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

// ─── Données statiques GPSR ───────────────────────────────────────────────────
const GPSR_AXES = [
  { id: 'gouvernance', label: 'Gouvernance & Documentation produit', icon: '🧭', weight: 0.20, criteres: [
    { id: 'gpsr-gov-organisation',  label: 'Organisation de la conformité produit (responsable identifié, processus, veille réglementaire)' },
    { id: 'gpsr-gov-analyse',       label: 'Analyse interne des risques documentée pour chaque produit (art. 9)' },
    { id: 'gpsr-gov-documentation', label: 'Documentation technique constituée et tenue à jour (10 ans)' },
    { id: 'gpsr-gov-tracabilite',   label: 'Identification et traçabilité des produits (lot, type, marquages, coordonnées fabricant)' },
  ]},
  { id: 'evaluation', label: 'Évaluation de la sécurité des produits', icon: '🔬', weight: 0.20, criteres: [
    { id: 'gpsr-eval-criteres',    label: "Évaluation selon les critères de l'art. 6 (caractéristiques, présentation, étiquetage, interaction avec d'autres produits)" },
    { id: 'gpsr-eval-normes',      label: 'Application des normes européennes et référentiels pertinents (présomption de sécurité)' },
    { id: 'gpsr-eval-connectes',   label: 'Sécurité des produits connectés : cybersécurité et fonctionnalités évolutives (mises à jour logicielles)' },
    { id: 'gpsr-eval-vulnerables', label: "Prise en compte des consommateurs vulnérables (enfants, personnes âgées, handicap) et produits d'apparence alimentaire" },
  ]},
  { id: 'operateurs', label: 'Chaîne de valeur & Opérateurs économiques', icon: '🔗', weight: 0.20, criteres: [
    { id: 'gpsr-ope-roles',        label: 'Qualification du rôle (fabricant, importateur, distributeur, mandataire) et obligations associées' },
    { id: 'gpsr-ope-responsable',  label: "Personne responsable établie dans l'UE pour chaque produit (art. 16 — condition de mise sur le marché)" },
    { id: 'gpsr-ope-fournisseurs', label: 'Maîtrise des fournisseurs et sous-traitants (exigences sécurité, contrôles, audits)' },
    { id: 'gpsr-ope-fulfilment',   label: "Coordination avec les prestataires d'exécution de commandes et la logistique" },
  ]},
  { id: 'vad', label: 'Vente en ligne & Information consommateur', icon: '🛒', weight: 0.20, criteres: [
    { id: 'gpsr-vad-fiches',         label: 'Offres en ligne conformes (art. 19) : identité du fabricant, personne responsable UE, identification du produit, avertissements en langue locale' },
    { id: 'gpsr-vad-marketplaces',   label: 'Conformité sur les places de marché (obligations des fournisseurs de marketplaces, retrait en 2 jours ouvrés)' },
    { id: 'gpsr-vad-avertissements', label: 'Avertissements et instructions de sécurité clairs, dans les langues des États membres de commercialisation' },
    { id: 'gpsr-vad-publicite',      label: 'Loyauté de la présentation et de la publicité (pas de minimisation des risques)' },
  ]},
  { id: 'surveillance', label: 'Surveillance, Incidents & Rappels', icon: '🚨', weight: 0.20, criteres: [
    { id: 'gpsr-surv-veille',      label: 'Surveillance des produits mis sur le marché (réclamations, registre des plaintes, tests par sondage)' },
    { id: 'gpsr-surv-signalement', label: 'Signalement des accidents aux autorités via le Safety Business Gateway (sans retard injustifié)' },
    { id: 'gpsr-surv-rappels',     label: 'Procédure de rappel efficace : avis de rappel normalisé (art. 36), contact direct des consommateurs identifiables' },
    { id: 'gpsr-surv-recours',     label: 'Recours offerts aux consommateurs en cas de rappel : réparation, remplacement ou remboursement (art. 37)' },
  ]},
]

const GPSR_NIVEAUX = [
  { value: 0, label: 'Non traité', pct: 0    },
  { value: 1, label: 'Initié',     pct: 0.25 },
  { value: 2, label: 'Défini',     pct: 0.50 },
  { value: 3, label: 'Conforme',   pct: 0.75 },
  { value: 4, label: 'Exemplaire', pct: 1.00 },
]

const BADGE_LEVELS = [
  { label: 'Maîtrise exemplaire', min: 85 },
  { label: 'Conforme GPSR',       min: 60 },
  { label: 'Mise en conformité',  min: 30 },
  { label: 'Non conforme',        min: 0  },
]

function calculateScore(niveaux: Record<string, number>): number {
  let total = 0
  for (const axe of GPSR_AXES) {
    let axeScore = 0
    const nb = axe.criteres.length
    for (const c of axe.criteres) {
      const n = niveaux[c.id] ?? 0
      axeScore += (GPSR_NIVEAUX[n]?.pct ?? 0) / nb
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
  const { data } = await admin.from('gpsr_diagnostics').select('user_id').eq('id', diagnosticId).single()
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
      admin.from('gpsr_diagnostics').select('*, organisations(nom, siret, pays)').eq('id', params.id).single(),
      admin.from('gpsr_reponses').select('*').eq('diagnostic_id', params.id),
      admin.from('gpsr_actions').select('*').eq('diagnostic_id', params.id).order('created_at'),
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
    const org = diag.organisations as { nom?: string; siret?: string; pays?: string } | null
    const orgNom = org?.nom ?? 'Organisation'
    const dateExport = new Date().toLocaleDateString('fr-FR')

    // ─── Workbook ────────────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook()
    wb.creator = "Sens'ethO Apps — Diagnostic GPSR"
    wb.created = new Date()

    // ─── Onglet 1 : Couverture ────────────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Couverture', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 40 }, { width: 25 }, { width: 25 }]
      ws.getRow(1).height = 20
      ws.getRow(2).height = 50

      merge(ws, 2, 2, 2, 4)
      sc(ws, 2, 2, 'Diagnostic GPSR — Règlement (UE) 2023/988 relatif à la sécurité générale des produits', { bg: C.sky, fg: C.white, bold: true, sz: 13, ha: 'center' })

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
      sc(ws, row, 2, 'Score GPSR', { bold: true, sz: 14, bg: C.sky, fg: C.white, ha: 'center' })
      sc(ws, row, 3, scoreGlobal, { bold: true, sz: 18, bg: C.sky, fg: C.white, ha: 'center' })
      sc(ws, row, 4, `/ 100 — ${badge}`, { bold: true, bg: C.sky, fg: C.white, ha: 'center' })
      ws.getRow(row).height = 35

      row += 2
      sc(ws, row, 2, 'Cadre réglementaire GPSR', { bold: true, sz: 11, bg: C.grayL })
      merge(ws, row, 2, row, 4)
      row++
      const legalLines = [
        'Règlement (UE) 2023/988 du 10 mai 2023 relatif à la sécurité générale des produits (GPSR) — applicable depuis le 13 décembre 2024',
        'Remplace la directive 2001/95/CE (GPSD) et la directive 87/357/CEE (produits d’apparence alimentaire)',
        'Champ : tous les produits de consommation non alimentaires (neufs, d’occasion, reconditionnés), y compris vendus en ligne, hors réglementation sectorielle complète',
        'Obligations : analyse interne des risques (art. 9), documentation technique conservée 10 ans, traçabilité, personne responsable établie dans l’UE (art. 16)',
        'Vente à distance : informations obligatoires sur les offres en ligne (art. 19) ; obligations spécifiques pour les places de marché (retrait en 2 jours ouvrés)',
        'Signalement des accidents aux autorités via le Safety Business Gateway, sans retard injustifié',
        'Rappels : avis de rappel normalisé (art. 36) et recours obligatoires pour les consommateurs — réparation, remplacement ou remboursement (art. 37)',
        'Sanctions fixées par les États membres — en France : DGCCRF, amendes et sanctions pénales',
        'Niveaux d’auto-évaluation : NC (Non traité) → 1 (Initié) → 2 (Défini) → 3 (Conforme) → 4 (Exemplaire)',
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

      sc(ws, 2, 2, 'Synthèse par axe du Diagnostic GPSR', { bold: true, sz: 14, bg: C.sky, fg: C.white, ha: 'center' })
      merge(ws, 2, 2, 2, 6)
      ws.getRow(2).height = 30

      const headers = ['Axe', 'Poids', 'Score axe', 'Critères évalués', 'Niveau moyen']
      headers.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const axe of GPSR_AXES) {
        const clr = AXE_COLORS[axe.id]
        const niveaux = axe.criteres.map(c => reponses[c.id] ?? 0)
        const pct = Math.round(niveaux.reduce((s, n) => s + (GPSR_NIVEAUX[n]?.pct ?? 0), 0) / axe.criteres.length * 100)
        const renseignes = niveaux.filter(n => n > 0).length
        const moy = niveaux.reduce((s, n) => s + n, 0) / axe.criteres.length

        sc(ws, row, 2, `${axe.icon} ${axe.label}`, { bg: clr.l, bold: true, sz: 10 })
        sc(ws, row, 3, `${Math.round(axe.weight * 100)}%`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 4, `${pct}%`, { bg: clr.l, bold: true, ha: 'center', fg: pct >= 60 ? C.green : pct >= 30 ? C.amber : C.red })
        sc(ws, row, 5, `${renseignes} / ${axe.criteres.length}`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 6, GPSR_NIVEAUX[Math.round(moy)]?.label ?? 'Non traité', { bg: clr.l, ha: 'center' })
        ws.getRow(row).height = 22
        row++
      }

      row += 2
      sc(ws, row, 2, 'Résumé', { bold: true, sz: 12, bg: C.grayL })
      sc(ws, row, 3, `Score global : ${scoreGlobal}/100 — ${badge}`, { bold: true, bg: C.skyL, fg: C.sky })
      merge(ws, row, 3, row, 6)
      ws.getRow(row).height = 22
    }

    // ─── Onglet 3 : Critères détaillés ───────────────────────────────────────
    {
      const ws = wb.addWorksheet('Critères détaillés', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 32 }, { width: 50 }, { width: 16 }, { width: 12 }, { width: 50 }]

      sc(ws, 2, 2, 'Détail par critère — Diagnostic GPSR', { bold: true, sz: 14, bg: C.sky, fg: C.white })
      merge(ws, 2, 2, 2, 6)
      ws.getRow(2).height = 30

      const hdrs = ['Axe', 'Critère', 'Niveau', 'Score (%)', 'Commentaire']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const axe of GPSR_AXES) {
        const clr = AXE_COLORS[axe.id]
        for (const c of axe.criteres) {
          const n = reponses[c.id] ?? 0
          const niv = GPSR_NIVEAUX[n]
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

      sc(ws, 2, 2, "Plan d'actions — Diagnostic GPSR", { bold: true, sz: 14, bg: C.sky, fg: C.white })
      merge(ws, 2, 2, 2, 8)
      ws.getRow(2).height = 30

      const hdrs = ['Axe', 'Action', 'Priorité', 'Statut', 'Échéance', 'Responsable', 'Description']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      const STATUT_LABELS: Record<string, string> = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' }
      const PRIORITE_LABELS: Record<string, string> = { haute: '🔴 Haute', moyenne: '🟡 Moyenne', basse: '🟢 Basse' }

      for (const a of actions as any[]) {
        const axe = GPSR_AXES.find(x => x.criteres.some(c => c.id === a.critere_id))
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

      sc(ws, 2, 2, 'Notes & Documents', { bold: true, sz: 14, bg: C.sky, fg: C.white })
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

      sc(ws, 2, 2, 'Correspondances avec les référentiels — Diagnostic GPSR', { bold: true, sz: 13, bg: C.sky, fg: C.white })
      merge(ws, 2, 2, 2, 4)
      ws.getRow(2).height = 28

      const hdrs = ['Référentiel', 'Axe GPSR', 'Correspondance']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      const correspondances = [
        { ref: 'Règlement (UE) 2019/1020 — surveillance du marché', axe: 'Surveillance & Rappels', corr: 'Cadre européen de la surveillance du marché et de la conformité des produits : pouvoirs des autorités, contrôles aux frontières, coopération — le GPSR s’articule directement avec ce règlement pour les produits non harmonisés' },
        { ref: 'DSA — Digital Services Act', axe: 'Vente en ligne', corr: 'Le règlement sur les services numériques encadre les places de marché en ligne (connaissance du vendeur, retrait des contenus illicites) — le GPSR ajoute des obligations spécifiques de sécurité produit pour les marketplaces (art. 22, retrait en 2 jours ouvrés)' },
        { ref: 'Directive 2001/95/CE (GPSD) — historique', axe: 'Tous les axes', corr: 'Directive relative à la sécurité générale des produits abrogée et remplacée par le GPSR le 13 décembre 2024 — le GPSR renforce la traçabilité, la vente en ligne, les rappels et l’exigence de personne responsable UE' },
        { ref: 'Safety Gate / RAPEX', axe: 'Surveillance & Rappels', corr: 'Système d’alerte rapide de l’UE pour les produits dangereux non alimentaires : publication des alertes, notifications des autorités — le Safety Business Gateway est le portail de signalement des entreprises vers les autorités' },
        { ref: 'ISO 10377 — sécurité des produits de consommation', axe: 'Évaluation de la sécurité', corr: 'Lignes directrices pour la sécurité des produits de consommation : évaluation et maîtrise des risques de la conception à la distribution — référentiel opérationnel pour documenter l’analyse interne des risques exigée par l’art. 9 du GPSR' },
        { ref: 'ISO 10393 — rappels de produits', axe: 'Surveillance & Rappels', corr: 'Lignes directrices pour le rappel des produits de consommation : préparation, déclenchement, communication et évaluation de l’efficacité des rappels — complète les exigences des art. 36 et 37 du GPSR' },
        { ref: 'ISO 26000 — questions relatives aux consommateurs', axe: 'Tous les axes', corr: 'Question centrale « Questions relatives aux consommateurs » (§6.7) : protection de la santé et de la sécurité des consommateurs, information loyale, service après-vente et traitement des réclamations' },
        { ref: 'CSRD — ESRS S4 (consommateurs et utilisateurs finals)', axe: 'Gouvernance / Surveillance', corr: 'Le standard ESRS S4 couvre les impacts sur les consommateurs, dont la sécurité des produits : politiques, actions et indicateurs de sécurité produit alimentent le reporting de durabilité' },
        { ref: 'GRI 416 — santé et sécurité des consommateurs', axe: 'Évaluation / Surveillance', corr: 'Indicateurs GRI 416-1 (évaluation des impacts santé-sécurité des produits) et 416-2 (incidents de non-conformité) — documentent la performance sécurité produit dans le reporting extra-financier' },
        { ref: 'ODD 12 — consommation et production responsables', axe: 'Tous les axes', corr: 'La sécurité et la durabilité des produits de consommation contribuent à l’ODD 12 : modes de consommation et de production durables, information des consommateurs et pratiques responsables' },
      ]

      let row = 5
      for (const c of correspondances) {
        sc(ws, row, 2, c.ref, { bg: C.white, sz: 9, bold: true })
        sc(ws, row, 3, c.axe, { bg: C.skyL, sz: 9 })
        sc(ws, row, 4, c.corr, { bg: C.white, sz: 8, wrap: true })
        ws.getRow(row).height = 22
        row++
      }
    }

    // ─── Export ───────────────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer()
    const filename = `GPSR_${orgNom.replace(/[^a-z0-9]/gi, '_')}_${diag.annee}.xlsx`

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('[gpsr/export-excel]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

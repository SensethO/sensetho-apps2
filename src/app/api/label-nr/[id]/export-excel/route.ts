/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/label-nr/[id]/export-excel
 * Génère un fichier Excel structuré du diagnostic Label Numérique Responsable (Agence LUCIE / INR).
 *
 * Onglets :
 *  1. Couverture         — org, année, score global, badge de maturité
 *  2. Tableau de bord    — scores par axe, progression
 *  3. Critères détaillés — 20 critères, niveau, commentaire
 *  4. Plan d'actions     — toutes les actions, statut, échéance
 *  5. Notes & Annexes    — documents SharePoint (métadonnées seulement)
 *  6. Correspondances    — liens ISO 26000, CSRD/ESRS, GRI, ODD, GR491, RGESN, RGAA, loi REEN
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─── Colors ──────────────────────────────────────────────────────────────────
const C = {
  teal:    'FF0D9488', tealL:   'FFCCFBF1',
  green:   'FF16A34A', greenL:  'FFDCFCE7',
  orange:  'FFEA580C', orangeL: 'FFFFEDD5',
  blue:    'FF2563EB', blueL:   'FFDBEAFE',
  purple:  'FF9333EA', purpleL: 'FFF3E8FF',
  gray:    'FF6B7280', grayL:   'FFF3F4F6',
  white:   'FFFFFFFF', black:   'FF111827', border: 'FFE5E7EB',
  red:     'FFDC2626', redL:    'FFFEE2E2',
  amber:   'FFD97706', amberL:  'FFFEF9C3',
}

const AXE_COLORS: Record<string, { h: string; l: string }> = {
  gouvernance:   { h: C.teal,   l: C.tealL   },
  equipements:   { h: C.blue,   l: C.blueL   },
  ecoconception: { h: C.green,  l: C.greenL  },
  usages:        { h: C.purple, l: C.purpleL },
  inclusion:     { h: C.orange, l: C.orangeL },
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

// ─── Données statiques Label NR ───────────────────────────────────────────────
const LABEL_NR_AXES = [
  { id: 'gouvernance',   label: 'Stratégie & Gouvernance NR',         icon: '🧭', weight: 0.20, criteres: [
    { id: 'nr-gov-strategie',       label: 'Stratégie Numérique Responsable formalisée et portée par la direction' },
    { id: 'nr-gov-pilotage',        label: 'Pilotage, référent NR et indicateurs de suivi' },
    { id: 'nr-gov-sensibilisation', label: 'Sensibilisation et formation des collaborateurs au NR' },
    { id: 'nr-gov-amelioration',    label: "Démarche d'amélioration continue et reporting NR" },
  ]},
  { id: 'equipements',   label: 'Achats & Équipements responsables',  icon: '💻', weight: 0.20, criteres: [
    { id: 'nr-equip-duree',         label: "Allongement de la durée de vie (réparation, réemploi, durée d'amortissement)" },
    { id: 'nr-equip-achats',        label: 'Critères environnementaux et sociaux dans les achats IT (labels, reconditionné)' },
    { id: 'nr-equip-deee',          label: 'Collecte et traitement des DEEE par des filières agréées' },
    { id: 'nr-equip-mutualisation', label: "Rationalisation et mutualisation du parc (taux d'équipement par collaborateur)" },
  ]},
  { id: 'ecoconception', label: 'Services numériques écoconçus',      icon: '🌱', weight: 0.20, criteres: [
    { id: 'nr-eco-conception',  label: "Intégration de l'écoconception (RGESN, GR491) dans les projets numériques" },
    { id: 'nr-eco-sobriete',    label: 'Sobriété fonctionnelle et éditoriale (juste besoin, dette fonctionnelle)' },
    { id: 'nr-eco-mesure',      label: "Mesure de l'empreinte des services numériques (EcoIndex, ACV)" },
    { id: 'nr-eco-hebergement', label: 'Hébergement responsable (datacenters efficients, énergies renouvelables, PUE)' },
  ]},
  { id: 'usages',        label: 'Usages & Données responsables',      icon: '📡', weight: 0.20, criteres: [
    { id: 'nr-usage-sobriete', label: 'Sobriété des usages numériques (messagerie, stockage, streaming, visio)' },
    { id: 'nr-usage-donnees',  label: 'Gestion du cycle de vie des données (archivage, suppression, dédoublonnage)' },
    { id: 'nr-usage-rgpd',     label: 'Protection des données personnelles (RGPD) et minimisation' },
    { id: 'nr-usage-securite', label: 'Cybersécurité responsable et proportionnée' },
  ]},
  { id: 'inclusion',     label: 'Numérique inclusif & éthique',       icon: '🤝', weight: 0.20, criteres: [
    { id: 'nr-incl-accessibilite', label: 'Accessibilité numérique des services (RGAA, WCAG)' },
    { id: 'nr-incl-fracture',      label: "Lutte contre l'exclusion et la fracture numérique" },
    { id: 'nr-incl-ethique',       label: 'Éthique numérique (conception attentionnelle, IA responsable, transparence)' },
    { id: 'nr-incl-contribution',  label: 'Contribution sociétale et territoriale du numérique' },
  ]},
]

const LABEL_NR_NIVEAUX = [
  { value: 0, label: 'Non initié', pct: 0    },
  { value: 1, label: 'Découverte', pct: 0.25 },
  { value: 2, label: 'Engagé',     pct: 0.50 },
  { value: 3, label: 'Maîtrisé',   pct: 0.75 },
  { value: 4, label: 'Exemplaire', pct: 1.00 },
]

const BADGE_LEVELS = [
  { label: 'Éligible Label NR niveau 2', min: 85 },
  { label: 'Éligible Label NR niveau 1', min: 60 },
  { label: 'En démarche',                min: 30 },
  { label: 'Non initié',                 min: 0  },
]

function calculateScore(niveaux: Record<string, number>): number {
  let total = 0
  for (const axe of LABEL_NR_AXES) {
    let axeScore = 0
    const nb = axe.criteres.length
    for (const c of axe.criteres) {
      const n = niveaux[c.id] ?? 0
      axeScore += (LABEL_NR_NIVEAUX[n]?.pct ?? 0) / nb
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
  const { data } = await admin.from('label_nr_diagnostics').select('user_id').eq('id', diagnosticId).single()
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
      admin.from('label_nr_diagnostics').select('*, organisations(denomination, siret_siege, ville)').eq('id', params.id).single(),
      admin.from('label_nr_reponses').select('*').eq('diagnostic_id', params.id),
      admin.from('label_nr_actions').select('*').eq('diagnostic_id', params.id).order('created_at'),
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
    const badge = BADGE_LEVELS.find(b => scoreGlobal >= b.min)?.label ?? 'Non initié'
    const org = diag.organisations as { denomination?: string; siret_siege?: string; ville?: string } | null
    const orgNom = org?.denomination ?? 'Organisation'
    const dateExport = new Date().toLocaleDateString('fr-FR')

    // ─── Workbook ────────────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook()
    wb.creator = "Sens'ethO Apps — Label Numérique Responsable Diagnostic"
    wb.created = new Date()

    // ─── Onglet 1 : Couverture ────────────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Couverture', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 40 }, { width: 25 }, { width: 25 }]
      ws.getRow(1).height = 20
      ws.getRow(2).height = 50

      merge(ws, 2, 2, 2, 4)
      sc(ws, 2, 2, 'Label Numérique Responsable (Label NR) — Agence LUCIE / INR', { bg: C.teal, fg: C.white, bold: true, sz: 13, ha: 'center' })

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
      sc(ws, row, 2, 'Score de maturité Numérique Responsable', { bold: true, sz: 14, bg: C.teal, fg: C.white, ha: 'center' })
      sc(ws, row, 3, scoreGlobal, { bold: true, sz: 18, bg: C.teal, fg: C.white, ha: 'center' })
      sc(ws, row, 4, `/ 100 — ${badge}`, { bold: true, bg: C.teal, fg: C.white, ha: 'center' })
      ws.getRow(row).height = 35

      row += 2
      sc(ws, row, 2, 'Cadre de référence Label NR', { bold: true, sz: 11, bg: C.grayL })
      merge(ws, row, 2, row, 4)
      row++
      const legalLines = [
        "Label Numérique Responsable porté par l'Agence LUCIE en partenariat avec l'INR (Institut du Numérique Responsable)",
        'Issu de la déclaration commune WeGreenIT et de la charte Numérique Responsable',
        "Basé sur les référentiels GR491 (conception responsable INR) et RGESN (écoconception de services numériques)",
        '2 paliers officiels : NR niveau 1 (engagement, valable 18 mois) et NR niveau 2 (confirmé, valable 3 ans) — audit par organisme tiers indépendant',
        'Contexte réglementaire : loi REEN (n°2021-1485), loi AGEC, indice de réparabilité, CSRD/ESRS',
        'Niveaux : NC (Non initié) → 1 (Découverte) → 2 (Engagé) → 3 (Maîtrisé) → 4 (Exemplaire)',
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
      ws.columns = [{ width: 4 }, { width: 35 }, { width: 12 }, { width: 18 }, { width: 20 }, { width: 18 }]

      sc(ws, 2, 2, 'Synthèse par axe du diagnostic Label Numérique Responsable', { bold: true, sz: 14, bg: C.teal, fg: C.white, ha: 'center' })
      merge(ws, 2, 2, 2, 6)
      ws.getRow(2).height = 30

      const headers = ['Axe', 'Poids', 'Score axe', 'Critères évalués', 'Niveau moyen']
      headers.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const axe of LABEL_NR_AXES) {
        const clr = AXE_COLORS[axe.id]
        const niveaux = axe.criteres.map(c => reponses[c.id] ?? 0)
        const pct = Math.round(niveaux.reduce((s, n) => s + (LABEL_NR_NIVEAUX[n]?.pct ?? 0), 0) / axe.criteres.length * 100)
        const renseignes = niveaux.filter(n => n > 0).length
        const moy = niveaux.reduce((s, n) => s + n, 0) / axe.criteres.length

        sc(ws, row, 2, `${axe.icon} ${axe.label}`, { bg: clr.l, bold: true, sz: 10 })
        sc(ws, row, 3, `${Math.round(axe.weight * 100)}%`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 4, `${pct}%`, { bg: clr.l, bold: true, ha: 'center', fg: pct >= 60 ? C.teal : pct >= 30 ? C.amber : C.red })
        sc(ws, row, 5, `${renseignes} / ${axe.criteres.length}`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 6, LABEL_NR_NIVEAUX[Math.round(moy)]?.label ?? 'Non initié', { bg: clr.l, ha: 'center' })
        ws.getRow(row).height = 22
        row++
      }

      row += 2
      sc(ws, row, 2, 'Résumé', { bold: true, sz: 12, bg: C.grayL })
      sc(ws, row, 3, `Score global : ${scoreGlobal}/100 — ${badge}`, { bold: true, bg: C.tealL, fg: C.teal })
      merge(ws, row, 3, row, 6)
      ws.getRow(row).height = 22
    }

    // ─── Onglet 3 : Critères détaillés ───────────────────────────────────────
    {
      const ws = wb.addWorksheet('Critères détaillés', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 28 }, { width: 45 }, { width: 18 }, { width: 12 }, { width: 50 }]

      sc(ws, 2, 2, 'Détail par critère — Diagnostic Label Numérique Responsable', { bold: true, sz: 14, bg: C.teal, fg: C.white })
      merge(ws, 2, 2, 2, 6)
      ws.getRow(2).height = 30

      const hdrs = ['Axe', 'Critère', 'Niveau', 'Score (%)', 'Commentaire']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const axe of LABEL_NR_AXES) {
        const clr = AXE_COLORS[axe.id]
        for (const c of axe.criteres) {
          const n = reponses[c.id] ?? 0
          const niv = LABEL_NR_NIVEAUX[n]
          const pct = Math.round((niv?.pct ?? 0) * 100)
          sc(ws, row, 2, `${axe.icon} ${axe.label}`, { bg: clr.l, sz: 9 })
          sc(ws, row, 3, c.label, { bg: C.white, sz: 9 })
          sc(ws, row, 4, niv?.label ?? 'Non initié', { bg: C.white, ha: 'center', sz: 9, bold: n > 0 })
          sc(ws, row, 5, pct === 0 ? '—' : `${pct}%`, { bg: C.white, ha: 'center', sz: 9, fg: pct >= 75 ? C.teal : pct >= 50 ? C.amber : C.red })
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

      sc(ws, 2, 2, "Plan d'actions — Diagnostic Label Numérique Responsable", { bold: true, sz: 14, bg: C.teal, fg: C.white })
      merge(ws, 2, 2, 2, 8)
      ws.getRow(2).height = 30

      const hdrs = ['Axe', 'Action', 'Priorité', 'Statut', 'Échéance', 'Responsable', 'Description']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      const STATUT_LABELS: Record<string, string> = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' }
      const PRIORITE_LABELS: Record<string, string> = { haute: '🔴 Haute', moyenne: '🟡 Moyenne', basse: '🟢 Basse' }

      for (const a of actions as any[]) {
        const axe = LABEL_NR_AXES.find(x => x.criteres.some(c => c.id === a.critere_id))
        const clr = axe ? (AXE_COLORS[axe.id] ?? { l: C.grayL }) : { l: C.grayL }
        const statBg = a.statut === 'termine' ? C.tealL : a.statut === 'en_cours' ? C.blueL : C.grayL

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

      sc(ws, 2, 2, 'Notes & Documents', { bold: true, sz: 14, bg: C.teal, fg: C.white })
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
      ws.columns = [{ width: 4 }, { width: 30 }, { width: 30 }, { width: 60 }]

      sc(ws, 2, 2, 'Correspondances avec les référentiels — Label Numérique Responsable', { bold: true, sz: 13, bg: C.teal, fg: C.white })
      merge(ws, 2, 2, 2, 4)
      ws.getRow(2).height = 28

      const hdrs = ['Référentiel', 'Axe NR', 'Correspondance']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      const correspondances = [
        { ref: 'Label NR — Agence LUCIE / INR', axe: 'Tous les axes', corr: 'Label Numérique Responsable : 2 paliers (NR niveau 1 — 18 mois, NR niveau 2 — 3 ans), audit tiers indépendant' },
        { ref: 'GR491 — INR', axe: 'Services numériques écoconçus', corr: 'Guide de référence de conception responsable de services numériques : 516 critères (stratégie, UX, contenus, frontend, backend, hébergement)' },
        { ref: 'RGESN', axe: 'Services numériques écoconçus', corr: "Référentiel général d'écoconception de services numériques (ARCEP/DINUM/ADEME) : 78 critères, déclaration d'écoconception" },
        { ref: 'RGAA / WCAG', axe: 'Numérique inclusif & éthique', corr: "Référentiel général d'amélioration de l'accessibilité : audits, déclaration d'accessibilité, schéma pluriannuel" },
        { ref: 'Loi REEN (n°2021-1485)', axe: 'Stratégie & Gouvernance NR', corr: "Réduction de l'empreinte environnementale du numérique : stratégie NR obligatoire pour les collectivités > 50 000 habitants" },
        { ref: 'Loi AGEC', axe: 'Achats & Équipements responsables', corr: "Lutte contre l'obsolescence, indice de réparabilité, achats reconditionnés dans la commande publique" },
        { ref: 'ISO/IEC 30134', axe: 'Services numériques écoconçus', corr: 'Indicateurs de performance des datacenters : PUE, REF (énergies renouvelables), WUE, ITEU' },
        { ref: 'ISO 26000', axe: 'Tous les axes', corr: "Lignes directrices de la responsabilité sociétale : environnement, loyauté des pratiques, questions consommateurs appliquées au numérique" },
        { ref: 'CSRD — ESRS E1/E5', axe: 'Achats & Équipements responsables', corr: 'Reporting de durabilité : E1 (énergie/GES du SI), E5 (économie circulaire des équipements, DEEE, réemploi)' },
        { ref: 'GRI Standards', axe: 'Usages & Données responsables', corr: 'GRI 301 (matières), 302 (énergie), 305 (émissions), 306 (déchets/DEEE), 418 (protection des données clients)' },
        { ref: 'ODD 9, 12 et 13', axe: 'Tous les axes', corr: 'ODD 9 (infrastructures durables et accès aux TIC), ODD 12 (consommation responsable), ODD 13 (action climatique)' },
        { ref: 'B Corp', axe: 'Stratégie & Gouvernance NR', corr: 'B Impact Assessment — volets Environnement et Clients (éthique des données, accessibilité) valorisant les pratiques NR' },
      ]

      let row = 5
      for (const c of correspondances) {
        sc(ws, row, 2, c.ref, { bg: C.white, sz: 9, bold: true })
        sc(ws, row, 3, c.axe, { bg: C.tealL, sz: 9 })
        sc(ws, row, 4, c.corr, { bg: C.white, sz: 8, wrap: true })
        ws.getRow(row).height = 22
        row++
      }
    }

    // ─── Export ───────────────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer()
    const filename = `Label_NR_${orgNom.replace(/[^a-z0-9]/gi, '_')}_${diag.annee}.xlsx`

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('[label-nr/export-excel]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

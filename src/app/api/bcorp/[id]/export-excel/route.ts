/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/bcorp/[id]/export-excel
 * Génère un fichier Excel structuré du diagnostic B Corp (B Impact Assessment — B Lab).
 *
 * Onglets :
 *  1. Couverture         — org, année, score global, badge de maturité
 *  2. Tableau de bord    — scores par aire d'impact, progression
 *  3. Critères détaillés — 20 critères, niveau, commentaire
 *  4. Plan d'actions     — toutes les actions, statut, échéance
 *  5. Notes & Annexes    — documents SharePoint (métadonnées seulement)
 *  6. Correspondances    — liens ISO 26000, CSRD/ESRS, GRI, ODD, BIA, société à mission, EcoVadis, SBTi
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─── Colors (palette ambre/doré B Corp) ──────────────────────────────────────
const C = {
  amber:   'FFB45309', amberL:  'FFFEF3C7',
  green:   'FF16A34A', greenL:  'FFDCFCE7',
  blue:    'FF2563EB', blueL:   'FFDBEAFE',
  purple:  'FF9333EA', purpleL: 'FFF3E8FF',
  red:     'FFDC2626', redL:    'FFFEE2E2',
  gray:    'FF6B7280', grayL:   'FFF3F4F6',
  white:   'FFFFFFFF', black:   'FF111827', border: 'FFE5E7EB',
  gold:    'FFD97706',
}

const AXE_COLORS: Record<string, { h: string; l: string }> = {
  gouvernance:    { h: C.amber,  l: C.amberL  },
  collaborateurs: { h: C.blue,   l: C.blueL   },
  communaute:     { h: C.purple, l: C.purpleL },
  environnement:  { h: C.green,  l: C.greenL  },
  clients:        { h: C.red,    l: C.redL    },
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

// ─── Données statiques B Corp ─────────────────────────────────────────────────
const BCORP_AXES = [
  { id: 'gouvernance',    label: 'Gouvernance',    icon: '🏛️', weight: 0.20, criteres: [
    { id: 'bc-gov-mission',      label: 'Mission à impact formalisée et intégrée à la prise de décision' },
    { id: 'bc-gov-ethique',      label: 'Éthique des affaires, anticorruption et code de conduite' },
    { id: 'bc-gov-transparence', label: 'Transparence (résultats financiers et extra-financiers, gouvernance ouverte)' },
    { id: 'bc-gov-statut',       label: 'Ancrage juridique de la mission (société à mission, statuts, « mission lock » B Corp)' },
  ]},
  { id: 'collaborateurs', label: 'Collaborateurs', icon: '👥', weight: 0.20, criteres: [
    { id: 'bc-col-remuneration',  label: 'Rémunération équitable (salaire décent, écarts de rémunération, partage de la valeur)' },
    { id: 'bc-col-sante',         label: 'Santé, sécurité et bien-être au travail' },
    { id: 'bc-col-developpement', label: 'Formation, développement des compétences et gestion de carrière' },
    { id: 'bc-col-engagement',    label: 'Engagement, satisfaction et participation des collaborateurs (dont actionnariat salarié)' },
  ]},
  { id: 'communaute',     label: 'Communauté',     icon: '🤝', weight: 0.20, criteres: [
    { id: 'bc-com-dei',          label: 'Diversité, équité et inclusion (recrutement, gouvernance, fournisseurs)' },
    { id: 'bc-com-local',        label: 'Impact économique local (emploi, achats locaux, ancrage territorial)' },
    { id: 'bc-com-fournisseurs', label: "Chaîne d'approvisionnement responsable (critères sociaux/environnementaux, audits)" },
    { id: 'bc-com-civique',      label: 'Engagement civique et dons (mécénat, bénévolat, partenariats associatifs)' },
  ]},
  { id: 'environnement',  label: 'Environnement',  icon: '🌍', weight: 0.20, criteres: [
    { id: 'bc-env-management', label: 'Système de management environnemental et politique formalisée' },
    { id: 'bc-env-climat',     label: 'Énergie et climat (consommations, énergies renouvelables, bilan GES, trajectoire de réduction)' },
    { id: 'bc-env-ressources', label: 'Eau, déchets et circularité (réduction, réemploi, recyclage)' },
    { id: 'bc-env-produits',   label: 'Impact environnemental des produits/services (écoconception, ACV, bénéfice environnemental)' },
  ]},
  { id: 'clients',        label: 'Clients',        icon: '🎯', weight: 0.20, criteres: [
    { id: 'bc-cli-valeur',    label: 'Valeur et qualité des produits/services (satisfaction, réclamations, amélioration continue)' },
    { id: 'bc-cli-donnees',   label: 'Protection des données clients et cybersécurité (RGPD)' },
    { id: 'bc-cli-marketing', label: 'Marketing et information responsables (transparence, anti-greenwashing)' },
    { id: 'bc-cli-impact',    label: "Modèles d'affaires à impact (clients mal desservis, bénéfice sociétal du produit)" },
  ]},
]

const BCORP_NIVEAUX = [
  { value: 0, label: 'Non engagé', pct: 0    },
  { value: 1, label: 'Découverte', pct: 0.25 },
  { value: 2, label: 'Structuré',  pct: 0.50 },
  { value: 3, label: 'Performant', pct: 0.75 },
  { value: 4, label: 'Exemplaire', pct: 1.00 },
]

const BADGE_LEVELS = [
  { label: 'Niveau certification',         min: 85 },
  { label: 'Proche du seuil BIA (80 pts)', min: 60 },
  { label: 'En chemin',                    min: 30 },
  { label: 'Non engagé',                   min: 0  },
]

function calculateScore(niveaux: Record<string, number>): number {
  let total = 0
  for (const axe of BCORP_AXES) {
    let axeScore = 0
    const nb = axe.criteres.length
    for (const c of axe.criteres) {
      const n = niveaux[c.id] ?? 0
      axeScore += (BCORP_NIVEAUX[n]?.pct ?? 0) / nb
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
  const { data } = await admin.from('bcorp_diagnostics').select('user_id').eq('id', diagnosticId).single()
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
      admin.from('bcorp_diagnostics').select('*, organisations(denomination, siret_siege, ville)').eq('id', params.id).single(),
      admin.from('bcorp_reponses').select('*').eq('diagnostic_id', params.id),
      admin.from('bcorp_actions').select('*').eq('diagnostic_id', params.id).order('created_at'),
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
    wb.creator = "Sens'ethO Apps — Diagnostic B Corp"
    wb.created = new Date()

    // ─── Onglet 1 : Couverture ────────────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Couverture', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 40 }, { width: 25 }, { width: 25 }]
      ws.getRow(1).height = 20
      ws.getRow(2).height = 50

      merge(ws, 2, 2, 2, 4)
      sc(ws, 2, 2, 'Diagnostic B Corp — B Impact Assessment (B Lab)', { bg: C.amber, fg: C.white, bold: true, sz: 13, ha: 'center' })

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
      sc(ws, row, 2, 'Score de maturité B Corp', { bold: true, sz: 14, bg: C.amber, fg: C.white, ha: 'center' })
      sc(ws, row, 3, scoreGlobal, { bold: true, sz: 18, bg: C.amber, fg: C.white, ha: 'center' })
      sc(ws, row, 4, `/ 100 — ${badge}`, { bold: true, bg: C.amber, fg: C.white, ha: 'center' })
      ws.getRow(row).height = 35

      row += 2
      sc(ws, row, 2, 'Cadre de référence B Corp', { bold: true, sz: 11, bg: C.grayL })
      merge(ws, row, 2, row, 4)
      row++
      const legalLines = [
        "Certification B Corp délivrée par B Lab, ONG fondée en 2006 aux États-Unis — environ 9 000 entreprises certifiées dans le monde",
        'Historiquement : B Impact Assessment (BIA) sur 200 points, seuil de certification fixé à 80 points, vérification par B Lab',
        'Recertification obligatoire tous les 3 ans avec amélioration continue attendue',
        "Nouveaux standards B Lab (2025) : exigences à satisfaire sur 7 thématiques d'impact, remplaçant progressivement le score unique",
        "Exigence juridique : modification des statuts pour ancrer la mission — en France, qualité de société à mission (loi PACTE) ou clause d'intérêt élargi des parties prenantes",
        'Niveaux : NC (Non engagé) → 1 (Découverte) → 2 (Structuré) → 3 (Performant) → 4 (Exemplaire)',
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

      sc(ws, 2, 2, "Synthèse par aire d'impact du diagnostic B Corp", { bold: true, sz: 14, bg: C.amber, fg: C.white, ha: 'center' })
      merge(ws, 2, 2, 2, 6)
      ws.getRow(2).height = 30

      const headers = ["Aire d'impact", 'Poids', 'Score aire', 'Critères évalués', 'Niveau moyen']
      headers.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const axe of BCORP_AXES) {
        const clr = AXE_COLORS[axe.id]
        const niveaux = axe.criteres.map(c => reponses[c.id] ?? 0)
        const pct = Math.round(niveaux.reduce((s, n) => s + (BCORP_NIVEAUX[n]?.pct ?? 0), 0) / axe.criteres.length * 100)
        const renseignes = niveaux.filter(n => n > 0).length
        const moy = niveaux.reduce((s, n) => s + n, 0) / axe.criteres.length

        sc(ws, row, 2, `${axe.icon} ${axe.label}`, { bg: clr.l, bold: true, sz: 10 })
        sc(ws, row, 3, `${Math.round(axe.weight * 100)}%`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 4, `${pct}%`, { bg: clr.l, bold: true, ha: 'center', fg: pct >= 60 ? C.amber : pct >= 30 ? C.gold : C.red })
        sc(ws, row, 5, `${renseignes} / ${axe.criteres.length}`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 6, BCORP_NIVEAUX[Math.round(moy)]?.label ?? 'Non engagé', { bg: clr.l, ha: 'center' })
        ws.getRow(row).height = 22
        row++
      }

      row += 2
      sc(ws, row, 2, 'Résumé', { bold: true, sz: 12, bg: C.grayL })
      sc(ws, row, 3, `Score global : ${scoreGlobal}/100 — ${badge}`, { bold: true, bg: C.amberL, fg: C.amber })
      merge(ws, row, 3, row, 6)
      ws.getRow(row).height = 22
    }

    // ─── Onglet 3 : Critères détaillés ───────────────────────────────────────
    {
      const ws = wb.addWorksheet('Critères détaillés', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 28 }, { width: 45 }, { width: 18 }, { width: 12 }, { width: 50 }]

      sc(ws, 2, 2, 'Détail par critère — Diagnostic B Corp', { bold: true, sz: 14, bg: C.amber, fg: C.white })
      merge(ws, 2, 2, 2, 6)
      ws.getRow(2).height = 30

      const hdrs = ["Aire d'impact", 'Critère', 'Niveau', 'Score (%)', 'Commentaire']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const axe of BCORP_AXES) {
        const clr = AXE_COLORS[axe.id]
        for (const c of axe.criteres) {
          const n = reponses[c.id] ?? 0
          const niv = BCORP_NIVEAUX[n]
          const pct = Math.round((niv?.pct ?? 0) * 100)
          sc(ws, row, 2, `${axe.icon} ${axe.label}`, { bg: clr.l, sz: 9 })
          sc(ws, row, 3, c.label, { bg: C.white, sz: 9 })
          sc(ws, row, 4, niv?.label ?? 'Non engagé', { bg: C.white, ha: 'center', sz: 9, bold: n > 0 })
          sc(ws, row, 5, pct === 0 ? '—' : `${pct}%`, { bg: C.white, ha: 'center', sz: 9, fg: pct >= 75 ? C.amber : pct >= 50 ? C.gold : C.red })
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

      sc(ws, 2, 2, "Plan d'actions — Diagnostic B Corp", { bold: true, sz: 14, bg: C.amber, fg: C.white })
      merge(ws, 2, 2, 2, 8)
      ws.getRow(2).height = 30

      const hdrs = ["Aire d'impact", 'Action', 'Priorité', 'Statut', 'Échéance', 'Responsable', 'Description']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      const STATUT_LABELS: Record<string, string> = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' }
      const PRIORITE_LABELS: Record<string, string> = { haute: '🔴 Haute', moyenne: '🟡 Moyenne', basse: '🟢 Basse' }

      for (const a of actions as any[]) {
        const axe = BCORP_AXES.find(x => x.criteres.some(c => c.id === a.critere_id))
        const clr = axe ? (AXE_COLORS[axe.id] ?? { l: C.grayL }) : { l: C.grayL }
        const statBg = a.statut === 'termine' ? C.amberL : a.statut === 'en_cours' ? C.blueL : C.grayL

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

      sc(ws, 2, 2, 'Notes & Documents', { bold: true, sz: 14, bg: C.amber, fg: C.white })
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

      sc(ws, 2, 2, 'Correspondances avec les référentiels — Diagnostic B Corp', { bold: true, sz: 13, bg: C.amber, fg: C.white })
      merge(ws, 2, 2, 2, 4)
      ws.getRow(2).height = 28

      const hdrs = ['Référentiel', 'Aire B Corp', 'Correspondance']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      const correspondances = [
        { ref: 'B Impact Assessment (BIA) — B Lab', axe: 'Toutes les aires', corr: "Outil historique d'évaluation : 200 points sur 5 aires d'impact (Gouvernance, Collaborateurs, Communauté, Environnement, Clients), seuil de certification à 80 points" },
        { ref: 'Nouveaux standards B Lab (2025)', axe: 'Toutes les aires', corr: "Exigences à satisfaire sur 7 thématiques d'impact (mission et gouvernance, conduite éthique, droits humains, action climatique, gestion environnementale, JEDI, affaires publiques) remplaçant progressivement le score unique" },
        { ref: 'Société à mission — loi PACTE', axe: 'Gouvernance', corr: "Ancrage juridique de la mission en France : raison d'être, objectifs statutaires, comité de mission et vérification par OTI — répond au « mission lock » exigé par B Corp" },
        { ref: 'ISO 26000', axe: 'Toutes les aires', corr: "Lignes directrices de la responsabilité sociétale : gouvernance, droits de l'Homme, relations et conditions de travail, environnement, loyauté des pratiques, consommateurs, communautés" },
        { ref: 'CSRD — ESRS', axe: 'Toutes les aires', corr: 'Reporting de durabilité : ESRS 2 (gouvernance), S1 (effectifs), S2-S3 (chaîne de valeur, communautés), E1-E5 (climat, ressources), G1 (conduite des affaires)' },
        { ref: 'GRI Standards', axe: 'Toutes les aires', corr: 'GRI 2 (gouvernance), 205 (anticorruption), 401-404 (emploi, santé-sécurité, formation), 305-306 (émissions, déchets), 413 (communautés locales), 418 (données clients)' },
        { ref: 'ODD 8, 10, 12 et 13', axe: 'Toutes les aires', corr: 'ODD 8 (travail décent), ODD 10 (réduction des inégalités), ODD 12 (consommation et production responsables), ODD 13 (action climatique)' },
        { ref: 'EcoVadis', axe: 'Toutes les aires', corr: 'Notation RSE : les politiques, actions et résultats documentés pour B Corp alimentent les thèmes Environnement, Social & Droits humains, Éthique et Achats responsables' },
        { ref: 'Science Based Targets (SBTi)', axe: 'Environnement', corr: "Trajectoire de réduction des émissions GES alignée sur la science — renforce l'aire Environnement du BIA et l'exigence climat des nouveaux standards B Lab" },
      ]

      let row = 5
      for (const c of correspondances) {
        sc(ws, row, 2, c.ref, { bg: C.white, sz: 9, bold: true })
        sc(ws, row, 3, c.axe, { bg: C.amberL, sz: 9 })
        sc(ws, row, 4, c.corr, { bg: C.white, sz: 8, wrap: true })
        ws.getRow(row).height = 22
        row++
      }
    }

    // ─── Export ───────────────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer()
    const filename = `BCorp_${orgNom.replace(/[^a-z0-9]/gi, '_')}_${diag.annee}.xlsx`

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('[bcorp/export-excel]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

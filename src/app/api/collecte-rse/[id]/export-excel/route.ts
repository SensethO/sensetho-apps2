/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/collecte-rse/[id]/export-excel
 * Génère un fichier Excel structuré de la Collecte documentaire RSE (préparation au diagnostic initial de maturité RSE — ISO 26000).
 *
 * Onglets :
 *  1. Couverture            — org, année, taux de complétude, badge dossier
 *  2. Tableau de bord       — complétude par axe, progression
 *  3. Check-list documentaire — 20 catégories de documents, état, commentaire
 *  4. Plan d'actions        — actions de constitution des documents manquants
 *  5. Notes & Annexes       — documents déposés sur SharePoint (métadonnées)
 *  6. Correspondances       — liens apps Sens'ethO + référentiels externes
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─── Colors (palette indigo documentaire — Collecte RSE) ─────────────────────
const C = {
  indigo:  'FF4F46E5', indigoL: 'FFE0E7FF',
  blue:    'FF2563EB', blueL:   'FFDBEAFE',
  green:   'FF16A34A', greenL:  'FFDCFCE7',
  orange:  'FFEA580C', orangeL: 'FFFFEDD5',
  violet:  'FF9333EA', violetL: 'FFF3E8FF',
  gray:    'FF6B7280', grayL:   'FFF3F4F6',
  white:   'FFFFFFFF', black:   'FF111827', border: 'FFE5E7EB',
  amber:   'FFF97316',
}

const AXE_COLORS: Record<string, { h: string; l: string }> = {
  gouvernance:  { h: C.indigo, l: C.indigoL },
  social:       { h: C.blue,   l: C.blueL   },
  environnement:{ h: C.green,  l: C.greenL  },
  loyaute:      { h: C.orange, l: C.orangeL },
  territoire:   { h: C.violet, l: C.violetL },
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

// ─── Données statiques Collecte RSE ───────────────────────────────────────────
const COLLECTE_RSE_AXES = [
  { id: 'gouvernance', label: 'Gouvernance & Stratégie', icon: '🧭', weight: 0.20, criteres: [
    { id: 'col-gov-juridique',   label: "Documents juridiques & organisation (Kbis, statuts, organigramme, raison d'être / clause de mission)" },
    { id: 'col-gov-strategie',   label: 'Stratégie & politique RSE (feuille de route, politique RSE signée, comptes rendus de comité RSE)' },
    { id: 'col-gov-materialite', label: 'Analyse de matérialité & cartographie des parties prenantes' },
    { id: 'col-gov-ethique',     label: 'Éthique & gestion des risques (code de conduite, cartographie des risques RSE, rapports RSE antérieurs)' },
  ]},
  { id: 'social', label: 'Social & Conditions de travail', icon: '👥', weight: 0.20, criteres: [
    { id: 'col-soc-donnees',  label: 'Données sociales (bilan social, DSN, registre du personnel, pyramide des âges)' },
    { id: 'col-soc-sst',      label: 'Santé & sécurité au travail (DUERP et plan d\'actions, politique SST, taux de fréquence/gravité, registre AT/MP)' },
    { id: 'col-soc-dialogue', label: 'Dialogue social & compétences (accords d\'entreprise, PV du CSE, plan de développement des compétences, entretiens annuels)' },
    { id: 'col-soc-egalite',  label: 'Égalité, diversité & droits humains (index égalité F/H, politique handicap/DOETH, politique droits humains, dispositif d\'alerte)' },
  ]},
  { id: 'environnement', label: 'Environnement', icon: '🌍', weight: 0.20, criteres: [
    { id: 'col-env-politique',      label: 'Politique & certifications environnementales (politique, ISO 14001/50001 le cas échéant, conformité ICPE)' },
    { id: 'col-env-climat',         label: 'Énergie & climat (bilan GES / Bilan Carbone scopes 1-2-3, plan de transition, suivis de consommations, audit énergétique)' },
    { id: 'col-env-dechets',        label: 'Déchets & circularité (registre des déchets, BSD, contrats de collecte, taux de valorisation)' },
    { id: 'col-env-ecoconception',  label: 'Écoconception & achats responsables (ACV produits, démarche d\'écoconception, politique achats verts)' },
  ]},
  { id: 'loyaute', label: 'Loyauté & Clients', icon: '🤝', weight: 0.20, criteres: [
    { id: 'col-loy-anticorruption', label: 'Anticorruption (code/politique anticorruption, cartographie des risques de corruption, dispositif Sapin II le cas échéant)' },
    { id: 'col-loy-achats',         label: 'Achats responsables (charte fournisseurs, clauses RSE des contrats, suivi des délais de paiement)' },
    { id: 'col-loy-produits',       label: 'Conformité produits & satisfaction clients (marquage CE/GPSR, politique qualité, suivi satisfaction et réclamations, procédure de rappel)' },
    { id: 'col-loy-rgpd',           label: 'Protection des données personnelles (registre des traitements RGPD, mentions d\'information, désignation DPO)' },
  ]},
  { id: 'territoire', label: 'Territoire & Reporting', icon: '📊', weight: 0.20, criteres: [
    { id: 'col-ter-ancrage',   label: 'Ancrage territorial & partenariats locaux (part d\'achats locaux, partenariats, conventions)' },
    { id: 'col-ter-mecenat',   label: 'Mécénat & engagement sociétal (dons, bénévolat de compétences, actions ESS/insertion)' },
    { id: 'col-ter-cadrage',   label: 'Cadrage de l\'entreprise (présentation activité/effectif/CA, chaîne de valeur, bilans et comptes de résultat 2-3 exercices)' },
    { id: 'col-ter-reporting', label: 'Reporting & labels (DPEF/CSRD/VSME, notation EcoVadis, labels obtenus, obligations réglementaires applicables)' },
  ]},
]

const COLLECTE_RSE_NIVEAUX = [
  { value: 0, label: 'Absent',           pct: 0    },
  { value: 1, label: 'À constituer',     pct: 0.25 },
  { value: 2, label: 'Partiel',          pct: 0.50 },
  { value: 3, label: 'Disponible',       pct: 0.75 },
  { value: 4, label: 'À jour & validé',  pct: 1.00 },
]

const BADGE_LEVELS = [
  { label: 'Dossier exemplaire',              min: 85 },
  { label: 'Dossier prêt pour le diagnostic', min: 60 },
  { label: 'Collecte en cours',               min: 30 },
  { label: 'Dossier insuffisant',             min: 0  },
]

function calculateScore(niveaux: Record<string, number>): number {
  let total = 0
  for (const axe of COLLECTE_RSE_AXES) {
    let axeScore = 0
    const nb = axe.criteres.length
    for (const c of axe.criteres) {
      const n = niveaux[c.id] ?? 0
      axeScore += (COLLECTE_RSE_NIVEAUX[n]?.pct ?? 0) / nb
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
  const { data } = await admin.from('collecte_rse_diagnostics').select('user_id').eq('id', diagnosticId).single()
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
      admin.from('collecte_rse_diagnostics').select('*, organisations(nom, siret, pays)').eq('id', params.id).single(),
      admin.from('collecte_rse_reponses').select('*').eq('diagnostic_id', params.id),
      admin.from('collecte_rse_actions').select('*').eq('diagnostic_id', params.id).order('created_at'),
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
    const badge = BADGE_LEVELS.find(b => scoreGlobal >= b.min)?.label ?? 'Dossier insuffisant'
    const org = diag.organisations as { nom?: string; siret?: string; pays?: string } | null
    const orgNom = org?.nom ?? 'Organisation'
    const dateExport = new Date().toLocaleDateString('fr-FR')

    // ─── Workbook ────────────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook()
    wb.creator = "Sens'ethO Apps — Collecte documentaire RSE"
    wb.created = new Date()

    // ─── Onglet 1 : Couverture ────────────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Couverture', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 40 }, { width: 25 }, { width: 25 }]
      ws.getRow(1).height = 20
      ws.getRow(2).height = 50

      merge(ws, 2, 2, 2, 4)
      sc(ws, 2, 2, 'Collecte documentaire RSE — Préparation au diagnostic initial de maturité RSE (ISO 26000)', { bg: C.indigo, fg: C.white, bold: true, sz: 13, ha: 'center' })

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
      sc(ws, row, 2, 'Taux de complétude', { bold: true, sz: 14, bg: C.indigo, fg: C.white, ha: 'center' })
      sc(ws, row, 3, scoreGlobal, { bold: true, sz: 18, bg: C.indigo, fg: C.white, ha: 'center' })
      sc(ws, row, 4, `% — ${badge}`, { bold: true, bg: C.indigo, fg: C.white, ha: 'center' })
      ws.getRow(row).height = 35

      row += 2
      sc(ws, row, 2, 'À propos de la collecte documentaire RSE', { bold: true, sz: 11, bg: C.grayL })
      merge(ws, row, 2, row, 4)
      row++
      const infoLines = [
        'Outil de préparation au diagnostic initial de maturité RSE selon l’ISO 26000 : rassembler les preuves documentaires attendues et mesurer le taux de complétude du dossier',
        'Les catégories de documents sont organisées selon les 7 questions centrales de l’ISO 26000, regroupées en 5 axes de collecte',
        'L’absence d’un document est elle-même une donnée de maturité — privilégier les preuves datées, signées et validées',
        'Adapter au profil de la PME : tous les documents ne concernent pas toutes les structures',
        'Les pièces se déposent directement sur SharePoint, classées par catégorie, et alimentent les autres apps RSE (Diagnostic initial ISO 26000, AFAQ 26000, Bilan GES…)',
        'États du document : NC (Absent) → 1 (À constituer) → 2 (Partiel) → 3 (Disponible) → 4 (À jour & validé)',
        'Badges : 0-30% Dossier insuffisant · 30-60% Collecte en cours · 60-85% Dossier prêt pour le diagnostic · 85-100% Dossier exemplaire',
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
      ws.columns = [{ width: 4 }, { width: 42 }, { width: 12 }, { width: 18 }, { width: 22 }, { width: 18 }]

      sc(ws, 2, 2, 'Complétude par axe de collecte', { bold: true, sz: 14, bg: C.indigo, fg: C.white, ha: 'center' })
      merge(ws, 2, 2, 2, 6)
      ws.getRow(2).height = 30

      const headers = ['Axe', 'Poids', 'Complétude', 'Documents disponibles', 'État moyen']
      headers.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const axe of COLLECTE_RSE_AXES) {
        const clr = AXE_COLORS[axe.id]
        const niveaux = axe.criteres.map(c => reponses[c.id] ?? 0)
        const pct = Math.round(niveaux.reduce((s, n) => s + (COLLECTE_RSE_NIVEAUX[n]?.pct ?? 0), 0) / axe.criteres.length * 100)
        const disponibles = niveaux.filter(n => n >= 3).length
        const moy = niveaux.reduce((s, n) => s + n, 0) / axe.criteres.length

        sc(ws, row, 2, `${axe.icon} ${axe.label}`, { bg: clr.l, bold: true, sz: 10 })
        sc(ws, row, 3, `${Math.round(axe.weight * 100)}%`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 4, `${pct}%`, { bg: clr.l, bold: true, ha: 'center', fg: pct >= 60 ? C.green : pct >= 30 ? C.amber : C.indigo })
        sc(ws, row, 5, `${disponibles} / ${axe.criteres.length}`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 6, COLLECTE_RSE_NIVEAUX[Math.round(moy)]?.label ?? 'Absent', { bg: clr.l, ha: 'center' })
        ws.getRow(row).height = 22
        row++
      }

      row += 2
      sc(ws, row, 2, 'Résumé', { bold: true, sz: 12, bg: C.grayL })
      sc(ws, row, 3, `Taux de complétude global : ${scoreGlobal}% — ${badge}`, { bold: true, bg: C.indigoL, fg: C.indigo })
      merge(ws, row, 3, row, 6)
      ws.getRow(row).height = 22
    }

    // ─── Onglet 3 : Check-list documentaire ───────────────────────────────────
    {
      const ws = wb.addWorksheet('Check-list documentaire', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 32 }, { width: 52 }, { width: 18 }, { width: 12 }, { width: 50 }]

      sc(ws, 2, 2, 'Check-list documentaire — Collecte RSE', { bold: true, sz: 14, bg: C.indigo, fg: C.white })
      merge(ws, 2, 2, 2, 6)
      ws.getRow(2).height = 30

      const hdrs = ['Axe', 'Catégorie de documents', 'État', 'Complétude (%)', 'Commentaire']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const axe of COLLECTE_RSE_AXES) {
        const clr = AXE_COLORS[axe.id]
        for (const c of axe.criteres) {
          const n = reponses[c.id] ?? 0
          const niv = COLLECTE_RSE_NIVEAUX[n]
          const pct = Math.round((niv?.pct ?? 0) * 100)
          sc(ws, row, 2, `${axe.icon} ${axe.label}`, { bg: clr.l, sz: 9 })
          sc(ws, row, 3, c.label, { bg: C.white, sz: 9 })
          sc(ws, row, 4, niv?.label ?? 'Absent', { bg: C.white, ha: 'center', sz: 9, bold: n > 0 })
          sc(ws, row, 5, pct === 0 ? '—' : `${pct}%`, { bg: C.white, ha: 'center', sz: 9, fg: pct >= 75 ? C.green : pct >= 50 ? C.amber : C.indigo })
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

      sc(ws, 2, 2, "Plan d'actions — Documents à constituer", { bold: true, sz: 14, bg: C.indigo, fg: C.white })
      merge(ws, 2, 2, 2, 8)
      ws.getRow(2).height = 30

      const hdrs = ['Axe', 'Action', 'Priorité', 'Statut', 'Échéance', 'Responsable', 'Description']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      const STATUT_LABELS: Record<string, string> = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' }
      const PRIORITE_LABELS: Record<string, string> = { haute: '🔴 Haute', moyenne: '🟡 Moyenne', basse: '🟢 Basse' }

      for (const a of actions as any[]) {
        const axe = COLLECTE_RSE_AXES.find(x => x.criteres.some(c => c.id === a.critere_id))
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

    // ─── Onglet 5 : Notes & Annexes (documents déposés) ───────────────────────
    {
      const ws = wb.addWorksheet('Notes & Annexes', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 30 }, { width: 20 }]

      sc(ws, 2, 2, 'Documents déposés', { bold: true, sz: 14, bg: C.indigo, fg: C.white })
      merge(ws, 2, 2, 2, 3)
      ws.getRow(2).height = 30

      sc(ws, 3, 2, 'Note : Les documents sont déposés et stockés dans SharePoint, classés par catégorie. Accédez aux URLs de téléchargement depuis l\'application.', { it: true, fg: C.gray, sz: 9 })
      merge(ws, 3, 2, 3, 3)

      sc(ws, 5, 2, 'Consultez l\'application pour accéder aux pièces déposées par catégorie de documents.', { it: true, fg: C.gray, sz: 10 })
      merge(ws, 5, 2, 5, 3)
    }

    // ─── Onglet 6 : Correspondances ───────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Correspondances', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 36 }, { width: 30 }, { width: 60 }]

      sc(ws, 2, 2, 'Correspondances — Collecte documentaire RSE', { bold: true, sz: 13, bg: C.indigo, fg: C.white })
      merge(ws, 2, 2, 2, 4)
      ws.getRow(2).height = 28

      const hdrs = ['Référentiel / Application', 'Axe de collecte', 'Correspondance']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      const correspondances = [
        { ref: 'Diagnostic initial guidé ISO 26000', axe: 'Tous les axes', corr: 'La collecte documentaire alimente directement le diagnostic initial : chaque preuve rassemblée vient étayer l’auto-évaluation de maturité des 7 questions centrales de l’ISO 26000' },
        { ref: 'Diagnostic RSE ISO 26000 complet', axe: 'Tous les axes', corr: 'Le dossier documentaire constitue le socle de preuves du diagnostic RSE ISO 26000 complet (/rse/iso26000)' },
        { ref: 'Évaluation AFAQ 26000', axe: 'Gouvernance / Tous', corr: 'L’évaluation AFAQ 26000 (/rse/afaq26000) s’appuie sur les mêmes preuves documentaires — politiques, indicateurs, comptes rendus' },
        { ref: 'EcoVadis', axe: 'Tous les axes', corr: 'La notation EcoVadis (/rse/ecovadis) exige des preuves documentaires par pilier : la collecte les centralise et les tient à jour' },
        { ref: 'Bilan GES', axe: 'Environnement', corr: 'Le Bilan GES (/rse/bilan-ges) réutilise les factures, suivis de consommations et le bilan carbone collectés dans l’axe Environnement' },
        { ref: 'VSME / EFRAG', axe: 'Territoire & Reporting', corr: 'Le standard volontaire VSME (/rse/vsme-efrag) pour PME mobilise les mêmes documents de reporting et indicateurs collectés' },
        { ref: 'ISO 26000 — 7 questions centrales', axe: 'Tous les axes', corr: 'Gouvernance, droits humains, relations et conditions de travail, environnement, loyauté des pratiques, questions consommateurs, communautés et développement local' },
        { ref: 'CSRD / ESRS', axe: 'Territoire & Reporting', corr: 'Les standards ESRS structurent les datapoints de durabilité : les documents collectés préfigurent le reporting CSRD ou VSME' },
        { ref: 'GRI Standards', axe: 'Tous les axes', corr: 'Référentiel international de reporting : les indicateurs et politiques collectés alimentent les standards GRI thématiques' },
        { ref: 'ODD / SDGs', axe: 'Tous les axes', corr: 'Les 17 Objectifs de développement durable : les preuves d’engagement collectées documentent la contribution de la PME aux ODD' },
        { ref: 'Loi Sapin II', axe: 'Loyauté & Clients', corr: 'Dispositif anticorruption : code de conduite, cartographie des risques et dispositif d’alerte collectés dans l’axe Loyauté' },
        { ref: 'RGPD', axe: 'Loyauté & Clients', corr: 'Protection des données : registre des traitements, mentions d’information et désignation DPO collectés dans l’axe Loyauté' },
        { ref: 'GPSR — Règlement (UE) 2023/988', axe: 'Loyauté & Clients', corr: 'Sécurité des produits : marquage CE/GPSR, procédure de rappel et suivi des réclamations collectés dans l’axe Loyauté' },
        { ref: 'Index égalité F/H', axe: 'Social & Conditions de travail', corr: 'Index de l’égalité professionnelle femmes-hommes collecté dans l’axe Social (égalité, diversité & droits humains)' },
        { ref: 'DUERP — Code du travail', axe: 'Social & Conditions de travail', corr: 'Document unique d’évaluation des risques professionnels et plan d’actions collectés dans l’axe Social (santé & sécurité au travail)' },
      ]

      let row = 5
      for (const c of correspondances) {
        sc(ws, row, 2, c.ref, { bg: C.white, sz: 9, bold: true })
        sc(ws, row, 3, c.axe, { bg: C.indigoL, sz: 9 })
        sc(ws, row, 4, c.corr, { bg: C.white, sz: 8, wrap: true })
        ws.getRow(row).height = 22
        row++
      }
    }

    // ─── Export ───────────────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer()
    const filename = `Collecte_RSE_${orgNom.replace(/[^a-z0-9]/gi, '_')}_${diag.annee}.xlsx`

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('[collecte-rse/export-excel]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

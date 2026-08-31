/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/ecgt/[id]/export-excel
 * Génère un fichier Excel structuré du diagnostic « Conformité ECGT »
 * — directive (UE) 2024/825 (Empowering Consumers for the Green Transition).
 *
 * Onglets :
 *  1. Couverture           — org, année, score global, badge, calendrier réglementaire
 *  2. Tableau de bord      — scores par axe, progression
 *  3. Critères détaillés   — 20 critères, niveau, commentaire
 *  4. Plan d'actions       — statut, priorité, échéance, responsable
 *  5. Notes & Annexes      — liste réelle des pièces jointes SharePoint (réf. A00x)
 *  6. Correspondances      — autres référentiels et apps de la plateforme
 *  7. Contenus & constats  — spécifique ECGT : contenus analysés et non-conformités
 *
 * Le référentiel est importé de src/lib/ecgt/referentiel.ts (source de vérité
 * unique, partagée avec l'interface et le moteur d'analyse).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ExcelJS from 'exceljs'
import {
  ECGT_AXES,
  ECGT_NIVEAUX,
  ECGT_BADGES,
  ECGT_CALENDRIER,
  ECGT_GRAVITES,
  calculateEcgtScore,
  findEcgtCritere,
} from '@/lib/ecgt/referentiel'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const C = {
  green:   'FF15803D', greenL:  'FFDCFCE7',
  amber:   'FFB45309', amberL:  'FFFEF3C7',
  teal:    'FF0E7490', tealL:   'FFCFFAFE',
  purple:  'FF6D28D9', purpleL: 'FFEDE9FE',
  red:     'FFBE123C', redL:    'FFFFE4E6',
  blue:    'FF1E40AF', blueL:   'FFDBEAFE',
  gray:    'FF6B7280', grayL:   'FFF3F4F6',
  white:   'FFFFFFFF', black:   'FF111827', border: 'FFE5E7EB',
}

const AXE_COLORS: Record<string, { h: string; l: string }> = {
  allegations: { h: C.green,  l: C.greenL  },
  labels:      { h: C.amber,  l: C.amberL  },
  carbone:     { h: C.teal,   l: C.tealL   },
  durabilite:  { h: C.purple, l: C.purpleL },
  gouvernance: { h: C.red,    l: C.redL    },
}

const GRAVITE_COLORS: Record<string, { h: string; l: string }> = {
  critique:  { h: 'FFB91C1C', l: 'FFFEE2E2' },
  majeur:    { h: 'FFC2410C', l: 'FFFFEDD5' },
  mineur:    { h: 'FFA16207', l: 'FFFEF9C3' },
  vigilance: { h: 'FF0369A1', l: 'FFE0F2FE' },
}

type CS = { bg?: string; fg?: string; bold?: boolean; sz?: number; ha?: 'left'|'right'|'center'; it?: boolean; wrap?: boolean; indent?: number }

function sc(ws: ExcelJS.Worksheet, r: number, c: number, val: ExcelJS.CellValue, s: CS = {}) {
  const cell = ws.getCell(r, c)
  cell.value = val
  if (s.bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: s.bg } }
  if (s.bold || s.sz || s.fg || s.it) {
    cell.font = { ...(s.bold && { bold: true }), ...(s.sz && { size: s.sz }), ...(s.fg && { color: { argb: s.fg } }), ...(s.it && { italic: true }) }
  }
  cell.alignment = { horizontal: s.ha ?? 'left', vertical: 'middle', wrapText: s.wrap ?? false, indent: s.indent }
  cell.border = { top: { style: 'thin', color: { argb: C.border } }, bottom: { style: 'thin', color: { argb: C.border } }, left: { style: 'thin', color: { argb: C.border } }, right: { style: 'thin', color: { argb: C.border } } }
}

function merge(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number) {
  ws.mergeCells(r1, c1, r2, c2)
}

async function canAccess(userId: string, diagnosticId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data } = await admin.from('ecgt_diagnostics').select('user_id').eq('id', diagnosticId).single()
  return data?.user_id === userId
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createAdminClient()
    const [diagRes, repRes, actRes, notesRes, contRes] = await Promise.all([
      admin.from('ecgt_diagnostics').select('*, organisations(denomination, siret_siege, ville)').eq('id', params.id).single(),
      admin.from('ecgt_reponses').select('*').eq('diagnostic_id', params.id),
      admin.from('ecgt_actions').select('*').eq('diagnostic_id', params.id).order('created_at'),
      admin.from('ecgt_notes').select('critere_id, sections').eq('diagnostic_id', params.id),
      admin.from('ecgt_contenus').select('*').eq('diagnostic_id', params.id).order('created_at'),
    ])

    const diag = diagRes.data as any
    if (!diag) return NextResponse.json({ error: 'Diagnostic non trouvé' }, { status: 404 })

    const contenus = (contRes.data ?? []) as any[]
    let constats: any[] = []
    if (contenus.length) {
      const { data } = await admin
        .from('ecgt_constats')
        .select('*')
        .in('contenu_id', contenus.map(c => c.id))
        .order('created_at')
      constats = data ?? []
    }

    const reponses: Record<string, number> = {}
    const commentaires: Record<string, string> = {}
    for (const r of (repRes.data ?? [])) {
      reponses[r.critere_id] = r.niveau
      if (r.commentaire) commentaires[r.critere_id] = r.commentaire
    }
    const actions = actRes.data ?? []
    const scoreGlobal = calculateEcgtScore(reponses)
    const badge = ECGT_BADGES.find(b => scoreGlobal >= b.min)?.label ?? 'Insuffisant'
    const org = diag.organisations as { denomination?: string; siret_siege?: string; ville?: string } | null
    const orgNom = org?.denomination ?? 'Organisation'
    const dateExport = new Date().toLocaleDateString('fr-FR')

    const wb = new ExcelJS.Workbook()
    wb.creator = "Sens'ethO Apps — Conformité ECGT"
    wb.created = new Date()

    // ─── Onglet 1 : Couverture ────────────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Couverture', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 42 }, { width: 25 }, { width: 28 }]
      ws.getRow(2).height = 50
      merge(ws, 2, 2, 2, 4)
      sc(ws, 2, 2, 'Conformité ECGT — directive (UE) 2024/825 « Empowering Consumers for the Green Transition »', { bg: C.green, fg: C.white, bold: true, sz: 12, ha: 'center' })

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
      sc(ws, row, 2, 'Score de conformité ECGT', { bold: true, sz: 13, bg: C.green, fg: C.white, ha: 'center' })
      sc(ws, row, 3, scoreGlobal, { bold: true, sz: 18, bg: C.green, fg: C.white, ha: 'center' })
      sc(ws, row, 4, `/ 100 — ${badge}`, { bold: true, bg: C.green, fg: C.white, ha: 'center' })
      ws.getRow(row).height = 35

      row += 2
      sc(ws, row, 2, 'Calendrier réglementaire', { bold: true, sz: 11, bg: C.grayL })
      merge(ws, row, 2, row, 4); row++
      for (const line of [
        ECGT_CALENDRIER.adoption,
        ECGT_CALENDRIER.transposition,
        ECGT_CALENDRIER.application,
        "La directive modifie la directive 2005/29/CE (pratiques commerciales déloyales) et la directive 2011/83/UE (droits des consommateurs)",
        ECGT_CALENDRIER.note,
      ]) {
        sc(ws, row, 2, `• ${line}`, { sz: 9, bg: C.white, wrap: true, indent: 1 })
        merge(ws, row, 2, row, 4)
        ws.getRow(row).height = 28; row++
      }

      row++
      const nbCritiques = constats.filter(c => c.gravite === 'critique' && c.statut === 'ouvert').length
      sc(ws, row, 2, 'Contenus analysés', { bold: true, bg: C.grayL })
      sc(ws, row, 3, contenus.length, { bg: C.white, ha: 'center', bold: true }); row++
      sc(ws, row, 2, 'Constats ouverts', { bold: true, bg: C.grayL })
      sc(ws, row, 3, constats.filter(c => c.statut === 'ouvert').length, { bg: C.white, ha: 'center', bold: true }); row++
      sc(ws, row, 2, 'dont constats critiques (liste noire annexe I)', { bold: true, bg: C.grayL })
      sc(ws, row, 3, nbCritiques, { bg: nbCritiques > 0 ? GRAVITE_COLORS.critique.l : C.white, fg: nbCritiques > 0 ? GRAVITE_COLORS.critique.h : C.black, ha: 'center', bold: true })
    }

    // ─── Onglet 2 : Tableau de bord ───────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Tableau de bord', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 38 }, { width: 12 }, { width: 18 }, { width: 20 }, { width: 18 }]
      sc(ws, 2, 2, 'Synthèse par axe — Conformité ECGT', { bold: true, sz: 14, bg: C.green, fg: C.white, ha: 'center' })
      merge(ws, 2, 2, 2, 6); ws.getRow(2).height = 30

      const headers = ['Axe', 'Poids', 'Score axe', 'Critères évalués', 'Niveau moyen']
      headers.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const axe of ECGT_AXES) {
        const clr = AXE_COLORS[axe.id] ?? { h: C.gray, l: C.grayL }
        const niveaux = axe.criteres.map(c => reponses[c.id] ?? 0)
        const pct = Math.round(niveaux.reduce((s, n) => s + (ECGT_NIVEAUX[n]?.pct ?? 0), 0) / axe.criteres.length * 100)
        const renseignes = niveaux.filter(n => n > 0).length
        const moy = niveaux.reduce((s, n) => s + n, 0) / axe.criteres.length
        sc(ws, row, 2, `${axe.icon} ${axe.label}`, { bg: clr.l, bold: true, sz: 10 })
        sc(ws, row, 3, `${Math.round(axe.weight * 100)}%`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 4, `${pct}%`, { bg: clr.l, bold: true, ha: 'center', fg: pct >= 60 ? C.green : pct >= 30 ? C.amber : C.red })
        sc(ws, row, 5, `${renseignes} / ${axe.criteres.length}`, { bg: clr.l, ha: 'center' })
        sc(ws, row, 6, ECGT_NIVEAUX[Math.round(moy)]?.label ?? 'Non conforme', { bg: clr.l, ha: 'center' })
        ws.getRow(row).height = 22; row++
      }
      row += 2
      sc(ws, row, 2, 'Résumé', { bold: true, sz: 12, bg: C.grayL })
      sc(ws, row, 3, `Score global : ${scoreGlobal}/100 — ${badge}`, { bold: true, bg: C.greenL, fg: C.green })
      merge(ws, row, 3, row, 6); ws.getRow(row).height = 22
    }

    // ─── Onglet 3 : Critères détaillés ────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Critères détaillés', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 30 }, { width: 42 }, { width: 18 }, { width: 12 }, { width: 50 }]
      sc(ws, 2, 2, 'Détail par critère — Conformité ECGT', { bold: true, sz: 14, bg: C.green, fg: C.white })
      merge(ws, 2, 2, 2, 6); ws.getRow(2).height = 30

      const hdrs = ['Axe', 'Critère', 'Niveau', 'Score (%)', 'Commentaire']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const axe of ECGT_AXES) {
        const clr = AXE_COLORS[axe.id] ?? { h: C.gray, l: C.grayL }
        for (const c of axe.criteres) {
          const n = reponses[c.id] ?? 0
          const niv = ECGT_NIVEAUX[n]
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
      ws.columns = [{ width: 4 }, { width: 28 }, { width: 38 }, { width: 11 }, { width: 12 }, { width: 14 }, { width: 18 }, { width: 40 }]
      sc(ws, 2, 2, "Plan d'actions — Conformité ECGT", { bold: true, sz: 14, bg: C.green, fg: C.white })
      merge(ws, 2, 2, 2, 8); ws.getRow(2).height = 30

      const hdrs = ['Axe', 'Action', 'Priorité', 'Statut', 'Échéance', 'Responsable', 'Description']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      const STATUT_LABELS: Record<string, string> = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé' }
      const PRIORITE_LABELS: Record<string, string> = { haute: '🔴 Haute', moyenne: '🟡 Moyenne', basse: '🟢 Basse' }

      for (const a of actions as any[]) {
        const found = findEcgtCritere(a.critere_id)
        const clr = found ? (AXE_COLORS[found.axe.id] ?? { l: C.grayL }) : { l: C.grayL }
        const statBg = a.statut === 'termine' ? C.greenL : a.statut === 'en_cours' ? C.blueL : C.grayL
        sc(ws, row, 2, found ? `${found.axe.icon} ${found.axe.label}` : a.critere_id, { bg: clr.l, sz: 9 })
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

    // ─── Onglet 5 : Notes & Annexes (liste réelle) ────────────────────────────
    {
      const ws = wb.addWorksheet('Notes & Annexes', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 8 }, { width: 42 }, { width: 34 }, { width: 18 }, { width: 10 }]

      sc(ws, 2, 2, 'Pièces jointes & Annexes', { bold: true, sz: 14, bg: C.green, fg: C.white })
      merge(ws, 2, 2, 2, 6); ws.getRow(2).height = 30

      sc(ws, 3, 2, 'Note : les fichiers sont stockés dans SharePoint. Les URL de téléchargement sont générées à la demande depuis l’application.', { it: true, fg: C.gray, sz: 9 })
      merge(ws, 3, 2, 3, 6)

      const hdrs = ['Réf.', 'Nom du fichier', 'Critère', 'Type', 'Taille']
      hdrs.forEach((h, i) => sc(ws, 5, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      const annexes: { ref: string; name: string; critere: string; mime: string; size: number | null }[] = []
      for (const n of (notesRes.data ?? []) as any[]) {
        const found = findEcgtCritere(n.critere_id)
        const critLabel = found ? `${found.axe.icon} ${found.critere.label}` : (n.critere_id ?? '—')
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
        ws.getRow(row).height = 18; row++
      }
      if (annexes.length === 0) {
        sc(ws, 6, 2, 'Aucune pièce jointe', { it: true, fg: C.gray, ha: 'center' })
        merge(ws, 6, 2, 6, 6)
      }
    }

    // ─── Onglet 6 : Correspondances ───────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Correspondances', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 34 }, { width: 28 }, { width: 62 }]
      sc(ws, 2, 2, 'Correspondances avec les référentiels — Conformité ECGT', { bold: true, sz: 13, bg: C.green, fg: C.white })
      merge(ws, 2, 2, 2, 4); ws.getRow(2).height = 28

      const hdrs = ['Référentiel', 'Axe ECGT', 'Correspondance']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      const correspondances = [
        { ref: 'Directive 2005/29/CE (PCD)',            axe: 'Tous les axes',                     corr: 'Texte modifié par la directive (UE) 2024/825 : actions et omissions trompeuses, liste noire de l’annexe I' },
        { ref: 'Directive 2011/83/UE',                  axe: 'Durabilité, réparabilité',          corr: 'Informations précontractuelles ajoutées : durabilité, réparabilité, durée des mises à jour logicielles' },
        { ref: 'ISO 26000',                             axe: 'Gouvernance + Allégations',         corr: 'Question centrale « loyauté des pratiques » et domaine d’action « pratiques loyales en matière de commercialisation et d’information »' },
        { ref: 'CSRD — ESRS',                           axe: 'Neutralité carbone + Allégations',  corr: 'ESRS E1 : plan de transition, réductions d’émissions et recours aux crédits carbone déclarés séparément — cohérence exigée avec les allégations commerciales' },
        { ref: 'GRI Standards',                         axe: 'Neutralité carbone',                corr: 'GRI 305 (émissions) : périmètre, année de référence et méthode — la même rigueur est attendue dans la communication grand public' },
        { ref: 'ODD / SDGs',                            axe: 'Allégations + Durabilité',          corr: 'ODD 12.6 et 12.8 : information des consommateurs et pratiques de production et de consommation responsables' },
        { ref: 'ISO 14021 / ISO 14024 / ISO 14026',     axe: 'Labels + Allégations',              corr: 'Auto-déclarations environnementales, écolabels de type I et empreintes : cadres normatifs de référence pour justifier une allégation' },
        { ref: 'Recommandation ARPP « Développement durable »', axe: 'Gouvernance',               corr: 'Règles déontologiques françaises de la publicité : point d’appui pour le circuit de validation avant publication' },
        { ref: 'Bilan GES (plateforme)',                axe: 'Neutralité carbone',                corr: 'Fournit le périmètre, l’année de référence et les données mesurées sans lesquelles aucune allégation climatique n’est justifiable' },
        { ref: 'Diagnostic ISO 26000 (plateforme)',     axe: 'Gouvernance',                       corr: 'Évalue la loyauté des pratiques et la maturité de la gouvernance des communications' },
        { ref: 'VSME EFRAG (plateforme)',               axe: 'Allégations',                       corr: 'Structure les indicateurs de durabilité des PME — source de données chiffrées pour remplacer les allégations génériques' },
      ]

      let row = 5
      for (const c of correspondances) {
        sc(ws, row, 2, c.ref, { bg: C.white, sz: 9, bold: true })
        sc(ws, row, 3, c.axe, { bg: C.greenL, sz: 9 })
        sc(ws, row, 4, c.corr, { bg: C.white, sz: 8, wrap: true })
        ws.getRow(row).height = 26; row++
      }
    }

    // ─── Onglet 7 : Contenus & constats (spécifique ECGT) ─────────────────────
    {
      const ws = wb.addWorksheet('Contenus & constats', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 28 }, { width: 12 }, { width: 26 }, { width: 12 }, { width: 45 }, { width: 45 }, { width: 45 }, { width: 40 }]
      sc(ws, 2, 2, 'Contenus analysés et non-conformités relevées', { bold: true, sz: 14, bg: C.green, fg: C.white })
      merge(ws, 2, 2, 2, 9); ws.getRow(2).height = 30

      const hdrs = ['Contenu', 'Type', 'Critère', 'Gravité', 'Extrait fautif (verbatim)', 'Problème', 'Réécriture proposée', 'Base juridique']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      const parContenu = new Map<string, any[]>()
      for (const c of constats) {
        const list = parContenu.get(c.contenu_id) ?? []
        list.push(c)
        parContenu.set(c.contenu_id, list)
      }

      let row = 5
      for (const cont of contenus) {
        const list = parContenu.get(cont.id) ?? []
        const titre = cont.titre || cont.url || '(sans titre)'
        if (!list.length) {
          sc(ws, row, 2, titre, { bg: C.white, sz: 9, bold: true })
          sc(ws, row, 3, cont.type, { bg: C.white, sz: 9, ha: 'center' })
          sc(ws, row, 4, cont.statut === 'erreur' ? `Erreur : ${cont.erreur ?? '—'}` : cont.statut === 'analyse' ? 'Aucun constat' : 'Non analysé', { bg: C.grayL, sz: 9, it: true })
          merge(ws, row, 4, row, 9)
          ws.getRow(row).height = 18; row++
          continue
        }
        for (const k of list) {
          const found = findEcgtCritere(k.critere_id)
          const g = GRAVITE_COLORS[k.gravite] ?? { h: C.gray, l: C.grayL }
          const gLabel = ECGT_GRAVITES.find(x => x.value === k.gravite)?.label ?? k.gravite
          const barre = k.statut === 'corrige' ? '✅ ' : k.statut === 'ecarte' ? '⛔ ' : ''
          sc(ws, row, 2, titre, { bg: C.white, sz: 9 })
          sc(ws, row, 3, cont.type, { bg: C.white, sz: 9, ha: 'center' })
          sc(ws, row, 4, found ? `${found.axe.icon} ${found.critere.label}` : k.critere_id, { bg: found ? (AXE_COLORS[found.axe.id]?.l ?? C.grayL) : C.grayL, sz: 9 })
          sc(ws, row, 5, `${barre}${gLabel}`, { bg: g.l, fg: g.h, sz: 9, bold: true, ha: 'center' })
          sc(ws, row, 6, k.extrait ?? '—', { bg: C.white, sz: 8, wrap: true })
          sc(ws, row, 7, k.probleme ?? '—', { bg: C.white, sz: 8, wrap: true })
          sc(ws, row, 8, k.suggestion ?? '—', { bg: C.greenL, sz: 8, wrap: true })
          sc(ws, row, 9, k.article_vise ?? '—', { bg: C.white, sz: 8, wrap: true })
          ws.getRow(row).height = 46; row++
        }
      }
      if (!contenus.length) {
        sc(ws, 5, 2, 'Aucun contenu analysé', { it: true, fg: C.gray, ha: 'center' })
        merge(ws, 5, 2, 5, 9)
      }

      row += 1
      sc(ws, row, 2, "Les extraits sont cités verbatim depuis les contenus analysés. Les bases juridiques restent volontairement au niveau de l’article ou de la liste noire de l’annexe I : aucun numéro de point n’est cité.", { it: true, fg: C.gray, sz: 8, wrap: true })
      merge(ws, row, 2, row, 9); ws.getRow(row).height = 26
    }

    const buffer = await wb.xlsx.writeBuffer()
    const filename = `Ecgt_${orgNom.replace(/[^a-z0-9]/gi, '_')}_${diag.annee}.xlsx`

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('[ecgt/export-excel]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

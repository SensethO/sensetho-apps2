/**
 * GET /api/vsme-efrag/[id]/export-excel
 * Génère un fichier Excel structuré du reporting VSME EFRAG.
 * [id] = vsme_settings.id (enregistrement org/année).
 *
 * Onglets :
 *  1. Couverture       — org, année, progression globale, modules
 *  2. Tableau de bord  — progression par section, répartition des statuts
 *  3. Module de Base   — 40 datapoints : statut, valeur, note
 *  4. Module Complet   — 23 datapoints : statut, valeur, note
 *  5. Notes & Annexes  — documents SharePoint (métadonnées seulement)
 *  6. Correspondances  — alignements CSRD/ESRS, GRI 2021, ISO 26000
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─── Colors ──────────────────────────────────────────────────────────────────
const C = {
  emerald: 'FF16A34A', emeraldL: 'FFD1FAE5',
  blue:    'FF2563EB', blueL:    'FFDBEAFE',
  purple:  'FF7C3AED', purpleL:  'FFEDE9FE',
  amber:   'FFD97706', amberL:   'FFFEF3C7',
  gray:    'FF6B7280', grayL:    'FFF3F4F6',
  white:   'FFFFFFFF', black:    'FF111827', border: 'FFE5E7EB',
  green:   'FF16A34A', red: 'FFDC2626', orange: 'FFF59E0B',
  yellowL: 'FFFEF9C3',
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

// ─── Données statiques VSME (miroir de VsmeEfragApp.tsx) ─────────────────────

type DatapointType = 'text' | 'number' | 'boolean'
interface Datapoint { code: string; title: string; mandatory: boolean; type: DatapointType; unit?: string }
interface VsmeSection { id: string; title: string; icon: string; datapoints: Datapoint[] }

const BASE_SECTIONS: VsmeSection[] = [
  { id: 'B1', title: 'B1 — Informations générales', icon: '🏢', datapoints: [
    { code: 'B1-1', title: 'Description du modèle d\'affaires', mandatory: true, type: 'text' },
    { code: 'B1-2', title: 'Secteur d\'activité (code NACE)', mandatory: true, type: 'text' },
    { code: 'B1-3', title: 'Effectif total (ETP)', mandatory: true, type: 'number', unit: 'ETP' },
    { code: 'B1-4', title: 'Chiffre d\'affaires annuel', mandatory: true, type: 'number', unit: '€' },
    { code: 'B1-5', title: 'Pays d\'opération principaux', mandatory: false, type: 'text' },
  ]},
  { id: 'B2-E1', title: 'B2-E1 — Énergie & Émissions GES', icon: '⚡', datapoints: [
    { code: 'B2-E1-1', title: 'Consommation d\'énergie totale', mandatory: true, type: 'number', unit: 'MWh' },
    { code: 'B2-E1-2', title: 'Part d\'énergies renouvelables', mandatory: false, type: 'number', unit: '%' },
    { code: 'B2-E1-3', title: 'Émissions GES Scope 1', mandatory: true, type: 'number', unit: 'tCO2e' },
    { code: 'B2-E1-4', title: 'Émissions GES Scope 2 (market-based)', mandatory: true, type: 'number', unit: 'tCO2e' },
    { code: 'B2-E1-5', title: 'Émissions GES Scope 3 (total estimé)', mandatory: false, type: 'number', unit: 'tCO2e' },
    { code: 'B2-E1-6', title: 'Intensité carbone', mandatory: false, type: 'number', unit: 'tCO2e/M€ CA' },
  ]},
  { id: 'B2-E2', title: 'B2-E2 — Eau', icon: '💧', datapoints: [
    { code: 'B2-E2-1', title: 'Consommation d\'eau totale', mandatory: false, type: 'number', unit: 'm³' },
    { code: 'B2-E2-2', title: 'Activités en zones de stress hydrique', mandatory: false, type: 'boolean' },
    { code: 'B2-E2-3', title: 'Volume d\'eau rejeté (traité)', mandatory: false, type: 'number', unit: 'm³' },
  ]},
  { id: 'B2-E3', title: 'B2-E3 — Biodiversité & Sol', icon: '🌿', datapoints: [
    { code: 'B2-E3-1', title: 'Surface de terres exploitées', mandatory: false, type: 'number', unit: 'ha' },
    { code: 'B2-E3-2', title: 'Sites en zones sensibles (biodiversité)', mandatory: false, type: 'boolean' },
    { code: 'B2-E3-3', title: 'Actions de préservation de la biodiversité', mandatory: false, type: 'text' },
  ]},
  { id: 'B2-E4', title: 'B2-E4 — Déchets & Économie circulaire', icon: '♻️', datapoints: [
    { code: 'B2-E4-1', title: 'Quantité totale de déchets produits', mandatory: false, type: 'number', unit: 'tonnes' },
    { code: 'B2-E4-2', title: 'Déchets dangereux', mandatory: false, type: 'number', unit: 'tonnes' },
    { code: 'B2-E4-3', title: 'Taux de valorisation / recyclage', mandatory: false, type: 'number', unit: '%' },
    { code: 'B2-E4-4', title: 'Initiatives d\'économie circulaire', mandatory: false, type: 'text' },
  ]},
  { id: 'B3-S1', title: 'B3-S1 — Main-d\'œuvre & Conditions de travail', icon: '👥', datapoints: [
    { code: 'B3-S1-1', title: 'Répartition par genre', mandatory: true, type: 'text' },
    { code: 'B3-S1-2', title: 'Répartition CDI / CDD / intérim', mandatory: true, type: 'text' },
    { code: 'B3-S1-3', title: 'Taux d\'accidents du travail (LTIFR)', mandatory: true, type: 'number', unit: 'LTIFR' },
    { code: 'B3-S1-4', title: 'Nombre de décès liés au travail', mandatory: true, type: 'number', unit: 'décès' },
    { code: 'B3-S1-5', title: 'Heures de formation par salarié', mandatory: false, type: 'number', unit: 'h/salarié/an' },
    { code: 'B3-S1-6', title: 'Écart de rémunération femmes/hommes', mandatory: false, type: 'number', unit: '%' },
    { code: 'B3-S1-7', title: 'Taux de rotation du personnel', mandatory: false, type: 'number', unit: '%' },
    { code: 'B3-S1-8', title: 'Politique anti-travail forcé et travail des enfants', mandatory: true, type: 'boolean' },
    { code: 'B3-S1-9', title: 'Liberté d\'association et négociation collective', mandatory: false, type: 'text' },
  ]},
  { id: 'B3-S2', title: 'B3-S2 — Communautés & Chaîne de valeur', icon: '🤝', datapoints: [
    { code: 'B3-S2-1', title: 'Évaluation des fournisseurs sur critères sociaux', mandatory: false, type: 'boolean' },
    { code: 'B3-S2-2', title: 'Impacts sur les communautés locales', mandatory: false, type: 'text' },
    { code: 'B3-S2-3', title: 'Mécanisme de réclamation (stakeholders)', mandatory: false, type: 'boolean' },
  ]},
  { id: 'B4', title: 'B4 — Gouvernance & Éthique', icon: '⚖️', datapoints: [
    { code: 'B4-G1-1', title: 'Code de conduite / charte éthique', mandatory: true, type: 'boolean' },
    { code: 'B4-G1-2', title: 'Politique anti-corruption et anti-fraude', mandatory: true, type: 'boolean' },
    { code: 'B4-G1-3', title: 'Cas de corruption identifiés', mandatory: false, type: 'number', unit: 'cas' },
    { code: 'B4-G2-1', title: 'Responsable RSE / durabilité désigné', mandatory: false, type: 'boolean' },
    { code: 'B4-G2-2', title: 'Objectifs RSE définis et suivis', mandatory: false, type: 'boolean' },
    { code: 'B4-G2-3', title: 'Rapport / déclaration de durabilité publié', mandatory: false, type: 'boolean' },
    { code: 'B4-G2-4', title: 'Protection des lanceurs d\'alerte', mandatory: false, type: 'boolean' },
  ]},
]

const COMPLET_SECTIONS: VsmeSection[] = [
  { id: 'C1', title: 'C1 — Analyse de matérialité', icon: '🎯', datapoints: [
    { code: 'C1-1', title: 'Parties prenantes identifiées', mandatory: true, type: 'text' },
    { code: 'C1-2', title: 'Processus de consultation des parties prenantes', mandatory: true, type: 'text' },
    { code: 'C1-3', title: 'Enjeux ESG matériels identifiés', mandatory: true, type: 'text' },
    { code: 'C1-4', title: 'Seuil de matérialité retenu', mandatory: false, type: 'text' },
  ]},
  { id: 'C2', title: 'C2 — Stratégie & Objectifs ESG', icon: '🏆', datapoints: [
    { code: 'C2-1', title: 'Stratégie de durabilité globale', mandatory: true, type: 'text' },
    { code: 'C2-2', title: 'Objectif de réduction des émissions GES', mandatory: false, type: 'text' },
    { code: 'C2-3', title: 'Plan de transition climatique', mandatory: false, type: 'text' },
    { code: 'C2-4', title: 'Objectifs sociaux formalisés', mandatory: false, type: 'text' },
    { code: 'C2-5', title: 'Objectifs de gouvernance formalisés', mandatory: false, type: 'text' },
  ]},
  { id: 'C3', title: 'C3 — Environnement approfondi', icon: '🌍', datapoints: [
    { code: 'C3-1', title: 'Scope 3 détaillé par catégorie', mandatory: false, type: 'text' },
    { code: 'C3-2', title: 'Risques climatiques physiques identifiés', mandatory: false, type: 'text' },
    { code: 'C3-3', title: 'Politique de gestion de l\'eau', mandatory: false, type: 'text' },
    { code: 'C3-4', title: 'Stratégie biodiversité et plan d\'action', mandatory: false, type: 'text' },
    { code: 'C3-5', title: 'Politique matières premières & Économie circulaire', mandatory: false, type: 'text' },
  ]},
  { id: 'C4', title: 'C4 — Social approfondi', icon: '🫂', datapoints: [
    { code: 'C4-1', title: 'Politique des droits humains', mandatory: false, type: 'text' },
    { code: 'C4-2', title: 'Audit social fournisseurs', mandatory: false, type: 'text' },
    { code: 'C4-3', title: 'Politique Diversité, Équité & Inclusion (DEI)', mandatory: false, type: 'text' },
    { code: 'C4-4', title: 'Dialogue social et relations syndicales', mandatory: false, type: 'text' },
    { code: 'C4-5', title: 'Engagement communautaire et mécénat', mandatory: false, type: 'text' },
  ]},
  { id: 'C5', title: 'C5 — Gouvernance approfondie', icon: '🏛️', datapoints: [
    { code: 'C5-1', title: 'Structure de gouvernance durabilité', mandatory: false, type: 'text' },
    { code: 'C5-2', title: 'Rémunération variable liée à la performance ESG', mandatory: false, type: 'text' },
    { code: 'C5-3', title: 'Transparence fiscale', mandatory: false, type: 'text' },
    { code: 'C5-4', title: 'Cybersécurité et protection des données', mandatory: false, type: 'text' },
  ]},
]

const CORRESPONDANCES = [
  { section: 'B1', label: 'Informations générales', esrs: 'ESRS 2 BP-1, BP-2', gri: 'GRI 2-1, 2-2, 2-6', iso: '§ 7.5' },
  { section: 'B2-E1', label: 'Énergie & GES', esrs: 'ESRS E1-4, E1-5, E1-6', gri: 'GRI 302, 305', iso: '§ 6.5.5' },
  { section: 'B2-E2', label: 'Eau', esrs: 'ESRS E3-1, E3-4', gri: 'GRI 303', iso: '§ 6.5.4' },
  { section: 'B2-E3', label: 'Biodiversité & Sol', esrs: 'ESRS E4-1, E4-5', gri: 'GRI 304', iso: '§ 6.5.6' },
  { section: 'B2-E4', label: 'Déchets', esrs: 'ESRS E5-1, E5-5', gri: 'GRI 306', iso: '§ 6.5.3' },
  { section: 'B3-S1', label: 'Main-d\'œuvre', esrs: 'ESRS S1-1, S1-7, S1-14, S1-15', gri: 'GRI 401, 403, 405', iso: '§ 6.4' },
  { section: 'B3-S2', label: 'Communautés & Chaîne de valeur', esrs: 'ESRS S2-1, S3-1, S4-1', gri: 'GRI 204, 413', iso: '§ 6.3, § 6.8' },
  { section: 'B4', label: 'Gouvernance & Éthique', esrs: 'ESRS G1-1, G1-3, G1-4', gri: 'GRI 2-9, 205, 206', iso: '§ 6.6.2, § 6.6.3' },
  { section: 'C1', label: 'Matérialité', esrs: 'ESRS 2 IRO-1, SBM-3', gri: 'GRI 3-1, 3-2', iso: '§ 5.3' },
  { section: 'C2', label: 'Stratégie ESG', esrs: 'ESRS 2 SBM-1, SBM-2', gri: 'GRI 2-22, 3-3', iso: '§ 6.2' },
  { section: 'C3', label: 'Environnement approfondi', esrs: 'ESRS E1, E2, E3, E4, E5', gri: 'GRI 302-306', iso: '§ 6.5' },
  { section: 'C4', label: 'Social approfondi', esrs: 'ESRS S1, S2, S3, S4', gri: 'GRI 401-413', iso: '§ 6.3, § 6.4, § 6.8' },
  { section: 'C5', label: 'Gouvernance approfondie', esrs: 'ESRS G1, ESRS 2 GOV-1 à GOV-5', gri: 'GRI 2-9 à 2-29', iso: '§ 6.2, § 6.6' },
]

type VsmeStatus = 'non_evalue' | 'non_applicable' | 'non_renseigne' | 'en_cours' | 'renseigne'

const STATUS_LABELS: Record<VsmeStatus, string> = {
  non_evalue: 'Non évalué',
  non_applicable: 'Non applicable',
  non_renseigne: 'Non renseigné',
  en_cours: 'En cours',
  renseigne: 'Renseigné',
}

const STATUS_BG: Record<VsmeStatus, string> = {
  non_evalue: C.grayL,
  non_applicable: C.grayL,
  non_renseigne: C.yellowL,
  en_cours: C.amberL,
  renseigne: C.emeraldL,
}

interface ResponseRow {
  datapoint_code: string
  status: VsmeStatus | null
  value_text: string | null
  value_number: number | null
  notes: string | null
}

interface NoteAttachment {
  id: string
  name: string
  path: string
  mime: string | null
  size: number | null
  deleted_at?: string | null
}
interface NoteSectionRow {
  attachments?: NoteAttachment[]
}
interface NoteRow {
  action_key: string
  content: string | null
  sections: NoteSectionRow[] | null
}

function fmtValue(dp: Datapoint, resp: ResponseRow | undefined): string {
  if (!resp) return '—'
  if (dp.type === 'number') {
    if (resp.value_number === null || resp.value_number === undefined) return '—'
    return dp.unit ? `${resp.value_number} ${dp.unit}` : String(resp.value_number)
  }
  return resp.value_text?.trim() ? resp.value_text : '—'
}

const ALL_DATAPOINTS: { section: VsmeSection; dp: Datapoint }[] = [
  ...BASE_SECTIONS.flatMap(s => s.datapoints.map(dp => ({ section: s, dp }))),
  ...COMPLET_SECTIONS.flatMap(s => s.datapoints.map(dp => ({ section: s, dp }))),
]

function sectionOfCode(code: string): VsmeSection | undefined {
  return ALL_DATAPOINTS.find(e => e.dp.code === code)?.section
}
function datapointOfCode(code: string): Datapoint | undefined {
  return ALL_DATAPOINTS.find(e => e.dp.code === code)?.dp
}

// ─── Access check ─────────────────────────────────────────────────────────────
async function canAccess(userId: string, vsmeId: string): Promise<{ ok: boolean; orgId?: string; year?: number; moduleType?: string }> {
  const admin = createAdminClient()
  const { data: settings } = await admin
    .from('vsme_settings')
    .select('id, org_id, year, module_type')
    .eq('id', vsmeId)
    .single()
  if (!settings) return { ok: false }

  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return { ok: true, orgId: settings.org_id, year: settings.year, moduleType: settings.module_type }

  const { data: org } = await admin.from('organisations').select('user_id').eq('id', settings.org_id).single()
  if (org?.user_id === userId) return { ok: true, orgId: settings.org_id, year: settings.year, moduleType: settings.module_type }

  return { ok: false }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const access = await canAccess(user.id, params.id)
    if (!access.ok || !access.orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createAdminClient()

    const [orgRes, repRes, notesRes] = await Promise.all([
      admin.from('organisations').select('denomination, siret_siege, ville').eq('id', access.orgId).single(),
      admin.from('vsme_responses').select('datapoint_code, status, value_text, value_number, notes').eq('org_id', access.orgId).eq('year', access.year!),
      admin.from('vsme_notes').select('action_key, content, sections').eq('vsme_id', params.id),
    ])

    const org = orgRes.data
    const orgNom = org?.denomination ?? 'Organisation'
    const year = access.year!
    const dateExport = new Date().toLocaleDateString('fr-FR')

    const responses = new Map<string, ResponseRow>()
    for (const r of ((repRes.data ?? []) as ResponseRow[])) {
      responses.set(r.datapoint_code, r)
    }

    const noteRows = (notesRes.data ?? []) as NoteRow[]
    const noteContentByCode: Record<string, string> = {}
    const attachments: { code: string; att: NoteAttachment }[] = []
    for (const row of noteRows) {
      if (row.content) noteContentByCode[row.action_key] = row.content
      for (const section of (row.sections ?? [])) {
        for (const att of (section.attachments ?? [])) {
          if (!att.deleted_at) attachments.push({ code: row.action_key, att })
        }
      }
    }

    // Statistiques
    const allBaseCodes = BASE_SECTIONS.flatMap(s => s.datapoints.map(dp => dp.code))
    const allCompletCodes = COMPLET_SECTIONS.flatMap(s => s.datapoints.map(dp => dp.code))
    const allCodes = [...allBaseCodes, ...allCompletCodes]

    const countStatus = (codes: string[], s: VsmeStatus) =>
      codes.filter(c => (responses.get(c)?.status ?? 'non_evalue') === s).length

    const baseRenseigne = countStatus(allBaseCodes, 'renseigne')
    const completRenseigne = countStatus(allCompletCodes, 'renseigne')
    const globalRenseigne = baseRenseigne + completRenseigne
    const globalPct = allCodes.length > 0 ? Math.round((globalRenseigne / allCodes.length) * 100) : 0
    const basePct = allBaseCodes.length > 0 ? Math.round((baseRenseigne / allBaseCodes.length) * 100) : 0
    const completPct = allCompletCodes.length > 0 ? Math.round((completRenseigne / allCompletCodes.length) * 100) : 0

    // ─── Workbook ────────────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Sens\'ethO Apps — VSME EFRAG'
    wb.created = new Date()

    // ─── Onglet 1 : Couverture ────────────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Couverture', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 40 }, { width: 25 }, { width: 25 }]
      ws.getRow(1).height = 20
      ws.getRow(2).height = 50

      merge(ws, 2, 2, 2, 4)
      sc(ws, 2, 2, 'VSME EFRAG — Reporting de durabilité PME', { bg: C.emerald, fg: C.white, bold: true, sz: 18, ha: 'center' })

      let row = 4
      for (const [label, val] of [
        ['Organisation', orgNom],
        ['SIRET', org?.siret_siege ?? '—'],
        ['Ville', org?.ville ?? '—'],
        ['Année de reporting', String(year)],
        ['Module', access.moduleType === 'complet' ? 'Base + Complet' : 'Base'],
        ['Date export', dateExport],
      ]) {
        sc(ws, row, 2, label, { bold: true, bg: C.grayL, fg: C.black })
        sc(ws, row, 3, val, { bg: C.white })
        row++
      }

      row++
      sc(ws, row, 2, 'Progression globale', { bold: true, sz: 14, bg: C.emerald, fg: C.white, ha: 'center' })
      sc(ws, row, 3, `${globalPct}%`, { bold: true, sz: 18, bg: C.emerald, fg: C.white, ha: 'center' })
      sc(ws, row, 4, `${globalRenseigne} / ${allCodes.length} renseignés`, { bold: true, bg: C.emerald, fg: C.white, ha: 'center' })
      ws.getRow(row).height = 35
      row += 2

      sc(ws, row, 2, '🌿 Module de Base', { bold: true, bg: C.emeraldL, fg: C.emerald })
      sc(ws, row, 3, `${basePct}%`, { bold: true, bg: C.emeraldL, fg: C.emerald, ha: 'center' })
      sc(ws, row, 4, `${baseRenseigne} / ${allBaseCodes.length} renseignés`, { bg: C.emeraldL, ha: 'center' })
      row++
      sc(ws, row, 2, '🏆 Module Complet', { bold: true, bg: C.purpleL, fg: C.purple })
      sc(ws, row, 3, `${completPct}%`, { bold: true, bg: C.purpleL, fg: C.purple, ha: 'center' })
      sc(ws, row, 4, `${completRenseigne} / ${allCompletCodes.length} renseignés`, { bg: C.purpleL, ha: 'center' })
    }

    // ─── Onglet 2 : Tableau de bord ───────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Tableau de bord', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 42 }, { width: 14 }, { width: 18 }, { width: 14 }]

      sc(ws, 2, 2, 'Progression par section', { bold: true, sz: 14, bg: C.emerald, fg: C.white, ha: 'center' })
      merge(ws, 2, 2, 2, 5)
      ws.getRow(2).height = 30

      const headers = ['Section', 'Module', 'Renseignés', '%']
      headers.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const { sections, moduleLabel, hdrL } of [
        { sections: BASE_SECTIONS, moduleLabel: 'Base', hdrL: C.emeraldL },
        { sections: COMPLET_SECTIONS, moduleLabel: 'Complet', hdrL: C.purpleL },
      ]) {
        for (const s of sections) {
          const total = s.datapoints.length
          const done = s.datapoints.filter(dp => responses.get(dp.code)?.status === 'renseigne').length
          const pct = total > 0 ? Math.round((done / total) * 100) : 0
          sc(ws, row, 2, `${s.icon} ${s.title}`, { bg: hdrL, bold: true, sz: 10 })
          sc(ws, row, 3, moduleLabel, { bg: C.white, ha: 'center', sz: 9 })
          sc(ws, row, 4, `${done} / ${total}`, { bg: C.white, ha: 'center', sz: 10 })
          sc(ws, row, 5, `${pct}%`, { bg: C.white, bold: true, ha: 'center', fg: pct >= 50 ? C.green : C.orange })
          ws.getRow(row).height = 20
          row++
        }
      }

      row += 2
      sc(ws, row, 2, 'Répartition des statuts', { bold: true, sz: 12, bg: C.emerald, fg: C.white })
      merge(ws, row, 2, row, 5)
      ws.getRow(row).height = 24
      row += 1
      ;(['Statut', 'Nombre'] as const).forEach((h, i) => sc(ws, row, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))
      row++
      const ALL_STATUSES: VsmeStatus[] = ['non_evalue', 'non_applicable', 'non_renseigne', 'en_cours', 'renseigne']
      for (const s of ALL_STATUSES) {
        sc(ws, row, 2, STATUS_LABELS[s], { bg: STATUS_BG[s], sz: 10 })
        sc(ws, row, 3, countStatus(allCodes, s), { bg: C.white, ha: 'center', sz: 10, bold: true })
        row++
      }
    }

    // ─── Onglets 3 & 4 : Modules ──────────────────────────────────────────────
    const moduleSheets: { name: string; sections: VsmeSection[]; hdr: string; hdrL: string }[] = [
      { name: 'Module de Base', sections: BASE_SECTIONS, hdr: C.emerald, hdrL: C.emeraldL },
      { name: 'Module Complet', sections: COMPLET_SECTIONS, hdr: C.purple, hdrL: C.purpleL },
    ]
    for (const m of moduleSheets) {
      const ws = wb.addWorksheet(m.name, { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 12 }, { width: 44 }, { width: 12 }, { width: 15 }, { width: 34 }, { width: 44 }]

      sc(ws, 2, 2, `VSME EFRAG — ${m.name}`, { bold: true, sz: 14, bg: m.hdr, fg: C.white })
      merge(ws, 2, 2, 2, 7)
      ws.getRow(2).height = 30

      const hdrs = ['Code', 'Datapoint', 'Obligatoire', 'Statut', 'Valeur', 'Note']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const s of m.sections) {
        sc(ws, row, 2, `${s.icon} ${s.title}`, { bold: true, bg: m.hdrL, sz: 11 })
        merge(ws, row, 2, row, 7)
        ws.getRow(row).height = 22
        row++
        for (const dp of s.datapoints) {
          const resp = responses.get(dp.code)
          const status: VsmeStatus = resp?.status ?? 'non_evalue'
          const value = fmtValue(dp, resp)
          const note = noteContentByCode[dp.code]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || resp?.notes || '—'
          sc(ws, row, 2, dp.code, { bg: C.white, sz: 9, bold: true, fg: m.hdr })
          sc(ws, row, 3, dp.title, { bg: C.white, sz: 9, wrap: true })
          sc(ws, row, 4, dp.mandatory ? 'Oui' : 'Non', { bg: C.white, ha: 'center', sz: 9, ...(dp.mandatory && { bold: true, fg: C.red }) })
          sc(ws, row, 5, STATUS_LABELS[status], { bg: STATUS_BG[status], ha: 'center', sz: 9 })
          sc(ws, row, 6, value, { bg: C.white, sz: 9, wrap: true })
          sc(ws, row, 7, note, { bg: C.white, sz: 8, wrap: true, it: note === '—' })
          ws.getRow(row).height = value.length > 40 || note.length > 60 ? 32 : 18
          row++
        }
      }
    }

    // ─── Onglet 5 : Notes & Annexes ───────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Notes & Annexes', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 8 }, { width: 34 }, { width: 12 }, { width: 40 }, { width: 22 }, { width: 12 }]

      sc(ws, 2, 2, 'Pièces jointes & Annexes', { bold: true, sz: 14, bg: C.emerald, fg: C.white })
      merge(ws, 2, 2, 2, 7)
      ws.getRow(2).height = 30

      sc(ws, 3, 2, 'Note : Les fichiers sont stockés dans SharePoint. Les URLs de téléchargement sont générées à la demande depuis l\'application.', { it: true, fg: C.gray, sz: 9 })
      merge(ws, 3, 2, 3, 7)

      const hdrs = ['Réf.', 'Nom du fichier', 'Datapoint', 'Intitulé', 'Type', 'Taille']
      hdrs.forEach((h, i) => sc(ws, 5, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 6
      let idx = 0
      for (const { code, att } of attachments) {
        idx++
        const dp = datapointOfCode(code)
        const section = sectionOfCode(code)
        const sizeKo = att.size ? `${Math.round(att.size / 1024)} Ko` : '—'
        sc(ws, row, 2, `A${String(idx).padStart(3, '0')}`, { ha: 'center', sz: 9, bold: true, fg: C.blue })
        sc(ws, row, 3, att.name, { sz: 9 })
        sc(ws, row, 4, code, { ha: 'center', sz: 9, bold: true })
        sc(ws, row, 5, dp ? `${section?.icon ?? ''} ${dp.title}`.trim() : '—', { sz: 9, wrap: true })
        sc(ws, row, 6, att.mime ?? '—', { ha: 'center', sz: 8 })
        sc(ws, row, 7, sizeKo, { ha: 'center', sz: 9 })
        ws.getRow(row).height = 18
        row++
      }

      if (attachments.length === 0) {
        sc(ws, 6, 2, 'Aucun document joint', { it: true, fg: C.gray, ha: 'center' })
        merge(ws, 6, 2, 6, 7)
      }
    }

    // ─── Onglet 6 : Correspondances ───────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Correspondances', { views: [{ showGridLines: false }] })
      ws.columns = [{ width: 4 }, { width: 12 }, { width: 32 }, { width: 32 }, { width: 26 }, { width: 20 }]

      sc(ws, 2, 2, 'Correspondances VSME ↔ Standards (CSRD/ESRS, GRI 2021, ISO 26000)', { bold: true, sz: 13, bg: C.emerald, fg: C.white })
      merge(ws, 2, 2, 2, 6)
      ws.getRow(2).height = 28

      const hdrs = ['Section', 'Intitulé', 'CSRD / ESRS', 'GRI Standards 2021', 'ISO 26000']
      hdrs.forEach((h, i) => sc(ws, 4, i + 2, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))

      let row = 5
      for (const c of CORRESPONDANCES) {
        const isComplet = c.section.startsWith('C')
        sc(ws, row, 2, c.section, { bg: isComplet ? C.purpleL : C.emeraldL, sz: 9, bold: true, fg: isComplet ? C.purple : C.emerald, ha: 'center' })
        sc(ws, row, 3, c.label, { bg: C.white, sz: 9 })
        sc(ws, row, 4, c.esrs, { bg: C.white, sz: 9, wrap: true })
        sc(ws, row, 5, c.gri, { bg: C.white, sz: 9, wrap: true })
        sc(ws, row, 6, c.iso, { bg: C.white, sz: 9 })
        ws.getRow(row).height = 20
        row++
      }
    }

    // ─── Export ───────────────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer()
    const filename = `VSME_EFRAG_${orgNom.replace(/[^a-z0-9]/gi, '_')}_${year}.xlsx`

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('[vsme-efrag/export-excel]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

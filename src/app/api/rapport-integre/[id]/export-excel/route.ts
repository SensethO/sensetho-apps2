/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'

const COLORS = {
  primary:  '1e3a5f',
  teal:     '0f766e',
  blue:     '1d4ed8',
  green:    '15803d',
  amber:    '92400e',
  gray:     '374151',
  lightBg:  'f0f9ff',
  headerFg: 'FFFFFF',
}

function hdr(ws: ExcelJS.Worksheet, row: number, cols: string[][], boldBg = COLORS.primary) {
  const r = ws.getRow(row)
  cols.forEach(([val, width], i) => {
    const cell = r.getCell(i + 1)
    cell.value = val
    cell.font = { bold: true, color: { argb: 'FF' + COLORS.headerFg }, size: 10 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + boldBg } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFB0BEC5' } } }
    if (width) ws.getColumn(i + 1).width = parseFloat(width)
  })
  r.height = 28
}

function cell(ws: ExcelJS.Worksheet, row: number, col: number, value: any, opts: Partial<ExcelJS.CellFormatModel> & { wrapText?: boolean; bold?: boolean; color?: string; bg?: string } = {}) {
  const c = ws.getCell(row, col)
  c.value = value
  if (opts.wrapText) c.alignment = { wrapText: true, vertical: 'top' }
  if (opts.bold) c.font = { bold: true, size: 10, color: { argb: 'FF' + (opts.color ?? COLORS.gray) } }
  else if (opts.color) c.font = { color: { argb: 'FF' + opts.color }, size: 10 }
  else c.font = { size: 10 }
  if (opts.bg) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + opts.bg } }
  c.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: rapport } = await admin.from('rapports_integres').select('*').eq('id', params.id).single()
    if (!rapport) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })

    const isAdmin = (await admin.from('profiles').select('role').eq('id', user.id).single()).data?.role === 'admin'
    if (!isAdmin && rapport.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: sections } = await admin.from('rapport_sections').select('*').eq('rapport_id', params.id).order('ordre')
    const { data: org } = await admin.from('organisations').select('denomination, siren, forme_juridique').eq('id', rapport.org_id).single()

    const wb = new ExcelJS.Workbook()
    wb.creator = "Sens'ethO Apps"
    wb.created = new Date()

    const TEMPLATE_LABELS: Record<string, string> = { iirc: 'Cadre <IR> IIRC', csrd: 'CSRD / ESRS', gri: 'GRI Standards' }

    // ── Onglet 1 : Couverture ─────────────────────────────────────────
    const ws1 = wb.addWorksheet('Couverture', { properties: { tabColor: { argb: 'FF' + COLORS.primary } } })
    ws1.getColumn(1).width = 30; ws1.getColumn(2).width = 50
    ws1.mergeCells('A1:B1')
    const title = ws1.getCell('A1')
    title.value = rapport.titre
    title.font = { bold: true, size: 16, color: { argb: 'FF' + COLORS.primary } }
    title.alignment = { horizontal: 'center', vertical: 'middle' }
    ws1.getRow(1).height = 40

    const meta = [
      ['Organisation', org?.denomination ?? '—'],
      ['SIREN', org?.siren ?? '—'],
      ['Forme juridique', org?.forme_juridique ?? '—'],
      ['Exercice', String(rapport.annee)],
      ['Modèle', TEMPLATE_LABELS[rapport.template] ?? rapport.template],
      ['Statut', rapport.statut === 'finalise' ? '✅ Finalisé' : rapport.statut === 'publie' ? '📢 Publié' : '📝 Brouillon'],
      ['Complétion', `${rapport.score_completion ?? 0}%`],
      ['Date de création', new Date(rapport.created_at).toLocaleDateString('fr-FR')],
      ['Dernière modification', new Date(rapport.updated_at).toLocaleDateString('fr-FR')],
      ['Sources intégrées', (rapport.sources ?? []).join(', ') || '—'],
      ['Généré par', "Sens'ethO Apps — Rapport Intégré"],
    ]
    meta.forEach(([k, v], i) => {
      cell(ws1, i + 2, 1, k, { bold: true, color: COLORS.gray, bg: i % 2 === 0 ? 'F9FAFB' : 'FFFFFF' })
      cell(ws1, i + 2, 2, v, { bg: i % 2 === 0 ? 'F9FAFB' : 'FFFFFF' })
    })

    // ── Onglet 2 : Tableau de bord ────────────────────────────────────
    const ws2 = wb.addWorksheet('Tableau de bord', { properties: { tabColor: { argb: 'FF' + COLORS.teal } } })
    ws2.getColumn(1).width = 40; ws2.getColumn(2).width = 20; ws2.getColumn(3).width = 20; ws2.getColumn(4).width = 40
    hdr(ws2, 1, [['Section', '40'], ['Renseignée', '20'], ['Mots (approx.)', '20'], ['Données importées', '40']], COLORS.teal)

    const secs = sections ?? []
    secs.forEach((s, i) => {
      const row = i + 2
      const wordCount = (s.content ?? '').split(/\s+/).filter(Boolean).length
      const imports = (s.data_imports ?? []) as any[]
      cell(ws2, row, 1, s.titre ?? s.element_id, { wrapText: true })
      cell(ws2, row, 2, (s.content ?? '').trim().length > 0 ? '✅ Oui' : '—', { color: (s.content ?? '').trim().length > 0 ? COLORS.green : COLORS.gray })
      cell(ws2, row, 3, wordCount > 0 ? wordCount : '—')
      cell(ws2, row, 4, imports.length > 0 ? imports.map((imp: any) => `${imp.label} : ${imp.score ?? '—'}`).join(' | ') : '—', { wrapText: true })
      ws2.getRow(row).height = 20
    })

    // Score de complétion global
    const filledCount = secs.filter(s => (s.content ?? '').trim().length > 0).length
    const totalCount = secs.length
    ws2.getCell(secs.length + 3, 1).value = 'Score de complétion global'
    ws2.getCell(secs.length + 3, 1).font = { bold: true, size: 11 }
    ws2.getCell(secs.length + 3, 2).value = totalCount > 0 ? `${filledCount}/${totalCount} sections` : '—'
    ws2.getCell(secs.length + 4, 2).value = `${rapport.score_completion ?? 0}%`
    ws2.getCell(secs.length + 4, 2).font = { bold: true, size: 14, color: { argb: 'FF' + COLORS.teal } }

    // ── Onglet 3 : Contenu du rapport ─────────────────────────────────
    const ws3 = wb.addWorksheet('Contenu', { properties: { tabColor: { argb: 'FF' + COLORS.blue } } })
    ws3.getColumn(1).width = 8; ws3.getColumn(2).width = 35; ws3.getColumn(3).width = 90
    hdr(ws3, 1, [['N°', '8'], ['Section', '35'], ['Contenu rédigé', '90']], COLORS.blue)

    secs.forEach((s, i) => {
      const row = i + 2
      cell(ws3, row, 1, i + 1)
      cell(ws3, row, 2, s.titre ?? s.element_id, { bold: true })
      cell(ws3, row, 3, s.content ?? '—', { wrapText: true })
      ws3.getRow(row).height = Math.max(30, Math.min(200, Math.ceil(((s.content ?? '').length / 80) + 1) * 15))
    })

    // ── Onglet 4 : Sources RSE ────────────────────────────────────────
    const ws4 = wb.addWorksheet('Sources RSE', { properties: { tabColor: { argb: 'FF' + COLORS.green } } })
    ws4.getColumn(1).width = 35; ws4.getColumn(2).width = 20; ws4.getColumn(3).width = 30; ws4.getColumn(4).width = 50
    hdr(ws4, 1, [['Source RSE', '35'], ['Score', '20'], ['Statut', '30'], ['Données importées dans', '50']], COLORS.green)

    const allImports: Array<{ label: string; score: string; source: string; usedIn: string }> = []
    secs.forEach(s => {
      const imports = (s.data_imports ?? []) as any[]
      imports.forEach((imp: any) => {
        allImports.push({ label: imp.label ?? imp.source ?? '—', score: String(imp.score ?? '—'), source: imp.source ?? '—', usedIn: s.titre ?? s.element_id })
      })
    })

    if (allImports.length === 0) {
      cell(ws4, 2, 1, 'Aucune donnée importée depuis les diagnostics RSE.', { color: COLORS.gray })
    } else {
      allImports.forEach((imp, i) => {
        const row = i + 2
        cell(ws4, row, 1, imp.label)
        cell(ws4, row, 2, imp.score)
        cell(ws4, row, 3, imp.source)
        cell(ws4, row, 4, imp.usedIn, { wrapText: true })
        ws4.getRow(row).height = 20
      })
    }

    const buf = await wb.xlsx.writeBuffer()
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="RapportIntegre_${rapport.annee}_${rapport.id.slice(0, 8)}.xlsx"`,
      },
    })
  } catch (err) {
    console.error('[rapport-integre/export-excel]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

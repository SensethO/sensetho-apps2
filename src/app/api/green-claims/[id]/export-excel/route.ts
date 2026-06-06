/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'

const GREEN = '16a34a'; const AMBER = 'd97706'; const RED = 'dc2626'; const GRAY = '374151'

function computeScore(a: Record<string, any>): number {
  let s = 0
  const ev: Record<string, number> = { 'acv-complete': 30, 'mesure-directe': 25, 'certification-reconnue': 20, 'declaration-fournisseur': 10, aucune: 0 }
  s += ev[a.evidence_method] ?? 0
  if (a.third_party_verified === 'oui') s += 20; else if (a.third_party_verified === 'nsp') s += 5
  if (a.scope_clear === 'claire') s += 20; else if (a.scope_clear === 'nsp') s += 5
  if (a.no_compensation_only === 'correct') s += 20; else if (a.no_compensation_only === 'nsp') s += 5
  if (a.no_hidden_impact === 'transparent') s += 10; else if (a.no_hidden_impact === 'nsp') s += 3
  if (a.type === 'generique') s = Math.max(0, s - 20)
  if (a.type === 'label-certification' && a.evidence_method === 'certification-reconnue') s = Math.min(100, s + 10)
  return Math.min(100, s)
}
function getStatut(score: number) {
  if (score >= 75) return { label: 'Conforme', color: GREEN }
  if (score >= 40) return { label: 'À risque', color: AMBER }
  return { label: 'Non conforme', color: RED }
}

function hdrRow(ws: ExcelJS.Worksheet, row: number, cols: [string, number][], bg = '16a34a') {
  const r = ws.getRow(row)
  cols.forEach(([val, w], i) => {
    const c = r.getCell(i + 1)
    c.value = val; c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bg } }
    c.alignment = { vertical: 'middle', wrapText: true }
    c.border = { bottom: { style: 'thin', color: { argb: 'FFB0BEC5' } } }
    ws.getColumn(i + 1).width = w
  })
  r.height = 28
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: diag } = await admin.from('green_claims_diagnostics').select('*').eq('id', params.id).single()
    if (!diag) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })
    const isAdmin = (await admin.from('profiles').select('role').eq('id', user.id).single()).data?.role === 'admin'
    if (!isAdmin && diag.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: allegations } = await admin.from('green_claims_allegations').select('*').eq('diagnostic_id', params.id).order('created_at')
    const { data: org } = await admin.from('organisations').select('denomination, siren').eq('id', diag.org_id).single()
    const all = allegations ?? []

    const wb = new ExcelJS.Workbook(); wb.creator = "Sens'ethO Apps"; wb.created = new Date()

    // ── Onglet 1 : Couverture
    const ws1 = wb.addWorksheet('Couverture', { properties: { tabColor: { argb: 'FF' + GREEN } } })
    ws1.getColumn(1).width = 35; ws1.getColumn(2).width = 55
    ws1.mergeCells('A1:B1')
    const title = ws1.getCell('A1')
    title.value = diag.titre; title.font = { bold: true, size: 16, color: { argb: 'FF' + GREEN } }
    title.alignment = { horizontal: 'center', vertical: 'middle' }; ws1.getRow(1).height = 40
    const meta: [string, string][] = [
      ['Organisation', org?.denomination ?? '—'], ['SIREN', org?.siren ?? '—'],
      ['Exercice', String(diag.annee)], ['Statut', diag.statut],
      ['Score global', `${diag.score_global}/100`],
      ['Conformes', String(diag.nb_conformes)], ['À risque', String(diag.nb_risque)], ['Non conformes', String(diag.nb_non_conformes)],
      ['Total allégations', String(diag.nb_total)],
      ['Référentiel', 'Directive UE 2024/825/EU — Green Claims'],
      ['Généré par', "Sens'ethO Apps"],
    ]
    meta.forEach(([k, v], i) => {
      const bg = i % 2 === 0 ? 'F9FAFB' : 'FFFFFF'
      const c1 = ws1.getCell(i + 2, 1); c1.value = k; c1.font = { bold: true, size: 10 }; c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bg } }; c1.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } }
      const c2 = ws1.getCell(i + 2, 2); c2.value = v; c2.font = { size: 10 }; c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bg } }; c2.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } }
    })

    // ── Onglet 2 : Allégations
    const ws2 = wb.addWorksheet('Allégations', { properties: { tabColor: { argb: 'FF' + GREEN } } })
    hdrRow(ws2, 1, [['N°', 6], ["Texte de l'allégation", 50], ['Type', 18], ['Domaine', 16], ['Portée', 20], ['Méthode de preuve', 22], ['Vérif. tierce', 14], ['Portée claire', 14], ['Sans offsets seuls', 16], ['Sans impact caché', 16], ['Score', 10], ['Statut', 14]])
    const TYPE_LABELS: Record<string, string> = { explicite: 'Explicite', generique: 'Générique', comparative: 'Comparative', 'label-certification': 'Label/Cert.' }
    const EV_LABELS: Record<string, string> = { 'acv-complete': 'ACV complète', 'mesure-directe': 'Mesure directe', 'certification-reconnue': 'Certification', 'declaration-fournisseur': 'Décl. fournisseur', aucune: 'Aucune' }
    all.forEach((a, i) => {
      const row = i + 2; const score = computeScore(a); const statut = getStatut(score)
      const r = ws2.getRow(row)
      ;[i + 1, a.allegation_text, TYPE_LABELS[a.type] ?? a.type, a.domain, a.scope, EV_LABELS[a.evidence_method] ?? a.evidence_method,
        a.third_party_verified, a.scope_clear, a.no_compensation_only, a.no_hidden_impact, score, statut.label
      ].forEach((v, ci) => {
        const c = r.getCell(ci + 1); c.value = v; c.font = { size: 10 }; c.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } }
        if (ci === 1) { c.alignment = { wrapText: true, vertical: 'top' } }
        if (ci === 11) { c.font = { bold: true, size: 10, color: { argb: 'FF' + statut.color } } }
      })
      r.height = Math.max(18, Math.min(80, Math.ceil(String(a.allegation_text).length / 45) * 15))
    })

    // ── Onglet 3 : Notes
    const ws3 = wb.addWorksheet('Notes', { properties: { tabColor: { argb: 'FF' + GRAY } } })
    ws3.getColumn(1).width = 50; ws3.getColumn(2).width = 70
    hdrRow(ws3, 1, [["Allégation", 50], ['Notes internes', 70]], GRAY)
    all.filter(a => a.notes).forEach((a, i) => {
      const row = i + 2
      ws3.getCell(row, 1).value = a.allegation_text; ws3.getCell(row, 1).alignment = { wrapText: true, vertical: 'top' }; ws3.getCell(row, 1).font = { size: 10 }
      ws3.getCell(row, 2).value = a.notes; ws3.getCell(row, 2).alignment = { wrapText: true, vertical: 'top' }; ws3.getCell(row, 2).font = { size: 10 }
      ws3.getRow(row).height = 30
    })

    const buf = await wb.xlsx.writeBuffer()
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="GreenClaims_${diag.annee}_${params.id.slice(0, 8)}.xlsx"`,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/eudr-fournisseurs/plots/export-excel?org_id=xxx
 *
 * Classeur du référentiel des parcelles. Deux onglets : le détail parcelle par
 * parcelle, et la synthèse par fournisseur.
 *
 * La surface y figure au dix-millième d'hectare : c'est la donnée qu'exige la
 * déclaration de diligence raisonnée, et l'arrondir reviendrait à déclarer autre
 * chose que ce qui a été mesuré.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { chargerReferentiel } from '../_referentiel'
import { guard } from '../../traces/_auth'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const C = {
  green:  'FF16A34A', greenL: 'FFDCFCE7',
  red:    'FFDC2626', redL:   'FFFEE2E2',
  orange: 'FFEA580C', orangeL:'FFFFEDD5',
  gray:   'FF6B7280', grayL:  'FFF3F4F6',
  white:  'FFFFFFFF', border: 'FFE5E7EB',
}

type CS = { bg?: string; fg?: string; bold?: boolean; sz?: number; ha?: 'left' | 'right' | 'center'; it?: boolean; wrap?: boolean; num?: string }

function sc(ws: ExcelJS.Worksheet, r: number, c: number, val: ExcelJS.CellValue, s: CS = {}) {
  const cell = ws.getCell(r, c)
  cell.value = val
  if (s.bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: s.bg } }
  if (s.bold || s.sz || s.fg || s.it) {
    cell.font = { ...(s.bold && { bold: true }), ...(s.sz && { size: s.sz }), ...(s.fg && { color: { argb: s.fg } }), ...(s.it && { italic: true }) }
  }
  if (s.num) cell.numFmt = s.num
  cell.alignment = { horizontal: s.ha ?? 'left', vertical: 'middle', wrapText: s.wrap ?? false }
  cell.border = {
    top: { style: 'thin', color: { argb: C.border } }, bottom: { style: 'thin', color: { argb: C.border } },
    left: { style: 'thin', color: { argb: C.border } }, right: { style: 'thin', color: { argb: C.border } },
  }
}

function header(ws: ExcelJS.Worksheet, title: string, cols: number[], headers: string[]) {
  ws.columns = cols.map(w => ({ width: w }))
  sc(ws, 1, 1, title, { bold: true, sz: 13, bg: C.green, fg: C.white })
  ws.mergeCells(1, 1, 1, headers.length)
  ws.getRow(1).height = 26
  headers.forEach((h, i) => sc(ws, 3, i + 1, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))
  ws.views = [{ state: 'frozen', ySplit: 3, showGridLines: false }]
}

const txt = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v))
const dt = (v: any) => { if (!v) return '—'; const d = new Date(v); return isNaN(+d) ? String(v) : d.toLocaleDateString('fr-FR') }

const SIGNAL_LABELS: Record<string, string> = {
  perturbation: 'Perturbation après 2020',
  risque_eleve: 'Risque élevé',
  sans_signal: 'Aucun signal',
  non_analyse: 'Non analysée',
}

export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get('org_id')
    const auth = await guard(orgId)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    // Même lecture que l'écran : un export qui divergerait de ce qui est affiché
    // ne pourrait pas servir à préparer une déclaration.
    const referentiel = await chargerReferentiel(orgId!)
    const parcelles = referentiel.parcelles
    const totaux = referentiel.totaux

    const admin = createAdminClient()
    const { data: org } = await admin.from('organisations').select('denomination').eq('id', orgId!).maybeSingle()
    const orgNom = (org?.denomination as string) ?? 'organisation'

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Sens’ethO — EUDR'
    wb.created = new Date()

    // ── 1. Parcelles ───────────────────────────────────────────────────────────
    {
      const ws = wb.addWorksheet('1. Parcelles')
      const heads = ['Référence', 'Fournisseur', 'Producteur', 'Fichier d’origine', 'Pays', 'Produit',
        'Géométrie', 'Surface (ha)', 'Surface déclarée (ha)', '> 4 ha', 'Polygone requis',
        'Signal', 'Analysée le', 'Latitude', 'Longitude', 'Relevé le', 'Source du relevé', 'Versée le', 'Versée par']
      header(ws, `Référentiel des parcelles — ${orgNom}`, [18, 24, 20, 28, 10, 14, 14, 13, 16, 9, 14, 22, 13, 12, 12, 12, 18, 13, 22], heads)

      let row = 4
      if (!parcelles.length) {
        sc(ws, row, 1, 'Aucune parcelle versée au référentiel', { it: true, fg: C.gray, ha: 'center' })
        ws.mergeCells(row, 1, row, heads.length)
      }
      for (const p of parcelles) {
        const surface = Number(p.surface_retenue_ha ?? 0)
        const grande = p.polygone_requis
        const manquement = p.polygone_manquant
        sc(ws, row, 1, txt(p.plot_ref ?? `#${Number(p.feature_index) + 1}`), { sz: 9, bold: true })
        sc(ws, row, 2, txt(p.supplier_name), { sz: 9 })
        sc(ws, row, 3, txt(p.producer_name), { sz: 9 })
        sc(ws, row, 4, txt(p.attachment_name), { sz: 8 })
        sc(ws, row, 5, txt(p.country), { sz: 9, ha: 'center' })
        sc(ws, row, 6, txt(p.commodity), { sz: 9 })
        sc(ws, row, 7, txt(p.geometry_type), { sz: 9, ha: 'center' })
        sc(ws, row, 8, surface, { sz: 9, ha: 'right', bold: true, num: '0.0000' })
        sc(ws, row, 9, p.declared_area_ha != null ? Number(p.declared_area_ha) : '—', { sz: 9, ha: 'right', num: '0.0000' })
        sc(ws, row, 10, grande ? 'Oui' : 'Non', { sz: 9, ha: 'center' })
        sc(ws, row, 11, manquement ? 'MANQUANT' : (grande ? 'Fourni' : 'Non requis'), {
          sz: 9, ha: 'center', bold: manquement, fg: manquement ? C.red : C.gray, bg: manquement ? C.redL : undefined,
        })
        const etat = String(p.signal?.etat ?? 'non_analyse')
        sc(ws, row, 12, SIGNAL_LABELS[etat] ?? etat, {
          sz: 9, ha: 'center',
          fg: etat === 'perturbation' ? C.red : etat === 'risque_eleve' ? C.orange : etat === 'sans_signal' ? C.green : C.gray,
          bg: etat === 'perturbation' ? C.redL : etat === 'risque_eleve' ? C.orangeL : etat === 'sans_signal' ? C.greenL : undefined,
        })
        sc(ws, row, 13, dt(p.signal?.analyseLe), { sz: 9, ha: 'center' })
        sc(ws, row, 14, p.centroid_lat != null ? Number(p.centroid_lat) : '—', { sz: 9, ha: 'right', num: '0.000000' })
        sc(ws, row, 15, p.centroid_lon != null ? Number(p.centroid_lon) : '—', { sz: 9, ha: 'right', num: '0.000000' })
        sc(ws, row, 16, dt(p.survey_date), { sz: 9, ha: 'center' })
        sc(ws, row, 17, txt(p.survey_source), { sz: 8 })
        sc(ws, row, 18, dt(p.created_at), { sz: 9, ha: 'center' })
        sc(ws, row, 19, txt(p.created_by), { sz: 8 })
        row++
      }

      row++
      sc(ws, row, 1, 'Total', { bold: true, bg: C.grayL, sz: 10 })
      sc(ws, row, 7, `${parcelles.length} parcelle(s)`, { bold: true, bg: C.grayL, sz: 10, ha: 'right' })
      sc(ws, row, 8, totaux.surfaceHa, { bold: true, bg: C.greenL, fg: C.green, sz: 10, ha: 'right', num: '0.0000' })
      sc(ws, row, 10, `${totaux.auDela4Ha} > ${totaux.seuilHa} ha`, { bold: true, bg: C.grayL, sz: 9, ha: 'center' })
      sc(ws, row, 11, `${totaux.manquementsPolygone} manquement(s)`, {
        bold: true, sz: 9, ha: 'center',
        bg: totaux.manquementsPolygone > 0 ? C.redL : C.grayL,
        fg: totaux.manquementsPolygone > 0 ? C.red : C.gray,
      })

      row += 2
      sc(ws, row, 1, `Surface exprimée au dix-millième d’hectare, telle que calculée à partir du contour déposé. `
        + `Au-delà de ${totaux.seuilHa} hectares, l’article 9 du règlement (UE) 2023/1115 impose une géolocalisation en polygone.`,
        { it: true, sz: 9, fg: C.gray, wrap: true })
      ws.mergeCells(row, 1, row, heads.length)
      ws.getRow(row).height = 28
    }

    // ── 2. Synthèse par fournisseur ────────────────────────────────────────────
    {
      const ws = wb.addWorksheet('2. Par fournisseur')
      const heads = ['Fournisseur', 'Parcelles', 'Surface totale (ha)', 'Parcelles > 4 ha', 'Polygone manquant', 'Signaux de perturbation']
      header(ws, `Surfaces par fournisseur — ${orgNom}`, [34, 12, 20, 16, 18, 22], heads)

      const parF = new Map<string, { nom: string; n: number; ha: number; grandes: number; manq: number; sig: number }>()
      for (const p of parcelles) {
        const cle = String(p.supplier_id ?? 'sans-fournisseur')
        const acc = parF.get(cle) ?? { nom: p.supplier_name ?? '(non rattachée)', n: 0, ha: 0, grandes: 0, manq: 0, sig: 0 }
        acc.n += 1
        acc.ha += p.surface_retenue_ha
        if (p.polygone_requis) acc.grandes += 1
        if (p.polygone_manquant) acc.manq += 1
        if (p.signal?.etat === 'perturbation') acc.sig += 1
        parF.set(cle, acc)
      }

      let row = 4
      if (!parF.size) {
        sc(ws, row, 1, 'Aucune parcelle', { it: true, fg: C.gray, ha: 'center' })
        ws.mergeCells(row, 1, row, heads.length)
      }
      for (const v of Array.from(parF.values()).sort((a, b) => b.ha - a.ha)) {
        sc(ws, row, 1, v.nom, { sz: 9, bold: true })
        sc(ws, row, 2, v.n, { sz: 9, ha: 'right' })
        sc(ws, row, 3, +v.ha.toFixed(4), { sz: 9, ha: 'right', bold: true, num: '0.0000' })
        sc(ws, row, 4, v.grandes, { sz: 9, ha: 'center' })
        sc(ws, row, 5, v.manq, { sz: 9, ha: 'center', bold: v.manq > 0, fg: v.manq > 0 ? C.red : C.gray, bg: v.manq > 0 ? C.redL : undefined })
        sc(ws, row, 6, v.sig, { sz: 9, ha: 'center', bold: v.sig > 0, fg: v.sig > 0 ? C.orange : C.gray, bg: v.sig > 0 ? C.orangeL : undefined })
        row++
      }
    }

    const buffer = await wb.xlsx.writeBuffer()
    const filename = `EUDR_Parcelles_${orgNom.replace(/[^a-z0-9]/gi, '_')}.xlsx`
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('[eudr-fournisseurs/plots/export-excel]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

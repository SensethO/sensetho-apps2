/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/eudr-fournisseurs/export-excel?org_id=xxx
 * Génère un classeur Excel du suivi de conformité EUDR d'une organisation.
 * Onglets : 1. Acheteurs · 2. Fournisseurs · 3. Contrats
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─── Palette (vert EUDR / forêt) ──────────────────────────────────────────────
const C = {
  green:  'FF16A34A', greenL: 'FFDCFCE7',
  red:    'FFDC2626', redL:   'FFFEE2E2',
  orange: 'FFEA580C', orangeL:'FFFFEDD5',
  gray:   'FF6B7280', grayL:  'FFF3F4F6',
  white:  'FFFFFFFF', black:  'FF111827', border: 'FFE5E7EB',
}

type CS = { bg?: string; fg?: string; bold?: boolean; sz?: number; ha?: 'left' | 'right' | 'center'; it?: boolean; wrap?: boolean }

function sc(ws: ExcelJS.Worksheet, r: number, c: number, val: ExcelJS.CellValue, s: CS = {}) {
  const cell = ws.getCell(r, c)
  cell.value = val
  if (s.bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: s.bg } }
  if (s.bold || s.sz || s.fg || s.it) {
    cell.font = { ...(s.bold && { bold: true }), ...(s.sz && { size: s.sz }), ...(s.fg && { color: { argb: s.fg } }), ...(s.it && { italic: true }) }
  }
  cell.alignment = { horizontal: s.ha ?? 'left', vertical: 'middle', wrapText: s.wrap ?? false }
  cell.border = {
    top: { style: 'thin', color: { argb: C.border } }, bottom: { style: 'thin', color: { argb: C.border } },
    left: { style: 'thin', color: { argb: C.border } }, right: { style: 'thin', color: { argb: C.border } },
  }
}

const STATUS_LABELS: Record<string, string> = {
  oui: 'Oui', non: 'Non', partiel: 'Partiel', en_cours: 'En cours', unknown: 'À vérifier',
}
const RISK_LABELS: Record<string, string> = { low: 'Faible', standard: 'Standard', high: 'Élevé' }
const PRIORITY_LABELS: Record<string, string> = { haute: 'Haute', moyenne: 'Moyenne', basse: 'Basse' }
const st = (v: any) => STATUS_LABELS[v] ?? (v ? String(v) : '—')
const rk = (v: any) => RISK_LABELS[v] ?? (v ? String(v) : '—')
const txt = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v))

function header(ws: ExcelJS.Worksheet, title: string, cols: number[], headers: string[]) {
  ws.columns = cols.map(w => ({ width: w }))
  sc(ws, 1, 1, title, { bold: true, sz: 13, bg: C.green, fg: C.white })
  ws.mergeCells(1, 1, 1, headers.length)
  ws.getRow(1).height = 26
  headers.forEach((h, i) => sc(ws, 3, i + 1, h, { bold: true, bg: C.grayL, ha: 'center', sz: 10 }))
  ws.views = [{ state: 'frozen', ySplit: 3, showGridLines: false }]
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
    const isAdmin = profile?.role === 'admin'
    if (!isAdmin) {
      const { data: sub } = await admin
        .from('app_subscriptions')
        .select('id, expires_at, apps!inner(slug)')
        .eq('apps.slug', 'eudr-fournisseurs').eq('user_id', user.id).eq('status', 'active')
        .maybeSingle()
      const ok = sub && (!sub.expires_at || new Date(sub.expires_at) >= new Date())
      if (!ok) return NextResponse.json({ error: 'Abonnement requis' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const org_id = searchParams.get('org_id')
    if (!org_id) return NextResponse.json({ error: 'org_id requis' }, { status: 400 })

    const byUser = (q: any) => (isAdmin ? q : q.eq('user_id', user.id))
    const [orgRes, buyersRes, suppliersRes, contractsRes] = await Promise.all([
      admin.from('organisations').select('denomination, siren, ville').eq('id', org_id).maybeSingle(),
      byUser(admin.from('eudr_buyers').select('*').eq('org_id', org_id)).order('created_at'),
      byUser(admin.from('eudr_suppliers').select('*').eq('org_id', org_id)).order('created_at'),
      byUser(admin.from('eudr_contracts').select('*').eq('org_id', org_id)).order('created_at'),
    ])

    const org = orgRes.data as { denomination?: string; siren?: string; ville?: string } | null
    const orgNom = org?.denomination ?? 'Organisation'
    const buyers = (buyersRes.data ?? []) as any[]
    const suppliers = (suppliersRes.data ?? []) as any[]
    const contracts = (contractsRes.data ?? []) as any[]

    const wb = new ExcelJS.Workbook()
    wb.creator = "Sens'ethO Apps — Gestion des fournisseurs EUDR"
    wb.created = new Date()

    // ─── Onglet 1 : Acheteurs ──────────────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Acheteurs', { views: [{ showGridLines: false }] })
      header(ws, `Acheteurs — ${orgNom}`, [28, 24, 28, 22, 22, 16, 16, 22, 40],
        ['Nom', 'Contact EUDR', 'Email', 'Commodité', "Pays d'import", 'GeoJSON', 'Questionnaire', 'N° DDS', 'Notes'])
      let row = 4
      if (buyers.length === 0) { sc(ws, row, 1, 'Aucun acheteur', { it: true, fg: C.gray, ha: 'center' }); ws.mergeCells(row, 1, row, 9) }
      for (const b of buyers) {
        sc(ws, row, 1, txt(b.name), { sz: 9, bold: true })
        sc(ws, row, 2, txt(b.eudr_contact), { sz: 9 })
        sc(ws, row, 3, txt(b.email), { sz: 9 })
        sc(ws, row, 4, txt(b.commodity), { sz: 9 })
        sc(ws, row, 5, txt(b.country_import), { sz: 9 })
        sc(ws, row, 6, st(b.geojson_status), { sz: 9, ha: 'center' })
        sc(ws, row, 7, st(b.questionnaire_status), { sz: 9, ha: 'center' })
        sc(ws, row, 8, txt(b.dds_number), { sz: 9 })
        sc(ws, row, 9, txt(b.notes), { sz: 8, wrap: true })
        row++
      }
    }

    // ─── Onglet 2 : Fournisseurs ───────────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Fournisseurs', { views: [{ showGridLines: false }] })
      header(ws, `Fournisseurs — ${orgNom}`, [28, 12, 24, 24, 20, 14, 14, 16, 12, 36, 36],
        ['Entreprise', 'Priorité', 'Contact', 'Email', "Pays d'origine", 'Risque', 'GeoJSON', 'Quest. agric.', 'DDR', 'Certifications', 'Notes'])
      let row = 4
      if (suppliers.length === 0) { sc(ws, row, 1, 'Aucun fournisseur', { it: true, fg: C.gray, ha: 'center' }); ws.mergeCells(row, 1, row, 11) }
      for (const s of suppliers) {
        const certs = Array.isArray(s.certifications)
          ? (s.certifications as any[]).map(c => `${c?.type ?? '?'} (${c?.status ?? '?'}${c?.valid_until ? ' — ' + c.valid_until : ''})`).join('; ')
          : ''
        sc(ws, row, 1, txt(s.company), { sz: 9, bold: true })
        sc(ws, row, 2, PRIORITY_LABELS[s.priority] ?? txt(s.priority), { sz: 9, ha: 'center' })
        sc(ws, row, 3, txt(s.contact_person), { sz: 9 })
        sc(ws, row, 4, txt(s.email), { sz: 9 })
        sc(ws, row, 5, txt(s.country_origin), { sz: 9 })
        sc(ws, row, 6, rk(s.eudr_risk_level), { sz: 9, ha: 'center', bold: true, fg: s.eudr_risk_level === 'high' ? C.red : s.eudr_risk_level === 'standard' ? C.orange : C.green })
        sc(ws, row, 7, st(s.geojson_status), { sz: 9, ha: 'center' })
        sc(ws, row, 8, st(s.farmer_questionnaire_status), { sz: 9, ha: 'center' })
        sc(ws, row, 9, st(s.ddr_status), { sz: 9, ha: 'center' })
        sc(ws, row, 10, certs || '—', { sz: 8, wrap: true })
        sc(ws, row, 11, txt(s.notes), { sz: 8, wrap: true })
        row++
      }
    }

    // ─── Onglet 3 : Contrats ───────────────────────────────────────────────────
    {
      const ws = wb.addWorksheet('Contrats', { views: [{ showGridLines: false }] })
      header(ws, `Contrats / Expéditions — ${orgNom}`, [20, 24, 14, 24, 20, 14, 16, 16, 16, 16, 14, 36],
        ['N° contrat', 'Produit', 'Sous EUDR', 'Fournisseur', 'Pays livraison', 'EUDR appliqué', 'Production', 'Livraison prévue', 'Géoloc. parcelle', 'Diligence', 'Risque', 'Notes'])
      let row = 4
      if (contracts.length === 0) { sc(ws, row, 1, 'Aucun contrat', { it: true, fg: C.gray, ha: 'center' }); ws.mergeCells(row, 1, row, 12) }
      for (const c of contracts) {
        sc(ws, row, 1, txt(c.contract_number), { sz: 9, bold: true })
        sc(ws, row, 2, txt(c.product), { sz: 9 })
        sc(ws, row, 3, st(c.product_under_eudr), { sz: 9, ha: 'center' })
        sc(ws, row, 4, txt(c.supplier), { sz: 9 })
        sc(ws, row, 5, txt(c.delivery_country), { sz: 9 })
        sc(ws, row, 6, st(c.eudr_applied), { sz: 9, ha: 'center' })
        sc(ws, row, 7, txt(c.production_date), { sz: 9, ha: 'center' })
        sc(ws, row, 8, txt(c.expected_delivery_date), { sz: 9, ha: 'center' })
        sc(ws, row, 9, st(c.plot_geolocation), { sz: 9, ha: 'center' })
        sc(ws, row, 10, st(c.due_diligence), { sz: 9, ha: 'center' })
        sc(ws, row, 11, rk(c.risk_level), { sz: 9, ha: 'center', bold: true, fg: c.risk_level === 'high' ? C.red : c.risk_level === 'standard' ? C.orange : C.green })
        sc(ws, row, 12, txt(c.notes), { sz: 8, wrap: true })
        row++
      }
    }

    const buffer = await wb.xlsx.writeBuffer()
    const filename = `EUDR_${orgNom.replace(/[^a-z0-9]/gi, '_')}.xlsx`
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('[eudr-fournisseurs/export-excel]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

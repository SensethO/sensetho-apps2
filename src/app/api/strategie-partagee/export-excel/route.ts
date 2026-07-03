/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/strategie-partagee/export-excel?org_id=xxx
 * Classeur Excel de la stratégie partagée (Hoshin Kanri) d'une organisation.
 * Onglets : Synthèse · Mission · SWOT · Attentes · Vision · Valeurs · Axes & LA ·
 *           Matrice Hoshin · Balanced Scorecard · Master Plan · Tableau de bord · Kotter
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccessOrgDossier } from '@/lib/rseShares'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
export const runtime = 'nodejs'

const C = { indigo: 'FF4F46E5', indigoL: 'FFE0E7FF', gray: 'FF6B7280', grayL: 'FFF3F4F6', white: 'FFFFFFFF', black: 'FF111827', border: 'FFE5E7EB', green: 'FFDCFCE7', amber: 'FFFEF3C7', red: 'FFFEE2E2' }
type CS = { bg?: string; fg?: string; bold?: boolean; sz?: number; ha?: 'left' | 'right' | 'center'; wrap?: boolean; it?: boolean }
const txt = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v))

function sc(ws: ExcelJS.Worksheet, r: number, c: number, val: ExcelJS.CellValue, s: CS = {}) {
  const cell = ws.getCell(r, c)
  cell.value = val
  if (s.bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: s.bg } }
  if (s.bold || s.sz || s.fg || s.it) cell.font = { ...(s.bold && { bold: true }), ...(s.sz && { size: s.sz }), ...(s.fg && { color: { argb: s.fg } }), ...(s.it && { italic: true }) }
  cell.alignment = { horizontal: s.ha ?? 'left', vertical: 'top', wrapText: s.wrap ?? true }
  cell.border = { top: { style: 'thin', color: { argb: C.border } }, bottom: { style: 'thin', color: { argb: C.border } }, left: { style: 'thin', color: { argb: C.border } }, right: { style: 'thin', color: { argb: C.border } } }
}
function title(ws: ExcelJS.Worksheet, label: string, span: number) {
  ws.mergeCells(1, 1, 1, span)
  sc(ws, 1, 1, label, { bg: C.indigo, fg: C.white, bold: true, sz: 13 })
  ws.getRow(1).height = 24
}
function head(ws: ExcelJS.Worksheet, row: number, headers: string[]) {
  headers.forEach((h, i) => sc(ws, row, i + 1, h, { bg: C.indigoL, bold: true }))
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const orgId = req.nextUrl.searchParams.get('org_id')
    if (!orgId) return NextResponse.json({ error: 'org_id requis' }, { status: 400 })
    if (!await canAccessOrgDossier('strategie-partagee', user.id, orgId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createAdminClient()
    const { data: row } = await admin.from('strategie_partagee').select('*').eq('org_id', orgId).maybeSingle()
    const { data: org } = await admin.from('organisations').select('denomination').eq('id', orgId).single()
    const d: any = row ?? {}

    const wb = new ExcelJS.Workbook()
    wb.creator = "Sens'ethO"

    // 1. Synthèse
    const s1 = wb.addWorksheet('Synthèse')
    s1.columns = [{ width: 26 }, { width: 90 }]
    title(s1, `Stratégie Partagée — ${txt(org?.denomination)}`, 2)
    const syn: [string, any][] = [
      ['Organisation', org?.denomination], ['Horizon', d.horizon],
      ['Mission', d.mission?.raisonEtre], ['Vision (synthétique)', d.vision?.synthetique],
      ['Nb axes stratégiques', Array.isArray(d.axes) ? d.axes.length : 0],
    ]
    syn.forEach((p, i) => { sc(s1, i + 3, 1, p[0], { bg: C.grayL, bold: true }); sc(s1, i + 3, 2, txt(p[1])) })

    // 2. Mission
    const s2 = wb.addWorksheet('Mission')
    s2.columns = [{ width: 70 }, { width: 14 }]
    title(s2, 'Mission — raison d’être', 2)
    sc(s2, 3, 1, txt(d.mission?.raisonEtre), {}); s2.mergeCells(3, 1, 3, 2)
    head(s2, 5, ['Critère de validation', 'Validé'])
    const critLabels: Record<string, string> = { clients: 'Centrée sur la satisfaction des besoins clients/PP', metier: 'Basée sur le cœur de métier', engagement: 'Motive et inspire l’engagement', claire: 'Réaliste, claire, facile à comprendre', memorable: 'Spécifique, courte, mémorable', coherente: 'Cohérente avec la vision' }
    Object.entries(critLabels).forEach(([k, lab], i) => { sc(s2, 6 + i, 1, lab); sc(s2, 6 + i, 2, d.mission?.criteres?.[k] ? 'Oui' : '—', { ha: 'center' }) })

    // 3. SWOT
    const s3 = wb.addWorksheet('SWOT')
    s3.columns = [{ width: 45 }, { width: 45 }, { width: 45 }, { width: 45 }]
    title(s3, 'Analyse SWOT', 4)
    head(s3, 3, ['Forces (interne +)', 'Faiblesses (interne −)', 'Opportunités (externe +)', 'Menaces (externe −)'])
    const sw = d.swot ?? {}
    const maxSw = Math.max(sw.forces?.length ?? 0, sw.faiblesses?.length ?? 0, sw.opportunites?.length ?? 0, sw.menaces?.length ?? 0, 1)
    for (let i = 0; i < maxSw; i++) {
      sc(s3, 4 + i, 1, sw.forces?.[i] ?? '', { bg: C.green }); sc(s3, 4 + i, 2, sw.faiblesses?.[i] ?? '', { bg: C.amber })
      sc(s3, 4 + i, 3, sw.opportunites?.[i] ?? '', { bg: C.indigoL }); sc(s3, 4 + i, 4, sw.menaces?.[i] ?? '', { bg: C.red })
    }

    // 4. Attentes clients (Kano)
    const s4 = wb.addWorksheet('Attentes clients')
    s4.columns = [{ width: 50 }, { width: 50 }, { width: 50 }]
    title(s4, 'Attentes clients — modèle de Kano', 3)
    head(s4, 3, ['Base (obligatoire)', 'Proportionnel (performance)', 'Attractif (séduction)'])
    const at = d.attentes ?? {}
    const maxAt = Math.max(at.base?.length ?? 0, at.proportionnel?.length ?? 0, at.attractif?.length ?? 0, 1)
    for (let i = 0; i < maxAt; i++) { sc(s4, 4 + i, 1, at.base?.[i] ?? ''); sc(s4, 4 + i, 2, at.proportionnel?.[i] ?? ''); sc(s4, 4 + i, 3, at.attractif?.[i] ?? '') }
    const r0 = 5 + maxAt
    sc(s4, r0, 1, 'Avantages compétitifs', { bold: true, bg: C.grayL }); s4.mergeCells(r0, 1, r0, 3)
    ;(at.avantages ?? []).forEach((a: string, i: number) => { sc(s4, r0 + 1 + i, 1, a); s4.mergeCells(r0 + 1 + i, 1, r0 + 1 + i, 3) })
    sc(s4, r0 + 1 + (at.avantages?.length ?? 0), 1, `NPS : ${txt(at.nps)}`, { it: true }); s4.mergeCells(r0 + 1 + (at.avantages?.length ?? 0), 1, r0 + 1 + (at.avantages?.length ?? 0), 3)

    // 5. Vision
    const s5 = wb.addWorksheet('Vision')
    s5.columns = [{ width: 30 }, { width: 90 }]
    title(s5, 'Vision', 2)
    const v = d.vision ?? {}
    const visRows: [string, any][] = [
      ['Synthétique', v.synthetique], ['Détaillée', v.detaillee], ['Chiffrée', v.chiffree],
      ['Hommes', v.parties?.hommes], ['Marché / Clients', v.parties?.marche], ['Environnement', v.parties?.environnement], ['Entreprise / Actionnaires', v.parties?.entreprise],
      ['Q. Entreprise', v.questions?.entreprise], ['Q. Clients', v.questions?.clients], ['Q. Marché', v.questions?.marche], ['Q. Personnel', v.questions?.personnel], ['Q. Fonctionnement', v.questions?.fonctionnement],
    ]
    visRows.forEach((p, i) => { sc(s5, i + 3, 1, p[0], { bg: C.grayL, bold: true }); sc(s5, i + 3, 2, txt(p[1])) })

    // 6. Valeurs
    const s6 = wb.addWorksheet('Valeurs')
    s6.columns = [{ width: 30 }, { width: 80 }]
    title(s6, 'Valeurs & règles du jeu', 2)
    head(s6, 3, ['Valeur', 'Règles de comportement'])
    ;(d.valeurs ?? []).forEach((val: any, i: number) => { sc(s6, 4 + i, 1, txt(val.valeur), { bold: true }); sc(s6, 4 + i, 2, (val.regles ?? []).map((r: string) => `• ${r}`).join('\n')) })

    // 7. Axes & Lignes d'actions
    const s7 = wb.addWorksheet('Axes & LA')
    s7.columns = [{ width: 8 }, { width: 40 }, { width: 40 }, { width: 22 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 12 }]
    title(s7, 'Axes stratégiques & Lignes d’actions', 8)
    head(s7, 3, ['Réf.', 'Énoncé', 'Résultat / Objectif', 'Indicateur', 'Actuel', 'Cible', 'Échéance', 'Déployable'])
    let rr = 4
    ;(d.axes ?? []).forEach((axe: any, ai: number) => {
      sc(s7, rr, 1, `A${ai + 1}`, { bold: true, bg: C.indigoL }); sc(s7, rr, 2, txt(axe.titre), { bold: true, bg: C.indigoL }); for (let c = 3; c <= 8; c++) sc(s7, rr, c, '', { bg: C.indigoL }); rr++
      if (axe.freins?.length) { sc(s7, rr, 1, 'Freins', { it: true }); sc(s7, rr, 2, axe.freins.map((f: string) => `• ${f}`).join('\n'), { it: true }); s7.mergeCells(rr, 2, rr, 8); rr++ }
      ;(axe.lignes ?? []).forEach((la: any, li: number) => {
        sc(s7, rr, 1, `LA${ai + 1}.${li + 1}`); sc(s7, rr, 2, txt(la.enonce)); sc(s7, rr, 3, txt(la.objectif)); sc(s7, rr, 4, txt(la.indicateur))
        sc(s7, rr, 5, txt(la.niveauActuel), { ha: 'center' }); sc(s7, rr, 6, txt(la.cible), { ha: 'center' }); sc(s7, rr, 7, txt(la.echeance), { ha: 'center' }); sc(s7, rr, 8, la.deployable ? 'Oui' : 'Non', { ha: 'center' }); rr++
      })
    })

    // 8. Matrice Hoshin
    const s8 = wb.addWorksheet('Matrice Hoshin')
    const axes = d.axes ?? []
    const laRows: { rk: string; label: string; texte: string }[] = []
    axes.forEach((axe: any, ai: number) => (axe.lignes ?? []).forEach((la: any, li: number) => laRows.push({ rk: la.id ?? `${ai}.${li}`, label: `LA${ai + 1}.${li + 1}`, texte: la.enonce || '' })))
    s8.columns = [{ width: 40 }, ...axes.map(() => ({ width: 8 })), { width: 8 }, { width: 18 }]
    title(s8, 'Matrice Hoshin d’alignement (3 fort · 2 moyen · 1 faible)', axes.length + 3)
    head(s8, 3, ['Lignes d’actions \\ Axes', ...axes.map((_: any, ai: number) => `A${ai + 1}`), 'Σ', 'Sponsor'])
    const scores = d.hoshin?.scores ?? {}; const sponsors = d.hoshin?.sponsors ?? {}
    laRows.forEach((r, i) => {
      sc(s8, 4 + i, 1, `${r.label} — ${r.texte}`)
      let tot = 0
      axes.forEach((axe: any, ai: number) => { const val = scores[r.rk]?.[axe.id ?? `${ai}`] ?? 0; tot += val; sc(s8, 4 + i, 2 + ai, val || '', { ha: 'center', bg: val === 3 ? C.indigo : val ? C.indigoL : undefined, fg: val === 3 ? C.white : undefined }) })
      sc(s8, 4 + i, 2 + axes.length, tot, { ha: 'center', bold: true }); sc(s8, 4 + i, 3 + axes.length, txt(sponsors[r.rk]))
    })

    // 9. Balanced Scorecard
    const s9 = wb.addWorksheet('Balanced Scorecard')
    s9.columns = [{ width: 26 }, { width: 45 }, { width: 30 }, { width: 20 }]
    title(s9, 'Balanced Scorecard', 4)
    head(s9, 3, ['Perspective', 'Objectif', 'Indicateur', 'Cible'])
    const bscLabels: Record<string, string> = { finances: 'Résultats financiers', clients: 'Résultats clients', processus: 'Processus internes', apprentissage: 'Apprentissage organisationnel' }
    let br = 4
    Object.entries(bscLabels).forEach(([k, lab]) => (d.bsc?.[k] ?? []).forEach((it: any) => { sc(s9, br, 1, lab); sc(s9, br, 2, txt(it.objectif)); sc(s9, br, 3, txt(it.indicateur)); sc(s9, br, 4, txt(it.cible)); br++ }))

    // 10. Master Plan
    const s10 = wb.addWorksheet('Master Plan')
    s10.columns = [{ width: 45 }, { width: 12 }, { width: 16 }, { width: 20 }, { width: 30 }, { width: 14 }]
    title(s10, 'Master Plan', 6)
    head(s10, 3, ['Action / Projet', 'Type', 'Pilotage', 'Responsable', 'Livrables', 'Échéance'])
    const pilLab: Record<string, string> = { hierarchique: 'Hiérarchique', transversal: 'Transversal', projet: 'Projet' }
    ;(d.master_plan ?? []).forEach((m: any, i: number) => { sc(s10, 4 + i, 1, txt(m.libelle)); sc(s10, 4 + i, 2, m.type === 'projet' ? 'Projet' : 'Action'); sc(s10, 4 + i, 3, pilLab[m.pilotage] ?? '—'); sc(s10, 4 + i, 4, txt(m.responsable)); sc(s10, 4 + i, 5, txt(m.livrables)); sc(s10, 4 + i, 6, txt(m.echeance)) })

    // 11. Tableau de bord
    const s11 = wb.addWorksheet('Tableau de bord')
    s11.columns = [{ width: 34 }, { width: 34 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 16 }]
    title(s11, 'Tableau de bord (PDCA)', 6)
    head(s11, 3, ['Origine', 'Indicateur', 'Départ', 'Cible', 'Actuel', 'État'])
    const suivi = d.pilotage?.suivi ?? {}; const feuLab: Record<string, string> = { vert: 'En bonne voie', orange: 'À surveiller', rouge: 'En retard' }
    let tr = 4
    axes.forEach((axe: any, ai: number) => (axe.lignes ?? []).forEach((la: any, li: number) => {
      if (!la.indicateur && !la.objectif) return
      const s = suivi[`la:${la.id ?? `${ai}.${li}`}`] ?? {}
      sc(s11, tr, 1, `A${ai + 1}.${li + 1} — ${txt(axe.titre)}`); sc(s11, tr, 2, txt(la.indicateur || la.objectif)); sc(s11, tr, 3, txt(la.niveauActuel), { ha: 'center' }); sc(s11, tr, 4, txt(la.cible), { ha: 'center' }); sc(s11, tr, 5, txt(s.valeur), { ha: 'center' }); sc(s11, tr, 6, feuLab[s.statut] ?? '—', { bg: s.statut === 'vert' ? C.green : s.statut === 'orange' ? C.amber : s.statut === 'rouge' ? C.red : undefined }); tr++
    }))

    // 12. Kotter
    const s12 = wb.addWorksheet('Conduite du changement')
    s12.columns = [{ width: 6 }, { width: 55 }, { width: 14 }, { width: 50 }]
    title(s12, 'Conduite du changement — 8 étapes de Kotter', 4)
    head(s12, 3, ['#', 'Étape', 'Statut', 'Notes'])
    const kotterLabels = ['Créer un sentiment d’urgence', 'Former une coalition puissante', 'Développer une vision mobilisatrice', 'Communiquer la vision', 'Lever les obstacles au changement', 'Démontrer des résultats à court terme', 'Bâtir sur les premiers résultats', 'Ancrer les nouvelles pratiques']
    const statLab: Record<string, string> = { afaire: 'À faire', encours: 'En cours', fait: 'Fait' }
    kotterLabels.forEach((lab, i) => { const st = d.kotter?.[i] ?? {}; sc(s12, 4 + i, 1, i + 1, { ha: 'center' }); sc(s12, 4 + i, 2, lab); sc(s12, 4 + i, 3, statLab[st.statut] ?? 'À faire', { ha: 'center', bg: st.statut === 'fait' ? C.green : st.statut === 'encours' ? C.amber : undefined }); sc(s12, 4 + i, 4, txt(st.note)) })

    const buf = await wb.xlsx.writeBuffer()
    const name = `Strategie_${(org?.denomination ?? 'org').replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${name}"`,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message ?? String(err) }, { status: 500 })
  }
}

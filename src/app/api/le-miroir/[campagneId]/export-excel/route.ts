/**
 * GET /api/le-miroir/[campagneId]/export-excel
 * Export Excel exhaustif de la campagne du miroir collectif (méthode Sens'ethO).
 *
 * Onglets :
 *  1. Synthèse            — org, année, statut, indicateurs standard (§7.3), image cible, contrat de règles
 *  2. L'entreprise        — deux portraits (équipes vs dirigeant, écarts), paire, dédicaces, signaux
 *  3. La cascade          — services, postes d'encadrement, parties prenantes (agrégats, seuil respecté)
 *  4. Portraits (brut)    — un portrait par ligne, anonyme (Regard n), êtres restituables uniquement
 *  5. Engagements         — les 3 engagements observables et leur statut
 *
 * Accès : toute personne ayant accès à la campagne (owner, invité, admin) —
 * la restitution est garantie à tous les participants (contrat de règles).
 * Le SEUIL de restitution (≥ 4 regards) est appliqué : les êtres sous le seuil
 * n'exposent que leur statut, jamais leur contenu.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ExcelJS from 'exceljs'
import {
  especeById, habitatById, relationById, CONTRAT_REGLES, SEUIL_RESTITUTION,
} from '@/lib/leMiroir'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─── Palette Sens'ethO ────────────────────────────────────────────────────────
const C = {
  teal: 'FF1D3D4C', tealL: 'FFE3EAED',
  sage: 'FF5E7A50', sageL: 'FFEAF0E6',
  cream: 'FFF2EEE3',
  alert: 'FFA85B3B', alertL: 'FFF6E7DF',
  gray: 'FF6B7280', grayL: 'FFF3F4F6',
  white: 'FFFFFFFF', black: 'FF111827', border: 'FFD9E0DA',
}

type CS = { bg?: string; fg?: string; bold?: boolean; sz?: number; ha?: 'left' | 'right' | 'center'; it?: boolean; wrap?: boolean }

function sc(ws: ExcelJS.Worksheet, r: number, c: number, val: ExcelJS.CellValue, s: CS = {}) {
  const cell = ws.getCell(r, c)
  cell.value = val
  if (s.bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: s.bg } }
  if (s.bold || s.sz || s.fg || s.it) {
    cell.font = { ...(s.bold && { bold: true }), ...(s.sz && { size: s.sz }), ...(s.fg && { color: { argb: s.fg } }), ...(s.it && { italic: true }) }
  }
  cell.alignment = { horizontal: s.ha ?? 'left', vertical: 'middle', wrapText: s.wrap ?? true }
  cell.border = { top: { style: 'thin', color: { argb: C.border } }, bottom: { style: 'thin', color: { argb: C.border } }, left: { style: 'thin', color: { argb: C.border } }, right: { style: 'thin', color: { argb: C.border } } }
}

const modeOf = (arr: (string | null | undefined)[]) => {
  const clean = arr.filter(Boolean) as string[]
  if (!clean.length) return undefined
  const c: Record<string, number> = {}
  clean.forEach((v) => (c[v] = (c[v] || 0) + 1))
  return Object.keys(c).sort((a, b) => c[b] - c[a])[0]
}
const avgOf = (arr: number[]) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : undefined)
const VERDICT_LABELS = ['', 'Inadéquat', 'Plutôt inadéquat', 'Plutôt adéquat', 'Pleinement adéquat']
const vLabel = (v: number | null | undefined) => (v ? `${VERDICT_LABELS[Math.round(v)] ?? '—'} (${v}/4)` : '—')
const espLabel = (id: string | null | undefined) => { const e = id ? especeById(id) : null; return e ? `${e.emoji} ${e.nom}` : '—' }
const habLabel = (id: string | null | undefined) => { const h = id ? habitatById(id) : null; return h ? `${h.emoji} ${h.nom}` : '—' }
const relLabel = (id: string | null | undefined) => { const r = id ? relationById(id) : null; return r ? `${r.emoji} ${r.nom}` : '—' }

interface PortraitRow {
  user_id: string; etre_key: string; etre_label: string
  espece_id: string; espece_cite_id: string | null
  habitat_marche_id: string | null; habitat_cite_id: string | null
  verdict_marche: number | null; verdict_cite: number | null
  milieu_libre: string | null; relation: string | null
  signaux: string | null; dedicace: string | null
  justification: string | null; kind: string; methode: string | null
}

export async function GET(req: NextRequest, { params }: { params: { campagneId: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Accès via RLS (owner, invité, admin) : si la campagne est lisible, l'export l'est.
    const { data: camp } = await supabase
      .from('le_miroir_campagnes')
      .select('id, org_id, annee, statut, image_cible, owner_id')
      .eq('id', params.campagneId).maybeSingle()
    if (!camp) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createAdminClient()
    const [{ data: org }, { data: parts }, { data: ports }, { data: etres }, { data: engs }] = await Promise.all([
      admin.from('organisations').select('denomination').eq('id', camp.org_id).maybeSingle(),
      admin.from('le_miroir_participants').select('poste, service, regles_acceptees').eq('campagne_id', camp.id),
      admin.from('le_miroir_portraits').select('*').eq('campagne_id', camp.id).order('created_at'),
      admin.from('le_miroir_etres').select('id, kind, label, cote').eq('campagne_id', camp.id).order('created_at'),
      admin.from('le_miroir_engagements').select('qui, quoi, echeance, comportement, statut').eq('campagne_id', camp.id).order('created_at'),
    ])

    const orgNom = org?.denomination ?? 'Organisation'
    const portraits = (ports ?? []) as PortraitRow[]
    const enCollecte = camp.statut !== 'restitution'

    // Pendant la collecte, personne ne lit — l'export est un artefact de restitution.
    if (enCollecte) {
      return NextResponse.json({ error: 'La collecte est en cours : le miroir est voilé (contrat de règles). Clore la collecte pour exporter.' }, { status: 409 })
    }

    // ── Cascade des êtres ──
    const services = Array.from(new Set((parts ?? []).map((p) => p.service).filter(Boolean))) as string[]
    interface EtreDef { key: string; label: string; groupe: string; verdictTitre: string }
    const etreDefs: EtreDef[] = [
      { key: 'entreprise', label: orgNom, groupe: "L'entreprise", verdictTitre: 'Adéquation' },
      ...services.map((s) => ({ key: 'service:' + s, label: 'Service ' + s, groupe: 'Services', verdictTitre: "L'animal du service sert-il l'animal de l'entreprise ?" })),
      ...(etres ?? []).filter((e) => e.kind === 'poste').map((e) => ({ key: 'poste:' + e.id, label: e.label as string, groupe: "Postes d'encadrement", verdictTitre: 'Fonctionnement adapté — et poste viable ?' })),
      ...(etres ?? []).filter((e) => e.kind === 'partie_prenante').map((e) => ({ key: 'pp:' + e.id, label: e.label as string, groupe: 'Parties prenantes', verdictTitre: 'La relation est-elle viable pour les deux ?' })),
    ]
    const regardsDe = (key: string) => portraits.filter((p) => p.etre_key === key && p.kind === 'individuel')
    const nRegards = (key: string) => new Set(regardsDe(key).map((p) => p.user_id)).size
    const restituable = (key: string) => nRegards(key) >= SEUIL_RESTITUTION

    // ── Entreprise : agrégats + écarts ──
    const het = regardsDe('entreprise')
    const auto = portraits.find((p) => p.etre_key === 'entreprise' && p.kind === 'auto')
    const espM = modeOf(het.map((p) => p.espece_id))
    const espC = modeOf(het.map((p) => p.espece_cite_id || p.espece_id))
    const habM = modeOf(het.map((p) => p.habitat_marche_id))
    const habC = modeOf(het.map((p) => p.habitat_cite_id))
    const vM = avgOf(het.map((p) => p.verdict_marche || 0).filter(Boolean))
    const vC = avgOf(het.map((p) => p.verdict_cite || 0).filter(Boolean))

    // ── Indicateurs standard (§7.3) ──
    const acceptes = (parts ?? []).filter((p) => p.regles_acceptees !== false).length
    const etresPeints = etreDefs.filter((e) => portraits.some((p) => p.etre_key === e.key))
    const restituables = etresPeints.filter((e) => restituable(e.key))
    const ecartDirigeant = !auto ? '—' : (() => {
      const dM = espM && auto.espece_id !== espM
      const dC = espC && (auto.espece_cite_id || auto.espece_id) !== espC
      if (dM && dC) return 'Écart sur les deux milieux'
      if (dM) return 'Écart sur le marché'
      if (dC) return 'Écart sur la cité'
      return "Aligné (même famille d'image)"
    })()
    const engagements = engs ?? []
    const constates = engagements.filter((e) => e.statut === 'constate').length
    const imageCible = (camp.image_cible ?? null) as { espece_id?: string; note?: string } | null

    const indicateurs: [string, string][] = [
      ['Participation', `${acceptes} participant(s) ayant accepté le contrat de règles`],
      [`Êtres restituables (seuil ≥ ${SEUIL_RESTITUTION})`, `${restituables.length} / ${etresPeints.length} êtres peints`],
      ['Écart dirigeant ↔ équipes', ecartDirigeant],
      ['Tenue des engagements', engagements.length ? `${constates} / ${engagements.length} comportement(s) constaté(s)` : 'Aucun engagement posé'],
    ]

    // ══════════════════════════ Classeur ══════════════════════════
    const wb = new ExcelJS.Workbook()
    wb.creator = "Sens'ethO — Le Miroir"

    // ─── 1. Synthèse ───
    {
      const ws = wb.addWorksheet('Synthèse')
      ws.getColumn(1).width = 3; ws.getColumn(2).width = 34; ws.getColumn(3).width = 80
      let r = 2
      sc(ws, r, 2, "SENS'ETHO — LE MIROIR · Restitution du miroir collectif", { bg: C.teal, fg: C.white, bold: true, sz: 14 }); ws.mergeCells(r, 2, r, 3); ws.getRow(r).height = 26; r += 2
      const info: [string, string][] = [
        ['Organisation', orgNom],
        ['Campagne', String(camp.annee)],
        ['Statut', 'Restitution ouverte'],
        ['Exporté le', new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })],
        ['Portraits peints', String(portraits.length)],
      ]
      for (const [k, v] of info) { sc(ws, r, 2, k, { bg: C.tealL, bold: true, sz: 10 }); sc(ws, r, 3, v, { sz: 10 }); r++ }
      r++
      sc(ws, r, 2, 'INDICATEURS STANDARD DE LA MISSION (méthode §7.3)', { bg: C.sage, fg: C.white, bold: true, sz: 11 }); ws.mergeCells(r, 2, r, 3); r++
      for (const [k, v] of indicateurs) { sc(ws, r, 2, k, { bg: C.sageL, bold: true, sz: 10 }); sc(ws, r, 3, v, { sz: 10 }); r++ }
      sc(ws, r, 2, "Mouvement d'image (re-mesure)", { bg: C.sageL, bold: true, sz: 10 })
      sc(ws, r, 3, 'Comparer avec la campagne précédente / suivante (navigation par année dans l’app)', { sz: 10, it: true }); r += 2
      sc(ws, r, 2, 'IMAGE CIBLE', { bg: C.teal, fg: C.white, bold: true, sz: 11 }); ws.mergeCells(r, 2, r, 3); r++
      sc(ws, r, 2, imageCible?.espece_id ? espLabel(imageCible.espece_id) : '— non choisie —', { bold: true, sz: 11 })
      sc(ws, r, 3, imageCible?.note ? `« ${imageCible.note} »` : '', { sz: 10, it: true }); r += 2
      sc(ws, r, 2, 'LE CONTRAT DE RÈGLES', { bg: C.teal, fg: C.white, bold: true, sz: 11 }); ws.mergeCells(r, 2, r, 3); r++
      for (const regle of CONTRAT_REGLES) { sc(ws, r, 2, '•', { ha: 'center', sz: 10 }); sc(ws, r, 3, regle, { sz: 9.5 }); ws.getRow(r).height = 24; r++ }
    }

    // ─── 2. L'entreprise ───
    {
      const ws = wb.addWorksheet("L'entreprise")
      ws.getColumn(1).width = 3; ws.getColumn(2).width = 30; ws.getColumn(3).width = 42; ws.getColumn(4).width = 42
      let r = 2
      sc(ws, r, 2, `${orgNom} — deux animaux, deux milieux (${nRegards('entreprise')} regards + portrait du dirigeant)`, { bg: C.teal, fg: C.white, bold: true, sz: 12 }); ws.mergeCells(r, 2, r, 4); ws.getRow(r).height = 22; r += 2

      if (!restituable('entreprise')) {
        sc(ws, r, 2, `🔒 Sous le seuil de restitution (${nRegards('entreprise')}/${SEUIL_RESTITUTION}) — rien n'est restitué.`, { bg: C.alertL, fg: C.alert, bold: true }); ws.mergeCells(r, 2, r, 4)
      } else {
        sc(ws, r, 2, '', { bg: C.grayL }); sc(ws, r, 3, '🏹 SUR SON MARCHÉ', { bg: C.tealL, bold: true, ha: 'center' }); sc(ws, r, 4, '🏛️ DANS LA CITÉ (marque employeur réelle)', { bg: C.tealL, bold: true, ha: 'center' }); r++
        const rows: [string, string, string][] = [
          ['Animal vu par les équipes (majoritaire)', espLabel(espM), espLabel(espC)],
          ['Habitat (majoritaire)', habLabel(habM), habLabel(habC)],
          ['Adéquation (moyenne des équipes)', vLabel(vM), vLabel(vC)],
          ['Animal vu par le dirigeant', espLabel(auto?.espece_id), espLabel(auto?.espece_cite_id || auto?.espece_id)],
          ['Adéquation vue par le dirigeant', vLabel(auto?.verdict_marche), vLabel(auto?.verdict_cite)],
          ['Écart d’espèce dirigeant ↔ équipes', auto && espM && auto.espece_id !== espM ? '⚠️ OUI' : 'non', auto && espC && (auto.espece_cite_id || auto.espece_id) !== espC ? '⚠️ OUI' : 'non'],
        ]
        for (const [k, a, b] of rows) { sc(ws, r, 2, k, { bg: C.sageL, bold: true, sz: 10 }); sc(ws, r, 3, a, { sz: 10, ha: 'center' }); sc(ws, r, 4, b, { sz: 10, ha: 'center' }); r++ }
        r++
        if (espM && espC && espM !== espC) {
          sc(ws, r, 2, '⚖️ La paire des deux animaux', { bg: C.cream, bold: true, sz: 10 })
          sc(ws, r, 3, 'Deux animaux différents selon le milieu — tension féconde ou écartèlement ? C’est souvent là que la perte de sens se loge (méthode §5.2).', { sz: 9.5, it: true }); ws.mergeCells(r, 3, r, 4); ws.getRow(r).height = 26; r += 2
        }
        const dedicaces = het.map((p) => p.dedicace).filter(Boolean) as string[]
        if (dedicaces.length) {
          sc(ws, r, 2, '💬 LES DÉDICACES (anonymes)', { bg: C.teal, fg: C.white, bold: true, sz: 11 }); ws.mergeCells(r, 2, r, 4); r++
          for (const d of dedicaces) { sc(ws, r, 2, '«', { ha: 'center' }); sc(ws, r, 3, d, { sz: 10, it: true }); ws.mergeCells(r, 3, r, 4); ws.getRow(r).height = 24; r++ }
          r++
        }
        const signaux = het.map((p) => p.signaux).filter(Boolean) as string[]
        if (signaux.length) {
          sc(ws, r, 2, '📡 LES SIGNAUX (peur / blessure / angle mort)', { bg: C.teal, fg: C.white, bold: true, sz: 11 }); ws.mergeCells(r, 2, r, 4); r++
          for (const s of signaux) { sc(ws, r, 2, '«', { ha: 'center' }); sc(ws, r, 3, s, { sz: 10, it: true }); ws.mergeCells(r, 3, r, 4); ws.getRow(r).height = 24; r++ }
        }
      }
    }

    // ─── 3. La cascade (services, postes, parties prenantes) ───
    {
      const ws = wb.addWorksheet('La cascade')
      ws.getColumn(1).width = 3; ws.getColumn(2).width = 34; ws.getColumn(3).width = 10; ws.getColumn(4).width = 26; ws.getColumn(5).width = 22; ws.getColumn(6).width = 20; ws.getColumn(7).width = 70
      let r = 2
      sc(ws, r, 2, 'LA CASCADE — services, postes d’encadrement, parties prenantes', { bg: C.teal, fg: C.white, bold: true, sz: 12 }); ws.mergeCells(r, 2, r, 7); ws.getRow(r).height = 22; r += 2
      const headers = ['Être', 'Regards', 'Animal (majoritaire)', 'Relation', 'Adéquation (moy.)', 'Milieux décrits · signaux (verbatims anonymes)']
      headers.forEach((h, i) => sc(ws, r, 2 + i, h, { bg: C.sage, fg: C.white, bold: true, sz: 10 })); r++
      for (const groupe of ['Services', "Postes d'encadrement", 'Parties prenantes']) {
        const defs = etreDefs.filter((e) => e.groupe === groupe && portraits.some((p) => p.etre_key === e.key))
        if (!defs.length) continue
        sc(ws, r, 2, groupe.toUpperCase(), { bg: C.tealL, bold: true, sz: 10 }); ws.mergeCells(r, 2, r, 7); r++
        for (const def of defs) {
          const regs = regardsDe(def.key)
          const n = nRegards(def.key)
          if (!restituable(def.key)) {
            sc(ws, r, 2, def.label, { bold: true, sz: 10 })
            sc(ws, r, 3, `${n}/${SEUIL_RESTITUTION}`, { ha: 'center', sz: 10 })
            sc(ws, r, 4, '🔒 Sous le seuil — non restitué (contrat de règles)', { bg: C.alertL, fg: C.alert, sz: 9.5 }); ws.mergeCells(r, 4, r, 7)
            r++; continue
          }
          const esp = modeOf(regs.map((p) => p.espece_id))
          const rel = modeOf(regs.map((p) => p.relation))
          const v = avgOf(regs.map((p) => p.verdict_marche || 0).filter(Boolean))
          const verbatims = [
            ...regs.map((p) => p.milieu_libre).filter(Boolean).map((m) => `Milieu : « ${m} »`),
            ...regs.map((p) => p.signaux).filter(Boolean).map((s) => `Signal : « ${s} »`),
          ].join('\n')
          sc(ws, r, 2, def.label, { bold: true, sz: 10 })
          sc(ws, r, 3, String(n), { ha: 'center', sz: 10 })
          sc(ws, r, 4, espLabel(esp), { sz: 10 })
          sc(ws, r, 5, rel ? relLabel(rel) : '—', { sz: 10 })
          sc(ws, r, 6, vLabel(v), { sz: 10 })
          sc(ws, r, 7, verbatims || '—', { sz: 9 })
          ws.getRow(r).height = Math.max(20, Math.min(160, 14 * (verbatims.split('\n').length || 1) + 6))
          r++
        }
      }
    }

    // ─── 4. Portraits (données brutes, anonymes, seuil respecté) ───
    {
      const ws = wb.addWorksheet('Portraits (brut)')
      ws.getColumn(1).width = 3
      const cols = ['Être', 'Groupe', 'Regard', 'Espèce (marché)', 'Espèce (cité)', 'Habitat marché', 'Habitat cité', 'Adéq. marché', 'Adéq. cité', 'Milieu décrit', 'Relation', 'Signaux', 'Dédicace', 'Justification', 'Méthode']
      const widths = [28, 18, 10, 22, 22, 18, 18, 16, 16, 50, 16, 50, 40, 40, 10]
      cols.forEach((h, i) => { sc(ws, 2, 2 + i, h, { bg: C.teal, fg: C.white, bold: true, sz: 9 }); ws.getColumn(2 + i).width = widths[i] })
      let r = 3
      for (const def of etreDefs) {
        if (!portraits.some((p) => p.etre_key === def.key)) continue
        if (!restituable(def.key)) {
          sc(ws, r, 2, def.label, { bold: true, sz: 9 }); sc(ws, r, 3, def.groupe, { sz: 9 })
          sc(ws, r, 4, `🔒 Sous le seuil (${nRegards(def.key)}/${SEUIL_RESTITUTION}) — contenu non exporté (contrat de règles)`, { bg: C.alertL, fg: C.alert, sz: 9 }); ws.mergeCells(r, 4, r, 16)
          r++; continue
        }
        const all = portraits.filter((p) => p.etre_key === def.key)
        let idx = 0
        for (const p of all) {
          idx++
          const vals: (string | null)[] = [
            def.label, def.groupe,
            p.kind === 'auto' ? 'Dirigeant' : `Regard ${idx}`,
            espLabel(p.espece_id),
            p.espece_cite_id ? espLabel(p.espece_cite_id) : '—',
            habLabel(p.habitat_marche_id), habLabel(p.habitat_cite_id),
            vLabel(p.verdict_marche), vLabel(p.verdict_cite),
            p.milieu_libre ?? '—', p.relation ? relLabel(p.relation) : '—',
            p.signaux ?? '—', p.dedicace ?? '—', p.justification ?? '—',
            p.methode === 'ia' ? 'IA' : 'Manuel',
          ]
          vals.forEach((v, i) => sc(ws, r, 2 + i, v, { sz: 8.5, bg: p.kind === 'auto' ? C.cream : (r % 2 ? C.white : C.grayL) }))
          ws.getRow(r).height = 30
          r++
        }
      }
    }

    // ─── 5. Engagements ───
    {
      const ws = wb.addWorksheet('Engagements')
      ws.getColumn(1).width = 3; ws.getColumn(2).width = 6; ws.getColumn(3).width = 24; ws.getColumn(4).width = 56; ws.getColumn(5).width = 20; ws.getColumn(6).width = 56; ws.getColumn(7).width = 20
      let r = 2
      sc(ws, r, 2, 'LES ENGAGEMENTS — 3 maximum, en comportements observables (méthode §7.1)', { bg: C.teal, fg: C.white, bold: true, sz: 12 }); ws.mergeCells(r, 2, r, 7); ws.getRow(r).height = 22; r += 2
      const heads = ['N°', 'Qui', 'Fera quoi', 'À partir de', '👁 On le verra à (comportement observable)', 'Statut']
      heads.forEach((h, i) => sc(ws, r, 2 + i, h, { bg: C.sage, fg: C.white, bold: true, sz: 10 })); r++
      const statutLabels: Record<string, string> = { en_cours: 'En cours', constate: 'Comportement constaté ✓', abandonne: 'Abandonné' }
      engagements.forEach((e, i) => {
        sc(ws, r, 2, String(i + 1), { ha: 'center', bold: true })
        sc(ws, r, 3, e.qui, { sz: 10, bold: true })
        sc(ws, r, 4, e.quoi, { sz: 10 })
        sc(ws, r, 5, e.echeance ?? '—', { sz: 10 })
        sc(ws, r, 6, e.comportement, { sz: 10 })
        sc(ws, r, 7, statutLabels[e.statut] ?? e.statut, { sz: 10, bg: e.statut === 'constate' ? C.sageL : e.statut === 'abandonne' ? C.alertL : C.grayL })
        ws.getRow(r).height = 30
        r++
      })
      if (!engagements.length) { sc(ws, r, 2, 'Aucun engagement posé.', { it: true, sz: 10 }); ws.mergeCells(r, 2, r, 7) }
    }

    // ─── Export ───
    const buffer = await wb.xlsx.writeBuffer()
    const filename = `LeMiroir_${orgNom.replace(/[^a-z0-9]/gi, '_')}_${camp.annee}.xlsx`
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('[le-miroir/export-excel]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

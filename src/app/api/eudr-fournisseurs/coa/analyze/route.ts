import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp } from '@/lib/sharepointMulti'
import { analyzeCoa, CoaFile, CoaRow } from '@/lib/eudr/coaAnalyze'
import { evaluateConformity } from '@/lib/eudr/coaConformity'
import { guard } from '../../traces/_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

/** Lit les octets + le mime d'un fichier eudr_attachments depuis SharePoint. */
async function readAttachment(orgId: string, attId: string): Promise<CoaFile | null> {
  const admin = createAdminClient()
  const { data: row } = await admin.from('eudr_attachments')
    .select('sharepoint_item_id, mime, name').eq('id', attId).eq('org_id', orgId).maybeSingle()
  if (!row) return null
  const res = await spGraphForApp('eudr-fournisseurs', `/items/${row.sharepoint_item_id}`)
  if (!res.ok) return null
  const item = await res.json() as Record<string, unknown>
  const url = item['@microsoft.graph.downloadUrl'] as string | undefined
  if (!url) return null
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
  const mime = (row.mime as string) || (item.file as { mimeType?: string })?.mimeType || 'application/octet-stream'
  return { data: buf, mime, name: (row.name as string) || 'fichier' }
}

/** POST { org_id, coa_id } — lance l'analyse IA du COA et enregistre le résultat. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { org_id?: string; coa_id?: string }
    const auth = await guard(body.org_id ?? null, { requireEdit: true })
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    if (!body.coa_id) return NextResponse.json({ error: 'coa_id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data: coa } = await admin.from('eudr_coa')
      .select('source_attachment_id, client_demand_attachment_id')
      .eq('id', body.coa_id).eq('org_id', body.org_id).maybeSingle()
    if (!coa) return NextResponse.json({ error: 'COA introuvable' }, { status: 404 })
    if (!coa.source_attachment_id) return NextResponse.json({ error: 'Aucun fichier COA téléversé.' }, { status: 400 })

    const coaFile = await readAttachment(body.org_id!, coa.source_attachment_id as string)
    if (!coaFile) return NextResponse.json({ error: 'Fichier COA introuvable sur SharePoint.' }, { status: 502 })
    const demandFile = coa.client_demand_attachment_id
      ? await readAttachment(body.org_id!, coa.client_demand_attachment_id as string)
      : null

    const extraction = await analyzeCoa(coaFile, demandFile)

    // Moteur déterministe : autoritaire pour les lignes numériques ; sinon on garde le verdict IA.
    const rows: CoaRow[] = (extraction.rows ?? []).map(r => {
      const det = evaluateConformity(r.specification, r.resultat)
      if (det.verdict === 'conforme' || det.verdict === 'non_conforme') {
        return { ...r, verdict: det.verdict, commentaire: det.reason, source: r.source || 'Règle automatique' }
      }
      return r // a_verifier déterministe → on conserve l'appréciation de l'IA (demande client / source officielle)
    })

    const counts = {
      conforme: rows.filter(r => r.verdict === 'conforme').length,
      non_conforme: rows.filter(r => r.verdict === 'non_conforme').length,
      a_verifier: rows.filter(r => r.verdict === 'a_verifier').length,
    }
    const conformeGlobal = counts.non_conforme === 0
    const analysis = rows.map(r => ({ section: r.section, parametre: r.parametre, specification: r.specification, resultat: r.resultat, verdict: r.verdict, reason: r.commentaire, source: r.source }))
    const summary = { conforme_global: conformeGlobal, resume: extraction.summary?.resume ?? '', counts }

    const { data: saved, error } = await admin.from('eudr_coa').update({
      extracted: { header: extraction.header, rows },
      analysis,
      summary,
      points_a_verifier: extraction.points_a_verifier ?? [],
      status: 'analyzed',
      analyzed_at: new Date().toISOString(),
      analyzed_model: 'claude-opus-4-8',
      updated_at: new Date().toISOString(),
    }).eq('id', body.coa_id).eq('org_id', body.org_id)
      .select('id, extracted, analysis, summary, points_a_verifier, status, analyzed_at, analyzed_model')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data: saved })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message ?? String(err) }, { status: 502 })
  }
}

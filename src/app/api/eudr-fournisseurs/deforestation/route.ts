import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp } from '@/lib/sharepointMulti'
import { analyzeDeforestation } from '@/lib/eudr/whisp'
import { guard } from '../traces/_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Lit un GeoJSON stocké dans SharePoint (par id d'attachement). */
async function readGeojson(orgId: string, attachmentId: string): Promise<{ text: string; name: string }> {
  const admin = createAdminClient()
  const { data: row } = await admin.from('eudr_attachments')
    .select('sharepoint_item_id, name').eq('id', attachmentId).eq('org_id', orgId).maybeSingle()
  if (!row) throw new Error('Document GeoJSON introuvable.')
  const res = await spGraphForApp('eudr-fournisseurs', `/items/${row.sharepoint_item_id}`)
  if (!res.ok) throw new Error('Fichier GeoJSON SharePoint introuvable.')
  const item = await res.json() as Record<string, unknown>
  const url = item['@microsoft.graph.downloadUrl'] as string | undefined
  if (!url) throw new Error('URL de téléchargement GeoJSON indisponible.')
  const text = Buffer.from(await (await fetch(url)).arrayBuffer()).toString('utf-8')
  return { text, name: (row.name as string) ?? 'geojson' }
}

/** GET ?org_id=xxx — liste des analyses de déforestation de l'org. */
export async function GET(req: NextRequest) {
  const orgId = new URL(req.url).searchParams.get('org_id')
  const auth = await guard(orgId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { data, error } = await createAdminClient()
    .from('eudr_deforestation').select('*').eq('org_id', orgId!).order('analyzed_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

/**
 * POST { org_id, attachmentId, entity_type?, entity_id? }
 * Analyse le GeoJSON via Whisp et stocke le verdict de risque déforestation.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { org_id?: string; attachmentId?: string; entity_type?: string; entity_id?: string }
    const auth = await guard(body.org_id ?? null, { requireEdit: true })
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    if (!body.attachmentId) return NextResponse.json({ error: 'attachmentId requis' }, { status: 400 })

    const apiKey = process.env.WHISP_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Clé Whisp non configurée (WHISP_API_KEY).' }, { status: 400 })

    const { text, name } = await readGeojson(body.org_id!, body.attachmentId)
    let geojson: unknown
    try { geojson = JSON.parse(text) } catch { return NextResponse.json({ error: 'GeoJSON invalide.' }, { status: 400 }) }

    const result = await analyzeDeforestation(geojson, apiKey)

    const { data: { user } } = await createUserClient().auth.getUser()
    const admin = createAdminClient()
    const row = {
      org_id: body.org_id!, attachment_id: body.attachmentId,
      entity_type: body.entity_type ?? null, entity_id: body.entity_id ?? null,
      source_name: name, analyzed_at: new Date().toISOString(), analyzed_by: user?.email ?? null,
      overall_risk: result.overallRisk, plot_count: result.plotCount,
      summary: result.summary, plots: result.plots,
    }
    const { data, error } = await admin.from('eudr_deforestation')
      .upsert(row, { onConflict: 'org_id,attachment_id' }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message ?? err) }, { status: 502 })
  }
}

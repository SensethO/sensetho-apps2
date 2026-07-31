import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp } from '@/lib/sharepointMulti'
import { fetchSentinelImage, bboxOf, SENTINEL_MIME } from '@/lib/eudr/sentinel'
import { guard } from '../traces/_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET ?org_id&attachmentId&from&to&plot=
 * Renvoie une image Sentinel-2 (PNG) de la bbox du GeoJSON (ou d'une parcelle) pour une période.
 * Sert de source à une balise <img> (auth par cookie de session, même origine).
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const orgId = sp.get('org_id')
    const auth = await guard(orgId)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const attachmentId = sp.get('attachmentId')
    const from = sp.get('from'), to = sp.get('to')
    if (!attachmentId || !from || !to) return NextResponse.json({ error: 'attachmentId, from, to requis' }, { status: 400 })
    const plot = sp.get('plot') != null ? Number(sp.get('plot')) : undefined

    const admin = createAdminClient()
    const { data: row } = await admin.from('eudr_attachments').select('sharepoint_item_id').eq('id', attachmentId).eq('org_id', orgId!).maybeSingle()
    if (!row) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
    const meta = await spGraphForApp('eudr-fournisseurs', `/items/${row.sharepoint_item_id}`)
    if (!meta.ok) return NextResponse.json({ error: 'Fichier SharePoint introuvable' }, { status: 404 })
    const item = await meta.json() as Record<string, unknown>
    const url = item['@microsoft.graph.downloadUrl'] as string | undefined
    if (!url) return NextResponse.json({ error: 'URL indisponible' }, { status: 404 })
    const geojson = JSON.parse(Buffer.from(await (await fetch(url)).arrayBuffer()).toString('utf-8'))

    const bbox = bboxOf(geojson, plot)
    const png = await fetchSentinelImage(bbox, from, to)
    return new NextResponse(new Uint8Array(png), {
      status: 200,
      // L'URL fixe entièrement l'image (document, période, parcelle) : son contenu ne peut
      // plus changer. Un cache long évite de repayer Sentinel et une invocation à chaque
      // ouverture de la carte — c'était une heure, donc redemandé sans cesse.
      headers: { 'Content-Type': SENTINEL_MIME, 'Cache-Control': 'private, max-age=604800, immutable' },
    })
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message ?? err) }, { status: 502 })
  }
}

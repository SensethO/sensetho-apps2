import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp } from '@/lib/sharepointMulti'
import { bboxOf } from '@/lib/eudr/sentinel'
import { guard } from '../../traces/_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ring = number[][]

/** Extrait les anneaux extérieurs (lon/lat) des features polygonales, à plat. */
function outerRings(features: Array<{ geometry?: { type?: string; coordinates?: unknown } }>): Ring[] {
  const out: Ring[] = []
  for (const f of features) {
    const g = f.geometry
    if (!g) continue
    if (g.type === 'Polygon') out.push((g.coordinates as Ring[])[0])
    else if (g.type === 'MultiPolygon') for (const poly of g.coordinates as Ring[][]) out.push(poly[0])
  }
  return out
}

/**
 * GET ?org_id&attachmentId&plot=
 * Renvoie la bbox utilisée pour l'image satellite et les contours des parcelles, afin de
 * les tracer en superposition côté navigateur (aucune image générée ici).
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const orgId = sp.get('org_id')
    const auth = await guard(orgId)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const attachmentId = sp.get('attachmentId')
    if (!attachmentId) return NextResponse.json({ error: 'attachmentId requis' }, { status: 400 })
    const plot = sp.get('plot') != null ? Number(sp.get('plot')) : undefined

    const { data: row } = await createAdminClient()
      .from('eudr_attachments').select('sharepoint_item_id').eq('id', attachmentId).eq('org_id', orgId!).maybeSingle()
    if (!row) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
    const meta = await spGraphForApp('eudr-fournisseurs', `/items/${row.sharepoint_item_id}`)
    if (!meta.ok) return NextResponse.json({ error: 'Fichier SharePoint introuvable' }, { status: 404 })
    const item = await meta.json() as Record<string, unknown>
    const url = item['@microsoft.graph.downloadUrl'] as string | undefined
    if (!url) return NextResponse.json({ error: 'URL indisponible' }, { status: 404 })
    const geojson = JSON.parse(Buffer.from(await (await fetch(url)).arrayBuffer()).toString('utf-8')) as
      { features?: Array<{ geometry?: { type?: string; coordinates?: unknown } }> }

    // Même bbox que l'image : la superposition se cale donc exactement dessus.
    const bbox = bboxOf(geojson as never, plot)
    const feats = geojson.features ?? []
    const target = (plot != null && feats[plot]) ? [feats[plot]] : feats

    return NextResponse.json(
      { bbox, rings: outerRings(target) },
      // Contours figés par le document : inutile de les redemander à chaque ouverture.
      { headers: { 'Cache-Control': 'private, max-age=86400' } },
    )
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message ?? err) }, { status: 502 })
  }
}

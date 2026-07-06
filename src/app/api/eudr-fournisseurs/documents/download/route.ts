import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp } from '@/lib/sharepointMulti'
import { guard } from '../../traces/_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET ?org_id&id — renvoie l'URL de téléchargement signée SharePoint (Graph). */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const orgId = sp.get('org_id')
    const id = sp.get('id')
    const auth = await guard(orgId)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data: row } = await admin.from('eudr_attachments')
      .select('sharepoint_item_id').eq('id', id).eq('org_id', orgId).maybeSingle()
    if (!row) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

    const res = await spGraphForApp('eudr-fournisseurs', `/items/${row.sharepoint_item_id}`)
    if (!res.ok) return NextResponse.json({ error: 'Fichier SharePoint introuvable' }, { status: 502 })
    const item = await res.json() as Record<string, unknown>
    const url = item['@microsoft.graph.downloadUrl'] as string | undefined
    if (!url) return NextResponse.json({ error: 'URL de téléchargement indisponible' }, { status: 502 })
    return NextResponse.json({ url })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

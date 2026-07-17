import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp } from '@/lib/sharepointMulti'
import { guard } from '../_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET ?org_id&id — aperçu d'un document GeoJSON (eudr_attachments) : nombre de
 * features/parcelles + types de géométrie. Sert à confirmer visuellement ce qui
 * sera injecté dans la DDS (le fichier est lu côté serveur au dépôt).
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const orgId = sp.get('org_id'); const id = sp.get('id')
    const auth = await guard(orgId)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data: row } = await admin.from('eudr_attachments').select('sharepoint_item_id, name').eq('id', id).eq('org_id', orgId).maybeSingle()
    if (!row) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
    const res = await spGraphForApp('eudr-fournisseurs', `/items/${row.sharepoint_item_id}`)
    if (!res.ok) return NextResponse.json({ error: 'Fichier SharePoint introuvable' }, { status: 502 })
    const item = await res.json() as Record<string, unknown>
    const url = item['@microsoft.graph.downloadUrl'] as string | undefined
    if (!url) return NextResponse.json({ error: 'URL indisponible' }, { status: 502 })
    const txt = await (await fetch(url)).text()

    let features = 0; const types = new Set<string>()
    try {
      const g = JSON.parse(txt) as { type?: string; features?: { geometry?: { type?: string } }[] }
      const feats = Array.isArray(g.features) ? g.features : (Array.isArray(g as unknown as unknown[]) ? (g as unknown as { geometry?: { type?: string } }[]) : [])
      features = feats.length
      feats.forEach(f => { if (f?.geometry?.type) types.add(f.geometry.type) })
    } catch {
      return NextResponse.json({ ok: false, error: 'Le document n’est pas un JSON valide.' })
    }
    return NextResponse.json({ ok: true, name: row.name, features, types: [...types], bytes: txt.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spGraphForApp } from '@/lib/sharepointMulti'
import { guard } from '../traces/_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET ?org_id&entity_type&entity_id — liste les documents d'une entité (fournisseur/contrat). */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const orgId = sp.get('org_id')
    const auth = await guard(orgId)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const entityType = sp.get('entity_type')
    const entityId = sp.get('entity_id')
    if (!entityType || !entityId) return NextResponse.json({ error: 'entity_type et entity_id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data } = await admin.from('eudr_attachments')
      .select('id, name, doc_type, mime, size, created_at')
      .eq('org_id', orgId).eq('entity_type', entityType).eq('entity_id', entityId)
      .order('created_at', { ascending: false })
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE ?org_id&id — supprime un document (SharePoint + métadonnées). */
export async function DELETE(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const orgId = sp.get('org_id')
    const id = sp.get('id')
    const auth = await guard(orgId, { requireEdit: true })
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data: row } = await admin.from('eudr_attachments')
      .select('sharepoint_item_id').eq('id', id).eq('org_id', orgId).maybeSingle()
    if (!row) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

    // Supprime le fichier sur SharePoint puis la métadonnée.
    await spGraphForApp('eudr-fournisseurs', `/items/${row.sharepoint_item_id}`, { method: 'DELETE' })
    await admin.from('eudr_attachments').delete().eq('id', id).eq('org_id', orgId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

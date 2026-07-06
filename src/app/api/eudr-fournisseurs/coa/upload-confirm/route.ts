import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { guard } from '../../traces/_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST { org_id, coa_id, kind, spItemId, name, mime, size }
 * Enregistre les métadonnées du fichier COA/demande déjà déposé sur SharePoint
 * (eudr_attachments) et le rattache au COA (source_attachment_id / client_demand_attachment_id).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      org_id?: string; coa_id?: string; kind?: string
      spItemId?: string; name?: string; mime?: string; size?: number
    }
    const auth = await guard(body.org_id ?? null, { requireEdit: true })
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    if (!body.coa_id || !body.spItemId || !body.name) return NextResponse.json({ error: 'coa_id, spItemId et name requis' }, { status: 400 })
    const kind = body.kind === 'client_demand' ? 'client_demand' : 'coa'

    const admin = createAdminClient()
    const { data: att, error } = await admin.from('eudr_attachments').insert({
      org_id: body.org_id,
      entity_type: 'coa',
      entity_id: body.coa_id,
      doc_type: kind,
      name: body.name,
      sharepoint_item_id: body.spItemId,
      mime: body.mime ?? null,
      size: body.size ?? null,
      created_by: auth.userId,
    }).select('id, name, mime, size').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const field = kind === 'client_demand' ? 'client_demand_attachment_id' : 'source_attachment_id'
    await admin.from('eudr_coa').update({ [field]: att.id, updated_at: new Date().toISOString() }).eq('id', body.coa_id).eq('org_id', body.org_id)

    return NextResponse.json({ data: att })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

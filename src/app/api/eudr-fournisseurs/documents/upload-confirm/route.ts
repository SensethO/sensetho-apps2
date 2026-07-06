import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { guard } from '../../traces/_auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DOC_TYPES = ['geojson', 'questionnaire', 'certificate', 'ddr', 'dds', 'other']

/**
 * POST { org_id, entity_type, entity_id, spItemId, name, mime, size, doc_type }
 * Enregistre les métadonnées d'un fichier déjà déposé sur SharePoint.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      org_id?: string; entity_type?: string; entity_id?: string
      spItemId?: string; name?: string; mime?: string; size?: number; doc_type?: string
    }
    const auth = await guard(body.org_id ?? null, { requireEdit: true })
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const entityType = body.entity_type === 'contract' ? 'contract' : body.entity_type === 'supplier' ? 'supplier' : null
    if (!entityType || !body.entity_id) return NextResponse.json({ error: 'entity_type et entity_id requis' }, { status: 400 })
    if (!body.spItemId || !body.name) return NextResponse.json({ error: 'spItemId et name requis' }, { status: 400 })
    const docType = DOC_TYPES.includes(body.doc_type ?? '') ? body.doc_type! : 'other'

    const admin = createAdminClient()
    const { data, error } = await admin.from('eudr_attachments').insert({
      org_id: body.org_id,
      entity_type: entityType,
      entity_id: body.entity_id,
      doc_type: docType,
      name: body.name,
      sharepoint_item_id: body.spItemId,
      mime: body.mime ?? null,
      size: body.size ?? null,
      created_by: auth.userId,
    }).select('id, name, doc_type, mime, size, created_at').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

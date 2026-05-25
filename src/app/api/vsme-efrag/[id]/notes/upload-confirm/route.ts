import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as {
      actionKey?: string; attachmentId?: string; spItemId?: string
      name?: string; mime?: string; size?: number; annexeIndex?: number
    }
    const { actionKey, attachmentId, spItemId, name, mime, size, annexeIndex } = body
    if (!actionKey) return NextResponse.json({ error: 'actionKey required' }, { status: 400 })
    if (!spItemId)  return NextResponse.json({ error: 'spItemId required' }, { status: 400 })
    if (!name)      return NextResponse.json({ error: 'name required' }, { status: 400 })

    const admin = createAdminClient()
    const id = attachmentId ?? crypto.randomUUID()
    const { data: row, error: dbErr } = await admin
      .from('vsme_attachments')
      .insert({ id, vsme_id: params.id, action_key: actionKey, name, sharepoint_item_id: spItemId, mime: mime ?? null, size: size ?? null, annexe_index: annexeIndex ?? null })
      .select('id, name, sharepoint_item_id, mime, size, annexe_index')
      .single()

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
    return NextResponse.json({ data: row })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

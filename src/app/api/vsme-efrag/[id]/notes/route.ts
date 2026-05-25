import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function getVsmeId(vsmeId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from('vsme_settings').select('id').eq('id', vsmeId).single()
  return data?.id ?? null
}

/** GET /api/vsme-efrag/[id]/notes → { data: { notes, sections } } */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await getVsmeId(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const admin = createAdminClient()
    const { data: rows } = await admin
      .from('vsme_notes')
      .select('action_key, content, sections')
      .eq('vsme_id', params.id)

    const sections: Record<string, unknown[]> = {}
    const notes: Record<string, string> = {}
    for (const row of (rows ?? [])) {
      if (row.sections) sections[row.action_key] = row.sections
      if (row.content)  notes[row.action_key]   = row.content
    }
    return NextResponse.json({ data: { sections, notes } })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** PUT /api/vsme-efrag/[id]/notes — Body: { action_key, sections?, content? } */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await getVsmeId(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json() as { action_key?: string; sections?: unknown[]; content?: string }
    const { action_key, sections, content } = body
    if (!action_key) return NextResponse.json({ error: 'action_key required' }, { status: 400 })

    const admin = createAdminClient()
    const row: Record<string, unknown> = { vsme_id: params.id, action_key }
    if (sections !== undefined) row.sections = sections
    if (content  !== undefined) row.content  = content
    await admin.from('vsme_notes').upsert(row, { onConflict: 'vsme_id,action_key' })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

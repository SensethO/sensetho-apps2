import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function checkOwnership(sessionId: string, userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('pp_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single()
  return !!data
}

/** GET /api/parties-prenantes/sessions/[id]/notes */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!await checkOwnership(params.id, user.id)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const admin = createAdminClient()
    const { data: rows } = await admin
      .from('pp_session_notes')
      .select('note_key, content, sections')
      .eq('session_id', params.id)

    const notes: Record<string, string> = {}
    const sections: Record<string, unknown[]> = {}
    for (const row of (rows ?? [])) {
      if (row.content) notes[row.note_key] = row.content
      if (row.sections) sections[row.note_key] = row.sections as unknown[]
    }

    return NextResponse.json({ data: { notes, sections } })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** PUT /api/parties-prenantes/sessions/[id]/notes — Body: { note_key, content?, sections? } */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!await checkOwnership(params.id, user.id)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await req.json() as { note_key?: string; content?: string; sections?: unknown[] }
    const { note_key, content, sections } = body
    if (!note_key) return NextResponse.json({ error: 'note_key required' }, { status: 400 })

    const admin = createAdminClient()
    const row: Record<string, unknown> = { session_id: params.id, note_key }
    if (content !== undefined) row.content = content
    if (sections !== undefined) row.sections = sections

    await admin
      .from('pp_session_notes')
      .upsert(row, { onConflict: 'session_id,note_key' })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

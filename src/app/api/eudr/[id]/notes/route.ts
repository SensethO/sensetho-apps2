import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function canAccess(userId: string, diagnosticId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data } = await admin.from('eudr_diagnostics').select('user_id').eq('id', diagnosticId).single()
  return data?.user_id === userId
}

/**
 * GET /api/eudr/[id]/notes
 * Returns { data: { sections: Record<critere_id, NoteSection[]>, notes: Record<critere_id, string> } }
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createAdminClient()
    const { data: rows } = await admin
      .from('eudr_notes')
      .select('critere_id, content, sections')
      .eq('diagnostic_id', params.id)

    const sections: Record<string, unknown[]> = {}
    const notes: Record<string, string> = {}
    for (const row of (rows ?? [])) {
      if (row.sections) sections[row.critere_id] = row.sections
      if (row.content)  notes[row.critere_id]   = row.content
    }

    return NextResponse.json({ data: { sections, notes } })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/**
 * PUT /api/eudr/[id]/notes
 * Body: { action_key: critere_id, sections: NoteSection[], content?: string }
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json() as { action_key?: string; sections?: unknown[]; content?: string }
    const { action_key, sections, content } = body
    if (!action_key) return NextResponse.json({ error: 'action_key requis' }, { status: 400 })

    const admin = createAdminClient()
    const upsertRow: Record<string, unknown> = {
      diagnostic_id: params.id,
      critere_id: action_key,
      updated_at: new Date().toISOString(),
    }
    if (sections !== undefined) upsertRow.sections = sections
    if (content  !== undefined) upsertRow.content  = content

    await admin
      .from('eudr_notes')
      .upsert(upsertRow, { onConflict: 'diagnostic_id,critere_id' })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

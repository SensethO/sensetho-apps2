import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function createUserClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
}

async function canRead(userId: string, diagnosticId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('guided_diagnostics')
    .select('user_id, guided_diagnostic_shares(shared_with_user_id)')
    .eq('id', diagnosticId)
    .single()
  if (!data) return false
  if (data.user_id === userId) return true
  const shares = (data as Record<string, unknown>).guided_diagnostic_shares as Array<{ shared_with_user_id: string }> | undefined
  return shares?.some(s => s.shared_with_user_id === userId) ?? false
}

async function canWrite(userId: string, diagnosticId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('guided_diagnostics')
    .select('user_id, guided_diagnostic_shares(permission, shared_with_user_id)')
    .eq('id', diagnosticId)
    .single()
  if (!data) return false
  if (data.user_id === userId) return true
  const shares = (data as Record<string, unknown>).guided_diagnostic_shares as Array<{ permission: string; shared_with_user_id: string }> | undefined
  const share = shares?.find(s => s.shared_with_user_id === userId)
  return share?.permission === 'edit'
}

/**
 * GET /api/guided-diagnostic/[id]/notes
 * Returns { data: { sections: Record<string, NoteSection[]> } }
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canRead(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createAdminClient()
    const { data: rows } = await admin
      .from('guided_action_notes')
      .select('action_key, content, sections')
      .eq('diagnostic_id', params.id)

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

/**
 * PUT /api/guided-diagnostic/[id]/notes
 * Body: { action_key, sections: NoteSection[] }
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createUserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canWrite(user.id, params.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json() as { action_key?: string; sections?: unknown[]; content?: string }
    const { action_key, sections, content } = body
    if (!action_key) return NextResponse.json({ error: 'action_key required' }, { status: 400 })

    const admin = createAdminClient()
    const upsertRow: Record<string, unknown> = { diagnostic_id: params.id, action_key }
    if (sections !== undefined) upsertRow.sections = sections
    if (content  !== undefined) upsertRow.content  = content
    await admin
      .from('guided_action_notes')
      .upsert(upsertRow, { onConflict: 'diagnostic_id,action_key' })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

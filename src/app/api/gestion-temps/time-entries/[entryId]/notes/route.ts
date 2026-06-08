import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type Params = { params: { entryId: string } }

async function canAccess(userId: string, entryId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data: entry } = await admin.from('gt_time_entries').select('user_id, project_id').eq('id', entryId).single()
  if (!entry) return false
  if (entry.user_id === userId) return true
  // Propriétaire du projet peut accéder
  const { data: project } = await admin.from('gt_projects').select('owner_id').eq('id', entry.project_id).single()
  if (project?.owner_id === userId) return true
  // Membre du projet peut accéder
  const { data: member } = await admin.from('gt_project_members')
    .select('role').eq('project_id', entry.project_id).eq('user_id', userId).maybeSingle()
  return !!member
}

/**
 * GET /api/gestion-temps/time-entries/[entryId]/notes
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.entryId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createAdminClient()
    const { data: row } = await admin
      .from('gt_time_entry_notes')
      .select('sections, content')
      .eq('entry_id', params.entryId)
      .maybeSingle()

    const sections = { [params.entryId]: row?.sections ?? [] }
    const notes    = { [params.entryId]: row?.content ?? '' }

    return NextResponse.json({ data: { sections, notes } })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/**
 * PUT /api/gestion-temps/time-entries/[entryId]/notes
 * Body: { action_key, sections, content? }
 */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.entryId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json() as { sections?: unknown[]; content?: string }
    const { sections, content } = body

    const admin = createAdminClient()
    const upsertRow: Record<string, unknown> = {
      entry_id:   params.entryId,
      updated_at: new Date().toISOString(),
    }
    if (sections !== undefined) upsertRow.sections = sections
    if (content  !== undefined) upsertRow.content  = content

    await admin.from('gt_time_entry_notes').upsert(upsertRow, { onConflict: 'entry_id' })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

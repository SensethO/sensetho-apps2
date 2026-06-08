import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type Params = { params: { actionId: string } }

async function canAccess(userId: string, actionId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  const { data: action } = await admin.from('gt_actions').select('project_id').eq('id', actionId).single()
  if (!action) return false
  const { data: project } = await admin.from('gt_projects').select('owner_id').eq('id', action.project_id).single()
  if (!project) return false
  if (project.owner_id === userId) return true
  const { data: member } = await admin.from('gt_project_members')
    .select('role').eq('project_id', action.project_id).eq('user_id', userId).maybeSingle()
  return !!member
}

/**
 * GET /api/gestion-temps/actions/[actionId]/notes
 * Retourne { data: { sections: { [actionId]: NoteSection[] }, notes: { [actionId]: string } } }
 * (même format que les autres apps — le panel lit sections[actionKey] et notes[actionKey])
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.actionId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createAdminClient()
    const { data: row } = await admin
      .from('gt_action_notes')
      .select('sections, content')
      .eq('action_id', params.actionId)
      .maybeSingle()

    const sections = { [params.actionId]: row?.sections ?? [] }
    const notes    = { [params.actionId]: row?.content ?? '' }

    return NextResponse.json({ data: { sections, notes } })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/**
 * PUT /api/gestion-temps/actions/[actionId]/notes
 * Body: { action_key, sections, content? }
 */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await canAccess(user.id, params.actionId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json() as { action_key?: string; sections?: unknown[]; content?: string }
    const { sections, content } = body

    const admin = createAdminClient()
    const upsertRow: Record<string, unknown> = {
      action_id:  params.actionId,
      updated_at: new Date().toISOString(),
    }
    if (sections !== undefined) upsertRow.sections = sections
    if (content  !== undefined) upsertRow.content  = content

    await admin.from('gt_action_notes').upsert(upsertRow, { onConflict: 'action_id' })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string; actionId: string } }

/** PATCH /api/gestion-temps/projects/[id]/actions/[actionId] */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: action } = await admin.from('gt_actions').select('project_id').eq('id', params.actionId).single()
    if (!action || action.project_id !== params.id) return NextResponse.json({ error: 'Action introuvable' }, { status: 404 })

    const { data: project } = await admin.from('gt_projects').select('owner_id').eq('id', params.id).single()
    if (!project) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })

    const isOwner = project.owner_id === user.id
    if (!isOwner) {
      const { data: member } = await admin.from('gt_project_members')
        .select('role').eq('project_id', params.id).eq('user_id', user.id).maybeSingle()
      if (!member || member.role !== 'editor') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const body = await req.json()
    const allowed = ['name', 'description', 'planned_hours', 'status', 'priority', 'due_date', 'assigned_to', 'order_index']
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const k of allowed) if (k in body) patch[k] = body[k]

    const { data, error } = await admin.from('gt_actions').update(patch).eq('id', params.actionId).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE /api/gestion-temps/projects/[id]/actions/[actionId] */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: action } = await admin.from('gt_actions').select('project_id').eq('id', params.actionId).single()
    if (!action || action.project_id !== params.id) return NextResponse.json({ error: 'Action introuvable' }, { status: 404 })

    const { data: project } = await admin.from('gt_projects').select('owner_id').eq('id', params.id).single()
    if (!project || project.owner_id !== user.id) return NextResponse.json({ error: 'Owner only' }, { status: 403 })

    await admin.from('gt_actions').delete().eq('id', params.actionId)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

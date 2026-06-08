import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

async function checkAccess(projectId: string, userId: string) {
  const admin = createAdminClient()
  const { data: project } = await admin.from('gt_projects').select('owner_id').eq('id', projectId).single()
  if (!project) return false
  if (project.owner_id === userId) return true
  const { data: member } = await admin
    .from('gt_project_members').select('role').eq('project_id', projectId).eq('user_id', userId).maybeSingle()
  return !!member
}

/** GET /api/gestion-temps/projects/[id]/actions — liste des actions avec heures réalisées */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!(await checkAccess(params.id, user.id)))
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const admin = createAdminClient()
    const { data: actions, error } = await admin
      .from('gt_actions')
      .select('*')
      .eq('project_id', params.id)
      .order('order_index', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Heures réalisées par action
    const actionIds = (actions ?? []).map((a: { id: string }) => a.id)
    const { data: entries } = actionIds.length > 0
      ? await admin.from('gt_time_entries').select('action_id, hours, user_id, user_email').in('action_id', actionIds)
      : { data: [] }

    const actualByAction: Record<string, { total: number; byUser: Record<string, number> }> = {}
    for (const e of (entries ?? []) as { action_id: string; hours: number; user_email: string }[]) {
      if (!actualByAction[e.action_id]) actualByAction[e.action_id] = { total: 0, byUser: {} }
      actualByAction[e.action_id].total += Number(e.hours)
      actualByAction[e.action_id].byUser[e.user_email] =
        (actualByAction[e.action_id].byUser[e.user_email] ?? 0) + Number(e.hours)
    }

    const result = (actions ?? []).map((a: Record<string, unknown>) => ({
      ...a,
      actual_hours: actualByAction[a.id as string]?.total ?? 0,
      actual_by_user: actualByAction[a.id as string]?.byUser ?? {},
    }))

    return NextResponse.json({ data: result })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST /api/gestion-temps/projects/[id]/actions — créer une action */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!(await checkAccess(params.id, user.id)))
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const body = await req.json()
    const { name, description, planned_hours, priority, due_date, assigned_to } = body
    if (!name?.trim()) return NextResponse.json({ error: 'name requis' }, { status: 400 })

    const admin = createAdminClient()
    // order_index = max actuel + 1
    const { data: last } = await admin
      .from('gt_actions').select('order_index').eq('project_id', params.id)
      .order('order_index', { ascending: false }).limit(1).maybeSingle()

    const { data, error } = await admin.from('gt_actions').insert({
      project_id: params.id,
      name: name.trim(),
      description: description || null,
      planned_hours: Number(planned_hours) || 0,
      priority: priority ?? 'medium',
      due_date: due_date || null,
      assigned_to: assigned_to || null,
      order_index: ((last?.order_index as number) ?? -1) + 1,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: { ...data, actual_hours: 0, actual_by_user: {} } })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

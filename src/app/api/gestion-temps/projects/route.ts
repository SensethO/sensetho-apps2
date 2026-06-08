import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// ── Helpers ───────────────────────────────────────────────────
async function getUser() {
  const supabase = createRouteClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/** GET /api/gestion-temps/projects — liste tous les projets de l'utilisateur (own + shared) */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()

    // Projets dont je suis propriétaire
    const { data: ownProjects } = await admin
      .from('gt_projects')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })

    // Projets partagés avec moi
    const { data: memberRows } = await admin
      .from('gt_project_members')
      .select('project_id')
      .eq('user_id', user.id)

    const sharedIds = (memberRows ?? []).map(r => r.project_id)
    const { data: sharedProjects } = sharedIds.length > 0
      ? await admin.from('gt_projects').select('*').in('id', sharedIds).order('created_at', { ascending: false })
      : { data: [] }

    // Fusionner sans doublons
    const allIds = new Set((ownProjects ?? []).map((p: { id: string }) => p.id))
    const merged = [...(ownProjects ?? []), ...(sharedProjects ?? []).filter((p: { id: string }) => !allIds.has(p.id))]

    if (merged.length === 0) return NextResponse.json({ data: [] })

    const projectIds = merged.map((p: { id: string }) => p.id)

    // Membres de tous les projets
    const { data: members } = await admin
      .from('gt_project_members')
      .select('project_id, user_id, email, role')
      .in('project_id', projectIds)

    // Agrégats : planned_hours, actual_hours, action_count par projet
    const { data: actions } = await admin
      .from('gt_actions')
      .select('project_id, planned_hours, status')
      .in('project_id', projectIds)

    const { data: entries } = await admin
      .from('gt_time_entries')
      .select('project_id, hours')
      .in('project_id', projectIds)

    // Calcul des stats par projet
    const stats: Record<string, { planned: number; actual: number; actions: number }> = {}
    for (const pid of projectIds) {
      const pActions = (actions ?? []).filter((a: { project_id: string }) => a.project_id === pid)
      const pEntries = (entries ?? []).filter((e: { project_id: string }) => e.project_id === pid)
      stats[pid] = {
        planned: pActions.reduce((s: number, a: { planned_hours: number }) => s + Number(a.planned_hours), 0),
        actual:  pEntries.reduce((s: number, e: { hours: number }) => s + Number(e.hours), 0),
        actions: pActions.length,
      }
    }

    const result = merged.map(p => ({
      ...p,
      is_owner: p.owner_id === user.id,
      members: (members ?? []).filter((m: { project_id: string }) => m.project_id === p.id),
      planned_hours: stats[p.id]?.planned ?? 0,
      actual_hours:  stats[p.id]?.actual ?? 0,
      action_count:  stats[p.id]?.actions ?? 0,
    }))

    return NextResponse.json({ data: result })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST /api/gestion-temps/projects — créer un projet */
export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { name, description, type, color, status, start_date, end_date } = body

    if (!name?.trim()) return NextResponse.json({ error: 'name requis' }, { status: 400 })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('gt_projects')
      .insert({
        owner_id: user.id,
        name: name.trim(),
        description: description || null,
        type: type ?? 'strategic',
        color: color ?? '#10b981',
        status: status ?? 'active',
        start_date: start_date || null,
        end_date: end_date || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: { ...data, is_owner: true, members: [], planned_hours: 0, actual_hours: 0, action_count: 0 } })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

async function resolveAccess(projectId: string, userId: string, requireOwner = false) {
  const admin = createAdminClient()
  const { data: project } = await admin.from('gt_projects').select('*').eq('id', projectId).single()
  if (!project) return { project: null, canEdit: false }

  if (project.owner_id === userId) return { project, canEdit: true }
  if (requireOwner) return { project: null, canEdit: false }

  const { data: member } = await admin
    .from('gt_project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!member) return { project: null, canEdit: false }
  return { project, canEdit: member.role === 'editor' }
}

/** PATCH /api/gestion-temps/projects/[id] — modifier un projet */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { project, canEdit } = await resolveAccess(params.id, user.id)
    if (!project) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })
    if (!canEdit) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const body = await req.json()
    const allowed = ['name', 'description', 'type', 'color', 'status', 'start_date', 'end_date']
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const k of allowed) if (k in body) patch[k] = body[k]

    const admin = createAdminClient()
    const { data, error } = await admin.from('gt_projects').update(patch).eq('id', params.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** DELETE /api/gestion-temps/projects/[id] — supprimer (owner only) */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { project } = await resolveAccess(params.id, user.id, true)
    if (!project) return NextResponse.json({ error: 'Projet introuvable ou accès refusé' }, { status: 404 })

    const admin = createAdminClient()
    const { error } = await admin.from('gt_projects').delete().eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/** POST /api/gestion-temps/projects/[id] — ajouter un membre (owner only) */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { project } = await resolveAccess(params.id, user.id, true)
    if (!project) return NextResponse.json({ error: 'Projet introuvable ou accès refusé' }, { status: 404 })

    const body = await req.json()
    const { action, email, role, user_id } = body

    const admin = createAdminClient()

    if (action === 'add_member') {
      if (!email || !user_id) return NextResponse.json({ error: 'email et user_id requis' }, { status: 400 })
      const { error } = await admin.from('gt_project_members').upsert({
        project_id: params.id,
        user_id,
        email: email.toLowerCase().trim(),
        role: role ?? 'editor',
      }, { onConflict: 'project_id,user_id' })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data: { ok: true } })
    }

    if (action === 'remove_member') {
      if (!user_id) return NextResponse.json({ error: 'user_id requis' }, { status: 400 })
      await admin.from('gt_project_members').delete().eq('project_id', params.id).eq('user_id', user_id)
      return NextResponse.json({ data: { ok: true } })
    }

    return NextResponse.json({ error: 'action inconnue' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
